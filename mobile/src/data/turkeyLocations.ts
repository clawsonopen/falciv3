// Generated from TurkiyeAPI province/district data (MIT): https://github.com/ubeydeozdmr/turkiye-api
// Keep this file small and UI-focused: province names, province coordinates and district names only.

export const TURKEY_CITY_OPTIONS = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Amasya",
  "Ankara",
  "Antalya",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Isparta",
  "Mersin",
  "İstanbul",
  "İzmir",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Kahramanmaraş",
  "Mardin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Şanlıurfa",
  "Uşak",
  "Van",
  "Yozgat",
  "Zonguldak",
  "Aksaray",
  "Bayburt",
  "Karaman",
  "Kırıkkale",
  "Batman",
  "Şırnak",
  "Bartın",
  "Ardahan",
  "Iğdır",
  "Yalova",
  "Karabük",
  "Kilis",
  "Osmaniye",
  "Düzce"
] as const;

export const TURKEY_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "Adana": {
    "lat": 37.001667,
    "lon": 35.328889
  },
  "Adıyaman": {
    "lat": 37.764722,
    "lon": 38.278611
  },
  "Afyonkarahisar": {
    "lat": 38.750278,
    "lon": 30.556667
  },
  "Ağrı": {
    "lat": 39.719444,
    "lon": 43.050556
  },
  "Amasya": {
    "lat": 40.649722,
    "lon": 35.835278
  },
  "Ankara": {
    "lat": 39.92077,
    "lon": 32.85411
  },
  "Antalya": {
    "lat": 36.88414,
    "lon": 30.70563
  },
  "Artvin": {
    "lat": 41.18222,
    "lon": 41.81889
  },
  "Aydın": {
    "lat": 37.84444,
    "lon": 27.84556
  },
  "Balıkesir": {
    "lat": 39.64861,
    "lon": 27.8825
  },
  "Bilecik": {
    "lat": 40.14556,
    "lon": 29.97917
  },
  "Bingöl": {
    "lat": 38.885,
    "lon": 40.49861
  },
  "Bitlis": {
    "lat": 38.39528,
    "lon": 42.12361
  },
  "Bolu": {
    "lat": 40.73528,
    "lon": 31.60639
  },
  "Burdur": {
    "lat": 37.72111,
    "lon": 30.29056
  },
  "Bursa": {
    "lat": 40.18222,
    "lon": 29.06111
  },
  "Çanakkale": {
    "lat": 40.15556,
    "lon": 26.41444
  },
  "Çankırı": {
    "lat": 40.6,
    "lon": 33.61667
  },
  "Çorum": {
    "lat": 40.55056,
    "lon": 34.95556
  },
  "Denizli": {
    "lat": 37.77639,
    "lon": 29.08611
  },
  "Diyarbakır": {
    "lat": 37.91417,
    "lon": 40.23056
  },
  "Edirne": {
    "lat": 41.67083,
    "lon": 26.55556
  },
  "Elazığ": {
    "lat": 38.68056,
    "lon": 39.22639
  },
  "Erzincan": {
    "lat": 39.75,
    "lon": 39.5
  },
  "Erzurum": {
    "lat": 39.90861,
    "lon": 41.27694
  },
  "Eskişehir": {
    "lat": 39.77639,
    "lon": 30.52056
  },
  "Gaziantep": {
    "lat": 37.06667,
    "lon": 37.38333
  },
  "Giresun": {
    "lat": 40.91667,
    "lon": 38.4
  },
  "Gümüşhane": {
    "lat": 40.45,
    "lon": 39.48333
  },
  "Hakkari": {
    "lat": 37.58333,
    "lon": 43.73333
  },
  "Hatay": {
    "lat": 36.2,
    "lon": 36.16667
  },
  "Isparta": {
    "lat": 37.76667,
    "lon": 30.55
  },
  "Mersin": {
    "lat": 36.8,
    "lon": 34.63333
  },
  "İstanbul": {
    "lat": 41.01384,
    "lon": 28.94966
  },
  "İzmir": {
    "lat": 38.41885,
    "lon": 27.12872
  },
  "Kars": {
    "lat": 40.60833,
    "lon": 43.08333
  },
  "Kastamonu": {
    "lat": 41.38889,
    "lon": 33.78222
  },
  "Kayseri": {
    "lat": 38.73111,
    "lon": 35.47889
  },
  "Kırklareli": {
    "lat": 41.73333,
    "lon": 27.21667
  },
  "Kırşehir": {
    "lat": 39.14222,
    "lon": 34.17056
  },
  "Kocaeli": {
    "lat": 40.76667,
    "lon": 29.91667
  },
  "Konya": {
    "lat": 37.86667,
    "lon": 32.48333
  },
  "Kütahya": {
    "lat": 39.41667,
    "lon": 29.98333
  },
  "Malatya": {
    "lat": 38.355,
    "lon": 38.305
  },
  "Manisa": {
    "lat": 38.61361,
    "lon": 27.42694
  },
  "Kahramanmaraş": {
    "lat": 37.58333,
    "lon": 36.93333
  },
  "Mardin": {
    "lat": 37.31111,
    "lon": 40.74361
  },
  "Muğla": {
    "lat": 37.21667,
    "lon": 28.36667
  },
  "Muş": {
    "lat": 38.74444,
    "lon": 41.49611
  },
  "Nevşehir": {
    "lat": 38.62444,
    "lon": 34.72306
  },
  "Niğde": {
    "lat": 37.96667,
    "lon": 34.68333
  },
  "Ordu": {
    "lat": 40.98333,
    "lon": 37.88333
  },
  "Rize": {
    "lat": 41.02083,
    "lon": 40.52361
  },
  "Sakarya": {
    "lat": 40.76667,
    "lon": 30.41667
  },
  "Samsun": {
    "lat": 41.28639,
    "lon": 36.33139
  },
  "Siirt": {
    "lat": 37.94444,
    "lon": 41.93333
  },
  "Sinop": {
    "lat": 42.02361,
    "lon": 35.15306
  },
  "Sivas": {
    "lat": 39.74722,
    "lon": 37.0175
  },
  "Tekirdağ": {
    "lat": 40.98333,
    "lon": 27.51667
  },
  "Tokat": {
    "lat": 40.31667,
    "lon": 36.55
  },
  "Trabzon": {
    "lat": 41,
    "lon": 39.73333
  },
  "Tunceli": {
    "lat": 39.11667,
    "lon": 39.53333
  },
  "Şanlıurfa": {
    "lat": 37.15,
    "lon": 38.8
  },
  "Uşak": {
    "lat": 38.68333,
    "lon": 29.41667
  },
  "Van": {
    "lat": 38.5,
    "lon": 43.4
  },
  "Yozgat": {
    "lat": 39.81667,
    "lon": 34.81667
  },
  "Zonguldak": {
    "lat": 41.45,
    "lon": 31.8
  },
  "Aksaray": {
    "lat": 38.36667,
    "lon": 34.03333
  },
  "Bayburt": {
    "lat": 40.25,
    "lon": 40.21667
  },
  "Karaman": {
    "lat": 37.18333,
    "lon": 33.21667
  },
  "Kırıkkale": {
    "lat": 39.85,
    "lon": 33.51667
  },
  "Batman": {
    "lat": 37.88333,
    "lon": 41.13333
  },
  "Şırnak": {
    "lat": 37.51667,
    "lon": 42.46667
  },
  "Bartın": {
    "lat": 41.63333,
    "lon": 32.33333
  },
  "Ardahan": {
    "lat": 41.10833,
    "lon": 42.7
  },
  "Iğdır": {
    "lat": 39.91667,
    "lon": 44.03333
  },
  "Yalova": {
    "lat": 40.65,
    "lon": 29.26667
  },
  "Karabük": {
    "lat": 41.2,
    "lon": 32.63333
  },
  "Kilis": {
    "lat": 36.71667,
    "lon": 37.11667
  },
  "Osmaniye": {
    "lat": 37.06667,
    "lon": 36.25
  },
  "Düzce": {
    "lat": 40.83333,
    "lon": 31.16667
  }
};

