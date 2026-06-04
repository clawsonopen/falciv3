import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { appendReplacingProfileTestResult, appendUserStatedTestResult } from '../services/profileMemoryService';
import { PERSONALITY_TESTS, type PersonalityTestDefinition, type PersonalityTestId } from '../data/personalityTests';

type Props = NativeStackScreenProps<RootStackParamList, 'MbtiTest'>;

type MbtiQuestion = {
  id: number;
  left: string;
  right: string;
};

type GenericResult = {
  type: string;
  scores: Record<string, number>;
  percentages: Record<string, number>;
};

const TEST_SELECTION: Array<{
  id: 'mbti' | PersonalityTestId;
  title: string;
  meta: string;
  description: string;
}> = [
  {
    id: 'mbti',
    title: 'MBTI Kişilik Testi',
    meta: '32 soru, yaklaşık 12-15 dakika',
    description: 'Karar alma, enerji toplama ve dünyayı algılama biçimini 16 kişilik tipi üzerinden tanır.',
  },
  ...Object.values(PERSONALITY_TESTS).map((test) => ({
    id: test.id,
    title: test.title,
    meta: test.meta,
    description: test.intro,
  })),
];

const QUESTIONS: MbtiQuestion[] = [
  { id: 1, left: 'Günlük işlerimde liste yaparım', right: 'Günlük işlerimde hafızama güvenirim' },
  { id: 2, left: 'Yeni bir bilgiye önce şüpheyle yaklaşırım', right: 'Yeni bir bilgiye önce inanmak isterim' },
  { id: 3, left: 'Yalnız zaman beni sıkar', right: 'Yalnız zamana ihtiyaç duyarım' },
  { id: 4, left: 'Durumları çoğunlukla olduğu gibi kabul ederim', right: 'Mevcut hâlle kolay yetinmem, başka ihtimaller ararım' },
  { id: 5, left: 'Odamı / alanımı temiz tutarım', right: 'Eşyaları gelişigüzel bırakırım' },
  { id: 6, left: '"Mekanik" görünmek bana kötü gelir', right: 'Zihnimin mekanik işlemesini isterim' },
  { id: 7, left: 'Enerjik biriyim', right: 'Sakin ve yumuşak tempoluyum' },
  { id: 8, left: 'Sorularda net seçenekler olmasını severim', right: 'Sorularda açık uçlu cevap alanı olmasını severim' },
  { id: 9, left: 'Dağınık biriyim', right: 'Düzenli biriyim' },
  { id: 10, left: 'Eleştiri veya sert sözler beni kolay incitir', right: 'Eleştiri veya sert sözlere karşı kalın deriliyim' },
  { id: 11, left: 'Grupla daha iyi çalışırım', right: 'Tek başıma daha iyi çalışırım' },
  { id: 12, left: 'Karar verirken şimdiye ve eldeki gerçeğe odaklanırım', right: 'Karar verirken gelecekteki ihtimallere odaklanırım' },
  { id: 13, left: 'Çok önceden plan yaparım', right: 'Son dakikada plan yaparım' },
  { id: 14, left: 'İnsanların bana saygı duyması benim için daha belirleyicidir', right: 'İnsanların beni sevmesi benim için daha belirleyicidir' },
  { id: 15, left: 'Partiler beni yorar', right: 'Partiler beni ateşler' },
  { id: 16, left: 'Bir ortama girince uyum sağlamaya yönelirim', right: 'Bir ortama girince kendimi belli etmeye yönelirim' },
  { id: 17, left: 'Seçenekleri açık tutarım', right: 'Karar verip bağlanırım' },
  { id: 18, left: 'Bir şeyleri onarmakta iyi olmak isterim', right: 'İnsanlara iyi gelmekte iyi olmak isterim' },
  { id: 19, left: 'Daha çok konuşurum', right: 'Daha çok dinlerim' },
  { id: 20, left: 'Bir olayı anlatırken ne olduğunu söylerim', right: 'Bir olayı anlatırken ne anlama geldiğini söylerim' },
  { id: 21, left: 'Başladığım işi mümkünse hemen bitirmek isterim', right: 'Başladığım işi ertelemeye veya zamana yaymaya meyilliyim' },
  { id: 22, left: 'Önemli seçimlerde kalbimi izlemeye yakınım', right: 'Önemli seçimlerde aklımı izlemeye yakınım' },
  { id: 23, left: 'Evde kalırım', right: 'Dışarı çıkıp gezmeyi severim' },
  { id: 24, left: 'Bir konuyu anlamak için önce büyük resmi görmek isterim', right: 'Bir konuyu anlamak için önce detayları görmek isterim' },
  { id: 25, left: 'Yeni durumlarda doğaçlama yapmaya güvenirim', right: 'Yeni durumlara hazırlık yaparak girmek isterim' },
  { id: 26, left: 'Ahlakı adalet üzerinden kurarım', right: 'Ahlakı şefkat üzerinden kurarım' },
  { id: 27, left: 'Çok yüksek sesle bağırmakta zorlanırım', right: 'Uzağa seslenmek doğal gelir' },
  { id: 28, left: 'Bir şeyi anlamak için teorik çerçeve kurarım', right: 'Bir şeyi anlamak için deneyip gözlemlemeyi isterim' },
  { id: 29, left: 'Hayat ritmimde sıkı çalışmaya eğilimliyim', right: 'Hayat ritmimde keyif ve eğlenceye alan açmaya eğilimliyim' },
  { id: 30, left: 'Duygularla rahatsız olurum', right: 'Duygulara değer veririm' },
  { id: 31, left: 'İnsanların önünde performans sergilemeyi severim', right: 'Topluluk önünde konuşmaktan kaçınırım' },
  { id: 32, left: '"Kim, ne, ne zaman?" diye sorarım', right: '"Neden?" diye sorarım' },
];

const OPTIONS = [
  { value: 1, label: 'Sol kesin' },
  { value: 2, label: 'Sol yakın' },
  { value: 3, label: 'Ortada' },
  { value: 4, label: 'Sağ yakın' },
  { value: 5, label: 'Sağ kesin' },
];

