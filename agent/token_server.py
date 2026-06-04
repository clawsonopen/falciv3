import json
import os
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

app = Flask(__name__, static_folder=None)
CORS(app)

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "gemini-2.5-flash-lite"
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL") or "gemini-embedding-2"
GEMINI_RPM_LIMIT = int(os.getenv("GEMINI_RPM_LIMIT") or "10000")
GEMINI_TPM_LIMIT = int(os.getenv("GEMINI_TPM_LIMIT") or "10000000")
GEMINI_LIMIT_THRESHOLD = float(os.getenv("GEMINI_LIMIT_THRESHOLD") or "0.85")
GEMINI_TOKEN_SAFETY_MULTIPLIER = float(os.getenv("GEMINI_TOKEN_SAFETY_MULTIPLIER") or "2.0")
GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS") or "75")

WINDOW_SECONDS = 60
MIN_RETRY_AFTER_SECONDS = 8

quota_lock = threading.Lock()
quota_entries: deque[dict[str, Any]] = deque()


def _now() -> float:
    return time.time()


def _prune(now: float) -> None:
    while quota_entries and now - quota_entries[0]["ts"] >= WINDOW_SECONDS:
        quota_entries.popleft()


def _quota_totals(now: float) -> tuple[int, int]:
    _prune(now)
    requests_used = len(quota_entries)
    tokens_used = int(sum(entry["effective_tokens"] for entry in quota_entries))
    return requests_used, tokens_used


def _estimate_raw_tokens(payload: dict[str, Any]) -> int:
    # Türkçe metin ve görsel parçaları için Google tarafındaki sayım çoğu zaman
    # basit karakter hesabından yüksek çıkabildiği için tahmini bilinçli yüksek tutuyoruz.
    payload_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    inline_images = payload_text.count('"inline_data"') + payload_text.count('"inlineData"')
    return max(1, int(len(payload_text) / 3) + inline_images * 1400)


def _effective_tokens(raw_tokens: int | float | None) -> int:
    return max(1, int((float(raw_tokens or 0) * GEMINI_TOKEN_SAFETY_MULTIPLIER) + 0.999))


def _retry_after_seconds(now: float) -> int:
    if not quota_entries:
        return MIN_RETRY_AFTER_SECONDS
    oldest_age = now - quota_entries[0]["ts"]
    return max(MIN_RETRY_AFTER_SECONDS, int(WINDOW_SECONDS - oldest_age) + 1)


def _reserve_quota(estimated_raw_tokens: int) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    now = _now()
    estimated_effective_tokens = _effective_tokens(estimated_raw_tokens)
    with quota_lock:
        requests_used, tokens_used = _quota_totals(now)
        request_limit = int(GEMINI_RPM_LIMIT * GEMINI_LIMIT_THRESHOLD)
        token_limit = int(GEMINI_TPM_LIMIT * GEMINI_LIMIT_THRESHOLD)
        projected_requests = requests_used + 1
        projected_tokens = tokens_used + estimated_effective_tokens
        if projected_requests > request_limit or projected_tokens > token_limit:
            return None, {
                "ok": False,
                "error": "Şu an yoğunluk var. Biraz bekleyip yeniden deneyelim.",
                "retryAfterSeconds": _retry_after_seconds(now),
                "quota": {
                    "requestsUsed": requests_used,
                    "requestLimit": request_limit,
                    "effectiveTokensUsed": tokens_used,
                    "effectiveTokenLimit": token_limit,
                    "tokenSafetyMultiplier": GEMINI_TOKEN_SAFETY_MULTIPLIER,
                },
            }
        entry = {
            "ts": now,
            "effective_tokens": estimated_effective_tokens,
            "estimated_effective_tokens": estimated_effective_tokens,
        }
        quota_entries.append(entry)
        return entry, None


def _finalize_quota(entry: dict[str, Any], raw_total_tokens: int | float | None) -> None:
    with quota_lock:
        entry["effective_tokens"] = max(entry["estimated_effective_tokens"], _effective_tokens(raw_total_tokens))
        entry["raw_total_tokens"] = int(raw_total_tokens or 0)


def _gemini_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


def _gemini_embed_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_EMBEDDING_MODEL}:embedContent?key={GEMINI_API_KEY}"


def _call_gemini(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        _gemini_url(),
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=GEMINI_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data, response.status
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"error": {"message": raw or "Gemini yanıtı alınamadı."}}
        return data, err.code


def _call_gemini_embedding(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        _gemini_embed_url(),
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=GEMINI_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data, response.status
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"error": {"message": raw or "Gemini embedding yanıtı alınamadı."}}
        return data, err.code


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    first = candidates[0] if candidates else {}
    content = first.get("content") or {}
    parts = content.get("parts") or []
    return "".join(part.get("text") or "" for part in parts).strip()


