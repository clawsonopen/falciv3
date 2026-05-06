import { FORTUNE_PERSONA_DATA } from './fortunePersonaData';

type PersonaId = keyof typeof FORTUNE_PERSONA_DATA;
export type PersonalReadingDomain = 'astro' | 'numerology';

const DOMAIN_FORBIDDEN_TERMS: Record<PersonalReadingDomain, RegExp> = {
  astro: /kahve|fincan|telve|tabak|avuç|el falı|el fal|el çizg|tarot|kart|melek kart|rune|i ching|hexagram/i,
  numerology:
    /kahve|fincan|telve|tabak|avuç|el falı|el fal|el çizg|görsel|fotoğraf|tarot|kart|melek kart|rune|i ching|hexagram|gökyüzü|yıldız|gezegen|natal|transit|burç|ay döng/i,
};

const FALLBACK_CLOSINGS: Record<PersonalReadingDomain, Record<string, string[]>> = {
  astro: {
    'bahar-hanim': [
      'Bugün kendine yumuşak bir farkındalık alanı aç tatlım; bu etkiyi zorlamadan yönettiğinde daha temiz bir akış bulacaksın.',
      'Enerjini dağıtmadan merkeze dön güzelim; bugün en doğru cevap sakin seçimlerinin içinde netleşecek.',
    ],
    'mert-bey': [
      'Bugünü küçük ve net adımlarla yönet dostum; ritim oturdukça zihnin de daha rahat karar verecek.',
      'Kendine biraz alan aç kardeşim; bugün her şeyi çözmek değil, doğru sıraya koymak daha kıymetli.',
    ],
    'durdane-hanim': [
      'Gönlünü ferah tut canım; bugün niyetini temiz tutup acele etmeden yürürsen yol kendini daha rahat gösterir.',
      'İçini sıkma güzelim; bugün kalbinin sesini duy, ama adımını sakin ve ölçülü at.',
    ],
    'hikmet-bey': [
      'Hadi bakalım güzel evladım, bugün aklını da kalbini de aynı sofraya oturt; kararın daha sağlam olur.',
      'Omuzlarını biraz indir aslanım; bugün sabırla baktığın yerde yol daha berrak görünür.',
    ],
    caner: [
      'Kendine nazik davran canım; bugün iç sesin kısık ama doğru yerden konuşuyor, onu aceleye getirme.',
      'Güzel ruh, bugün kalbini biraz sakin tut; cevap yumuşak bir yerden kendini gösterecek.',
    ],
  },
  numerology: {
    'bahar-hanim': [
      'Bugün bu ritmi farkındalıkla taşı tatlım; küçük bir iç düzen bile önündeki yolu daha zarif açacak.',
      'Kendine net ve sakin bir alan aç güzelim; bu sayı dili sana önce dengeyi, sonra yönü gösteriyor.',
    ],
    'mert-bey': [
      'Bu akışı küçük parçalara böl dostum; sayılar bugün sana karmaşayı değil, öncelik sırasını anlatıyor.',
      'Kardeşim, bugün en iyi hamle sadeleşmek; ritmini bozma, gerisi daha kolay oturacak.',
    ],
    'durdane-hanim': [
      'Gönlünü ferah tut canım; bu sayıların anlattığı niyet, sakin kaldığında daha hayırlı bir yola döner.',
      'İçini daraltma güzelim; bugün kalbini temiz, adımını ölçülü tut, kısmetin daha rahat akar.',
    ],
    'hikmet-bey': [
      'Hadi bakalım güzel evladım, bu sayılar sana telaş değil ölçü söylüyor; aklını sakin tut, yolunu şaşırmazsın.',
      'Aslanım, bugün mesele hız değil denge; kendini hırpalamadan doğru adımı seçmen yeter.',
    ],
    caner: [
      'Güzel ruh, bu ritim sana sert bir hüküm değil, içinden geçen yolu usulca gösteren bir işaret gibi gelsin.',
      'Canım, bugün sayının sesi yumuşak; onu kalbinde büyütmeden, küçük bir niyetle taşıman yeter.',
    ],
  },
};

function personaId(value?: string): PersonaId {
  return (value && value in FORTUNE_PERSONA_DATA ? value : 'durdane-hanim') as PersonaId;
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function safeClosingOptions(id: PersonaId, domain: PersonalReadingDomain) {
  const forbidden = DOMAIN_FORBIDDEN_TERMS[domain];
  const library = FORTUNE_PERSONA_DATA[id].closingLibrary as Record<string, readonly string[]>;
  const options = Object.values(library)
    .flatMap((items) => [...items])
    .filter((sentence) => sentence && !forbidden.test(sentence.toLocaleLowerCase('tr-TR')));
  const fallback = FALLBACK_CLOSINGS[domain][id] || FALLBACK_CLOSINGS[domain]['durdane-hanim'];
  return options.length ? options : fallback;
}

export function selectPersonaClosingSentence(params: {
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
}) {
  const id = personaId(params.assistantId);
  const options = safeClosingOptions(id, params.domain);
  return options[hashString(`${params.domain}:${id}:${params.seed}`) % options.length] || '';
}

function hasTerminalPunctuation(text: string) {
  return /[.!?…][)"'»”’\]]*\s*$/.test(text);
}

function trimIncompleteTail(text: string) {
  const cleaned = text.trim();
  if (!cleaned || hasTerminalPunctuation(cleaned)) return cleaned;
  const lastBoundary = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf('!'), cleaned.lastIndexOf('?'), cleaned.lastIndexOf('…'));
  if (lastBoundary > cleaned.length * 0.58) return cleaned.slice(0, lastBoundary + 1).trim();
  return cleaned;
}

export function completeWithPersonaClosing(params: {
  text: string;
  assistantId: string;
  domain: PersonalReadingDomain;
  seed: string;
  forceClosing?: boolean;
}) {
  const base = trimIncompleteTail(params.text);
  const shouldClose = params.forceClosing || !hasTerminalPunctuation(base);
  if (!shouldClose) return base;
  const closing = selectPersonaClosingSentence({
    assistantId: params.assistantId,
    domain: params.domain,
    seed: `${params.seed}:${base.slice(-160)}`,
  });
  if (!closing) return base;
  if (!base) return closing;
  if (base.includes(closing)) return base;
  return `${base}\n\n${closing}`.trim();
}
