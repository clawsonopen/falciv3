Fal App Memory Architecture v2

Ana fikir şu:

History = kullanıcı eski falını görsün
Raw Archive = ham kayıt kaybolmasın
Journal = zaman içinde ne yaşandı kaydedilsin
Memory = kullanıcıyı tanısın
Fingerprint = aynı fal tekrar etmesin
Lore = falcı ailesi canlı kalsın
Prompt Builder = bunların çok küçük, seçilmiş kısmını LLM’e göndersin

Bu mimari, önce konuştuğumuz Infinite Brain / typed graph, RA-H OS chunk/database, MemPalace raw archive, LLM Wiki lore, Caveman compression ve Companion Memory Layer fikirlerini tek sistemde birleştiriyor.

1. Big Picture: hangi şey ne işe yarıyor?
Katman	İnsan görür mü?	LLM kullanır mı?	Ana amaç
Reading History	Evet	Nadiren	Kullanıcı eski fallarını açıp okuyabilsin
Raw Archive	Normalde hayır	Gerektiğinde chunk ile	Ham transcript, görsel analizi, kaynak saklansın
Session Journal	Opsiyonel / admin / kullanıcıya özet	Evet, seçilerek	O gün/oturum ne oldu, zaman çizgisi
Memory Nodes	Normalde hayır	Evet	Kullanıcıyı, ilişkilerini, tercihlerini tanımak
Reading Fingerprints	Hayır	Evet	Fal tekrarlarını engellemek
Lore Graph	Admin görür	Evet	Falcı ailesi/persona/sosyal medya evreni
Prompt Builder	Hayır	Kendisi LLM’e context hazırlar	En alakalı küçük hafıza paketini üretmek
Expression Rules	Hayır	Evet	Memory’yi göze sokmadan kullanmak
Debug / Audit	Admin/dev görür	Hayır	Hangi memory neden kullanıldı takip etmek

Bu ayrım çok önemli: kullanıcı history’si ile memory aynı şey değil. Kullanıcı eski falı görüntüleyebilir; ama yeni falda eski falın tamamı LLM’e gönderilmez.

2. Katmanlar
Layer 1 — Capture Layer

Her şey burada yakalanır.

Kaynaklar:

- Profil bilgileri
- Eş / arkadaş / çocuk / evcil hayvan profilleri
- Astroloji / numeroloji / MBTI / enneagram / morfolojik test sonuçları
- Kahve / el falı transcript’i
- Fal sonrası follow-up soruları
- Kullanıcının “evet doğru” onayları
- Kullanıcının “hayır öyle değil” düzeltmeleri
- Görsel analiz özetleri
- Falcı ailesi sosyal medya postları
- Falcı/persona admin notları

Buradaki her veri hemen “memory” olmaz. Önce kaynak olarak yakalanır.

Layer 2 — Reading History

Bu, kullanıcıya dönük eski fal ekranıdır.

Kullanıcı burada şunları görebilir:

- 14 Mayıs 2026 kahve falı
- Hangi profil için bakıldı?
- Hangi falcı baktı?
- Fal metni
- Konuşma transcript’i
- Görseller
- Özet
- Kullanıcının follow-up soruları

Bu özellik memory sisteminden bağımsız olarak kalır. Yani kullanıcı eski falını okuyabilir ama bu eski falın tamamı yeni fal prompt’una girmez.

Mevcut repo’da bunun temeli zaten var: ReadingSummary içinde readingId, profileId, assistantId, readingType, createdAt, summary, transcript gibi alanlar bulunuyor. Bu da history’nin memory’den ayrı bir nesne olarak düşünüldüğünü gösteriyor.

Reading History’nin görevi
Kullanıcıya geçmişi göstermek.
Reading History’nin görevi olmayan şey
Her yeni falda tüm eski falı LLM’e göndermek.
Layer 3 — Raw Archive

Bu, MemPalace mantığına yakın olan katman.

Amaç:

Ham kaynak kaybolmasın.

