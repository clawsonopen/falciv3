# Ruhbaz Memory Mimarisi

Tarih: 2026-05-28  
AmaÃ§: Ruhbaz/FALCI ekosisteminde kullanÄ±cÄ±yÄ± zamanla tanÄ±yan, tekrarlarÄ± azaltan, persona tutarlÄ±lÄ±ÄŸÄ±nÄ± bozmayan, 1 GB'a kadar bÃ¼yÃ¼yebilen ve prompta sadece anlamlÄ± kÄ±sa baÄŸlam gÃ¶nderen bÃ¼tÃ¼nsel memory mimarisini tanÄ±mlamak.

## 1. Ana AyrÄ±m

Bu mimaride Ã¼Ã§ ÅŸey kesinlikle birbirine karÄ±ÅŸtÄ±rÄ±lmaz:

```text
Persona Identity = statik yorumcu karakteri
User Semantic Memory = kullanÄ±cÄ±ya ait yaÅŸayan hafÄ±za
Persona-User Relationship = seÃ§ili personanÄ±n bu kullanÄ±cÄ±yla kurduÄŸu dinamik baÄŸ
Lore Wiki = Ruhbaz evrenine ve iÃ§erik kaynaklarÄ±na ait kullanÄ±cÄ±dan baÄŸÄ±msÄ±z bilgi katmanÄ±
```

Persona identity kullanÄ±cÄ± hafÄ±zasÄ±ndan tÃ¼remez. KullanÄ±cÄ± hafÄ±zasÄ± da persona identity dosyasÄ±nÄ± deÄŸiÅŸtirmez. Prompt builder bu iki katmanÄ± ayrÄ± bloklar halinde birleÅŸtirir.

Lore Wiki de kullanÄ±cÄ± memory'sinden ayrÄ±dÄ±r. KullanÄ±cÄ±yÄ± tanÄ±mak iÃ§in deÄŸil; Ruhbaz evrenini, persona ailesini, app section kÃ¼ltÃ¼rÃ¼nÃ¼, developer entry'leri ve social feedlerden curate edilmiÅŸ iÃ§erikleri taÅŸÄ±mak iÃ§in vardÄ±r.

## 2. Sistem Hedefleri

- KullanÄ±cÄ±yÄ± zamanla tanÄ±mak.
- KullanÄ±cÄ±ya "hafÄ±zanda gÃ¶rdÃ¼m" demeden tanÄ±dÄ±k hissettirmek.
- 7 personanÄ±n her birinde tutarlÄ± karakter korumak.
- Her persona iÃ§in kullanÄ±cÄ±yla ayrÄ± iliÅŸki hafÄ±zasÄ± tutmak.
- KullanÄ±cÄ±nÄ±n kendi profili ve Ã§evresi iÃ§in oluÅŸturduÄŸu profilleri anlamlÄ± baÄŸlamda kullanmak.
- Kendini TanÄ±, doÄŸum haritasÄ±, temel numeroloji ve test sonuÃ§larÄ±nÄ± kullanÄ±cÄ± essence olarak taÅŸÄ±mak.
- TekrarlarÄ± ve kalÄ±p cevaplarÄ± azaltmak.
- Memory 1 GB'a kadar bÃ¼yÃ¼se bile app'i hÄ±zlÄ± tutmak.
- LLM token maliyetini online cevap yolunda bÃ¼yÃ¼tmemek.
- Memory yÃ¶netimini mÃ¼mkÃ¼n olduÄŸunca background/scheduled/flex API iÅŸleriyle yapmak.

## 2A. Memory Scope SÄ±nÄ±rlarÄ±

Bu bÃ¼tÃ¼nsel memory sistemi esas olarak kiÅŸisel deneyimler iÃ§indir:

```text
Senin Evin
Kendini TanÄ±
kiÅŸisel profil bazlÄ± okumalar
follow-up sohbetleri
persona-user relationship
profile iliÅŸkileri
```

### Ä°kram MasasÄ± Genel FallarÄ±

Ä°kram MasasÄ± altÄ±ndaki genel fal deneyimleri mevcut halini korur. KiÅŸiye Ã¶zel â€œSenin Evinâ€ memoryâ€™si bu genel fal promptlarÄ±na girmez.

Bu kapsama girenler:

- genel kahve falÄ±
- genel tarot/fal deneyimleri
- kiÅŸisel profile baÄŸlÄ± olmayan genel ritÃ¼el/yorumlar

Kural:

```text
Genel Ä°kram MasasÄ± fallarÄ±nda kullanÄ±cÄ±ya Ã¶zel Senin Evin memory'si kullanÄ±lmaz.
```

Bu ayrÄ±m Ã¼rÃ¼n hissi iÃ§in Ã¶nemlidir. Genel/ikram deneyimi daha hafif ve herkesin kullanabileceÄŸi bir alan olarak kalÄ±r; kiÅŸisel tanÄ±ma ve derin memory hissi â€œSenin Evinâ€ ve kiÅŸisel akÄ±ÅŸlarda yaÅŸar.

### Ä°kram MasasÄ± Genel Astroloji Ä°stisnasÄ±

Ä°kram MasasÄ± altÄ±ndaki genel gÃ¼nlÃ¼k/haftalÄ±k/aylÄ±k astroloji okumalarÄ± tekrar azaltmak iÃ§in sÄ±nÄ±rlÄ± bir hafÄ±zadan faydalanabilir.

Bu hafÄ±za kiÅŸisel Senin Evin memoryâ€™si deÄŸildir. AyrÄ± ve hafif bir tekrar/Ã§eÅŸitlilik hafÄ±zasÄ±dÄ±r.

KullanÄ±labilecekler:

- gÃ¼neÅŸ burcu
- dÃ¶nem tipi: gÃ¼nlÃ¼k / haftalÄ±k / aylÄ±k
- yakÄ±n zamanda aynÄ± gÃ¼neÅŸ burcu iÃ§in kullanÄ±lan genel temalar
- tekrar eden kapanÄ±ÅŸ/tavsiye/kalÄ±p cÃ¼mleler
- genel astro metinlerinde Ã§eÅŸitlilik ledger'Ä±

KullanÄ±lmayacaklar:

- kullanÄ±cÄ±nÄ±n kiÅŸisel profil memoryâ€™si
- kullanÄ±cÄ±-persona relationship memoryâ€™si
- doÄŸum haritasÄ±/numeroloji/test essence
- Ã¶zel kiÅŸiler, evcil hayvanlar, iliÅŸki profilleri
- Senin Evin follow-up geÃ§miÅŸi

Kural:

```text
Ä°kram MasasÄ± genel astroloji, gÃ¼neÅŸ burcu dÄ±ÅŸÄ±nda kiÅŸisel kullanÄ±cÄ± memory'si kullanmaz.
```

Bu alandaki memoryâ€™nin amacÄ± kullanÄ±cÄ±yÄ± kiÅŸisel olarak tanÄ±mak deÄŸil, genel astro iÃ§eriklerinin tekrara dÃ¼ÅŸmesini azaltmaktÄ±r.

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

Ham kaynak katmanÄ±. Prompta doÄŸrudan gitmez.

Kaynaklar:

- kullanÄ±cÄ± mesajlarÄ±
- okuma sonuÃ§larÄ±
- follow-up sohbetleri
- profil form verileri
- kullanÄ±cÄ± dÃ¼zeltmeleri
- Kendini TanÄ± test sonuÃ§larÄ±
- doÄŸum haritasÄ± ve temel numeroloji Ã§Ä±ktÄ±larÄ±
- persona seÃ§imleri
- sosyal paylaÅŸÄ±m seÃ§imleri
- usage ve davranÄ±ÅŸ sinyalleri

RolÃ¼:

- audit
- evidence
- export/delete
- geÃ§miÅŸe dÃ¶nÃ¼k reprocessing

### User Semantic Wiki

LLM'in kolay okuyabileceÄŸi anlamlÄ±, yaÅŸayan kullanÄ±cÄ± hafÄ±zasÄ±dÄ±r. Raw chunk deÄŸildir.

Wiki sayfalarÄ±:

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

Wiki'nin altÄ±ndaki baÄŸlantÄ±lÄ± hafÄ±za haritasÄ±dÄ±r. Prompta ham JSON olarak gitmez; context seÃ§mek iÃ§in kullanÄ±lÄ±r.

### Embedding/Search Index

