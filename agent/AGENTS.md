# Proje Kuralları — Backend (Türkçe / UTF-8)

## ⚠️ KRİTİK: Türkçe Karakter Kuralları

- Proje dili Türkçe. Kullanıcıya ulaşan tüm metinler Türkçe olmalıdır.
- Dosya kodlaması **UTF-8** olmalı.
- Tüm string literal'lerde Türkçe karakter **zorunludur**: `ç, ğ, ı, İ, ö, ş, ü, Ç, Ğ, Ö, Ş, Ü`.

## Yasaklanan Paternler

### 1. Soru işareti replacement (encoding kaybı)
Türkçe karakterlerin `?` ile değiştirilmesi **YASAKTIR**:
- ❌ `"Bo?a"`, `"G?nl?k"`, `"?li?kiler"`, `"G?ky?z?"`, `"?neri"`
- ✅ `"Boğa"`, `"Günlük"`, `"İlişkiler"`, `"Gökyüzü"`, `"Öneri"`
- ❌ `"ba?lang?ca cesaretle ad?m atma ?a?r?s?"`
- ✅ `"başlangıca cesaretle adım atma çağrısı"`

Bu patern, UTF-8 desteklemeyen bir ortamda kod üretildiğinde oluşur.

### 2. Mojibake (çift encoding hatası)
UTF-8 byte'larının Latin-1 olarak yorumlanmasından oluşan bozuk karakterler **YASAKTIR**:
- ❌ `Ã¼`, `Ã¶`, `Å`, `Ä±`, `ÅŸ`, `Ã§`
- ✅ `ü`, `ö`, `ş`, `ı`, `ş`, `ç`

### 3. ASCII-Türkçe (karakter düşürmesi)
- ❌ `icin`, `secim`, `baslat`, `gorsel`, `lutfen`
- ✅ `için`, `seçim`, `başlat`, `görsel`, `lütfen`

## Özel Dikkat Gereken Dosyalar

### `token_server.py`
Bu dosyada burc adları, section label'ları, fallback ve filler metinleri gibi hardcoded Türkçe stringler var.
Örnekler: `sign_tr` dict'leri, `labels` listesi, `filler` listesi, `fallback` metinleri.
Bu stringleri düzenlerken `ş, ç, ğ, ı, ö, ü, İ` karakterlerinin doğru UTF-8 olduğunu mutlaka doğrula.

### `persona_prompt_builder.py`
Persona prompt metinleri ve kapanış cümleleri Türkçe karakter içerir.

## Doğrulama

- Commit öncesi `python scripts/check_turkish_utf8.py` çalıştır.
- Script hata verirse commit yapma, önce düzelt.
- JSON dosyaları yazarken `json.dumps(..., ensure_ascii=False)` ve `encoding="utf-8"` kullan.
