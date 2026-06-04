import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { BrandedPicker } from '../components/BrandedPicker';
import { BrandedConfirmModal } from '../components/BrandedConfirmModal';
import { BrandedScrollView } from '../components/BrandedScrollView';
import { TURKEY_CITY_OPTIONS, TURKEY_DISTRICTS_BY_CITY } from '../data/turkeyLocations';
import {
  createProfile,
  deleteProfile,
  getPrimaryProfile,
  loadAccountState,
  updateProfile,
} from '../services/profileMemoryService';
import type {
  AccountState,
  BirthInfo,
  ProfileGender,
  RelationshipPrimary,
  RelationshipRelativeDetail,
  SubjectProfile,
} from '../types/memory';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSettings'>;

type ProfileDraft = {
  profileId: string | null;
  displayName: string;
  relationshipPrimary: RelationshipPrimary;
  relationshipDetail: RelationshipRelativeDetail;
  relationshipFreeform: string;
  gender: ProfileGender | 'bos';
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  birthCountry: string;
  birthCity: string;
  birthDistrict: string;
};

const RELATIVE_DETAILS: RelationshipRelativeDetail[] = [
  'teyze',
  'dayi',
  'hala',
  'amca',
  'kuzen',
  'dede',
  'nine',
  'anneanne',
  'babaanne',
  'torun',
  'yegen',
  'diger_akraba',
];

const RELATIONSHIP_OPTIONS: RelationshipPrimary[] = [
  'kendi',
  'es',
  'sevgili',
  'eski_sevgili',
  'sevgili_adayi',
  'anne',
  'baba',
  'kardes',
  'cocuk',
  'arkadas',
  'evcil_hayvan',
  'akraba',
  'diger',
];

const GENDER_OPTIONS: Array<ProfileGender | 'bos'> = [
  'bos',
  'kadin',
  'erkek',
  'hicbiri',
  'belirtmek_istemiyorum',
];

const EMPTY_BIRTH: BirthInfo = {
  date: null,
  time: null,
  timeKnown: false,
  location: {
    country: null,
    cityOrRegion: null,
    district: null,
    subdistrict: null,
    freeform: null,
  },
};

const YEAR_OPTIONS = Array.from({ length: 90 }, (_, index) => String(new Date().getFullYear() - index));
const MONTH_OPTIONS = [
  { value: '01', label: 'Ocak' },
  { value: '02', label: 'Şubat' },
  { value: '03', label: 'Mart' },
  { value: '04', label: 'Nisan' },
  { value: '05', label: 'Mayıs' },
  { value: '06', label: 'Haziran' },
  { value: '07', label: 'Temmuz' },
  { value: '08', label: 'Ağustos' },
  { value: '09', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];
const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const COUNTRY_OPTIONS = ['Türkiye', 'Almanya', 'Fransa', 'Hollanda', 'Belçika', 'İngiltere', 'ABD', 'Kanada', 'Diğer'];
const DISTRICT_OTHER_VALUE = '__other__';

function sortTurkishLabels<T extends string>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' }));
}

function labelForRelationship(value: RelationshipPrimary) {
  switch (value) {
    case 'kendi':
      return 'Kendim';
    case 'es':
      return 'Eş';
    case 'sevgili':
      return 'Sevgili';
    case 'eski_sevgili':
      return 'Eski sevgili / eski eş';
    case 'sevgili_adayi':
      return 'Sevgili adayı';
    case 'anne':
      return 'Anne';
    case 'baba':
      return 'Baba';
    case 'kardes':
      return 'Kardeş';
    case 'cocuk':
      return 'Çocuk';
    case 'arkadas':
      return 'Arkadaş';
    case 'evcil_hayvan':
      return 'Evcil hayvan';
    case 'akraba':
      return 'Akraba';
    case 'diger':
      return 'Diğer';
  }
}

function labelForRelative(value: RelationshipRelativeDetail) {
  if (value === 'diger_akraba') return 'Diğer akraba';
  const labels: Record<RelationshipRelativeDetail, string> = {
    teyze: 'Teyze',
    dayi: 'Dayı',
    hala: 'Hala',
    amca: 'Amca',
    kuzen: 'Kuzen',
    dede: 'Dede',
    nine: 'Nine',
    anneanne: 'Anneanne',
    babaanne: 'Babaanne',
    torun: 'Torun',
    yegen: 'Yeğen',
    diger_akraba: 'Diğer akraba',
  };
  return labels[value];
}