Embedding sistemin kalbi deÄŸildir; indeks ve arama yardÄ±mcÄ±sÄ±dÄ±r.

Embed edilecek ÅŸeyler:

- wiki section summary
- semantic memory item
- graph node label/summary
- reading/session summary

Embed edilmeyecek ÅŸeyler:

- raw chunk
- uzun okuma metni
- prompt debug
- giriÅŸ/kapanÄ±ÅŸ laf salatasÄ±

### Context Brief Builder

Wiki ve graph'tan seÃ§ilen bilgiyi prompta gidecek kÄ±sa, anlamlÄ±, LLM-readable brief'e dÃ¶nÃ¼ÅŸtÃ¼rÃ¼r.

Bu mekanik karakter kÄ±rpma deÄŸildir. Anlamsal seÃ§im ve Ã¶zetleme Ã§Ä±ktÄ±sÄ±dÄ±r.

## 4. Persona Identity KatmanÄ±

Persona identity kullanÄ±cÄ±dan baÄŸÄ±msÄ±zdÄ±r.

Ä°Ã§erik:

- persona adÄ±
- ana Ã¼slup
- ritim
- hitap karakteri
- hangi alanlarda gÃ¼Ã§lÃ¼ olduÄŸu
- hangi estetikte konuÅŸtuÄŸu
- persona lore Ã¶zÃ¼

Ä°Ã§ermemeli:

- saÄŸlÄ±k/finans guardrail tekrarlarÄ±
- kesin gelecek iddiasÄ± yasaÄŸÄ± gibi ortak gÃ¼venlik kurallarÄ±
- kullanÄ±cÄ±ya Ã¶zel tercihler
- kullanÄ±cÄ± hafÄ±zasÄ±
- okuma geÃ§miÅŸi

Ã–rnek:

```text
Selin: modern, rafine, sakin, psikolojik farkÄ±ndalÄ±k odaklÄ±dÄ±r. Teknik bilgiyi temiz, kontrollÃ¼ ve kiÅŸisel iÃ§gÃ¶rÃ¼ye Ã§evirir. SÃ¼slemeden, premium ve net bir ton kurar.
```

Bu blok `Global Persona Registry` tarafÄ±ndan saÄŸlanÄ±r ve versiyonlanÄ±r.

## 4A. Lore Wiki KatmanÄ±

Lore Wiki, User Semantic Memory'den tamamen ayrÄ± bir sistemdir.

AmaÃ§:

- Ruhbaz evreninin kanonik bilgisini tutmak.
- Persona ailesinin kullanÄ±cÄ±dan baÄŸÄ±msÄ±z lore'unu taÅŸÄ±mak.
- FALCI, wellness, diet, journaling, fashion ve events gibi section'larÄ±n kÃ¼ltÃ¼rÃ¼nÃ¼ yÃ¶netmek.
- Developer tarafÄ±ndan girilen kalÄ±cÄ± notlarÄ± ve kurallarÄ± saklamak.
- Social feedlerden gelen iÃ§erikleri curation sonrasÄ± kullanÄ±labilir hale getirmek.
- Uygulamalar arasÄ± ortak iÃ§erik ve evren bilgisini saÄŸlamak.

Lore Wiki kullanÄ±cÄ± hakkÄ±nda Ã¶zel bilgi tutmaz. KullanÄ±cÄ± tercihi, kullanÄ±cÄ± dÃ¼zeltmesi, profil iliÅŸkisi veya Ã¶zel yaÅŸam bilgisi Lore Wiki'ye yazÄ±lmaz.

### Lore Wiki KaynaklarÄ±

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

### Lore Wiki SayfalarÄ±

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

### User Memory ile Ä°liÅŸkisi

Lore Wiki ve User Semantic Memory ayrÄ± storage/scope kullanÄ±r.

DoÄŸru ayrÄ±m:

```text
Lore Wiki = evren ve iÃ§erik bilgisi
User Semantic Memory = kiÅŸisel kullanÄ±cÄ± bilgisi
Persona-User Relationship = bu kullanÄ±cÄ±nÄ±n bu persona ile baÄŸÄ±
```

Prompt builder gerekirse ikisini ayrÄ± brief olarak alÄ±r:

```text
LORE_BRIEF:
Selin'in genel tonu modern, rafine ve psikolojik farkÄ±ndalÄ±k odaklÄ±dÄ±r. FALCI kiÅŸisel astro section'Ä±nda teknik bilgiyi sÄ±cak iÃ§gÃ¶rÃ¼ye Ã§evirir.

USER_MEMORY_BRIEF:
Bu kullanÄ±cÄ± Selin ile devam eden sohbetlerde tekrar selamlama istemez; kÄ±sa sosyal mesajlara kÄ±sa cevap bekler.
```

Bu iki brief promptta yan yana gelebilir ama kaynaklarÄ±, storage'larÄ± ve update akÄ±ÅŸlarÄ± karÄ±ÅŸtÄ±rÄ±lmaz.

### Social Feedlerden Beslenme

Social feedlerden gelen iÃ§erikler doÄŸrudan Lore Wiki'ye yazÄ±lmaz. Ã–nce curation gerekir.

AkÄ±ÅŸ:

```text
social feed / trend / post
â†’ source capture
â†’ content curation
â†’ relevance and safety check
â†’ developer approval veya trusted workflow
â†’ Lore Wiki social/content node
â†’ embedding/index update
```

Ã–rnek:

```json
{
  "nodeType": "social_post",
  "section": "wellness",
  "summary": "Sabah ritÃ¼eli temasÄ±nda kÄ±sa, sÄ±cak ve paylaÅŸÄ±labilir iÃ§erik fikri.",
  "source": "curated_social_feed",
  "approvalStatus": "approved",
  "safeToSurface": true
}
```

### Developer Entryler

Developer entryler Lore Wiki'de en gÃ¼Ã§lÃ¼ kanonik kaynaklardan biridir.

Ã–rnek:

```json
{
  "nodeType": "developer_note",
  "scope": "global_guardrail",
  "summary": "Ruhbaz personlarÄ± kullanÄ±cÄ±ya gÃ¶rÃ¼nen metinde kendi adlarÄ±nÄ± sÃ¶ylemez.",
  "source": "developer_entry",
  "priority": "canonical"
}
```

Developer entry kullanÄ±cÄ± memory'sinin Ã¼stÃ¼ne yazmaz; evren, policy, persona ve section bilgisini belirler.

## 5. Persona-User Relationship KatmanÄ±

Bu katman kullanÄ±cÄ±ya Ã¶zeldir ve her persona iÃ§in ayrÄ± bÃ¼yÃ¼r.

AmaÃ§:

- aynÄ± persona karakterini korurken kullanÄ±cÄ±ya Ã¶zel ayar yapmak
- kullanÄ±cÄ±nÄ±n o persona ile hangi baÄŸlamlarda iyi Ã§alÄ±ÅŸtÄ±ÄŸÄ±nÄ± bilmek
- personanÄ±n kullanÄ±cÄ±da fazla gelen/iyi gelen yanlarÄ±nÄ± Ã¶ÄŸrenmek

Wiki Ã¶rneÄŸi:

```text
Selin:
- KullanÄ±cÄ± Selin'i kiÅŸisel astroloji ve farkÄ±ndalÄ±k odaklÄ± yorumlarda iyi karÅŸÄ±lÄ±yor.
- Modern, sakin, rafine dil iyi Ã§alÄ±ÅŸÄ±yor.
- Takip sohbetlerinde tekrar selamlama, uzun teknik tekrar ve teÅŸekkÃ¼rden sonra analiz baÅŸlatma kullanÄ±cÄ±yÄ± rahatsÄ±z ediyor.
- KÄ±sa sosyal tepkilere kÄ±sa, sÄ±cak ve doÄŸal cevap bekliyor.
```

Prompt brief Ã¶rneÄŸi:

```text
Bu kullanÄ±cÄ± Selin tonunda sakin, net ve psikolojik farkÄ±ndalÄ±k odaklÄ± cevaplarÄ± seviyor. Devam eden sohbetlerde tekrar selamlama yapma; teÅŸekkÃ¼r/onay mesajlarÄ±nda yeni analiz baÅŸlatma.
```

## 6. Ortak Guardrail KatmanÄ±

Guardrail'ler persona identity iÃ§inde tekrar edilmez.

Tek ortak kaynaktan gelir:

```text
PromptGuardrailContract
```