Buraya şunlar girer:

- Tam transcript
- Sesli konuşma dökümü
- Kullanıcı follow-up ham metni
- Falcı cevabı
- Görsel analiz sonucu
- Sosyal medya post ham metni
- Eski fal metni

Bu katman kullanıcıya direkt gösterilmek zorunda değil. Ama ileride kullanıcı “ben bunu ne zaman söylemiştim?” derse veya sistem bir memory’nin kaynağını doğrulamak isterse buraya döner.

Raw Archive, prompt’a direkt gitmez. Uzunsa chunk’lanır.

Layer 4 — Chunk + Search Layer

Bu katman RA-H OS yaklaşımından geliyor.

RA-H OS şunu güzel yapıyor: kaynak metni tek parça saklamakla kalmıyor; nodes, edges, chunks, full-text search ve vector search gibi yapılara bölüyor. RA-H schema dokümanında SQLite’ın nodes, edges, source chunks, metadata, full-text index ve semantic-vector lookup tablolarını tuttuğu anlatılıyor.

Bizim fal app’te bunun karşılığı:

Uzun kaynak → chunk
Kısa anlamlı bilgi → memory node
İlişkiler → edge
İsim / tarih / direkt cümle → FTS search
Benzer duygu / benzer konu → vector search

Örnek:

Raw transcript:
“Evet ya, eşimle konuşurken hep kendimi savunmada hissediyorum...”

Chunk:
chunk_001 = bu follow-up’ın ilgili bölümü

Memory node:
İlişkide savunmada hissetme pattern’ı

Edge:
followup chunk confirmed_by_user emotional_pattern

RA-H dokümanında chunk’ların uzun source materyallerde ilgili passage’ı bulmaya yaradığı, böylece modelin tüm kaynağı okumak zorunda kalmadığı anlatılıyor. Bu bizim maliyet için çok kritik.

Layer 5 — Session Journal

Journal yeni eklediğimiz katman.

Journal, reading fingerprint değildir. Journal, “o gün/oturum ne oldu?” kaydıdır.

Örnek journal entry:

2026-05-14 — Ozan / Dürdane Hanım / Kahve Falı

- Kullanıcı Ozan profili için kahve falı baktı.
- Falda ilişki belirsizliği, iç yorgunluk ve haber bekleme temaları işlendi.
- Kullanıcı follow-up’ta eş ilişkisiyle ilgili savunmada hissetme temasını doğruladı.
- Kullanıcı yorumların generic değil, daha kişisel ve dolaylı olmasını tercih etti.
- Bu oturumdan 2 memory node ve 1 reading fingerprint üretildi.

Journal’ın amacı:

Zaman çizgisi oluşturmak.

Journal şunlara yarar:

- Kullanıcının app içindeki yolculuğunu anlamak
- Memory çıkarımlarına bağlam vermek
- “Son dönemde ne oldu?” sorusunu cevaplamak
- Falcıların kullanıcıyla ilişkisinin evrimini takip etmek
- Gerektiğinde kısa dönem bağlam üretmek

Journal, kullanıcıya istenirse gösterilebilir. Ama default’ta admin/internal kalabilir.

Layer 6 — Extraction Layer

Bu katman ham veriden anlamlı şeyler çıkarır.

Her oturum sonunda çalışır:

Input:
- transcript
- user follow-up
- reading text
- profile info
- current memory snippet

Output:
- memory nodes
- session journal entry
- reading fingerprint
- possible corrections
- possible confirmations

Önemli scoring burada yapılır.

Kaynak ağırlıkları:

Kaynak	Güven
Kullanıcının açık düzeltmesi	Çok yüksek
Kullanıcının follow-up cevabı	Çok yüksek
Kullanıcının “evet doğru” onayı	Yüksek
Profil/test sonucu	Orta-yüksek
Fal metninden çıkarılan tema	Düşük-orta
Falcının tahmini	Düşük

Yani falcının söylediği şey hemen gerçek memory olmaz. Kullanıcı onaylarsa güçlenir.

