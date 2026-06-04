export const FOLLOW_UP_CHAT_CONTRACT = [
  '- Bu tur yeni bir okuma açılışı değildir; önceki okuma metnini yeniden yazma, özetleme veya kopyalama.',
  '- Yalnızca kullanıcının son mesajındaki soruya doğrudan cevap ver.',
  '- Önceki okumayı sadece bağlam olarak kullan; görseli veya ana yorumu baştan yorumlamaya çalışma.',
  '- Yanıtı kısa ama doyurucu tut: önce net cevap, sonra okuma bağlamından 1-2 gerekçe ve uygulanabilir küçük tavsiye ver.',
  '- Kullanıcının son mesajında önceki okumanın transkripsiyonu yanlışlıkla varsa onu yok say ve gerçek soruya odaklan.',
].join('\n');

export function cleanFollowUpReply(text: string) {
  return (text || '')
    .replace(/\b(hoş\s*geldin|hoş\s*gelmişsin|bakalım|bakıyorum|hemen\s+bak|yeniden\s+bakalım)\b[,.! ]*/giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getSimpleFollowUpReply(userText: string) {
  const normalized = (userText || '').trim().toLocaleLowerCase('tr-TR');
  if (/^(teşekkür|tesekkur|sağ ol|sag ol|tamam|ok|peki|anladım|anladim)[.! ]*$/i.test(normalized)) {
    return 'Rica ederim, burada kalalım; başka bir yerini açmak istersen son soruna göre devam ederim.';
  }
  return '';
}
