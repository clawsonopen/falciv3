# Ruhbaz Memory Mimarisi

Tarih: 2026-05-28  
V2 referansı: `docs/RUHBaz_MEMORY_ARCHITECTURE_V2.md` dosyası 31 Mayıs öncesi yaklaştığımız geniş "Memory Architecture v2" çizgisini proje içine temiz UTF-8 olarak geri koyar. Bu dosya ise o çizginin Ruhbaz/FALCI uygulama katmanına uyarlanmış mimari notudur.

Amaç: Ruhbaz/FALCI ekosisteminde kullanıcıyı zamanla tanıyan, tekrarları azaltan, persona tutarlılığını bozmayan, 1 GB'a kadar büyüyebilen ve prompta sadece anlamlı kısa bağlam gönderen bütünsel memory mimarisini tanımlamak.

## 1. Ana Ayrım

Bu mimaride üç şey kesinlikle birbirine karıştırılmaz:

```text
Persona Identity = statik yorumcu karakteri
User Semantic Memory = kullanıcıya ait yaşayan hafıza
Persona-User Relationship = seçili personanın bu kullanıcıyla kurduğu dinamik bağ
Lore Wiki = Ruhbaz evrenine ve içerik kaynaklarına ait kullanıcıdan bağımsız bilgi katmanı
```

Persona identity kullanıcı hafızasından türemez. Kullanıcı hafızası da persona identity dosyasını değiştirmez. Prompt builder bu iki katmanı ayrı bloklar halinde birleştirir.

Lore Wiki de kullanıcı memory'sinden ayrıdır. Kullanıcıyı tanımak için değil; Ruhbaz evrenini, persona ailesini, app section kültürünü, developer entry'leri ve social feedlerden curate edilmiş içerikleri taşımak için vardır.

## 2. Sistem Hedefleri

- Kullanıcıyı zamanla tanımak.
- Kullanıcıya "hafızanda gördüm" demeden tanıdık hissettirmek.
- 7 personanın her birinde tutarlı karakter korumak.
- Her persona için kullanıcıyla ayrı ilişki hafızası tutmak.
- Kullanıcının kendi profili ve çevresi için oluşturduğu profilleri anlamlı bağlamda kullanmak.
- Kendini Tanı, doğum haritası, temel numeroloji ve test sonuçlarını kullanıcı essence olarak taşımak.
- Tekrarları ve kalıp cevapları azaltmak.
- Memory 1 GB'a kadar büyüse bile app'i hızlı tutmak.
- LLM token maliyetini online cevap yolunda büyütmemek.
- Memory yönetimini mümkün olduğunca background/scheduled/flex API işleriyle yapmak.

## 2A. Memory Scope Sınırları

Bu bütünsel memory sistemi esas olarak kişisel deneyimler içindir:

```text
Senin Evin
Kendini Tanı
kişisel profil bazlı okumalar
follow-up sohbetleri
persona-user relationship
profile ilişkileri
```

### İkram Masası Genel Falları

İkram Masası altındaki genel fal deneyimleri mevcut halini korur. Kişiye özel “Senin Evin” memory’si bu genel fal promptlarına girmez.

Bu kapsama girenler:

- genel kahve falı
- genel tarot/fal deneyimleri
- kişisel profile bağlı olmayan genel ritüel/yorumlar

Kural:

```text
Genel İkram Masası fallarında kullanıcıya özel Senin Evin memory'si kullanılmaz.
```

Bu ayrım ürün hissi için önemlidir. Genel/ikram deneyimi daha hafif ve herkesin kullanabileceği bir alan olarak kalır; kişisel tanıma ve derin memory hissi “Senin Evin” ve kişisel akışlarda yaşar.

### İkram Masası Genel Astroloji İstisnası

İkram Masası altındaki genel günlük/haftalık/aylık astroloji okumaları tekrar azaltmak için sınırlı bir hafızadan faydalanabilir.

Bu hafıza kişisel Senin Evin memory’si değildir. Ayrı ve hafif bir tekrar/çeşitlilik hafızasıdır.

Kullanılabilecekler:

- güneş burcu
- dönem tipi: günlük / haftalık / aylık
- yakın zamanda aynı güneş burcu için kullanılan genel temalar
- tekrar eden kapanış/tavsiye/kalıp cümleler
- genel astro metinlerinde çeşitlilik ledger'ı

Kullanılmayacaklar:

- kullanıcının kişisel profil memory’si
- kullanıcı-persona relationship memory’si
- doğum haritası/numeroloji/test essence
- özel kişiler, evcil hayvanlar, ilişki profilleri
- Senin Evin follow-up geçmişi

Kural:

```text
İkram Masası genel astroloji, güneş burcu dışında kişisel kullanıcı memory'si kullanmaz.
```

Bu alandaki memory’nin amacı kullanıcıyı kişisel olarak tanımak değil, genel astro içeriklerinin tekrara düşmesini azaltmaktır.

## 3. Katmanlar

```text
Source Archive
  â†“
User Semantic Wiki
  â†“
Knowledge Graph
  â†“
Embedding/Search Index
  â†“
Context Brief Builder
  â†“
Prompt Builder
```

### Source Archive

Ham kaynak katmanı. Prompta doğrudan gitmez.

Kaynaklar:

- kullanıcı mesajları
- okuma sonuçları
- follow-up sohbetleri
- profil form verileri
- kullanıcı düzeltmeleri
- Kendini Tanı test sonuçları
- doğum haritası ve temel numeroloji çıktıları
- persona seçimleri
- sosyal paylaşım seçimleri
- usage ve davranış sinyalleri

Rolü:

- audit
- evidence
- export/delete
- geçmişe dönük reprocessing

### User Semantic Wiki

LLM'in kolay okuyabileceği anlamlı, yaşayan kullanıcı hafızasıdır. Raw chunk değildir.

Wiki sayfaları:

```text
User Overview
Profiles And Relationships
Self Knowledge
User Preferences
Persona Relationships
Reading Memory
Repetition And Variety Ledger
Social And Sharing Memory
Wellness And Lifestyle Memory
```

### Knowledge Graph

Wiki'nin altındaki bağlantılı hafıza haritasıdır. Prompta ham JSON olarak gitmez; context seçmek için kullanılır.

### Embedding/Search Index

Embedding sistemin kalbi değildir; indeks ve arama yardımcısıdır.

Embed edilecek şeyler:

- wiki section summary
- semantic memory item
- graph node label/summary
- reading/session summary

Embed edilmeyecek şeyler:

- raw chunk
- uzun okuma metni
- prompt debug
- giriş/kapanış laf salatası

### Context Brief Builder

Wiki ve graph'tan seçilen bilgiyi prompta gidecek kısa, anlamlı, LLM-readable brief'e dönüştürür.

Bu mekanik karakter kırpma değildir. Anlamsal seçim ve özetleme çıktısıdır.

## 4. Persona Identity Katmanı

Persona identity kullanıcıdan bağımsızdır.

İçerik:

- persona adı
- ana üslup
- ritim
- hitap karakteri
- hangi alanlarda güçlü olduğu
- hangi estetikte konuştuğu
- persona lore özü

İçermemeli:

- sağlık/finans guardrail tekrarları
- kesin gelecek iddiası yasağı gibi ortak güvenlik kuralları
- kullanıcıya özel tercihler
- kullanıcı hafızası
- okuma geçmişi

Örnek:

```text
Selin: modern, rafine, sakin, psikolojik farkındalık odaklıdır. Teknik bilgiyi temiz, kontrollü ve kişisel içgörüye çevirir. Süslemeden, premium ve net bir ton kurar.
```

Bu blok `Global Persona Registry` tarafından sağlanır ve versiyonlanır.

## 4A. Lore Wiki Katmanı

Lore Wiki, User Semantic Memory'den tamamen ayrı bir sistemdir.

Amaç:

- Ruhbaz evreninin kanonik bilgisini tutmak.
- Persona ailesinin kullanıcıdan bağımsız lore'unu taşımak.
- FALCI, wellness, diet, journaling, fashion ve events gibi section'ların kültürünü yönetmek.
- Developer tarafından girilen kalıcı notları ve kuralları saklamak.
- Social feedlerden gelen içerikleri curation sonrası kullanılabilir hale getirmek.
- Uygulamalar arası ortak içerik ve evren bilgisini sağlamak.