Layer 7 — Typed Graph Memory Layer

Bu, Infinite Brain fikrinin app’e uygulanmış hali.

Memory artık düz liste değil; typed node + typed edge olur.

Node tipleri
Profile
Person
Pet
Relationship
UserStatedFact
UserCorrection
UserConfirmation
EmotionalPattern
LifeEvent
Preference
TestResult
ReadingTheme
ReadingFingerprint
AvoidRepetitionRule
AssistantAffinity
LoreFact
SocialPost
PersonaTrait
Edge tipleri
confirmed_by_user
corrected_by_user
derived_from_reading
derived_from_test
related_to_person
affects_tone
affects_topic_selection
avoid_repeating
safe_to_hint
do_not_surface
supports
contradicts
part_of
updated_by

İlk videodaki typed edge fikri burada çok değerli: sadece “bağlantı var” değil, “bu bağlantı ne anlama geliyor?” sorusunu cevaplıyor. Transcript’te supports, contradicts, depends on, derived from, related to, part of gibi edge type’ların AI’ın daha az okuyarak daha doğru gezinmesini sağladığı anlatılıyor.

Fal app örneği:

{
  "node": "emotional_pattern_relationship_defensive",
  "type": "EmotionalPattern",
  "summary": "Kullanıcı ilişkide kendini savunmada hissetme ve anlaşılmama yorgunluğu yaşıyor.",
  "confidence": 0.92,
  "visibility": "subtle_only"
}

Edge:

{
  "from": "followup_2026_05_14",
  "edge": "confirmed_by_user",
  "to": "emotional_pattern_relationship_defensive"
}

Bu sayede model şunu bilir:

Bu yüksek güvenli.
Kullanıcı bunu doğrulamış.
Ama direkt söyleme; subtle kullan.
Layer 8 — Reading Fingerprint Layer

Reading fingerprint journal değildir.

Reading fingerprint, falın teknik DNA’sıdır.

Amaç:

Yeni fal eski fal gibi olmasın.

Örnek:

{
  "readingId": "reading_123",
  "profileId": "profile_ozan",
  "assistantId": "durdane",
  "readingType": "coffee",
  "themes": [
    "ilişkide belirsizlik",
    "karar eşiği",
    "beklenen haber"
  ],
  "symbolsUsed": [
    "iki yol",
    "kuş",
    "anahtar",
    "kalp"
  ],
  "phrasesToAvoid": [
    "önünde iki yol var",
    "yakında haber geliyor",
    "geçmişten biri kapını çalabilir"
  ],
  "emotionalArc": "belirsizlik → sabır → küçük netleşme",
  "nextAngleSuggestion": "İlişki çıkarsa bu kez sınır, iç yük veya iletişim ritmi açısından yaklaş."
}

Reading fingerprint kullanıcıya gösterilmez.

Prompt builder bunu yeni fal öncesi okur ve modele der ki:

Son fallarda iki yol / haber / anahtar metaforları fazla kullanıldı.
Bu falda aynı sembol ve cümleleri tekrar etme.

Bu katman kullanıcıyı tanımaktan çok içerik tekrarını azaltır.

Layer 9 — Consolidation Layer

Bu katman memory’yi zamanla olgunlaştırır.

Örneğin:

5 ayrı follow-up → 1 stable emotional pattern
3 düzeltme → 1 tone preference
4 benzer tema → recurring topic
Son 5 falda aynı metafor → avoid repetition rule

Örnek:

Küçük memory’ler:
- 3 kez ilişki belirsizliği konuşuldu
- 2 kez kendini açıklama yorgunluğu onaylandı
- 1 kez kullanıcı fazla direkt ifadeden rahatsız oldu

Consolidated pattern:
Kullanıcı ilişkisel yorumlarda hem derinlik hem yumuşaklık istiyor; fazla kesin veya suçlayıcı dil ters tepiyor.

Consolidation her oturumda şart değil. Günlük/haftalık çalışabilir.