Ä°Ã§erik:

- TÃ¼rkÃ§e ve doÄŸru karakter
- kendini tanÄ±tmama
- persona adÄ±nÄ± kullanÄ±cÄ±ya gÃ¶rÃ¼nen metinde sÃ¶ylememe
- kesin gelecek iddiasÄ± kurmama
- saÄŸlÄ±k/finans spesifik tavsiye vermeme
- ilaÃ§/doz/tedavi/reÃ§ete dili kullanmama
- korkutucu felaket dili kullanmama
- kullanÄ±cÄ±nÄ±n sorusunu kendi aklÄ±na gelmiÅŸ gibi sahiplenmeme
- alan sÄ±nÄ±rÄ±: astroda kahve/tarot dili kullanmama, tarotda doÄŸum haritasÄ± dili kullanmama vb.

Prompt builder bunu persona identity'den ayrÄ± blok olarak ekler.

## 7. KullanÄ±cÄ± Wiki SayfalarÄ±

### User Overview

KullanÄ±cÄ±nÄ±n genel essence'Ä±.

Ã–rnek iÃ§erik:

```text
KullanÄ±cÄ± belirsizlikte sakin ve net cevaplardan fayda gÃ¶rÃ¼yor. Fikirleri hÄ±zlÄ± bÃ¼yÃ¼yor; geleceÄŸe dÃ¶nÃ¼k Ã¼rÃ¼n vizyonlarÄ±nda erken sezgileri gÃ¼Ã§lÃ¼. Uzun vadeli baÄŸlam kurulmasÄ±nÄ± Ã¶nemsiyor.
```

### Profiles And Relationships

KullanÄ±cÄ±nÄ±n kendisi ve oluÅŸturduÄŸu profiller.

Tutulacak alanlar:

- profil adÄ±
- iliÅŸki tipi
- cinsiyet/hitap hassasiyeti
- doÄŸum bilgisi var mÄ±
- kullanÄ±cÄ±yla iliÅŸki
- bu profil hangi okumalarda kullanÄ±lÄ±r
- Ã¶zel sÄ±nÄ±rlar

Ã–rnek:

```text
Ozan = hesap sahibi / kendi profil.
Boncuk = evcil hayvan; yorumlarda insan kariyeri, romantik iliÅŸki veya para kazanma temasÄ± kurulmaz.
```

### Self Knowledge

Kendini TanÄ± Ã§Ä±ktÄ±larÄ±ndan essence.

Kaynaklar:

- doÄŸum haritasÄ± yorumu
- temel numeroloji yorumu
- kiÅŸilik testleri
- diÄŸer kendini tanÄ± modÃ¼lleri

Prompta kaynak adÄ±yla gÃ¶ze sokulmaz. YalnÄ±zca yorumcunun kiÅŸiyi daha iyi anlamasÄ±na yardÄ±m eder.

Ã–rnek:

```text
KullanÄ±cÄ± belirsizlik karÅŸÄ±sÄ±nda kontrol ihtiyacÄ± hissedebiliyor; net, yapÄ±landÄ±rÄ±lmÄ±ÅŸ ama sÄ±cak cevaplar iyi Ã§alÄ±ÅŸÄ±yor.
```

### User Preferences

Uygulama ve cevap tercihleri.

Ã–rnek:

```text
Devam eden sohbetlerde tekrar selamlama istemez. TeÅŸekkÃ¼r/onay gibi mesajlara kÄ±sa ve doÄŸal cevap bekler. Follow-up cevaplarÄ± son mesaja baÄŸlÄ± olmalÄ±; Ã¶nceki ana yorum gereksiz yere tekrar edilmemeli.
```

### Persona Relationships

KullanÄ±cÄ±nÄ±n her persona ile iliÅŸkisi.

Her persona iÃ§in ayrÄ± section:

```text
Selin
Arin
Teoman
AyÅŸe
Berk
Deniz
Suzan
```

Her section:

- iyi Ã§alÄ±ÅŸtÄ±ÄŸÄ± domainler
- kullanÄ±cÄ±dan gelen olumlu sinyaller
- kullanÄ±cÄ±dan gelen dÃ¼zeltmeler
- fazla gelen tonlar
- persona-specific hitap tercihi
- repetition uyarÄ±larÄ±

