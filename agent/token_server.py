import json
import hashlib
import os
import random
import re
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
import urllib.error
import urllib.request
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from astronomy_western import build_general_payload, build_personal_payload
from persona_prompt_builder import append_persona_closing, build_memory_context, build_prompt

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash-lite"
ASTRO_CACHE_LIMIT = 1200
_astro_cache: dict[str, dict] = {}


@app.get("/gemini-api-key")
def gemini_api_key():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503
    return jsonify({"ok": True, "apiKey": GEMINI_API_KEY, "model": GEMINI_MODEL})


def _iso_today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _normalize_period(value: str | None) -> str:
    text = (value or "daily").strip().lower()
    if text in {"daily", "weekly", "monthly", "yearly"}:
        return text
    return "daily"


def _normalize_sign(value: str | None) -> str:
    aliases = {
        "aries": "ARIES",
        "koç": "ARIES",
        "koc": "ARIES",
        "taurus": "TAURUS",
        "boğa": "TAURUS",
        "boga": "TAURUS",
        "gemini": "GEMINI",
        "ikizler": "GEMINI",
        "cancer": "CANCER",
        "yengeç": "CANCER",
        "yengec": "CANCER",
        "leo": "LEO",
        "aslan": "LEO",
        "virgo": "VIRGO",
        "başak": "VIRGO",
        "basak": "VIRGO",
        "libra": "LIBRA",
        "terazi": "LIBRA",
        "scorpio": "SCORPIO",
        "akrep": "SCORPIO",
        "sagittarius": "SAGITTARIUS",
        "yay": "SAGITTARIUS",
        "capricorn": "CAPRICORN",
        "oğlak": "CAPRICORN",
        "oglak": "CAPRICORN",
        "aquarius": "AQUARIUS",
        "kova": "AQUARIUS",
        "pisces": "PISCES",
        "balık": "PISCES",
        "balik": "PISCES",
    }
    return aliases.get((value or "pisces").strip().lower(), "PISCES")