Layer 10 — Lore Layer

Bu, falcı ailesi evreni için.

Burada LLM Wiki + ikinci videodaki folder scaffold mantığı çok uygun.

İkinci video transcript’inde sistemin markdown-only bir folder yapısı olarak başlayabildiği, Obsidian’da açılabildiği ve istenirse SQLite’a yükseltilebildiği anlatılıyor. Aynı videoda adapter_prompt.md gibi bir dosyanın herhangi bir LLM’in klasörde kendini initialize etmesini sağladığı anlatılıyor.

Biz bunu kullanıcıya değil, admin/lore/prompt yönetimi tarafına koyarız.

Örnek yapı:

/falci-brain
  /personas
    durdane_hanim.md
    hikmet_bey.md
    bahar_hanim.md
    mert_bey.md
    caner.md

  /lore
    family_history.md
    running_jokes.md
    social_posts/
    seasonal_events/

  /policies
    memory_usage_rules.md
    subtle_recall_rules.md
    anti_repetition_rules.md
    privacy_rules.md

  /prompt_builder
    coffee_fortune_context.md
    palm_fortune_context.md
    lore_crumb_rules.md

  /agents
    lore_curator.md
    memory_consolidator.md
    prompt_reviewer.md

Sonra bu içerik runtime database’e aktarılır:

Markdown lore → lore_nodes
Markdown links → lore_edges
Social post → SocialPost node
Persona trait → PersonaTrait node

Prompt’a sadece küçük lore crumb gider:

Dürdane eski fincanları saklamayı sever; Hikmet buna takılır. Sadece doğal akarsa hafif tat olarak kullan.
Layer 11 — Prompt Builder Layer

Bütün sistemin kalbi burası.

Prompt builder her yeni falda şunu yapar:

1. Profil özünü al
2. Reading type’a göre alakalı memory seç
3. Follow-up kaynaklı yüksek güvenli memory’leri önceliklendir
4. İlgili kişi/profil node’larını çek
5. Son reading fingerprint’lerden tekrar uyarısı üret
6. Falcı lore’undan 1 küçük crumb seç
7. Hepsini Caveman-style kısa internal context’e sıkıştır
8. LLM’e gönder

Prompt’a giden şey tüm history değildir. Küçük bir “Memory Pack”tir.

Örnek:

MEMORY PACK — internal only
Use subtly. Do not expose memory mechanics.

Profile essence:
- Creative, intuitive; dislikes generic readings.
- Prefers layered but concrete interpretation.

Relevant pattern:
- Relationship: feeling misunderstood + explaining self repeatedly. User-confirmed. Subtle only.

Tone:
- Warm, specific, not clinical. Avoid “you told me before”.

Avoid repetition:
- Last readings overused “two roads / new beginning / news coming”. Avoid same frame.

Lore crumb:
- Dürdane keeps old cups; Hikmet teases her. Flavor only if natural.
END

Bu 400–800 token civarında kalabilir.

Layer 12 — Expression Layer

Bu katman memory’nin kullanıcıya nasıl yedirileceğini belirler.

Kural:

Memory kullan ama memory kullandığını belli etme.

Kötü:

Geçen sefer eşinle anlaşılmadığını söylemiştin.

İyi:

Burada mesele sadece karşındaki kişinin ne dediği değil; senin kendini yeniden yeniden anlatmak zorunda kaldığında içten içe yorulman gibi bir his var.

Expression rules:

- Kullanıcı sormadıysa tarih verme.
- “Sen bana söylemiştin” deme.
- Memory’yi ton, vurgu ve örnek seçiminde kullan.
- Kişi adlarını dikkatli kullan.
- Her falda maksimum 1–2 subtle recall.
- Kullanıcı açıkça sorarsa direkt memory recall yapılabilir.
Layer 13 — Debug / Audit Layer

Bu kullanıcıya değil, sana/dev/admin’e lazım.

Her falda şunları görebilmelisin:

Bu falda kullanılan memory:
- emotional_pattern_relationship_defensive
- preference_no_generic_readings
- avoid_repeat_two_roads
- lore_durdane_old_cups

Neden seçildi?
- profile match
- semantic similarity
- high salience
- recent follow-up

Bu, sistemin saçmalamasını engeller.

3. Kullanıcı History ile Memory ilişkisi

Bu en kritik ayrım.

Kullanıcı History

Kullanıcıya dönük arşivdir.

Kullanıcı eski fallarını görür.
Tam metni okur.
Görseli açar.
Transcript’i görebilir.
Falcı kimdi, ne zaman bakıldı, hangi profil içindi görür.
Raw Archive

History’nin daha teknik kaynak katmanı.

Tam transcript / source burada saklanır.
Chunk’lanabilir.
Memory’nin kanıtı olarak kullanılabilir.
Journal

History’den daha özet ve zaman çizgisel katman.

Bu oturumda ne oldu?
Kullanıcı neyi onayladı?
Ne düzeltildi?
Hangi yeni memory üretildi?
Memory

History ve journal’dan damıtılmış kalıcı anlam.

Kullanıcı kim?
Neye hassas?
Kimler önemli?
Hangi temalar tekrar ediyor?
Hangi üslup iyi çalışıyor?
Fingerprint

History’den çıkan anti-tekrar teknik izi.

Bu falda hangi semboller/temalar/cümleler kullanıldı?
Sonraki falda ne tekrar edilmemeli?

Akış:

Reading History
    ↓
Raw Archive
    ↓
Session Journal
    ↓
Memory Nodes + Reading Fingerprint
    ↓
Prompt Builder
    ↓
Yeni falda küçük, kontrollü context

Ama yeni falda:

Tüm eski History → prompt

yapılmaz.

4. Bir oturumdan sonra ne üretilir?

Örnek olay:

Kullanıcı Dürdane Hanım ile kahve falı baktı. Fal sonrası dedi ki:

“Evet ya, eşimle konuşurken hep kendimi savunmada hissediyorum.”

Sistem bunu şöyle işler:

1. Reading History

Kullanıcı eski fal ekranında konuşmayı görebilir.

14 Mayıs 2026 — Dürdane Hanım — Kahve Falı
Tam fal metni + follow-up
2. Raw Archive

Ham transcript saklanır.

User follow-up raw text:
“Evet ya, eşimle konuşurken hep kendimi savunmada hissediyorum.”
3. Session Journal
Kullanıcı, eş ilişkisiyle ilgili savunmada hissetme ve anlaşılmama yorgunluğu temasını doğruladı.
4. Memory Node
{
  "type": "EmotionalPattern",
  "summary": "İlişkide kendini savunmada hissetme ve anlaşılmama yorgunluğu.",
  "sourceType": "user_followup",
  "confidence": 0.95,
  "salience": 0.88,
  "visibility": "subtle_only",
  "promptUse": "shape_interpretation"
}
5. Edge
{
  "edge": "confirmed_by_user",
  "from": "followup_2026_05_14",
  "to": "emotional_pattern_relationship_defensive"
}
6. Reading Fingerprint
{
  "themes": ["ilişki savunması", "anlaşılmama"],
  "phrasesToAvoid": [
    "kendini savunmada hissediyorsun cümlesini aynen tekrar etme"
  ],
  "nextAngleSuggestion": "Bir sonraki ilişkisel yorumda sınırlar, iletişim ritmi veya iç yük açısından yaklaş."
}
7. Prompt Builder’da sonraki kullanım

Yeni falda LLM’e şöyle gider:

User-confirmed relationship pattern: misunderstood + defensive fatigue. Use subtly; do not say user told this before.
5. Database mantığı

En pratik schema şöyle olabilir:

readings
- id
- account_id
- profile_id
- assistant_id
- reading_type
- created_at
- summary
- display_text
- metadata_json

reading_assets
- id
- reading_id
- asset_type
- uri
- metadata_json