function labelForGender(value: ProfileGender | 'bos') {
  switch (value) {
    case 'bos':
      return 'Seç';
    case 'kadin':
      return 'Kadın';
    case 'erkek':
      return 'Erkek';
    case 'hicbiri':
      return 'Hiçbiri';
    case 'belirtmek_istemiyorum':
      return 'Belirtmek istemiyorum';
  }
}

function profileBadge(profile: SubjectProfile) {
  if (profile.relationshipPrimary === 'evcil_hayvan') {
    return profile.relationshipFreeform || 'Evcil hayvan';
  }
  if (profile.relationshipPrimary !== 'akraba') {
    return labelForRelationship(profile.relationshipPrimary);
  }
  if (profile.relationshipDetail === 'diger_akraba') {
    return profile.relationshipFreeform || 'Akraba';
  }
  return profile.relationshipDetail ? labelForRelative(profile.relationshipDetail) : 'Akraba';
}

function emptyDraft(isPrimary: boolean): ProfileDraft {
  return {
    profileId: null,
    displayName: '',
    relationshipPrimary: isPrimary ? 'kendi' : 'arkadas',
    relationshipDetail: 'teyze',
    relationshipFreeform: '',
    gender: 'bos',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthHour: '',
    birthMinute: '',
    birthCountry: '',
    birthCity: '',
    birthDistrict: '',
  };
}

function draftFromProfile(profile: SubjectProfile): ProfileDraft {
  const [birthYear = '', birthMonth = '', birthDay = ''] = (profile.birth.date || '').split('-');
  const [birthHour = '', birthMinute = ''] = (profile.birth.time || '').split(':');
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    relationshipPrimary: profile.relationshipPrimary,
    relationshipDetail: profile.relationshipDetail || 'teyze',
    relationshipFreeform: profile.relationshipFreeform || '',
    gender: profile.gender || 'bos',
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    birthCountry: profile.birth.location.country || '',
    birthCity: profile.birth.location.cityOrRegion || '',
    birthDistrict: profile.birth.location.district || '',
  };
}

function buildBirthInfo(draft: ProfileDraft): BirthInfo {
  const date =
    draft.birthYear && draft.birthMonth && draft.birthDay
      ? `${draft.birthYear}-${draft.birthMonth}-${draft.birthDay}`
      : null;
  const time = draft.birthHour && draft.birthMinute ? `${draft.birthHour}:${draft.birthMinute}` : null;
  const district = draft.birthDistrict === DISTRICT_OTHER_VALUE ? null : draft.birthDistrict.trim() || null;

  return {
    ...EMPTY_BIRTH,
    date,
    time,
    timeKnown: Boolean(time),
    location: {
      country: draft.birthCountry.trim() || null,
      cityOrRegion: draft.birthCity.trim() || null,
      district,
      subdistrict: null,
      freeform: null,
    },
  };
}

function needsRelationshipFreeform(draft: ProfileDraft) {
  return (
    draft.relationshipPrimary === 'diger' ||
    draft.relationshipPrimary === 'evcil_hayvan' ||
    (draft.relationshipPrimary === 'akraba' && draft.relationshipDetail === 'diger_akraba')
  );
}

function pickerValue(value: string) {
  return value || 'sec';
}

function isTurkeyCountry(value: string) {
  const v = value.toLocaleLowerCase('tr-TR');
  return v === 'türkiye' || v === 'turkiye' || v === 'turkey';
}