def _normalize_target_date(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return _iso_today_utc()
    try:
        return datetime.fromisoformat(raw).date().isoformat()
    except ValueError:
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date().isoformat()
        except ValueError:
            return _iso_today_utc()


def _astro_cache_get(key: str) -> dict | None:
    cached = _astro_cache.get(key)
    return dict(cached) if cached else None


def _astro_cache_set(key: str, payload: dict) -> None:
    _astro_cache[key] = dict(payload)
    if len(_astro_cache) <= ASTRO_CACHE_LIMIT:
        return
    first = next(iter(_astro_cache.keys()))
    _astro_cache.pop(first, None)


GENERAL_ASTRO_STORE_FILE = BASE_DIR / "general_astro_llm_store.json"
GENERAL_ASTRO_HISTORY_LIMIT = 240
GENERAL_ASTRO_SIMILARITY_LIMIT = 0.78


def _load_general_astro_store() -> dict:
    if not GENERAL_ASTRO_STORE_FILE.exists():
        return {"schemaVersion": 1, "entries": {}, "historyBySignPeriod": {}}
    try:
        parsed = json.loads(GENERAL_ASTRO_STORE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"schemaVersion": 1, "entries": {}, "historyBySignPeriod": {}}
    if not isinstance(parsed, dict):
        return {"schemaVersion": 1, "entries": {}, "historyBySignPeriod": {}}
    return {
        "schemaVersion": 1,
        "entries": parsed.get("entries") or {},
        "historyBySignPeriod": parsed.get("historyBySignPeriod") or {},
    }


def _save_general_astro_store(store: dict) -> None:
    GENERAL_ASTRO_STORE_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")


def _period_key(period: str, target_date_iso: str) -> str:
    day = datetime.fromisoformat(target_date_iso).date()
    if period == "daily":
        return day.isoformat()
    if period == "yearly":
        return f"{day.year:04d}"
    if period == "monthly":
        return f"{day.year:04d}-{day.month:02d}"
    monday = day - timedelta(days=day.weekday())
    return f"{monday.year:04d}-W{monday.isocalendar().week:02d}"


def _norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _token_set(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-ZçğıöşüÇĞİÖŞÜ0-9]+", _norm_text(text)))


def _similarity(a: str, b: str) -> float:
    sa = _token_set(a)
    sb = _token_set(b)
    if not sa or not sb:
        return 0.0
    inter = len(sa.intersection(sb))
    union = len(sa.union(sb))
    if union == 0:
        return 0.0
    return inter / union


def _capitalize_sentences(text: str) -> str:
    out = []
    capitalize_next = True
    for ch in text:
        if capitalize_next and ch.isalpha():
            out.append(ch.upper())
            capitalize_next = False
        else:
            out.append(ch)
        if ch in ".!?\n":
            capitalize_next = True
        elif ch.isalpha() or ch.isdigit():
            capitalize_next = False
    return "".join(out)
def _token_api_url(model: str) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens?key={GEMINI_API_KEY}"


def _build_image_parts(images: dict) -> list[dict]:
    parts: list[dict] = []
    if images.get("cup"):
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": images["cup"]}})
    if images.get("saucer"):
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": images["saucer"]}})
    if images.get("palm"):
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": images["palm"]}})
    return parts


def _gemini_api_request(
    payload: dict,
    service_tier: str | None = None,
    timeout_seconds: int = 60,
) -> dict:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    request_payload = dict(payload)
    if service_tier:
        request_payload["service_tier"] = service_tier
    req = urllib.request.Request(
        url,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Gemini HTTP {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Gemini request failed: {e}") from e

    return json.loads(raw)


def _gemini_count_tokens(generate_content_request: dict) -> dict:
    url = _token_api_url(GEMINI_MODEL)
    req = urllib.request.Request(
        url,
        data=json.dumps({"generateContentRequest": generate_content_request}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except Exception:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _extract_usage_metadata(data: dict) -> dict:
    usage = data.get("usageMetadata") or data.get("usage_metadata") or {}
    return {
        "inputTokens": int(usage.get("promptTokenCount") or usage.get("prompt_token_count") or 0),
        "outputTokens": int(usage.get("candidatesTokenCount") or usage.get("candidates_token_count") or 0),
        "totalTokens": int(usage.get("totalTokenCount") or usage.get("total_token_count") or 0),
    }


def _empty_usage() -> dict:
    return {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0}


def _friendly_error(message: str | None = None) -> dict:
    return {"userMessage": message or PHOTO_RETRY_MESSAGE, "usage": _empty_usage()}


def _usage_add(total: dict, usage: dict) -> None:
    total["inputTokens"] += usage.get("inputTokens", 0)
    total["outputTokens"] += usage.get("outputTokens", 0)
    total["totalTokens"] += usage.get("totalTokens", 0)


def _classify_single_image_subject(image_data: str) -> tuple[dict, dict]:
    schema = {
        "type": "object",
        "properties": {
            "visualType": {
                "type": "string",
                "enum": [
                    "coffee_cup",
                    "coffee_saucer",
                    "coffee_cup_and_saucer",
                    "human_palm",
                    "human_hand_back",
                    "cat_paw",
                    "dog_paw",
                    "rabbit_paw",
                    "bird_foot",
                    "reptile_foot",
                    "animal_paw",
                    "insect",
                    "flower",
                    "face",
                    "landscape",
                    "other",
                ],
            },
            "visualLabelTr": {"type": "string"},
            "animalSpecies": {
                "type": "string",
                "enum": ["cat", "dog", "rabbit", "bird", "reptile", "other", "none"],
            },
            "confidence": {"type": "number"},
        },
        "required": ["visualType", "visualLabelTr", "animalSpecies", "confidence"],
    }
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Gorseldeki ana nesneyi Turkce etiketle ve siniflandir. "
                            "Kahve fincani/telvesi, kahve tabagi/telve tabagi, insan avuc ici, insan el sirti, "
                            "kedi patisi, kopek patisi, tavsan patisi, kus ayagi, surungen/iguana ayagi, bocek, cicek gibi ayrimlari yap. "
                            "visualLabelTr kisa ve dogal olsun: 'kahve fincani', 'fincan tabagi', 'insan avuc ici', 'kedi patisi' gibi."
                        )
                    },
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_data}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 100,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }
    data = _gemini_api_request(payload)
    text = _extract_text_from_gemini_response(data)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Image subject classifier returned invalid JSON: {text}") from e
    return parsed, _extract_usage_metadata(data)


def _visual_label(result: dict) -> str:
    return (result.get("visualLabelTr") or "uygun olmayan bir görsel").strip()


def _is_coffee_visual(result: dict) -> bool:
    return result.get("visualType") in {"coffee_cup", "coffee_saucer", "coffee_cup_and_saucer"}


def _coffee_surfaces_from_visual(result: dict) -> list[str]:
    visual_type = result.get("visualType")
    if visual_type == "coffee_cup":
        return ["cup"]
    if visual_type == "coffee_saucer":
        return ["saucer"]
    if visual_type == "coffee_cup_and_saucer":
        return ["cup", "saucer"]
    return []


def _is_human_hand_visual(result: dict) -> bool:
    return result.get("visualType") in {"human_palm", "human_hand_back"}


def _is_animal_paw_visual(result: dict) -> bool:
    return result.get("visualType") in {
        "cat_paw",
        "dog_paw",
        "rabbit_paw",
        "bird_foot",
        "reptile_foot",
        "animal_paw",
    }


def _normalize_pet_species(value: str | None) -> str | None:
    text = (value or "").strip().lower()
    if any(term in text for term in ("kedi", "cat")):
        return "cat"
    if any(term in text for term in ("kopek", "köpek", "dog")):
        return "dog"
    if any(term in text for term in ("tavsan", "tavşan", "rabbit")):
        return "rabbit"
    if any(term in text for term in ("kus", "kuş", "bird", "kanarya", "papagan", "papağan")):
        return "bird"
    if any(term in text for term in ("iguana", "surungen", "sürüngen", "reptile", "kertenkele")):
        return "reptile"
    return None


def _species_tr(species: str | None, fallback: str | None = None) -> str:
    labels = {
        "cat": "kedi",
        "dog": "köpek",
        "rabbit": "tavşan",
        "bird": "kuş",
        "reptile": "iguana/sürüngen",
        "other": "evcil hayvan",
    }
    return labels.get(species or "", fallback or "evcil hayvan")


def _validate_coffee_images_dynamic(images: dict) -> tuple[str | None, list[str], dict]:
    surfaces: list[str] = []
    usage_total = _empty_usage()
    first_wrong_label: str | None = None

    for slot in ("cup", "saucer"):
        image_data = images.get(slot)
        if not image_data:
            continue
        try:
            result, usage = _classify_single_image_subject(image_data)
        except Exception:
            return PHOTO_RETRY_MESSAGE, surfaces, usage_total
        _usage_add(usage_total, usage)
        if not _is_coffee_visual(result):
            first_wrong_label = _visual_label(result)
            break
        for surface in _coffee_surfaces_from_visual(result):
            if surface not in surfaces:
                surfaces.append(surface)

    if first_wrong_label:
        return (
            f"Kahve falı istemiştin fakat {first_wrong_label} yükledin. Lütfen fincan ve/veya tabak resmi yükle.",
            surfaces,
            usage_total,
        )

    if not surfaces:
        return (
            "Kahve falı için uygun bir fincan veya tabak görseli bulamadım canım. Lütfen fincan ve/veya tabak resmi yükle.",
            [],
            usage_total,
        )

    return None, surfaces, usage_total


def _validate_palm_image_dynamic(images: dict, memory_snippet: dict | None) -> tuple[str | None, dict, dict | None]:
    image_data = images.get("palm")
    usage_total = _empty_usage()
    if not image_data:
        return "El falı için fotoğraf gerekli.", usage_total, None

    try:
        result, usage = _classify_single_image_subject(image_data)
    except Exception:
        return PHOTO_RETRY_MESSAGE, usage_total, None
    _usage_add(usage_total, usage)

    is_pet = (memory_snippet or {}).get("relationshipPrimary") == "evcil_hayvan"
    loaded_label = _visual_label(result)

    if is_pet:
        profile_name = (memory_snippet or {}).get("profileName") or "Bu profil"
        expected_species = _normalize_pet_species((memory_snippet or {}).get("petSpecies"))
        expected_label = _species_tr(expected_species, (memory_snippet or {}).get("petSpecies"))
        detected_species = result.get("animalSpecies")
        if not _is_animal_paw_visual(result):
            return (
                f"{profile_name} için pati falı istemiştin fakat {loaded_label} yükledin. Lütfen {expected_label} patisi fotoğrafı yükle.",
                usage_total,
                result,
            )
        if expected_species and detected_species != expected_species:
            return (
                f"{profile_name} için pati falı istemiştin; profil {expected_label} olarak kayıtlı fakat {_species_tr(detected_species)} patisi yükledin. Lütfen {expected_label} patisi fotoğrafı yükle.",
                usage_total,
                result,
            )
        return None, usage_total, result

    if not _is_human_hand_visual(result):
        return (
            f"El falı istemiştin fakat {loaded_label} yükledin. Lütfen avuç içi fotoğrafı yükle.",
            usage_total,
            result,
        )
    return None, usage_total, result


def _sanitize_gendered_address(text: str, memory_snippet: dict | None) -> str:
    gender = (memory_snippet or {}).get("profileGender")
    if gender not in {"erkek", "kadin", "hicbiri", "belirtmek_istemiyorum"}:
        return text
    feminine_terms = {
        "güzel kızım": "güzel evladım",
        "guzel kizim": "guzel evladim",
        "kızım": "evladım",
        "kizim": "evladim",
        "güzel kız": "güzel evlat",
        "guzel kiz": "guzel evlat",
    }
    masculine_terms = {
        "güzel oğlum": "güzel evladım",
        "guzel oglum": "guzel evladim",
        "oğlum": "evladım",
        "oglum": "evladim",
        "güzel oğlan": "güzel evlat",
        "guzel oglan": "guzel evlat",
    }
    if gender == "erkek":
        replacements = feminine_terms
    elif gender == "kadin":
        replacements = masculine_terms
    else:
        replacements = {**feminine_terms, **masculine_terms}
    cleaned = text
    for source, target in replacements.items():
        cleaned = cleaned.replace(source, target)
        cleaned = cleaned.replace(source.capitalize(), target.capitalize())
    return cleaned


def _diversify_time_numbers(text: str, session_id: str) -> str:
    """
    Avoid repetitive '3 hafta / 3 ay' pattern by diversifying 1-9 with
    weighted preference toward 3 and 6.
    """
    if not text:
        return text
    rng = random.Random(f"{session_id}:{len(text)}")
    weighted_numbers = [3, 3, 3, 6, 6, 6, 4, 4, 5, 5, 2, 7, 1, 8, 9]
    pattern = re.compile(r"\b([1-9])\s+(gün|hafta|ay|vakit|gece|saat)\b", re.IGNORECASE)
    seen = {"3": 0, "6": 0}

    def repl(match: re.Match) -> str:
        num = match.group(1)
        unit = match.group(2)
        if num in {"3", "6"}:
            seen[num] += 1
        if num == "3" and seen["3"] > 1:
            pick = str(rng.choice([n for n in weighted_numbers if n != 3]))
            return f"{pick} {unit}"
        return match.group(0)

    return pattern.sub(repl, text)


def _strip_romantic_for_non_romantic_relations(text: str, memory_snippet: dict | None) -> str:
    relationship_primary = (memory_snippet or {}).get("relationshipPrimary")
    if relationship_primary not in {"arkadas", "akraba"}:
        return text
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    blocked = re.compile(r"\b(aşk|sevgili|flört|romantik|evlilik|ilişki)\b", re.IGNORECASE)
    kept = [sentence for sentence in sentences if sentence and not blocked.search(sentence)]
    if kept:
        return " ".join(kept)
    return "Bu profil için duygusal denge, aile ve sosyal çevre odaklı yorumla devam edelim."


def _estimate_text_tokens(text: str) -> int:
    return max(0, (len(text) + 2) // 3)

def _repair_mojibake_turkish(text: str) -> str:
    if not text:
        return text
    mojibake_markers = ("Ã", "Å", "Ä", "â")
    if not any(marker in text for marker in mojibake_markers):
        return text
    try:
        repaired = text.encode("latin-1", errors="ignore").decode("utf-8", errors="ignore")
    except Exception:
        return text
    if not repaired:
        return text
    turkish_chars = set("çğıİöşüÇĞÖŞÜ")
    original_turkish_count = sum(1 for ch in text if ch in turkish_chars)
    repaired_turkish_count = sum(1 for ch in repaired if ch in turkish_chars)
    original_marker_count = sum(text.count(marker) for marker in mojibake_markers)
    repaired_marker_count = sum(repaired.count(marker) for marker in mojibake_markers)
    if repaired_marker_count < original_marker_count and repaired_turkish_count >= original_turkish_count:
        return repaired
    if original_turkish_count == 0 and repaired_turkish_count > 0:
        return repaired
    return text


def _memory_merge_key(label: str) -> str:
    cleaned = (label or "").strip().lower()
    cleaned = (
        cleaned.replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ı", "i")
        .replace("ö", "o")
        .replace("ç", "c")
    )
    cleaned = "".join(ch if ch.isalnum() else "-" for ch in cleaned)
    return cleaned.strip("-") or "item"


def _analyze_memory_from_transcript(
    profile_name: str,
    reading_type: str,
    memory_snippet: dict | None,
    transcript: list[dict],
) -> tuple[dict, dict]:
    schema = {
        "type": "object",
        "properties": {
            "userStated": {
                "type": "object",
                "properties": {
                    "recurringTopics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "salience": {"type": "number"},
                            },
                            "required": ["key", "label", "salience"],
                        },
                    },
                    "importantPeople": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "relationship": {"type": "string"},
                                "salience": {"type": "number"},
                            },
                            "required": ["key", "label", "relationship", "salience"],
                        },
                    },
                    "emotionalPatterns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "confidence": {"type": "number"},
                            },
                            "required": ["key", "label", "confidence"],
                        },
                    },
                },
                "required": ["recurringTopics", "importantPeople", "emotionalPatterns"],
            },
            "readingDerived": {
                "type": "object",
                "properties": {
                    "recurringTopics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "salience": {"type": "number"},
                            },
                            "required": ["key", "label", "salience"],
                        },
                    },
                    "importantPeople": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "relationship": {"type": "string"},
                                "salience": {"type": "number"},
                            },
                            "required": ["key", "label", "relationship", "salience"],
                        },
                    },
                    "emotionalPatterns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string"},
                                "label": {"type": "string"},
                                "confidence": {"type": "number"},
                            },
                            "required": ["key", "label", "confidence"],
                        },
                    },
                },
                "required": ["recurringTopics", "importantPeople", "emotionalPatterns"],
            },
        },
        "required": ["userStated", "readingDerived"],
    }

    def _looks_like_question(text: str) -> bool:
        lowered = (text or "").strip().lower()
        if not lowered:
            return False
        if "?" in lowered:
            return True
        return bool(
            re.search(
                r"\b(ne|neden|nasil|nasıl|ne zaman|kim|hangi|mi|mı|mu|mü|olur mu|var mi|var mı)\b",
                lowered,
            )
        )

    user_lines = []
    assistant_lines = []
    seen_assistant = False
    for item in transcript:
        role = item.get("role")
        text = (item.get("text") or "").strip()
        if not text:
            continue
        if role == "user":
            if seen_assistant and _looks_like_question(text):
                user_lines.append(text)
        elif role == "assistant":
            seen_assistant = True
            assistant_lines.append(text)

    subject_context = [
        f"Secili profil: {profile_name or 'bu profil'}",
        f"Fal turu: {reading_type}",
    ]
    if memory_snippet and memory_snippet.get("relationshipLabel"):
        subject_context.append(f"Yakinlik: {memory_snippet.get('relationshipLabel')}")

    prompt = "\n".join(
        [
            "Transkripti hafıza çıkarması için analiz et.",
            "- userStated yalnızca kullanıcının kendi yazdığı/söylediği şeylerden üretilsin.",
            "- userStated alanina sadece fal sonrasi kullanici sorularindan (soru niteliği tasiyan girdilerden) yaz.",
            "- readingDerived yalnızca falcının yazdığı fal yorumları ve cevaplardan üretilsin.",
            "- İki kanalı birbirine karıştırma.",
            "- Uydurma ekleme; açık delil yoksa boş dizi döndür.",
            "- recurringTopics için genel ve tekrar etmeye değer etiketler çıkar.",
            "- importantPeople için isim verilmiş veya ilişki olarak açıkça geçen kişileri çıkar.",
            "- Falcıların adlarını importantPeople listesine asla ekleme.",
            "- emotionalPatterns için yalnızca net sinyal varsa çıkartım yap.",
            "- key alanlarını kısa ve slug gibi üret.",
            "- Tüm label ve relationship alanları yalnızca Türkçe olsun.",
            "- English kelime kullanma (örnek: mother, father, partner yerine annesi, babası, sevgilisi).",
            *subject_context,
            "## USER TRANSCRIPT",
            *user_lines[:40],
            "## ASSISTANT TRANSCRIPT",
            *assistant_lines[:40],
        ]
    )

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 700,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }
    counted = _gemini_count_tokens(payload)
    data = _gemini_api_request(payload, service_tier="flex")
    text = _extract_text_from_gemini_response(data)
    parsed = json.loads(text)
    usage = _extract_usage_metadata(data)
    counted_total = int(counted.get("totalTokens") or 0)
    if counted_total and not usage["inputTokens"]:
        usage["inputTokens"] = counted_total
        usage["totalTokens"] = counted_total + usage["outputTokens"]
    return parsed, usage