Lore Wiki kullanıcı hakkında özel bilgi tutmaz. Kullanıcı tercihi, kullanıcı düzeltmesi, profil ilişkisi veya özel yaşam bilgisi Lore Wiki'ye yazılmaz.

### Lore Wiki Kaynakları

```text
developer_entries
persona_identity_files
persona_lore_notes
social_feed_posts
brand_content
ritual_library
recipe_library
event/news curation
app_section_docs
approved social media drafts
```

### Lore Wiki Sayfaları

```text
Ruhbaz Universe Canon
Persona Family Lore
Section Lore: FALCI
Section Lore: Wellness
Section Lore: Diet
Section Lore: Journaling
Section Lore: Fashion
Section Lore: Events
Social Content Library
Ritual And Symbol Library
Developer Canon Notes
```

### Lore Wiki Node Tipleri

```text
lore_page
persona_lore
section_lore
ritual
recipe
social_post
content_theme
brand_rule
developer_note
canonical_fact
event_source
trend
```

### Lore Wiki Edge Tipleri

```text
part_of_universe
belongs_to_persona
belongs_to_section
inspired_by
supports_tone
safe_to_surface
requires_curation
supersedes
related_to_theme
approved_for_social
```

### User Memory ile İlişkisi

Lore Wiki ve User Semantic Memory ayrı storage/scope kullanır.

Doğru ayrım:

```text
Lore Wiki = evren ve içerik bilgisi
User Semantic Memory = kişisel kullanıcı bilgisi
Persona-User Relationship = bu kullanıcının bu persona ile bağı
```

Prompt builder gerekirse ikisini ayrı brief olarak alır:

```text
LORE_BRIEF:
Selin'in genel tonu modern, rafine ve psikolojik farkındalık odaklıdır. FALCI kişisel astro section'ında teknik bilgiyi sıcak içgörüye çevirir.

USER_MEMORY_BRIEF:
Bu kullanıcı Selin ile devam eden sohbetlerde tekrar selamlama istemez; kısa sosyal mesajlara kısa cevap bekler.
```

Bu iki brief promptta yan yana gelebilir ama kaynakları, storage'ları ve update akışları karıştırılmaz.

### Social Feedlerden Beslenme

Social feedlerden gelen içerikler doğrudan Lore Wiki'ye yazılmaz. Önce curation gerekir.

Akış:

```text
social feed / trend / post
â†’ source capture
â†’ content curation
â†’ relevance and safety check
â†’ developer approval veya trusted workflow
â†’ Lore Wiki social/content node
â†’ embedding/index update
```

Örnek:

```json
{
  "nodeType": "social_post",
  "section": "wellness",
  "summary": "Sabah ritüeli temasında kısa, sıcak ve paylaşılabilir içerik fikri.",
  "source": "curated_social_feed",
  "approvalStatus": "approved",
  "safeToSurface": true
}
```

### Developer Entryler

Developer entryler Lore Wiki'de en güçlü kanonik kaynaklardan biridir.

Örnek:

```json
{
  "nodeType": "developer_note",
  "scope": "global_guardrail",
  "summary": "Ruhbaz personları kullanıcıya görünen metinde kendi adlarını söylemez.",
  "source": "developer_entry",
  "priority": "canonical"
}
```

Developer entry kullanıcı memory'sinin üstüne yazmaz; evren, policy, persona ve section bilgisini belirler.

## 5. Persona-User Relationship Katmanı

Bu katman kullanıcıya özeldir ve her persona için ayrı büyür.

Amaç:

- aynı persona karakterini korurken kullanıcıya özel ayar yapmak
- kullanıcının o persona ile hangi bağlamlarda iyi çalıştığını bilmek
- personanın kullanıcıda fazla gelen/iyi gelen yanlarını öğrenmek

Wiki örneği:

```text
Selin:
- Kullanıcı Selin'i kişisel astroloji ve farkındalık odaklı yorumlarda iyi karşılıyor.
- Modern, sakin, rafine dil iyi çalışıyor.
- Takip sohbetlerinde tekrar selamlama, uzun teknik tekrar ve teşekkürden sonra analiz başlatma kullanıcıyı rahatsız ediyor.
- Kısa sosyal tepkilere kısa, sıcak ve doğal cevap bekliyor.
```

