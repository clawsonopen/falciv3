# Ruhbaz Memory V2 Kapanış Durumu

Bu dosya Memory V2 işinin "sonra bakarız" diye dağılmaması için tutulur. Google Drive arşivleme bu kapsamın dışında bırakıldı.

## Şu An Kodda Olanlar

- Profil başına kalıcı JSON hafıza dosyaları: kullanıcı kaynaklı hafıza, okuma kaynaklı hafıza, raw archive, session journal, reading fingerprint, typed edge, source chunk, prompt audit.
- SQLite index: raw source, source chunk, memory node, memory edge, reading fingerprint, lore node ve lore edge tabloları.
- Caveman sıkıştırması: `runMemoryConsolidationForProfile` tekrar eden node kayıtlarını birleştirir, düşük güvenli reading-derived kayıtları zayıflatır.
- Prompt standardı: Senin Evin okumaları aynı memory priority mantığını kullanır. Konu/soru varsa en üst sinyal odur; yoksa profil ve okuma bağlamı öne çıkar.
- Kendini Tanı çıktıları: birth chart, temel numeroloji ve test sonuçları profil essence olarak düşük-orta ağırlıkla tutulur.
- Tekrar azaltma: reading fingerprint temaları, sembolleri ve kaçınılacak kalıp cümleleri prompt pack içine girer.
- Kullanıcı düzeltmesi: `appendUserCorrectionMemory` yüksek güvenli core memory ve `corrected_by_user` edge üretir.
- Prompt audit: `prompt-audits.json` hangi observation, chunk ve fingerprint kayıtlarının neden seçildiğini saklar.
- Lore graph: persona identity dosyalarından lore node/edge çıkarılır ve SQLite'a indexlenir.
- Bakım worker'ı: `runMemoryMaintenanceForAllProfiles` tüm profillerde consolidation çalıştırır.
- Retrieval fallback: gerçek embedding retrieval bağlanana kadar source chunk seçimi token-overlap index ile yapılır.

## Bilerek Korumaya Aldığımız Politika

- Raw archive ve reading history mümkün olduğunca silinmez.
- Prompt memory küçük tutulur; şişme prompta değil arşive gider.
- User-stated ve Kendini Tanı essence kolay kolay düşürülmez.
- Reading-derived düşük güvenli temalar zamanla zayıflatılır.
- Aktif index hedefi: 256 MB.
- Profil başı üst kota hedefi: 1 GB.
- Kota aşımı gerçek cihaz storage ölçümü ve Google Drive arşivleme gelince agresif silmeye dönecek; şimdilik veri kaybı yaratmamak için korumacı davranır.

## Hala Cihazda Doğrulanması Gerekenler

- Gerçek embedding retrieval için uyumlu bir yerel model yolu seçilecek.
- Tek başına completion, extraction ve embedding yapan yerel model adaylarında ilk token, toplam süre, RAM ve crash davranışı ölçülecek.
- Embedding retrieval Mico gibi ilişki/pet bağlantılarını token fallback'ten daha iyi yakalıyor mu doğrulanacak.
- Yerel model yolu uygun çıkmazsa API tabanlı okuma akışı mevcut şekilde çalışmaya devam edecek.

## Kapanış Kriteri

Memory V2, Google Drive hariç, şu koşullar sağlanınca ürün tarafında "tamam" sayılacak:

- Prompt audit ekranında her kişisel okuma için seçilen memory nedeni görülebilecek.
- Kullanıcı düzeltme flow'u UI'da bağlanacak.
- Lore admin/social ingest için ilk yönetim ekranı açılacak.
- 1 GB kota davranışı gerçek cihaz storage ölçümüyle doğrulanacak.
