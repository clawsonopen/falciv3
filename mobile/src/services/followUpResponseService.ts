export const FOLLOW_UP_CHAT_CONTRACT = [
  '- Bu tur yeni bir okuma açılışı değildir; önceki okuma metnini yeniden yazma, özetleme veya kopyalama.',
  '- Yalnızca kullanıcının son mesajındaki soruya doğrudan cevap ver.',
  '- Yeniden selamlama yapma; "Merhaba", "Selam", "Hoş geldin" gibi açılışlar veya isimle yeniden hitap kullanma.',
  '- Önceki okumayı sadece bağlam olarak kullan; görseli veya ana yorumu baştan yorumlamaya çalışma.',
  '- Yanıtı kısa ama doyurucu tut: önce net cevap, sonra okuma bağlamından 1-2 gerekçe ve uygulanabilir küçük tavsiye ver.',
  '- Kullanıcının son mesajında önceki okumanın transkripsiyonu yanlışlıkla varsa onu yok say ve gerçek soruya odaklan.',
].join('\n');

export function cleanFollowUpReply(text: string) {
  let cleaned = (text || '')
    .replace(/^\s*(?:merhaba|selam|selamlar|hey|hoş\s*geldin|hoş\s*gelmişsin)(?:\s+[\p{L}.'-]{2,24})?\s*[,!.:-]?\s*/iu, '')
    .replace(/^\s*(?:canım|tatlım|güzelim|evladım|yavrum)(?:\s+[\p{L}.'-]{2,24})?\s*[,!.:-]?\s*/iu, '')
    .replace(/\b(hoş\s*geldin|hoş\s*gelmişsin|bakalım|bakıyorum|hemen\s+bak|yeniden\s+bakalım|yeniden\s+bakalım\s+canım)\b[,.! ]*/giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  while (
    sentences.length > 1 &&
    /^(?:merhaba|selam|selamlar|hoş\s*geldin|hoş\s*gelmişsin|yeniden\s+bakalım|bakalım)\b/i.test(sentences[0])
  ) {
    sentences.shift();
  }
  cleaned = sentences.join(' ').trim() || cleaned;
  return cleaned;
}

export function getSimpleFollowUpReply(userText: string) {
  const normalized = (userText || '').trim().toLocaleLowerCase('tr-TR');
  if (/^(teşekkür|tesekkur|sağ ol|sag ol|tamam|ok|peki|anladım|anladim)[.! ]*$/i.test(normalized)) {
    return 'Rica ederim, burada kalalım; başka bir yerini açmak istersen son soruna göre devam ederim.';
  }
  return '';
}