### Reading Memory

Okuma geÃ§miÅŸinin semantic Ã¶zeti.

Her okuma iÃ§in:

- reading id
- reading type
- profile
- persona
- ana tema
- teknik/ritÃ¼el dayanak
- kullanÄ±cÄ± follow-up'larÄ±
- session summary
- ileride tekrar edilmemesi gereken yÃ¼zey ifadeleri
- ileride iÅŸe yarayabilecek yeni aÃ§Ä±

### Repetition And Variety Ledger

TekrarÄ± azaltmak iÃ§in tutulur.

Ä°zlenecekler:

- kullanÄ±lan temalar
- kullanÄ±lan tavsiyeler
- kapanÄ±ÅŸ cÃ¼mleleri
- hitaplar
- metaforlar
- teknik aÃ§Ä±klamalar
- persona bazlÄ± tekrarlar
- okuma tÃ¼rÃ¼ bazlÄ± tekrarlar

Prompta negatif liste olarak gitmez. Context selector bunu filtre olarak kullanÄ±r.

Prompta gidecek pozitif yÃ¶nlendirme:

```text
Son soruya yeni aÃ§Ä±dan cevap ver; Ã¶nceki aÃ§Ä±klamayÄ± tekrar etmeden kÄ±sa ve somut ilerle.
```

### Social And Sharing Memory

KullanÄ±cÄ±nÄ±n paylaÅŸÄ±m estetiÄŸi ve izinleri.

Ä°Ã§erik:

- paylaÅŸmayÄ± sevdiÄŸi okuma tÃ¼rleri
- gÃ¶rsel stil tercihleri
- caption tonu
- anonimlik isteÄŸi
- Instagram/story/reel format tercihi
- otomatik paylaÅŸÄ±m izinleri

## 8. Knowledge Graph ÅžemasÄ±

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

### Edge AlanlarÄ±

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

Her memory ve edge aynÄ± aÄŸÄ±rlÄ±kta deÄŸildir.

Ã–ncelik:

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
- `user_stated` yÃ¼ksek gÃ¼venilirliktir.
- `profile_data` hitap ve profil kaymasÄ±nÄ± Ã¶nlemek iÃ§in core baÄŸlamdÄ±r.
- `self_knowledge_result` essence olarak kullanÄ±lÄ±r, kaynak adÄ±yla gÃ¶sterilmez.
- `reading_derived` zayÄ±f sinyaldir; kullanÄ±cÄ± gerÃ§eÄŸi gibi davranmaz.
- `system_inferred` promptta Ã§ok dikkatli kullanÄ±lÄ±r.

## 10. Memory Writer

Memory writer gÃ¶rÃ¼nmez sistem ajanÄ±dÄ±r. Persona deÄŸildir. KullanÄ±cÄ±ya konuÅŸmaz.

GÃ¶revi:

- wiki edit proposal Ã¼retmek
- graph edit proposal Ã¼retmek
- source strength atamak
- promptUse atamak
- confidence atamak
- evidence refs baÄŸlamak
- repetition fingerprint Ã§Ä±karmak

AkÄ±ÅŸ:

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

Ã–rnek Ã§Ä±ktÄ±:

```json
{
  "wikiEdits": [
    {
      "page": "User Preferences",
      "section": "Follow-up behavior",
      "operation": "update",
      "text": "KullanÄ±cÄ± devam eden sohbetlerde tekrar selamlama istemiyor; teÅŸekkÃ¼r/onay mesajlarÄ±nda kÄ±sa ve doÄŸal cevap bekliyor.",
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

Prompta gitmeden Ã¶nce Ã§alÄ±ÅŸÄ±r.

Input:

- son kullanÄ±cÄ± mesajÄ±
- aktif app section
- seÃ§ili profile
- seÃ§ili persona
- okuma tÃ¼rÃ¼
- session state
- wiki pages
- graph relations
- repetition ledger

Output:

LLM'in kolay decode edeceÄŸi kÄ±sa baÄŸlam.

Ã–rnek:

```text
Ozan kendi profili iÃ§in kiÅŸisel astro takip sorusu soruyor. Devam eden sohbetlerde tekrar selamlama istemez; teÅŸekkÃ¼r/onay mesajlarÄ±na kÄ±sa doÄŸal cevap bekler. Selin bu kullanÄ±cÄ±da sakin, net ve psikolojik farkÄ±ndalÄ±k tonu ile iyi Ã§alÄ±ÅŸÄ±r. Bu oturumda beklenmedik geliÅŸmelerden korkma temasÄ± iÅŸlendi; aynÄ± aÃ§Ä±klamayÄ± tekrar etme, son soruya yeni ve kÄ±sa aÃ§Ä±dan cevap ver.
```

Bu brief, 1 GB memory olsa bile birkaÃ§ yÃ¼z tokenÄ± geÃ§memelidir.

## 12. Prompt Builder BloklarÄ±

Prompt builder ÅŸu bloklarÄ± ayrÄ± tutar:

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

Ã–rnek:

```text
SYSTEM_GUARDRAILS:
Ortak gÃ¼venlik ve alan kurallarÄ±.

