**FALCI Hafıza Mimarisi**
Bu sistem basit “memory” değil; **kullanıcıyı, yakınlık profillerini, falcı ailesini, sosyal lore’u ve bunların arasındaki ilişkileri zaman içinde öğrenen on-device hafıza sistemi** olacak. Android ve iOS baştan birlikte düşünülmeli.

**1. Ana İlke**
FALCI kullanıcıyı tanır ama sabitlemez.

- Kullanıcının kendi söylediği şeyler fallarda çıkanlardan daha değerlidir.
- Astro, doğum haritası, MBTI ve oyun davranışları kesin hüküm değil, yumuşak eğilim sinyalidir.
- Ana falda memory az ve zarif kullanılmalıdır.
- Derin memory daha çok follow-up, danışmanlık, “geçen sefer” soruları ve kişisel modüllerde kullanılmalıdır.
- Raw data sıkıştırmayla yok edilmez; sadece süre/alan politikasıyla kontrollü arşivlenir.

**2. Mevcut Durum**
Şu an sistemde:

- Kişisel fal history var: hesap genelinde son 100 fal.
- Transcript var: ana fal + follow-up soru/cevap.
- `user-stated` ve `reading-derived` memory var.
- Retrieval RAG-lite: keyword/heuristic seçim.
- Embedding, LLM wiki, gerçek graph yok.
- Genel fallar kişisel history’ye yazılmıyor; günlük cache gibi çalışıyor.

Yeni mimari bunların üstüne kurulacak.

**3. Katmanlar**
| Katman | Görev |
|---|---|
| **Raw Evidence Vault** | Fal transcriptleri, follow-up’lar, profil editleri, MBTI, oyun olayları, sosyal lore postları ham saklanır. |
| **Episode Memory** | Her fal/test/oyun/sosyal olay kısa ve anlamlı episode’a çevrilir. |
| **Human Meaning Layer** | Bilginin insani önemini puanlar: kırılganlık, tekrar, ilişki etkisi, kapanmamışlık. |
| **User Graph** | Kullanıcı, yakınları, ilişkileri, temaları, hassasiyetleri. |
| **Falcı Ailesi Lore Graph** | Dürdane, Bahar, Caner, Hikmet, Mert ve ileride sosyal hesaplarındaki olaylar. |
| **Bond Graph** | Kullanıcı ile falcı ailesi arasındaki bağ: güven, tercih, yakınlık. |
| **LLM Wiki** | Kullanıcı ve falcı ailesi için okunabilir, güncellenen bilgi sayfaları. |
| **Vector Index** | Chunk/wiki/episode/node parçalarını semantic search’e açar. |
| **Context Planner** | Her fala/follow-up’a girmeden önce gerekli bağlamı seçer. |

**4. Storage**
Hedef: **on-device SQLite**, Android + iOS ortak schema.

Tablolar:

| Tablo | İçerik |
|---|---|
| `profiles` | Ana kullanıcı ve yakınlık profilleri |
| `assistants` | Falcı aile bireyleri |
| `assistant_social_accounts` | Her falcının ileride ayrı sosyal hesapları |
| `social_posts` | Falcıların post/reels/story kayıtları |
| `episodes` | Fal, oyun, test, meditasyon, sosyal lore olayı |
| `messages` | Raw transcript mesajları |
| `nodes` | Kişi, tema, olay, duygu, hassasiyet, tercih, ritüel |
| `edges` | Node ilişkileri |
| `wiki_pages` | Kullanıcı wiki’si ve lore wiki’si |
| `chunks` | Aranabilir metin parçaları |
| `embeddings` | On-device embedding vektörleri |
| `open_questions` | Falcıların ileride sorabileceği doğal sorular |
| `memory_audit` | Kaynak, kanıt, tarih, confidence |
| `storage_policy` | Rolling/retention kuralları |
| `annual_digests` | Yıllık özet hafıza |

**5. Kaynak Ağırlığı**
Ağırlık sırası:

1. Kullanıcının açıkça söylediği bilgi
2. Kullanıcının follow-up soruları
3. Profil, MBTI, oyun/test cevapları
4. Tekrar eden kullanıcı gündemleri
5. Falcı yorumundan çıkan tekrar eden tema
6. Tek seferlik fal sembolü
7. Belirsiz LLM çıkarımı

Kural: `reading-derived` bilgi, kullanıcı doğrulamadıkça gerçek hayat bilgisi gibi konuşulmaz.

**6. Human Meaning Layer**
Her önemli memory item şunları taşımalı:

- `sourceType`
- `sourceReliability`
- `userConfirmed`
- `humanImportance`
- `emotionalWeight`
- `vulnerabilityLevel`
- `relationshipImpact`
- `unresolvedness`
- `recurrence`
- `freshness`
- `agency`
- `toneGuidance`
- `useInMainReading`
- `mentionCooldownDays`
- `lastMentionedAt`
- `sensitivity`
- `status`: active / stale / contradicted / resolved

Amaç: LLM sadece bilgiyi değil, bilginin kullanıcı için ne anlama geldiğini de görsün.

**7. Ana Falda Memory Politikası**
Ana falda memory fazla görünür olmayacak.

| Akış | Memory kullanımı |
|---|---|
| Ana fal | 1-2 hafif kişiselleştirme |
| Follow-up | Derin bağlam |
| “Geçen sefer” sorusu | İlgili geçmiş direkt |
| Falı Bitir sonrası | Tam analiz |
| Danışmanlık/sohbet | Zengin memory |

Ana falda exclude:

- hassas/kırılgan konular
- başka profiller
- son günlerde tekrar edilmiş temalar
- kullanıcı sormadan eski ilişki/aile/para gibi ağır konular
- reading-derived-only tekrarlar

Kural: **Memory ana falı yönetmez; ana falı zarifçe kişiselleştirir.**

**8. Personalization Memory**
Doğum haritası, astro, profil, MBTI ve oyun davranışları:

- eğilim sinyali olarak kullanılır,
- kesin karakter hükmü olmaz,
- kullanıcının bugünkü haliyle birlikte değerlendirilir,
- dinamik ve değişebilir kabul edilir.

Yanlış dil: “Sen böylesin.”  
Doğru dil: “Bu sende böyle bir eğilim yaratıyor olabilir.”

**9. Yakınlık Profilleri**
Kullanıcı başka profiller oluşturabiliyor. Yeni mimaride onlar için de memory olacak ama kaynak etiketi farklı olmalı.

- Ana kullanıcı için: `user-stated`
- Yakınlık profili için: `owner-stated-about-profile`
- O profile bakılan fal için: `reading-derived-about-profile`

Yani “bu kişi kesin böyledir” değil: “kullanıcı bu kişi hakkında şunu anlattı” diye saklanır.

**10. Graph**
Üç graph birlikte çalışır:

| Graph | Görev |
|---|---|
| **User Graph** | Kullanıcı, yakınları, olayları, temaları |
| **Lore Graph** | Falcı ailesi ve sosyal medya evreni |
| **Bond Graph** | Kullanıcı-falcı ailesi bağı |

Örnek edge’ler:

- `parent_of`
- `sibling_of`
- `mentions`
- `asked_about`
- `trusts_for`
- `prefers`
- `resonates_with`
- `sensitive_about`
- `conflicts_with`
- `supports`
- `belongs_to_episode`

**11. Falcı Ailesi Sosyal Lore**
İleride her falcının ayrı sosyal hesabı olabilir.

Örnek:

- Caner: “Ailemi ziyarete gidiyorum.”
- Bahar: “Kardeşim geliyormuş.”
- Dürdane: “Evlatlarım bayramda yanımda.”

Sistem bunu tek lore olayına bağlar:

- `Bayram aile ziyareti`
- Caner, Bahar, Dürdane katılımcı
- Caner sibling_of Bahar
- Dürdane parent_of Caner/Bahar

Böylece aile sosyal medyada yaşayan tutarlı bir evren olur.

**12. LLM Wiki**
Kullanıcı wiki sayfaları:

- `Kimdir?`
- `Önemli Kişiler`
- `Romantik İlişkiler`
- `Aile`
- `Kariyer ve Para`
- `Duygusal Paternler`
- `Doğum Haritası`
- `MBTI / Kişilik Sinyalleri`
- `Oyun Davranışları`
- `Falcı Ailesiyle Bağ`
- `Açık Sorular`
- `Hassasiyetler`

Lore wiki:

- `Dürdane Hanım`
- `Caner`
- `Bahar Hanım`
- `Hikmet Bey`
- `Mert Bey`
- `Aile İçi Dinamikler`
- `Sosyal Medya Hikâyeleri`
- `Sezonluk Lore`
- `Kullanıcılarla Bağ Kurma Biçimleri`

Wiki türevdir; raw arşivin yerine geçmez.

**13. Retrieval**
Hedef retrieval: **hybrid retrieval**.

Sıra:

1. Direct lookup: profil, doğum, aktif oturum
2. Graph retrieval: kişi/tema/falcı/lore bağları
3. Vector RAG: EmbeddingGemma ile semantic search
4. Keyword/FTS fallback
5. Rerank: confidence, recency, source, user-confirmed, graph closeness
6. Context Pack: LLM’e dengeli ve kısa bağlam

