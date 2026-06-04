import type { ImageSourcePropType } from 'react-native';

export type TarotDeckId = 'rider-waite-classic' | 'gilded-dreams';

export type TarotDeckImages = {
  back: ImageSourcePropType;
  front: Record<string, ImageSourcePropType>;
};

export type TarotDeckOption = {
  id: TarotDeckId;
  label: string;
  description: string;
  previewImage: ImageSourcePropType;
  backImage: ImageSourcePropType;
};

export const DEFAULT_TAROT_DECK_ID: TarotDeckId = 'rider-waite-classic';

const RIDER_WAITE_DECK_IMAGES: TarotDeckImages = {
  back: require('../../assets/divination/tarot/CardBacks.jpg'),
  front: {
    'The Fool': require('../../assets/divination/tarot/00-TheFool.jpg'),
    'The Magician': require('../../assets/divination/tarot/01-TheMagician.jpg'),
    'The High Priestess': require('../../assets/divination/tarot/02-TheHighPriestess.jpg'),
    'The Empress': require('../../assets/divination/tarot/03-TheEmpress.jpg'),
    'The Emperor': require('../../assets/divination/tarot/04-TheEmperor.jpg'),
    'The Hierophant': require('../../assets/divination/tarot/05-TheHierophant.jpg'),
    'The Lovers': require('../../assets/divination/tarot/06-TheLovers.jpg'),
    'The Chariot': require('../../assets/divination/tarot/07-TheChariot.jpg'),
    Strength: require('../../assets/divination/tarot/08-Strength.jpg'),
    'The Hermit': require('../../assets/divination/tarot/09-TheHermit.jpg'),
    'Wheel of Fortune': require('../../assets/divination/tarot/10-WheelOfFortune.jpg'),
    Justice: require('../../assets/divination/tarot/11-Justice.jpg'),
    'The Hanged Man': require('../../assets/divination/tarot/12-TheHangedMan.jpg'),
    Death: require('../../assets/divination/tarot/13-Death.jpg'),
    Temperance: require('../../assets/divination/tarot/14-Temperance.jpg'),
    'The Devil': require('../../assets/divination/tarot/15-TheDevil.jpg'),
    'The Tower': require('../../assets/divination/tarot/16-TheTower.jpg'),
    'The Star': require('../../assets/divination/tarot/17-TheStar.jpg'),
    'The Moon': require('../../assets/divination/tarot/18-TheMoon.jpg'),
    'The Sun': require('../../assets/divination/tarot/19-TheSun.jpg'),
    Judgement: require('../../assets/divination/tarot/20-Judgement.jpg'),
    'The World': require('../../assets/divination/tarot/21-TheWorld.jpg'),
    'Ace of Wands': require('../../assets/divination/tarot/Wands01.jpg'),
    'Two of Wands': require('../../assets/divination/tarot/Wands02.jpg'),
    'Three of Wands': require('../../assets/divination/tarot/Wands03.jpg'),
    'Four of Wands': require('../../assets/divination/tarot/Wands04.jpg'),
    'Five of Wands': require('../../assets/divination/tarot/Wands05.jpg'),
    'Six of Wands': require('../../assets/divination/tarot/Wands06.jpg'),
    'Seven of Wands': require('../../assets/divination/tarot/Wands07.jpg'),
    'Eight of Wands': require('../../assets/divination/tarot/Wands08.jpg'),
    'Nine of Wands': require('../../assets/divination/tarot/Wands09.jpg'),
    'Ten of Wands': require('../../assets/divination/tarot/Wands10.jpg'),
    'Page of Wands': require('../../assets/divination/tarot/Wands11.jpg'),
    'Knight of Wands': require('../../assets/divination/tarot/Wands12.jpg'),
    'Queen of Wands': require('../../assets/divination/tarot/Wands13.jpg'),
    'King of Wands': require('../../assets/divination/tarot/Wands14.jpg'),
    'Ace of Cups': require('../../assets/divination/tarot/Cups01.jpg'),
    'Two of Cups': require('../../assets/divination/tarot/Cups02.jpg'),
    'Three of Cups': require('../../assets/divination/tarot/Cups03.jpg'),
    'Four of Cups': require('../../assets/divination/tarot/Cups04.jpg'),
    'Five of Cups': require('../../assets/divination/tarot/Cups05.jpg'),
    'Six of Cups': require('../../assets/divination/tarot/Cups06.jpg'),
    'Seven of Cups': require('../../assets/divination/tarot/Cups07.jpg'),
    'Eight of Cups': require('../../assets/divination/tarot/Cups08.jpg'),
    'Nine of Cups': require('../../assets/divination/tarot/Cups09.jpg'),
    'Ten of Cups': require('../../assets/divination/tarot/Cups10.jpg'),
    'Page of Cups': require('../../assets/divination/tarot/Cups11.jpg'),
    'Knight of Cups': require('../../assets/divination/tarot/Cups12.jpg'),
    'Queen of Cups': require('../../assets/divination/tarot/Cups13.jpg'),
    'King of Cups': require('../../assets/divination/tarot/Cups14.jpg'),
    'Ace of Swords': require('../../assets/divination/tarot/Swords01.jpg'),
    'Two of Swords': require('../../assets/divination/tarot/Swords02.jpg'),
    'Three of Swords': require('../../assets/divination/tarot/Swords03.jpg'),
    'Four of Swords': require('../../assets/divination/tarot/Swords04.jpg'),
    'Five of Swords': require('../../assets/divination/tarot/Swords05.jpg'),
    'Six of Swords': require('../../assets/divination/tarot/Swords06.jpg'),
    'Seven of Swords': require('../../assets/divination/tarot/Swords07.jpg'),
    'Eight of Swords': require('../../assets/divination/tarot/Swords08.jpg'),
    'Nine of Swords': require('../../assets/divination/tarot/Swords09.jpg'),
    'Ten of Swords': require('../../assets/divination/tarot/Swords10.jpg'),
    'Page of Swords': require('../../assets/divination/tarot/Swords11.jpg'),
    'Knight of Swords': require('../../assets/divination/tarot/Swords12.jpg'),
    'Queen of Swords': require('../../assets/divination/tarot/Swords13.jpg'),
    'King of Swords': require('../../assets/divination/tarot/Swords14.jpg'),
    'Ace of Pentacles': require('../../assets/divination/tarot/Pentacles01.jpg'),
    'Two of Pentacles': require('../../assets/divination/tarot/Pentacles02.jpg'),
    'Three of Pentacles': require('../../assets/divination/tarot/Pentacles03.jpg'),
    'Four of Pentacles': require('../../assets/divination/tarot/Pentacles04.jpg'),
    'Five of Pentacles': require('../../assets/divination/tarot/Pentacles05.jpg'),
    'Six of Pentacles': require('../../assets/divination/tarot/Pentacles06.jpg'),
    'Seven of Pentacles': require('../../assets/divination/tarot/Pentacles07.jpg'),
    'Eight of Pentacles': require('../../assets/divination/tarot/Pentacles08.jpg'),
    'Nine of Pentacles': require('../../assets/divination/tarot/Pentacles09.jpg'),
    'Ten of Pentacles': require('../../assets/divination/tarot/Pentacles10.jpg'),
    'Page of Pentacles': require('../../assets/divination/tarot/Pentacles11.jpg'),
    'Knight of Pentacles': require('../../assets/divination/tarot/Pentacles12.jpg'),
    'Queen of Pentacles': require('../../assets/divination/tarot/Pentacles13.jpg'),
    'King of Pentacles': require('../../assets/divination/tarot/Pentacles14.jpg'),
  },
};