function FivePointSlider({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  const selectedValue = value;
  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderTrack} />
      {[1, 2, 3, 4, 5].map((point) => (
        <TouchableOpacity
          key={point}
          activeOpacity={0.8}
          style={[styles.sliderPointTouch, { left: `${((point - 1) / 4) * 100}%` }]}
          onPress={() => onChange(point)}
        >
          <View style={[styles.sliderPoint, selectedValue === point && styles.sliderPointSelected]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  ISTJ: 'Düzenli, güvenilir ve sorumluluk odaklı bir yapı. Somut bilgiyle ilerlemeyi ve verilen sözün tutulmasını önemser.',
  ISFJ: 'Koruyucu, dikkatli ve sadık bir yapı. İnsanların ihtiyaçlarını fark eder, ilişkilerde güvenli alan kurmaya çalışır.',
  INFJ: 'Sezgisel, derinlikli ve anlam arayan bir yapı. İnsanları ve olayları görünmeyen bağlarıyla okumaya eğilimlidir.',
  INTJ: 'Stratejik, bağımsız ve uzun vadeli düşünen bir yapı. Büyük resmi kurar, sistemi iyileştirmek ister.',
  ISTP: 'Sakin, pratik ve çözüm odaklı bir yapı. Kriz anında soğukkanlı kalıp eldeki araçlarla yol bulabilir.',
  ISFP: 'Duyarlı, estetik ve özgürlük seven bir yapı. İç değerlerine sadık kalır, samimiyetsizliği hızlı hisseder.',
  INFP: 'İdealist, içten ve değer odaklı bir yapı. Kendi anlam dünyasıyla uyumlu seçimler yapmak ister.',
  INTP: 'Analitik, meraklı ve bağımsız düşünen bir yapı. Fikirlerin mantığını kurcalamayı ve olasılıkları açmayı sever.',
  ESTP: 'Hızlı, cesur ve deneyim odaklı bir yapı. Anda karar alır, hareket ederek öğrenir.',
  ESFP: 'Canlı, sıcak ve deneyimden beslenen bir yapı. İnsanlarla bağ kurmayı ve hayatı hissetmeyi önemser.',
  ENFP: 'Yaratıcı, hevesli ve olasılık odaklı bir yapı. İnsanların potansiyelini görür, yeni yollar açmayı sever.',
  ENTP: 'Zeki, esnek ve tartışarak düşünen bir yapı. Kalıpları zorlar, fikirleri farklı açılardan test eder.',
  ESTJ: 'Organize, net ve sonuç odaklı bir yapı. Sorumluluk alır, düzen kurar ve işlerin yürümesini ister.',
  ESFJ: 'Sosyal, destekleyici ve uyum odaklı bir yapı. İnsanların iyi hissetmesini ve ilişkilerin düzenli akmasını önemser.',
  ENFJ: 'İlham veren, ilişkisel ve yön gösterici bir yapı. İnsanları ortak bir anlam etrafında toparlayabilir.',
  ENTJ: 'Kararlı, stratejik ve liderlik odaklı bir yapı. Hedef koyar, kaynakları düzenler ve ilerleme bekler.',
};

const TYPE_ARCHETYPES: Record<string, { name: string; reason: string }> = {
  ISTJ: {
    name: 'Lojistikçi',
    reason: 'Bu benzetme, ISTJ’nin düzen kurma, sorumluluk taşıma ve işleri güvenilir bir sistem içinde yürütme eğiliminden gelir. Bir yapının dağılmadan işlemesi için ayrıntıları, zamanı ve görevleri takip eden kişidir.',
  },
  ISFJ: {
    name: 'Koruyucu',
    reason: 'ISFJ çevresindeki insanların ihtiyaçlarını sessizce fark eder ve güvenli bir alan kurmaya çalışır. Bu yüzden koruyucu benzetmesi, hem pratik destek verme hem de ilişkileri özenle kollama tarafını anlatır.',
  },
  INFJ: {
    name: 'Savunucu',
    reason: 'INFJ yalnızca olanı değil, olması gerekeni de düşünür. İnsanların potansiyelini ve kırılgan yanlarını sezdiği için bir anlamı, bir insanı ya da bir değeri derinden savunabilir.',
  },
  INTJ: {
    name: 'Mimar / Stratejist',
    reason: 'INTJ önce büyük resmi kurar, sonra o resme uygun sistemi tasarlar. Mimar benzetmesi buradan gelir: görünen yapının arkasındaki planı, taşıyıcı fikri ve uzun vadeli sonucu düşünür.',
  },
  ISTP: {
    name: 'Virtüöz',
    reason: 'ISTP bir şeyi teoride değil, eline alıp deneyerek anlamaya yatkındır. Virtüöz benzetmesi, pratik ustalık, soğukkanlı müdahale ve araçları sezgisel kullanma becerisini anlatır.',
  },
  ISFP: {
    name: 'Maceracı',
    reason: 'ISFP iç değerlerini ve duyularını takip ederek yaşar. Maceracı benzetmesi büyük gürültülü maceradan çok, kendine özgü yolu deneme, hissetme ve estetik seçimlerle var olma halidir.',
  },
  INFP: {
    name: 'Arabulucu',
    reason: 'INFP insanların iç dünyasını ve değerlerini anlamaya çalışır. Arabulucu benzetmesi, çatışmanın altında yatan duyguyu görme ve daha sahici bir anlam arama eğiliminden gelir.',
  },
  INTP: {
    name: 'Mantıkçı',
    reason: 'INTP fikirlerin iç tutarlılığını kurcalar, varsayımları test eder ve kavramları birbirine bağlar. Mantıkçı benzetmesi, dünyayı önce açıklanabilir bir zihinsel model olarak anlamasından gelir.',
  },
  ESTP: {
    name: 'Girişimci',
    reason: 'ESTP fırsatı anda görür ve harekete geçmekten çekinmez. Girişimci benzetmesi, risk alabilen, pratik düşünen ve sahada öğrenen tarafını anlatır.',
  },
  ESFP: {
    name: 'Eğlendirici',
    reason: 'ESFP bulunduğu ortama canlılık, temas ve sıcaklık getirir. Eğlendirici benzetmesi yalnızca neşeli olmayı değil, insanların anda daha rahat ve gerçek hissetmesini sağlamayı anlatır.',
  },
  ENFP: {
    name: 'Kampanyacı',
    reason: 'ENFP bir fikrin, insanın ya da ihtimalin enerjisini büyütebilir. Kampanyacı benzetmesi, heyecanı paylaşma, insanları cesaretlendirme ve yeni yollar açma eğiliminden gelir.',
  },
  ENTP: {
    name: 'Tartışmacı',
    reason: 'ENTP fikirleri çarpıştırarak düşünür; soru sormak, itiraz etmek ve kalıpları esnetmek onun zihinsel oyun alanıdır. Tartışmacı benzetmesi bu canlı test etme enerjisini anlatır.',
  },
  ESTJ: {
    name: 'Yönetici',
    reason: 'ESTJ hedefi, görevi ve sorumluluğu netleştirerek ilerler. Yönetici benzetmesi, dağınık kaynakları düzene sokma ve işlerin gerçekten yürümesini sağlama becerisinden gelir.',
  },
  ESFJ: {
    name: 'Konsül',
    reason: 'ESFJ sosyal düzeni, nezaketi ve aidiyeti önemser. Konsül benzetmesi, insanları bir arada tutma, ihtiyaçları fark etme ve ortak yaşamı yumuşatma tarafını anlatır.',
  },
  ENFJ: {
    name: 'Önder',
    reason: 'ENFJ insanları ortak bir anlam ve gelişim duygusu etrafında toparlayabilir. Önder benzetmesi, yalnızca liderlikten değil, başkalarının potansiyelini harekete geçirme becerisinden gelir.',
  },
  ENTJ: {
    name: 'Komutan',
    reason: 'ENTJ hedef koyar, strateji kurar ve insanları ilerlemeye çağırır. Komutan benzetmesi, karar alma cesareti ve büyük yapıları harekete geçirme eğiliminden gelir.',
  },
};

const TYPE_DETAIL: Record<
  string,
  {
    theme: string;
    self: string;
    strengths: string;
    growth: string;
    relationships: string;
    rhythm: string;
  }
> = {
  ISTJ: {
    theme: 'Düzen, güvenilirlik ve sorumluluk üzerinden dünyayı anlamlandırırsın.',
    self: 'ISTJ tipi çoğu zaman önce gerçeğe, kanıta ve geçmişte işe yaramış yöntemlere bakar. Söylenen şeyden çok yapılan şeye güvenir; istikrar, sadakat ve netlik onun için önemlidir.',
    strengths: 'Planlı ilerleme, sözünü tutma, detayları kaçırmama ve kriz anında pratik kalma güçlü yanlarındır. İnsanlar sana güvenebilir çünkü başladığın işi bitirme eğilimin yüksektir.',
    growth: 'Bazen esneklik gerektiren durumlarda fazla katılaşabilir ya da duygusal ihtiyaçları ikincil görebilirsin. Her şeyin kontrol edilebilir olmadığını kabul etmek sana iyi gelir.',
    relationships: 'İlişkide sadakat, emek ve süreklilik beklersin. Büyük romantik jestlerden çok güvenilir davranışlar senin için sevgi göstergesidir.',
    rhythm: 'Düzenli takvim, açık görevler ve net sorumluluklar seni rahatlatır. Belirsiz ve sürekli değişen ortamlar enerjini tüketebilir.',
  },
  ISFJ: {
    theme: 'Şefkat, düzen ve koruyucu dikkat senin ana eksenin.',
    self: 'ISFJ tipi çevresindeki insanların ihtiyaçlarını sessizce fark eder. Aidiyet, güven ve iyi niyetli emek onun dünyasında çok değerlidir.',
    strengths: 'İncelik, sadakat, sabır ve pratik destek verme güçlü yanlarındır. İnsanların küçük ihtiyaçlarını hatırlaman ilişkilerde sıcaklık yaratır.',
    growth: 'Kendi ihtiyaçlarını ertelemeye veya kırılmamak için susmaya meyilli olabilirsin. Sınır koymak sevgisizlik değil, ilişkinin sağlıklı kalmasıdır.',
    relationships: 'İlişkide güvenli bağ, tutarlılık ve özen beklersin. Sevilmek kadar değerinin fark edilmesi de önemlidir.',
    rhythm: 'Tanıdık düzenler, yumuşak geçişler ve anlamlı sorumluluklar sana iyi gelir. Fazla sert ve duyarsız ortamlar seni içe kapatabilir.',
  },
  INFJ: {
    theme: 'Anlam, sezgi ve derin bağ arayışı ön planda.',
    self: 'INFJ tipi olayların görünen yüzünden çok altında yatan anlamı okur. İnsanların niyetlerini, duygusal iklimi ve uzun vadeli yönü sezme eğilimi güçlüdür.',
    strengths: 'Derin empati, vizyon, içgörü ve insanları dönüştüren bir rehberlik potansiyelin vardır. Karmaşık duyguları anlamlandırabilirsin.',
    growth: 'Bazen çok fazla anlam yükleyebilir veya herkesi içten içe taşımaya çalışabilirsin. Sezgini gerçek verilerle dengelemek rahatlatıcı olur.',
    relationships: 'Yüzeysel bağlar seni doyurmaz; samimiyet, ruhsal yakınlık ve dürüstlük istersin. Anlaşılmadığını hissetmek seni sessizce uzaklaştırabilir.',
    rhythm: 'Yalnız kalıp içini topladığın zamanlara ihtiyaç duyarsın. Ama anlamlı bir amaç olduğunda uzun süre odaklanabilirsin.',
  },
  INTJ: {
    theme: 'Strateji, bağımsızlık ve büyük resmi kurma arzusu belirgin.',
    self: 'INTJ tipi sistemleri, olasılıkları ve uzun vadeli sonuçları düşünür. Bir şeyin neden çalıştığını ya da neden çalışmadığını anlamak ister.',
    strengths: 'Stratejik düşünme, bağımsız karar alma, karmaşık yapıları sadeleştirme ve hedefe kilitlenme güçlü yanlarındır.',
    growth: 'Bazen insan faktörünü veya duygusal geçişleri gereksiz ayrıntı gibi görebilirsin. İlişkilerde açıklık kadar sıcaklık da etkilidir.',
    relationships: 'Zihinsel uyum, dürüstlük ve kişisel alana saygı beklersin. Güvenmediğin yerde kolay kolay açılmazsın.',
    rhythm: 'Uzun vadeli hedefler, net yetki alanı ve düşünme alanı seni besler. Mikroyönetim ve anlamsız tekrarlar seni yorar.',
  },
  ISTP: {
    theme: 'Sakin gözlem, pratik çözüm ve özgür hareket alanı.',
    self: 'ISTP tipi olanı olduğu gibi inceler, fazla konuşmadan sistemi anlamaya çalışır. Bir şeyi deneyerek, söküp takarak veya doğrudan yaşayarak öğrenir.',
    strengths: 'Soğukkanlılık, pratik zeka, hızlı uyum ve eldeki araçlarla çözüm üretme güçlü yanlarındır.',
    growth: 'Duyguları açıklamak ya da uzun vadeli planı sürdürmek bazen zorlayabilir. İç dünyanı tamamen kapatmadan ifade etmek ilişkilerini rahatlatır.',
    relationships: 'Baskı ve fazla beklenti seni uzaklaştırabilir. Saygı, alan ve doğal yakınlık olduğunda bağın güçlenir.',
    rhythm: 'Esnek planlar, gerçek problemler ve hareket alanı sana iyi gelir. Fazla teorik veya aşırı duygusal ortamlar enerjini düşürebilir.',
  },
  ISFP: {
    theme: 'İç değerler, estetik duyarlılık ve özgür ifade.',
    self: 'ISFP tipi kendi iç pusulasına göre yaşamak ister. Zorla kalıba sokulmak yerine hissettiği doğruluğu takip eder.',
    strengths: 'Samimiyet, duyarlılık, estetik bakış ve anda kalabilme güçlü yanlarındır. İnsanlara yumuşak ama gerçek bir temas sunarsın.',
    growth: 'Çatışmadan kaçmak veya kararları fazla ertelemek seni sıkıştırabilir. İç değerini korurken daha açık konuşmak iyi gelir.',
    relationships: 'İlişkide doğallık, nezaket ve baskısız yakınlık istersin. Kontrol edilmek ya da yargılanmak seni hızla kapatır.',
    rhythm: 'Yaratıcı alan, duyusal deneyim ve sakin tempo seni besler. Sert rekabet ve sürekli performans beklentisi yorucu olabilir.',
  },
  INFP: {
    theme: 'İdeal, anlam ve içtenlik arayışı çok güçlü.',
    self: 'INFP tipi hayatı değerleri ve iç dünyası üzerinden okur. Bir şeyin doğru hissettirmesi, mantıklı görünmesi kadar önemlidir.',
    strengths: 'Empati, hayal gücü, derin sadakat ve insanların özünü görme yeteneği güçlü yanlarındır.',
    growth: 'Gerçek dünya sınırları idealindeki kadar temiz olmadığında hayal kırıklığı yaşayabilirsin. Küçük somut adımlar büyük anlamları taşır.',
    relationships: 'Güvenli, yargısız ve derin bağlar istersin. Duygularının hafife alınması seni incitebilir.',
    rhythm: 'Yalnız düşünme, yazma, üretme ve anlamlı projeler sana iyi gelir. Fazla mekanik rutinler iç motivasyonunu düşürebilir.',
  },
  INTP: {
    theme: 'Merak, analiz ve fikirlerin iç mantığını kurma isteği.',
    self: 'INTP tipi bir fikri hemen kabul etmek yerine parçalara ayırır. Tutarlılık, açıklama gücü ve zihinsel özgürlük onun için önemlidir.',
    strengths: 'Analitik düşünme, özgün bağlantılar kurma, karmaşık konuları çözme ve bağımsız sorgulama güçlü yanlarındır.',
    growth: 'Düşüncede çok kalıp uygulamayı erteleyebilir veya duygusal ihtiyaçları geç fark edebilirsin. Bitmiş olan bazen mükemmelden değerlidir.',
    relationships: 'Zihinsel alan, dürüst tartışma ve baskısız yakınlık beklersin. Duygusal baskı altında geri çekilebilirsin.',
    rhythm: 'Serbest araştırma, problem çözme ve kendi hızında çalışma seni besler. Aşırı prosedür ve sosyal zorunluluklar yorabilir.',
  },
  ESTP: {
    theme: 'Hareket, deneyim ve anın fırsatını yakalama.',
    self: 'ESTP tipi hayatı doğrudan temas ederek öğrenir. Beklemektense denemeyi, teoridense sahada görmeyi tercih eder.',
    strengths: 'Cesaret, hızlı karar, pratik zeka ve sosyal çeviklik güçlü yanlarındır. Krizde donmak yerine hareket edebilirsin.',
    growth: 'Kısa vadeli heyecan uzun vadeli sonucu gölgeleyebilir. Bir adım geri çekilip etkileri tartmak sana avantaj sağlar.',
    relationships: 'Canlılık, dürüstlük ve birlikte deneyim yaşamak istersin. Fazla kontrol veya drama seni bunaltabilir.',
    rhythm: 'Dinamik ortamlar, gerçek hedefler ve hareket alanı seni besler. Uzun soyut toplantılar ve bekleme süreçleri enerjini düşürür.',
  },
  ESFP: {
    theme: 'Canlılık, temas ve hayatı hissederek yaşama.',
    self: 'ESFP tipi bulunduğu ortama sıcaklık ve hareket getirir. İnsanları, deneyimleri ve anın duygusunu güçlü algılar.',
    strengths: 'Sosyal sıcaklık, doğallık, pratik neşe ve insanları rahatlatma güçlü yanlarındır.',
    growth: 'Zor konuları ertelemek veya sadece iyi hissettiren seçeneğe yönelmek bazen bedel çıkarabilir. Planlı küçük sorumluluklar özgürlüğünü korur.',
    relationships: 'İlişkide eğlence, temas, ilgi ve karşılıklı canlılık istersin. Soğukluk ya da ilgisizlik seni hızlı etkiler.',
    rhythm: 'İnsanlı, hareketli ve somut sonuç veren ortamlar sana iyi gelir. Tekdüze ve izole çalışmalar yorucu olabilir.',
  },
  ENFP: {
    theme: 'Olasılık, ilham ve insan potansiyeline duyulan merak.',
    self: 'ENFP tipi hayatı bağlantılar, ihtimaller ve anlamlar üzerinden okur. Yeni fikirler ve samimi bağlar enerjisini yükseltir.',
    strengths: 'Yaratıcılık, insanları cesaretlendirme, esnek düşünme ve güçlü sezgisel bağlantılar kurma güçlü yanlarındır.',
    growth: 'Çok fazla seçenek arasında dağılabilir veya başladığın şeyi bitirmekte zorlanabilirsin. Özgürlüğü koruyan sade yapılar sana iyi gelir.',
    relationships: 'İlişkide samimiyet, oyun, derin konuşma ve gelişim istersin. Tekdüzelik ya da duygusal kapalılık seni uzaklaştırabilir.',
    rhythm: 'Yeni projeler, anlamlı insan teması ve keşif alanı seni besler. Katı rutinler motivasyonunu düşürebilir.',
  },
  ENTP: {
    theme: 'Fikir, tartışma ve kalıpları esnetme enerjisi.',
    self: 'ENTP tipi olasılıkları test eder, sistemlerin açıklarını görür ve zihinsel oyun alanlarını sever. Soru sormak onun için yakınlaşma biçimi bile olabilir.',
    strengths: 'Hızlı zeka, esneklik, yaratıcı problem çözme ve ezber bozma güçlü yanlarındır.',
    growth: 'Her şeyi tartışmaya açmak bazen karşı tarafı yorabilir. Fikrin gücü kadar duygusal zamanlama da önemlidir.',
    relationships: 'Zihinsel canlılık, mizah ve özgürlük beklersin. Fazla kuralcı ya da alıngan bağlar seni sıkıştırabilir.',
    rhythm: 'Yenilik, strateji, tartışma ve değişken problemler seni besler. Tekrarlı operasyonel işler çabuk sıkıcı gelebilir.',
  },
  ESTJ: {
    theme: 'Düzen kurma, sonuç alma ve sorumluluk taşıma.',
    self: 'ESTJ tipi işlerin net, ölçülebilir ve uygulanabilir olmasını ister. Belirsizliği azaltır, görevleri organize eder.',
    strengths: 'Liderlik, planlama, karar alma ve sistemi çalıştırma güçlü yanlarındır. İnsanlar senden yön ve netlik alabilir.',
    growth: 'Bazen hız ve verimlilik adına duygusal nüansları kaçırabilirsin. Dinlemek, otoriteni zayıflatmaz; güveni artırır.',
    relationships: 'İlişkide sadakat, açıklık ve sorumluluk beklersin. Dağınıklık veya kararsızlık seni zorlayabilir.',
    rhythm: 'Hedefi belli işler, net roller ve sonuç odaklı ekipler sana iyi gelir. Belirsiz, plansız ortamlar sabrını tüketir.',
  },
  ESFJ: {
    theme: 'Uyum, destek ve ilişkisel düzen kurma.',
    self: 'ESFJ tipi çevresindeki insanların iyi olup olmadığını fark eder. Aidiyet, nezaket ve karşılıklı emek onun için önemlidir.',
    strengths: 'Sosyal organizasyon, destek verme, pratik bakım ve insanları bir arada tutma güçlü yanlarındır.',
    growth: 'Herkesi memnun etmeye çalışmak seni yorabilir. Kendi ihtiyacını açık söylemek ilişkide denge kurar.',
    relationships: 'İlgiyi, sürekliliği ve açık takdiri beklersin. Soğukluk veya belirsiz mesafe seni huzursuz edebilir.',
    rhythm: 'İnsan odaklı görevler, ortak ritüeller ve düzenli iletişim seni besler. Değerinin görülmediği yerde hızla yıpranabilirsin.',
  },
  ENFJ: {
    theme: 'İnsanları anlama, yön verme ve ortak anlam kurma.',
    self: 'ENFJ tipi ilişkilerdeki potansiyeli ve grubun duygusal yönünü güçlü hisseder. İnsanların gelişimine katkı vermek ister.',
    strengths: 'İlham verme, empati, liderlik ve insanları ortak hedefe toplama güçlü yanlarındır.',
    growth: 'Başkalarının duygularını fazla üstlenebilir veya kendi ihtiyacını geri plana atabilirsin. Yardım etmekle kontrol etmek arasındaki çizgiye dikkat etmek iyi gelir.',
    relationships: 'Derinlik, açıklık ve karşılıklı büyüme beklersin. Duygusal kopukluk veya belirsizlik seni zorlayabilir.',
    rhythm: 'Anlamlı ekipler, gelişim alanları ve insan etkisi olan projeler seni besler. Değer çatışması yaşadığın ortamlarda çok yorulabilirsin.',
  },
  ENTJ: {
    theme: 'Strateji, liderlik ve güçlü ilerleme arzusu.',
    self: 'ENTJ tipi hedefi görür, yolu kurar ve kaynakları harekete geçirmek ister. Potansiyeli boşa harcamak ona zor gelir.',
    strengths: 'Kararlılık, vizyon, organizasyon ve zor kararları alabilme güçlü yanlarındır.',
    growth: 'Bazen hızın ve netliğin başkalarına sert gelebilir. İnsanların duygusal uyum sürecine alan açmak sonuçları iyileştirir.',
    relationships: 'Zihinsel güç, dürüstlük ve gelişim beklersin. Pasiflik veya belirsiz beklentiler seni sabırsızlaştırabilir.',
    rhythm: 'Büyük hedefler, yetki, stratejik alan ve güçlü ekipler seni besler. Etkisiz bürokrasi enerjini düşürür.',
  },
};

function calculateResult(answers: Record<number, number>) {
  const q = (id: number) => answers[id] || 3;
  const scores = {
    IE: 30 - q(3) - q(7) - q(11) + q(15) - q(19) + q(23) + q(27) - q(31),
    SN: 12 + q(4) + q(8) + q(12) + q(16) + q(20) - q(24) - q(28) + q(32),
    FT: 30 - q(2) + q(6) + q(10) - q(14) - q(18) + q(22) - q(26) - q(30),
    JP: 18 + q(1) + q(5) - q(9) + q(13) - q(17) + q(21) - q(25) + q(29),
  };
  const type = [
    scores.IE > 24 ? 'E' : 'I',
    scores.SN > 24 ? 'N' : 'S',
    scores.FT > 24 ? 'T' : 'F',
    scores.JP > 24 ? 'P' : 'J',
  ].join('');
  return { type, scores };
}

function dimensionMeaning(type: string) {
  const introExtro = type[0] === 'E'
    ? 'E - Dışadönüklük: Enerjini çoğu zaman dış dünyadan, hareketten ve insanlarla temas etmekten toplarsın.'
    : 'I - İçedönüklük: Enerjini çoğu zaman iç dünyandan, düşünme alanından ve daha seçici temaslardan toplarsın.';
  const sensingIntuition = type[1] === 'N'
    ? 'N - Sezgi: Olayların arkasındaki örüntüleri, ihtimalleri ve gelecekte açılabilecek yolları hızlı fark edersin.'
    : 'S - Duyumsama: Somut bilgi, yaşanmış deneyim, ayrıntı ve gerçekçi uygulama senin için güçlü referanslardır.';
  const feelingThinking = type[2] === 'T'
    ? 'T - Düşünme: Kararlarda mantık, tutarlılık, neden-sonuç ve adalet duygusu belirgin çalışır.'
    : 'F - Hissetme: Kararlarda değerler, ilişki etkisi, empati ve insani sonuçlar belirgin çalışır.';
  const judgingPerceiving = type[3] === 'P'
    ? 'P - Algılama: Seçenekleri açık tutmak, esnemek ve süreç içinde yön bulmak seni rahatlatır.'
    : 'J - Yargılama: Netleşmek, plan yapmak, karar almak ve tamamlanmışlık hissi seni rahatlatır.';
  return [introExtro, sensingIntuition, feelingThinking, judgingPerceiving];
}

function calculateGenericResult(test: PersonalityTestDefinition, answers: Record<number, number>): GenericResult {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  test.questions.forEach((question) => {
    const raw = answers[question.id] || 3;
    const value = question.reverse ? 6 - raw : raw;
    totals[question.dimension] = (totals[question.dimension] || 0) + value;
    counts[question.dimension] = (counts[question.dimension] || 0) + 1;
  });
  const percentages = Object.fromEntries(
    Object.entries(totals).map(([key, total]) => [key, Math.round((total / ((counts[key] || 1) * 5)) * 100)]),
  );
  const type = test.resultOrder.reduce((best, key) => {
    if (!best) return key;
    return (percentages[key] || 0) > (percentages[best] || 0) ? key : best;
  }, '');
  return { type, scores: totals, percentages };
}

function GenericPersonalityTestScreen({
  navigation,
  profileId,
  test,
}: {
  navigation: Props['navigation'];
  profileId: string;
  test: PersonalityTestDefinition;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [savedResultType, setSavedResultType] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const answeredCount = Object.keys(answers).length;
  const missingQuestionIds = test.questions.filter((question) => typeof answers[question.id] !== 'number').map((question) => question.id);
  const result = useMemo(() => calculateGenericResult(test, answers), [answers, test]);
  const resultDetail = test.results[result.type];

  const setAnswer = (questionId: number, value: number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const saveAndShowResult = async () => {
    if (answeredCount < test.questions.length || isSaving || !resultDetail) return;
    const dimensionSummary = test.resultOrder
      .map((key) => `${test.dimensions[key]} ${result.percentages[key] || 0}%`)
      .join(', ');
    const summary = `${test.title} sonucu: ${resultDetail.title}. ${resultDetail.description} Boyutlar: ${dimensionSummary}.`;
    setIsSaving(true);
    try {
      if (savedResultType !== result.type) {
        const nextState = await appendReplacingProfileTestResult({
          profileId,
          assistantId: 'testler',
          readingType: 'personality-test',
          surfacesRead: [],
          summary,
          testResult: {
            testId: test.id,
            testName: test.title,
            resultCode: resultDetail.code,
            resultTitle: resultDetail.title,
            dimensions: result.percentages,
          },
          transcript: [
            {
              role: 'assistant',
              text: summary,
              timestamp: Date.now(),
            },
          ],
        });
        const readingId = nextState.readings[0]?.readingId;
        await appendUserStatedTestResult({
          profileId,
          readingId: readingId || `${Date.now()}`,
          testId: test.id,
          testName: test.title,
          resultCode: resultDetail.code,
          resultTitle: resultDetail.title,
          summary,
        });
        setSavedResultType(result.type);
      }
      setShowResult(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (showResult && answeredCount === test.questions.length && resultDetail) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
          <View style={styles.resultPanel}>
            <Text style={styles.eyebrow}>Test sonucu</Text>
            <Text style={styles.resultName}>{resultDetail.title}</Text>
            <Text style={styles.resultText}>{resultDetail.description}</Text>
            <View style={styles.detailStack}>
              <View style={styles.detailBlock}>
                <Text style={styles.detailTitle}>Güçlü Yanların</Text>
                <Text style={styles.detailText}>{resultDetail.strengths}</Text>
              </View>
              <View style={styles.detailBlock}>
                <Text style={styles.detailTitle}>Gelişim Alanı</Text>
                <Text style={styles.detailText}>{resultDetail.growth}</Text>
              </View>
              <View style={styles.detailBlock}>
                <Text style={styles.detailTitle}>İlişkilerde</Text>
                <Text style={styles.detailText}>{resultDetail.relationships}</Text>
              </View>
              <View style={styles.detailBlock}>
                <Text style={styles.detailTitle}>Sana İyi Gelen Ritim</Text>
                <Text style={styles.detailText}>{resultDetail.rhythm}</Text>
              </View>
            </View>
            <View style={styles.scoreGrid}>
              {test.resultOrder.map((key) => (
                <Text key={key} style={styles.scoreText}>
                  {test.dimensions[key]}: {result.percentages[key] || 0}%
                </Text>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>Kişiye Özel Sayfasına Dön</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setAnswers({});
                setShowResult(false);
                setSavedResultType(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Testi Yeniden Çöz</Text>
            </TouchableOpacity>
          </View>
        </BrandedScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.headerPanel}>
          <Text style={styles.title}>{test.title}</Text>
          <Text style={styles.meta}>{test.meta}</Text>
          <Text style={styles.helper}>{test.intro} Doğru ya da yanlış cevap yok; son haftalardaki doğal eğilimini işaretle.</Text>
          <Text style={styles.progress}>{answeredCount} / {test.questions.length}</Text>
        </View>

        {test.questions.map((question) => (
          <View
            key={question.id}
            style={[styles.questionCard, typeof answers[question.id] === 'number' && styles.questionCardAnswered]}
          >
            <Text style={styles.questionNumber}>{question.id}. soru</Text>
            <Text style={styles.questionText}>{question.text}</Text>
            <FivePointSlider value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
            <View style={styles.scaleLabelRow}>
              <Text style={styles.scaleLabel}>{test.lowLabel}</Text>
              <Text style={styles.scaleLabel}>Ortada</Text>
              <Text style={styles.scaleLabel}>{test.highLabel}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.primaryButton, answeredCount < test.questions.length && styles.primaryButtonDisabled]}
          disabled={answeredCount < test.questions.length}
          onPress={() => void saveAndShowResult()}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Kaydediliyor...' : 'Sonucu Göster'}</Text>
        </TouchableOpacity>
        {missingQuestionIds.length ? (
          <Text style={styles.missingText}>
            Eksik sorular: {missingQuestionIds.slice(0, 8).join(', ')}
            {missingQuestionIds.length > 8 ? ` ve ${missingQuestionIds.length - 8} soru daha` : ''}
          </Text>
        ) : null}
      </BrandedScrollView>
    </SafeAreaView>
  );
}

export function MbtiTestScreen(props: Props) {
  const testId = props.route.params.testId;
  if (!testId) {
    return <PersonalityTestSelectScreen navigation={props.navigation} profileId={props.route.params.profileId} />;
  }
  const genericTest = testId !== 'mbti' ? PERSONALITY_TESTS[testId as PersonalityTestId] : null;
  if (genericTest) {
    return <GenericPersonalityTestScreen navigation={props.navigation} profileId={props.route.params.profileId} test={genericTest} />;
  }
  return <MbtiOnlyTestScreen {...props} />;
}

function PersonalityTestSelectScreen({
  navigation,
  profileId,
}: {
  navigation: Props['navigation'];
  profileId: string;
}) {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.headerPanel}>
          <Text style={styles.title}>Testler</Text>
          <Text style={styles.helper}>Profilin kişilik, bağlanma, değerler, uyum ve başa çıkma eğilimlerini anlamak için bir test seç.</Text>
        </View>
        <View style={styles.testGrid}>
          {TEST_SELECTION.map((test) => (
            <TouchableOpacity
              key={test.id}
              style={styles.testCard}
              activeOpacity={0.84}
              onPress={() => navigation.navigate('MbtiTest', { profileId, testId: test.id })}
            >
              <Text style={styles.testCardTitle}>{test.title.toLocaleUpperCase('tr-TR')}</Text>
              <Text style={styles.testCardMeta}>{test.meta}</Text>
              <Text style={styles.testCardDescription}>{test.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BrandedScrollView>
    </SafeAreaView>
  );
}

function MbtiOnlyTestScreen({ navigation, route }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [savedResultType, setSavedResultType] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const answeredCount = Object.keys(answers).length;
  const missingQuestionIds = QUESTIONS.filter((question) => typeof answers[question.id] !== 'number').map((question) => question.id);
  const result = useMemo(() => calculateResult(answers), [answers]);

  const setAnswer = (questionId: number, value: number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const saveAndShowResult = async () => {
    if (answeredCount < QUESTIONS.length || isSaving) return;
    const description = TYPE_DESCRIPTIONS[result.type];
    const summary = `MBTI Kişilik Testi sonucu: ${result.type}. ${description}`;
    setIsSaving(true);
    try {
      if (savedResultType !== result.type) {
        const nextState = await appendReplacingProfileTestResult({
          profileId: route.params.profileId,
          assistantId: 'testler',
          readingType: 'personality-test',
          surfacesRead: [],
          summary,
          testResult: {
            testId: 'mbti',
            testName: 'MBTI Kişilik Testi',
            resultCode: result.type,
            resultTitle: result.type,
            dimensions: {
              IE: result.scores.IE,
              SN: result.scores.SN,
              FT: result.scores.FT,
              JP: result.scores.JP,
            },
          },
          transcript: [
            {
              role: 'assistant',
              text: summary,
              timestamp: Date.now(),
            },
          ],
        });
        const readingId = nextState.readings[0]?.readingId;
        await appendUserStatedTestResult({
          profileId: route.params.profileId,
          readingId: readingId || `${Date.now()}`,
          testId: 'mbti',
          testName: 'MBTI Kişilik Testi',
          resultCode: result.type,
          resultTitle: result.type,
          summary,
        });
        setSavedResultType(result.type);
      }
      setShowResult(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (showResult && answeredCount === QUESTIONS.length) {
    const detail = TYPE_DETAIL[result.type];
    const archetype = TYPE_ARCHETYPES[result.type];
    const dimensions = dimensionMeaning(result.type);
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
          <View style={styles.resultPanel}>
            <Text style={styles.eyebrow}>MBTI sonucu</Text>
            <Text style={styles.resultType}>{result.type}</Text>
            {archetype ? <Text style={styles.resultName}>{archetype.name}</Text> : null}
            <Text style={styles.resultText}>{TYPE_DESCRIPTIONS[result.type]}</Text>
            {detail ? (
              <View style={styles.detailStack}>
                {archetype ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailTitle}>Tip Benzetmesi Neden Böyle?</Text>
                    <Text style={styles.detailText}>{archetype.reason}</Text>
                  </View>
                ) : null}
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Harfler Ne Anlama Geliyor?</Text>
                  {dimensions.map((item) => (
                    <Text key={item.slice(0, 1)} style={styles.dimensionText}>{item}</Text>
                  ))}
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Ana Tema</Text>
                  <Text style={styles.detailText}>{detail.theme}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Kendini Tanıma</Text>
                  <Text style={styles.detailText}>
                    {detail.self} Bu bölüm sonucu bir etiket gibi değil, kendini gözlemlemek için bir ayna gibi düşünmek daha doğru olur. Tipin, her durumda böyle davranacağını söylemez; hangi yöne daha doğal aktığını gösterir.
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Güçlü Yanların</Text>
                  <Text style={styles.detailText}>
                    {detail.strengths} Bu güçlü yanlar özellikle baskı altında, ilişkilerde karar verirken ve yeni bir hedefe başlarken kendini belli eder. Farkında olduğunda bunları daha bilinçli kullanabilirsin.
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Zorlanma ve Gelişim Alanı</Text>
                  <Text style={styles.detailText}>
                    {detail.growth} Buradaki amaç kendini eleştirmek değil; otomatikleşen tarafını fark edip gerektiğinde başka bir kası da devreye alabilmek.
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>İlişkilerde</Text>
                  <Text style={styles.detailText}>
                    {detail.relationships} Yakın ilişkilerde bu tipin hem sevgi gösterme biçimini hem de kırıldığında nasıl geri çekildiğini anlamak çok işe yarar.
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Çalışma ve Yaşam Ritmi</Text>
                  <Text style={styles.detailText}>
                    {detail.rhythm} Kendini verimli hissettiğin koşulları bilmek, hedeflerini daha gerçekçi kurmana ve gereksiz sürtünmeleri azaltmana yardım eder.
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.scoreGrid}>
              <Text style={styles.scoreText}>I/E: {result.scores.IE > 24 ? 'E' : 'I'}</Text>
              <Text style={styles.scoreText}>S/N: {result.scores.SN > 24 ? 'N' : 'S'}</Text>
              <Text style={styles.scoreText}>F/T: {result.scores.FT > 24 ? 'T' : 'F'}</Text>
              <Text style={styles.scoreText}>J/P: {result.scores.JP > 24 ? 'P' : 'J'}</Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>Kişiye Özel Sayfasına Dön</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
            onPress={() => {
              setAnswers({});
              setShowResult(false);
              setSavedResultType(null);
            }}
            >
              <Text style={styles.secondaryButtonText}>Testi Yeniden Çöz</Text>
            </TouchableOpacity>
          </View>
        </BrandedScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandedScrollView contentContainerStyle={styles.content} showScrollToTop>
        <View style={styles.headerPanel}>
          <Text style={styles.title}>MBTI Kişilik Testi</Text>
          <Text style={styles.meta}>32 soru, yaklaşık 12-15 dakika</Text>
          <Text style={styles.helper}>
            Açık kaynak OEJTS mantığıyla iki uç arasında kendini nereye yakın hissettiğini işaretle. Doğru ya da yanlış cevap yok.
          </Text>
          <Text style={styles.progress}>{answeredCount} / {QUESTIONS.length}</Text>
        </View>

        {QUESTIONS.map((question) => (
          <View
            key={question.id}
            style={[styles.questionCard, typeof answers[question.id] === 'number' && styles.questionCardAnswered]}
          >
            <Text style={styles.questionNumber}>{question.id}. soru</Text>
            <View style={styles.pairRow}>
              <Text style={styles.pairText}>{question.left}</Text>
              <Text style={[styles.pairText, styles.pairTextRight]}>{question.right}</Text>
            </View>
            <FivePointSlider value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
            <View style={styles.scaleLabelRow}>
              <Text style={styles.scaleLabel}>Sol</Text>
              <Text style={styles.scaleLabel}>Ortada</Text>
              <Text style={styles.scaleLabel}>Sağ</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.primaryButton, answeredCount < QUESTIONS.length && styles.primaryButtonDisabled]}
          disabled={answeredCount < QUESTIONS.length}
          onPress={() => void saveAndShowResult()}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Kaydediliyor...' : 'Sonucu Göster'}</Text>
        </TouchableOpacity>
        {missingQuestionIds.length ? (
          <Text style={styles.missingText}>
            Eksik sorular: {missingQuestionIds.slice(0, 8).join(', ')}
            {missingQuestionIds.length > 8 ? ` ve ${missingQuestionIds.length - 8} soru daha` : ''}
          </Text>
        ) : null}
      </BrandedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  content: { padding: 18, paddingBottom: 34 },
  headerPanel: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  title: { color: '#FFF5E8', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  meta: { color: '#F6C38B', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  helper: { color: 'rgba(212,165,116,0.78)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  progress: { color: '#E8C49A', fontSize: 12, fontWeight: '900' },
  questionCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
  },
  questionCardAnswered: {
    borderColor: 'rgba(125,220,154,0.42)',
    backgroundColor: 'rgba(125,220,154,0.06)',
  },
  questionNumber: { color: '#D4A574', fontSize: 11, fontWeight: '900', marginBottom: 6 },
  questionText: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 12 },
  pairRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  pairText: { color: '#FFF5E8', fontSize: 13, fontWeight: '800', lineHeight: 18, flex: 1 },
  pairTextRight: { color: 'rgba(212,165,116,0.86)', textAlign: 'right' },
  optionRow: { gap: 8 },
  sliderWrap: { height: 44, marginHorizontal: 10, justifyContent: 'center' },
  sliderTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(212,165,116,0.28)',
  },
  sliderPointTouch: {
    position: 'absolute',
    width: 38,
    height: 38,
    marginLeft: -19,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderPoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(212,165,116,0.62)',
    backgroundColor: '#1E1E28',
  },
  sliderPointSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderColor: '#F6C38B',
    backgroundColor: '#D4A574',
  },
  sliderKnob: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#F6C38B',
    backgroundColor: '#D4A574',
  },
  scaleLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  scaleLabel: { color: 'rgba(212,165,116,0.68)', fontSize: 10, fontWeight: '800' },
  optionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    borderColor: '#D4A574',
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  optionText: { color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: '700' },
  optionTextSelected: { color: '#F6C38B' },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: '#14141E', fontSize: 14, fontWeight: '900' },
  missingText: { color: '#F6C38B', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 10, textAlign: 'center' },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.42)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: '#F6C38B', fontSize: 13, fontWeight: '800' },
  resultPanel: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.22)',
  },
  eyebrow: { color: '#D4A574', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  resultType: { color: '#FFF5E8', fontSize: 42, fontWeight: '900', marginBottom: 10 },
  resultName: { color: '#F6C38B', fontSize: 20, fontWeight: '900', marginTop: -6, marginBottom: 10 },
  resultText: { color: 'rgba(212,165,116,0.82)', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  detailStack: { gap: 10, marginBottom: 14 },
  detailBlock: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.16)',
  },
  testGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  testCard: {
    width: '48.5%',
    minHeight: 132,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.2)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    padding: 12,
    justifyContent: 'space-between',
  },
  testCardTitle: {
    color: '#FFF5E8',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginBottom: 6,
  },
  testCardMeta: {
    color: '#F6C38B',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    marginBottom: 6,
  },
  testCardDescription: {
    color: 'rgba(212,165,116,0.72)',
    fontSize: 10,
    lineHeight: 15,
  },
  detailTitle: { color: '#E8C49A', fontSize: 13, fontWeight: '900', marginBottom: 6 },
  detailText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20 },
  dimensionText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  scoreText: {
    minWidth: 76,
    color: '#F6C38B',
    fontSize: 12,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.28)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
