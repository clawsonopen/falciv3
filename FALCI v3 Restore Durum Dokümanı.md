**Restore Çalışması Kaynak Notu**

Bu doküman restore sürecinin ana checklist/pusulasıdır. Adımlar burada tutulur, tamamlananlar ve açık kalanlar burada güncellenir.

Kontrol ve karşılaştırma için ayrıca aynı klasördeki `31 MAYIS SILINEN KURTARMA HAKKINDA CHAT.txt` dosyası kullanılmalı. Bu dosya bu restore dokümanından önce oluşturuldu; içinde 25 Mayıs son backup bilgisi, D drive recovery konumu, silinen app'i yaparkenki chatler/session logları ve başka path notları olabilir. Restore sırasında yalnızca 29-31 Mayıs loglarına kilitlenmeden, gerektiğinde bu eski chat dosyasındaki 25 Mayıs backup ve recovery path bilgileriyle çapraz kontrol yapılacak.

Geçici directive notu: Restore süreci tamamen kapanıp normal geliştirmeye dönüldüğünde `AGENTS.md` içindeki “Restore Çalışması Direktifi” bölümü kaldırılmalı. Bu, final cleanup adımlarından biridir.

Haklısın. Ben sıradaki adımı bağlama göre değiştirince takip çizgisi dağılıyor. Bundan sonra restore işini şu **tek ana doküman/checklist** üzerinden götürelim. Hiçbir başlığı “unutulmuş” saymayacağız; sadece durumunu değiştireceğiz.

**FALCI v3 Restore Durum Dokümanı**

**Ana Hedef**
31 Mayıs silinmesi/bozuk restore sonrası, özellikle 25 Mayıs-31 Mayıs / gerekirse 1 Haziran sabahı arası Codex session loglarından uygulamanın son gelişmiş halini geri oturtmak; sonra temiz git state, commit ve push ile restore hattını sabitlemek.

**Bu Chatte Yapılanlar**

1. **Recovery baseline kuruldu**
Durum: Uygulandı.

Silinen/bozuk restore sonrası çalışılacak branch oluşturuldu:
`codex/recovery-baseline`

Restore işleri bu branch üzerinde ilerliyor.

2. **Memory Architecture v2 / RuhBAz çizgisi**
Durum: Büyük ölçüde uygulandı, ama “son küçük ayarlar” için hâlâ açık başlık var.

Yapıldı:
- `RuhBAz memory architecture v2` çizgisine yakın memory dokümanı ve memory v2 restore edildi.
- Gemini embedding tarafı gerçek entegrasyona döndürüldü.
- `gemini-embedding-2` kullanım çizgisi geri getirildi.
- UTF-8 bozuklukları için kontroller çalıştırıldı.

Commit:
`5ccd870 Restore Gemini embedding memory v2 docs`

Açık kalan:
- `profileMemoryService` için 29-31 Mayıs loglarında görünen küçük son farklar hâlâ derin karşılaştırılmalı.
- Özellikle memory indexing, reading intent, correction memory, self-knowledge insight, dedupe ve memory v2 artifact tarafında loglarda daha fazla parça olabilir.

3. **cup2 / çoklu kahve fotoğrafı akışı**
Durum: Uygulandı.

Yapıldı:
- `cup2`
- Çoklu kahve görseli süreklilik instruction’ı
- `CoffeeImageAnalysis`
- Setup ekranı bağlantısı
- `useSession`
- token hesabı
- `fortuneApiService`
- prompt builder bağlantıları

Commit:
`2a38e63 Restore follow-up and multi-image coffee flow`

4. **FOLLOW_UP_CHAT_CONTRACT**
Durum: Uygulandı.

Yapıldı:
- Ortak follow-up cevap sözleşmesi geri getirildi.
- Kahve/fal follow-up hattına bağlandı.
- Daha kısa, takip sorusuna cevap veren, yeniden fal üretmeyen cevap sistemi restore edildi.

Commit:
`2a38e63 Restore follow-up and multi-image coffee flow`

5. **completeWithRememberedPersonaClosing**
Durum: Fortune tarafında uygulandı; yayılım kontrolü hâlâ açık.

Yapıldı:
- Fal kapanışlarında hatırlanan persona kapanışı sistemi geri getirildi.
- `fortunePromptBuilder`, `fortuneApiService`, `followUpResponseService` tarafına bağlandı.

Commit:
`2a38e63 Restore follow-up and multi-image coffee flow`

Açık kalan:
- Bu sistem rüya, tarot, numeroloji, astro gibi diğer okuma türlerine doğru yayılmış mı, loglarla karşılaştırılmalı.
- Merkezi `genderedAddressSanitizer + persona closing yayılımı` başlığı altında ayrıca kontrol edilmeli.

