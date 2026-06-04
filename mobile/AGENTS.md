# Proje Kuralları (Türkçe / UTF-8)

## ⚠️ KRİTİK: Türkçe Karakter Kuralları

- Proje dili Türkçe.
- Kullanıcıya görünen **tüm metinlerde** Türkçe karakter **zorunludur**: `ç, ğ, ı, İ, ö, ş, ü, Ç, Ğ, Ö, Ş, Ü`.
- Dosya kodlaması **UTF-8** olmalı. BOM kullanılmaz.

## Yasaklanan Paternler

### 1. ASCII-Türkçe (karakter düşürmesi)
Aşağıdaki gibi Türkçe kelimeleri özel karakter olmadan yazmak **YASAKTIR**:
- ❌ `icin`, `secim`, `baslat`, `gorsel`, `lutfen`, `ozellik`, `guncelle`
- ✅ `için`, `seçim`, `başlat`, `görsel`, `lütfen`, `özellik`, `güncelle`

### 2. Soru işareti replacement (encoding kaybı)
Türkçe karakterlerin `?` ile değiştirilmesi **YASAKTIR**:
- ❌ `ba?lang?ca cesaretle ad?m atma ?a?r?s?`
- ✅ `başlangıca cesaretle adım atma çağrısı`

Bu patern genellikle UTF-8 desteklemeyen bir ortamda kod üretildiğinde oluşur.

### 3. Mojibake (çift encoding hatası)
UTF-8 byte'larının Latin-1 olarak yorumlanmasından oluşan bozuk karakterler **YASAKTIR**:
- ❌ `Ã¼`, `Ã¶`, `Å`, `Ä±`, `ÅŸ`, `Ã§`
- ✅ `ü`, `ö`, `ş`, `ı`, `ş`, `ç`

## Özel Dikkat Gereken Dosyalar

### `src/data/divinationData.ts`
Bu dosya ~650 satır Türkçe metin içerir (tarot, melek kartları, runlar, I Ching, numeroloji).
**Bu dosyayı düzenlerken veya yeni veri eklerken özellikle dikkat et:**
- Her string literal'de `ş, ç, ğ, ı, ö, ü` karakterlerinin doğru UTF-8 olduğunu kontrol et.
- Asla `?` replacement veya mojibake bırakma.
- Emin değilsen, yazdığın metnin ilk satırını kontrol et: `ş` → `c59f`, `ç` → `c3a7`, `ğ` → `c49f`, `ı` → `c4b1`.

## Doğrulama

- Commit öncesi **mutlaka** `npm run check:turkish:utf8` çalıştır.
- Bu script mojibake, ASCII-Türkçe ve `?` replacement paternlerini tespit eder.
- Script hata verirse commit yapma, önce düzelt.

## Korunan Davranış Sözleşmeleri

Aşağıdaki akışlar özellikle korunmalıdır. Yeni özellik eklerken, refactor yaparken veya prompt/servis değiştirirken bu davranışları bozma; değiştirmek gerekiyorsa önce açıkça nedenini yaz ve ilgili akışı yeniden test et.

### Kahve ve El Falı Görsel Yükleme

- Kahve falında görsel slotları `Fincan 1`, `Fincan 2`, `Tabak` olarak kalmalı; minimum 1 görselle okuma yapılabilmeli.
- Tek bir `fincan+tabak` fotoğrafı geçerli kabul edilmeli; 2 fincan + 1 tabak yüklendiğinde bütün görseller birlikte analiz edilmeli.
- Her yüklenen görsel fincan, tabak veya fincan+tabak olabilir; ama telvesiz boş fincan/tabak, alakasız obje veya okunamayacak görseller reddedilmeli.
- Bir damla telve bile varsa görsel tamamen reddedilmemeli; telve çok azsa yorumda bu durum açıkça ama doğal biçimde anılmalı.
- Tabak, fincan, masa, obje, baskı, desen, çizim, logo, kumaş veya arka plan üzerindeki kendi desenlerinden yorum çıkarılmamalı; yalnızca telve/kahve izi yorumlanmalı.
- Okuma ekranında yüklenen kahve görselleri yan yana gösterilmeli ve her biri tıklanınca büyütülebilmeli.
- Kahve ve el falında kamera açılıyorsa varsayılan kamera arka kamera olmalı; selfie/ön kamera varsayılan olmamalı.
- LLM'e gönderilen görseller okunabilir çözünürlükte olmalı; gereksiz sıkıştırma, görseli modelin okuyamayacağı hale getirmemeli.
- Mikro life events seçimi, tekrar etmeme hafızası ve guardrail/prompt güvenlik kuralları korunmalı.

