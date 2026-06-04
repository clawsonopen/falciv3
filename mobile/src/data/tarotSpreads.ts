export type TarotSpreadId =
  | 'single-insight'
  | 'big-picture'
  | 'star-power'
  | 'relationship-deep'
  | 'should-i'
  | 'confidence'
  | 'turning-point'
  | 'celtic-cross'
  | 'conflict'
  | 'relationship-check';

export type TarotSpreadPosition = {
  no: number;
  title: string;
  meaning: string;
  guideQuestion: string;
  col: number;
  row: number;
  crossed?: boolean;
};

export type TarotSpread = {
  id: TarotSpreadId;
  title: string;
  cardCount: number;
  purpose: string;
  gridColumns: number;
  gridRows: number;
  positions: TarotSpreadPosition[];
};

export const TAROT_SPREADS: TarotSpread[] = [
  {
    id: 'single-insight',
    title: 'Tek Kartlık İçgörü',
    cardCount: 1,
    purpose: 'Aklındaki konuya tek ve net bir sembolik cevap al. Hızlı yön, ana enerji ve kısa farkındalık için.',
    gridColumns: 1,
    gridRows: 1,
    positions: [
      {
        no: 1,
        title: 'Meselenin Kalbi',
        meaning: 'Durumun en yoğun, en saf enerjisi.',
        guideQuestion: "Bu kart olan bitene bakışını nasıl değiştiriyor?",
        col: 1,
        row: 1,
      },
    ],
  },
  {
    id: 'big-picture',
    title: 'Büyük Resmi Gör',
    cardCount: 8,
    purpose: 'Hayatının iş, para, ilişki, destek ve yakın gelecek gibi ana alanlarına geniş açıdan bak.',
    gridColumns: 5,
    gridRows: 3,
    positions: [
      { no: 1, title: 'Kariyer / Gelişim', meaning: 'İş, üretim veya kişisel gelişim hattı.', guideQuestion: 'Bu alan doğru yöne mi gidiyor, daha fazla büyüme için ne gerekiyor?', col: 3, row: 3 },
      { no: 2, title: 'Bilgi / Deneyim', meaning: 'Şu anki bilgi, beceri ve öğrenme alanı.', guideQuestion: 'Mevcut deneyimlerin ihtiyacına hizmet ediyor mu?', col: 2, row: 2.5 },
      { no: 3, title: 'Geçmiş Etkiler', meaning: 'Geçmişten gelen ve bugünü etkileyen izler.', guideQuestion: 'Bu geçmiş etkiler bilgelik mi taşıyor, yoksa bırakılması mı gerekiyor?', col: 1, row: 2 },
      { no: 4, title: 'Maddi Durum', meaning: 'Para, güvenlik, kaynak ve somut zemin.', guideQuestion: 'Bu enerji maddi zemini destekliyor mu, zorluyor mu?', col: 2, row: 1.5 },
      { no: 5, title: 'Dışarıdan Görünüş', meaning: 'Dünyanın seni şu an nasıl algıladığı.', guideQuestion: 'Dış imajınla iç hissin arasında uzlaşma gerekiyor mu?', col: 3, row: 1 },
      { no: 6, title: 'Aşk / Duygular', meaning: 'İlişkiler, sevgi, yakınlık ve duygusal etkiler.', guideQuestion: 'Bu etki sağlıklı bağ ve duygusal büyüme sunuyor mu?', col: 4, row: 1.5 },
      { no: 7, title: 'Destekler', meaning: 'Yanındaki güçler, müttefikler ve kaynaklar.', guideQuestion: 'Bu destek ulaşmak istediğin şey için yeterli mi?', col: 5, row: 2 },
      { no: 8, title: 'Olası Gelecek', meaning: 'Mevcut plan devam ederse beliren yön.', guideQuestion: 'Bu olası gelecek sana uyuyor mu, değişiklik gerekiyor mu?', col: 4, row: 2.5 },
    ],
  },
  {
    id: 'star-power',
    title: 'Yıldıza Sor',
    cardCount: 6,
    purpose: 'Belirli bir soru için meselenin kalbini, engelleri, destekleri, gerekli değişimi ve olası sonucu gör.',
    gridColumns: 4,
    gridRows: 3,
    positions: [
      { no: 1, title: 'Meselenin Kalbi', meaning: 'Sorunun merkezindeki ana enerji.', guideQuestion: 'Bu kart sorunun özünü nasıl tarif ediyor?', col: 2.5, row: 1 },
      { no: 2, title: 'Buraya Getiren Süreç', meaning: 'Bu noktaya gelmene yol açan geçmiş akış.', guideQuestion: 'Bu süreç şu anki soruyu nasıl şekillendirdi?', col: 1.5, row: 3 },
      { no: 3, title: 'Engeller', meaning: 'Karşındaki zorluklar ve tıkanıklıklar.', guideQuestion: 'Hangi engel gerçek, hangisi algıda büyüyor?', col: 4, row: 1.5 },
      { no: 4, title: 'Güçler / Destekler', meaning: 'Yardım eden kaynaklar ve güçlü yanlar.', guideQuestion: 'Bu destekleri nasıl kullanabilirsin?', col: 1, row: 1.5 },
      { no: 5, title: 'Gerekli Değişim', meaning: 'Yönü açmak için değişmesi gereken tutum.', guideQuestion: 'Hangi seçim veya alışkanlık güncellenmeli?', col: 3.5, row: 3 },
      { no: 6, title: 'Bugünkü Olası Sonuç', meaning: 'Mevcut enerjiyle beliren final ihtimali.', guideQuestion: 'Bu sonuç hangi şartlarda değişebilir?', col: 2.5, row: 2 },
    ],
  },
  {
    id: 'relationship-deep',
    title: 'İlişkiye Derin Bakış',
    cardCount: 7,
    purpose: 'İki kişinin ilişkiye ne taşıdığını ve aradaki bağın nasıl çalıştığını katmanlı şekilde incele.',
    gridColumns: 5,
    gridRows: 2,
    positions: [
      { no: 1, title: 'Kişi 1 / İlk Nitelik', meaning: 'Birinci kişinin ilişkiye taşıdığı ilk ana nitelik.', guideQuestion: 'Bu nitelik ilişki içinde nasıl çalışıyor?', col: 1, row: 1.5 },
      { no: 2, title: 'Kişi 1 / İkinci Nitelik', meaning: 'Birinci kişinin ikinci belirgin etkisi.', guideQuestion: 'Bu taraf destek mi, gölge mi yaratıyor?', col: 2, row: 1 },
      { no: 3, title: 'Kişi 1 / Üçüncü Nitelik', meaning: 'Birinci kişinin daha derindeki üçüncü teması.', guideQuestion: 'Bu özellik bağın ritmini nasıl etkiliyor?', col: 2, row: 2 },
      { no: 4, title: 'Kişi 2 / İlk Nitelik', meaning: 'İkinci kişinin ilişkiye taşıdığı ilk ana nitelik.', guideQuestion: 'Bu nitelik ilişkiye nasıl yansıyor?', col: 5, row: 1.5 },
      { no: 5, title: 'Kişi 2 / İkinci Nitelik', meaning: 'İkinci kişinin ikinci belirgin etkisi.', guideQuestion: 'Bu etki yakınlığı mı, mesafeyi mi büyütüyor?', col: 4, row: 1 },
      { no: 6, title: 'Kişi 2 / Üçüncü Nitelik', meaning: 'İkinci kişinin daha derindeki üçüncü teması.', guideQuestion: 'Bu özellik ortak alanı nasıl değiştiriyor?', col: 4, row: 2 },
      { no: 7, title: 'İlişkinin Kendisi', meaning: 'İki tarafı birbirine bağlayan ana enerji.', guideQuestion: 'İki kişinin getirdiği nitelikler bu ilişkide nasıl birleşiyor?', col: 3, row: 1.5 },
    ],
  },
  {
    id: 'should-i',
    title: '“Bunu Yapmalı mıyım?”',
    cardCount: 4,
    purpose: 'Bir karar ya da adım öncesi korkuları, engelleri, geçmiş etkileri ve olası sonucu tart.',
    gridColumns: 5,
    gridRows: 1,
    positions: [
      { no: 1, title: 'Meselenin Kalbi', meaning: 'Kararın etrafındaki en güçlü duygu veya şüphe.', guideQuestion: 'Bu his seni koruyor mu, yoksa gereksizce durduruyor mu?', col: 3, row: 1 },
      { no: 2, title: 'Engeller', meaning: 'Bu adımı atarsan karşılaşabileceğin zorluklar.', guideQuestion: 'Engelin ne kadarı gerçek, ne kadarı zihinde büyüyor?', col: 3, row: 1, crossed: true },
      { no: 3, title: 'Geçmiş Etkiler', meaning: 'Kararını etkileyen eski deneyimler.', guideQuestion: 'Geçmiş sana isabetli güven mi, yoksa gereksiz kuşku mu veriyor?', col: 1, row: 1 },
      { no: 4, title: 'Olası Sonuç', meaning: 'Bugünkü şartlarda ilerlersen beliren sonuç.', guideQuestion: 'Bu sonuç hangi koşullarda desteklenir veya değişir?', col: 5, row: 1 },
    ],
  },
  {
    id: 'confidence',
    title: 'Özgüven Açılımı',
    cardCount: 4,
    purpose: 'Güvensizliğin kökünü, içindeki güç kaynaklarını ve hemen atabileceğin küçük adımı gör.',
    gridColumns: 2,
    gridRows: 3,
    positions: [
      { no: 1, title: 'Güvensizliğin Kökü', meaning: 'İçeride sesi yükselen temel şüphe.', guideQuestion: 'Bu düşünce seni nasıl geride tutuyor?', col: 1.5, row: 1 },
      { no: 2, title: 'İlk Güç Kaynağı', meaning: 'Geçmişten veya içinden gelen ilk destek.', guideQuestion: 'Bu enerji özgüvenini daha önce nasıl güçlendirdi?', col: 1, row: 2 },
      { no: 3, title: 'İkinci Güç Kaynağı', meaning: 'Beklenmedik ama kullanılabilir ikinci destek.', guideQuestion: 'Bu deneyim bugünkü güvenini nasıl besleyebilir?', col: 2, row: 2 },
      { no: 4, title: 'Şimdi Atılacak Adım', meaning: 'Özgüveni davranışla büyütecek küçük hareket.', guideQuestion: 'Hangi küçük eylem güveni ardından getirecek?', col: 1.5, row: 3 },
    ],
  },
  {
    id: 'turning-point',
    title: 'Dönüm Noktası Açılımı',
    cardCount: 7,
    purpose: 'Bir dönemi kapatırken neyi bırakacağını, neyi yaratacağını ve hangi niyeti büyüteceğini keşfet.',
    gridColumns: 5,
    gridRows: 3,
    positions: [
      { no: 1, title: 'Şükran / Ders', meaning: 'Bu dönemden elde kalan ana hediye veya ders.', guideQuestion: 'Bu tema sana hangi kazanımı fark ettiriyor?', col: 3, row: 2 },
      { no: 2, title: 'Bırakılacak Şey', meaning: 'Artık taşımana gerek olmayan yük veya kalıp.', guideQuestion: 'Bunu daha iyi hizmet edecek şekilde nasıl bırakabilirsin?', col: 2, row: 2 },
      { no: 3, title: 'İstenmesi Gereken İhtiyaç', meaning: 'Dile getirilmesi gereken destek veya ihtiyaç.', guideQuestion: 'Neyi istemeye çekiniyorsun ve bu kart sana nasıl cesaret veriyor?', col: 4, row: 2 },
      { no: 4, title: 'Verilen Enerji', meaning: 'Başkalarına sunduğun veya paylaşabileceğin şey.', guideQuestion: 'Bu temada ne verdin, bundan sonra neyi daha bilinçli paylaşabilirsin?', col: 1, row: 2 },
      { no: 5, title: 'Yaratılacak Alan', meaning: 'Yeni dönemde kurulacak üretim, ilişki veya iç alan.', guideQuestion: 'Bu kart hangi yeni alanı yaratmanı istiyor?', col: 5, row: 2 },
      { no: 6, title: 'Rehber Işık', meaning: 'Geçiş döneminde yolu gösterecek kaynak.', guideQuestion: 'Bu tema sana karanlıkta nasıl yön gösterir?', col: 3, row: 1 },
      { no: 7, title: 'Tohum', meaning: 'Şimdi ekilip ileride büyüyecek niyet.', guideQuestion: 'Bu dönemde hangi niyeti ekersen ileride filizlenir?', col: 3, row: 3 },
    ],
  },
  {
    id: 'celtic-cross',
    title: 'Klasik Celtic Cross',
    cardCount: 10,
    purpose: 'Belirli bir soruya en kapsamlı bakış: kök neden, geçmiş, iç/dış etkiler, umut-korku ve sonuç.',
    gridColumns: 5,
    gridRows: 4,
    positions: [
      { no: 1, title: 'Şimdi', meaning: 'Meselenin bugünkü kalbi ve ana karakteri.', guideQuestion: 'Şu anki iç ve dış ortam ne söylüyor?', col: 2, row: 2.5 },
      { no: 2, title: 'Meydan Okuma', meaning: 'Aşılması gereken doğrudan zorluk.', guideQuestion: 'Olumlu görünse bile bu kart hangi sınavı gösteriyor?', col: 2, row: 2.5, crossed: true },
      { no: 3, title: 'Temel', meaning: 'Uzak geçmiş, kök neden ve zemindeki yapı.', guideQuestion: 'Bugünün temeli hangi eski etkiyle kurulmuş?', col: 2, row: 3.5 },
      { no: 4, title: 'Yakın Geçmiş', meaning: 'Tamamlanan veya etkisi azalan son olaylar.', guideQuestion: 'Yakın geçmişten ne kapanıyor, ne hala yankılanıyor?', col: 1, row: 2.5 },
      { no: 5, title: 'En İyi Sonuç', meaning: 'Bilinçli hedef ve o hedefin en iyi hali.', guideQuestion: 'Bu hedef gerçekten korunmalı mı, yoksa kayıp kesilmeli mi?', col: 2, row: 1.5 },
      { no: 6, title: 'Yakın Gelecek', meaning: 'Önümüzdeki günler/haftalarda güçlenen olay.', guideQuestion: 'Hangi etki yaklaşırken önem kazanıyor?', col: 3, row: 2.5 },
      { no: 7, title: 'İç Etkiler', meaning: 'Kişinin iç kuvvetleri, hisleri ve tavrı.', guideQuestion: 'İç dünyan bu meseleyi nasıl etkiliyor?', col: 5, row: 4 },
      { no: 8, title: 'Dış Etkiler', meaning: 'Çevre, başkalarının beklentisi ve kontrol dışı faktörler.', guideQuestion: 'Dış dünya bu duruma nasıl baskı veya destek veriyor?', col: 5, row: 3 },
      { no: 9, title: 'Umutlar / Korkular', meaning: 'İstek ve kaygının birbirine dolandığı yer.', guideQuestion: 'Neyi arzuluyor, neyden kaçınıyorsun?', col: 5, row: 2 },
      { no: 10, title: 'Genel Sonuç', meaning: 'Mevcut akışın götürdüğü en olası yön.', guideQuestion: 'Bütün kartlar birlikte hangi sonucu işaret ediyor?', col: 5, row: 1 },
    ],
  },
  {
    id: 'conflict',
    title: 'Çatışma Yorumu',
    cardCount: 8,
    purpose: 'Bir kişi ya da durumla yaşanan gerilimde iki tarafın rolünü, engelleri, güçleri ve olası sonucu oku.',
    gridColumns: 3,
    gridRows: 4,
    positions: [
      { no: 1, title: 'Senin Rolün', meaning: 'Bu çatışmaya senin getirdiğin ana enerji.', guideQuestion: 'Bu nitelikler çözümü kolaylaştırıyor mu, zorlaştırıyor mu?', col: 2, row: 1 },
      { no: 2, title: 'Onlara Bakışın', meaning: 'Karşı tarafı nasıl gördüğün.', guideQuestion: 'Bu bakış adil mi, çatışma gözlüğüyle mi şekilleniyor?', col: 1, row: 1.5 },
      { no: 3, title: 'Onların Kendine Bakışı', meaning: 'Karşı tarafın kendi rolünü algılama biçimi.', guideQuestion: 'Bu öz algı çözümü nasıl etkiliyor?', col: 3, row: 1.5 },
      { no: 4, title: 'Onların Senin İçin Anlamı', meaning: 'Bu kişinin/durumun sende temsil ettiği daha büyük rol.', guideQuestion: 'Bu anlam çözüm yolunu nasıl açabilir?', col: 1, row: 2.5 },
      { no: 5, title: 'Senin Onlar İçin Anlamın', meaning: 'Karşı tarafın sende gördüğü rol.', guideQuestion: 'Onların seni böyle görmesi çatışmayı nasıl besliyor?', col: 3, row: 2.5 },
      { no: 6, title: 'Engeller', meaning: 'Çözüm önündeki temel blokajlar.', guideQuestion: 'İki taraf bu engeli aynı şekilde görüyor mu?', col: 1, row: 3.5 },
      { no: 7, title: 'Güçlü Yan', meaning: 'İlişkinin veya durumun çözüm için kullanılabilecek gücü.', guideQuestion: 'Bu güç nasıl esnetilip çözüme çevrilebilir?', col: 3, row: 3.5 },
      { no: 8, title: 'Olası Sonuç', meaning: 'Mevcut yol sürerse beliren sonuç.', guideQuestion: 'Bu sonuç sabit değil; hangi seçimle değişebilir?', col: 2, row: 4 },
    ],
  },
  {
    id: 'relationship-check',
    title: 'İlişkiye Bir Göz Atış',
    cardCount: 3,
    purpose: 'Bir ilişkinin kısa durum kontrolü: sen, karşı taraf ve ilişkinin mevcut enerjisi.',
    gridColumns: 3,
    gridRows: 1,
    positions: [
      { no: 1, title: 'Sen', meaning: 'Bu ilişkiye getirdiğin ana enerji.', guideQuestion: 'Bu nitelik sana ve ilişkiye nasıl hizmet ediyor?', col: 1, row: 1 },
      { no: 2, title: 'Karşı Taraf', meaning: 'Diğer kişinin/varlığın getirdiği ana enerji.', guideQuestion: 'Bu enerji etkileşimi nasıl biçimlendiriyor?', col: 2, row: 1 },
      { no: 3, title: 'İlişkinin Kendisi', meaning: 'İlişkinin mevcut ortak alanı.', guideQuestion: 'Bu enerji büyütülmeli mi, dönüştürülmeli mi?', col: 3, row: 1 },
    ],
  },
];

export function getTarotSpread(spreadId: string) {
  return TAROT_SPREADS.find((spread) => spread.id === spreadId) || TAROT_SPREADS[0];
}