def _extract_text_from_gemini_response(data: dict) -> str:
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"No candidates in Gemini response: {json.dumps(data, ensure_ascii=False)}")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    if not text:
        raise RuntimeError(f"Empty text in Gemini response: {json.dumps(data, ensure_ascii=False)}")
    return text


def _general_sentence_range(period: str) -> tuple[int, int]:
    if period == "daily":
        return (1, 2)
    if period == "weekly":
        return (2, 3)
    return (3, 4)


def _count_sentences(text: str) -> int:
    chunks = [c.strip() for c in re.split(r"[.!?]+", text or "") if c.strip()]
    return len(chunks)


def _strip_code_fences(text: str) -> str:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _validate_astro_text_shape(period: str, text: str) -> bool:
    required = [
        "Ana tema:",
        "\u0130li\u015fkiler:",
        "Kariyer ve Finans:",
        "Enerji:",
        "G\u00f6ky\u00fcz\u00fc:",
        "\u00d6neri:",
    ]
    for item in required:
        if item not in text:
            return False
    if any(marker in text for marker in ("Ã", "Å", "Ä", "â")):
        return False
    if _has_generic_astro_boilerplate(text) or _has_repeated_sentences(text):
        return False

    # Ensure each section has at least 1 sentence (but don't enforce max)
    for line in text.split("\n"):
        line = line.strip()
        for key in required:
            if line.startswith(key):
                content = line[len(key):].strip()
                if _count_sentences(content) < 1:
                    return False
                if key == "\u0130li\u015fkiler:" and _count_sentences(content) < 2:
                    return False
                if key == "\u0130li\u015fkiler:" and _is_generic_relationship_section(content):
                    return False

    low = text.lower()
    if period == "weekly" and ("bugün" in low or "bugun" in low):
        return False
    if period == "monthly" and (("bugün" in low) or ("bugun" in low) or ("bu hafta" in low)):
        return False
    return True


def _normalize_period_language(period: str, text: str) -> str:
    out = text
    if period == "weekly":
        out = re.sub(r"\b[Bb]ugün\b", "Bu hafta", out)
        out = re.sub(r"\b[Bb]ugun\b", "Bu hafta", out)
    if period == "monthly":
        out = re.sub(r"\b[Bb]ugün\b", "Bu ay", out)
        out = re.sub(r"\b[Bb]ugun\b", "Bu ay", out)
        out = re.sub(r"\b[Bb]u hafta\b", "Bu ay", out)
    return out