raw_sources
- id
- account_id
- profile_id
- source_type
- source_text
- reading_id
- created_at
- metadata_json

source_chunks
- id
- source_id
- chunk_index
- text
- metadata_json

session_journals
- id
- account_id
- profile_id
- reading_id
- journal_date
- summary
- events_json
- created_at

memory_nodes
- id
- account_id
- profile_id
- type
- title
- summary
- source_id
- confidence
- salience
- visibility
- prompt_use
- metadata_json
- created_at
- updated_at
- last_used_at

memory_edges
- id
- from_node_id
- to_node_id
- edge_type
- explanation
- confidence
- metadata_json
- created_at

reading_fingerprints
- id
- reading_id
- profile_id
- assistant_id
- themes_json
- symbols_json
- phrases_to_avoid_json
- emotional_arc
- next_angle_suggestion
- created_at

lore_nodes
- id
- persona_id
- type
- title
- summary
- source_text
- source_url
- valid_from
- valid_to
- metadata_json

lore_edges
- id
- from_node_id
- to_node_id
- edge_type
- explanation

Arama tarafında:

FTS:
- raw_sources
- source_chunks
- memory_nodes
- lore_nodes

Vector:
- memory node embeddings
- source chunk embeddings
- lore node embeddings

RA-H’ın mantığında FTS, semantic search ve graph traversal farklı soruları cevaplıyor: kelime nerede geçiyor, anlamca ne benziyor, hangi şey neye bağlı. Bizim sistemde de aynen bu ayrım kullanılır.

6. Fazlar
Faz 1 — Mevcut v3 memory’yi düzenle

Hemen yapılacaklar:

- userStated / readingDerived ayrımı korunsun
- confidence eklensin
- sourceType eklensin
- visibility eklensin
- promptUse eklensin
- follow-up memory yüksek güvenli olsun

Mevcut repo’da zaten userStated ve readingDerived ayrımı var. Ayrıca oturum bitince /memory-analyze endpoint’i çağrılıyor ve transcript memory analizine gidiyor. Bu iyi bir temel.

Faz 2 — Reading History’yi sağlamlaştır

Kullanıcı eski falları net görebilsin:

- tarih
- falcı
- profil
- fal tipi
- özet
- tam metin
- görseller
- transcript

Bu memory’den bağımsız UI olarak kalsın.

Faz 3 — Session Journal ekle

Her oturum sonunda kısa journal üret:

- ne oldu?
- hangi profil?
- hangi falcı?
- kullanıcı neyi onayladı?
- neyi düzeltti?
- hangi yeni memory üretildi?
- hangi repetition riskleri var?

Journal hem kullanıcı yolculuğunu hem memory extraction’ı daha anlaşılır yapar.

Faz 4 — Reading Fingerprint ekle

Her fal sonrası çıkar:

- ana temalar
- semboller
- metaforlar
- tekrar edilmemesi gereken cümleler
- emotional arc
- next angle suggestion

Bu kaliteyi hızlı artırır.

Faz 5 — Typed Nodes / Edges ekle

Memory artık sadece array değil, graph olsun.

Önce basit başlayabilirsin:

memory_nodes
memory_edges

İlk edge tipleri:

confirmed_by_user
corrected_by_user
derived_from_reading
related_to_person
affects_tone
avoid_repeating
safe_to_hint
do_not_surface
Faz 6 — Chunk + FTS ekle

Uzun transcript’leri ve raw kaynakları chunk’la.

Önce vector şart değil. FTS bile büyük fark yaratır:

- isim arama
- tarih arama
- “eşim” geçen follow-up’ları bulma
- belirli eski cümleyi bulma
Faz 7 — Vector Search ekle

Sonra semantic recall:

- benzer duygu
- benzer ilişki pattern’ı
- benzer para/kariyer konusu
- benzer eski follow-up

Bu aşamada RA-H tarzı node-level + chunk-level vector çok iyi olur.

Faz 8 — Prompt Builder V2

