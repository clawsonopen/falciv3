import hashlib
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
IDENTITY_ROOT = REPO_ROOT / "mobile" / "src" / "identity" / "assistants"


@dataclass
class PersonaIdentity:
    assistant_id: str
    display_name: str
    age: int | None
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


def _extract_int(frontmatter: str, key: str) -> int | None:
    value = _extract_scalar(frontmatter, key, "")
    try:
        return int(value)
    except Exception:
        return None


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
        age=_extract_int(frontmatter, "age"),
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


ASSISTANT_AGE_FALLBACKS = {
    "durdane-hanim": 58,
    "hikmet-bey": 60,
    "bahar-hanim": 34,
    "mert-bey": 36,
    "caner": 29,
}


def _age_from_birth_date(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"^(\d{4})-\d{2}-\d{2}$", str(value).strip())
    if not match:
        return None
    return date.today().year - int(match.group(1))


def build_safety_policy() -> str:
    return "\n".join(
        [
            "## Sağlık ve Finans Sınırları",
            "- Konu taksonomisinde sağlık, enerji, uyku, bel/sırt, hareket ve basit beden uyarıları 'İç Dünya / Ruh hali ve beden' altında değerlendirilir.",
            "- Sağlık temaları yalnızca gündelik beden dengesi, dinlenme, hareket, randevu takibi ve genel dikkat diliyle anlatılabilir; teşhis, tedavi, ilaç, doz veya acil durum yönlendirmesi üretme.",
            "- Sağlıkla ilgili ciddi, ani veya uzun süren bir belirti görünürse kullanıcıyı uygun bir uzmana danışmaya nazikçe yönlendir.",
            "- Finans temaları bütçe farkındalığı, yatırımları gözden geçirme, acele karar vermeme, riski dağıtma, 'tüm yumurtaları aynı sepete koymama' ve planlama diliyle anlatılabilir; belirli ürün/varlık için al-sat, borçlanma, kredi veya sigorta tavsiyesi verme.",
            "- Para veya kariyer konusunda kesin kazanç, garanti sonuç ya da kişiye özel finansal karar dili kullanma; olasılık ve dikkat diliyle kal.",
        ]
    )


def build_address_policy(identity: PersonaIdentity, memory_snippet: dict | None) -> str:
    assistant_age = identity.age or ASSISTANT_AGE_FALLBACKS.get(identity.assistant_id)
    profile_info = (memory_snippet or {}).get("profileInfo") or {}
    birth_chart_data = (memory_snippet or {}).get("birthChartData") or {}
    profile_gender = profile_info.get("gender") or (memory_snippet or {}).get("profileGender")
    subject_age = _age_from_birth_date(birth_chart_data.get("birthDate"))
    older_enough = bool(assistant_age and subject_age and assistant_age - subject_age >= 10)
    family_style_allowed = identity.assistant_id in {"durdane-hanim", "hikmet-bey"} and older_enough

    lines = [
        "## Hitap ve Yaş Politikası",
        "- Hitapta profil cinsiyeti ve yaş farkı güvenlik kuralıdır; persona sıcaklığı bu kuralı ezemez.",
        "- 'yavrum', 'kızım', 'oğlum', 'evladım', 'güzel kızım', 'güzel oğlum' gibi aile-büyüğü hitaplarını gereksiz kullanma.",
    ]
    if assistant_age:
        lines.append(f"- Falcı yaşı: yaklaşık {assistant_age}.")
    if subject_age:
        lines.append(f"- Seçili profil yaşı: yaklaşık {subject_age}.")
    if identity.assistant_id in {"bahar-hanim", "mert-bey", "caner"}:
        lines.append("- Bu falcı için 'yavrum', 'kızım', 'oğlum', 'evladım' ve benzeri büyük/ebeveyn hitapları tamamen yasak.")
    elif family_style_allowed:
        lines.append("- Dürdane/Hikmet bu profilden en az 10 yaş büyük görünüyor; yine de 'yavrum' gibi hitapları sık değil, nadiren ve doğal gelirse kullan.")
    else:
        lines.append("- Dürdane/Hikmet için yaş farkı yeterli değil veya bilinmiyor; 'yavrum', 'kızım', 'oğlum', 'evladım' kullanma.")
    if profile_gender == "erkek":
        lines.append("- Profil erkekse 'kızım' ve 'güzel kızım' kesinlikle yasak.")
    elif profile_gender == "kadin":
        lines.append("- Profil kadınsa 'oğlum' ve 'güzel oğlum' kesinlikle yasak.")
    elif profile_gender in {"hicbiri", "belirtmek_istemiyorum"}:
        lines.append("- Profil cinsiyetsiz veya cinsiyet belirtmek istemiyor; tüm cinsiyetli hitaplar yasak.")
    return "\n".join(lines)


