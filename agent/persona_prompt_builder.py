import hashlib
import re
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
IDENTITY_ROOT = REPO_ROOT / "mobile" / "src" / "identity" / "assistants"


@dataclass
class PersonaIdentity:
    assistant_id: str
    display_name: str
    primary_domain_label: str
    system_body: str
    closing_library: dict[str, list[str]]


@dataclass
class BuiltPrompt:
    assistant_id: str
    display_name: str
    system_instruction: str
    closing_tone: str
    closing_sentence: str


def _extract_frontmatter(markdown: str) -> str:
    if not markdown.startswith("---\n"):
        return ""
    _, _, rest = markdown.partition("---\n")
    frontmatter, sep, _ = rest.partition("\n---\n")
    return frontmatter if sep else ""


def _extract_body(markdown: str) -> str:
    if not markdown.startswith("---\n"):
        return markdown.strip()
    _, _, rest = markdown.partition("---\n")
    _, sep, body = rest.partition("\n---\n")
    return body.strip() if sep else markdown.strip()


def _extract_scalar(frontmatter: str, key: str, fallback: str = "") -> str:
    match = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", frontmatter, flags=re.MULTILINE)
    return match.group(1).strip() if match else fallback


def _extract_primary_domain_label(frontmatter: str) -> str:
    match = re.search(r"^primary_domain:\s*$([\s\S]*?)(?:^\S|\Z)", frontmatter, flags=re.MULTILINE)
    if not match:
        return "Kahve Fali"
    block = match.group(1)
    label_match = re.search(r"^\s+label:\s*(.+?)\s*$", block, flags=re.MULTILINE)
    return label_match.group(1).strip() if label_match else "Kahve Fali"


