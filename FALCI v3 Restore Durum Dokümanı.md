**Restore Çalışması Kaynak Notu**

Bu doküman restore sürecinin ana checklist/pusulasıdır. Adımlar burada tutulur, tamamlananlar ve açık kalanlar burada güncellenir.

Kontrol ve karşılaştırma için ayrıca aynı klasördeki `31 MAYIS SILINEN KURTARMA HAKKINDA CHAT.txt` dosyası kullanılmalı. Bu dosya bu restore dokümanından önce oluşturuldu; içinde 25 Mayıs son backup bilgisi, D drive recovery konumu, silinen app'i yaparkenki chatler/session logları ve başka path notları olabilir. Restore sırasında yalnızca 29-31 Mayıs loglarına kilitlenmeden, gerektiğinde bu eski chat dosyasındaki 25 Mayıs backup ve recovery path bilgileriyle çapraz kontrol yapılacak.

Final notu: Restore süreci kapatılırken `AGENTS.md` içindeki geçici “Restore Çalışması Direktifi” bölümü kaldırıldı. Bu doküman artık restore arşivi ve yapılan işlerin kaydı olarak tutuluyor.

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
Durum: Uygulandı; ileride yeni log kanıtı çıkarsa yeniden açılabilir.

Yapıldı:
- `RuhBAz memory architecture v2` çizgisine yakın memory dokümanı ve memory v2 restore edildi.
- Gemini embedding tarafı gerçek entegrasyona döndürüldü.
- `gemini-embedding-2` kullanım çizgisi geri getirildi.
- UTF-8 bozuklukları için kontroller çalıştırıldı.

Commit:
`5ccd870 Restore Gemini embedding memory v2 docs`

Sonradan tamamlanan:
- `profileMemoryService` küçük son ayarları derin karşılaştırıldı.
- Reading intent, follow-up question, correction memory, self-knowledge insight, semantic indexing, embedding indexing ve reading-derived memory v2 artifact çizgisi geri oturtuldu.

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
Durum: Uygulandı.

Yapıldı:
- Fal kapanışlarında hatırlanan persona kapanışı sistemi geri getirildi.
- `fortunePromptBuilder`, `fortuneApiService`, `followUpResponseService` tarafına bağlandı.

Commit:
`2a38e63 Restore follow-up and multi-image coffee flow`

Sonradan tamamlanan:
- Rüya, tarot, numeroloji ve astro kapanışları merkezi persona closing/sanitizer çizgisiyle karşılaştırıldı.
- Rüya remembered closing’e bağlandı.
- Astro, numeroloji ve tarot remembered closing geçmişli kapanış sistemine kontrollü ikinci fazda geçirildi.

6. **Astro package restore**
Durum: Uygulandı.

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

Sonradan tamamlanan:
- Kişisel astro, compatibility/family astro, astro follow-up ve doğum haritası memory snippet hatları kontrol edildi.
- Doğum haritası initial/follow-up memory snippet bağlantısı restore edildi.
- Astro ailesi final metinleri merkezi sanitizer ve remembered closing ikinci fazına bağlandı.

**Çalıştırılan Kontroller**

Geçti:
- `mobile` TypeScript kontrolü
- `mobile` Türkçe UTF-8 kontrolü
- `agent` Türkçe UTF-8 kontrolü
- `git diff --check`

Bilinen son temiz push:
- Branch: `codex/recovery-baseline`
- Son commit: Güncel branch commitleriyle ilerliyor; final cleanup öncesi son push ayrıca aşağıda işlenecek.

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
Durum: Uygulandı.

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

İkinci faz:
- Astro ve numeroloji kapanışları `completeWithRememberedPersonaClosing` geçmişli kapanış sistemine geçirildi.
- Tarot kapanışları da remembered history seçimine bağlandı; tarot özel domain leak temizliği ve tarot dışı sembol filtresi korunarak geçirildi.
- Rüya ve fortune tarafındaki remembered closing çizgisiyle aynı `falci-data/personal-closing-history.json` geçmişi kullanılmaya devam ediyor.

6. **Astro ailesi son kontrolü**
Durum: Uygulandı.

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

Son durum:
- Astro kapanışları remembered persona closing ikinci fazıyla geçmişli kapanış sistemine geçirildi.

7. **Prompt restore genel taraması**
Durum: Uygulandı.

Bakılanlar:
- `fortunePromptBuilder`
- `astroEngine`
- `dreamInterpretationService`
- `personalTarotService`
- `personalNumerologyEngine`
- animal profile prompt kuralları
- follow-up contract her yerde doğru kullanılıyor mu
- kısa cevap / uzun cevap / devam ettirme sistemleri

Bulgu:
- Prompt servislerinde `FOLLOW_UP_CHAT_CONTRACT`, memory prompt pack, pet mention memory context ve token instruction bağlantıları büyük ölçüde yerinde.
- Dokümandaki eski servis adları `tarotReadingService` / `numerologyService`; güncel gerçek dosyalar `personalTarotService` / `personalNumerologyEngine`.
- `mobile/src/identity/assistants/fortune-family/common.md` zengin ortak prompt kurallarını taşıyordu, generator da `common.md` okumaya hazırdı.
- Ancak generated `fortunePersonaData.ts` hâlâ eski/kısa `COMMON_FORTUNE_IDENTITY_BODY` taşıyordu; `common.md` restore içeriği runtime prompt verisine yansımamıştı.
- Suzan identity kaynak dosyasında ASCII-Türkçe `Kisa karşılama` kalmıştı.

