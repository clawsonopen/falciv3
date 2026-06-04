import * as FileSystem from 'expo-file-system/legacy';
import {
  MEMORY_RETENTION_POLICY,
  loadAccountState,
  loadProfileMemoryBundle,
  runMemoryConsolidationForProfile,
} from './profileMemoryService';

type MemoryMaintenanceResult = {
  profileId: string;
  beforeBytes: number;
  afterBytes: number;
  actions: string[];
};

async function sizeOfJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value || null)).length;
}

async function profileMemorySize(profileId: string) {
  const state = await loadAccountState();
  const bundle = await loadProfileMemoryBundle(state, profileId);
  return sizeOfJson(bundle);
}

export async function runMemoryMaintenanceForAllProfiles(): Promise<MemoryMaintenanceResult[]> {
  const state = await loadAccountState();
  const results: MemoryMaintenanceResult[] = [];
  for (const profile of state.profiles) {
    const beforeBytes = await profileMemorySize(profile.profileId).catch(() => 0);
    await runMemoryConsolidationForProfile(profile.profileId).catch(() => {});
    const afterBytes = await profileMemorySize(profile.profileId).catch(() => 0);
    const actions = [
      'Caveman sıkıştırması çalıştırıldı.',
      'Düşük güvenli reading-derived sinyaller zayıflatıldı.',
    ];
    if (afterBytes > MEMORY_RETENTION_POLICY.activeIndexTargetBytes) {
      actions.push('Aktif index hedefi aşıldı; eski raw/archive kayıtları Google Drive arşiv özelliği gelene kadar korunuyor.');
    }
    results.push({
      profileId: profile.profileId,
      beforeBytes,
      afterBytes,
      actions,
    });
  }
  return results;
}

export async function getMemoryStorageStatus() {
  const state = await loadAccountState();
  const dataDir = `${FileSystem.documentDirectory}falci-data/`;
  const info = await FileSystem.getInfoAsync(dataDir);
  const profileSizes = await Promise.all(
    state.profiles.map(async (profile) => ({
      profileId: profile.profileId,
      displayName: profile.displayName,
      estimatedJsonBytes: await profileMemorySize(profile.profileId).catch(() => 0),
    })),
  );
  return {
    dataDir,
    exists: info.exists,
    profileQuotaBytes: MEMORY_RETENTION_POLICY.profileQuotaBytes,
    activeIndexTargetBytes: MEMORY_RETENTION_POLICY.activeIndexTargetBytes,
    profileSizes,
  };
}