PERSONA_IDENTITY:
Selin: modern, rafine, sakin, psikolojik farkÄ±ndalÄ±k odaklÄ±...

LORE_BRIEF:
FALCI kiÅŸisel astro section'Ä±nda persona sesi yalnÄ±zca Ã¼slup iÃ§in taÅŸÄ±nÄ±r; cevap astro baÄŸlamÄ±nda kalÄ±r.

USER_PERSONA_RELATIONSHIP:
Bu kullanÄ±cÄ± Selin tonunda tekrar selamlama istemez; kÄ±sa ve doÄŸal follow-up bekler.

PROFILE_CONTEXT:
Ozan hesap sahibinin kendi profili; sen dili kullanÄ±lmalÄ±.

ACTIVE_READING_CONTEXT:
KiÅŸisel astro daily session; Ã¶nceki follow-up beklenmedik geliÅŸmelerden korkma temasÄ±ndaydÄ±.

USER_MEMORY_BRIEF:
KullanÄ±cÄ± belirsizlikte net ve sakin cevaplardan fayda gÃ¶rÃ¼yor.

REPETITION_VARIETY_BRIEF:
Ã–nceki VenÃ¼s/SatÃ¼rn aÃ§Ä±klamasÄ±nÄ± tekrar etme; son soruya yeni aÃ§Ä±dan cevap ver.

TASK_INSTRUCTION:
Son mesaja gÃ¶re cevap ver.

