export const PERSONAL_INITIAL_READING_MIN_OUTPUT_TOKENS = 900;
export const PERSONAL_INITIAL_READING_MAX_OUTPUT_TOKENS = 1200;
export const PERSONAL_FOLLOW_UP_MIN_OUTPUT_TOKENS = 500;
export const PERSONAL_FOLLOW_UP_MAX_OUTPUT_TOKENS = 700;

export const PERSONAL_INITIAL_READING_TOKEN_INSTRUCTION =
  'Ana kişiye özel yorumu ham Gemini output token hesabıyla 900-1200 token aralığında tamamla; 900 tokenın altına düşme, 1200 tokenı aşmaya çalışma ve son cümleyi bitir.';

export const PERSONAL_FOLLOW_UP_TOKEN_INSTRUCTION =
  'Takip sorusu yanıtını ham Gemini output token hesabıyla 500-700 token aralığında tamamla; 500 tokenın altına düşme, 700 tokenı aşmaya çalışma ve son cümleyi bitir.';

export const OPTIONAL_READING_TOPIC_MIN_CHARS = 0;
export const OPTIONAL_READING_TOPIC_MAX_CHARS = 700;
export const FOLLOW_UP_QUESTION_MIN_CHARS = 2;
export const FOLLOW_UP_QUESTION_MAX_CHARS = 700;
export const DREAM_DESCRIPTION_MAX_CHARS = 3000;

export function normalizeLimitedInput(text: string, maxChars: number) {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}
