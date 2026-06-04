# Free IQ Yerel Model ve Cihaz Sınıflandırma Stratejisi

Bu doküman, Free IQ deneyiminde yerel modelin cihaz gücüne göre nasıl çalıştırılacağını, prompt/memory/retrieval davranışının nasıl değişeceğini ve Gemma 4 E2B gibi modellerin düşük RAM/GPU sınıfı cihazlarda nasıl daha güvenli kullanılacağını tarif eder.

Amaç tek bir sabit prompt veya tek bir sabit token limiti kullanmak değildir. Amaç, uygulama açıldığında cihazı tanıyıp Free IQ için uygun bir çalışma profili seçmek, böylece eski cihazlarda çökmeden kısa ve faydalı cevap verebilmek; güçlü cihazlarda ise daha zengin hafıza, persona ve takip sorusu deneyimi sunabilmektir.

## Temel Prensip

Free IQ, her cihazda aynı davranmamalıdır. Cihaz yeterliliğine göre 6-8 arası yerel çalışma grubu tanımlanmalıdır. Her grup şunları belirler:

- maksimum input token bütçesi
- maksimum ilk cevap token bütçesi
- maksimum follow-up cevap token bütçesi
- izin verilen follow-up sayısı
- prompt builder yoğunluğu
- memory retrieval derinliği
- memory yazma/consolidation davranışı
- persona ve guardrail sıkıştırma seviyesi
- yerel model backend tercihi: GPU, GPU+MTP, CPU, hafif mod
- TTS ve ses demo davranışı

Örnek: Samsung XCover Pro gibi eski/orta-alt cihazlarda Free IQ daha kısa, daha az hafızalı ve en fazla 1-2 takip sorulu çalışabilir. Daha güçlü cihazlarda aynı model daha geniş context ve daha akıllı retrieval ile çalışabilir.

## Cihaz Algılama

Uygulama açılışında veya ilk Free IQ kullanımından önce cihaz profili çıkarılmalıdır.

Toplanacak sinyaller:

- cihaz modeli ve üretici
- Android/iOS sürümü
- RAM sınıfı
- SoC/GPU bilgisi mümkünse
- uygulamanın kullanabileceği yaklaşık memory class
- pil seviyesi
- cihazın güç tasarrufu modunda olup olmadığı
- termal durum veya uzun üretim sonrası yavaşlama sinyali
- LiteRT-LM engine oluşturma başarısı
- GPU backend başarısı
- MTP/speculative decoding başarısı
- kısa benchmark sonucu: first token latency, toplam süre, crash olup olmaması
- daha önce aynı cihazda oluşmuş yerel model hata geçmişi

Bu sinyaller kalıcı bir `LocalCapabilityProfile` olarak saklanmalıdır. Kullanıcı her açılışta yeniden benchmark beklememelidir; ancak model/runtime değişirse veya kullanıcı “yerel modeli yeniden test et” derse profil güncellenmelidir.

## Model Health Score ve Kendini İyileştirme

Uygulamanın kendi kararlarını iyileştirmesi tek başına AI ile yapılmamalıdır. İlk sürüm için en doğru yaklaşım hybrid yapıdır:

- deterministik programlama ana karar verici olmalıdır.
- küçük istatistikler cihaz/model/backend sağlığını ölçmelidir.
- AI yalnızca daha ileri aşamada log özetleme, hata sınıflandırma veya memory özetleme gibi yardımcı işlerde kullanılabilir.

Her cihaz-model-backend kombinasyonu için bir `LocalModelHealthScore` tutulmalıdır.

Örnek alanlar:

```ts
type LocalModelHealthScore = {
  deviceIdHash: string;
  modelId: string;
  backendMode: 'gpu_mtp' | 'gpu' | 'cpu4' | 'cpu_short';
  successCount: number;
  crashCount: number;
  timeoutCount: number;
  emptyOutputCount: number;
  specialTokenLeakCount: number;
  languageDriftCount: number;
  averageFirstTokenMs?: number;
  averageTotalMs?: number;
  lastFailureAt?: string;
  lastStableTier?: LocalIqDeviceTier;
};
```

Karar mantığı deterministik olmalıdır:

- arka arkaya 2 özel token sızıntısı olursa aynı backend geçici olarak kapatılır.
- arka arkaya 1 native crash olursa cihaz bir tier düşürülür.
- 2 timeout olursa output ve input bütçesi düşürülür.
- 3 başarılı kısa okuma sonrası cihaz aynı tier içinde küçük bir bütçe artışı deneyebilir.
- pil düşükse veya cihaz ısınıyorsa geçici olarak hafif moda düşülür.

Bu yapı AI kullanmadan güvenilir davranır. İleride küçük bir “function Gemma” veya başka küçük model, logları sınıflandırma ya da kısa memory etiketleme için denenebilir; ancak kritik runtime kararları yine deterministik kurallarla verilmelidir.

## Termal ve Pil Politikası