export const TURKEY_DISTRICTS_BY_CITY: Record<string, string[]> = {
  "Adana": [
    "Aladağ",
    "Ceyhan",
    "Çukurova",
    "Feke",
    "İmamoğlu",
    "Karaisalı",
    "Karataş",
    "Kozan",
    "Pozantı",
    "Saimbeyli",
    "Sarıçam",
    "Seyhan",
    "Tufanbeyli",
    "Yumurtalık",
    "Yüreğir"
  ],
  "Adıyaman": [
    "Besni",
    "Çelikhan",
    "Gerger",
    "Gölbaşı",
    "Kahta",
    "Merkez",
    "Samsat",
    "Sincik",
    "Tut"
  ],
  "Afyonkarahisar": [
    "Başmakçı",
    "Bayat",
    "Bolvadin",
    "Çay",
    "Çobanlar",
    "Dazkırı",
    "Dinar",
    "Emirdağ",
    "Evciler",
    "Hocalar",
    "İhsaniye",
    "İscehisar",
    "Kızılören",
    "Merkez",
    "Sandıklı",
    "Sinanpaşa",
    "Sultandağı",
    "Şuhut"
  ],
  "Ağrı": [
    "Diyadin",
    "Doğubayazıt",
    "Eleşkirt",
    "Hamur",
    "Merkez",
    "Patnos",
    "Taşlıçay",
    "Tutak"
  ],
  "Amasya": [
    "Göynücek",
    "Gümüşhacıköy",
    "Hamamözü",
    "Merkez",
    "Merzifon",
    "Suluova",
    "Taşova"
  ],
  "Ankara": [
    "Akyurt",
    "Altındağ",
    "Ayaş",
    "Bala",
    "Beypazarı",
    "Çamlıdere",
    "Çankaya",
    "Çubuk",
    "Elmadağ",
    "Etimesgut",
    "Evren",
    "Gölbaşı",
    "Güdül",
    "Haymana",
    "Kahramankazan",
    "Kalecik",
    "Keçiören",
    "Kızılcahamam",
    "Mamak",
    "Nallıhan",
    "Polatlı",
    "Pursaklar",
    "Sincan",
    "Şereflikoçhisar",
    "Yenimahalle"
  ],
  "Antalya": [
    "Akseki",
    "Aksu",
    "Alanya",
    "Demre",
    "Döşemealtı",
    "Elmalı",
    "Finike",
    "Gazipaşa",
    "Gündoğmuş",
    "İbradı",
    "Kaş",
    "Kemer",
    "Kepez",
    "Konyaaltı",
    "Korkuteli",
    "Kumluca",
    "Manavgat",
    "Muratpaşa",
    "Serik"
  ],
  "Artvin": [
    "Ardanuç",
    "Arhavi",
    "Borçka",
    "Hopa",
    "Kemalpaşa",
    "Merkez",
    "Murgul",
    "Şavşat",
    "Yusufeli"
  ],
  "Aydın": [
    "Bozdoğan",
    "Buharkent",
    "Çine",
    "Didim",
    "Efeler",
    "Germencik",
    "İncirliova",
    "Karacasu",
    "Karpuzlu",
    "Koçarlı",
    "Köşk",
    "Kuşadası",
    "Kuyucak",
    "Nazilli",
    "Söke",
    "Sultanhisar",
    "Yenipazar"
  ],
  "Balıkesir": [
    "Altıeylül",
    "Ayvalık",
    "Balya",
    "Bandırma",
    "Bigadiç",
    "Burhaniye",
    "Dursunbey",
    "Edremit",
    "Erdek",
    "Gömeç",
    "Gönen",
    "Havran",
    "İvrindi",
    "Karesi",
    "Kepsut",
    "Manyas",
    "Marmara",
    "Savaştepe",
    "Sındırgı",
    "Susurluk"
  ],
  "Bilecik": [
    "Bozüyük",
    "Gölpazarı",
    "İnhisar",
    "Merkez",
    "Osmaneli",
    "Pazaryeri",
    "Söğüt",
    "Yenipazar"
  ],
  "Bingöl": [
    "Adaklı",
    "Genç",
    "Karlıova",
    "Kiğı",
    "Merkez",
    "Solhan",
    "Yayladere",
    "Yedisu"
  ],
  "Bitlis": [
    "Adilcevaz",
    "Ahlat",
    "Güroymak",
    "Hizan",
    "Merkez",
    "Mutki",
    "Tatvan"
  ],
  "Bolu": [
    "Dörtdivan",
    "Gerede",
    "Göynük",
    "Kıbrıscık",
    "Mengen",
    "Merkez",
    "Mudurnu",
    "Seben",
    "Yeniçağa"
  ],
  "Burdur": [
    "Ağlasun",
    "Altınyayla",
    "Bucak",
    "Çavdır",
    "Çeltikçi",
    "Gölhisar",
    "Karamanlı",
    "Kemer",
    "Merkez",
    "Tefenni",
    "Yeşilova"
  ],
  "Bursa": [
    "Büyükorhan",
    "Gemlik",
    "Gürsu",
    "Harmancık",
    "İnegöl",
    "İznik",
    "Karacabey",
    "Keles",
    "Kestel",
    "Mudanya",
    "Mustafakemalpaşa",
    "Nilüfer",
    "Orhaneli",
    "Orhangazi",
    "Osmangazi",
    "Yenişehir",
    "Yıldırım"
  ],
  "Çanakkale": [
    "Ayvacık",
    "Bayramiç",
    "Biga",
    "Bozcaada",
    "Çan",
    "Eceabat",
    "Ezine",
    "Gelibolu",
    "Gökçeada",
    "Lapseki",
    "Merkez",
    "Yenice"
  ],
  "Çankırı": [
    "Atkaracalar",
    "Bayramören",
    "Çerkeş",
    "Eldivan",
    "Ilgaz",
    "Kızılırmak",
    "Korgun",
    "Kurşunlu",
    "Merkez",
    "Orta",
    "Şabanözü",
    "Yapraklı"
  ],
  "Çorum": [
    "Alaca",
    "Bayat",
    "Boğazkale",
    "Dodurga",
    "İskilip",
    "Kargı",
    "Laçin",
    "Mecitözü",
    "Merkez",
    "Oğuzlar",
    "Ortaköy",
    "Osmancık",
    "Sungurlu",
    "Uğurludağ"
  ],
  "Denizli": [
    "Acıpayam",
    "Babadağ",
    "Baklan",
    "Bekilli",
    "Beyağaç",
    "Bozkurt",
    "Buldan",
    "Çal",
    "Çameli",
    "Çardak",
    "Çivril",
    "Güney",
    "Honaz",
    "Kale",
    "Merkezefendi",
    "Pamukkale",
    "Sarayköy",
    "Serinhisar",
    "Tavas"
  ],
  "Diyarbakır": [
    "Bağlar",
    "Bismil",
    "Çermik",
    "Çınar",
    "Çüngüş",
    "Dicle",
    "Eğil",
    "Ergani",
    "Hani",
    "Hazro",
    "Kayapınar",
    "Kocaköy",
    "Kulp",
    "Lice",
    "Silvan",
    "Sur",
    "Yenişehir"
  ],
  "Edirne": [
    "Enez",
    "Havsa",
    "İpsala",
    "Keşan",
    "Lalapaşa",
    "Meriç",
    "Merkez",
    "Süloğlu",
    "Uzunköprü"
  ],
  "Elazığ": [
    "Ağın",
    "Alacakaya",
    "Arıcak",
    "Baskil",
    "Karakoçan",
    "Keban",
    "Kovancılar",
    "Maden",
    "Merkez",
    "Palu",
    "Sivrice"
  ],
  "Erzincan": [
    "Çayırlı",
    "İliç",
    "Kemah",
    "Kemaliye",
    "Merkez",
    "Otlukbeli",
    "Refahiye",
    "Tercan",
    "Üzümlü"
  ],
  "Erzurum": [
    "Aşkale",
    "Aziziye",
    "Çat",
    "Hınıs",
    "Horasan",
    "İspir",
    "Karaçoban",
    "Karayazı",
    "Köprüköy",
    "Narman",
    "Oltu",
    "Olur",
    "Palandöken",
    "Pasinler",
    "Pazaryolu",
    "Şenkaya",
    "Tekman",
    "Tortum",
    "Uzundere",
    "Yakutiye"
  ],
  "Eskişehir": [
    "Alpu",
    "Beylikova",
    "Çifteler",
    "Günyüzü",
    "Han",
    "İnönü",
    "Mahmudiye",
    "Mihalgazi",
    "Mihalıççık",
    "Odunpazarı",
    "Sarıcakaya",
    "Seyitgazi",
    "Sivrihisar",
    "Tepebaşı"
  ],
  "Gaziantep": [
    "Araban",
    "İslahiye",
    "Karkamış",
    "Nizip",
    "Nurdağı",
    "Oğuzeli",
    "Şahinbey",
    "Şehitkamil",
    "Yavuzeli"
  ],
  "Giresun": [
    "Alucra",
    "Bulancak",
    "Çamoluk",
    "Çanakçı",
    "Dereli",
    "Doğankent",
    "Espiye",
    "Eynesil",
    "Görele",
    "Güce",
    "Keşap",
    "Merkez",
    "Piraziz",
    "Şebinkarahisar",
    "Tirebolu",
    "Yağlıdere"
  ],
  "Gümüşhane": [
    "Kelkit",
    "Köse",
    "Kürtün",
    "Merkez",
    "Şiran",
    "Torul"
  ],
  "Hakkari": [
    "Çukurca",
    "Derecik",
    "Merkez",
    "Şemdinli",
    "Yüksekova"
  ],
  "Hatay": [
    "Altınözü",
    "Antakya",
    "Arsuz",
    "Belen",
    "Defne",
    "Dörtyol",
    "Erzin",
    "Hassa",
    "İskenderun",
    "Kırıkhan",
    "Kumlu",
    "Payas",
    "Reyhanlı",
    "Samandağ",
    "Yayladağı"
  ],
  "Isparta": [
    "Aksu",
    "Atabey",
    "Eğirdir",
    "Gelendost",
    "Gönen",
    "Keçiborlu",
    "Merkez",
    "Senirkent",
    "Sütçüler",
    "Şarkikaraağaç",
    "Uluborlu",
    "Yalvaç",
    "Yenişarbademli"
  ],
  "Mersin": [
    "Akdeniz",
    "Anamur",
    "Aydıncık",
    "Bozyazı",
    "Çamlıyayla",
    "Erdemli",
    "Gülnar",
    "Mezitli",
    "Mut",
    "Silifke",
    "Tarsus",
    "Toroslar",
    "Yenişehir"
  ],
  "İstanbul": [
    "Adalar",
    "Arnavutköy",
    "Ataşehir",
    "Avcılar",
    "Bağcılar",
    "Bahçelievler",
    "Bakırköy",
    "Başakşehir",
    "Bayrampaşa",
    "Beşiktaş",
    "Beykoz",
    "Beylikdüzü",
    "Beyoğlu",
    "Büyükçekmece",
    "Çatalca",
    "Çekmeköy",
    "Esenler",
    "Esenyurt",
    "Eyüpsultan",
    "Fatih",
    "Gaziosmanpaşa",
    "Güngören",
    "Kadıköy",
    "Kağıthane",
    "Kartal",
    "Küçükçekmece",
    "Maltepe",
    "Pendik",
    "Sancaktepe",
    "Sarıyer",
    "Silivri",
    "Sultanbeyli",
    "Sultangazi",
    "Şile",
    "Şişli",
    "Tuzla",
    "Ümraniye",
    "Üsküdar",
    "Zeytinburnu"
  ],
  "İzmir": [
    "Aliağa",
    "Balçova",
    "Bayındır",
    "Bayraklı",
    "Bergama",
    "Beydağ",
    "Bornova",
    "Buca",
    "Çeşme",
    "Çiğli",
    "Dikili",
    "Foça",
    "Gaziemir",
    "Güzelbahçe",
    "Karabağlar",
    "Karaburun",
    "Karşıyaka",
    "Kemalpaşa",
    "Kınık",
    "Kiraz",
    "Konak",
    "Menderes",
    "Menemen",
    "Narlıdere",
    "Ödemiş",
    "Seferihisar",
    "Selçuk",
    "Tire",
    "Torbalı",
    "Urla"
  ],
  "Kars": [
    "Akyaka",
    "Arpaçay",
    "Digor",
    "Kağızman",
    "Merkez",
    "Sarıkamış",
    "Selim",
    "Susuz"
  ],
  "Kastamonu": [
    "Abana",
    "Ağlı",
    "Araç",
    "Azdavay",
    "Bozkurt",
    "Cide",
    "Çatalzeytin",
    "Daday",
    "Devrekani",
    "Doğanyurt",
    "Hanönü",
    "İhsangazi",
    "İnebolu",
    "Küre",
    "Merkez",
    "Pınarbaşı",
    "Seydiler",
    "Şenpazar",
    "Taşköprü",
    "Tosya"
  ],
  "Kayseri": [
    "Akkışla",
    "Bünyan",
    "Develi",
    "Felahiye",
    "Hacılar",
    "İncesu",
    "Kocasinan",
    "Melikgazi",
    "Özvatan",
    "Pınarbaşı",
    "Sarıoğlan",
    "Sarız",
    "Talas",
    "Tomarza",
    "Yahyalı",
    "Yeşilhisar"
  ],
  "Kırklareli": [
    "Babaeski",
    "Demirköy",
    "Kofçaz",
    "Lüleburgaz",
    "Merkez",
    "Pehlivanköy",
    "Pınarhisar",
    "Vize"
  ],
  "Kırşehir": [
    "Akçakent",
    "Akpınar",
    "Boztepe",
    "Çiçekdağı",
    "Kaman",
    "Merkez",
    "Mucur"
  ],
  "Kocaeli": [
    "Başiskele",
    "Çayırova",
    "Darıca",
    "Derince",
    "Dilovası",
    "Gebze",
    "Gölcük",
    "İzmit",
    "Kandıra",
    "Karamürsel",
    "Kartepe",
    "Körfez"
  ],
  "Konya": [
    "Ahırlı",
    "Akören",
    "Akşehir",
    "Altınekin",
    "Beyşehir",
    "Bozkır",
    "Cihanbeyli",
    "Çeltik",
    "Çumra",
    "Derbent",
    "Derebucak",
    "Doğanhisar",
    "Emirgazi",
    "Ereğli",
    "Güneysınır",
    "Hadim",
    "Halkapınar",
    "Hüyük",
    "Ilgın",
    "Kadınhanı",
    "Karapınar",
    "Karatay",
    "Kulu",
    "Meram",
    "Sarayönü",
    "Selçuklu",
    "Seydişehir",
    "Taşkent",
    "Tuzlukçu",
    "Yalıhüyük",
    "Yunak"
  ],
  "Kütahya": [
    "Altıntaş",
    "Aslanapa",
    "Çavdarhisar",
    "Domaniç",
    "Dumlupınar",
    "Emet",
    "Gediz",
    "Hisarcık",
    "Merkez",
    "Pazarlar",
    "Simav",
    "Şaphane",
    "Tavşanlı"
  ],
  "Malatya": [
    "Akçadağ",
    "Arapgir",
    "Arguvan",
    "Battalgazi",
    "Darende",
    "Doğanşehir",
    "Doğanyol",
    "Hekimhan",
    "Kale",
    "Kuluncak",
    "Pütürge",
    "Yazıhan",
    "Yeşilyurt"
  ],
  "Manisa": [
    "Ahmetli",
    "Akhisar",
    "Alaşehir",
    "Demirci",
    "Gölmarmara",
    "Gördes",
    "Kırkağaç",
    "Köprübaşı",
    "Kula",
    "Salihli",
    "Sarıgöl",
    "Saruhanlı",
    "Selendi",
    "Soma",
    "Şehzadeler",
    "Turgutlu",
    "Yunusemre"
  ],
  "Kahramanmaraş": [
    "Afşin",
    "Andırın",
    "Çağlayancerit",
    "Dulkadiroğlu",
    "Ekinözü",
    "Elbistan",
    "Göksun",
    "Nurhak",
    "Onikişubat",
    "Pazarcık",
    "Türkoğlu"
  ],
  "Mardin": [
    "Artuklu",
    "Dargeçit",
    "Derik",
    "Kızıltepe",
    "Mazıdağı",
    "Midyat",
    "Nusaybin",
    "Ömerli",
    "Savur",
    "Yeşilli"
  ],
  "Muğla": [
    "Bodrum",
    "Dalaman",
    "Datça",
    "Fethiye",
    "Kavaklıdere",
    "Köyceğiz",
    "Marmaris",
    "Menteşe",
    "Milas",
    "Ortaca",
    "Seydikemer",
    "Ula",
    "Yatağan"
  ],
  "Muş": [
    "Bulanık",
    "Hasköy",
    "Korkut",
    "Malazgirt",
    "Merkez",
    "Varto"
  ],
  "Nevşehir": [
    "Acıgöl",
    "Avanos",
    "Derinkuyu",
    "Gülşehir",
    "Hacıbektaş",
    "Kozaklı",
    "Merkez",
    "Ürgüp"
  ],
  "Niğde": [
    "Altunhisar",
    "Bor",
    "Çamardı",
    "Çiftlik",
    "Merkez",
    "Ulukışla"
  ],
  "Ordu": [
    "Akkuş",
    "Altınordu",
    "Aybastı",
    "Çamaş",
    "Çatalpınar",
    "Çaybaşı",
    "Fatsa",
    "Gölköy",
    "Gülyalı",
    "Gürgentepe",
    "İkizce",
    "Kabadüz",
    "Kabataş",
    "Korgan",
    "Kumru",
    "Mesudiye",
    "Perşembe",
    "Ulubey",
    "Ünye"
  ],
  "Rize": [
    "Ardeşen",
    "Çamlıhemşin",
    "Çayeli",
    "Derepazarı",
    "Fındıklı",
    "Güneysu",
    "Hemşin",
    "İkizdere",
    "İyidere",
    "Kalkandere",
    "Merkez",
    "Pazar"
  ],
  "Sakarya": [
    "Adapazarı",
    "Akyazı",
    "Arifiye",
    "Erenler",
    "Ferizli",
    "Geyve",
    "Hendek",
    "Karapürçek",
    "Karasu",
    "Kaynarca",
    "Kocaali",
    "Pamukova",
    "Sapanca",
    "Serdivan",
    "Söğütlü",
    "Taraklı"
  ],
  "Samsun": [
    "19 Mayıs",
    "Alaçam",
    "Asarcık",
    "Atakum",
    "Ayvacık",
    "Bafra",
    "Canik",
    "Çarşamba",
    "Havza",
    "İlkadım",
    "Kavak",
    "Ladik",
    "Salıpazarı",
    "Tekkeköy",
    "Terme",
    "Vezirköprü",
    "Yakakent"
  ],
  "Siirt": [
    "Baykan",
    "Eruh",
    "Kurtalan",
    "Merkez",
    "Pervari",
    "Şirvan",
    "Tillo"
  ],
  "Sinop": [
    "Ayancık",
    "Boyabat",
    "Dikmen",
    "Durağan",
    "Erfelek",
    "Gerze",
    "Merkez",
    "Saraydüzü",
    "Türkeli"
  ],
  "Sivas": [
    "Akıncılar",
    "Altınyayla",
    "Divriği",
    "Doğanşar",
    "Gemerek",
    "Gölova",
    "Gürün",
    "Hafik",
    "İmranlı",
    "Kangal",
    "Koyulhisar",
    "Merkez",
    "Suşehri",
    "Şarkışla",
    "Ulaş",
    "Yıldızeli",
    "Zara"
  ],
  "Tekirdağ": [
    "Çerkezköy",
    "Çorlu",
    "Ergene",
    "Hayrabolu",
    "Kapaklı",
    "Malkara",
    "Marmaraereğlisi",
    "Muratlı",
    "Saray",
    "Süleymanpaşa",
    "Şarköy"
  ],
  "Tokat": [
    "Almus",
    "Artova",
    "Başçiftlik",
    "Erbaa",
    "Merkez",
    "Niksar",
    "Pazar",
    "Reşadiye",
    "Sulusaray",
    "Turhal",
    "Yeşilyurt",
    "Zile"
  ],
  "Trabzon": [
    "Akçaabat",
    "Araklı",
    "Arsin",
    "Beşikdüzü",
    "Çarşıbaşı",
    "Çaykara",
    "Dernekpazarı",
    "Düzköy",
    "Hayrat",
    "Köprübaşı",
    "Maçka",
    "Of",
    "Ortahisar",
    "Sürmene",
    "Şalpazarı",
    "Tonya",
    "Vakfıkebir",
    "Yomra"
  ],
  "Tunceli": [
    "Çemişgezek",
    "Hozat",
    "Mazgirt",
    "Merkez",
    "Nazımiye",
    "Ovacık",
    "Pertek",
    "Pülümür"
  ],
  "Şanlıurfa": [
    "Akçakale",
    "Birecik",
    "Bozova",
    "Ceylanpınar",
    "Eyyübiye",
    "Halfeti",
    "Haliliye",
    "Harran",
    "Hilvan",
    "Karaköprü",
    "Siverek",
    "Suruç",
    "Viranşehir"
  ],
  "Uşak": [
    "Banaz",
    "Eşme",
    "Karahallı",
    "Merkez",
    "Sivaslı",
    "Ulubey"
  ],
  "Van": [
    "Bahçesaray",
    "Başkale",
    "Çaldıran",
    "Çatak",
    "Edremit",
    "Erciş",
    "Gevaş",
    "Gürpınar",
    "İpekyolu",
    "Muradiye",
    "Özalp",
    "Saray",
    "Tuşba"
  ],
  "Yozgat": [
    "Akdağmadeni",
    "Aydıncık",
    "Boğazlıyan",
    "Çandır",
    "Çayıralan",
    "Çekerek",
    "Kadışehri",
    "Merkez",
    "Saraykent",
    "Sarıkaya",
    "Sorgun",
    "Şefaatli",
    "Yenifakılı",
    "Yerköy"
  ],
  "Zonguldak": [
    "Alaplı",
    "Çaycuma",
    "Devrek",
    "Ereğli",
    "Gökçebey",
    "Kilimli",
    "Kozlu",
    "Merkez"
  ],
  "Aksaray": [
    "Ağaçören",
    "Eskil",
    "Gülağaç",
    "Güzelyurt",
    "Merkez",
    "Ortaköy",
    "Sarıyahşi",
    "Sultanhanı"
  ],
  "Bayburt": [
    "Aydıntepe",
    "Demirözü",
    "Merkez"
  ],
  "Karaman": [
    "Ayrancı",
    "Başyayla",
    "Ermenek",
    "Kazımkarabekir",
    "Merkez",
    "Sarıveliler"
  ],
  "Kırıkkale": [
    "Bahşılı",
    "Balışeyh",
    "Çelebi",
    "Delice",
    "Karakeçili",
    "Keskin",
    "Merkez",
    "Sulakyurt",
    "Yahşihan"
  ],
  "Batman": [
    "Beşiri",
    "Gercüş",
    "Hasankeyf",
    "Kozluk",
    "Merkez",
    "Sason"
  ],
  "Şırnak": [
    "Beytüşşebap",
    "Cizre",
    "Güçlükonak",
    "İdil",
    "Merkez",
    "Silopi",
    "Uludere"
  ],
  "Bartın": [
    "Amasra",
    "Kurucaşile",
    "Merkez",
    "Ulus"
  ],
  "Ardahan": [
    "Çıldır",
    "Damal",
    "Göle",
    "Hanak",
    "Merkez",
    "Posof"
  ],
  "Iğdır": [
    "Aralık",
    "Karakoyunlu",
    "Merkez",
    "Tuzluca"
  ],
  "Yalova": [
    "Altınova",
    "Armutlu",
    "Çınarcık",
    "Çiftlikköy",
    "Merkez",
    "Termal"
  ],
  "Karabük": [
    "Eflani",
    "Eskipazar",
    "Merkez",
    "Ovacık",
    "Safranbolu",
    "Yenice"
  ],
  "Kilis": [
    "Elbeyli",
    "Merkez",
    "Musabeyli",
    "Polateli"
  ],
  "Osmaniye": [
    "Bahçe",
    "Düziçi",
    "Hasanbeyli",
    "Kadirli",
    "Merkez",
    "Sumbas",
    "Toprakkale"
  ],
  "Düzce": [
    "Akçakoca",
    "Cumayeri",
    "Çilimli",
    "Gölyaka",
    "Gümüşova",
    "Kaynaşlı",
    "Merkez",
    "Yığılca"
  ]
};