def _ensure_sentence(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if t[-1] not in ".!?":
        t += "."
    return _capitalize_sentences(t)


def _sentence_count(text: str) -> int:
    return len([part for part in re.split(r"[.!?]+", text or "") if part.strip()])


GENERIC_ASTRO_MARKERS = [
    "tutulma hattı görünmeyen bir konuyu beklenmedik biçimde öne taşıyabilir",
    "duygusal tepkiden önce kısa bir değerlendirme yapmak daha doğru sonuç verebilir",
    "öncelikleri sadeleştirmek karar kalitesini artırabilir",
    "enerjiyi tek bir ana hedefte toplamak daha verimli olabilir",
    "iletişimde açık ve sakin bir ton korumak denge sağlar",
    "bu dönemde esnek kalmak beklenmedik fırsatları görünür kılabilir",
    "kısa ve net adımlar süreci hızlandırabilir",
    "ay terazi burcunun enerjisiyle duygusal dengeleri etkiliyor",
    "ay akrep burcunun enerjisiyle duygusal dengeleri etkiliyor",
]


def _has_generic_astro_boilerplate(text: str) -> bool:
    normalized = _norm_text(text)
    return any(marker in normalized for marker in GENERIC_ASTRO_MARKERS)


def _has_repeated_sentences(text: str) -> bool:
    sentences = [
        _norm_text(part)
        for part in re.split(r"[.!?]+", text or "")
        if len(_norm_text(part)) >= 24
    ]
    seen: set[str] = set()
    for sentence in sentences:
        if sentence in seen:
            return True
        seen.add(sentence)
    return False


def _is_generic_relationship_section(content: str) -> bool:
    normalized = _norm_text(content)
    relationship_markers = [
        *GENERIC_ASTRO_MARKERS,
        "ilişkilerde ihtiyaçları saklamak yerine sakin ve açık ifade etmek önem kazanıyor",
        "yakın bağlarda alınganlığı büyütmeden, niyetleri netleştirmek daha iyi sonuç verir",
    ]
    return any(marker in normalized for marker in relationship_markers)


def _relationship_fallback(period: str, moon: dict | None, venus: dict | None, mars: dict | None) -> str:
    moon_sign = _repair_mojibake_turkish(str((moon or {}).get("signLabel") or "Ay"))
    venus_sign = _repair_mojibake_turkish(str((venus or {}).get("signLabel") or "Venüs"))
    mars_sign = _repair_mojibake_turkish(str((mars or {}).get("signLabel") or "Mars"))
    if period == "daily":
        return (
            f"Ay {moon_sign} vurgusu bugün ilişkilerde saklanan duyguları daha görünür kılıyor; bir bakış, suskunluk ya da küçük bir söz büyüyebilir. "
            "Yakın bağlarda hemen tepki vermek yerine niyeti netleştirmek, günü daha yumuşak kapatmanı sağlar."
        )
    if period == "weekly":
        return (
            f"Bu hafta Ay {moon_sign} teması ilişkilerde güven, paylaşım ve kırılganlık konularını öne çıkarıyor. "
            f"Venüs {venus_sign} etkisi yakınlaşmayı desteklerken Mars {mars_sign} acele tepkiyi artırabilir; konuşmaları zamana yaymak bağları daha sağlam tutar."
        )
    return (
        f"Bu ay ilişkiler alanında Ay {moon_sign} duygusal ihtiyaçları görünür kılarken Venüs {venus_sign} daha kalıcı ve gerçekçi bağ kurma isteğini büyütüyor. "
        f"Mars {mars_sign} etkisi eski gerilimleri hızla alevlendirebilir; ay boyunca sınır, beklenti ve emek dengesini açık konuşmak en koruyucu yol olur."
    )


def _strengthen_relationship_section(content: str, period: str, fallback: str | None = None) -> str:
    if _is_generic_relationship_section(content) and fallback:
        return fallback
    text = _ensure_sentence(content)
    if _sentence_count(text) >= 2:
        return text
    if fallback:
        return f"{text} {fallback}".strip()
    extra = (
        "Yakın ilişkilerde tek bir cümleyle geçiştirmek yerine niyeti, beklentiyi ve sınırı ayrı ayrı görmek gerekir. "
        "Bugün bağ kurarken açık konuşmak, alınganlığı büyütmeden güveni onarmak ve karşı tarafın davranışını sözleriyle birlikte değerlendirmek daha sağlıklı olur."
        if period == "daily"
        else "Bu dönem ilişkilerde yalnızca uyum ya da gerilim değil, beklenti yönetimi ve güven meselesi de öne çıkıyor. "
        "Yakın bağlarda açık konuşmak, sınırı sakin koymak ve eski kırgınlıkları bugünün kararına doğrudan taşımamak daha iyi sonuç verir."
    )
    return f"{text} {extra}".strip()


def _build_general_astro_prompt(period: str, sign: str, astro_data: dict, recent_texts: list[str]) -> tuple[str, str]:
    sign_tr = {
        "ARIES": "Koç",
        "TAURUS": "Boğa",
        "GEMINI": "İkizler",
        "CANCER": "Yengeç",
        "LEO": "Aslan",
        "VIRGO": "Başak",
        "LIBRA": "Terazi",
        "SCORPIO": "Akrep",
        "SAGITTARIUS": "Yay",
        "CAPRICORN": "Oğlak",
        "AQUARIUS": "Kova",
        "PISCES": "Balık",
    }.get(sign, "Balık")
    p_label = {"daily": "Günlük", "weekly": "Haftalık", "monthly": "Aylık", "yearly": "Yıllık"}[period]
    min_s, max_s = _general_sentence_range(period)
    history_preview = "\n".join(f"- {h[:220]}" for h in recent_texts[-10:])

    system = (
        "You are a Turkish astrology writer. Use astronomy data only and do not invent technical claims. "
        "Keep sky mechanics brief. The user mainly wants what the period affects in life, how it may feel, "
        "and what to do or avoid. Write natural, varied Turkish text and avoid repetitive templates."
    )

    user = (
        f"Sign: {sign_tr} ({sign})\n"
        f"Period: {period}\n"
        f"Sentence rule per section: min {min_s}, max {max_s}.\n"
        "Output plain text with EXACT section labels and order:\n"
        "Gökyüzü:\nAna tema:\nİlişkiler:\nKariyer ve Finans:\nEnerji:\nÖneri:\n\n"
        f"Title line must be: {sign_tr} Burcu için {p_label} Astroloji Yorumu\n"
        "CRITICAL: Do NOT copy technical data from JSON verbatim. Interpret the movements as an astrologer. "
        "Gökyüzü must be the shortest section: only the key sky signal, and if any planet is retrograde mention it briefly.\n"
        "İlişkiler must be emotionally specific, at least two sentences, and stronger than a generic harmony/conflict sentence.\n"
        "Each section must contain a clear life effect plus at least one practical guidance sentence where natural.\n"
        "Öneri must be the most actionable section: say what to do and what to avoid.\n"
        "Every section must say something different; never reuse the same sentence or advice across sections.\n"
        "Do not use generic filler such as 'öncelikleri sadeleştir', 'kısa ve net adımlar', 'iletişimde açık ve sakin ton' unless tied to a concrete sky signal.\n"
        "Daily, weekly and monthly readings must feel different from each other in scope, wording and advice.\n"
        "Separate each section with a blank line for readability.\n"
        "Weekly must not contain 'bugün'. Monthly must not contain 'bugün' or 'bu hafta'.\n"
        "Use Turkish language only.\n\n"
        f"Astronomy data (JSON):\n{json.dumps(astro_data, ensure_ascii=False)}\n\n"
        "Recent outputs (avoid similarity):\n"
        f"{history_preview if history_preview else '- none'}"
    )
    return system, user


def _clean_generated_text(raw_text: str, sign: str, period: str) -> str:
    sign_tr = {
        "ARIES": "Koç",
        "TAURUS": "Boğa",
        "GEMINI": "İkizler",
        "CANCER": "Yengeç",
        "LEO": "Aslan",
        "VIRGO": "Başak",
        "LIBRA": "Terazi",
        "SCORPIO": "Akrep",
        "SAGITTARIUS": "Yay",
        "CAPRICORN": "Oğlak",
        "AQUARIUS": "Kova",
        "PISCES": "Balık",
    }.get(sign, "Balık")
    period_tr = {"daily": "Günlük", "weekly": "Haftalık", "monthly": "Aylık", "yearly": "Yıllık"}[period]
    title = f"{sign_tr} Burcu için {period_tr} Astroloji Yorumu"

    text = _strip_code_fences(raw_text or "")
    text = re.sub(
        r"(Ana tema|İlişkiler|Iliskiler|Kariyer ve Finans|Enerji|Gökyüzü|Gokyuzu|Öneri|Oneri)\s*:\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(re.escape(title), "", text, flags=re.IGNORECASE)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cleaned: list[str] = []
    for ln in lines:
        if ln:
            cleaned.append(ln)
    combined = " ".join(cleaned)
    # Fix missing spaces after punctuation (bitisik yazma sorunu)
    combined = re.sub(r"([.!?,])([^\s\d])", r"\1 \2", combined)
    # Fix specific common smashed words if any
    combined = re.sub(r"([a-zğüşıöç])([A-ZĞÜŞİÖÇ])", r"\1 \2", combined)
    return combined


def _coerce_generated_general_text(period: str, sign: str, raw_text: str, astro_payload: dict) -> str:
    sign_tr = {
        "ARIES": "Koç",
        "TAURUS": "Boğa",
        "GEMINI": "İkizler",
        "CANCER": "Yengeç",
        "LEO": "Aslan",
        "VIRGO": "Başak",
        "LIBRA": "Terazi",
        "SCORPIO": "Akrep",
        "SAGITTARIUS": "Yay",
        "CAPRICORN": "Oğlak",
        "AQUARIUS": "Kova",
        "PISCES": "Balık",
    }.get(sign, "Balık")
    p_label = {"daily": "Günlük", "weekly": "Haftalık", "monthly": "Aylık", "yearly": "Yıllık"}[period]
    title = f"{sign_tr} Burcu için {p_label} Astroloji Yorumu"

    labels = ["Gökyüzü", "Ana tema", "İlişkiler", "Kariyer ve Finans", "Enerji", "Öneri"]

    # --- Strategy 1: Parse Gemini's own section structure ---
    text = _strip_code_fences(raw_text or "")
    # Fix spacing issues
    text = re.sub(r"([.!?,])([^\s\d])", r"\1 \2", text)
    text = re.sub(r"([a-zğüşıöç])([A-ZĞÜŞİÖÇ])", r"\1 \2", text)
    # Remove title line if Gemini included it
    text = re.sub(re.escape(title), "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?i)" + re.escape(sign_tr) + r"\s+burcu\s+i[cç]in\s+\w+\s+astroloji\s+yorumu", "", text)

    # Try to split by section labels
    section_pattern = r"(Ana tema|İlişkiler|Iliskiler|Kariyer ve Finans|Enerji|Gökyüzü|Gokyuzu|Öneri|Oneri)\s*:\s*"
    parts = re.split(section_pattern, text, flags=re.IGNORECASE)

    # Normalize label names
    label_map = {
        "ana tema": "Ana tema",
        "ilişkiler": "İlişkiler", "iliskiler": "İlişkiler",
        "kariyer ve finans": "Kariyer ve Finans",
        "enerji": "Enerji",
        "gökyüzü": "Gökyüzü", "g" "okyuzu": "Gökyüzü",
        "öneri": "Öneri", "o" "neri": "Öneri",
    }

    parsed: dict[str, str] = {}
    if len(parts) >= 3:
        for i in range(1, len(parts) - 1, 2):
            raw_label = parts[i].strip().lower()
            normalized = label_map.get(raw_label)
            if normalized and i + 1 < len(parts):
                content = parts[i + 1].strip()
                content = re.sub(r"\s+", " ", content)
                content = re.sub(r"[`#*_>]", "", content)
                if content:
                    parsed[normalized] = content

    # If we successfully parsed at least 4 sections, use Gemini's output directly
    # Build astronomy-based fallback content for missing sections
    astro_fill: dict[str, str] = {}
    try:
        data = astro_payload.get("data") or {}
        positions = data.get("positions") or []
        events = data.get("events") or {}
        aspects = data.get("aspects") or []
        sun = next((p for p in positions if p.get("planet") == "Sun"), None)
        moon = next((p for p in positions if p.get("planet") == "Moon"), None)
        mercury = next((p for p in positions if p.get("planet") == "Mercury"), None)
        venus = next((p for p in positions if p.get("planet") == "Venus"), None)
        mars = next((p for p in positions if p.get("planet") == "Mars"), None)
        retro_planets = [p.get("planetLabel") or p.get("planet") for p in positions if p.get("retrograde")]

        if sun:
            sun_sign = _repair_mojibake_turkish(str(sun.get("signLabel") or ""))
            astro_fill["Ana tema"] = f"Güneş şu anda {sun_sign} burcunda {sun.get('degreeInSign', 0):.0f}° konumunda ilerliyor."
        if moon:
            astro_fill["İlişkiler"] = _relationship_fallback(period, moon, venus, mars)
        if venus:
            venus_sign = _repair_mojibake_turkish(str(venus.get("signLabel") or ""))
            astro_fill["Kariyer ve Finans"] = f"Venüs {venus_sign} burcunda maddi ve estetik konulara yön veriyor."
        if mars:
            mars_sign = _repair_mojibake_turkish(str(mars.get("signLabel") or ""))
            astro_fill["Enerji"] = f"Mars {mars_sign} burcunda motivasyon ve eylem enerjisini şekillendiriyor."
        if aspects:
            a = aspects[0]
            planet1 = _repair_mojibake_turkish(str(a.get("planet1Label") or ""))
            planet2 = _repair_mojibake_turkish(str(a.get("planet2Label") or ""))
            aspect = _repair_mojibake_turkish(str(a.get("aspect") or ""))
            astro_fill["Gökyüzü"] = f"{planet1} ile {planet2} arasında {aspect} açısı dikkat çekiyor."
        if retro_planets:
            retro_note = f" Retro hareket dikkat çekiyor: {', '.join(_repair_mojibake_turkish(str(p)) for p in retro_planets[:3])}."
            astro_fill["Gökyüzü"] = (astro_fill.get("Gökyüzü") or "Gökyüzünde tempo yavaşlatan bir vurgu var.") + retro_note
        if mercury:
            motion = "retrograd" if mercury.get("retrograde") else "doğrudan"
            if mercury.get("retrograde"):
                astro_fill["Öneri"] = (
                    "Merkür retrograd olduğu için mesaj, randevu ve kararları iki kez kontrol et; acele cevap vermekten kaçın. "
                    "Eski konuları kapatmak yeni başlangıçtan daha verimli olabilir."
                )
            else:
                astro_fill["Öneri"] = (
                    f"Merkür {motion} hareket halinde; konuşmaları sadeleştir, net soru sor ve gereksiz varsayımlardan kaçın."
                )
    except Exception:
        pass

    # If Gemini parsed successfully, use its sections and fill gaps from astronomy
    if len(parsed) >= 4:
        section_lines: list[str] = []
        relationship_fallback = astro_fill.get("İlişkiler", "")
        for label in labels:
            content = parsed.get(label) or astro_fill.get(label, "")
            if content:
                if label == "İlişkiler":
                    content = _strengthen_relationship_section(content, period, relationship_fallback)
                section_lines.append(f"{label}: {content}")
        generated = "\n\n".join([title, *section_lines])
        generated = _normalize_period_language(period, generated)
        generated = _repair_mojibake_turkish(generated)
        return generated

    # Gemini failed entirely — build from astronomy data only
    if astro_fill:
        section_lines = []
        relationship_fallback = astro_fill.get("İlişkiler", "")
        for label in labels:
            content = astro_fill.get(label, "")
            if content:
                if label == "İlişkiler":
                    content = _strengthen_relationship_section(content, period, relationship_fallback)
                section_lines.append(f"{label}: {content}")
        generated = "\n\n".join([title, *section_lines])
    else:
        generated = f"{title}\nAstrolojik veri şu an için yeterli değil."

    generated = _normalize_period_language(period, generated)
    generated = _repair_mojibake_turkish(generated)
    return generated




def _gemini_generate_general_astro(period: str, sign: str, astro_payload: dict, recent_texts: list[str]) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY missing.")

    last_error: Exception | None = None
    for attempt in range(4):
        system, user = _build_general_astro_prompt(period, sign, astro_payload, recent_texts)
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": min(0.95, 0.68 + attempt * 0.08),
                "maxOutputTokens": {"daily": 500, "weekly": 800, "monthly": 1300, "yearly": 1600}[period],
            },
        }

        tiers = ["standard"]
        for tier in tiers:
            try:
                data = _gemini_api_request(payload, timeout_seconds=35)
                raw = _strip_code_fences(_extract_text_from_gemini_response(data))
                text = _coerce_generated_general_text(period, sign, raw, astro_payload)
                if not _validate_astro_text_shape(period, text):
                    app.logger.warning(f"Astro shape validation failed for {period} {sign}. Text length: {len(text)}")
                    raise RuntimeError("Shape validation failed.")
                too_similar = any(_similarity(text, old) >= GENERAL_ASTRO_SIMILARITY_LIMIT for old in recent_texts[-20:])
                if too_similar:
                    app.logger.warning(f"Astro similarity filter rejected candidate for {period} {sign}.")
                    raise RuntimeError("Similarity filter rejected candidate.")
                return text
            except Exception as tier_err:
                last_error = tier_err
                continue

    # Gemini tamamen başarısızsa yine Astronomy verisinden minimum güvenli metin üret.
    return _coerce_generated_general_text(period, sign, "", astro_payload)