Yerel model çalışırken cihaz birkaç dakika boyunca yük altında kalabilir. Bu yüzden cihaz sınıfı yalnızca donanım kapasitesine göre değil, anlık duruma göre de geçici olarak düşebilmelidir.

Örnek kararlar:

- pil yüzde 20 altındaysa output limiti düşürülür.
- güç tasarrufu modu açıksa GPU/MTP denenmeyebilir.
- cihaz ısınmışsa yeni follow-up engellenebilir.
- uzun okuma sonrası ikinci follow-up daha kısa moda alınabilir.
- arka arkaya iki uzun üretim yapılmışsa kullanıcıya kısa bir bekleme önerilebilir.

Kullanıcıya teknik açıklama verilmemelidir. UI cümlesi yumuşak olmalıdır:

> Cihazını yormadan devam etmek için bu yorumu daha hafif bir biçimde hazırlayacağım.

## Cihaz Sınıfları

İlk ürün tasarımı için 6 sınıf yeterlidir. İleride 8 sınıfa genişletilebilir.

| Sınıf | Açıklama | Örnek davranış |
| --- | --- | --- |
| `local_0_unavailable` | Yerel model çalışmaz veya kullanıcı model indirmeyi reddeder | Free IQ yerel cevap üretmez; Gemini/API fallback veya sınırlı demo |
| `local_1_survival` | Çok zayıf/eski cihaz, crash riski yüksek | input 480-640, cevap 120-180 token, follow-up yok veya 1 adet |
| `local_2_low` | XCover Pro benzeri eski/orta-alt cihaz | input 640, ilk cevap 220-260, follow-up 180-240, en fazla 2 follow-up |
| `local_3_basic` | Biraz daha iyi ama hâlâ sınırlı cihaz | input 800-900, ilk cevap 280-320, follow-up 240-300, en fazla 2 follow-up |
| `local_4_standard` | Orta seviye güncel cihaz | input 1024-1280, ilk cevap 350-450, follow-up 320-380 |
| `local_5_plus` | Güçlü Android/iPhone sınıfı | input 1536-2048, daha zengin memory/persona, 3-4 follow-up |
| `local_6_premium_device` | Yüksek RAM/GPU/NPU cihaz | daha geniş context, MTP açık, daha uzun oturum |

Başlangıç için XCover Pro `local_2_low` veya test sonucuna göre `local_1_survival` sınıfına düşmelidir.

## Örnek Token Profilleri

| Sınıf | İlk input | İlk output | Follow-up input | Follow-up output | Follow-up limiti |
| --- | ---: | ---: | ---: | ---: | ---: |
| `local_1_survival` | 480-640 | 120-180 | 420-520 | 120-160 | 0-1 |
| `local_2_low` | 640 | 220-260 | 560-640 | 180-240 | 2 |
| `local_3_basic` | 840 | 280-320 | 700-840 | 240-300 | 2 |
| `local_4_standard` | 1024-1280 | 350-450 | 900-1100 | 320-380 | 3 |
| `local_5_plus` | 1536-2048 | 500-650 | 1200-1600 | 400-500 | 3-4 |
| `local_6_premium_device` | 2048+ | 700+ | 1600+ | 500+ | modele göre |

Bu değerler model, runtime ve cihaz testlerine göre runtime config olarak değiştirilebilir olmalıdır; koda gömülü sabitler yerine bir cihaz profili tablosundan okunmalıdır.

## Prompt Bütçesi Dağıtımı

Sadece toplam token limiti yetmez. Her cihaz tier’ı için input bütçesinin hangi parçaya ayrılacağı da tanımlanmalıdır. Böylece düşük cihazlarda memory veya persona promptu kontrolsüz büyümez.

Önerilen başlangıç dağılımı:

| Sınıf | Guardrail | Persona | Profil | Kullanıcı konusu | Domain verisi | Memory | Önceki oturum özeti | Format talimatı |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `local_1_survival` | %12 | %6 | %10 | %18 | %44 | %0-4 | %0-4 | %8 |
| `local_2_low` | %10 | %8 | %10 | %16 | %40 | %6 | %4 | %6 |
| `local_3_basic` | %10 | %8 | %10 | %15 | %38 | %10 | %4 | %5 |
| `local_4_standard` | %9 | %9 | %10 | %14 | %34 | %15 | %4 | %5 |
| `local_5_plus` | %8 | %10 | %10 | %13 | %31 | %20 | %4 | %4 |
| `local_6_premium_device` | %8 | %10 | %10 | %12 | %30 | %22 | %4 | %4 |

Bu oranlar okuma tipine göre değişebilir. Örneğin kişisel astrolojide domain verisi daha yüksek kalır; tarot ve rüyada domain verisi daha düşük, kullanıcı konusu ve sembolik talimat daha yüksek olabilir.

Düşük cihazlarda memory bütçesi yalnızca tetiklenmiş retrieval için kullanılmalıdır. Kullanıcı geçmişten bir kişi, evcil hayvan, olay veya önceki okuma bağlamı açmadıysa `local_1_survival` ve `local_2_low` memory bütçesini domain verisine devredebilir.

## Degradation Ladder

