import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  selectionColor?: string;
};

const TOPIC_START_RE = /^(aşk|ilişki|ilişkiler|kalp|aile|ev|hane|iş|kariyer|para|maddi|finans|sağlık|beden|ruh|duygu|zihin|öneri|tavsiye|sonuç|yakın gelecek|önümüzdeki|bu dönemde|bu ay|bu hafta|bugün)\b/i;
const TOPIC_SHIFT_RE = /\b(ilişki|aşk|kalp|aile|hane|kariyer|iş|para|maddi|finans|sağlık|beden|ruh hali|duygu|zihin|öneri|tavsiye|yakın gelecek|sonuç)\b/i;
const ORDINAL_DOT_TOKEN = '__ORDINAL_DOT__';
const DECORATIVE_SYMBOL_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0E}\u{FE0F}]/gu;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const MARKDOWN_EMPHASIS_RE = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
const MARKDOWN_LIST_MARKER_RE = /^[ \t]*(?:[-*+•◦‣▪▫]|\d+[.)])\s+/gm;

function sanitizeDisplayText(text: string) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/<\|[^>]{1,80}\|>|<\/?(?:unused|extra_id|pad|bos|eos|start_of_turn|end_of_turn)[^>]{0,80}>|<unused\d+>/giu, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(MARKDOWN_LINK_RE, '$1')
    .replace(MARKDOWN_LIST_MARKER_RE, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(MARKDOWN_EMPHASIS_RE, (_match, _strongMark, strongText, _emMark, emText) => strongText || emText || '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(DECORATIVE_SYMBOL_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function sentencesOf(text: string) {
  const protectedText = text.replace(
    /(\b\d{1,2})\.(\s*)(?=(?:haftası|haftanın|hafta|günü|gün|ayın|ay|yarısı|yarı|çeyrek|evde|evin|eve|evden|evler|evleri|ev|adım|aşama|faz|dönem|kapı|sayı|gibi)(?=$|[\s,;:)\]]))/giu,
    (_match, number, space) => `${number}${ORDINAL_DOT_TOKEN}${space}`,
  );
  return (
    protectedText
      .match(/[^.!?…]+[.!?…]+(?:["'”’)]*)|[^.!?…]+$/g)
      ?.map((item) => item.replace(new RegExp(ORDINAL_DOT_TOKEN, 'g'), '.').trim())
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
  const source = sanitizeDisplayText(text);
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