Uygulananlar:
- `mobile/scripts/generate-fortune-persona-data.js` çalıştırılarak `fortunePersonaData.ts` identity markdown + `common.md` üzerinden yeniden üretildi.
- `COMMON_FORTUNE_IDENTITY_BODY` artık güncel ortak Vision/Safety/Length/Implementation kurallarını taşıyor.
- Persona `systemBody` içerikleri generator çizgisine uygun şekilde ortak bölümlerden ayrıldı; ortak kurallar `COMMON_FORTUNE_IDENTITY_BODY` üzerinden veriliyor.
- Suzan identity kaynağındaki `Kisa karşılama` -> `Kısa karşılama` düzeltildi ve generated dosya yeniden üretildi.

8. **Token usage ana ekran / genel sayaçlar**
Durum: Uygulandı.

Sen özellikle demiştin:
“usage genel token sayaçları main screen’de görünüyordu.”

Bakılanlar:
- Ana ekranda genel token usage görünümü var mı
- Okuma bazlı usage yazılıyor mu
- Görsel tokenları, metin tokenları, input/output ayrımı duruyor mu
- Multi-image coffee sonrası token hesabı doğru mu
- Gemini embedding ve hafıza analizi usage satırları ana tabloya düşüyor mu

Bulgu:
- `HomeScreen` içinde “Genel Token Sayaçları” paneli mevcut.
- Panel `tokenLedgerService` üzerinden satırları okuyor; image input, text input, output, total, raw prompt/output/total, USD/TRY ve safety K simülasyon toplamlarını gösteriyor.
- Kahve/el/pati akışı `useSession` üzerinden görsel token tahmini + text/output ayrımıyla ledger’a yazıyor; çoklu kahve fotoğrafı akışı da aynı image token ayrımına dahil.
- Rüya, tarot, kişisel astro, ilişki astro, doğum haritası ve numeroloji ekranları okuma/follow-up usage satırlarını yazıyor.
- Hafıza analizi ve Gemini embedding çağrıları da ayrı “Hafıza Analizi”, “Hafıza Embedding” ve “Hafıza Arama Embedding” satırları olarak genel tabloya yazılıyor.
- Genel astro Gemini üretimi raw usage alıyordu ama ledger’a yazmıyordu.

Uygulananlar:
- Genel astro Gemini üretimi artık `Genel Astro Günlük/Haftalık/Aylık` adıyla token ledger’a yazılıyor.
- Server cache veya lokal fallback dönen genel astro metinleri için sahte token yazılmıyor; yalnız gerçek Gemini çağrısı sayılıyor.

9. **Agent backend restore kontrolü**
Durum: Uygulandı.

Bakılanlar:
- `token_server.py`
- `/gemini-generate`
- `/gemini-embed`
- Gemini embedding endpoint
- Olası `/general-astro` endpoint eski loglarda var mıydı
- Backend UTF-8 metinleri
- Server cache mantığı

Bulgu:
- `token_server.py` restore edilmiş Gemini proxy çizgisinde çalışıyor.
- `/gemini-generate` endpoint'i mobil prompt payload'ını Gemini `generateContent` API'sine gönderiyor; effective/raw input-output-total token bilgilerini ve `tokenSafetyMultiplier` değerini döndürüyor.
- `/gemini-embed` endpoint'i `gemini-embedding-2` modelini kullanıyor; embedding vektörü ve effective/raw usage bilgisi dönüyor.
- `/gemini-api-key` ve `/health` endpointleri model, embedding model ve quota/health bilgisini taşıyor.
- 25 Mayıs sonrası loglarda `/gemini-generate` proxy hattı açıkça göründü; canlı backend bu çizgiyi ve embedding proxy ekini taşıyor.
- `/general-astro` için backend route kanıtı bulunmadı. Canlı frontend bunu yalnız opsiyonel server cache olarak deniyor; endpoint yoksa Gemini üretimi ve lokal fallback akışına düşüyor.
- `agent/AGENTS.md` eski “sadece api-key/health” sınırını taşıyordu ve canlı restore mimarisiyle çelişiyordu.

Uygulananlar:
- `agent/AGENTS.md` güncellendi; backend artık doğru şekilde Gemini anahtar/proxy ve kota/sağlık kapısı olarak tanımlanıyor.
- Endpoint listesi `/gemini-generate`, `/gemini-embed`, `/gemini-api-key`, `/health` olacak şekilde düzeltildi.
- `/general-astro` endpoint'inin zorunlu backend endpoint'i olmadığı, mobil tarafta opsiyonel cache denemesi olduğu belirtildi.

10. **Final clean git / commit / push**
Durum: Uygulandı.

Yapıldı:
- Son genel testler çalıştırıldı.
- Restore ana maddeleri ve remembered closing alt fazı kapatıldı.
- Geçici restore direktifi `AGENTS.md` içinden kaldırıldı.
- Restore dokümanı final arşiv/kapanış kaydı olarak güncellendi.
- Final commit/push bu maddeyle birlikte yapılacak.

**Bundan Sonra Sıra**

Restore checklist'i kapandı. Bundan sonra normal geliştirme veya yeni QA/iyileştirme işleri ayrı iş sırası olarak ele alınmalı.