function sortProfiles(profiles: SubjectProfile[], primaryProfileId: string | null) {
  return [...profiles].sort((a, b) => {
    const aSelf = a.profileId === primaryProfileId || a.relationshipPrimary === 'kendi' || a.isPrimary;
    const bSelf = b.profileId === primaryProfileId || b.relationshipPrimary === 'kendi' || b.isPrimary;
    if (aSelf !== bSelf) return aSelf ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function ProfileSettingsScreen({ navigation, route }: Props) {
  const [state, setState] = useState<AccountState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyDraft(true));
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [validationModal, setValidationModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const requestedProfileOpenedRef = useRef(false);

  const primaryProfile = state ? getPrimaryProfile(state) : null;
  const selectedProfile = useMemo(
    () => state?.profiles.find((profile) => profile.profileId === selectedProfileId) || null,
    [selectedProfileId, state],
  );
  const deleteTargetProfile = useMemo(
    () => state?.profiles.find((profile) => profile.profileId === profileDraft.profileId) || null,
    [profileDraft.profileId, state],
  );
  const editingExistingProfile = Boolean(profileDraft.profileId);
  const editingIsPrimary = profileDraft.profileId
    ? state?.profiles.find((profile) => profile.profileId === profileDraft.profileId)?.isPrimary || false
    : !primaryProfile;
  const deletingPrimaryProfile = Boolean(
    deleteTargetProfile &&
      (deleteTargetProfile.isPrimary ||
        deleteTargetProfile.profileId === state?.primaryProfileId ||
        deleteTargetProfile.relationshipPrimary === 'kendi'),
  );
  const isTurkeyBirthCountry = isTurkeyCountry(profileDraft.birthCountry);
  const turkeyCities = useMemo<string[]>(() => sortTurkishLabels(TURKEY_CITY_OPTIONS), []);
  const selectedCityDistricts = useMemo(
    () => (isTurkeyBirthCountry ? sortTurkishLabels(TURKEY_DISTRICTS_BY_CITY[profileDraft.birthCity] || []) : []),
    [isTurkeyBirthCountry, profileDraft.birthCity],
  );
  const districtIsKnown =
    Boolean(profileDraft.birthDistrict) && selectedCityDistricts.includes(profileDraft.birthDistrict);
  const showDistrictFreeform =
    isTurkeyBirthCountry &&
    Boolean(profileDraft.birthCity) &&
    (profileDraft.birthDistrict === DISTRICT_OTHER_VALUE || (Boolean(profileDraft.birthDistrict) && !districtIsKnown));

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await loadAccountState();
      const sorted = sortProfiles(next.profiles, next.primaryProfileId);
      const sortedState: AccountState = { ...next, profiles: sorted };
      setState(sortedState);
      const requestedProfile = route.params?.profileId
        ? sortedState.profiles.find((profile) => profile.profileId === route.params?.profileId) || null
        : null;
      const fallbackProfile = requestedProfile || getPrimaryProfile(sortedState) || sortedState.profiles[0] || null;
      setSelectedProfileId((current) =>
        current && sortedState.profiles.some((profile) => profile.profileId === current)
          ? current
          : fallbackProfile?.profileId || null,
      );
    } finally {
      setIsLoading(false);
    }
  }, [route.params?.profileId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadState();
    });
    return unsubscribe;
  }, [loadState, navigation]);

  const openNewProfileModal = useCallback(() => {
    setProfileDraft(emptyDraft(!primaryProfile));
    setProfileModalVisible(true);
  }, [primaryProfile]);

  const openProfileDetailModal = useCallback((profile: SubjectProfile) => {
    setSelectedProfileId(profile.profileId);
    setProfileDraft(draftFromProfile(profile));
    setProfileModalVisible(true);
  }, []);

  useEffect(() => {
    if (!route.params?.profileId || requestedProfileOpenedRef.current || !state) return;
    const requestedProfile = state.profiles.find((profile) => profile.profileId === route.params?.profileId);
    if (!requestedProfile) return;
    requestedProfileOpenedRef.current = true;
    openProfileDetailModal(requestedProfile);
  }, [openProfileDetailModal, route.params?.profileId, state]);

  const handleDraftChange = useCallback(<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const trimmedName = profileDraft.displayName.trim();
    if (!trimmedName) {
      setValidationModal({ visible: true, message: 'Profil için isim veya nick yazmalısın.' });
      return;
    }

    if (profileDraft.gender === 'bos') {
      setValidationModal({ visible: true, message: 'Profil için cinsiyet seçmelisin.' });
      return;
    }

    if (!profileDraft.birthYear || !profileDraft.birthMonth || !profileDraft.birthDay) {
      setValidationModal({ visible: true, message: 'Profil için doğum tarihini yıl, ay ve gün olarak seçmelisin.' });
      return;
    }

    if (needsRelationshipFreeform(profileDraft) && !profileDraft.relationshipFreeform.trim()) {
      setValidationModal({ visible: true, message: 'Bu yakınlık derecesi için kısa bir açıklama yazmalısın.' });
      return;
    }

    const relationshipPrimary = editingIsPrimary ? 'kendi' : profileDraft.relationshipPrimary;
    const relationshipDetail = relationshipPrimary === 'akraba' ? profileDraft.relationshipDetail : null;
    const relationshipFreeform =
      relationshipPrimary === 'evcil_hayvan'
        ? profileDraft.relationshipFreeform.trim()
        : relationshipPrimary === 'diger' || profileDraft.relationshipDetail === 'diger_akraba'
          ? profileDraft.relationshipFreeform.trim()
          : null;
    const birth = buildBirthInfo(profileDraft);

    const next = profileDraft.profileId
      ? await updateProfile({
          profileId: profileDraft.profileId,
          displayName: trimmedName,
          relationshipPrimary,
          relationshipDetail,
          relationshipFreeform,
          gender: profileDraft.gender,
          birth,
        })
      : await createProfile({
          displayName: trimmedName,
          relationshipPrimary,
          relationshipDetail,
          relationshipFreeform,
          gender: profileDraft.gender,
          birth,
          isPrimary: editingIsPrimary,
        });

    const sorted = sortProfiles(next.profiles, next.primaryProfileId);
    setState({ ...next, profiles: sorted });
    const newestProfile =
      sorted.reduce<SubjectProfile | null>((latest, profile) => {
        if (!latest) return profile;
        return new Date(profile.createdAt).getTime() > new Date(latest.createdAt).getTime() ? profile : latest;
      }, null) || null;
    const targetId = profileDraft.profileId || newestProfile?.profileId || null;
    setSelectedProfileId(targetId);
    setProfileModalVisible(false);
    setProfileDraft(emptyDraft(!getPrimaryProfile(next)));
  }, [editingIsPrimary, profileDraft]);

  const handleDeleteProfile = useCallback(async () => {
    if (!profileDraft.profileId) return;
    const next = await deleteProfile(profileDraft.profileId, 'profile-and-data');
    const sorted = sortProfiles(next.profiles, next.primaryProfileId);
    setState({ ...next, profiles: sorted });
    setSelectedProfileId(getPrimaryProfile(next)?.profileId || sorted[0]?.profileId || null);
    setProfileModalVisible(false);
    setDeleteConfirmVisible(false);
  }, [profileDraft.profileId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Hazırlanıyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <BrandedScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showScrollToTop>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Profil Ayarları</Text>
            <Text style={styles.helperText}>Profili seçmek için karta dokun, düzenlemek için Düzenle butonunu kullan.</Text>
            <View style={styles.subjectGrid}>
              {state?.profiles.map((profile) => {
                const selected = profile.profileId === selectedProfileId;
                return (
                  <View
                    key={profile.profileId}
                    style={[styles.subjectCard, selected && styles.subjectCardSelected]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.subjectSelectArea}
                      onPress={() => setSelectedProfileId(profile.profileId)}
                    >
                      <Text style={styles.subjectName}>{profile.displayName}</Text>
                      <Text style={styles.subjectMeta}>{profileBadge(profile)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${profile.displayName} profilini düzenle`}
                      activeOpacity={0.82}
                      style={styles.editProfileButton}
                      onPress={() => openProfileDetailModal(profile)}
                    >
                      <Text style={styles.editProfileButtonText}>Düzenle</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={styles.addProfileButton} onPress={openNewProfileModal}>
              <Text style={styles.addProfilePlus}>+</Text>
              <Text style={styles.addProfileButtonText}>Profil Ekle</Text>
            </TouchableOpacity>

            {selectedProfile ? (
              <View style={styles.linkRow}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() =>
                    navigation.navigate('MemoryDebug', {
                      profileId: selectedProfile.profileId,
                      profileName: selectedProfile.displayName,
                    })
                  }
                >
                  <Text style={styles.linkButtonText}>Hafıza Özeti</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() =>
                    navigation.navigate('History', {
                      profileId: selectedProfile.profileId,
                      profileName: selectedProfile.displayName,
                    })
                  }
                >
                  <Text style={styles.linkButtonText}>Son Okumalar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </BrandedScrollView>
      </SafeAreaView>

      <Modal visible={profileModalVisible} animationType="slide" transparent onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView style={styles.modalSheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={styles.modalSafeArea}>
              <BrandedScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showScrollToTop
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingExistingProfile ? 'Profil Detayları' : 'Profil Oluştur'}</Text>
                  <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                    <Text style={styles.modalClose}>Kapat</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inlineLabel}>İsim veya nick</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="İsim veya nick"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={profileDraft.displayName}
                  onChangeText={(value) => handleDraftChange('displayName', value)}
                />

                {!editingIsPrimary ? (
                  <>
                    <Text style={styles.inlineLabel}>Yakınlık derecesi</Text>
                    <BrandedPicker
                      selectedValue={profileDraft.relationshipPrimary}
                      onValueChange={(value) => handleDraftChange('relationshipPrimary', value)}
                      options={RELATIONSHIP_OPTIONS.filter((item) => item !== 'kendi').map((option) => ({
                        label: labelForRelationship(option),
                        value: option,
                      }))}
                    />
                  </>
                ) : null}

                {profileDraft.relationshipPrimary === 'akraba' && !editingIsPrimary ? (
                  <>
                    <Text style={styles.inlineLabel}>Akrabalık tipi</Text>
                    <BrandedPicker
                      selectedValue={profileDraft.relationshipDetail}
                      onValueChange={(value) => handleDraftChange('relationshipDetail', value)}
                      options={RELATIVE_DETAILS.map((option) => ({ label: labelForRelative(option), value: option }))}
                    />
                  </>
                ) : null}

                {needsRelationshipFreeform(profileDraft) && !editingIsPrimary ? (
                  <>
                    <Text style={styles.inlineLabel}>{profileDraft.relationshipPrimary === 'evcil_hayvan' ? 'Tür' : 'Açıklama'}</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder={profileDraft.relationshipPrimary === 'evcil_hayvan' ? 'Kedi, köpek...' : 'Bu profil sana ne oluyor?'}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={profileDraft.relationshipFreeform}
                      onChangeText={(value) => handleDraftChange('relationshipFreeform', value)}
                    />
                  </>
                ) : null}

                <Text style={styles.inlineLabel}>Cinsiyet</Text>
                <BrandedPicker
                  selectedValue={profileDraft.gender}
                  onValueChange={(value) => handleDraftChange('gender', value)}
                  options={GENDER_OPTIONS.map((option) => ({ label: labelForGender(option), value: option }))}
                />

                <Text style={styles.inlineLabel}>Doğum tarihi</Text>
                <Text style={styles.helperText}>İsim, yakınlık, cinsiyet ve doğum tarihi profili kaydetmek için yeterli. Doğum saati ve doğum yeri isteğe bağlıdır; doğum haritası veya kişiye özel astrolojide gerekirse tamamlatılır.</Text>
                <View style={styles.wheelRow}>
                  <View style={styles.wheelColumn}>
                    <Text style={styles.wheelLabel}>Yıl</Text>
                    <BrandedPicker
                      selectedValue={pickerValue(profileDraft.birthYear)}
                      onValueChange={(value) => handleDraftChange('birthYear', value === 'sec' ? '' : value)}
                      options={[{ label: 'Yıl', value: 'sec' }, ...YEAR_OPTIONS.map((option) => ({ label: option, value: option }))]}
                      compact
                    />
                  </View>
                  <View style={styles.wheelColumn}>
                    <Text style={styles.wheelLabel}>Ay</Text>
                    <BrandedPicker
                      selectedValue={pickerValue(profileDraft.birthMonth)}
                      onValueChange={(value) => handleDraftChange('birthMonth', value === 'sec' ? '' : value)}
                      options={[{ label: 'Ay', value: 'sec' }, ...MONTH_OPTIONS.map((option) => ({ label: option.label, value: option.value }))]}
                      compact
                    />
                  </View>
                  <View style={styles.wheelColumn}>
                    <Text style={styles.wheelLabel}>Gün</Text>
                    <BrandedPicker
                      selectedValue={pickerValue(profileDraft.birthDay)}
                      onValueChange={(value) => handleDraftChange('birthDay', value === 'sec' ? '' : value)}
                      options={[{ label: 'Gün', value: 'sec' }, ...DAY_OPTIONS.map((option) => ({ label: option, value: option }))]}
                      compact
                    />
                  </View>
                </View>

                <Text style={styles.inlineLabel}>Doğum saati (isteğe bağlı)</Text>
                <View style={styles.wheelRow}>
                  <View style={styles.wheelColumn}>
                    <Text style={styles.wheelLabel}>Saat</Text>
                    <BrandedPicker
                      selectedValue={pickerValue(profileDraft.birthHour)}
                      onValueChange={(value) => handleDraftChange('birthHour', value === 'sec' ? '' : value)}
                      options={[{ label: 'Saat', value: 'sec' }, ...HOUR_OPTIONS.map((option) => ({ label: option, value: option }))]}
                      compact
                    />
                  </View>
                  <View style={styles.wheelColumn}>
                    <Text style={styles.wheelLabel}>Dakika</Text>
                    <BrandedPicker
                      selectedValue={pickerValue(profileDraft.birthMinute)}
                      onValueChange={(value) => handleDraftChange('birthMinute', value === 'sec' ? '' : value)}
                      options={[{ label: 'Dakika', value: 'sec' }, ...MINUTE_OPTIONS.map((option) => ({ label: option, value: option }))]}
                      compact
                    />
                  </View>
                </View>

                <Text style={styles.inlineLabel}>Doğum yeri (astroloji için gerekli)</Text>
                <Text style={styles.helperText}>Şimdi boş bırakabilirsin. Doğum haritası ve kişiye özel astroloji için ülke ve şehir bilgisi gerekir; ilçe ve saat varsa yorumu keskinleştirir.</Text>
                <BrandedPicker
                  selectedValue={pickerValue(profileDraft.birthCountry)}
                  onValueChange={(value) => {
                    handleDraftChange('birthCountry', value === 'sec' ? '' : value);
                    handleDraftChange('birthCity', '');
                    handleDraftChange('birthDistrict', '');
                  }}
                  options={[{ label: 'Ülke seç', value: 'sec' }, ...COUNTRY_OPTIONS.map((option) => ({ label: option, value: option }))]}
                />
                {isTurkeyBirthCountry ? (
                  <BrandedPicker
                    selectedValue={profileDraft.birthCity && turkeyCities.includes(profileDraft.birthCity) ? profileDraft.birthCity : 'sec'}
                    onValueChange={(value) => {
                      if (value === 'sec') {
                        handleDraftChange('birthCity', '');
                        handleDraftChange('birthDistrict', '');
                        return;
                      }
                      handleDraftChange('birthCity', value);
                      handleDraftChange('birthDistrict', '');
                    }}
                    options={[{ label: 'Şehir seç', value: 'sec' }, ...turkeyCities.map((option) => ({ label: option, value: option }))]}
                  />
                ) : (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Şehir"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={profileDraft.birthCity}
                    onChangeText={(value) => handleDraftChange('birthCity', value)}
                    selectionColor="#D4A574"
                  />
                )}
                {isTurkeyBirthCountry && profileDraft.birthCity && selectedCityDistricts.length ? (
                  <BrandedPicker
                    selectedValue={
                      profileDraft.birthDistrict
                        ? districtIsKnown
                          ? profileDraft.birthDistrict
                          : DISTRICT_OTHER_VALUE
                        : 'sec'
                    }
                    onValueChange={(value) => {
                      if (value === 'sec') {
                        handleDraftChange('birthDistrict', '');
                        return;
                      }
                      handleDraftChange('birthDistrict', value);
                    }}
                    options={[
                      { label: 'İlçe seç', value: 'sec' },
                      ...selectedCityDistricts.map((option) => ({ label: option, value: option })),
                      { label: 'Diğer', value: DISTRICT_OTHER_VALUE },
                    ]}
                  />
                ) : null}
                {showDistrictFreeform ? (
                  <TextInput
                    style={styles.textInput}
                    placeholder="İlçe, belde, bucak veya kaza"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={profileDraft.birthDistrict === DISTRICT_OTHER_VALUE ? '' : profileDraft.birthDistrict}
                    onChangeText={(value) => handleDraftChange('birthDistrict', value)}
                    selectionColor="#D4A574"
                    returnKeyType="done"
                  />
                ) : null}
                {!isTurkeyBirthCountry ? (
                  <TextInput
                    style={styles.textInput}
                    placeholder="İlçe"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={profileDraft.birthDistrict}
                    onChangeText={(value) => handleDraftChange('birthDistrict', value)}
                    selectionColor="#D4A574"
                    returnKeyType="done"
                  />
                ) : null}

                <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSaveProfile()}>
                  <Text style={styles.primaryButtonText}>{editingExistingProfile ? 'Profili Güncelle' : 'Profili Kaydet'}</Text>
                </TouchableOpacity>

                {editingExistingProfile && profileDraft.profileId ? (
                  <TouchableOpacity style={styles.deleteButton} onPress={() => setDeleteConfirmVisible(true)}>
                    <Text style={styles.deleteButtonText}>Profili Sil</Text>
                  </TouchableOpacity>
                ) : null}
              </BrandedScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <BrandedConfirmModal
        visible={deleteConfirmVisible}
        title="Profili Sil"
        message={
          deletingPrimaryProfile
            ? 'Ana profilini silersen bu profile bağlı hafıza, okuma geçmişi ve oluşturduğun diğer tüm profiller de silinir. Bu işlem geri alınamaz. Emin misin?'
            : deleteTargetProfile
              ? `${deleteTargetProfile.displayName} profili ve bağlı kayıtları silinsin mi?`
              : 'Bu profili silmek istiyor musun?'
        }
        confirmLabel="Evet - Sil"
        cancelLabel="Hayır"
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => {
          void handleDeleteProfile();
        }}
      />
      <BrandedConfirmModal
        visible={validationModal.visible}
        title="Eksik Bilgi"
        message={validationModal.message}
        confirmLabel="Tamam"
        cancelLabel={null}
        onCancel={() => setValidationModal({ visible: false, message: '' })}
        onConfirm={() => setValidationModal({ visible: false, message: '' })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14141E' },
  safeArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, backgroundColor: '#14141E', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#E8C49A', fontSize: 16, fontWeight: '700' },
  panel: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 40, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.18)',
  },
  panelTitle: { color: '#E8C49A', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  helperText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  inlineLabel: { color: '#D4A574', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 10,
  },
  pickerShell: {
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 10,
    overflow: 'hidden',
    minHeight: Platform.OS === 'ios' ? 180 : 50, // iOS için alan açıldı
    justifyContent: 'center',
  },
  pickerShellCompact: {
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
    minHeight: Platform.OS === 'ios' ? 180 : 50, // iOS için alan açıldı
    justifyContent: 'center',
  },
  picker: { 
    color: '#D4A574', 
    height: Platform.OS === 'ios' ? 180 : 50, // iOS'ta tekerlek boyutu ayarlandı
    width: '100%',
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#D4A574',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#14141E', fontSize: 15, fontWeight: '800' },
  deleteButton: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.62)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#FFB0B0', fontSize: 14, fontWeight: '700' },
  subjectCard: {
    width: '48.5%',
    minHeight: 108,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.18)',
    justifyContent: 'space-between',
  },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  addProfileButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.24)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addProfilePlus: { color: '#E8C49A', fontSize: 20, fontWeight: '700', marginRight: 8 },
  addProfileButtonText: { color: '#FFF5E8', fontSize: 14, fontWeight: '800' },
  subjectCardSelected: { borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.14)' },
  subjectSelectArea: { flex: 1 },
  subjectName: { color: '#FFF5E8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  subjectMeta: { color: 'rgba(212,165,116,0.72)', fontSize: 12 },
  editProfileButton: {
    marginTop: 10,
    minHeight: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,165,116,0.1)',
  },
  editProfileButtonText: { color: '#E8C49A', fontSize: 12, fontWeight: '800' },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  linkButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D4A574',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(212,165,116,0.12)',
  },
  linkButtonText: { color: '#E8C49A', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' },
  modalSheet: {
    width: '100%',
    height: '92%',
    backgroundColor: '#181820',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  modalSafeArea: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 120 : 180 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { color: '#FFF5E8', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#D4A574', fontSize: 14, fontWeight: '700' },
  wheelRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  wheelColumn: { flex: 1 },
  wheelLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 12, marginBottom: 6 },
});
