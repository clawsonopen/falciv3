export type LlmReadingKind = 'coffee' | 'palm' | 'personal-astro' | 'general-astro' | 'personal-numerology' | 'generic';

type RetryMessage = {
  title: string;
  message: string;
};

const RETRY_MESSAGES: Record<LlmReadingKind, RetryMessage[]> = {
  coffee: [
    {
      title: 'Suzan Mutfağı Toparlıyor',
      message: 'Eyvah, kahveler biraz taştı. 1-2 dakika sonra tekrar dene; hemen ocağı silip fincanı yeniden çeviriyormuş.',
    },
    {
      title: 'Telvede Kısa Bir Mola',
      message: 'Kahve telvesi şu an biraz naz yaptı. 1-2 dakika sonra tekrar deneyelim; fincan sakinleşince daha güzel konuşur.',
    },
    {
      title: 'Fincan Hattı Meşgul',
      message: 'Fincan hattında küçük bir yoğunluk var. Bir iki dakika sonra tekrar dokun; kahve kendine gelsin, biz de yorumu açalım.',
    },
  ],
  palm: [
    {
      title: 'Teoman Gözlüğünü Arıyor',
      message: 'Teoman avuç içi çizgilerine bakacaktı ama gözlüğünü masada unuttu. 1-2 dakika sonra tekrar dene; çizgiler kaçmıyor.',
    },
    {
      title: 'Avuç Çizgileri Sıraya Girdi',
      message: 'El okuması kanalı şu an biraz kalabalık. Bir iki dakika sonra tekrar deneyelim; çizgiler sakin sakin yerinde bekliyor.',
    },
    {
      title: 'Kısa Bir El Molası',
      message: 'Avuç içi ışığı biraz parladı, Teoman gözlerini dinlendirdi. 1-2 dakika sonra tekrar dene; bu kez çizgileri daha net okuyalım.',
    },
  ],
  'personal-astro': [
    {
      title: 'Gökyüzü Kısa Bir Kahve Molasında',
      message: 'Merkür şu an kapıyı yarım araladı yarım kapattı. 1-2 dakika sonra tekrar dene; yıldızlar da bazen sıraya giriyor.',
    },
    {
      title: 'Gezegenler Trafiğe Takıldı',
      message: 'Kişisel gökyüzü yorumu şu an küçük bir kozmik yoğunluğa denk geldi. Bir iki dakika sonra tekrar dene; Merkür bahaneyi üstlenmiş görünüyor.',
    },
    {
      title: 'Yıldız Haritası Yeniden Açılıyor',
      message: 'Harita hazır ama yorum kapısı şu an nazlı. 1-2 dakika sonra tekrar dene; yükselen burcun yerinden kıpırdamıyor, merak etme.',
    },
  ],
  'general-astro': [
    {
      title: 'Gökyüzü Yayını Kısa Kesildi',
      message: 'Genel astroloji hattı şu an bulutların arkasına saklandı. 1-2 dakika sonra tekrar dene; gökyüzü birazdan perdeyi açar.',
    },
    {
      title: 'Burçlar Kısa Toplantıda',
      message: 'Burçlar şu an kendi aralarında küçük bir toplantıya girmiş gibi. Bir iki dakika sonra tekrar dene; gündemi dağıtmadan dönerler.',
    },
    {
      title: 'Ay Bir Anlığına Sessize Aldı',
      message: 'Gökyüzü yorumu şu an sessize düşmüş. 1-2 dakika sonra tekrar dene; Ay bildirimleri açınca devam ediyoruz.',
    },
  ],
  'personal-numerology': [
    {
      title: 'Sayılar Hesap Makinesini Sakladı',
      message: 'Numeroloji sayıları şu an küçük bir saklambaç oynuyor. 1-2 dakika sonra tekrar dene; hepsini masaya dizip yorumu açacağız.',
    },
    {
      title: 'Rakamlar Kısa Bir Çay Molasında',
      message: 'Aylık numeroloji hattı bir an duraksadı. Bir iki dakika sonra tekrar dene; rakamlar çayını bitirip hizaya geliyor.',
    },
    {
      title: 'Sayı Haritası Nefes Alıyor',
      message: 'Yorum kapısı şu an biraz yoğun. 1-2 dakika sonra tekrar dene; sayılar yerini biliyor, sadece sırayı bekliyor.',
    },
  ],
  generic: [
    {
      title: 'Yorum Hattı Kısa Bir Molada',
      message: 'Yorum hattı şu an küçük bir yoğunluğa takıldı. 1-2 dakika sonra tekrar dene; masayı dağıtmadan geri dönüyoruz.',
    },
    {
      title: 'Kısa Bir Mistik Bekleme',
      message: 'Yorum masası bir an nefes aldı. Bir iki dakika sonra tekrar dene; bu kez yorum kapısını daha usulca çalacağız.',
    },
    {
      title: 'Perde Bir Anlığına Kapandı',
      message: 'Okuma perdesi şu an kısa bir mola verdi. 1-2 dakika sonra tekrar dene; sahne birazdan yeniden açılıyor.',
    },
  ],
};

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function isRetryableLlmError(err: any) {
  const status = Number(err?.status || err?.response?.status || 0);
  const message = String(err?.message || '');
  return status === 503 || status === 429 || /503|429|unavailable|overloaded|quota|api anahtar|anahtarı|yorum anahtarı|Gemini API anahtarı/i.test(message);
}

export function getRetryLaterMessage(kind: LlmReadingKind, seed: string | number = Date.now()): RetryMessage {
  const pool = RETRY_MESSAGES[kind] || RETRY_MESSAGES.generic;
  const index = Math.abs(hashText(`${kind}-${seed}-${Math.random()}`)) % pool.length;
  return pool[index];
}