Yerel model zorlanırsa uygulama rastgele davranmamalıdır. Her başarısızlıkta sırayla hafifleyen bir merdiven kullanılmalıdır.

Önerilen sıra:

1. memory context çıkarılır veya tek caveman cümlesine düşürülür.
2. persona `short` yerine `tiny` yapılır.
3. output token limiti düşürülür.
4. follow-up limiti düşürülür.
5. GPU+MTP yerine GPU denenir.
6. GPU yerine CPU kısa mod denenir.
7. aynı okuma daha kısa Free IQ formatında yeniden hazırlanır.
8. hâlâ olmazsa kullanıcıya kredi/subscription ile bulutta tamamlama seçeneği gösterilir.

Free IQ’da buluta otomatik geçiş yapılmamalıdır. Bulut seçeneği ancak kullanıcı açıkça onaylarsa ve kredi/abonelik sistemi buna izin verirse çalışmalıdır.

Önerilen kullanıcı cümlesi:

> Cihazının kapasitesi bu okuma için biraz zorlandı. İstersen yorumu daha hafif ve kısa bir biçimde yeniden hazırlayabilirim.

Kredi/abonelik sistemi eklendiğinde ikinci seçenek:

> Dilersen kredilerinden düşerek bu yorumu bulutta tamamlayabilirim.

## Prompt Builder Davranışı

Free IQ için ayrı bir prompt builder stratejisi gerekir. Pro/Premium API promptlarını doğrudan yerel modele vermek doğru değildir.

Prompt builder cihaz sınıfına göre şu katmanları azaltıp çoğaltmalıdır:

- persona tonu
- guardrail
- profil özeti
- kullanıcının konu/soru inputu
- okuma tipi için gerekli domain verisi
- memory bağlamı
- önceki okuma ve follow-up özeti
- cevap formatı

### Persona Sıkıştırma

Yerel modelde persona dosyasının tamamı gönderilmemelidir. Bunun yerine persona şu seviyelerde özetlenmelidir:

- `persona_tiny`: 3-8 kelime çağrışım. Örnek: “sıcak, sezgisel, anaç, kısa”
- `persona_short`: 1 cümle. Örnek: “Sıcak, sezgisel ve koruyucu bir tonda konuş; adını söyleme.”
- `persona_standard`: 2-3 cümle. Daha iyi cihazlarda kullanılabilir.
- `persona_fullish`: yalnızca güçlü cihazlarda, hâlâ full identity değil.

Free IQ en düşük sınıflarda `persona_tiny` veya `persona_short` kullanmalıdır.

### Guardrail Sıkıştırma

Guardrail de full sistem promptu olarak verilmemelidir. Cihaz sınıfına göre yoğunluk:

- düşük sınıf: 1-2 cümle
- orta sınıf: 3-5 kısa kural
- güçlü sınıf: daha ayrıntılı ama hâlâ kısa

Minimum guardrail:

> Kendini tanıtma. Kesin gelecek, sağlık tedavisi, ilaç/doz ve finans tavsiyesi verme; sembolik yorum dili kullan.

Bu kısa form Free IQ’da her promptta kalmalıdır.

## Okuma Tipine Göre Memory Kullanımı

Memory her okuma tipinde aynı ağırlıkla kullanılmamalıdır.

### Free IQ’da Memory Gerekli Olanlar

- Senin Evin kişisel astroloji
- Senin Evin numeroloji
- kişisel ilişki/aile astroloji
- kullanıcı açıkça geçmiş, kişi, olay, evcil hayvan veya önceki okuma sorarsa follow-up

Bu okumalarda memory kısa ve hedefli verilmelidir.

### Free IQ’da Her Okuma Tipi Desteklenir

Bütün okuma tiplerinin Free IQ yolu olmalıdır. Cihaz çok zayıf olsa bile kullanıcı “bu okuma tipi Free IQ’da yok” hissi almamalıdır. Fark yalnızca yorumun uzunluğu, kullanılan memory miktarı, görsel işleme seviyesi, follow-up hakkı ve demo/önizleme desteği olmalıdır.

Free IQ kapsamına girmesi gereken ana okuma aileleri:

- kişisel astroloji
- doğum haritası ana yorumu
- kişisel ilişki/aile astroloji
- numeroloji
- tarot
- tek kart
- rüya
- kahve
- el
- melek/kart benzeri sembolik okumalar
- Kendini Tanı test yorumları
- ileride eklenecek kısa wellness/spiritüel asistan okumaları

Bu okuma tiplerinin hepsi Free IQ’da en az kısa formda çalışmalıdır. Ancak memory yalnızca okuma tipi gerçekten gerektiriyorsa veya kullanıcı açıkça geçmişten bir şeye değinirse kullanılmalıdır. Aksi halde yerel modeli memory ile yormamak daha doğru olur.

Başlangıç yaklaşımı:

- kişisel astroloji: kısa ama gerçek natal/transit bağlamlı yerel yorum
- numeroloji: kısa yerel yorum
- tarot/tek kart: kısa yerel yorum, memory yalnızca tetiklenirse
- kahve/el: düşük cihazlarda görseli 320x320 veya benzeri sıkıştırılmış formda deneme; olmazsa demo/önizleme stratejisi
- doğum haritası ana yorumu: düşük cihazda çok kısa özet; güçlü cihazda daha uzun
- Kendini Tanı testleri: çoğunlukla LLM gerektirmez; LLM varsa her section için 1-2 kısa cümle

Kahve/el, doğum haritası ana yorumu ve Free kullanıcı demoları için ayrıca dokümanın en altındaki “Demo, Görsel ve Free Account Stratejisi” bölümüne bakılmalıdır.

## Akıllı Retrieval Stratejisi

Free IQ’da retrieval geniş paket döndürmemelidir. Akış şöyle olmalıdır:

1. Kullanıcının son sorusu ve okuma tipi normalize edilir.
2. Soru içinde kişi, evcil hayvan, ilişki, olay, tarih, konu veya önceki okuma sinyali aranır.
3. Sinyal yoksa düşük sınıf cihazlarda memory hiç eklenmeyebilir.
4. Sinyal varsa memory graph/token/vector index içinde kısa arama yapılır.
5. En alakalı 1-3 kayıt seçilir.
6. Prompt’a kayıtlar ham haliyle değil, tek cümlelik bağlam olarak girer.

Örnek:

> Mico, kullanıcının evcil hayvanı olarak kayıtlı; soru onunla ilgili olabilir.

veya:

> Kullanıcının önceki ilişki temalarında güven ve mesafe konusu öne çıkmış; yalnızca soru bununla doğrudan bağlantılıysa kullan.

Ama şunlar Free IQ düşük cihazlarda gönderilmemelidir:

- uzun memory paketleri
- bütün ilişki grafiği
- bütün life event listesi
- geçmiş okumanın tam metni
- persona identity dosyasının tamamı

## Memory Yazma ve Consolidation

Yerel model cevap üretirken aynı anda ağır memory extraction yapılmamalıdır. Özellikle düşük cihazlarda “one thing at a time” prensibi korunmalıdır.

Free IQ için önerilen memory yazma akışı:

1. Okuma biter.
2. Kullanıcı ekranda sonucu görür.
3. Basit deterministic extraction çalışır: profil adı, okuma tipi, konu, kişi/evcil hayvan mention, tarih.
4. Ağır LLM memory extraction cihaz sınıfına göre ertelenir veya hiç yapılmaz.
5. Uygun cihazlarda background consolidation daha sonra çalışır.
6. Çok zayıf cihazlarda memory extraction server/API tarafına veya basit rule-based yapıya bırakılır.

Free IQ düşük sınıflarda memory yazma minimum olmalıdır:

- son okuma kaydı
- kullanıcı açıkça söylediği önemli bilgi
- kişi/evcil hayvan bağlantısı
- konu etiketi
- tekrar etmeme için kısa özet

Reading-derived düşük güvenli temalar zamanla zayıflatılabilir; user-stated ve Kendini Tanı essence kolay kolay silinmemelidir.

## Caveman Sıkıştırması

Caveman sıkıştırması, yerel model için bağlamı “çok kısa ama anlamı taşıyan” hale getirme katmanıdır.

Amaç:

- full memory vermemek
- full persona vermemek
- eski okumayı tekrar göndermemek
- ama modelin en kritik bağlamı kaçırmamasını sağlamak

Örnek sıkıştırma:

Ham memory:

> Kullanıcı 2026 Mayıs ayında Mico adlı kedisinin davranışları hakkında birkaç kez soru sordu. Mico evcil hayvan profili olarak kayıtlı. Kullanıcı Mico’nun sağlığı ve huzuru konusunda hassas.

Caveman form:

> Mico = kullanıcının kedisi; sağlık varsa veterinere yönlendir.

Bu form özellikle `local_1_survival` ve `local_2_low` için önemlidir.

## Follow-up ve KV/Session Yönetimi

Follow-up’larda en büyük risk promptun katlanarak büyümesidir. Her soruda:

- ana okuma
- tüm önceki follow-up’lar
- memory
- persona
- guardrail
- astro/numeroloji verisi

yeniden tam gönderilirse düşük cihaz çöker.

Bu yüzden session/KV cache yönetimi önemlidir.

Önerilen yaklaşım:

1. Aynı okuma ekranında engine mümkünse açık tutulur.
2. Aynı model ve aynı backend ile devam ediliyorsa session korunur.
3. Follow-up için tam ana okuma yerine kısa “oturum özeti” gönderilir.
4. Önceki soru-cevaplar tam metin değil, 1-2 satırlık running summary olur.
5. Belirlenen follow-up limiti aşılırsa kullanıcıya yeni oturum önerilir.
6. Cihaz memory baskısı veya hata sinyali varsa engine unload edilir ve hafif modda yeniden başlatılır.
7. App arka plana atılırsa veya native crash sonrası yeniden açılırsa önceki local generation “başarısız/yarım” sayılır.
8. Yarım kalan yerel okuma “son okumalar”a tamamlanmış okuma gibi kaydedilmemelidir.