6. **Astro package restore**
Durum: Genel astro tarafı uygulandı.

Yapıldı:
- Genel astro artık sadece basit fallback değil.
- Gerçek gökyüzü context’i geri geldi.
- Lokal astro hesapları prompt’a bağlandı.
- Genel astro akışı şu sıraya döndü:
  lokal cache -> server cache -> Gemini üretimi -> lokal fallback
- Önceki genel astro yorumlarını tekrar etmeme hafızası eklendi.
- Genel astro yorumları profile memory reading summary’ye yazılıyor.

Commit:
`a64f5c5 Restore general astro generation flow`

Açık kalan:
- Kişisel astro, compatibility/family astro ve astro follow-up tarafında loglardaki küçük son farklar hâlâ ayrıca taranmalı.
- Astro package restore “genel astro” tarafında tamamlandı; tüm astro ailesi için son kontrol açık.

**Çalıştırılan Kontroller**

Geçti:
- `mobile` TypeScript kontrolü
- `mobile` Türkçe UTF-8 kontrolü
- `agent` Türkçe UTF-8 kontrolü
- `git diff --check`

Bilinen son temiz push:
- Branch: `codex/recovery-baseline`
- Son commit: `a64f5c5`

**Eksiksiz Kalan Restore Başlıkları**

1. **profileMemoryService deep restore / küçük son ayarlar**
Durum: Uygulandı; ileride yeni log kanıtı çıkarsa yeniden açılabilir.

Neden önemli:
Memory v2’nin “asıl son hali” burada olabilir.

Bakılanlar:
- 29-31 Mayıs loglarındaki `profileMemoryService` farkları
- reading intent memory
- user correction memory
- self-knowledge profile insight
- semantic indexing
- embedding indexing
- memory v2 artifacts
- reading dedupe
- delete/clear profile memory behavior
- raw archive / session journal / fingerprint kayıtları

Uygulananlar:
- `appendUserReadingIntentMemory` geri getirildi.
- Okuma öncesi konu/niyet yazan akışlar bu fonksiyona bağlandı: kahve/el setup, konu odaklı kişisel astro, tarot initial intent.
- `appendUserConversationMemory` takip sorusu hafızası olarak güçlendirildi; yalnız sosyal cevapları hafızaya yazmıyor.
- Yeni niyet, takip sorusu, düzeltme, test sonucu ve self-knowledge insight gözlemleri sqlite memory node ve Gemini embedding index’e gönderiliyor.
- `applyMemoryAnalysisResult` analizden gelen user/reading observations için embedding index çağırıyor.
- Self-knowledge insight kaynak tipi log çizgisine uygun şekilde `reading-derived` yapıldı.
- Kahve/el gibi yüzeysel fal özetlerinin reading-derived topic/pattern belleğini şişirmemesi için `appendReadingSummary` içinde topic/pattern çıkarımı kapatıldı; memory v2 artifact kaydı korunuyor.
- 25 Mayıs backup path ve D drive recovery path erişilebilir durumda doğrulandı.

Commit:
`Restore profile memory intent indexing` başlıklı restore commit’i.

2. **Rüya yorum akışını kontrol et**
Durum: Uygulandı; merkezi gendered sanitizer yayılımı kendi maddesinde açık kalıyor.

Bakılanlar:
- Rüya initial interpretation
- Rüya follow-up
- persona closing sistemiyle uyumu
- kullanılan kapanışların tekrar etmemesi
- memory snippet kullanımı
- token usage kaydı
- UTF-8 / Türkçe görünür metinler
- loglarda 29-31 Mayıs değişikliği var mı

Uygulananlar:
- Rüya servisinde `FOLLOW_UP_CHAT_CONTRACT` geri bağlandı.
- Basit sosyal takip cevapları için `getSimpleFollowUpReply` kullanımı eklendi.
- Follow-up yanıtları `cleanFollowUpReply` ile temizleniyor.
- `completeWithRememberedPersonaClosing` merkezi helper olarak geri getirildi ve rüya initial/follow-up kapanışlarına bağlandı.
- Persona kapanış geçmişi `falci-data/personal-closing-history.json` altında tutuluyor; böylece aynı persona kapanışları farklı oturumlarda daha az tekrar ediyor.
- Rüya ekranı günlük hafıza bakımı sırasında yeni yorum isteğini `DAILY_MEMORY_WRITER_BUSY_MESSAGE` ile bloke ediyor.

Not:
- `genderedAddressSanitizer` dosyası mevcut değil; bu konu “Merkezi genderedAddressSanitizer + persona closing yayılımı” maddesinde bütün servisler için ayrıca ele alınacak.