const GILDED_DREAMS_DECK_IMAGES: TarotDeckImages = {
  back: require('../../assets/divination/tarot-gilded-dreams/CardBacks.webp'),
  front: {
    'The Fool': require('../../assets/divination/tarot-gilded-dreams/00-TheFool.webp'),
    'The Magician': require('../../assets/divination/tarot-gilded-dreams/01-TheMagician.webp'),
    'The High Priestess': require('../../assets/divination/tarot-gilded-dreams/02-TheHighPriestess.webp'),
    'The Empress': require('../../assets/divination/tarot-gilded-dreams/03-TheEmpress.webp'),
    'The Emperor': require('../../assets/divination/tarot-gilded-dreams/04-TheEmperor.webp'),
    'The Hierophant': require('../../assets/divination/tarot-gilded-dreams/05-TheHierophant.webp'),
    'The Lovers': require('../../assets/divination/tarot-gilded-dreams/06-TheLovers.webp'),
    'The Chariot': require('../../assets/divination/tarot-gilded-dreams/07-TheChariot.webp'),
    Strength: require('../../assets/divination/tarot-gilded-dreams/08-Strength.webp'),
    'The Hermit': require('../../assets/divination/tarot-gilded-dreams/09-TheHermit.webp'),
    'Wheel of Fortune': require('../../assets/divination/tarot-gilded-dreams/10-WheelOfFortune.webp'),
    Justice: require('../../assets/divination/tarot-gilded-dreams/11-Justice.webp'),
    'The Hanged Man': require('../../assets/divination/tarot-gilded-dreams/12-TheHangedMan.webp'),
    Death: require('../../assets/divination/tarot-gilded-dreams/13-Death.webp'),
    Temperance: require('../../assets/divination/tarot-gilded-dreams/14-Temperance.webp'),
    'The Devil': require('../../assets/divination/tarot-gilded-dreams/15-TheDevil.webp'),
    'The Tower': require('../../assets/divination/tarot-gilded-dreams/16-TheTower.webp'),
    'The Star': require('../../assets/divination/tarot-gilded-dreams/17-TheStar.webp'),
    'The Moon': require('../../assets/divination/tarot-gilded-dreams/18-TheMoon.webp'),
    'The Sun': require('../../assets/divination/tarot-gilded-dreams/19-TheSun.webp'),
    Judgement: require('../../assets/divination/tarot-gilded-dreams/20-Judgement.webp'),
    'The World': require('../../assets/divination/tarot-gilded-dreams/21-TheWorld.webp'),
    'Ace of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands01.webp'),
    'Two of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands02.webp'),
    'Three of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands03.webp'),
    'Four of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands04.webp'),
    'Five of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands05.webp'),
    'Six of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands06.webp'),
    'Seven of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands07.webp'),
    'Eight of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands08.webp'),
    'Nine of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands09.webp'),
    'Ten of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands10.webp'),
    'Page of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands11.webp'),
    'Knight of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands12.webp'),
    'Queen of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands13.webp'),
    'King of Wands': require('../../assets/divination/tarot-gilded-dreams/Wands14.webp'),
    'Ace of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups01.webp'),
    'Two of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups02.webp'),
    'Three of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups03.webp'),
    'Four of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups04.webp'),
    'Five of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups05.webp'),
    'Six of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups06.webp'),
    'Seven of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups07.webp'),
    'Eight of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups08.webp'),
    'Nine of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups09.webp'),
    'Ten of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups10.webp'),
    'Page of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups11.webp'),
    'Knight of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups12.webp'),
    'Queen of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups13.webp'),
    'King of Cups': require('../../assets/divination/tarot-gilded-dreams/Cups14.webp'),
    'Ace of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords01.webp'),
    'Two of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords02.webp'),
    'Three of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords03.webp'),
    'Four of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords04.webp'),
    'Five of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords05.webp'),
    'Six of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords06.webp'),
    'Seven of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords07.webp'),
    'Eight of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords08.webp'),
    'Nine of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords09.webp'),
    'Ten of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords10.webp'),
    'Page of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords11.webp'),
    'Knight of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords12.webp'),
    'Queen of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords13.webp'),
    'King of Swords': require('../../assets/divination/tarot-gilded-dreams/Swords14.webp'),
    'Ace of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles01.webp'),
    'Two of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles02.webp'),
    'Three of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles03.webp'),
    'Four of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles04.webp'),
    'Five of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles05.webp'),
    'Six of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles06.webp'),
    'Seven of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles07.webp'),
    'Eight of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles08.webp'),
    'Nine of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles09.webp'),
    'Ten of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles10.webp'),
    'Page of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles11.webp'),
    'Knight of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles12.webp'),
    'Queen of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles13.webp'),
    'King of Pentacles': require('../../assets/divination/tarot-gilded-dreams/Pentacles14.webp'),
  },
};