### İkram Masası Genel Astroloji

- Bu bölüm yalnızca `Genel Astro Günlük`, `Genel Astro Haftalık`, `Genel Astro Aylık` için geçerlidir; `Senin Evin` kişisel astroloji akışıyla karıştırılmamalıdır.
- Genel astroloji kişisel doğum haritası okuması değildir. Yükselen, Ay burcu, doğum saati, natal evler veya kişiye özel transit-natal açı iddiası kurulmamalıdır.
- Yorumlar yine de gerçek gökyüzü verisine dayanmalıdır: mevcut astro motorundan gelen transit pozisyonları, retro bilgileri, ana gökyüzü açıları ve dönem timeline verisi kullanılmalıdır.
- Teknik dil ölçülü olmalıdır: retro, kare, karşıt, kavuşum, sert etki, destekleyici etki gibi doğal ifadeler kullanılabilir; derece raporu, tablo dili, ev numarası veya fazla teknik harita anlatımı yapılmamalıdır.
- Aynı profil için aynı dönem içinde üretilen genel astro yorumu yeniden üretilmemeli; lokal cache önce okunmalıdır.
- Günlük yorum aynı gün, haftalık yorum aynı hafta, aylık yorum aynı ay boyunca aynı profil için aynı metni göstermelidir. Bu kural server cache, cihazdan on-demand LLM üretimi ve fallback için aynı şekilde geçerlidir.
- Server cache yoksa hemen kısa fallback'e düşülmemeli; önce gerçek gökyüzü verisiyle direct LLM üretimi denenmeli, fallback yalnızca son çare olmalıdır.
- Genel astro okumaları `general-astro` reading type ile hafızaya yazılmalı ve sonraki genel astro üretimlerinde tekrar etmeme bağlamı olarak kullanılmalıdır.
- Token hedefleri korunmalıdır: günlük 520 max output token ve 110-150 kelime, haftalık 720 max output token ve 150-210 kelime, aylık 820 max output token ve 170-230 kelime.

## Görsel Uygunluk Analizi Sözleşmesi

- Kahve, el ve pati okumalarında görsel uygunluk analizi yalnızca API/LLM sınıflandırmasıyla yapılır; deterministik kod, dosya adı, slot adı, OCR, renk analizi veya sabit heuristikle uygunluk kararı verilmez.
- Kahve yorumunda 1, 2 veya 3 görsel yüklenebilir. Görsellerin sırası önemli değildir. Her slotta telveli fincan, telveli tabak veya telveli fincan+tabak aynı fotoğrafta olabilir.
- Kahve yorumunda bütün yüklenen görseller API/LLM sınıflandırmasından geçmelidir. Telvesiz fincan/tabak, fincan veya tabak içermeyen görsel, kod ekranı, ekran görüntüsü ya da alakasız görsel reddedilir.
- Kahve yorumunun başlaması için en az 1 görselde gerçek kahve telvesi görünen fincan veya tabak bulunmalıdır. Uygun değilse kullanıcıdan telve içeren fincan veya tabak fotoğrafını yeniden yüklemesi istenir.
- El okumasında görsel uygunluk analizi yalnızca API/LLM sınıflandırmasıyla yapılır. Yalnızca insan avuç içi fotoğrafı kabul edilir; el sırtı, yüz, obje, ekran görüntüsü veya alakasız görsel reddedilir.
- Pati okumasında görsel uygunluk analizi yalnızca API/LLM sınıflandırmasıyla yapılır. Yalnızca hayvan patisi fotoğrafı kabul edilir; insan eli, hayvan yüzü/bedeni, obje, ekran görüntüsü veya alakasız görsel reddedilir.
- Kod değişikliği sonrası `rg "validateCoffeeImages\(|validatePalmImage\(|classifyCoffeeImage\(|classifyPalmImage\(" mobile/src` çıktısında kahve ve el/pati ana okuma başlatma yolunda bu API/LLM sınıflandırmasının korunduğunu kontrol et.
