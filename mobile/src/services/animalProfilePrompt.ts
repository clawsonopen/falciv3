import type { ProfileMemorySnippet, SubjectProfile } from '../types/memory';

function ageFromBirthDate(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return null;
  const age = new Date().getFullYear() - Number(match[1]);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function animalGenderLabel(value?: string | null) {
  if (value === 'erkek') return 'erkek';
  if (value === 'kadin') return 'dişi';
  return value || null;
}

function compactAnimalInstruction(params: {
  profileName?: string | null;
  species?: string | null;
  gender?: string | null;
  birthDate?: string | null;
}) {
  const name = params.profileName || 'seçili profil';
  const species = params.species || 'evcil hayvan';
  const gender = animalGenderLabel(params.gender);
  const age = ageFromBirthDate(params.birthDate);
  const facts = [`ad=${name}`, `tür=${species}`];
  if (gender) facts.push(`cinsiyet=${gender}`);
  if (age !== null) facts.push(`yaklaşık yaş=${age}`);

  return [
    '## Evcil Hayvan Profil Kuralı',
    `- Seçili profil bir evcil hayvandır: ${facts.join(', ')}.`,
    '- Bu profili insan profili gibi yorumlama; kariyer, evlilik, romantik ilişki, okul, iş, para kazanma, insan sosyal çevresi veya insan psikolojisi ana temaları kurma.',
    '- Ana özne hayvandır. Yorum dili hayvanın mizacı, rutinleri, oyun/uyku düzeni, ev içi enerjisi, bedensel/pati dili, çevreye tepkisi ve sahibiyle bağı üzerinden ilerlemeli.',
    '- Evde başka hayvanlar varsa kıskançlık, alan/oyuncak paylaşımı, yan yana uyuma, birbirini yalama, oyun daveti, barışma ve mesafe ihtiyacı gibi hayvanlara özgü sevimli sosyal dinamikleri insanlaştırmadan kullanabilirsin.',
    '- İnsanların duymadığı kokular, ince sesler, pencereye gelen hayvanlar, ışık/gölge hareketleri ve hayvanın insanlarının kalbindeki özel yeri evcil hayvan yorumunun doğal malzemesidir.',
    '- Hesap sahibine öneri verirken onu hayvanın sahibi/refakatçisi olarak konumlandır; seçili hayvana sonradan insan gibi "sen" diye dönme.',
    '- Sağlık, ağrı, davranış değişikliği, iştah, uyku, hareket veya beden konusu sorulursa insan sağlığı uzmanı değil veteriner yönlendirmesi yap.',
  ].join('\n');
}

export function isAnimalProfile(profile?: SubjectProfile | null) {
  return profile?.relationshipPrimary === 'evcil_hayvan';
}

export function isAnimalMemorySnippet(snippet?: ProfileMemorySnippet | null) {
  return snippet?.relationshipPrimary === 'evcil_hayvan';
}

export function buildAnimalProfileInstructionFromProfile(profile?: SubjectProfile | null) {
  if (!isAnimalProfile(profile)) return '';
  return compactAnimalInstruction({
    profileName: profile?.displayName,
    species: profile?.relationshipFreeform || 'evcil hayvan',
    gender: profile?.gender,
    birthDate: profile?.birth.date,
  });
}

export function buildAnimalProfileInstructionFromMemory(snippet?: ProfileMemorySnippet | null) {
  if (!isAnimalMemorySnippet(snippet)) return '';
  return compactAnimalInstruction({
    profileName: snippet?.profileName,
    species: snippet?.petSpecies || snippet?.relationshipLabel || 'evcil hayvan',
    gender: snippet?.profileGender,
    birthDate: snippet?.birthChartData?.birthDate,
  });
}
