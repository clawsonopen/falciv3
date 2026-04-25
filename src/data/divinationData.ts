export type TarotCard = {
  name: string;
  upright: string;
  advice: string;
};

export type AngelCard = {
  name: string;
  message: string;
  action: string;
};

export type AngelNumber = {
  number: string;
  meaning: string;
  guidance: string;
};

export type RuneMeaning = {
  rune: string;
  keyword: string;
  message: string;
};

export type IChingHexagram = {
  no: number;
  name: string;
  insight: string;
};

export const TAROT_CARDS: TarotCard[] = [
  { name: 'The Fool', upright: 'Yeni başlangıç enerjisi', advice: 'Korkmadan ilk adımı at, ama detayları not al.' },
  { name: 'The Magician', upright: 'Niyetin gerçeğe dönüşmesi', advice: 'Kaynaklarını bir noktada toplayıp harekete geç.' },
  { name: 'The High Priestess', upright: 'Sezgi ve iç bilgelik', advice: 'Karar öncesi kısa bir sessizlik alanı aç.' },
  { name: 'The Empress', upright: 'Bereket ve üretkenlik', advice: 'Büyütmek istediğin konuya düzenli emek ver.' },
  { name: 'The Emperor', upright: 'Düzen ve otorite', advice: 'Sınırlarını net çiz, planını yazılı hale getir.' },
  { name: 'The Lovers', upright: 'Uyumlu seçim ve bağ', advice: 'Kalp ve mantığı aynı masada buluştur.' },
  { name: 'The Chariot', upright: 'İrade ve ilerleme', advice: 'Dağılma yerine tek hedefe odaklan.' },
  { name: 'Strength', upright: 'İç güç ve sabır', advice: 'Nazik ama kararlı kal; baskıya teslim olma.' },
  { name: 'Wheel of Fortune', upright: 'Döngü değişimi ve fırsat', advice: 'Şansı yakalamak için esnek kal.' },
  { name: 'The Sun', upright: 'Aydınlık sonuç ve canlılık', advice: 'Bugün görünür ol; emeğini saklama.' },
];

export const ANGEL_CARDS: AngelCard[] = [
  { name: 'Şifa', message: 'Kalbin yumuşadıkça yüklerin hafifliyor.', action: 'Bugün kendine nazik bir mola ver.' },
  { name: 'Korunma', message: 'Yolunda görünmez bir destek var.', action: 'Korku yerine güven cümlesi kur.' },
  { name: 'Netlik', message: 'Aradığın cevap sade bir adımda saklı.', action: 'Kararını bir cümleyle yaz.' },
  { name: 'Sabır', message: 'Gecikme, hazırlığın tamamlanması için geliyor.', action: 'Aceleyi bırak, ritmi koru.' },
  { name: 'Bereket', message: 'Küçük düzen büyük akışı değiştirir.', action: 'Bugün tek bir alanı toparla.' },
  { name: 'Cesaret', message: 'Kalbini titreten konu büyüme alanın olabilir.', action: 'Bir adım at ve geri dönme.' },
  { name: 'Arınma', message: 'Eski yükler bırakıldıkça alan açılır.', action: 'İhtiyacın olmayan bir şeyi bırak.' },
  { name: 'Uyum', message: 'İç denge dış sonuçları hızlandırır.', action: 'Nefesini yavaşlat, sonra konuş.' },
];

export const ANGEL_NUMBERS: AngelNumber[] = [
  { number: '111', meaning: 'Niyet kapısı açık', guidance: 'Düşünceni netleştir; tohum hızlı tutar.' },
  { number: '222', meaning: 'Denge ve güven', guidance: 'Sabırlı kal; süreç lehine ilerliyor.' },
  { number: '333', meaning: 'Yaratıcı destek', guidance: 'İfaden açık olsun; yardım geliyor.' },
  { number: '444', meaning: 'Temel ve korunma', guidance: 'Planını sağlamlaştır; adımın güçlü.' },
  { number: '555', meaning: 'Değişim eşiği', guidance: 'Eskiyi bırak, yeniyi karşıla.' },
  { number: '666', meaning: 'Odak düzeltmesi', guidance: 'Kaygıyı azalt, önceliği sadeleştir.' },
  { number: '777', meaning: 'İç bilgelik', guidance: 'Sezgine güven; cevap içeride.' },
  { number: '888', meaning: 'Bolluk akışı', guidance: 'Emek ve karşılık dengesi kuruluyor.' },
  { number: '999', meaning: 'Tamamlanma', guidance: 'Bir döngüyü kapatıp yeniye alan aç.' },
];

