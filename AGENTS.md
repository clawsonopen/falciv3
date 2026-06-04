# FALCI v3 — Genel Proje Kuralları

## Restore Çalışması Direktifi

Geçici not: Restore tamamlanıp normal geliştirmeye dönülünce bu bölüm `AGENTS.md` dosyasından kaldırılmalı. Kalıcı proje kuralı değil, yalnızca 31 Mayıs kurtarma sürecinin çalışma pusulasıdır.

31 Mayıs silinmesi/bozuk restore sonrası kurtarma işlerinde ana ilerleme kaynağı:
- `C:\Users\ozany\Documents\FALCI v3\FALCI v3 Restore Durum Dokümanı.md`

Restore adımlarını bu dokümandaki açık/kapanmış maddelere göre sırayla yürüt. Yeni bulunan her sonuç, uygulanan commit ve açık kalan madde bu dokümanda güncel tutulmalı; paralel listeler oluşturarak restore sırasını dağıtma.

Kontrol ve kaynak karşılaştırması için ayrıca şu eski chat dosyasını kullan:
- `C:\Users\ozany\Documents\FALCI v3\31 MAYIS SILINEN KURTARMA HAKKINDA CHAT.txt`

Bu eski chat, `FALCI v3 Restore Durum Dokümanı.md` oluşturulmadan önceki kurtarma konuşmasıdır. İçinde 25 Mayıs son backup bilgisi, D drive recovery yolu, silinen app'i yaparkenki chat/session yönlendirmeleri ve başka path notları bulunabilir. Sadece 29-31 Mayıs loglarına kilitlenme; gerektiğinde bu dosyadaki 25 Mayıs backup/recovery path bilgileriyle karşılaştır.

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
