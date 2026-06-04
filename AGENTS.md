# FALCI v3 — Genel Proje Kuralları

## ⚠️ KRİTİK: Türkçe Karakter Kuralları (Tüm Proje)

Bu proje Türkçe bir uygulamadır. **Tüm kullanıcıya görünen metinlerde** doğru UTF-8 Türkçe karakterler zorunludur.

### Yasaklanan paternler (hem `mobile/` hem `agent/` için geçerli):

1. **Soru işareti replacement**: `ba?lang?c`, `G?nl?k`, `?li?kiler` → **YASAK**
2. **Mojibake**: `Ã¼`, `Ã¶`, `Å`, `Ä±` → **YASAK**
3. **ASCII-Türkçe**: `icin`, `secim`, `gorsel` → **YASAK**

### Doğru kullanım:
- `başlangıç`, `Günlük`, `İlişkiler` ✅
- `ü`, `ö`, `ş`, `ı` ✅
- `için`, `seçim`, `görsel` ✅

### Doğrulama komutları:
- **Frontend**: `cd mobile && npm run check:turkish:utf8`
- **Backend**: `cd agent && python scripts/check_turkish_utf8.py`

Her iki komutu da commit öncesi çalıştır.

Detaylı kurallar için bkz:
- `mobile/AGENTS.md`
- `agent/AGENTS.md`

## Mimari / UX Gelecek Uyumluluğu

Yeni özellik eklerken her zaman şu soruyu sor: **Bu özellik ileride farklı bir flow'dan çağrılabilir mi?**

- İş mantığını ekran bileşenlerine gömme.
- Profil seçimi, fal türü seçimi, görsel yükleme, oturum başlatma, token yazımı ve hafıza analizi gibi akışları mümkün olduğunca servis/hook katmanında tut.
- UI/UX ileride wheel menu, karakter odaklı seçim, ritüel akışı veya başka bir giriş deneyimine dönüşebilirmiş gibi gevşek bağlı tasarla.
- Yeni ekranlar mevcut iş mantığını yeniden yazmak yerine var olan servisleri çağırabilmeli.

## Kahve / El / Pati Görsel Uygunluk Sözleşmesi

- Kahve, el ve pati okumalarında görsel uygunluk analizi yalnızca API/LLM sınıflandırmasıyla yapılır; deterministik kod, slot adı, dosya adı, OCR, renk analizi veya sabit heuristikle uygunluk kararı verilmez.
- Kahve yorumunda 1, 2 veya 3 görsel yüklenebilir. Görsellerin sırası önemli değildir; her slotta telveli fincan, telveli tabak veya telveli fincan+tabak aynı fotoğrafta olabilir.
- Kahve yorumunda telvesiz fincan/tabak, fincan veya tabak içermeyen görsel, kod ekranı, ekran görüntüsü ya da alakasız görsel reddedilir. En az 1 gerçek telveli fincan veya tabak görseli yoksa kullanıcıdan yeniden yükleme istenir.
- El okumasında yalnızca insan avuç içi fotoğrafı kabul edilir; el sırtı veya alakasız görsel reddedilir.
- Pati okumasında yalnızca hayvan patisi fotoğrafı kabul edilir; insan eli, hayvan yüzü/bedeni veya alakasız görsel reddedilir.
