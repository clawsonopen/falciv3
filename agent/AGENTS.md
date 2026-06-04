# Proje Kuralları — Backend (Türkçe / UTF-8)

## Kritik: Türkçe Karakter Kuralları

- Proje dili Türkçe. Kullanıcıya ulaşan tüm metinler doğru UTF-8 Türkçe karakterlerle yazılmalı.
- Dosya kodlaması UTF-8 olmalı.
- String literal'lerde Türkçe karakterler doğru kullanılmalı: `ç, ğ, ı, İ, ö, ş, ü, Ç, Ğ, Ö, Ş, Ü`.

## Yasaklanan Paternler

### 1. Soru işareti replacement

Türkçe karakterlerin `?` ile değiştirilmesi yasaktır.

- Yanlış: `"Bo?a"`, `"G?nl?k"`, `"?li?kiler"`
- Doğru: `"Boğa"`, `"Günlük"`, `"İlişkiler"`

### 2. Mojibake

UTF-8 byte'larının yanlış yorumlanmasından oluşan bozuk karakterler yasaktır.

- Yanlış: `Ã¼`, `Ã¶`, `Ã…`, `Ã„±`
- Doğru: `ü`, `ö`, `ş`, `ı`

### 3. ASCII-Türkçe

- Yanlış: `icin`, `secim`, `baslat`, `gorsel`, `lutfen`
- Doğru: `için`, `seçim`, `başlat`, `görsel`, `lütfen`

## Backend Sınırı

Backend prompt üretmez; mobil uygulama promptu cihazda kurar. `token_server.py` yalnızca Gemini anahtar/proxy ve kota/sağlık kapısıdır.

`token_server.py` şu endpointleri sunar:

- `POST /gemini-generate`
- `POST /gemini-embed`
- `GET /gemini-api-key`
- `GET /health`

`/general-astro` şu an zorunlu backend endpoint'i değildir. Mobil taraf bunu opsiyonel server cache olarak dener; endpoint yoksa Gemini üretimi veya lokal fallback akışına düşer.

## Doğrulama

- Commit öncesi `python scripts/check_turkish_utf8.py` çalıştır.
- Script hata verirse commit yapma, önce düzelt.
