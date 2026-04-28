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