Commit:
`Restore dream follow-up closing flow` başlıklı restore commit’i.

3. **El/pati görsel doğrulama yumuşatma paketi**
Durum: Uygulandı.

Bakılanlar:
- El falı görsel validasyonu çok sert mi
- Pati/hayvan profili görsel doğrulaması doğru mu
- Kullanıcı yanlışlıkla el/pati dışı görsel atınca UX
- “görsel reddi” dili fazla katı mı
- kahve multi-image restore ile çakışıyor mu

Bulgu:
- Mevcut `fortunePromptBuilder` zaten el görseli kısmi veya net değilse bunu kesin hata saymadan temkinli yorumlama talimatı taşıyordu.
- Ancak `fortuneApiService` validation katmanı yalnızca `human_palm` kabul ettiği için `human_hand_back` veya çizgileri kısmen seçilen el görselleri prompt'a hiç ulaşmadan reddediliyordu.
- Evcil hayvan/pati akışında tür farkı çok erken ve sert reddediliyordu; generic/belirsiz pati fotoğraflarında bu kullanıcıyı gereksiz bloklayabilirdi.

Uygulananlar:
- İnsan el okumasında `human_palm`, `human_hand_back` ve `handVisibleEnough` olan kısmi el görselleri kabul ediliyor.
- Evcil hayvan/pati okumasında tür uyuşmazlığı yalnızca sınıflandırma açık ve yüksek güvenliyse reddediliyor; generic `animal_paw` veya düşük güvenli belirsiz pati fotoğrafları akışa bırakılıyor.
- Reddetme mesajları daha yumuşak, yeniden denemeye yönlendiren Türkçe UX diline çekildi.

Not:
- Tamamen yanlış görseller hâlâ reddediliyor; bu paket yalnızca el/pati sınırındaki belirsiz görselleri yumuşatıyor.

4. **Kısa okuma genişletme sistemi: kahve/el**
Durum: Uygulandı.

Bakılanlar:
- Kahve veya el yorumu kısa dönerse otomatik devam/genişletme var mı
- `MAX_TOKENS` kapanışları doğru tamamlanıyor mu
- Follow-up sistemiyle çakışmadan genişletme yapılabiliyor mu
- Persona closing iki kere ekleniyor mu
- Token usage doğru yazılıyor mu

Bulgu:
- Mevcut canlı dosyada kahve/el initial yorum kısa kaldığında otomatik genişletme yoktu.
- D recovery kopyasında `shouldExpandInitialSurfaceReading`, `expandShortInitialSurfaceReading`, `looksLikeImageRetryRequest` ve retry compact mantığı görülüyordu.
- Bu sistem yalnızca ilk kahve/el yüzey okuması için çalışmalı; follow-up cevaplarını veya görsel yeniden-yükleme mesajlarını genişletmemeli.

Uygulananlar:
- Kahve upload ve el/pati initial okumasında output token düşükse ya da metin çok az paragrafla dönmüşse ikinci bir Gemini çağrısıyla aynı persona/prompt çizgisinde genişletme eklendi.
- Genişletme çağrısının token usage’ı ana usage toplamına ekleniyor.
- Follow-up cevapları genişletme dışı bırakıldı.
- Modelin görsel yeniden-yükleme isteği ürettiği durumlar genişletme dışı bırakıldı ve kısa retry mesajı persona closing eklenmeden korunuyor.

5. **Merkezi genderedAddressSanitizer + persona closing yayılımı**
Durum: Kısmen uygulandı; remembered closing yayılımı için kontrollü ikinci faz açık.

Bakılanlar:
- Kullanıcıya cinsiyetli hitaplar yanlış geliyor mu
- Hayvan profillerinde insan romantik/iş/kariyer dili sızıyor mu
- Kahve, el, tarot, rüya, numeroloji, astro aynı sanitizer/closing mantığına mı bağlı
- `completeWithRememberedPersonaClosing` sadece fortune tarafında mı kaldı, diğer akışlarda eksik mi

Bulgu:
- `fortuneApiService` içinde yerel `sanitizeGenderedAddress` kopyası vardı; merkezi servis içinde ortak helper yoktu.
- Astro, numeroloji ve tarot prompt seviyesinde hitap politikası taşısa da final metin kapısında aynı sanitizer’dan geçmiyordu.
- Rüya ve fortune remembered persona closing çizgisine geçmiş durumda.
- Astro ve numeroloji `completeWithPersonaClosing` kullanıyor; tarot ise domain leak riskine karşı özel `completeWithTarotClosing` kullanıyor. Bunları tek hamlede remembered closing’e geçirmek davranış riski taşıyor.