def _extract_section(body: str, heading: str) -> str:
    pattern = rf"^# {re.escape(heading)}\s*$([\s\S]*?)(?=^# |\Z)"
    match = re.search(pattern, body, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def _extract_closing_library(section: str) -> dict[str, list[str]]:
    library: dict[str, list[str]] = {}
    for tone_match in re.finditer(r"^## (.+?)\s*$([\s\S]*?)(?=^## |\Z)", section, flags=re.MULTILINE):
        tone = tone_match.group(1).strip().lower()
        lines = [
            re.sub(r"^\d+\.\s*", "", line).strip()
            for line in tone_match.group(2).splitlines()
            if re.match(r"^\d+\.\s+", line.strip())
        ]
        if lines:
            library[tone] = lines
    return library


def _strip_section(body: str, heading: str) -> str:
    return re.sub(
        rf"^# {re.escape(heading)}\s*$[\s\S]*?(?=^# |\Z)",
        "",
        body,
        flags=re.MULTILINE,
    ).strip()


def load_persona_identity(assistant_id: str) -> PersonaIdentity:
    identity_path = IDENTITY_ROOT / "fortune-family" / assistant_id / "identity.md"
    if not identity_path.exists():
        raise FileNotFoundError(f"Persona identity not found for assistant '{assistant_id}': {identity_path}")

    markdown = identity_path.read_text(encoding="utf-8")
    frontmatter = _extract_frontmatter(markdown)
    body = _extract_body(markdown)
    closing_section = _extract_section(body, "Persona Closing Library")
    body_without_closings = _strip_section(body, "Persona Closing Library")
    body_without_notes = _strip_section(body_without_closings, "Implementation Notes")

    return PersonaIdentity(
        assistant_id=_extract_scalar(frontmatter, "id", assistant_id),
        display_name=_extract_scalar(frontmatter, "display_name", assistant_id),
        primary_domain_label=_extract_primary_domain_label(frontmatter),
        system_body=body_without_notes.strip(),
        closing_library=_extract_closing_library(closing_section),
    )


def select_closing_tone(messages: list[dict], identity: PersonaIdentity) -> str:
    message_text = " ".join((m.get("text") or "") for m in messages if isinstance(m, dict)).lower()

    heuristics = [
        ("warning", ("aldat", "yalan", "nazar", "kavga", "dikkat", "dusman", "engel", "kork")),
        ("soothing", ("uzgun", "yorgun", "bunald", "kaygi", "stres", "yoruld", "yalniz", "kirgin")),
        ("hopeful", ("ask", "kismet", "evlilik", "baris", "para", "is", "mujde", "basari")),
        ("mysterious", ("ruya", "sezgi", "enerji", "gizli", "sir", "isaret", "gece")),
    ]

    for tone, keywords in heuristics:
        if tone in identity.closing_library and any(keyword in message_text for keyword in keywords):
            return tone

    if "warm" in identity.closing_library:
        return "warm"

    return next(iter(identity.closing_library.keys()), "warm")


def select_closing_sentence(
    identity: PersonaIdentity,
    tone: str,
    session_id: str,
) -> str:
    options = identity.closing_library.get(tone) or []
    if not options:
        options = identity.closing_library.get("warm") or []
    if not options:
        return ""

    seed = f"{session_id}:{identity.assistant_id}:{tone}".encode("utf-8")
    index = int(hashlib.sha256(seed).hexdigest(), 16) % len(options)
    return options[index]


def build_prompt(dev_settings: dict, messages: list[dict], images: dict, session_id: str) -> BuiltPrompt:
    assistant_id = (dev_settings.get("assistantId") or "durdane-hanim").strip() or "durdane-hanim"
    identity = load_persona_identity(assistant_id)
    closing_tone = select_closing_tone(messages, identity)
    closing_sentence = select_closing_sentence(identity, closing_tone, session_id)

    override_prompt = (dev_settings.get("systemPrompt") or "").strip()
    image_hint = []
    if images.get("cup"):
        image_hint.append("kullanici fincan gorseli gonderdi")
    if images.get("saucer"):
        image_hint.append("kullanici tabak gorseli gonderdi")
    if images.get("palm"):
        image_hint.append("kullanici avuc ici gorseli gonderdi")
    image_context = ", ".join(image_hint) if image_hint else "bu turda gorsel gelmemis olabilir"

    is_initial_reading = len(messages) <= 1
    runtime_rules = "\n".join(
        [
            "## Runtime Directives",
            f"- Ana uzmanlik alanini oncele: {identity.primary_domain_label}.",
            f"- Bu turda {image_context}.",
            "- Yanitini basliksiz, sohbet gibi akan duz yazi halinde ver.",
            "- Giriş bölümünü 1-2 cümlede tut; esas ağırlığı fal yorumuna ver.",
            "- Paragraflari TTS icin rahat okunacak kisa-orta uzunlukta tut.",
            "- Her paragrafi veya ana dusunceyi tamamlanmis cumlelerle bitir.",
            "- Falci gibi konusurken gecmis izlerini, bugunku olasiliklari ve yakin gelecek ihtimallerini birlikte dokumalisin; sadece mevcut durum analizi yapip kalma.",
            "- Yorumda kesin kehanet degil, olasilik dili kullan: 'gorunen ihtimal', 'yakina dusen yol', 'bu enerji boyle giderse' gibi ifadelerle konus.",
            "- Gecmis, simdi ve gelecek dengesini koru: once gorselden cikan gecmis izi, sonra bugunun olasiliklari, sonra yakin gelecek kapilari ve tavsiye gelsin.",
            "- Bu oturum boyunca sadece secili profil icin fal bak. Kullanici mesaj icinde baska biri icin yorum isterse ayni gorseli o kisiye aitmis gibi yeniden yorumlama.",
            "- Kullanici baska biri icin de yorum isterse nazikce bunun ayri bir profil ve ayri bir fal oturumu gerektirdigini soyle.",
            (
                "- Bu ilk ana fal açılışı. Yorumu katmanlı kur; toplam uzunluk hedefi yaklaşık 700-800 token aralığı olsun."
                if is_initial_reading
                else "- Bu bir follow-up turu. Kullanıcı sorularına verilen yanıtı yaklaşık 300-400 token aralığında tut ve sert kesmeden toparlayarak bitir."
            ),
            "- Süre belirtirken aynı sayıyı sürekli tekrar etme. Özellikle 3 ve 6 ağırlıklı ama 1-9 arasında çeşitlendirilmiş ifade kullan.",
            "- Son kisimda yeni bir imza kapanis cumlesi uretme; sistem persona kapanisini sonradan ekleyecek.",
            "- Kullaniciya ses tanima hatalariyla gelmis mesajlarda niyeti anlayip dogal sekilde cevap ver.",
            "- Türkçe karakterleri daima UTF-8 doğru yaz: ç, ğ, ı, İ, ö, ş, ü.",
            "- Bozuk karakter dizileri kullanma: Ã, Å, Ä, â.",
        ]
    )

    system_parts = [identity.system_body.strip(), runtime_rules]
    if override_prompt:
        system_parts.append("## Developer Override\n" + override_prompt)

    return BuiltPrompt(
        assistant_id=identity.assistant_id,
        display_name=identity.display_name,
        system_instruction="\n\n".join(part for part in system_parts if part),
        closing_tone=closing_tone,
        closing_sentence=closing_sentence,
    )


def build_memory_context(profile_name: str, memory_snippet: dict | None, reading_type: str, coffee_mode: str) -> str:
    if not memory_snippet and not profile_name:
        return ""

    lines = [
        "## Subject Context",
        f"- Bu fal {profile_name or 'secili kisi'} icin bakiliyor.",
        f"- Fal turu: {reading_type}.",
        f"- Kahve modu: {coffee_mode}.",
    ]

    if coffee_mode == "ai-brew":
        lines.extend(
            [
                "- Bu modda gercek fincan veya tabak zorunlu degil; kahve icilmis gibi sezgisel bir acilis yap.",
                "- Hafizada tekrar eden temalar varsa, ilk yoruma bunu dogal bir tanisiklik hissiyle yedir.",
            ]
        )

    if memory_snippet:
        is_self = bool(memory_snippet.get("isSelf"))
        relationship = memory_snippet.get("relationshipLabel")
        relationship_primary = memory_snippet.get("relationshipPrimary")
        profile_gender = memory_snippet.get("profileGender")
        pet_species = memory_snippet.get("petSpecies")
        if relationship:
            lines.append(f"- Hesap sahibiyle yakinlik: {relationship}.")
        if relationship_primary in {"arkadas", "akraba"}:
            lines.append(
                "- Yakınlık arkadaş/akraba sınıfında. Bu profilde aşk, flört, sevgililik veya romantik eşleşme yorumu yapma."
            )
        if profile_gender:
            lines.append(f"- Profil cinsiyet bilgisi: {profile_gender}.")
        if profile_gender == "erkek":
            lines.append("- Bu profile veya kullaniciya 'kizim' diye hitap etme; gerekirse 'evladim', 'oglum' veya ismiyle hitap et.")
        elif profile_gender == "kadin":
            lines.append("- Bu profile veya kullaniciya 'oglum' diye hitap etme; gerekirse 'evladim', 'kizim' veya ismiyle hitap et.")
        elif profile_gender in ("hicbiri", "belirtmek_istemiyorum"):
            lines.append("- Bu profil icin cinsiyetli hitap kullanma; 'kizim', 'oglum', 'guzel kizim', 'guzel oglum' yerine 'evladim', 'canim' veya ismiyle hitap et.")
        if relationship_primary == "evcil_hayvan":
            lines.append(f"- Bu profil bir evcil hayvan profili. Tur bilgisi: {pet_species or relationship or 'evcil hayvan'}.")
            lines.append("- El fali secildiyse insan eli degil, bu hayvanin patisi/ayagi uzerinden yorum beklenir.")

        if is_self:
            lines.append(
                "- Bu profil hesap sahibinin kendisi. Ana anlatimda profil adini kullanma; kullaniciya sen/siz diye hitap et."
            )
        else:
            lines.append(
                f"- Bu okuma hesap sahibinden farkli biri icin. Ana anlatimda gerekirse {profile_name} adini kullan; hesap sahibine sen diye degil, bu kisiye odaklan."
            )
        lines.append(
            f"- Secili profil sabit: bu oturum sadece {profile_name or 'bu profil'} icin. Sohbet icinde baska biri gecse bile gorseli o kisiye aitmis gibi yorumlama."
        )

        user_stated_topics = memory_snippet.get("userStatedTopics") or []
        user_stated_people = memory_snippet.get("userStatedPeople") or []
        user_stated_patterns = memory_snippet.get("userStatedPatterns") or []
        reading_topics = memory_snippet.get("readingTopics") or []
        reading_people = memory_snippet.get("readingPeople") or []
        reading_patterns = memory_snippet.get("readingPatterns") or []

        if user_stated_topics:
            lines.append(
                "- Kullanicinin yazdiklarinda tekrar eden konular: "
                + ", ".join(user_stated_topics[:3])
                + "."
            )
        if user_stated_people:
            lines.append(
                "- Kullanicinin yazdiklarinda one cikan kisiler: " + ", ".join(user_stated_people[:3]) + "."
            )
        if user_stated_patterns:
            lines.append(
                "- Kullanicinin yazdiklarinda gorulen duygusal kaliplar: " + ", ".join(user_stated_patterns[:3]) + "."
            )
        if reading_topics:
            lines.append(
                "- Onceki fallarda tekrar eden konular: " + ", ".join(reading_topics[:3]) + "."
            )
        if reading_people:
            lines.append(
                "- Onceki fallarda one cikan kisiler: " + ", ".join(reading_people[:3]) + "."
            )
        if reading_patterns:
            lines.append(
                "- Onceki fallarda gorulen kaliplar: " + ", ".join(reading_patterns[:3]) + "."
            )

        lines.extend(
            [
                "- Bu hafizayi veri tabani gibi degil, dogal bir tanisiklik hissi vermek icin kullan.",
                "- Sadece ilgiliyse hafizadan yararlan; ayni yanitta 1-2 dokunustan fazla yapma.",
            ]
        )

    return "\n".join(lines)


def append_persona_closing(text: str, closing_sentence: str) -> str:
    cleaned = (text or "").strip()
    if not closing_sentence:
        return cleaned
    if not cleaned:
        return closing_sentence
    if cleaned.endswith(closing_sentence):
        return cleaned
    if cleaned[-1] not in ".!?":
        cleaned += "."
    return f"{cleaned} {closing_sentence}"