def _classify_single_coffee_image(image_data: str) -> tuple[dict, dict]:
    schema = {
        "type": "object",
        "properties": {
            "containsCup": {"type": "boolean"},
            "containsSaucer": {"type": "boolean"},
            "isCoffeeRelevant": {"type": "boolean"},
            "suggestedReadingType": {"type": "string", "enum": ["coffee", "palm", "none"]},
            "reason": {
                "type": "string",
                "description": "Very short reason for the classification.",
            },
        },
        "required": ["containsCup", "containsSaucer", "isCoffeeRelevant", "suggestedReadingType", "reason"],
    }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Bu görseli kahve falı yüzeyi olarak sınıflandır. "
                            "Şu alanları doldur: containsCup, containsSaucer, isCoffeeRelevant, reason. "
                            "containsCup = fincan içi net görünüyorsa true. "
                            "containsSaucer = kahve tabağı veya tabak yüzeyi net görünüyorsa true. "
                            "Aynı görselde ikisi birden varsa ikisini de true yap. "
                            "isCoffeeRelevant = görsel kahve falıyla alakalıysa true, çiçek, kedi, selfie, manzara gibi alakasızsa false. "
                            "suggestedReadingType = eğer görsel daha çok avuç içi gibi görünüyorsa palm, kahveye uygunsa coffee, hiçbiri değilse none."
                        )
                    },
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_data}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 80,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }

    data = _gemini_api_request(payload)
    text = _extract_text_from_gemini_response(data)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Image classifier returned invalid JSON: {text}") from e
    return parsed, _extract_usage_metadata(data)