export const RUNES: RuneMeaning[] = [
  { rune: 'Fehu', keyword: 'Bereket', message: 'Kaynaklarını dengede tuttuğunda büyüme hızlanır.' },
  { rune: 'Uruz', keyword: 'Güç', message: 'Dayanıklılığın artıyor; kararlı adım kazandırır.' },
  { rune: 'Ansuz', keyword: 'Mesaj', message: 'Açık iletişim bugün kilitleri çözer.' },
  { rune: 'Raidho', keyword: 'Yol', message: 'Doğru rota için sade plan yeterli.' },
  { rune: 'Kenaz', keyword: 'Aydınlanma', message: 'Kafa karışıklığı yerini netliğe bırakıyor.' },
  { rune: 'Gebo', keyword: 'Denge', message: 'Vermek-almak uyumu ilişkilerini güçlendirir.' },
  { rune: 'Wunjo', keyword: 'Sevinç', message: 'Küçük bir haber moralini yükseltebilir.' },
  { rune: 'Jera', keyword: 'Hasat', message: 'Sabırlı emeğin karşılığını toplamaya başlıyorsun.' },
];

export const ICHING_HEXAGRAMS: IChingHexagram[] = [
  { no: 1, name: 'Yaratıcı', insight: 'Başlangıç enerjisi güçlü; ilk adımı erteleme.' },
  { no: 2, name: 'Alıcı', insight: 'Uyumlu kalmak bugün zorlamaktan daha verimli.' },
  { no: 3, name: 'Başlangıç Zorluğu', insight: 'İlk karmaşa doğal; düzen kurdukça akış açılır.' },
  { no: 5, name: 'Bekleyiş', insight: 'Doğru zaman yaklaşırken hazırlık yap.' },
  { no: 8, name: 'Birlik', insight: 'İşbirliği bugün tek başına efordan daha güçlü.' },
  { no: 11, name: 'Barış', insight: 'İç denge korunursa dış fırsatlar çoğalır.' },
  { no: 24, name: 'Dönüş', insight: 'Eski bir mesele yeni bilinçle kapanabilir.' },
  { no: 42, name: 'Artış', insight: 'Küçük iyileştirmeler büyük sonuç getirir.' },
];

export const DAILY_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'Hayatta en hakiki mürşit ilimdir.', author: 'Mustafa Kemal Atatürk' },
  { text: 'Bir mum, başka bir mumu tutuşturmakla ışığından bir şey kaybetmez.', author: 'Mevlana' },
  { text: 'Hayal gücü bilgiden daha önemlidir.', author: 'Albert Einstein' },
  { text: 'Dünyada görmek istediğin değişim ol.', author: 'Mahatma Gandhi' },
  { text: 'Ne kadar yavaş gittiğin önemli değil, yeter ki durma.', author: 'Konfüçyüs' },
  { text: 'Başlamanın sırrı konuşmayı bırakıp işe koyulmaktır.', author: 'Walt Disney' },
];

export const NUMEROLOGY_MEANINGS: Record<string, string> = {
  '1': 'Başlangıç, liderlik ve cesaret.',
  '2': 'Uyum, denge ve ilişki zekası.',
  '3': 'İfade, yaratıcılık ve sosyal akış.',
  '4': 'Düzen, emek ve sağlam temel.',
  '5': 'Değişim, hareket ve esneklik.',
  '6': 'Sorumluluk, şefkat ve koruma.',
  '7': 'İçgörü, analiz ve derinleşme.',
  '8': 'Güç, yönetim ve maddi akış.',
  '9': 'Tamamlanma, bırakış ve şifa.',
  '11': 'Sezgi, ilham ve farkındalık.',
  '22': 'Büyük inşa enerjisi ve vizyonu somutlama.',
  '33': 'Şefkatli rehberlik ve yüksek hizmet bilinci.',
};