Bu en kritik ürün katmanı.

Her faldan önce:

- profile essence
- ilgili people nodes
- high-trust recent memory
- stable emotional patterns
- anti-repetition fingerprint
- selected lore crumb
- tone rules

seçilir ve Caveman-style sıkıştırılır.

Faz 9 — Lore Graph / Falcı Family Wiki

Falcı ailesi için:

- persona dosyaları
- aile ilişkileri
- sosyal medya postları
- running jokes
- sezonluk eventler
- persona tone updates

oluşturulur.

Bunu önce markdown/wiki olarak tutup sonra DB’ye ingest etmek mantıklı.

Faz 10 — Consolidation Worker

Zamanla memory şişmesin diye:

- benzer memory’leri birleştir
- düşük güvenli eski memory’leri zayıflat
- çelişkileri işaretle
- stable pattern üret
- gereksiz repetition rule’ları expire et
Faz 11 — Debug / Audit panel

Dev/admin için:

- Bu falda hangi memory kullanıldı?
- Hangi fingerprint uyarısı geldi?
- Hangi lore crumb seçildi?
- Hangi memory prompt’a gitti?
- Kaç token tuttu?

Bu olmadan sistemin kalitesini anlamak zor olur.

7. Nihai architecture özeti

Tek cümleyle:

Kullanıcıya görünen eski fal geçmişi ayrı kalır; app arka planda ham transcript’i archive eder, oturumu journal’a özetler, kalıcı anlamı memory node’lara çıkarır, falın tekrar riskini fingerprint’e yazar, falcı ailesi lore’unu ayrı graph’ta tutar, sonra yeni fal öncesi bunların sadece küçük ve alakalı bir kısmını prompt builder ile LLM’e gönderir.

En sade şema:

USER SESSION
   ↓
Reading History  ← kullanıcı görür
   ↓
Raw Archive      ← ham kaynak
   ↓
Session Journal  ← zaman çizgisi özeti
   ↓
Memory Nodes     ← kullanıcıyı tanıma
   ↓
Reading Fingerprint ← tekrar engelleme
   ↓
Prompt Builder
   ↓
Compressed Memory Pack
   ↓
LLM / Falcı Response

Paralel olarak:

Falcı Social Media / Admin Lore
   ↓
Lore Wiki
   ↓
Lore Graph
   ↓
Tiny Lore Crumb
   ↓
Prompt Builder
8. En önemli ürün kuralları
1. History kullanıcı içindir.
2. Memory LLM içindir.
3. Journal zaman çizgisi içindir.
4. Fingerprint tekrar önleme içindir.
5. Lore karakter evreni içindir.
6. Raw Archive kanıt ve geri dönüş içindir.
7. Prompt Builder hepsini seçer, kısaltır, sınırlar.
8. Expression Layer memory’yi göze sokmadan kullandırır.

Ve en kritik kural:

Kullanıcı “beni hatırlıyor” hissetsin,
ama “veritabanından geçmişimi okuyor” gibi hissetmesin.

Bence bu, fal app’in uzun vadeli hafıza mimarisi için en doğru omurga.

memory ne xamanlarda kullanılıyor ve nasıl acıklar mısın? yani user ne yaptığında neye bastığında bir memory ile ilgili işlem tetiklenmekte? kısaca yazıver bakayım.
Thought for a couple of seconds

Kısaca: memory işlemleri iki ana zamanda tetiklenir:

1. Fal başlamadan önce → memory okunur
2. Fal / konuşma bittikten sonra → memory yazılır/güncellenir
1. Kullanıcı fal başlatınca

Kullanıcı şunları yapar:

Profil seçer
→ fal tipi seçer
→ falcı seçer
→ fotoğraf yükler veya AI-brew başlatır
→ fal oturumu açılır

Bu anda sistem şunu yapmalı:

Bu profil için memory snippet hazırla
→ profile essence
→ önemli kişiler
→ son yüksek güvenli memory’ler
→ tekrar edilmemesi gereken fingerprint’ler
→ seçilen falcının küçük lore crumb’u
→ LLM’e gönder