def _validate_and_classify_coffee_images(images: dict) -> tuple[str | None, list[str], dict]:
    surfaces: list[str] = []
    invalid_slots: list[str] = []
    suggested_palm = False
    usage_total = {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0}

    for slot in ("cup", "saucer"):
        image_data = images.get(slot)
        if not image_data:
            continue
        try:
            result, usage = _classify_single_coffee_image(image_data)
        except Exception:
            return PHOTO_RETRY_MESSAGE, surfaces, usage_total
        usage_total["inputTokens"] += usage.get("inputTokens", 0)
        usage_total["outputTokens"] += usage.get("outputTokens", 0)
        usage_total["totalTokens"] += usage.get("totalTokens", 0)
        if not result.get("isCoffeeRelevant"):
            invalid_slots.append(slot)
            if result.get("suggestedReadingType") == "palm":
                suggested_palm = True
            continue
        if result.get("containsCup") and "cup" not in surfaces:
            surfaces.append("cup")
        if result.get("containsSaucer") and "saucer" not in surfaces:
            surfaces.append("saucer")

    if invalid_slots:
        return (
            (
            "Bu kare kahve telvesinden çok avuç içi gibi görünüyor. "
                "İstersen El Falı'na geçip aynı fotoğrafla devam edebilirsin."
                if suggested_palm
                else "Bu kare kahve falı için uygun görünmüyor canım. Telveyi net gösteren fincan içi ya da tabak fotoğrafı yüklersen birlikte devam ederiz."
            ),
            surfaces,
            usage_total,
        )

    if not surfaces:
        return (
            "Kahve falı için uygun bir fincan içi veya tabak görseli bulamadım canım. Telveyi daha net gösteren bir kareyle yeniden deneyelim.",
            [],
            usage_total,
        )

    return None, surfaces, usage_total


def _classify_single_palm_image(image_data: str) -> tuple[dict, dict]:
    schema = {
        "type": "object",
        "properties": {
            "isPalmRelevant": {"type": "boolean"},
            "isInnerPalm": {"type": "boolean"},
            "handVisibleEnough": {"type": "boolean"},
            "suggestedReadingType": {"type": "string", "enum": ["coffee", "palm", "none"]},
            "reason": {"type": "string"},
        },
        "required": ["isPalmRelevant", "isInnerPalm", "handVisibleEnough", "suggestedReadingType", "reason"],
    }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Bu görselin el falı için uygun olup olmadığını değerlendir. "
                            "isPalmRelevant = görsel insan eline aitse true. "
                            "isInnerPalm = avuç içi yani elin iç yüzü görünüyorsa true. "
                            "handVisibleEnough = avuç içi ve çizgileri yorumlamaya yetecek kadar net ve yeterince görünüyorsa true. "
                            "suggestedReadingType = eğer görsel fincan/tabak telvesine daha çok benziyorsa coffee, ele uygunsa palm, hiçbiri değilse none. "
                            "Kedi, fincan, tabak, dış el sırtı veya alakasız nesnelerde uygun alanları false dön."
                        )
                    },
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_data}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 80,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }

    data = _gemini_api_request(payload)
    text = _extract_text_from_gemini_response(data)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Palm classifier returned invalid JSON: {text}") from e
    return parsed, _extract_usage_metadata(data)


def _validate_palm_image(images: dict) -> tuple[str | None, dict, dict]:
    image_data = images.get("palm")
    if not image_data:
        return "El falı için avuç içi fotoğrafı gerekli.", _empty_usage(), {}

    try:
        result, usage = _classify_single_palm_image(image_data)
    except Exception:
        return PHOTO_RETRY_MESSAGE, _empty_usage(), {}
    if not result.get("isPalmRelevant"):
        if result.get("suggestedReadingType") == "coffee":
            return (
                "Bu kare avuç içinden çok kahve telvesine benziyor. İstersen Kahve Falı'na geçip aynı fotoğrafla devam edebilirsin.",
                usage,
                result,
            )
        return "Bu kare el falı için uygun görünmüyor canım. Avuç içini gösteren bir el fotoğrafı yükle.", usage, result
    return None, usage, result