USER_MESSAGE:
TeÅŸekkÃ¼rler.
```

## 13. Storage ve 1 GB Stratejisi

Memory sÄ±cak/Ä±lÄ±k/soÄŸuk katmanlara ayrÄ±lÄ±r.

```text
Hot Memory = prompta yakÄ±n, hÄ±zlÄ± eriÅŸilen Ã¶zetler
Warm Memory = wiki, graph, embeddings
Cold Memory = raw archive
```

### Hot Memory

- user overview brief
- aktif profil brief
- aktif persona-user relationship brief
- son session summary
- son kritik tercih/dÃ¼zeltmeler
- son repetition ledger Ã¶zeti

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
- audit kaynaklarÄ±

Online follow-up sÄ±rasÄ±nda Cold Memory'ye gidilmez.

## 14. SQLite Tablo TaslaÄŸÄ±

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

Ã–rnek `wiki_sections`:

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

Ã–rnek `persona_relationships`:

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

Ã–rnek `reading_fingerprints`:

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

Online cevap yolunda pahalÄ± memory iÅŸi yapÄ±lmaz.

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

LLM gereken iÅŸler mÃ¼mkÃ¼nse scheduled/flex/batch API ile yapÄ±lÄ±r.

## 16. Online Cevap AkÄ±ÅŸÄ±

Follow-up geldiÄŸinde:

```text
1. Son mesaj intent hÄ±zlÄ± belirlenir.
2. Aktif profile/persona/session alÄ±nÄ±r.
3. Hot memory okunur.
4. Graph ve embedding ile birkaÃ§ warm aday seÃ§ilir.
5. Context Brief Builder kÄ±sa brief Ã¼retir.
6. Prompt Builder bloklarÄ± birleÅŸtirir.
7. LLM cevap Ã¼retir.
8. Raw event kaydedilir.
9. Memory update background queue'ya atÄ±lÄ±r.
```

Kritik kural:

```text
KullanÄ±cÄ± cevabÄ± beklerken 1 GB memory taranmaz ve LLM'e bÃ¼yÃ¼k memory gÃ¶nderilmez.
```

## 17. Caveman Brief FormatÄ±

Caveman sÄ±kÄ±ÅŸtÄ±rma memory'nin kaynaÄŸÄ± deÄŸil, prompta giden final brief formatlarÄ±ndan biridir.

Ã–rnek:

```text
USER=Ozan/self. PROFILE_MODE=sen dili. PERSONA=Selin/static modern calm psych-aware. USER_PERSONA=likes calm direct chat; no repeated greeting; no re-analysis after thanks. SESSION=personal astro daily; fear of unexpected changes discussed. VARIETY=do not repeat same Venus/Saturn explanation unless asked. PRIORITY=last user message.
```

Bu format:

- kÄ±sa
- anlamlÄ±
- LLM-readable
- deterministic kÄ±rpma deÄŸil
- wiki/graph context seÃ§iminden tÃ¼remiÅŸ

## 18. Uygulama Yol HaritasÄ±

### Faz 1: Åžema ve AyrÄ±m

- Persona identity registry ve guardrail contract ayrÄ±lÄ±r.
- User semantic wiki page schema eklenir.
- Lore wiki user memory'den ayrÄ± scope olarak tanÄ±mlanÄ±r.
- Persona-user relationship schema eklenir.
- Raw chunk prompt pack'ten Ã§Ä±karÄ±lÄ±r.

### Faz 2: Memory Writer MVP

- KullanÄ±cÄ± dÃ¼zeltmeleri ve tercihleri wiki/graph'a yazÄ±lÄ±r.
- Profile relationships graph'a yazÄ±lÄ±r.
- Kendini TanÄ± essence wiki'ye yazÄ±lÄ±r.
- Reading summary ve fingerprint Ã§Ä±karÄ±lÄ±r.

### Faz 3: Context Brief Builder

- Aktif profile/persona/session iÃ§in brief Ã¼retir.
- Persona identity ve user-persona relationship ayrÄ± prompt bloklarÄ± olur.
- Repetition ledger prompta negatif liste olarak deÄŸil, pozitif Ã§eÅŸitlilik brief'i olarak yansÄ±r.

### Faz 4: Local Embedding Index

- Semantic wiki section ve memory item embed edilir.
- Raw chunk embed edilmez.
- Retrieval hÄ±zlÄ± ve lokal hale gelir.

### Faz 5: Scheduled Memory Management

- Wiki refinement
- graph consistency
- persona relationship synthesis
- weekly user model synthesis
- repetition cleanup

### Faz 6: External Tool/Agent HazÄ±rlÄ±ÄŸÄ±

- AynÄ± memory core app assistant, Gemini, ChatGPT, Claude, MCP adapter tarafÄ±ndan kullanÄ±labilir.
- UI baÄŸÄ±msÄ±z tool/action layer ile entegre edilir.

### Faz 7: Lore Content Ops

- Developer entry formatÄ± eklenir.
- Social feed ingestion queue kurulur.
- Curation ve approval flow eklenir.
- OnaylÄ± iÃ§erikler Lore Wiki'ye yazÄ±lÄ±r.
- Lore brief, prompt builder'a user memory brief'ten ayrÄ± blok olarak baÄŸlanÄ±r.

## 19. ÃœrÃ¼n Hissi

KullanÄ±cÄ± ÅŸunu gÃ¶rmemeli:

```text
HafÄ±zanda gÃ¶rdÃ¼ÄŸÃ¼me gÃ¶re...
Ã–nceki okumanda...
Profilinde...
```

KullanÄ±cÄ± ÅŸunu hissetmeli:

```text
Bu yorumcu beni tanÄ±yor.
Bu persona ailesi beni yavaÅŸ yavaÅŸ Ã¶ÄŸreniyor.
AynÄ± ÅŸeyleri tekrar etmiyor.
Benim sevdiÄŸim tonu biliyor.
Benim Ã§evremi ve profillerimi karÄ±ÅŸtÄ±rmÄ±yor.
Beni gÃ¶zÃ¼me sokmadan hatÄ±rlÄ±yor.
```

Bu mimarinin ana amacÄ± budur.
