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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-5-nano"
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL") or "google/gemma-3n-E4B-it"
PUBLICAI_API_KEY = os.getenv("PUBLICAI_API_KEY")
PUBLICAI_MODEL = os.getenv("PUBLICAI_MODEL") or "utter-project/EuroLLM-22B-Instruct-2512"
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


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    first = candidates[0] if candidates else {}
    content = first.get("content") or {}
    parts = content.get("parts") or []
    return "".join(part.get("text") or "" for part in parts).strip()


def _call_openai(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
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
            data = {"error": {"message": raw or "OpenAI yanıtı alınamadı."}}
        return data, err.code


def _extract_openai_text(data: dict[str, Any]) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    chunks: list[str] = []
    for item in data.get("output") or []:
        for content in item.get("content") or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "".join(chunks).strip()


def _call_together(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.together.xyz/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {TOGETHER_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "together-ai-js/0.16.0 FALCI-v3",
        },
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
            data = {"error": {"message": raw or "Together yanıtı alınamadı."}}
        return data, err.code


def _extract_together_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    first = choices[0] if choices else {}
    message = first.get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return "".join(part.get("text") or "" for part in content if isinstance(part, dict)).strip()
    return ""


def _call_publicai(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.publicai.co/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {PUBLICAI_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FALCI-v3/1.0",
        },
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
            data = {"error": {"message": raw or "PublicAI yanıtı alınamadı."}}
        return data, err.code


def _extract_chat_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    first = choices[0] if choices else {}
    message = first.get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return "".join(part.get("text") or "" for part in content if isinstance(part, dict)).strip()
    return ""


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


@app.post("/openai-generate")
def openai_generate():
    if not OPENAI_API_KEY:
        return jsonify({"ok": False, "error": "OpenAI anahtarı yok."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "Geçersiz yorum isteği."}), 400

    if payload.get("provider") != "openai":
        return jsonify({"ok": False, "error": "Geçersiz OpenAI isteği."}), 400

    requested_model = str(payload.get("model") or OPENAI_MODEL)
    if requested_model != "gpt-5-nano":
        return jsonify({"ok": False, "error": "Bu endpoint yalnızca GPT-5 nano için açık."}), 400

    openai_payload = {
        "model": requested_model,
        "instructions": payload.get("instructions") or "",
        "input": payload.get("input") or [],
        "max_output_tokens": int(payload.get("max_output_tokens") or 900),
        "text": payload.get("text") or {"format": {"type": "text"}, "verbosity": "high"},
        "reasoning": payload.get("reasoning") or {"effort": "medium", "summary": "auto"},
        "store": bool(payload.get("store", True)),
    }

    data, status = _call_openai(openai_payload)
    if status < 200 or status >= 300:
        message = (data.get("error") or {}).get("message") or "OpenAI yanıtı alınamadı."
        return jsonify({"ok": False, "error": message}), status

    text = _extract_openai_text(data)
    if not text:
        return jsonify({"ok": False, "error": "Yorum kapısı boş yanıt döndürdü."}), 502

    usage = data.get("usage") or {}
    input_tokens = int(usage.get("input_tokens") or 0)
    output_tokens = int(usage.get("output_tokens") or 0)
    total_tokens = int(usage.get("total_tokens") or input_tokens + output_tokens)
    return jsonify(
        {
            "ok": True,
            "text": text,
            "model": data.get("model") or requested_model,
            "provider": "openai",
            "finishReason": data.get("status"),
            "usage": {
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
                "rawInputTokens": input_tokens,
                "rawOutputTokens": output_tokens,
                "rawTotalTokens": total_tokens,
            },
        }
    )


@app.post("/together-generate")
def together_generate():
    if not TOGETHER_API_KEY:
        return jsonify({"ok": False, "error": "Together anahtarı yok."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "Geçersiz yorum isteği."}), 400

    if payload.get("provider") != "together":
        return jsonify({"ok": False, "error": "Geçersiz Together isteği."}), 400

    requested_model = str(payload.get("model") or TOGETHER_MODEL)
    if requested_model != "google/gemma-3n-E4B-it":
        return jsonify({"ok": False, "error": "Bu endpoint yalnızca Together Gemma 3n için açık."}), 400

    together_payload = {
        "model": requested_model,
        "messages": payload.get("messages") or [],
        "max_tokens": int(payload.get("max_tokens") or 620),
        "temperature": float(payload.get("temperature") or 0.8),
        "top_p": float(payload.get("top_p") or 0.9),
    }

    data, status = _call_together(together_payload)
    if status < 200 or status >= 300:
        message = (data.get("error") or {}).get("message") or "Together yanıtı alınamadı."
        return jsonify({"ok": False, "error": message}), status

    text = _extract_together_text(data)
    if not text:
        return jsonify({"ok": False, "error": "Together boş yanıt döndürdü."}), 502

    usage = data.get("usage") or {}
    input_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    total_tokens = int(usage.get("total_tokens") or input_tokens + output_tokens)
    return jsonify(
        {
            "ok": True,
            "text": text,
            "model": data.get("model") or requested_model,
            "provider": "together",
            "usage": {
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
                "rawInputTokens": input_tokens,
                "rawOutputTokens": output_tokens,
                "rawTotalTokens": total_tokens,
            },
        }
    )


@app.post("/publicai-generate")
def publicai_generate():
    if not PUBLICAI_API_KEY:
        return jsonify({"ok": False, "error": "PublicAI anahtarı yok."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "Geçersiz yorum isteği."}), 400

    if payload.get("provider") != "publicai":
        return jsonify({"ok": False, "error": "Geçersiz PublicAI isteği."}), 400

    requested_model = str(payload.get("model") or PUBLICAI_MODEL)
    if requested_model != "utter-project/EuroLLM-22B-Instruct-2512":
        return jsonify({"ok": False, "error": "Bu endpoint yalnızca PublicAI EuroLLM için açık."}), 400

    publicai_payload = {
        "model": requested_model,
        "messages": payload.get("messages") or [],
        "max_tokens": int(payload.get("max_tokens") or 900),
        "temperature": float(payload.get("temperature") or 0.8),
        "top_p": float(payload.get("top_p") or 0.9),
    }

    data, status = _call_publicai(publicai_payload)
    if status < 200 or status >= 300:
        message = (data.get("error") or {}).get("message") or "PublicAI yanıtı alınamadı."
        return jsonify({"ok": False, "error": message}), status

    text = _extract_chat_text(data)
    if not text:
        return jsonify({"ok": False, "error": "PublicAI boş yanıt döndürdü."}), 502

    usage = data.get("usage") or {}
    input_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    total_tokens = int(usage.get("total_tokens") or input_tokens + output_tokens)
    return jsonify(
        {
            "ok": True,
            "text": text,
            "model": data.get("model") or requested_model,
            "provider": "publicai",
            "usage": {
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
                "rawInputTokens": input_tokens,
                "rawOutputTokens": output_tokens,
                "rawTotalTokens": total_tokens,
            },
        }
    )


@app.get("/gemini-api-key")
def gemini_api_key():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503
    return jsonify({"ok": True, "apiKey": GEMINI_API_KEY, "model": GEMINI_MODEL})


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