def _gemini_generate(
    session_id: str,
    dev_settings: dict,
    profile_name: str,
    reading_type: str,
    coffee_mode: str,
    memory_snippet: dict | None,
    messages: list[dict],
    images: dict,
    validated_surfaces: list[str] | None = None,
    palm_validation: dict | None = None,
) -> tuple[str, dict]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY (or GEMINI_API_KEY) is missing in environment.")

    temperature = float(dev_settings.get("temperature", 0.8))
    built_prompt = build_prompt(dev_settings, messages, images, session_id or "default-session")
    memory_context = build_memory_context(profile_name, memory_snippet, reading_type, coffee_mode)
    system_instruction = built_prompt.system_instruction
    if memory_context:
        system_instruction = f"{system_instruction}\n\n{memory_context}"
    if validated_surfaces is not None:
        system_instruction += (
            "\n\n## Görsel Yorum Disiplini\n"
            "- Sadece görselde seçilebilir telve/çizgi/lekelerden yorum üret.\n"
            "- Emin olmadığın şekli kesinmiş gibi söyleme; belirsizse belirsiz olduğunu belirt.\n"
            "- Fincan/tabak üzerindeki üretim desenleri (çiçek, süs, baskı, marka, kabartma) yorum unsuru değildir; bunları fal sembolü sayma."
        )
        if reading_type == "palm":
            is_pet = (memory_snippet or {}).get("relationshipPrimary") == "evcil_hayvan"
            pet_species = _species_tr(_normalize_pet_species((memory_snippet or {}).get("petSpecies")), (memory_snippet or {}).get("petSpecies"))
            system_instruction += (
                "\n\n## Surface Guard\n"
                + (
                    f"- Bu turda seçili profil evcil hayvan; {pet_species} patisi görseli doğrulandı.\n"
                    "- İnsan eli, fincan veya tabak görmüş gibi konuşma.\n"
                    "- Yorumu pati şekli, parmak/ped yerleşimi, duruş ve enerji üzerinden kur."
                    if is_pet
                    else "- Bu turda kullanıcı el falı için insan eli/avuç içi görseli doğrulandı.\n"
                    "- Fincan veya tabak görmüş gibi konuşma.\n"
                    "- Yorumu avuç içi çizgileri, parmak yerleşimi ve el formu üzerinden kur."
                )
            )
            if (memory_snippet or {}).get("profileGender") == "erkek":
                system_instruction += "\n- Profil erkek olarak kayitli; kullaniciya veya profile asla 'kizim' ya da 'guzel kizim' diye hitap etme."
            elif (memory_snippet or {}).get("profileGender") == "kadin":
                system_instruction += "\n- Profil kadin olarak kayitli; kullaniciya veya profile asla 'oglum' ya da 'guzel oglum' diye hitap etme."
            elif (memory_snippet or {}).get("profileGender") in {"hicbiri", "belirtmek_istemiyorum"}:
                system_instruction += "\n- Profil cinsiyetsiz veya cinsiyet belirtmek istemiyor; kullaniciya veya profile asla 'kizim', 'oglum', 'guzel kizim' ya da 'guzel oglum' gibi cinsiyetli hitaplar kullanma."
            if palm_validation and (
                not palm_validation.get("isInnerPalm") or not palm_validation.get("handVisibleEnough")
            ):
                system_instruction += (
                    "\n- Dogrulama gorselin kismi veya yeterince net olmayabilecegini soyluyor; bunu kesin hata sayma, yorumu temkinli ve kibar kur."
                )
        elif validated_surfaces == ["cup"]:
            system_instruction += (
                "\n\n## Surface Guard\n"
                "- Bu turda yalnizca fincan ici dogrulandi.\n"
                "- Tabak gormus gibi konusma.\n"
                "- Yorumu fincan ici derinligi, kenar akisi ve ic yuzey uzerinden kur."
            )
        elif validated_surfaces == ["saucer"]:
            system_instruction += (
                "\n\n## Surface Guard\n"
                "- Bu turda yalnizca kahve tabagi dogrulandi.\n"
                "- Fincan gormus gibi konusma.\n"
                "- Yorumu tabak yuzeyi, yayilma, golenme ve dis dunya yansimasi uzerinden kur."
            )
        elif validated_surfaces:
            system_instruction += (
                "\n\n## Surface Guard\n"
                "- Bu turda fincan ici ve tabak birlikte dogrulandi.\n"
                "- Hangi yuzeyi yorumladigini acikca ayir."
            )

    contents = []
    for msg in messages:
        role = "model" if msg.get("role") == "assistant" else "user"
        text = (msg.get("text") or "").strip()
        if not text:
            continue
        contents.append({"role": role, "parts": [{"text": text}]})

    if reading_type == "palm" and images.get("palm"):
        is_pet = (memory_snippet or {}).get("relationshipPrimary") == "evcil_hayvan"
        prompt_text = (
            "Bu evcil hayvan pati gorselini inceleyip pati falina devam et. Insan eli gibi yorumlama."
            if is_pet
            else "Bu insan eli/avuc ici gorselini inceleyip el falina devam et."
        )
        contents.insert(
            0,
            {
                "role": "user",
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {"mime_type": "image/jpeg", "data": images["palm"]}},
                ],
            },
        )
    elif images and (images.get("cup") or images.get("saucer")):
        if validated_surfaces == ["cup"]:
            prompt_text = "Yalnizca fincan ici gorselini inceleyip fala devam et."
        elif validated_surfaces == ["saucer"]:
            prompt_text = "Yalnizca kahve tabagi gorselini inceleyip fala devam et."
        else:
            prompt_text = "Doğrulanmış fincan ve/veya tabak görsellerini inceleyip fala devam et."
        parts = [{"text": prompt_text}]
        if images.get("cup"):
            parts.append({"text": "Birinci görsel yüklendi. Görselde fincan, tabak veya ikisi birden olabilir."})
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": images["cup"]}})
        if images.get("saucer"):
            parts.append({"text": "İkinci görsel yüklendi. Görselde fincan, tabak veya ikisi birden olabilir."})
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": images["saucer"]}})
        contents.insert(0, {"role": "user", "parts": parts})

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 820 if len(messages) <= 1 else 430,
        },
    }

    counted = _gemini_count_tokens(payload)
    data = _gemini_api_request(payload)
    text = _extract_text_from_gemini_response(data)
    usage = _extract_usage_metadata(data)
    counted_total = int(counted.get("totalTokens") or 0)
    if counted_total and not usage["inputTokens"]:
        usage["inputTokens"] = counted_total
        usage["totalTokens"] = counted_total + usage["outputTokens"]
    with_closing = append_persona_closing(text, built_prompt.closing_sentence)
    sanitized = _sanitize_gendered_address(with_closing, memory_snippet)
    non_romantic = _strip_romantic_for_non_romantic_relations(sanitized, memory_snippet)
    diversified = _diversify_time_numbers(non_romantic, session_id)
    repaired = _repair_mojibake_turkish(diversified)
    return repaired, usage



@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "fortune-api"})


GENERAL_SIGNS = [
    "ARIES",
    "TAURUS",
    "GEMINI",
    "CANCER",
    "LEO",
    "VIRGO",
    "LIBRA",
    "SCORPIO",
    "SAGITTARIUS",
    "CAPRICORN",
    "AQUARIUS",
    "PISCES",
]


def _generate_general_astro_entry(period: str, sign: str, target_date: str, force: bool = False) -> dict:
    p_key = _period_key(period, target_date)
    store = _load_general_astro_store()
    entries = store.get("entries") or {}
    by_period = entries.get(period) or {}
    by_key = by_period.get(p_key) or {}
    existing = by_key.get(sign)
    if (
        (not force)
        and isinstance(existing, dict)
        and existing.get("text")
        and _validate_astro_text_shape(period, existing.get("text", ""))
    ):
        return {
            "ok": True,
            "source": "gemini-astro",
            "period": period,
            "sign": sign,
            "periodKey": p_key,
            "targetDate": target_date,
            "text": existing.get("text"),
            "cached": True,
        }

    astro_payload = build_general_payload(period=period, target_date=target_date, sign=sign)
    history_key = f"{sign}|{period}"
    history = (store.get("historyBySignPeriod") or {}).get(history_key) or []
    text = _gemini_generate_general_astro(period, sign, astro_payload, history)

    digest = hashlib.sha256(_norm_text(text).encode("utf-8")).hexdigest()[:16]
    entry = {
        "text": text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "digest": digest,
    }
    entries.setdefault(period, {}).setdefault(p_key, {})[sign] = entry
    history_list = (store.setdefault("historyBySignPeriod", {}).get(history_key) or []) + [text]
    store["historyBySignPeriod"][history_key] = history_list[-GENERAL_ASTRO_HISTORY_LIMIT:]
    store["entries"] = entries
    _save_general_astro_store(store)

    return {
        "ok": True,
        "source": "gemini-astro",
        "period": period,
        "sign": sign,
        "periodKey": p_key,
        "targetDate": target_date,
        "text": text,
        "cached": False,
    }


@app.post("/general-astro/generate")
def generate_general_astro():
    body = request.get_json(silent=True) or {}
    period = _normalize_period(body.get("period"))
    sign = _normalize_sign(body.get("sign"))
    target_date = _normalize_target_date(body.get("targetDate"))
    try:
        payload = _generate_general_astro_entry(period, sign, target_date, force=False)
        return jsonify(payload)
    except Exception as exc:
        app.logger.exception("general astro llm failed")
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/general-astro/prewarm")
def prewarm_general_astro():
    body = request.get_json(silent=True) or {}
    periods_raw = body.get("periods")
    signs_raw = body.get("signs")
    target_date = _normalize_target_date(body.get("targetDate"))
    force = bool(body.get("force") or False)

    periods = ["weekly", "monthly"]
    if isinstance(periods_raw, list) and periods_raw:
        periods = [p for p in [_normalize_period(str(x)) for x in periods_raw] if p in {"weekly", "monthly"}]
        if not periods:
            periods = ["weekly", "monthly"]

    signs = GENERAL_SIGNS
    if isinstance(signs_raw, list) and signs_raw:
        normalized = [_normalize_sign(str(x)) for x in signs_raw]
        signs = [s for s in normalized if s in GENERAL_SIGNS] or GENERAL_SIGNS

    result_items = []
    ok_count = 0
    fail_count = 0

    for period in periods:
        for sign in signs:
            try:
                payload = _generate_general_astro_entry(period, sign, target_date, force=force)
                ok_count += 1
                result_items.append(
                    {
                        "period": period,
                        "sign": sign,
                        "cached": bool(payload.get("cached")),
                    }
                )
            except Exception as exc:
                fail_count += 1
                result_items.append(
                    {
                        "period": period,
                        "sign": sign,
                        "error": str(exc),
                    }
                )

    return jsonify(
        {
            "ok": fail_count == 0,
            "targetDate": target_date,
            "periods": periods,
            "count": len(result_items),
            "okCount": ok_count,
            "failCount": fail_count,
            "items": result_items,
        }
    )


def _personal_astro_token_limit(period: str) -> int:
    return {"daily": 750, "weekly": 1050, "monthly": 1550, "yearly": 1800}.get(period, 750)


def _assistant_style_hint(assistant_id: str, assistant_label: str) -> str:
    styles = {
        "bahar-hanim": "Bahar Hanım tonu: modern, rafine, farkındalık dili yüksek, sıcak ama net bir astrolog.",
        "mert-bey": "Mert Bey tonu: analitik, sade, dost gibi yakın ve toparlayıcı.",
        "durdane-hanim": "Dürdane Hanım tonu: anaç, sıcak, sezgisel ve koruyucu.",
        "hikmet-bey": "Hikmet Bey tonu: babacan, felsefi, sakin ve psikolojik derinliği olan.",
        "caner": "Caner tonu: sezgisel, yumuşak, sanatsal ve hafif melankolik.",
    }
    return styles.get(assistant_id or "", f"{assistant_label or 'Falcı'} tonu: sıcak, doğal ve persona içinde kalan.")