Prompt brief örneği:

```text
Bu kullanıcı Selin tonunda sakin, net ve psikolojik farkındalık odaklı cevapları seviyor. Devam eden sohbetlerde tekrar selamlama yapma; teşekkür/onay mesajlarında yeni analiz başlatma.
```

## 6. Ortak Guardrail Katmanı

Guardrail'ler persona identity içinde tekrar edilmez.

Tek ortak kaynaktan gelir:

```text
PromptGuardrailContract
```

İçerik:

- Türkçe ve doğru karakter
- kendini tanıtmama
- persona adını kullanıcıya görünen metinde söylememe
- kesin gelecek iddiası kurmama
- sağlık/finans spesifik tavsiye vermeme
- ilaç/doz/tedavi/reçete dili kullanmama
- korkutucu felaket dili kullanmama
- kullanıcının sorusunu kendi aklına gelmiş gibi sahiplenmeme
- alan sınırı: astroda kahve/tarot dili kullanmama, tarotda doğum haritası dili kullanmama vb.

Prompt builder bunu persona identity'den ayrı blok olarak ekler.

## 7. Kullanıcı Wiki Sayfaları

### User Overview

Kullanıcının genel essence'ı.

Örnek içerik:

```text
Kullanıcı belirsizlikte sakin ve net cevaplardan fayda görüyor. Fikirleri hızlı büyüyor; geleceğe dönük ürün vizyonlarında erken sezgileri güçlü. Uzun vadeli bağlam kurulmasını önemsiyor.
```

### Profiles And Relationships

Kullanıcının kendisi ve oluşturduğu profiller.

Tutulacak alanlar:

- profil adı
- ilişki tipi
- cinsiyet/hitap hassasiyeti
- doğum bilgisi var mı
- kullanıcıyla ilişki
- bu profil hangi okumalarda kullanılır
- özel sınırlar

Örnek:

```text
Ozan = hesap sahibi / kendi profil.
Boncuk = evcil hayvan; yorumlarda insan kariyeri, romantik ilişki veya para kazanma teması kurulmaz.
```

### Self Knowledge

Kendini Tanı çıktılarından essence.

Kaynaklar:

- doğum haritası yorumu
- temel numeroloji yorumu
- kişilik testleri
- diğer kendini tanı modülleri

Prompta kaynak adıyla göze sokulmaz. Yalnızca yorumcunun kişiyi daha iyi anlamasına yardım eder.

Örnek:

```text
Kullanıcı belirsizlik karşısında kontrol ihtiyacı hissedebiliyor; net, yapılandırılmış ama sıcak cevaplar iyi çalışıyor.
```

### User Preferences

Uygulama ve cevap tercihleri.

Örnek:

```text
Devam eden sohbetlerde tekrar selamlama istemez. Teşekkür/onay gibi mesajlara kısa ve doğal cevap bekler. Follow-up cevapları son mesaja bağlı olmalı; önceki ana yorum gereksiz yere tekrar edilmemeli.
```

### Persona Relationships

Kullanıcının her persona ile ilişkisi.

Her persona için ayrı section:

```text
Selin
Arin
Teoman
Ayşe
Berk
Deniz
Suzan
```

Her section:

- iyi çalıştığı domainler
- kullanıcıdan gelen olumlu sinyaller
- kullanıcıdan gelen düzeltmeler
- fazla gelen tonlar
- persona-specific hitap tercihi
- repetition uyarıları

### Reading Memory

Okuma geçmişinin semantic özeti.

Her okuma için:

- reading id
- reading type
- profile
- persona
- ana tema
- teknik/ritüel dayanak
- kullanıcı follow-up'ları
- session summary
- ileride tekrar edilmemesi gereken yüzey ifadeleri
- ileride işe yarayabilecek yeni açı

### Repetition And Variety Ledger

Tekrarı azaltmak için tutulur.

İzlenecekler:

- kullanılan temalar
- kullanılan tavsiyeler
- kapanış cümleleri
- hitaplar
- metaforlar
- teknik açıklamalar
- persona bazlı tekrarlar
- okuma türü bazlı tekrarlar

