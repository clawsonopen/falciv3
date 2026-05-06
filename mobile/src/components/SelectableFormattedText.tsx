import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  selectionColor?: string;
};

const TOPIC_START_RE = /^(aşk|ilişki|ilişkiler|kalp|aile|ev|hane|iş|kariyer|para|maddi|finans|sağlık|beden|ruh|duygu|zihin|öneri|tavsiye|sonuç|yakın gelecek|önümüzdeki|bu dönemde|bu ay|bu hafta|bugün)\b/i;
const TOPIC_SHIFT_RE = /\b(ilişki|aşk|kalp|aile|hane|kariyer|iş|para|maddi|finans|sağlık|beden|ruh hali|duygu|zihin|öneri|tavsiye|yakın gelecek|sonuç)\b/i;

function sentencesOf(text: string) {
  const protectedText = text.replace(/(\b\d{1,2})\.(\s*)(?=(ev|evde|evin|eve|evden|evler|evleri)\b)/gi, (_match, number, space) => {
    return `${number}__ORDINAL_DOT__${space}`;
  });
  return (
    protectedText
      .match(/[^.!?…]+[.!?…]+(?:["'”’)]*)|[^.!?…]+$/g)
      ?.map((item) => item.replace(/__ORDINAL_DOT__/g, '.').trim())
      .filter(Boolean) || []
  );
}

function hasTopicShift(current: string, sentence: string) {
  if (TOPIC_START_RE.test(sentence)) return true;
  if (current.length < 180) return false;
  return TOPIC_SHIFT_RE.test(sentence) && !TOPIC_SHIFT_RE.test(current.slice(-160));
}

function splitLongParagraph(paragraph: string) {
  const normalized = paragraph.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 420) return [normalized];

  const sentences = sentencesOf(normalized);
  if (!sentences.length || sentences.length < 3) {
    return normalized.match(/.{1,360}(?:\s|$)/g)?.map((item) => item.trim()).filter(Boolean) || [normalized];
  }

  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (current && (next.length > 430 || hasTopicShift(current, sentence))) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function formatReadableText(text: string) {
  const source = text.replace(/\r\n/g, '\n').trim();
  if (!source) return '';
  return source
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitLongParagraph(paragraph))
    .join('\n\n');
}

export function SelectableFormattedText({ text, style, selectionColor = '#E6D7C6' }: Props) {
  const formatted = useMemo(() => formatReadableText(text), [text]);
  return (
    <Text selectable selectionColor={selectionColor} style={style}>
      {formatted}
    </Text>
  );
}
