# Proje Kuralları (Türkçe / UTF-8)

- Proje dili Türkçe.
- Kullanıcıya görünen metinlerde Türkçe karakter zorunlu: `ç, ğ, ı, İ, ö, ş, ü`.
- ASCII-Türkçe biçimler kullanılmaz: ör. `icin`, `secim`, `baslat`, `gorsel`, `lutfen`.
- Dosya kodlaması UTF-8 olmalı.
- Mojibake karakter dizileri (`Ã`, `Ä`, `Å`, `�`) kabul edilmez.
- Yeni metin eklerken mevcut metinleri ASCII'ye düşürme; UTF-8 Türkçe ile yaz.
- Commit öncesi `npm run check:turkish:utf8` çalıştır.