def _personal_numerology_token_limit(mode: str, period: str) -> int:
    if mode == "core":
        return 750
    return 900


@app.post("/personal-numerology/generate")
def generate_personal_numerology():
    body = request.get_json(silent=True) or {}
    mode = str(body.get("mode") or "period").strip().lower()
    if mode not in {"core", "period"}:
        mode = "period"
    gemini_payload = body.get("geminiPayload")
    if not isinstance(gemini_payload, dict):
        return jsonify({"ok": False, "error": "geminiPayload zorunlu."}), 400
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503

    generation_config = gemini_payload.get("generationConfig")
    if not isinstance(generation_config, dict):
        generation_config = {}
        gemini_payload["generationConfig"] = generation_config
    try:
        requested_max_tokens = int(generation_config.get("maxOutputTokens") or _personal_numerology_token_limit(mode, "monthly"))
    except Exception:
        requested_max_tokens = _personal_numerology_token_limit(mode, "monthly")
    generation_config["maxOutputTokens"] = min(
        requested_max_tokens,
        _personal_numerology_token_limit(mode, "monthly"),
    )
    try:
        generation_config["temperature"] = float(generation_config.get("temperature") or 0.72)
    except Exception:
        generation_config["temperature"] = 0.72

    try:
        data = _gemini_api_request(gemini_payload, timeout_seconds=40)
        text = _strip_code_fences(_extract_text_from_gemini_response(data))
        return jsonify(
            {
                "ok": True,
                "source": "gemini-proxy-personal-numerology",
                "text": text,
            }
        )
    except Exception as exc:
        app.logger.exception("personal numerology gemini proxy failed")
        return jsonify({"ok": False, "error": str(exc)}), 502


@app.post("/personal-astro/generate")
def generate_personal_astro():
    body = request.get_json(silent=True) or {}
    period = _normalize_period(body.get("period"))
    gemini_payload = body.get("geminiPayload")
    if not isinstance(gemini_payload, dict):
        return jsonify({"ok": False, "error": "geminiPayload zorunlu."}), 400
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503
    generation_config = gemini_payload.get("generationConfig")
    if not isinstance(generation_config, dict):
        generation_config = {}
        gemini_payload["generationConfig"] = generation_config
    try:
        requested_max_tokens = int(generation_config.get("maxOutputTokens") or _personal_astro_token_limit(period))
    except Exception:
        requested_max_tokens = _personal_astro_token_limit(period)
    generation_config["maxOutputTokens"] = min(requested_max_tokens, _personal_astro_token_limit(period))
    try:
        generation_config["temperature"] = float(generation_config.get("temperature") or 0.72)
    except Exception:
        generation_config["temperature"] = 0.72
    try:
        data = _gemini_api_request(gemini_payload, timeout_seconds=40)
        text = _strip_code_fences(_extract_text_from_gemini_response(data))
        return jsonify(
            {
                "ok": True,
                "source": "gemini-proxy-personal-astro",
                "text": text,
            }
        )
    except Exception as exc:
        app.logger.exception("personal astro gemini proxy failed")
        return jsonify({"ok": False, "error": str(exc)}), 502


@app.post("/astronomy/general")
def astronomy_general():
    body = request.get_json(silent=True) or {}
    period = _normalize_period(body.get("period"))
    sign = _normalize_sign(body.get("sign"))
    target_date = _normalize_target_date(body.get("targetDate"))
    cache_key = f"general|{period}|{sign}|{target_date}"
    cached = _astro_cache_get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        payload = build_general_payload(period=period, target_date=target_date, sign=sign)
        _astro_cache_set(cache_key, payload)
        return jsonify(payload)
    except Exception as exc:
        app.logger.exception("astronomy general failed")
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/astronomy/personal")
def astronomy_personal():
    body = request.get_json(silent=True) or {}
    birth_date = str(body.get("birthDate") or "").strip()
    if not birth_date:
        return jsonify({"ok": False, "error": "birthDate zorunlu."}), 400

    birth_time = str(body.get("birthTime") or "").strip() or None
    time_known = bool(body.get("timeKnown", True) and birth_time)
    timezone_name = str(body.get("timezone") or "UTC").strip() or "UTC"
    target_date = _normalize_target_date(body.get("targetDate"))
    location_precision = str(body.get("locationPrecision") or "city").strip()

    try:
        latitude = float(body.get("latitude"))
        longitude = float(body.get("longitude"))
    except Exception:
        return jsonify({"ok": False, "error": "latitude/longitude zorunlu."}), 400

    cache_key = f"personal|{birth_date}|{birth_time or '12:00'}|{time_known}|{timezone_name}|{latitude:.6f}|{longitude:.6f}|{location_precision}|{target_date}"
    cached = _astro_cache_get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        payload = build_personal_payload(
            birth_date=birth_date,
            birth_time=birth_time,
            timezone_name=timezone_name,
            latitude=latitude,
            longitude=longitude,
            target_date=target_date,
            time_known=time_known,
            location_precision=location_precision,
        )
        _astro_cache_set(cache_key, payload)
        return jsonify(payload)
    except Exception as exc:
        app.logger.exception("astronomy personal failed")
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/fortune")
def fortune():
    body = request.get_json(silent=True) or {}
    session_id = str(body.get("sessionId") or "")
    dev_settings = body.get("devSettings") or {}
    profile_name = str(body.get("profileName") or "")
    reading_type = str(body.get("readingType") or "coffee")
    coffee_mode = str(body.get("coffeeMode") or "upload")
    memory_snippet = body.get("memorySnippet") or None
    messages = body.get("messages") or []
    images = body.get("images") or {}

    if not isinstance(messages, list):
        return jsonify(_friendly_error("Mesaj akışı okunamadı canım. Uygulamayı bir geri alıp yeniden deneyelim.")), 400

    try:
        validated_surfaces: list[str] | None = None
        validation_usage = {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0}
        palm_validation = None
        if reading_type == "coffee" and coffee_mode == "upload":
            validation_error, validated_surfaces, validation_usage = _validate_coffee_images_dynamic(images)
            if validation_error:
                return jsonify({"userMessage": validation_error, "usage": validation_usage}), 422
        elif reading_type == "palm":
            validated_surfaces = ["palm"]
            validation_error, validation_usage, palm_validation = _validate_palm_image_dynamic(images, memory_snippet)
            if validation_error:
                return jsonify({"userMessage": validation_error, "usage": validation_usage}), 422

        text, usage = _gemini_generate(
            session_id,
            dev_settings,
            profile_name,
            reading_type,
            coffee_mode,
            memory_snippet,
            messages,
            images,
            validated_surfaces,
            palm_validation if reading_type == "palm" else None,
        )
        if reading_type == "coffee" and coffee_mode == "upload":
            usage["inputTokens"] += validation_usage.get("inputTokens", 0)
            usage["outputTokens"] += validation_usage.get("outputTokens", 0)
            usage["totalTokens"] += validation_usage.get("totalTokens", 0)
        elif reading_type == "palm":
            usage["inputTokens"] += validation_usage.get("inputTokens", 0)
            usage["outputTokens"] += validation_usage.get("outputTokens", 0)
            usage["totalTokens"] += validation_usage.get("totalTokens", 0)
        return jsonify({"text": text, "usage": usage})
    except Exception as e:
        app.logger.exception("fortune request failed")
        return jsonify(_friendly_error()), 500


@app.post("/memory-analyze")
def memory_analyze():
    body = request.get_json(silent=True) or {}
    profile_name = str(body.get("profileName") or "")
    profile_id = str(body.get("profileId") or "")
    reading_type = str(body.get("readingType") or "coffee")
    memory_snippet = body.get("memorySnippet") or None
    transcript = body.get("transcript") or []

    if not profile_id:
        return jsonify({"userMessage": "Profil bilgisi eksik."}), 400
    if not isinstance(transcript, list) or not transcript:
        return jsonify({"userMessage": "Analiz için transkript gerekli."}), 400

    try:
        result, usage = _analyze_memory_from_transcript(profile_name, reading_type, memory_snippet, transcript)
        return jsonify({**result, "usage": usage})
    except Exception:
        app.logger.exception("memory analyze failed")
        return jsonify({"userMessage": "Hafiza analizi su an tamamlanamadi.", "usage": _empty_usage()}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