Yani kullanıcı “falı başlat” dediğinde memory read / retrieval çalışır.

Mevcut repo’da da session başlarken config içinde memorySnippet fortune API’ye gönderiliyor.

2. Kullanıcı fal içinde follow-up soru sorunca

Kullanıcı falcının cevabından sonra şuna benzer şeyler yazar/söyler:

“Evet doğru, eşimle böyle oluyor.”
“Hayır, aslında annem değil ablam.”
“Peki bu para konusu ne zaman açılır?”
“Ben zaten bu konuda çok yoruldum.”

Bu anda iki şey olabilir:

A) Anlık cevap için memory okunur

Kullanıcının sorusu ilişki/para/aile gibi bir memory alanına değiyorsa, sistem ilgili memory’yi çağırabilir.

B) Kullanıcının mesajı memory adayı olur

Özellikle kullanıcı:

onay verirse
düzeltme yaparsa
kişi adı verirse
duygu belirtirse
tercih belirtirse

bu mesaj yüksek değerli memory kaynağı olur.

Mevcut repo’da kullanıcı mesajı soru gibi görünüyorsa appendUserConversationMemory çağrılıyor.

3. Kullanıcı “Falı Bitir” dediğinde

Bu en büyük memory yazma anı.

Kullanıcı falı bitirince sistem:

transcript’i toplar
→ reading history’ye kaydeder
→ raw archive’a koyar
→ memory-analyze endpoint’ine yollar
→ memory nodes çıkarır
→ journal entry oluşturur
→ reading fingerprint çıkarır
→ token usage kaydeder

Mevcut repo’da persistReadingAndEnd içinde önce reading summary kaydediliyor, sonra transcript /memory-analyze endpoint’ine gönderilip sonuç applyMemoryAnalysisResult ile memory’ye uygulanıyor.

4. Kullanıcı profil oluşturunca / güncelleyince

Kullanıcı:

kendi profilini oluşturur
eşini ekler
arkadaşını ekler
evcil hayvanını ekler
doğum tarihi / saat / yer girer
ilişki tipini değiştirir

Bu da memory işlemidir.

Burada sistem:

profile node oluşturur/günceller
ilişki edge’i kurar
önemli kişi memory’sine ekler
astro/numeroloji/test context’ini profile essence’a bağlar

Mevcut repo’da createProfile ve updateProfile sonrası profile memory dosyaları garantiye alınıyor ve ilişki linkleri hazırlanıyor.

5. Kullanıcı eski fallara bakınca

Normalde memory tetiklenmez.

Kullanıcı eski falı açarsa:

history okunur
eski fal gösterilir

Ama kullanıcı eski fal üzerinden şunu yaparsa:

“Bunu memory’ye kaydet”
“Bu yanlış, aslında öyle değildi”
“Bu konuyu artık önemsemiyorum”

o zaman memory update tetiklenebilir.

6. Arka planda otomatik çalışan işler

Kullanıcı bir şeye basmasa da periyodik işler olabilir:

journal consolidation
benzer memory’leri birleştirme
eski düşük güvenli memory’leri zayıflatma
reading fingerprint’lerden avoid rule üretme
lore/social post ingest
falcı ailesi lore güncelleme

Bunlar günlük/haftalık background job olabilir.

En kısa özet
Fal başlat → memory okunur
Follow-up yaz/söyle → memory adayı oluşur, gerekirse memory okunur
Falı bitir → transcript analiz edilir, memory yazılır
Profil oluştur/güncelle → profile memory güncellenir
Eski falı aç → sadece history okunur, memory normalde değişmez
Düzeltme/onay ver → yüksek güvenli memory yazılır
Arka plan job → memory temizlenir, birleştirilir, lore güncellenir

Yani memory’nin ana tetikleyicileri:

Başlat
Sor
Onayla
Düzelt
Bitir
Profil güncelle
Arka plan consolidate