export const TAROT_DECK_IMAGE_MAPS: Record<TarotDeckId, TarotDeckImages> = {
  'rider-waite-classic': RIDER_WAITE_DECK_IMAGES,
  'gilded-dreams': GILDED_DREAMS_DECK_IMAGES,
};

export const TAROT_DECK_OPTIONS: TarotDeckOption[] = [
  {
    id: 'rider-waite-classic',
    label: 'Rider-Waite Klasik',
    description: 'Klasik sembol dili ve tanıdık tarot ikonografisi.',
    previewImage: RIDER_WAITE_DECK_IMAGES.front['The Fool'],
    backImage: RIDER_WAITE_DECK_IMAGES.back,
  },
  {
    id: 'gilded-dreams',
    label: 'Yaldızlı Düşler',
    description: 'Daha parlak, mistik ve masalsı bir görsel atmosfer.',
    previewImage: GILDED_DREAMS_DECK_IMAGES.front['The Fool'],
    backImage: GILDED_DREAMS_DECK_IMAGES.back,
  },
];

export function getTarotDeckImages(deckId?: string | null) {
  return TAROT_DECK_IMAGE_MAPS[(deckId || DEFAULT_TAROT_DECK_ID) as TarotDeckId] || TAROT_DECK_IMAGE_MAPS[DEFAULT_TAROT_DECK_ID];
}

export function getTarotDeckOption(deckId?: string | null) {
  return TAROT_DECK_OPTIONS.find((deck) => deck.id === deckId) || TAROT_DECK_OPTIONS[0];
}

export const TAROT_BACK_IMAGE: ImageSourcePropType = RIDER_WAITE_DECK_IMAGES.back;
export const TAROT_FRONT_IMAGE_MAP: Record<string, ImageSourcePropType> = RIDER_WAITE_DECK_IMAGES.front;