XCover Pro gibi cihazlarda:

- ilk okuma sonrası session korunabilir ama riskliyse her follow-up öncesi kısa prompt ile temiz oturum denenebilir.
- maksimum 2 follow-up sınırı mantıklıdır.
- follow-up input 560-640 token civarında tutulmalıdır.

## Crash-Safe Local Generation State

Yerel üretim başlamadan önce kısa bir durum kaydı açılmalıdır:

```ts
type LocalGenerationState = {
  id: string;
  profileId: string;
  readingType: string;
  modelId: string;
  backendMode: string;
  tier: LocalIqDeviceTier;
  status: 'in_progress' | 'completed' | 'failed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  failureReason?: 'timeout' | 'native_crash' | 'empty_output' | 'special_token_leak' | 'language_drift' | 'user_cancelled';
};
```

App yeniden açıldığında `in_progress` kalan yerel üretimler `abandoned` sayılır. Bu kayıtlar model health score’u günceller ve aynı cihazda bir sonraki denemeyi daha hafif moda çekebilir.

## Yerel Model Backend Stratejisi

Her cihazda şu test sırası denenebilir:

1. GPU + MTP/speculative decoding
2. GPU, MTP kapalı
3. CPU 4 thread
4. CPU kısa cevap modu
5. Yerel model unavailable

Her mod için sonuç saklanmalıdır:

- engine create başarılı mı?
- ilk prompt başarılı mı?
- ikinci prompt başarılı mı?
- boş cevap döndü mü?
- özel token sızıntısı oldu mu?
- native crash oldu mu?
- süre kabul edilebilir mi?

Başarısız mod bir süre tekrar denenmemelidir. Kullanıcı “yerel modeli yeniden test et” derse tekrar denenebilir.

## Embedding ve Retrieval

Gemma 4 E2B bazı paketlerde embedding benzeri işlere uygun görünebilir, ancak aynı anda hem okuma üretimi hem embedding hem memory extraction yaptırmak düşük cihazlarda risklidir.

İki olası strateji vardır:

### Strateji A: Tek Model

Gemma 4 E2B hem cevap üretir hem kısa retrieval/extraction işlerinde kullanılır.

Artıları:

- tek model kurulumu
- daha az disk karmaşası
- kullanıcıya daha sade deneyim

Eksileri:

- RAM ve latency yükü artar
- cevap üretimi ile memory işi aynı modele yüklenir
- düşük cihazlarda crash riski artar

### Strateji B: Ayrı Küçük Embedding Modeli

Gemma embedding 300M benzeri küçük bir model yalnızca embedding/retrieval için kullanılır.

Artıları:

- retrieval daha doğru olabilir
- ana LLM promptu daha kısa kalır
- memory araması daha akıllı olur

Eksileri:

- ek model indirme/bundle boyutu
- iki model aynı anda RAM’de tutulursa düşük cihaz çöker
- model lifecycle çok dikkatli yönetilmelidir

Önemli kural:

> Düşük cihazlarda Gemma 4 E2B ve embedding modeli aynı anda RAM’de tutulmamalıdır. Biri kullanılmadan önce diğeri unload edilmelidir.

Başlangıç için Free IQ’da token-overlap + typed memory graph + caveman summary fallback yeterli olabilir. Embedding modeli daha sonra cihaz sınıfı `local_4_standard` ve üstünde opsiyonel hale getirilebilir.

### Embedding Gemma / Küçük Embedding Modeli Notu

Embedding Gemma veya benzeri küçük embedding modelleri, Free IQ mimarisinde ana cevap üreticisi değil, hafıza arama ve bağlam seçme yardımcısı olarak düşünülmelidir.

Muhtemel kullanım alanları:

- kullanıcının sorusuyla en alakalı memory chunk’larını bulmak
- Mico gibi kişi/evcil hayvan/entity bağlantılarını daha akıllı yakalamak
- geçmiş okumalardan benzer tema veya önceki soru-cevap bağlamı bulmak
- life event, pet life event ve relationship graph kayıtlarını kısa listeye indirmek
- prompt’a gidecek caveman memory cümlesini seçmeye yardımcı olmak

Önemli nokta: Embedding modeli memory’ye “yazmak” için şart değildir. Memory yazma deterministic extraction, kullanıcı-stated bilgi ve typed graph üzerinden yapılabilir. Embedding daha çok “hangi memory şimdi alakalı?” sorusu için faydalıdır.

Düşük cihazlarda risk:

- Gemma 4 E2B ve embedding modeli aynı anda RAM’de tutulursa cihaz çökebilir.
- Bu yüzden embedding modeli kullanılacaksa ana LLM unload edilmiş olmalı veya embedding işlemi okuma üretiminden tamamen ayrı bir zamanda yapılmalıdır.
- `local_1_survival` ve `local_2_low` için embedding modeli varsayılan kapalı olmalıdır.

Önerilen başlangıç:

- `local_1_survival`: embedding yok; token-overlap + typed graph.
- `local_2_low`: embedding yok; yalnızca çok kısa deterministic retrieval.
- `local_3_basic`: embedding opsiyonel deneysel; aynı anda ana LLM açık kalmamalı.
- `local_4_standard` ve üstü: küçük embedding modeli denenebilir.

Eğer embedding modeli kurulmazsa sistem yine çalışmalıdır. Fallback:

1. typed memory graph ilişkileri
2. kullanıcı-stated facts
3. token-overlap search
4. son okuma/session özeti
5. caveman summary

Embedding modeli yalnızca bu retrieval katmanını daha akıllı hale getirir; Free IQ’nun çalışması için zorunlu olmamalıdır.

### Küçük Function Model Notu

Gemma ailesinde veya benzer ekosistemde daha küçük “function” odaklı modeller varsa bunlar ileride şu işler için değerlendirilebilir:

- okuma metninden kısa memory etiketi çıkarma
- kullanıcı sorusunda kişi/evcil hayvan/olay/entity yakalama
- hata loglarını basit sınıflara ayırma
- prompt budget kararına yardımcı olacak hafif sınıflandırma

Ancak bu modeller ana runtime karar vericisi olmamalıdır. Cihaz tier seçimi, backend fallback ve kredi/bulut geçişi deterministik kalmalıdır.

### Vision-Only Model Notu

LiteRT/LiteRT-LM ekosisteminde yalnızca vision processing için modeller kullanılabilir. Bunlar kahve fincanı mı, tabak mı, el mi, görüntü okunabilir mi gibi ön sınıflandırma işlerinde faydalı olabilir.

Muhtemel kullanım:

- görsel fincan mı, tabak mı, el mi?
- görsel çok karanlık veya bulanık mı?
- el çizgileri görünüyor mu?
- fincan/telve kadrajda mı?
- tabak ayrı mı?

Bu modeller şekilleri ruhsal/sembolik yoruma çevirmek için yeterli olmayabilir. Ama görüntüden kısa bir teknik açıklama veya sınıflandırma çıkarıp Gemma 4 E2B’ye metin olarak vermek ileride denenebilir.

Örnek hedef:

> Görsel: fincan içi, telve yoğunluğu üst sağ bölgede, kulp görünmüyor, görüntü okunabilir.

Bu tür kısa görsel ön-özet, düşük cihazlarda tam multimodal yorumdan daha güvenli olabilir.

## TTS ve Ses Modeli

Ses modeli Free IQ ile aynı anda ağır çalıştırılmamalıdır. Özellikle düşük cihazlarda okuma üretimi + TTS + memory extraction aynı anda yapılırsa deneyim bozulur.

Free IQ için ses yaklaşımı:

- düşük sınıf cihazlarda gerçek zamanlı TTS kapalı veya çok sınırlı
- ilk kurulumda persona ses demo’su hazır WAV olarak çalınabilir
- “bu yorum sesli hazırlanıyor” hissi için önceden hazırlanmış kısa mock/demo kullanılabilir
- güçlü cihazlarda gerçek TTS daha sonra açılabilir
- ses modeli okuma üretimi bittikten sonra, model unload edildikten sonra çalıştırılmalıdır

Bu sayede Free kullanıcıya ses deneyimi tattırılır ama cihaz zorlanmaz.

## Kullanıcı Deneyimi

Kullanıcıya teknik detay gösterilmemelidir. UI dilinde şunlar kullanılabilir:

- “Bu cihazda yerel beyin hafif modda çalışacak.”
- “Daha kısa ama ücretsiz kişisel yorum hazırlanıyor.”
- “Bu telefonda yerel model uzun sohbet için uygun görünmüyor.”
- “Cihazının kapasitesi bu yorum için biraz zorlandı. İstersen daha hafif bir yorum hazırlayabilirim.”

Kullanıcı model indirmeyi reddederse:

- Free IQ yerel model kullanmaz.
- App normal açılır.
- Senin Evin kişisel okumaları Free IQ yerel modda hazırlanmaz; demo, kredi veya premium akışına yönlenebilir.
- Hafıza sistemi çalışmaya devam eder ama local LLM gerektiren extraction/retrieval işleri kapalı olur.

Free IQ’da buluta otomatik yönlendirme yapılmamalıdır. Kredi ve subscription sistemi eklendiğinde kullanıcıya isteğe bağlı bir seçenek verilebilir:

> Dilersen kredilerinden düşerek bu yorumu bulutta tamamlayabilirim.

Bu cümle yalnızca gerçekten kredi/abonelik entegrasyonu hazır olduğunda gösterilmelidir. Kullanıcı kabul ederse kredi düşümü veya abonelik hakkı kontrolü yapıldıktan sonra API tarafına geçilir.

## Dil ve Localization Tasarımı

Uygulamanın ilk dili Türkçe olsa da ileride İngilizce ilk ek localization dili olacaktır. Bu yüzden Free IQ prompt builder şimdiden dil bağımsız tasarlanmalıdır.

Gereken alanlar:

- `locale`: örn. `tr-TR`, `en-US`
- `outputLanguage`: modelin cevap dili
- `personaLocaleName`: Selin/Celine, Arın/Aaron gibi display adı
- `guardrailLocalePack`: aynı guardrail’in Türkçe/İngilizce kısa formu
- `memoryLocalePolicy`: memory kaynakları Türkçe olsa bile cevabın hedef dilde kurulması

Dil drift kontrolü de locale’e göre yapılmalıdır. Türkçe modda model İngilizceye veya anlamsız dile kayarsa kısa retry yapılabilir. İngilizce mod eklendiğinde aynı kontrol ters yönde çalışmalıdır.

Yerel model küçük ve kararsızsa, cevap dilini korumak için promptun ilk satırı çok kısa ama net olmalıdır:

> Yanıt dili: Türkçe. Başka dile geçme.

İngilizce modda:

> Response language: English. Do not switch languages.

## Uygulama Mimari Önerisi

Kod tarafında şu katmanlar ayrılmalıdır:

- `deviceCapabilityService`: cihaz sinyallerini ve benchmark sonuçlarını toplar.
- `localModelRuntimeService`: model load/unload, backend, MTP, CPU/GPU seçimi.
- `localIqPolicyService`: cihaz sınıfına göre token limitleri ve feature flag’leri verir.
- `freeIqPromptBuilder`: Pro/Premium prompt builder’dan ayrı, cihaz profiline duyarlı prompt üretir.
- `memoryRetrievalPolicy`: okuma tipi ve cihaz sınıfına göre memory seçer/sıkıştırır.
- `localSessionManager`: engine/session/KV cache lifecycle yönetir.
- `localFailureRegistry`: crash, boş cevap, özel token, timeout gibi hataları saklar.

Prompt builder ekran bileşenine gömülmemelidir. Okuma ekranı yalnızca “bu profil, bu okuma tipi, bu cihaz politikası” diyerek servis katmanını çağırmalıdır.

## Örnek Policy Nesnesi

```ts
type LocalIqDeviceTier =
  | 'local_0_unavailable'
  | 'local_1_survival'
  | 'local_2_low'
  | 'local_3_basic'
  | 'local_4_standard'
  | 'local_5_plus'
  | 'local_6_premium_device';

type LocalIqPolicy = {
  tier: LocalIqDeviceTier;
  backendOrder: Array<'gpu_mtp' | 'gpu' | 'cpu4' | 'cpu_short'>;
  initialInputTokens: number;
  initialOutputTokens: number;
  followUpInputTokens: number;
  followUpOutputTokens: number;
  maxFollowUps: number;
  personaMode: 'tiny' | 'short' | 'standard';
  guardrailMode: 'minimal' | 'short' | 'standard';
  memoryMode: 'none' | 'triggered_caveman' | 'typed_summary' | 'standard';
  retrievalMaxItems: number;
  allowBackgroundExtraction: boolean;
  allowEmbeddingModel: boolean;
  allowRealtimeTts: boolean;
  promptBudget: {
    guardrailPct: number;
    personaPct: number;
    profilePct: number;
    userFocusPct: number;
    domainDataPct: number;
    memoryPct: number;
    sessionSummaryPct: number;
    formatInstructionPct: number;
  };
};
```

## XCover Pro İçin İlk Öneri

XCover Pro başlangıç profili:

```ts
{
  tier: 'local_2_low',
  backendOrder: ['gpu_mtp', 'gpu', 'cpu4', 'cpu_short'],
  initialInputTokens: 640,
  initialOutputTokens: 240,
  followUpInputTokens: 560,
  followUpOutputTokens: 220,
  maxFollowUps: 2,
  personaMode: 'short',
  guardrailMode: 'minimal',
  memoryMode: 'triggered_caveman',
  retrievalMaxItems: 1,
  allowBackgroundExtraction: false,
  allowEmbeddingModel: false,
  allowRealtimeTts: false,
  promptBudget: {
    guardrailPct: 10,
    personaPct: 8,
    profilePct: 10,
    userFocusPct: 16,
    domainDataPct: 40,
    memoryPct: 6,
    sessionSummaryPct: 4,
    formatInstructionPct: 6
  }
}
```

Eğer benchmark sırasında GPU/MTP crash verirse `backendOrder` GPU’suz moda düşmelidir. Eğer CPU da çok yavaşsa cihaz `local_1_survival` sınıfına alınmalıdır.

## Ürün Kararı

Free IQ şu şekilde konumlanabilir:

- ücretsiz, kişisel ama kısa
- cihazına göre değişen derinlikte
- bazı cihazlarda hafızayı sınırlı kullanır
- güçlü cihazlarda daha akıllı ve daha uzun sohbet eder
- Pro/Premium API modları kadar uzun ve kapsamlı olacağı vaat edilmez

Bu hem maliyeti kontrol eder hem de yerel AI vizyonunu korur.

## Demo, Görsel ve Free Account Stratejisi