def build_prompt(dev_settings: dict, messages: list[dict], images: dict, session_id: str, memory_snippet: dict | None = None) -> BuiltPrompt:
    assistant_id = (dev_settings.get("assistantId") or "durdane-hanim").strip() or "durdane-hanim"
    identity = load_persona_identity(assistant_id)
    closing_tone = select_closing_tone(messages, identity)
    closing_sentence = select_closing_sentence(identity, closing_tone, session_id)

    override_prompt = (dev_settings.get("systemPrompt") or "").strip()
    image_hint = []
    if images.get("cup"):
        image_hint.append("kullanıcı fincan görseli gönderdi")
    if images.get("saucer"):
        image_hint.append("kullanıcı tabak görseli gönderdi")
    if images.get("palm"):
        image_hint.append("kullanıcı avuç içi görseli gönderdi")
    image_context = ", ".join(image_hint) if image_hint else "bu turda görsel gelmemiş olabilir"

    is_initial_reading = len(messages) <= 1
    runtime_rules = "\n".join(
        [
            "## Runtime Directives",
            f"- Ana uzmanlık alanını öncele: {identity.primary_domain_label}.",
            f"- Bu turda {image_context}.",
            "- Yanıtını başlıksız, sohbet gibi akan düz yazı halinde ver.",
            "- Persona içinde kal ama kendini tanıtma; 'ben Dürdane olarak', 'ben Mert olarak', 'ben falcı olarak' gibi kalıplar kullanma.",
            "- Giriş bölümünü 1-2 cümlede tut; esas ağırlığı fal yorumuna ver.",
            "- Paragrafları TTS için rahat okunacak kısa-orta uzunlukta tut.",
            "- Her paragrafı veya ana düşünceyi tamamlanmış cümlelerle bitir.",
            "- Falcı gibi konuşurken geçmiş izlerini, bugünkü olasılıkları ve yakın gelecek ihtimallerini birlikte dokumalısın; sadece mevcut durum analizi yapıp kalma.",
            "- Yorumda kesin kehanet değil, olasılık dili kullan: 'görünen ihtimal', 'yakına düşen yol', 'bu enerji böyle giderse' gibi ifadelerle konuş.",
            "- Geçmiş, şimdi ve gelecek dengesini koru: önce görselden çıkan geçmiş izi, sonra bugünün olasılıkları, sonra yakın gelecek kapıları ve tavsiye gelsin.",
            "- Bu oturum boyunca sadece seçili profil için fal bak. Kullanıcı mesaj içinde başka biri için yorum isterse aynı görseli o kişiye aitmiş gibi yeniden yorumlama.",
            "- Kullanıcı başka biri için de yorum isterse nazikçe bunun ayrı bir profil ve ayrı bir fal oturumu gerektirdiğini söyle.",
            (
                "- Bu ilk ana fal açılışı. Yorumu katmanlı kur; toplam uzunluk hedefi yaklaşık 700-800 token aralığı olsun."
                if is_initial_reading
                else "- Bu bir follow-up turu. Kullanıcı sorularına verilen yanıtı yaklaşık 300-400 token aralığında tut ve sert kesmeden toparlayarak bitir."
            ),
            "- Süre belirtirken aynı sayıyı sürekli tekrar etme. Özellikle 3 ve 6 ağırlıklı ama 1-9 arasında çeşitlendirilmiş ifade kullan.",
            "- Son kısımda yeni bir imza kapanış cümlesi üretme; sistem persona kapanışını sonradan ekleyecek.",
            "- Kullanıcıya ses tanıma hatalarıyla gelmiş mesajlarda niyeti anlayıp doğal şekilde cevap ver.",
            "- Türkçe karakterleri daima UTF-8 doğru yaz: ç, ğ, ı, İ, ö, ş, ü.",
            "- Bozuk karakter dizileri kullanma.",
        ]
    )

    system_parts = [
        identity.system_body.strip(),
        runtime_rules,
        build_address_policy(identity, memory_snippet),
        build_safety_policy(),
    ]
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
        f"- Bu fal {profile_name or 'seçili kişi'} için bakılıyor.",
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
        profile_info = memory_snippet.get("profileInfo") or {}
        owner_profile = memory_snippet.get("accountOwnerProfile") or {}
        birth_chart_data = memory_snippet.get("birthChartData") or {}
        prominent_relations = memory_snippet.get("prominentRelations") or []
        is_self = bool(memory_snippet.get("isSelf"))
        relationship = memory_snippet.get("relationshipLabel")
        relationship_primary = memory_snippet.get("relationshipPrimary")
        profile_gender = memory_snippet.get("profileGender")
        pet_species = memory_snippet.get("petSpecies")
        if profile_info:
            lines.append(
                "- Profil bilgileri: "
                + f"ad={profile_info.get('displayName') or profile_name or 'bilinmiyor'}, "
                + f"hesap sahibi mi={'evet' if profile_info.get('isAccountOwner') else 'hayır'}, "
                + f"hesap sahibiyle bağ={profile_info.get('relationshipToAccountOwner') or relationship or 'bilinmiyor'}."
            )
        if owner_profile and not is_self:
            lines.append(f"- Hesap sahibi: {owner_profile.get('displayName')}. Okuma yine seçili profil için kalmalı.")
        if birth_chart_data:
            birth_bits = []
            if birth_chart_data.get("birthDate"):
                birth_bits.append(f"tarih={birth_chart_data.get('birthDate')}")
            if birth_chart_data.get("birthTime") and birth_chart_data.get("timeKnown"):
                birth_bits.append(f"saat={birth_chart_data.get('birthTime')}")
            elif birth_chart_data.get("birthDate"):
                birth_bits.append("saat=bilinmiyor")
            location = ", ".join(
                item
                for item in [
                    birth_chart_data.get("cityOrRegion"),
                    birth_chart_data.get("country"),
                ]
                if item
            )
            if location:
                birth_bits.append(f"yer={location}")
            birth_bits.append(f"hassasiyet={birth_chart_data.get('chartPrecision') or memory_snippet.get('chartPrecision')}")
            lines.append("- Doğum/harita verisi: " + "; ".join(birth_bits) + ".")
        if relationship:
            lines.append(f"- Hesap sahibiyle yakinlik: {relationship}.")
        if relationship_primary in {"arkadas", "akraba"}:
            lines.append(
                "- Yakınlık arkadaş/akraba sınıfında. Bu profilde aşk, flört, sevgililik veya romantik eşleşme yorumu yapma."
            )
        if profile_gender:
            lines.append(f"- Profil cinsiyet bilgisi: {profile_gender}.")
        if profile_gender == "erkek":
            lines.append("- Bu profile veya kullanıcıya 'kızım' diye hitap etme; gerekirse 'evladım', 'oğlum' veya ismiyle hitap et.")
        elif profile_gender == "kadin":
            lines.append("- Bu profile veya kullanıcıya 'oğlum' diye hitap etme; gerekirse 'evladım', 'kızım' veya ismiyle hitap et.")
        elif profile_gender in ("hicbiri", "belirtmek_istemiyorum"):
            lines.append("- Bu profil için cinsiyetli hitap kullanma; 'kızım', 'oğlum', 'güzel kızım', 'güzel oğlum' yerine 'evladım', 'canım' veya ismiyle hitap et.")
        if relationship_primary == "evcil_hayvan":
            lines.append(f"- Bu profil bir evcil hayvan profili. Tur bilgisi: {pet_species or relationship or 'evcil hayvan'}.")
            lines.append("- El fali secildiyse insan eli degil, bu hayvanin patisi/ayagi uzerinden yorum beklenir.")

        if is_self:
            lines.append(
                "- Bu profil hesap sahibinin kendisi. Ana anlatimda profil adini kullanma; kullaniciya sen/siz diye hitap et."
            )
        else:
            lines.append(
                f"- Bu okuma hesap sahibinden farklı biri için. Ana anlatımda gerekirse {profile_name} adını kullan; hesap sahibine sen diye değil, bu kişiye odaklan."
            )
        lines.append(
            f"- Seçili profil sabit: bu oturum sadece {profile_name or 'bu profil'} için. Sohbet içinde başka biri geçse bile görseli o kişiye aitmiş gibi yorumlama."
        )

        user_stated_topics = memory_snippet.get("userStatedTopics") or []
        user_topic_groups = memory_snippet.get("userTopicGroups") or []
        user_stated_people = memory_snippet.get("userStatedPeople") or []
        user_stated_patterns = memory_snippet.get("userStatedPatterns") or []
        reading_topics = memory_snippet.get("readingTopics") or []
        reading_topic_groups = memory_snippet.get("readingTopicGroups") or []
        reading_people = memory_snippet.get("readingPeople") or []
        reading_patterns = memory_snippet.get("readingPatterns") or []

        if user_stated_topics:
            lines.append(
                "- Kullanıcının yazdıklarında tekrar eden konular: "
                + ", ".join(user_stated_topics[:10])
                + "."
            )
        if user_topic_groups:
            grouped = []
            for item in user_topic_groups[:10]:
                if isinstance(item, dict) and item.get("label"):
                    grouped.append(
                        f"{item.get('group') or 'Genel'} / {item.get('subgroup') or 'Diğer'}: {item.get('label')}"
                    )
            if grouped:
                lines.append("- Kullanıcının konuştuğu konuların gruplu hafızası: " + "; ".join(grouped) + ".")
        if user_stated_people:
            lines.append(
                "- Kullanıcının yazdıklarında öne çıkan kişiler: " + ", ".join(user_stated_people[:3]) + "."
            )
        if prominent_relations:
            relation_text = []
            for item in prominent_relations[:5]:
                if isinstance(item, dict) and item.get("label"):
                    rel = item.get("relationship") or "ilgili kişi"
                    relation_text.append(f"{item.get('label')} ({rel})")
            if relation_text:
                lines.append("- Tekilleştirilmiş öne çıkan ilişkiler: " + ", ".join(relation_text) + ".")
        if user_stated_patterns:
            lines.append(
                "- Kullanıcının yazdıklarında görülen duygusal kalıplar: " + ", ".join(user_stated_patterns[:3]) + "."
            )
        if reading_topics:
            lines.append(
                "- Önceki fallarda tekrar eden konular: " + ", ".join(reading_topics[:3]) + "."
            )
        if reading_topic_groups:
            grouped_readings = []
            for item in reading_topic_groups[:10]:
                if isinstance(item, dict) and item.get("label"):
                    grouped_readings.append(
                        f"{item.get('group') or 'Genel'} / {item.get('subgroup') or 'Diğer'}: {item.get('label')}"
                    )
            if grouped_readings:
                lines.append("- Falda çıkan konuların gruplu hafızası: " + "; ".join(grouped_readings) + ".")
        if reading_people:
            lines.append(
                "- Önceki fallarda öne çıkan kişiler: " + ", ".join(reading_people[:3]) + "."
            )
        if reading_patterns:
            lines.append(
                "- Önceki fallarda görülen kalıplar: " + ", ".join(reading_patterns[:3]) + "."
            )

        lines.extend(
            [
                "- Bu hafızayı veri tabanı gibi değil, doğal bir tanışıklık hissi vermek için kullan.",
                "- Sadece ilgiliyse hafızadan yararlan; aynı yanıtta 1-2 dokunuştan fazla yapma.",
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