Uygulananlar:
- `sanitizeGenderedAddress` merkezi olarak `personaClosingService` içine taşındı.
- Fortune yerel sanitizer kopyası kaldırıldı ve merkezi helper’a bağlandı.
- Astro, numeroloji ve tarot final metinleri merkezi sanitizer’dan geçiriliyor.
- Evcil hayvan profilleri sanitizer’da korunuyor; hayvan metinlerine insan hitap dönüşümü uygulanmıyor.
- Cinsiyet/yaş farkı bilinmeyen insan profillerinde riskli `kızım/oğlum/yavrum/evladım` türü hitaplar daha nötr dile çekiliyor.

Açık kalan kontrollü alt madde:
- Astro/numeroloji/tarot kapanışlarını `completeWithRememberedPersonaClosing` geçmişli kapanış sistemine geçirmek ayrıca değerlendirilecek. Özellikle tarot özel domain filtresi nedeniyle bu ayrı test isteyen bir iş.

6. **Astro ailesi son kontrolü**
Durum: Uygulandı; remembered closing alt fazı 5. maddede açık tutuluyor.

Tamamlanan:
- Genel astro generation/cache/repeat/Gemini hattı.
- Kişisel astro initial/follow-up memory snippet hattı mevcut.
- Compatibility/family astro initial/follow-up memory snippet hattı mevcut.
- Astro ailesi final metinleri merkezi gendered sanitizer’dan geçiriliyor.

Bulgu:
- Doğum haritası follow-up servisinde memory snippet desteği vardı, fakat ekran bu snippet’i göndermiyordu.
- Doğum haritası initial yorumu ise hiç memory snippet almıyordu; kişisel astro ekranındaki hafıza çizgisinden kopuktu.

Uygulananlar:
- `createBirthChartInterpretation` memory snippet alacak şekilde genişletildi.
- Doğum haritası initial prompt’una seçilmiş hafıza bağlamı eklendi.
- `BirthChartInterpretationScreen` initial yorumdan önce profile memory snippet yüklüyor.
- Doğum haritası follow-up sorularında soru bazlı semantic memory snippet yüklenip servise gönderiliyor.

Açık kalan kontrollü alt madde:
- Astro kapanışlarının `completeWithRememberedPersonaClosing` geçmişli kapanış sistemine geçirilmesi 5. maddedeki remembered closing ikinci fazına bağlı.

7. **Prompt restore genel taraması**
Durum: Açık.

Bakılacaklar:
- `fortunePromptBuilder`
- `astroEngine`
- `dreamInterpretationService`
- `tarotReadingService`
- `numerologyService`
- animal profile prompt kuralları
- follow-up contract her yerde doğru kullanılıyor mu
- kısa cevap / uzun cevap / devam ettirme sistemleri

8. **Token usage ana ekran / genel sayaçlar**
Durum: Açık veya kısmen restore edilmiş olabilir, net kontrol gerekiyor.

Sen özellikle demiştin:
“usage genel token sayaçları main screen’de görünüyordu.”

Bakılacaklar:
- Ana ekranda genel token usage görünümü var mı
- Okuma bazlı usage yazılıyor mu
- Görsel tokenları, metin tokenları, input/output ayrımı duruyor mu
- Multi-image coffee sonrası token hesabı doğru mu

9. **Agent backend restore kontrolü**
Durum: Açık.

Bakılacaklar:
- `token_server.py`
- `/gemini-generate`
- `/gemini-embed`
- Gemini embedding endpoint
- Olası `/general-astro` endpoint eski loglarda var mıydı
- Backend UTF-8 metinleri
- Server cache mantığı

10. **Final clean git / commit / push**
Durum: Henüz final değil.

Şu ana kadar ara restore commit’leri atıldı ve pushlandı. Ama tüm restore bitince:
- son genel testler
- temiz working tree
- final commit/push
- mümkünse restore summary dokümanı

**Bundan Sonra Sıra**

Benim önerdiğim tek sıra artık şu olsun:

1. `profileMemoryService deep restore / küçük son ayarlar`
2. Rüya yorum akışı
3. El/pati görsel doğrulama yumuşatma
4. Kısa okuma genişletme sistemi: kahve/el
5. Merkezi `genderedAddressSanitizer + persona closing` yayılımı
6. Astro ailesi kalan son kontrol
7. Token usage ana ekran/genel sayaçlar
8. Backend agent endpoint/cache kontrolü
9. Final test, commit, push, restore kapanış özeti

Bundan sonra sen “sıradaki” dediğinde bu listenin en üstteki açık maddesinden ilerleyeceğim.