@app.post("/gemini-generate")
def gemini_generate():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "Geçersiz yorum isteği."}), 400

    reservation, limit_error = _reserve_quota(_estimate_raw_tokens(payload))
    if limit_error:
        return jsonify(limit_error), 429

    data, status = _call_gemini(payload)
    usage_metadata = data.get("usageMetadata") or {}
    raw_total_tokens = int(usage_metadata.get("totalTokenCount") or 0)
    if reservation is not None:
        _finalize_quota(reservation, raw_total_tokens)

    if status < 200 or status >= 300:
        message = (data.get("error") or {}).get("message") or "Yorum yanıtı alınamadı."
        return jsonify({"ok": False, "error": message}), status

    text = _extract_text(data)
    if not text:
        return jsonify({"ok": False, "error": "Yorum kapısı boş yanıt döndürdü."}), 502

    safety_multiplier = GEMINI_TOKEN_SAFETY_MULTIPLIER
    prompt_tokens = int(usage_metadata.get("promptTokenCount") or 0)
    output_tokens = int(usage_metadata.get("candidatesTokenCount") or 0)
    total_tokens = int(usage_metadata.get("totalTokenCount") or prompt_tokens + output_tokens)
    return jsonify(
        {
            "ok": True,
            "text": text,
            "model": GEMINI_MODEL,
            "provider": "gemini",
            "finishReason": ((data.get("candidates") or [{}])[0] or {}).get("finishReason"),
            "usage": {
                "inputTokens": _effective_tokens(prompt_tokens),
                "outputTokens": _effective_tokens(output_tokens),
                "totalTokens": _effective_tokens(total_tokens),
                "rawInputTokens": prompt_tokens,
                "rawOutputTokens": output_tokens,
                "rawTotalTokens": total_tokens,
                "tokenSafetyMultiplier": safety_multiplier,
            },
        }
    )


@app.post("/gemini-embed")
def gemini_embed():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503

    request_payload = request.get_json(silent=True)
    if not isinstance(request_payload, dict):
        return jsonify({"ok": False, "error": "Geçersiz embedding isteği."}), 400

    text = str(request_payload.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "Embedding metni boş."}), 400

    task_type = str(request_payload.get("taskType") or "RETRIEVAL_DOCUMENT")
    embedding_model = str(request_payload.get("model") or GEMINI_EMBEDDING_MODEL)
    payload: dict[str, Any] = {
        "model": f"models/{embedding_model}",
        "content": {"parts": [{"text": text}]},
        "taskType": task_type,
    }
    output_dimensionality = request_payload.get("outputDimensionality")
    if output_dimensionality is not None:
        payload["outputDimensionality"] = output_dimensionality

    estimated_raw_tokens = max(1, int(len(text) / 3))
    reservation, limit_error = _reserve_quota(estimated_raw_tokens)
    if limit_error:
        return jsonify(limit_error), 429

    data, status = _call_gemini_embedding(payload)
    usage_metadata = data.get("usageMetadata") or {}
    prompt_tokens = int(usage_metadata.get("promptTokenCount") or estimated_raw_tokens)
    total_tokens = int(usage_metadata.get("totalTokenCount") or prompt_tokens)
    if reservation is not None:
        _finalize_quota(reservation, total_tokens)

    if status < 200 or status >= 300:
        message = (data.get("error") or {}).get("message") or "Gemini embedding yanıtı alınamadı."
        return jsonify({"ok": False, "error": message}), status

    values = ((data.get("embedding") or {}).get("values")) or []
    if not isinstance(values, list) or not values:
        return jsonify({"ok": False, "error": "Gemini embedding yanıtı boş döndü."}), 502

    return jsonify(
        {
            "ok": True,
            "model": GEMINI_EMBEDDING_MODEL,
            "provider": "gemini",
            "embedding": values,
            "usage": {
                "inputTokens": _effective_tokens(prompt_tokens),
                "outputTokens": 0,
                "totalTokens": _effective_tokens(total_tokens),
                "rawInputTokens": prompt_tokens,
                "rawOutputTokens": 0,
                "rawTotalTokens": total_tokens,
                "tokenSafetyMultiplier": GEMINI_TOKEN_SAFETY_MULTIPLIER,
            },
        }
    )


@app.get("/gemini-api-key")
def gemini_api_key():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503
    return jsonify(
        {
            "ok": True,
            "apiKey": GEMINI_API_KEY,
            "model": GEMINI_MODEL,
            "embeddingModel": GEMINI_EMBEDDING_MODEL,
        }
    )


@app.get("/health")
def health():
    now = _now()
    with quota_lock:
        requests_used, tokens_used = _quota_totals(now)
    return jsonify(
        {
            "ok": True,
            "service": "gemini-key-service",
            "model": GEMINI_MODEL,
            "embeddingModel": GEMINI_EMBEDDING_MODEL,
            "quota": {
                "windowSeconds": WINDOW_SECONDS,
                "requestsUsed": requests_used,
                "requestLimit": int(GEMINI_RPM_LIMIT * GEMINI_LIMIT_THRESHOLD),
                "effectiveTokensUsed": tokens_used,
                "effectiveTokenLimit": int(GEMINI_TPM_LIMIT * GEMINI_LIMIT_THRESHOLD),
                "tokenSafetyMultiplier": GEMINI_TOKEN_SAFETY_MULTIPLIER,
            },
        }
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT") or "8080")
    app.run(host="0.0.0.0", port=port, threaded=True)