Prompta negatif liste olarak gitmez. Context selector bunu filtre olarak kullanır.

Prompta gidecek pozitif yönlendirme:

```text
Son soruya yeni açıdan cevap ver; önceki açıklamayı tekrar etmeden kısa ve somut ilerle.
```

### Social And Sharing Memory

Kullanıcının paylaşım estetiği ve izinleri.

İçerik:

- paylaşmayı sevdiği okuma türleri
- görsel stil tercihleri
- caption tonu
- anonimlik isteği
- Instagram/story/reel format tercihi
- otomatik paylaşım izinleri

## 8. Knowledge Graph Şeması

### Node Tipleri

```text
user
profile
relationship
persona
app_section
reading
session
self_knowledge_result
topic
preference
correction
person
pet
place
event
emotion
ritual
recipe
content_asset
memory_page
wiki_section
```

### Edge Tipleri

```text
has_profile
relationship_to
prefers
dislikes
cares_about
often_asks_about
corrected
contradicts
supports
related_to
mentioned_in
derived_from
belongs_to
uses_persona_for
trusts_persona_for
responds_well_to
wants_less_of
wants_more_of
overused_recently
should_surface_when_relevant
should_not_surface_unless_relevant
updated_by
supersedes
```

### Edge Alanları

```json
{
  "edgeId": "edge:user:ozan:prefers:chat_followups",
  "from": "user:ozan",
  "type": "prefers",
  "to": "preference:chat_like_followups",
  "context": "all_followups",
  "confidence": 0.99,
  "sourceStrength": "user_stated",
  "evidenceRef": "raw_event:...",
  "active": true,
  "createdAt": "2026-05-28T00:00:00.000Z",
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

## 9. Source Strength

Her memory ve edge aynı ağırlıkta değildir.

Öncelik:

```text
user_corrected
user_stated
profile_data
self_knowledge_result
behavior_observed
session_summary
reading_derived
system_inferred
```

Kurallar:

- `user_corrected` eski bilgiyi supersede edebilir.
- `user_stated` yüksek güvenilirliktir.
- `profile_data` hitap ve profil kaymasını önlemek için core bağlamdır.
- `self_knowledge_result` essence olarak kullanılır, kaynak adıyla gösterilmez.
- `reading_derived` zayıf sinyaldir; kullanıcı gerçeği gibi davranmaz.
- `system_inferred` promptta çok dikkatli kullanılır.

## 10. Memory Writer

Memory writer görünmez sistem ajanıdır. Persona değildir. Kullanıcıya konuşmaz.

Görevi:

- wiki edit proposal üretmek
- graph edit proposal üretmek
- source strength atamak
- promptUse atamak
- confidence atamak
- evidence refs bağlamak
- repetition fingerprint çıkarmak

Akış:

```text
Raw event
â†’ Memory relevance gate
â†’ Wiki/Graph Editor LLM
â†’ Schema validation
â†’ Conflict/supersede check
â†’ Store updates
â†’ Embedding index update
â†’ Audit log
```

Örnek çıktı:

```json
{
  "wikiEdits": [
    {
      "page": "User Preferences",
      "section": "Follow-up behavior",
      "operation": "update",
      "text": "Kullanıcı devam eden sohbetlerde tekrar selamlama istemiyor; teşekkür/onay mesajlarında kısa ve doğal cevap bekliyor.",
      "importance": "high",
      "promptUse": "core"
    }
  ],
  "graphEdits": [
    {
      "operation": "upsert_node",
      "nodeId": "preference:chat_like_followups",
      "nodeType": "preference",
      "label": "Chat gibi follow-up"
    },
    {
      "operation": "upsert_edge",
      "from": "user:ozan",
      "type": "prefers",
      "to": "preference:chat_like_followups",
      "context": "all_followups",
      "confidence": 0.99,
      "sourceStrength": "user_stated"
    }
  ]
}
```

## 11. Context Brief Builder

Prompta gitmeden önce çalışır.

Input:

- son kullanıcı mesajı
- aktif app section
- seçili profile
- seçili persona
- okuma türü
- session state
- wiki pages
- graph relations
- repetition ledger

Output:

LLM'in kolay decode edeceği kısa bağlam.

Örnek:

```text
Ozan kendi profili için kişisel astro takip sorusu soruyor. Devam eden sohbetlerde tekrar selamlama istemez; teşekkür/onay mesajlarına kısa doğal cevap bekler. Selin bu kullanıcıda sakin, net ve psikolojik farkındalık tonu ile iyi çalışır. Bu oturumda beklenmedik gelişmelerden korkma teması işlendi; aynı açıklamayı tekrar etme, son soruya yeni ve kısa açıdan cevap ver.
```

Bu brief, 1 GB memory olsa bile birkaç yüz tokenı geçmemelidir.

## 12. Prompt Builder Blokları

Prompt builder şu blokları ayrı tutar:

```text
SYSTEM_GUARDRAILS
PERSONA_IDENTITY
LORE_BRIEF
USER_PERSONA_RELATIONSHIP
PROFILE_CONTEXT
ACTIVE_READING_CONTEXT
USER_MEMORY_BRIEF
REPETITION_VARIETY_BRIEF
TASK_INSTRUCTION
USER_MESSAGE
```

Örnek:

```text
SYSTEM_GUARDRAILS:
Ortak güvenlik ve alan kuralları.

