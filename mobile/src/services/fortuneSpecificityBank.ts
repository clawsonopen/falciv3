import type { ProfileMemorySnippet } from '../types/memory';
import type { CoffeeMode, FortuneMessage, FortuneReadingType } from './fortunePromptBuilder';

type SpecificityItem = {
  group: string;
  label: string;
};

export type SpecificityUsage = {
  events: SpecificityItem[];
  cues: string[];
};

const ITEMS_PER_GROUP = 50;
const PICKS_PER_READING = 4;
const CUES_PER_READING = 4;

function list(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const SURFACE_CUE_BANK = list(`
dibe yakın ince çizgi
dibe yakın koyu birikinti
dibe yakın açık boşluk
dibe yakın tek damla
dibe yakın iki küçük nokta
dipte halka gibi kapanan iz
dipte yarım ay boşluğu
dipten kenara yürüyen akıntı
dipte üst üste binen taneler
dipte dağ gibi koyuluk
fincan ortasında ince yol
fincan ortasında kuşu andıran açıklık
fincan ortasında kapı gibi boşluk
fincan ortasında anahtar gibi çizgi
fincan ortasında iki kola ayrılan akış
fincan ortasında küçük ada lekesi
fincan ortasında yüz yüze duran iki iz
fincan ortasında kırık halka
fincan ortasında merdiven gibi taneler
fincan ortasında dal gibi uzayan leke
kenara yakın birikinti
kenara yakın ince yol
kenara yakın tek koyu nokta
kenara yakın açık kapı boşluğu
kenara yakın kuyruklu leke
kenarda dışarı taşan akıntı
kenarda kalabalık taneler
kenarda ayrılıp birleşen iki çizgi
kenarda yarım kalan iz
kenarda kuş gagası gibi açıklık
kulba yakın koyuluk
kulba yakın ince çizgi
kulba yakın iki küçük nokta
kulba yakın açık alan
kulba yakın düğüm gibi birikinti
ağız kısmında açık yol
ağız kısmında telve sıçraması
ağız kısmında yan yana taneler
ağız kısmında aşağı inen akıntı
ağız kısmında keskin dönüşlü çizgi
tabak merkezinde göllenme
tabak merkezinde beyaz açıklık
tabak merkezinden dışa açılan yol
tabak dış halkasında koyu leke
tabak dış halkasına taşan iz
tabakta ikiye ayrılan akış
tabakta küçük damla dizisi
tabakta dağılmış telve taneleri
tabakta yarım halka
tabakta kapı eşiği gibi açık çizgi
`);

const LIFE_EVENT_GROUPS: Record<string, string[]> = {
  'Haberleşme': list(`
cevabı geciken kısa mesaj
geri dönülmesi gereken telefon
yanlış anlaşılan bir cümle
iki kişi arasında taşınan haber
silinip yeniden yazılmış mesaj
kısa ama net konuşma
duyulup cevaplanmamış söz
sabah saatine kalan haberleşme
eski sohbetten çıkan iz
sessizlikten sonra gelen yoklama
grup mesajında karışan anlam
sesli mesajla açıklanan konu
cevabı kısa tutulmuş soru
yanlış kişiye gidebilecek mesaj
ekran görüntüsüyle saklanan konuşma
telefon rehberinde eski isim
numarası değişmiş tanıdık
cevabı nazikçe ertelenen davet
iki kere okunup bırakılan mesaj
aramaya cesaret edilemeyen kişi
haber beklenen kurum
mesajı geç gören yakın
yarım kalan görüntülü konuşma
konuşmada atlanan detay
kalp kırmadan sorulacak soru
bir cümlenin yanlış tonda anlaşılması
özür bekleyen kısa temas
teşekkür edilmesi unutulan kişi
planı netleştirecek tek mesaj
aynı konuda ikinci hatırlatma
mesajlaşmada fazla uzayan açıklama
sessiz kalınca büyüyen merak
gece yazılıp sabah silinen söz
telefonu açmayan ama dönecek kişi
eski bir fotoğraftan açılan sohbet
takvim davetiyle gelen hatırlatma
ses tonundan sezilen çekince
mesajın sonuna eklenmeyen cümle
yanlış anlaşılmayı dağıtacak açıklama
kısa cevapla kapanmayacak konu
uzaktan beklenen haber
araya giren üçüncü kişinin sözü
görülmüş ama cevaplanmamış işaret
çok yazıp az söyleme hali
konuşmayı başlatacak küçük bahane
eski numaradan gelen selam
resmi dille yazılması gereken mesaj
içten ama ölçülü cevap
unutulan aramayı telafi etme
günü değiştiren küçük bildirim
`),
  'Ev Düzeni': list(`
ev içinde yeri değişecek eşya
mutfak masasında konuşulacak mesele
anahtar ve kapı rutini
ertelenmiş küçük temizlik
çekmece veya dolap düzeni
evde kısa kalabalık hazırlığı
tamir isteyen ufak aksaklık
iki kişinin farklı düşündüğü ev konusu
eve alınacak küçük ihtiyaç
odanın havasını değiştirme isteği
koltuk köşesinde unutulan eşya
kapı girişinde biriken işler
mutfakta eksilen malzeme
banyoda ertelenen küçük düzen
çamaşır veya ütü planı
evde sessiz kalmış konuşma
misafir öncesi toparlanma
bozulan küçük alet
dolapta ayrılacak eski parça
masa üstünde kalan evrak
evin ışığı veya perdesiyle ilgili değişim
kaybolan anahtarı arama
kapı ziliyle bölünen an
evden çıkarken unutulan şey
eşyaların yerini sadeleştirme
gereksiz kalabalığı azaltma
ev içi harcamayı konuşma
ortak alanı paylaşma konusu
oda değişikliği fikri
duvara asılacak küçük şey
eski kutuyu açma
evde koku veya hava değiştirme
tamirciye sorulacak küçük iş
komşuyla ortak kapı meselesi
evde kısa süreli bekleme
fazla eşyanın verilmesi
mutfak alışverişi listesi
rafları yeniden ayarlama
evde küçük güvenlik kontrolü
kapı önü ayakkabı düzeni
gece unutulan ışık
su, elektrik veya abonelik kontrolü
evde iki işin aynı güne sıkışması
eşya taşırken çıkan konuşma
temizlikte bulunan eski not
ev içi görev paylaşımı
yatak odasında dinlenme düzeni
salonda bekleyen küçük karar
evden çıkan paket
evin ritmini sakinleştirme
`),
  'Aile': list(`
aile içinde yumuşak konuşma
uzaktaki yakından haber
büyüklerden pratik uyarı
ev içi sorumluluk paylaşımı
küçük sitemi büyütmeden açma
aile planında gün değişikliği
iki akraba arasında dengede kalma
sofrada geçecek konuşma
eski aile meselesini hafifçe hatırlama
destek istenecek pratik konu
kardeş veya kuzenle kısa haberleşme
anne tarafında konuşulan küçük gündem
baba tarafında bekleyen cevap
aile içinde sakince sorulacak soru
bayram veya ziyaret planı
yaşça büyük birinin gönlünü alma
evde kimin neyi üstleneceği
uzaktan gelen misafir ihtimali
aile fotoğrafından açılan hatıra
küçük bir alınganlığı yumuşatma
sofraya oturmadan önce konuşulacak şey
akrabadan gelen ricayı ölçme
çocuk veya genç biriyle ilgili düzen
evdeki büyüğün sağlık rutinini hatırlama
aile bütçesinde küçük konuşma
birinin aramasını bekleme
aile içi planı netleştirme
geç kalınan tebrik veya teşekkür
akraba ziyaretini erteleme
ev içinde susan birini fark etme
ortak hatırayı yanlış yorumlamama
ailede lafın dolanması
yakınlık gösterirken sınır koruma
anne sesi gibi gelen uyarı
babanın pratik çözüm araması
kardeşle aynı konuya başka yerden bakma
kuzen veya teyze hattından haber
aile içinde barıştırıcı rol
eski kırgınlığı yeniden büyütmeme
evde herkesin duyduğu ama konuşmadığı şey
aile grubunda yazılan mesaj
ziyaret saatini ayarlama
küçük hediye veya ikram
uzaktaki büyüğe hal hatır sorma
aile içinde iki ayrı plan
kalabalıkta yalnız kalan kişi
ortak karar öncesi nabız yoklama
aileden gelen küçük destek
yanlış anlaşılmış niyeti düzeltme
evin büyükleriyle ölçülü konuşma
`),
  'İş ve Görev': list(`
cevap bekleyen mail
küçük iş yeri aksaklığı
kalabalıkta az duyulan kişi
ertelenmiş görev listesi
toplantı öncesi hazırlık
birinin netlik beklediği konu
işte iki seçenek arasında kalma
gözden kaçmış detay
emeğin hemen karşılık bulmaması
sakin anlatılırsa çözülecek görev
dosya adında karışıklık
teslim tarihi yaklaşan iş
fazla sorumluluk alma eğilimi
ekip içinde rol paylaşımı
patron veya yöneticiyle kısa konuşma
iş arkadaşından gelecek rica
ufak hata düzeltme
planı yeniden sıraya koyma
işte gereksiz acele
bir belgeyi tekrar kontrol etme
vardiya veya saat değişimi
iş yerinde sessiz rekabet
başkasının işini üstlenme sınırı
kısa eğitim veya anlatım
raporda eksik kalan satır
müşteri veya danışan dönüşü
bekleyen onay
masa başında uzayan iş
öğleden sonraya kalan cevap
işte küçük takdir beklentisi
birinin sözünü kesmemeye çalışma
iş yükünü görünür kılma
eski görevden kalan ayrıntı
yeni iş fikrini yoklama
iş arayışında güncelleme
referans veya tanıdık desteği
uzaktan çalışma düzeni
not almayı gerektiren konuşma
ekip mesajında yanlış anlaşılma
takvimde çakışan iki görev
sunum veya anlatım hazırlığı
küçük başarıyı küçümsememe
iş yerinde kapı arası konuşma
fazla açıklama yapma hali
öncelik sırası kurma
bir işi devretme ihtiyacı
beklenenden kısa süren görüşme
işte sakin kalınca açılan yol
yarım kalan dosyayı tamamlama
günün sonunda kapanacak görev
`),
  'Para ve Bütçe': list(`
küçük ödeme takibi
fatura veya abonelik kontrolü
alışverişte iki ihtiyaç seçimi
ufak masrafı fark etme
bütçede küçük dengeleme
para konuşmasında acele söz vermeme
ortak harcamayı açık konuşma
küçük indirim farkı
ertelenmiş ödeme tarihi
gereksiz harcamayı kısmak
cüzdanda unutulan fiş
hesap hareketini kontrol etme
ödeme hatırlatması kurma
küçük borç alacak konuşması
taksit tarihini gözden geçirme
alışveriş listesini sadeleştirme
hediye için bütçe ayırma
ev ihtiyacına para ayırma
beklenen küçük iade
fiyat karşılaştırması yapma
acele alınacak ürünü erteleme
para yüzünden kırıcı konuşmama
ortak hesapta netlik
abonelik iptali düşüncesi
nakit ve kart dengesini kurma
harcamayı yazma ihtiyacı
küçük birikimi koruma
fazla cömert davranma sınırı
unutulan otomatik ödeme
ev içi masraf paylaşımı
yol masrafını hesaplama
alışverişte kalite fiyat dengesi
indirimli ürünün gerçekten gerekip gerekmediği
beklenmedik küçük ödeme
para konusunda iç sıkışması
harcama sonrası pişmanlık yaşamama
ödeme ekranında dikkat
yanlış tutarı düzeltme
küçük kazancı küçümsememe
para istemeye çekinen biri
masrafı ikiye bölme
ucuz görünen pahalı seçenek
evraklı ödeme takibi
ödenmiş şeyi tekrar kontrol etme
kenara küçük miktar ayırma
fiyatı netleşmeyen hizmet
günlük bütçe sınırı
gereksiz abonelik temizliği
borçlanmadan önce düşünme
para konuşmasını sakinleştirme
`),
  'Resmi İş': list(`
randevu saati kontrolü
imza veya form kontrolü
eksik evrak tamamlama
kurumdan beklenen cevap
tarih ve saat karışıklığı
dosya veya kayıt bilgisi
resmi konuşmada sakin kalma
başvuruyu takip etme
küçük yazım hatası
kapıda bekleten işlem
kimlik veya belge hatırlatma
online formu tamamlamak
sıra numarası bekleme
imza öncesi okuma
mail ekini kontrol etme
kurum aramasına dönme
randevuyu ertelememe
eksik fotokopi
ad soyad bilgisini düzeltme
adres bilgisini güncelleme
başvuru sonucunu kontrol etme
resmi evrakı çantaya koyma
teslim tarihini not alma
bekleme salonunda gelen haber
kısa danışma görüşmesi
yanlış vezne veya oda
belgeyi saklama ihtiyacı
küçük harç veya ödeme
resmi dille yazılacak dilekçe
başkasının evrakına yardım
yenileme tarihi
şifre veya e-devlet erişimi
randevu ekranında boş saat arama
dosya numarası kaydetme
ikinci kez sorulacak bilgi
resmi işte acele etmeden okuma
evrak klasörü düzenleme
başvuruda eksik alan
telefonla kurum teyidi
imzalı kağıdı teslim etme
kurumdan gelen kısa mesaj
yanlış anlaşılmış işlem
son gün telaşını azaltma
işlemi iki adımda tamamlama
resmi konuyu aileye açıklama
belge fotoğrafını saklama
onay bekleyen kayıt
başvuruya destek olacak kişi
küçük prosedür detayı
rahatlayacak evrak işi
`),
  'Yol ve Ulaşım': list(`
kısa ziyaret planı
ani uğrama ihtimali
iki duraklı şehir içi yol
ertelenmiş küçük yol
kapıdan dönülen iş
yolda tanıdıkla karşılaşma
bilet saati kontrolü
rota değiştirme
eli dolu gidilecek yer
gidiş dönüşlü kısa iş
bekleme sırasında haber
plan değişse de tamamlanan ziyaret
taksi veya toplu taşıma kararı
yolda unutulan eşya
eve dönüş saatini ayarlama
yakın semte uğrama
ziyaret öncesi arama
yol arkadaşını bekleme
geç kalmamak için hazırlık
iki işi tek yolda bitirme
yanlış durakta inme kaygısı
yol üstü alışveriş
kapıya kadar gidip konuşma
uzun yolu kısa tutma
yol için hava kontrolü
çantayı hafifletme
araçta yapılacak konuşma
park yeri veya giriş sorunu
bekleme salonunda düşünme
gidiş sebebini netleştirme
yolculuğu ertelememe
yakın yere yürüyerek gitme
habersiz uğramama
yolda gelen telefon
yanına alınacak küçük şey
dönüşte alınacak eşya
kısa kaçamak planı
ziyareti fazla uzatmama
iki adres arasında seçim
yola çıkmadan mesaj atma
gidilecek yerin saatini sorma
yolda sakin kalma
küçük gecikmeyi büyütmeme
yol masrafını hesaplama
karşı tarafın gelmesini bekleme
aynı yere ikinci kez gitme
çıkış saatini erkene alma
dönüşte rahatlama
yakın çevrede keşif
yolun sonunda kısa görüşme
`),
  'Sosyal Çevre': list(`
kalabalıkta çevrilen konu
eski tanıdıktan selam
iki kişi arasında yanlış anlaşılma
kararsız kalınan davet
grupta söylenmeyen rahatsızlık
yakın arkadaşla plan netleştirme
sosyal medyada görülen iz
kalabalıktan ayrılıp konuşma
küçük kutlama hazırlığı
laf taşıma ihtimaline mesafe
arkadaş grubunda saat karışıklığı
unutulan doğum günü
birinin fazla meraklı sorusu
güvenilen kişiye danışma
eski arkadaşla kısa yoklama
ortamda susup gözlemleme
davetin detayını sorma
yan yana gelen iki ayrı çevre
sohbetten sonra kalan his
arkadaşın küçük ricası
kalabalıkta yalnız hissetme
birinin iyi niyetini sınama
görüşmeyi erteleme
fotoğraf veya paylaşım gündemi
ortak tanıdık üzerinden haber
eski grupla mesafe kurma
yakın çevrede kıskançlık sezgisi
samimi ama ölçülü konuşma
arkadaşla para konuşmama
bir ortama sonradan katılma
fazla açıklama yapmadan ayrılma
söz arasında duyulan detay
başkasının meselesini taşımama
güven veren küçük destek
yanlış yerde fazla kalma
planı son dakika değiştirme
birinin gönlünü alma
eski konuyu şakaya vurma
davet listesinden doğan gerilim
ortak arkadaşla buluşma
sessiz kalan kişiye alan açma
kalabalık sonrası yorgunluk
birinin seni kollaması
dedikodudan uzak durma
yakınlık sınırını koruma
tanıdık yüzle rastlaşma
sosyal çevrede yeni kapı
samimiyeti yavaş kurma
kararsız davete net cevap
küçük topluluk içinde rahatlama
`),
  'Duygusal Alan': list(`
içte tutulan küçük kırgınlık
konuşulursa hafifleyecek sitem
beklentiyi büyütmeden izlenen yakınlık
yanlış anlaşılmış niyet
kalpte kalan cevap
fazla anlam yüklenen işaret
sınırı nazikçe anlatma
sessiz kalınca büyüyen duygu
güveni yavaş yoklama
eski duygu dilini bugüne taşımama
cevap beklerken kendini yormama
duyguyu ölçülü ifade etme
birinin tavrını fazla üstlenmeme
kırılmadan önce konuşma
içine atılan kısa söz
beklentiyle gerçek arasındaki fark
karşı tarafın ritmini izleme
duygusal aceleyi yavaşlatma
gönül koymadan netleşme
kalbi rahatlatan küçük jest
söylenmeyen teşekkür
fazla fedakarlığı fark etme
eski bir hassasiyeti tetiklememe
kendine şefkat gösterme
ilişkide küçük denge arama
duyguyu kanıt beklemeden anlama
mesafe ihtiyacını suçluluk yapmama
yakınlığın dozunu ayarlama
kalp kırmadan soru sorma
duygusal yorgunluğu sakince taşıma
beklenen ilginin gecikmesi
yanlış zamanda konuşmama
küçük bir barışma kapısı
hisleri abartmadan okuma
içinden geçen şeyi adlandırma
güven vermek için küçük adım
alınganlığı büyütmeden çözme
kendini anlatırken yumuşak kalma
duygusal sınırı koruma
beklenen söz gelmese de toparlanma
geçmişteki kırgınlığı bugüne taşımama
yakınlıkta netlik arama
sevilme ihtiyacını saklamama
karşılıklı emek dengesini görme
sessizlikte anlam ararken sakin kalma
küçük jesti fark etme
kalbin acele ettiği konu
niyeti açıkça sorma
gönül kapısını aralık tutma
duyguyu günlük hayatla dengeleme
`),
  'Gündelik Rutin': list(`
unutulan küçük eşya
randevu veya saat kayması
evden çıkmadan toparlanacak iş
çanta anahtar kart kontrolü
kısa alışveriş listesi
iki küçük işi birleştirme
ertelenince büyüyen pratik mesele
telefon şarjı veya not
sabah rutini değişimi
akşam kapanmadan tamamlanacak iş
yemek planını sadeleştirme
günlük notu yeniden yazma
dolapta aranacak parça
kıyafet hazırlığı
çöp veya geri dönüşüm işi
küçük alışkanlık değişimi
erken kalkma niyeti
geç yatmayı azaltma
çalışma masasını toparlama
çantada eksik kalan şey
telefonu sessize alma
gün içinde kısa mola
unutulan su içme rutini
market sırasındaki karar
evden çıkış saatini ayarlama
kargo takibi
paket açma veya iade
basit liste hazırlama
aynı işi iki kez yapmama
küçük düzen kurma
günün ilk işini seçme
akşam mesajını unutmama
anahtarı aynı yere koyma
günlük planı hafifletme
kısa yürüyüş arası
not defterini kontrol etme
gereksiz bildirimi kapatma
dağınık dosyayı toplama
dolaptaki fazlayı ayırma
son dakikaya bırakmama
küçük işi hemen bitirme
gün sonu hesabı yapma
aynı konuya dönüp durmama
evrakı çantaya ekleme
telefon fotoğrafını bulma
basit hazırlığı erkenden yapma
günlük tempoda nefes aralığı
unutulan randevuyu hatırlama
küçük hatırlatıcı kurma
ertesi güne yük bırakmama
`),
  'Sağlık Rutini': list(`
uyku ritmini toparlama
su içmeyi hatırlama
dinlenme aralığı açma
randevu takibini unutmama
bedeni yormadan tempo ayarlama
basit rutinleri ihmal etmeme
uzman görüşünü ertelememe
ekran yorgunluğunu azaltma
kısa yürüyüş molası
nefesini düzenleme
öğün saatini kaçırmama
omuz boyun gevşetme
göz dinlendirme
erken uyuma niyeti
fazla kahveyi azaltma
sıcak soğuk dengesine dikkat
ilaç değil rutin düzeni hatırlama
kontrol tarihini not etme
kendini zorlamadan hareket
dinlenmeyi suçluluk yapmama
beden sinyalini küçümsememe
uyku öncesi ekranı azaltma
su şişesini yanında tutma
kısa esneme molası
günlük adımı hafif artırma
beslenmede düzen arama
ağır kararı yorgunken almama
baş ağrısı gibi belirtiyi izleme
uzun süren şikayette destek alma
dinlenme planını koruma
bedenini dinleyip tempo düşürme
basit kontrolü aksatmama
zihinsel yorgunluğa mola verme
ev içinde hafif hareket
uyandığında acele etmeme
gece rutinini sadeleştirme
kendine sakin alan açma
su ve uyku dengesini kurma
beden yükünü hafifletme
planı sağlığına göre ayarlama
uzmana danışma fikrini ertelememe
basit bakım rutinini tamamlama
temiz hava ihtiyacı
hafif öğün düşüncesi
yorgunluğu bastırmama
kendi sınırını bedenen hissetme
stresi küçük molalarla azaltma
rahat kıyafet veya ortam seçme
gün içinde omuz yükünü bırakma
sağlıkta kesin hükümden kaçınma
`),
  'Eğitim ve Öğrenme': list(`
yarım kalan ders notu
kayıt veya sınav tarihi
öğrenileni pratiğe dökme
birinden açıklama isteme
çalışma planını sadeleştirme
okunacak belgeyi ertelememe
eksik sayfayı tamamlama
kısa araştırmayla netleşecek konu
başvuru formu hazırlığı
sertifika veya kurs kararı
notları yeniden düzenleme
ödev teslim saatini kontrol
anlamadığın yeri sorma
küçük tekrar planı
çalışma masasını hazırlama
eski kaynağı gözden geçirme
video ders notu alma
sınav kaygısını küçültme
öğrenme hızını kabul etme
grup çalışmasında rol paylaşma
öğretmene veya danışmana soru
ders programını güncelleme
okuma listesini kısaltma
tek konuya odaklanma
kaynak karşılaştırması
pratik yaparak öğrenme
başarıyı küçük adımlara bölme
unutulan kayıt şifresi
ders materyali arama
öğrenirken mola verme
geç kalmış başvuruyu kontrol
yanlış dosya yüklememe
not defterindeki eski fikir
eğitim için bütçe düşünme
kısa sınav hazırlığı
hedefi yeniden ölçme
başkasının temposuyla yarışmama
eksik bilgiyi dürüstçe söyleme
okul veya kurs mesajı
son gün telaşını azaltma
çalışma saatini netleştirme
eski dersin bugüne etkisi
öğrenmeyi günlük rutine katma
başarı beklentisini dengeleme
kısa sunum hazırlığı
yanlış anlaşılan konu başlığı
çalışma arkadaşından destek
küçük testle kendini ölçme
hedefi gerçekçi tutma
öğrenme hevesini koruma
`),
  'Dijital Hayat': list(`
unutulan şifre
hesap erişimi
yanlış kişiye gitmemesi gereken mesaj
fotoğraf veya dosya arama
bildirim dağınıklığı
online randevu kontrolü
silinmeden saklanacak bilgi
grup mesajında yanlış anlaşılma
dijital abonelik kontrolü
ekran görüntüsü düzeni
bulut yedeklemesi
telefon hafızası doluluğu
eski sohbet arşivi
mail kutusu temizliği
yanlış dosya adı
online ödeme ekranı
uygulama bildirimi kapatma
fotoğraf albümünü ayırma
şifre yenileme maili
iki aşamalı doğrulama
yanlış linke tıklamama
gizlilik ayarı kontrolü
sosyal medya paylaşımı
sessize alınacak grup
cevap bekleyen mail
dijital notu bulma
telefon rehberi düzeni
eski hesabı kapatma
ekran süresini azaltma
online formu kaydetme
dosya ekini unutma
mesajı taslakta bırakma
video veya ses kaydı
fotoğrafı yanlış yorumlama
cihaz şarj planı
uygulama güncellemesi
unutulan kullanıcı adı
hesap güvenliği
dijital belgeyi indirme
yanlış saat dilimi
arama geçmişinden konu
takvim bildirimi
online toplantı linki
kulaklık veya cihaz hazırlığı
gereksiz uygulamayı silme
ekran yorgunluğu
telefonu elinden bırakma
paylaşmadan önce düşünme
dijital izleri sadeleştirme
teknik küçük aksaklık
`),
  'Komşu ve Mahalle': list(`
kapı önü kısa konuşması
komşudan gelen küçük haber
apartman duyurusu
mahalle içinde rastlaşma
yanlış duyulan söz
küçük yardım isteme
ortak alan meselesi
esnafla kısa konuşma
asansör veya merdiven gündemi
apartman grubunda mesaj
kapıya bırakılan paket
komşunun ricası
mahalle esnafından haber
yan kapıdan gelen ses
ortak fatura konuşması
çöp saati meselesi
giriş kapısı düzeni
komşuya iade edilecek eşya
mahallede kısa yol tarifi
apartman toplantısı
yanlış adrese gelen kargo
kapıcı veya görevliyle konuşma
ortak bahçe meselesi
ses veya gürültü hassasiyeti
eski komşudan selam
mahallede değişen dükkan
kapı ziliyle gelen gündem
küçük ikram veya tabak
komşunun sağlık halini sorma
ortak anahtar konusu
apartmanda beklenen tamir
girişte unutulan eşya
komşu çocuğuyla ilgili konu
mahalle dedikodusuna mesafe
esnafla veresiye değil net hesap
komşudan alınan bilgi
kapı önünde uzayan sohbet
yanlış anlaşılmış iyi niyet
ortak alan temizliği
apartman aidatı konuşması
mahallede kısa ziyaret
komşudan gelen uyarı
paket teslimi için rica
kapı önü karşılaşması
eski mahalleden haber
komşuyla sınır koruma
küçük dayanışma
apartmanda sessiz kalmış konu
mahalle yolunda rastlantı
kapının önünde netleşen söz
`),
  'Evcil Hayvan': list(`
mama ve su kontrolü
veteriner randevusu
huzur alanını koruma
yürüyüş veya oyun saati
davranış değişimini gözleme
oyuncak veya bakım ihtiyacı
yolculukta evcil hayvan planı
emanet düzeni
kum veya temizlik rutini
tüy bakımı
ilaç değil rutin takibi
kapıdan kaçma dikkatı
misafirle uyum
ses veya gürültü hassasiyeti
uyku köşesi düzeni
taşıma çantası hazırlığı
mama değişimini aceleye getirmeme
su kabını yenileme
oyunla sakinleştirme
pati veya tırnak bakımı
evcil hayvanın yalnız kalması
başka hayvanla karşılaşma
park veya yürüyüş planı
küçük iştah değişimi
veteriner kontrolünü ertelememe
bakım eşyasını arama
ödül maması ölçüsü
evde güvenli alan
kapı zili tepkisi
yeni eşya kokusu
komşu hayvanıyla temas
temizlik sonrası huzursuzluk
seyahat öncesi hazırlık
aile içinde bakım paylaşımı
oyun saatini aksatmama
evcil hayvan fotoğrafı
tasmasını kontrol etme
su içme düzeni
korktuğu sese dikkat
sakinleşme köşesi
tuvalet düzeni
küçük yaralanmada uzman desteği
rutin dışı hareketi izleme
fazla ilgiyle bunaltmama
alışkanlığını koruma
evdeki bitki veya eşya güvenliği
misafir çocuğuyla dikkat
mama siparişi
yumuşak bakım dili
hayvanın ritmine uyma
`),
  'Taşınma ve Tadilat': list(`
ölçü veya eşya yeri
küçük tamir zamanı
usta veya servis bekleme
eski eşyayı ayırma
koli veya dolap düzeni
ev içi gürültü planı
taşınma fikrini aceleye getirmeme
bakım isteyen köşe
boya veya renk düşüncesi
perde ölçüsü
mobilya yerleşimi
tesisat kontrolü
küçük çatlak veya vida
servis randevusu
eşya satma veya verme
koli etiketi
oda oda toparlama
yeni ev araştırması
depozito veya sözleşme okuma
komşu düzenine alışma
eski evde kalan eşya
temizlik günü ayarlama
zemin veya halı konusu
ışıklandırma kararı
duvar rafı
küçük dekor değişimi
eşya taşıma yardımı
asansör veya giriş planı
tamir masrafını netleştirme
usta ile saat konuşma
ev planını küçültme
yerleşme sonrası yorgunluk
kutudan çıkan eski hatıra
oda paylaşımı
ev ararken acele etmeme
anahtar teslimi
adres değişikliği
kargo yönlendirme
yeni düzeni deneme
eski eşyaya veda
temel ihtiyaç listesi
tadilat tozuna hazırlık
gürültüyü komşuya söyleme
küçük arızayı büyütmeme
eşyayı ölçmeden almama
ev bütçesini aşmama
duvarı delmeden önce düşünme
ikinci el eşya kontrolü
taşınma tarihini netleştirme
evin akışını kurma
`),
  'Misafir ve Ağırlama': list(`
kısa misafir hazırlığı
sofra veya ikram planı
kalabalık öncesi toparlanma
gelip gelmeyeceği netleşmeyen kişi
kapıda ayaküstü konuşma
fazla yük almadan ağırlama
misafir sonrası yorgunluk
ev içi planı baştan konuşma
ikramı sade tutma
çay kahve hazırlığı
misafir saatini netleştirme
yatılı kalma ihtimali
çocuklu misafir düzeni
evcil hayvanlı misafir
sofra eksiklerini tamamlama
son dakika alışverişi
kalabalıkta sakin kalma
misafire sınır koyma
eski tanıdığın uğraması
misafirle açılacak konu
kapıdan dönme ihtimali
fazla beklentiye girmeme
ikramda ölçülü harcama
evin düzenini koruma
misafir öncesi telefon
ziyareti kısa tutma
sofrada hassas konu açmama
hediye veya küçük ikram
misafir için oda hazırlığı
kalabalık sonrası dinlenme
gelmeyen kişiye kırılmama
kapıya bırakılacak şey
ziyaret saatini değiştirme
misafire yol tarifi
ev sahibinin yorgunluğu
ikramı yetiştirme telaşı
sohbeti yumuşak tutma
aile misafiri dengesi
arkadaş misafiri rahatlığı
beklenmedik kapı zili
misafire yardım isteme
sofra sonrası toparlama
kalabalıkta söylenen söz
fazla uzayan ziyaret
komşu uğraması
misafir öncesi temizlik
evin kokusunu tazeleme
çayın başında netleşen konu
gelmeden haber verme
misafirlikte kırıcı olmama
`),
  'Alışveriş ve Eşya': list(`
değişim veya iade
fiyat karşılaştırması
gereksiz eşyayı eleme
lazım olan küçük parça
kaybolan eşyanın yeri
çanta veya cüzdan düzeni
hediye seçerken ölçü
acele alınırsa pişman edecek ürün
market listesi
indirim tuzağına dikkat
kalite fiyat dengesi
ölçü almadan alışveriş yapmama
eski eşyayı değerlendirme
tamir mi yenileme mi kararı
online sepeti sadeleştirme
hediyenin zamanlaması
kıyafet değişimi
ev ihtiyacı alma
fazla ürün almama
garanti fişini saklama
eksik parça arama
küçük aksesuar seçimi
alışverişte kararsızlık
yanlış beden veya ölçü
başkasına alınacak şey
satın almadan bekleme
ikinci el ürün kontrolü
kargo paketini açma
ürün yorumlarını okuma
çanta içindeki eski fiş
eşya yerini değiştirme
hediyede anlam arama
alışveriş sonrası hesap
fazla eşya yükünden kurtulma
ucuz görünen masraf
kalabalık mağazada sıkılma
alışverişi erteleme
iade tarihini kaçırmama
kullanılmayan ürünü verme
evde aynı eşyadan bulma
liste dışına çıkmama
küçük ama sevindiren eşya
bozuk parçayı ayırma
hediyeyi sade seçme
ürün teslim saatini takip
yanlış adrese kargo
alışverişi ihtiyaçla sınırlama
fiyat sormaya çekinmeme
eşya üzerinden çıkan hatıra
küçük seçimle ferahlama
`),
  'Yaratıcı İş': list(`
yarım kalmış fikir notu
küçük üretimi paylaşma
görsel yazı veya ses düzenleme
ilhamı bekletmeden kaydetme
başkasının fikriyle kendi fikrini ayırma
ufak denemeyi başlatma
beğenilme kaygısını azaltma
eski fikri yeni biçimde ele alma
not defterindeki cümle
renk veya biçim seçimi
taslak dosyayı açma
yaratıcı işi ertelememe
küçük paylaşım cesareti
eleştiriyi fazla büyütmeme
üretim için sakin saat
ilhamı günlük hayattan alma
ses kaydı veya eskiz
yarım kalan projeyi küçültme
fazla mükemmeliyetçilik
başlık veya isim bulma
eski dosyayı temizleme
kısa deneme metni
görsel referans arama
yaratıcı ortaklık sınırı
fikri anlatırken sadeleşme
küçük sahne veya sunum
birinden geri bildirim isteme
paylaşmadan önce son kontrol
taslakta kalan duygu
üretimi parçalara bölme
yaratıcı dağınıklığı toplama
renklerin fazla karışması
kendi sesini bulma
eski fikre yeni isim
acele yayımlamama
kısa prova
ilhamı beklerken düzen kurma
başkasının tarzına özenmeme
yaratıcı cesaret
küçük dosya kaybını önleme
üretimde zaman sınırı
fikri not almadan kaybetmeme
görünür olmaktan çekinme
eski beğeniyi bugüne taşımama
yarım işi tamamlayınca rahatlama
anlamı sadeleştirme
küçük estetik karar
yaratıcı işte destek alma
beğeni yerine tutarlılık
üretim ritmini koruma
`),
  'Sınır ve Planlama': list(`
kibarca hayır deme
senden beklenen işi netleştirme
başkasının acelesini üstlenmeme
planı uygulanabilir yapmak
söz vermeden takvime bakma
iki isteği aynı güne sıkıştırmama
kendi zamanını söyleme
küçük sınırı büyümeden koyma
fazla açıklama yapmadan netleşme
günü üç parçaya bölme
öncelik sırası kurma
son dakika ricayı ölçme
kendine alan açma
planı hafifletme
bir işi devretme
beklentiyi baştan söyleme
yardım ederken yorulmama
aynı anda iki yere yetişmeme
küçük mola koyma
takvimi gerçekçi tutma
ertelemeyi dürüstçe kabul etme
başkasının duygusunu taşımama
günün sınırını çizme
fazla söz vermeyi azaltma
önce kendi işini bitirme
plan değişirse haber verme
bekleme süresini netleştirme
hayır derken yumuşak kalma
gereksiz açıklamayı bırakma
zamanını koruma
küçük kararları çoğaltmama
önceden hazırlık yapma
acele isteğe hemen evet dememe
iki seçenekten birini seçme
işi küçük adımlara bölme
başkasının planına sıkışmama
kendi ritmini savunma
takvimde boşluk bırakma
ertelediğin konuşmayı planlama
gün sonu kapanış saati
fazla yükü görünür kılma
kendine verdiğin sözü tutma
yardım sınırını belirleme
beklentiyi yazılı netleştirme
planı sadeleştirince rahatlama
önce dinlenip sonra karar verme
karşı tarafı kırmadan sınır koyma
kendi gündemini kaybetmeme
fazla sorumluluğu geri verme
ritmini koruyan küçük karar
`),
};

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleSeeded<T>(items: T[], seed: string) {
  const out = [...items];
  let state = hashString(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LIFE_EVENT_BANK: SpecificityItem[] = Object.entries(LIFE_EVENT_GROUPS).flatMap(([group, labels]) =>
  labels.slice(0, ITEMS_PER_GROUP).map((label) => ({ group, label })),
);

function recentText(memorySnippet?: ProfileMemorySnippet | null, messages: FortuneMessage[] = []) {
  return [
    ...(memorySnippet?.readingTopicGroups || []).map((item) => `${item.group || ''} ${item.label || ''}`),
    ...(memorySnippet?.readingTopics || []),
    ...(memorySnippet?.relevantObservations || []).map((item) => `${item.title || ''} ${item.summary || ''}`),
    ...(memorySnippet?.usedLifeEvents || []).map((item) => `${item.group || ''} ${item.label || ''}`),
    ...(memorySnippet?.usedSurfaceCues || []).map((item) => item.cue || ''),
    ...messages.map((message) => message.text || ''),
  ]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
}

function selectEvents(seedText: string, recent: string) {
  const candidates = shuffleSeeded(
    LIFE_EVENT_BANK.filter((item) => !recent.includes(item.label.toLocaleLowerCase('tr-TR'))),
    seedText,
  );
  const selected: SpecificityItem[] = [];
  for (const item of candidates) {
    if (selected.some((chosen) => chosen.group === item.group)) continue;
    selected.push(item);
    if (selected.length >= PICKS_PER_READING) break;
  }
  return selected;
}

function selectCues(seedText: string, recent: string) {
  return shuffleSeeded(
    SURFACE_CUE_BANK.filter((cue) => !recent.includes(cue.toLocaleLowerCase('tr-TR'))),
    `${seedText}:cue`,
  ).slice(0, CUES_PER_READING);
}

export function buildSpecificityContext(params: {
  sessionId: string;
  profileName: string;
  readingType: FortuneReadingType;
  coffeeMode: CoffeeMode;
  assistantId?: string;
  messages: FortuneMessage[];
  memorySnippet?: ProfileMemorySnippet | null;
  isFollowUp?: boolean;
}): { text: string; usage: SpecificityUsage } {
  if (params.isFollowUp) {
    return {
      text: [
        '## Somutluk Disiplini',
        '- Takip sorusunda yeni olay havuzu açma; son soruya cevap verirken önceki bağlamdan en fazla 1 somut iz kullan.',
        '- Cevap günlük tavsiye gibi kalmasın; kullanıcının sorduğu sembolü veya konuyu küçük, gündelik bir olay ihtimaline bağla.',
        '- Önceki yanıtta geçen aynı olay labelını veya aynı yüzey cue ifadesini tekrar etme.',
      ].join('\n'),
      usage: { events: [], cues: [] },
    };
  }

  const seedText = [
    params.sessionId,
    params.profileName,
    params.assistantId,
    params.readingType,
    params.coffeeMode,
    params.messages.map((message) => message.text).join('|').slice(0, 500),
  ].join(':');
  const recent = recentText(params.memorySnippet, params.messages);
  const selectedEvents = selectEvents(seedText, recent);
  const selectedCues = selectCues(seedText, recent);

  return {
    text: [
    '## Somut Hayat Malzemesi',
    '- Fal soyut ruh hali yazısı değil; aşağıdaki gündelik olay/olgu adaylarından 3-4 tanesini seçip telve veya çizgi izlerine bağla.',
    '- Aşağıdaki yüzey cue adaylarından 3-4 tanesini kullan; aynı cue ve aynı olay labelını bu fal içinde tekrar etme.',
    '- Olayları 3-4 farklı gruptan seç; aynı gruba yığılma.',
    '- Hepsini kullanma, liste gibi sayma, kesin olmuş gibi konuşma. Seçtiğin olayları fal diliyle doğal cümlelerin içine yedir.',
    '- Bu adaylar kehanet değildir; “olacak” diye hüküm verme. “Görünene göre”, “yakına düşen ihtimal”, “bu iz şunu düşündürüyor” gibi olasılık dili kullan.',
    '- Para başlıklarında yatırım, al-sat, kredi, borçlanma veya belirli finansal karar tavsiyesi verme; sadece bütçe, ödeme takibi ve dikkat diliyle kal.',
    '- Önceki fallarda veya bu oturumda geçen olay labellarını ve yüzey cue ifadelerini güçlü yeni işaret yoksa tekrar etme.',
    `- Olay adayları: ${selectedEvents.map((item) => `${item.group}: ${item.label}`).join('; ')}.`,
    `- Yüzey cue adayları: ${selectedCues.join('; ')}.`,
    ].join('\n'),
    usage: { events: selectedEvents, cues: selectedCues },
  };
}
