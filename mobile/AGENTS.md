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