Context pack ayrı modlara sahip olmalı:

- `main_reading_light`
- `followup_deep`
- `memory_analysis`
- `advisor_mode`
- `lore_social_mode`

**14. Embedding**
Ana aday:

`embeddinggemma-300M_seq2048_mixed-precision.tflite`

Neden:

- Android + iOS ortak denenebilir.
- Genel `.tflite`.
- Qualcomm/MediaTek özel değil.
- CPU/GPU/NPU özel dosya değil.
- Uzun wiki/episode chunk için daha güvenli.

Platform:

| Android | iOS |
|---|---|
| LiteRT / MediaPipe | MediaPipe Text Embedder native bridge |

App tarafında ortak arayüz:

`EmbeddingProvider.embed(text): Promise<number[]>`

Fallback:

- keyword/FTS
- Gemini embedding API
- daha küçük `seq512`

**15. 500 MB Sabit Hafıza Bütçesi**
Hedef üst sınır: **500 MB / cihaz / yoğun kullanıcı**.

Yaklaşık bütçe:

| Katman | Bütçe |
|---|---:|
| Embedding model | ~200 MB |
| Raw transcript | 80-120 MB |
| Episode summaries | 20 MB |
| Wiki + graph | 30-50 MB |
| Embedding vectors | 80-120 MB |
| SQLite/index overhead | 20-40 MB |
| Güvenlik payı | 30-50 MB |

**16. Rolling Retention**
500 MB sabit kalacak. Eski raw transcriptler yıllık/alan dolunca silinir ama anlam silinmez.

Kural:

**Raw silinebilir; anlam silinmez.**

Raw silmeden önce:

1. Episode summary var mı kontrol edilir.
2. Önemli bilgiler graph/wiki’ye işlendi mi kontrol edilir.
3. Yıllık digest üretilir.
4. Raw message chunk’ları ve raw’a bağlı vectorler silinir.
5. Summary/wiki/node vectorleri kalır.
6. Index vacuum/rebuild yapılır.

**17. Vector Bağlantısı**
Her embedding bir `source_ref` taşır:

- `raw_message`
- `episode_summary`
- `annual_digest`
- `wiki_section`
- `graph_node`
- `graph_edge`
- `open_question`

Raw silinirse sadece raw’a bağlı vector silinir. Summary/wiki/graph vectorleri durduğu için retrieval bozulmaz; sadece eski dönemin çözünürlüğü düşer.

**18. Yıllık Digest**
Her yıl sonunda:

- `annual_digest_2026`
- `top_people_2026`
- `top_themes_2026`
- `resolved_topics_2026`
- `unresolved_topics_2026`
- `sensitive_topics_2026`
- `assistant_bonds_2026`

Bu insan hafızası gibi çalışır: eski yılın birebir cümleleri değil, temaları ve ilişkileri kalır.

**19. Agentic Öğrenme**
Her mesajda değil, oturum sonunda:

1. Extractor
2. Deduper
3. Contradiction checker
4. Human meaning scorer
5. Graph updater
6. Wiki updater
7. Open-question generator
8. Audit writer
9. Embedding/index updater

Bu düşük maliyetli, kontrollü ve hataya daha dirençli olur.

**20. Gizlilik**
Mümkün olduğunca on-device.

Serverda tutulabilir:

- email/account
- kredi/abonelik
- sosyal görev claim metadata
- aggregate token/kullanım metrikleri

Serverda tutulmamalı:

- fal transcriptleri
- memory
- wiki
- embedding vectors
- promptlar
- görseller
- sosyal screenshot içerikleri

Sync gelirse uçtan uca şifreleme düşünülmeli.

**Yapılacaklar**
1. Mevcut JSON memory’yi yeni SQLite schema’ya taşıma planı.
2. `sourceType` ve `humanMeaning` alanlarını tasarlama.
3. Ana fal/follow-up için ayrı retrieval policy yazma.
4. Episode summary üretimini ekleme.
5. Graph tablolarını kurma.
6. LLM wiki sayfalarını ekleme.
7. Embedding provider interface hazırlama.
8. Android+iOS `.tflite` runtime prototipi.
9. 500 MB storage watcher ve rolling retention.
10. Yıllık digest/compaction job.
11. Memory debug UI’yı graph/wiki/retrieval görünür hale getirme.

Net nihai yapı:

**On-device, 500 MB sabit bütçeli, raw geçmişi kontrollü döndüren, anlamı koruyan, kullanıcı sözünü üstün tutan, falcı ailesi lore’unu ve kullanıcı bağını graph içinde büyüten hybrid RAG + LLM wiki hafıza sistemi.**