PERSONA_IDENTITY:
Selin: modern, rafine, sakin, psikolojik farkındalık odaklı...

LORE_BRIEF:
FALCI kişisel astro section'ında persona sesi yalnızca üslup için taşınır; cevap astro bağlamında kalır.

USER_PERSONA_RELATIONSHIP:
Bu kullanıcı Selin tonunda tekrar selamlama istemez; kısa ve doğal follow-up bekler.

PROFILE_CONTEXT:
Ozan hesap sahibinin kendi profili; sen dili kullanılmalı.

ACTIVE_READING_CONTEXT:
Kişisel astro daily session; önceki follow-up beklenmedik gelişmelerden korkma temasındaydı.

USER_MEMORY_BRIEF:
Kullanıcı belirsizlikte net ve sakin cevaplardan fayda görüyor.

REPETITION_VARIETY_BRIEF:
Önceki Venüs/Satürn açıklamasını tekrar etme; son soruya yeni açıdan cevap ver.

TASK_INSTRUCTION:
Son mesaja göre cevap ver.

USER_MESSAGE:
Teşekkürler.
```

## 13. Storage ve 1 GB Stratejisi

Memory sıcak/ılık/soğuk katmanlara ayrılır.

```text
Hot Memory = prompta yakın, hızlı erişilen özetler
Warm Memory = wiki, graph, embeddings
Cold Memory = raw archive
```

### Hot Memory

- user overview brief
- aktif profil brief
- aktif persona-user relationship brief
- son session summary
- son kritik tercih/düzeltmeler
- son repetition ledger özeti

### Warm Memory

- wiki pages
- graph nodes/edges
- semantic item index
- embeddings
- reading/session summaries

### Cold Memory

- raw events
- eski okuma metinleri
- uzun sohbetler
- audit kaynakları

Online follow-up sırasında Cold Memory'ye gidilmez.

## 14. SQLite Tablo Taslağı

```text
raw_events
wiki_pages
wiki_sections
graph_nodes
graph_edges
semantic_items
embeddings
reading_summaries
session_summaries
reading_fingerprints
persona_relationships
memory_jobs
memory_audit
lore_pages
lore_nodes
lore_edges
lore_sources
lore_curation_jobs
```

Örnek `wiki_sections`:

```text
id
user_id
profile_id
page_key
section_key
title
body
importance
prompt_use
source_strength
updated_at
embedding_ref
metadata_json
```

Örnek `persona_relationships`:

```text
id
user_id
persona_id
domain
summary
works_well_for_json
wants_less_of_json
wants_more_of_json
trust_score
updated_at
embedding_ref
```

Örnek `reading_fingerprints`:

```text
id
reading_id
user_id
profile_id
persona_id
reading_type
themes_json
techniques_json
advice_json
phrases_json
closings_json
emotional_arc
created_at
```

## 15. Scheduled Jobs

Online cevap yolunda pahalı memory işi yapılmaz.

Job listesi:

```text
after_reading_summary_job
after_session_summary_job
memory_extraction_job
wiki_refinement_job
graph_consistency_job
embedding_backfill_job
repetition_cleanup_job
stale_memory_decay_job
persona_relationship_synthesis_job
weekly_user_model_synthesis_job
privacy_export_cleanup_job
lore_social_feed_ingestion_job
lore_curation_review_job
lore_embedding_backfill_job
```

LLM gereken işler mümkünse scheduled/flex/batch API ile yapılır.

## 16. Online Cevap Akışı

Follow-up geldiğinde:

```text
1. Son mesaj intent hızlı belirlenir.
2. Aktif profile/persona/session alınır.
3. Hot memory okunur.
4. Graph ve embedding ile birkaç warm aday seçilir.
5. Context Brief Builder kısa brief üretir.
6. Prompt Builder blokları birleştirir.
7. LLM cevap üretir.
8. Raw event kaydedilir.
9. Memory update background queue'ya atılır.
```

Kritik kural:

```text
Kullanıcı cevabı beklerken 1 GB memory taranmaz ve LLM'e büyük memory gönderilmez.
```

## 17. Caveman Brief Formatı

Caveman sıkıştırma memory'nin kaynağı değil, prompta giden final brief formatlarından biridir.

Örnek:

```text
USER=Ozan/self. PROFILE_MODE=sen dili. PERSONA=Selin/static modern calm psych-aware. USER_PERSONA=likes calm direct chat; no repeated greeting; no re-analysis after thanks. SESSION=personal astro daily; fear of unexpected changes discussed. VARIETY=do not repeat same Venus/Saturn explanation unless asked. PRIORITY=last user message.
```

Bu format:

- kısa
- anlamlı
- LLM-readable
- deterministic kırpma değil
- wiki/graph context seçiminden türemiş

## 18. Uygulama Yol Haritası

### Faz 1: Şema ve Ayrım

- Persona identity registry ve guardrail contract ayrılır.
- User semantic wiki page schema eklenir.
- Lore wiki user memory'den ayrı scope olarak tanımlanır.
- Persona-user relationship schema eklenir.
- Raw chunk prompt pack'ten çıkarılır.

### Faz 2: Memory Writer MVP

- Kullanıcı düzeltmeleri ve tercihleri wiki/graph'a yazılır.
- Profile relationships graph'a yazılır.
- Kendini Tanı essence wiki'ye yazılır.
- Reading summary ve fingerprint çıkarılır.

### Faz 3: Context Brief Builder

- Aktif profile/persona/session için brief üretir.
- Persona identity ve user-persona relationship ayrı prompt blokları olur.
- Repetition ledger prompta negatif liste olarak değil, pozitif çeşitlilik brief'i olarak yansır.

### Faz 4: Local Embedding Index

- Semantic wiki section ve memory item embed edilir.
- Raw chunk embed edilmez.
- Retrieval hızlı ve lokal hale gelir.

### Faz 5: Scheduled Memory Management

- Wiki refinement
- graph consistency
- persona relationship synthesis
- weekly user model synthesis
- repetition cleanup

### Faz 6: External Tool/Agent Hazırlığı

- Aynı memory core app assistant, Gemini, ChatGPT, Claude, MCP adapter tarafından kullanılabilir.
- UI bağımsız tool/action layer ile entegre edilir.

### Faz 7: Lore Content Ops

- Developer entry formatı eklenir.
- Social feed ingestion queue kurulur.
- Curation ve approval flow eklenir.
- Onaylı içerikler Lore Wiki'ye yazılır.
- Lore brief, prompt builder'a user memory brief'ten ayrı blok olarak bağlanır.

## 19. Ürün Hissi

Kullanıcı şunu görmemeli:

```text
Hafızanda gördüğüme göre...
Önceki okumanda...
Profilinde...
```

Kullanıcı şunu hissetmeli:

```text
Bu yorumcu beni tanıyor.
Bu persona ailesi beni yavaş yavaş öğreniyor.
Aynı şeyleri tekrar etmiyor.
Benim sevdiğim tonu biliyor.
Benim çevremi ve profillerimi karıştırmıyor.
Beni gözüme sokmadan hatırlıyor.
```

Bu mimarinin ana amacı budur.