Free IQ her okuma tipinde bir yol sunmalıdır; fakat bu yol her zaman tam üretim olmak zorunda değildir. Bazı cihazlarda veya bazı okuma tiplerinde deneyim demo, kısa yorum, video, hazır WAV veya mock okuma ile desteklenebilir. Bu karar daha sonra ürün seviyesinde netleştirilecektir.

Bu bölüm özellikle kahve/el, doğum haritası ana yorumu, Kendini Tanı ve sesli deneyim için hatırlatma bölümüdür.

### Kahve ve El

Nihai hedef kahve/el okumalarında da Free IQ yolu olmasıdır.

Olası yollar:

- görseli 320x320 veya benzeri düşük çözünürlüğe sıkıştırmak
- önce vision-only model ile “fincan mı, tabak mı, el mi, okunabilir mi?” kontrolü yapmak
- görüntüden kısa teknik özet çıkarıp Gemma 4 E2B’ye metin olarak vermek
- düşük cihazlarda çok kısa yorum üretmek
- cihaz yetersizse demo/video/önizleme göstermek

Şimdilik karar:

- kahve/el için local multimodal kesin kabul edilmemelidir.
- ama “local hiç olmayacak” diye de kapı kapatılmamalıdır.
- testler sonucunda her cihaz tier’ı için ayrı davranış belirlenmelidir.

### Doğum Haritası Ana Yorumu

Doğum haritası ana yorumu düşük cihazlarda uzun üretilmemelidir. Free IQ için kısa bir doğum haritası özeti üretilebilir:

- 3-5 kısa paragraf
- yükselen/ev yorumu yalnızca doğum saati biliniyorsa
- memory çok az veya hiç yok
- Kendini Tanı essence katmanına yazılabilecek kısa profil özeti

Pro/Premium modda daha kapsamlı yorum API veya güçlü cihaz profiliyle üretilebilir.

### Kendini Tanı

Kendini Tanı testleri çoğunlukla LLM gerektirmemelidir. Eğer LLM kullanılacaksa Free IQ için her section 1-2 cümlelik çok kısa yorum olmalıdır.

Örnek:

- MBTI veya kişilik testi sonucu: kısa profil dili
- temel numeroloji: kısa sayı özeti
- doğum haritası essence: düşük-orta ağırlıklı kişiyi tanıma sinyali

Bu çıktılar diğer Senin Evin okumalarında düşük-orta ağırlıklı “kişiyi tanıma” bağlamı olarak kullanılabilir; fakat Kendini Tanı ana analizleri üretilirken diğer memory ile fazla karıştırılmamalıdır.

### Sesli Demo

Free kullanıcıya ses deneyimi tattırmak için gerçek zamanlı ağır TTS şart değildir.

Olası yollar:

- persona başına hazır kısa WAV demosu
- “okuma hazırlanıyor” ekranında kısa lore/social ses klibi
- gerçek okumanın ilk birkaç cümlesini cihaz uygunsa TTS yapmak
- düşük cihazlarda ses modelini hiç çalıştırmadan hazır demo oynatmak

Ses modeli, yerel LLM ile aynı anda RAM’de tutulmamalıdır. Okuma üretimi bittikten sonra ve mümkünse model unload edildikten sonra TTS denenmelidir.

### Free Olmayan Kullanıcıya Demo

Free account olmayan ama yerel modeli olmayan kullanıcıya da ürünün hissini göstermek gerekebilir. Bu yüzden demo stratejisi yalnızca Free IQ başarısızlığı için değil, onboarding ve premium upsell için de kullanılabilir.

Karar daha sonra verilecek seçenekler:

- video demo
- hazır mock okuma
- kısa WAV persona tanıtımı
- gerçek kısa yerel okuma
- krediyle bulutta tamamlama

Bu kararlar ileride kredi/subscription sistemiyle birlikte netleştirilmelidir.

## Açık Konular

- LiteRT-LM 0.12.0 ile MTP/speculative decoding API’sinin kesin Kotlin parametre adı doğrulanmalı.
- Gemma 4 E2B’nin embedding/retrieval için pratik kalitesi ayrıca test edilmeli.
- Ayrı Gemma embedding 300M modelinin disk/RAM maliyeti ölçülmeli.
- Embedding Gemma veya benzeri küçük embedding modelinin retrieval kalitesi, token-overlap fallback’e karşı ölçülmeli.
- Küçük function model adayları memory tagging, entity extraction ve log sınıflandırma için test edilmeli.
- Vision-only model adayları kahve/el ön sınıflandırma için test edilmeli.
- Play Asset Delivery veya server/CDN model dağıtımı ayrı ürün kararı olarak netleşmeli.
- Memory audit ekranında Free IQ için “hangi bağlam neden prompta gitti” daha kısa ve okunur gösterilmeli.
- TTS için Supertonic veya başka ses modelinin local runtime maliyeti ayrıca ölçülmeli.
- Free IQ başarısızlığında krediyle bulutta tamamlama akışı kredi/subscription sistemi gelince ürünleştirilmeli.
- İngilizce localization için persona adı, guardrail ve memory dil politikaları önceden hazırlanmalı.
