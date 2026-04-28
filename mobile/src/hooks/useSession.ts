import { useState, useCallback, useRef, useEffect } from 'react';
import type { SessionConfig, SessionState, ChatMessage } from '../types';
import { compressImage } from '../services/imageService';
import { getFortuneReply, type FortuneMessage } from '../services/fortuneApiService';
import { appendUserConversationMemory } from '../services/profileMemoryService';
import {
  addPendingInputTokens,
  addRejectedUploadAttempt,
  consumePendingInputTokens,
  consumeRejectedUploadAttempts,
} from '../services/tokenLedgerService';

function looksLikeQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('?')) return true;
  return /\b(ne|neden|nasil|nasıl|ne zaman|kim|hangi|mi|mı|mu|mü|olur mu|var mi|var mı)\b/.test(normalized);
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    status: 'idle',
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    messages: [],
    isAiSpeaking: false,
    isUserSpeaking: false,
  });

  const messageIdCounter = useRef(0);
  const configRef = useRef<SessionConfig | null>(null);
  const sessionIdRef = useRef('');
  const imagesRef = useRef<{ cup?: string; saucer?: string; palm?: string }>({});
  const messagesRef = useRef<ChatMessage[]>([]);
  const statusRef = useRef<SessionState['status']>('idle');
  const userSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = state.messages;
    statusRef.current = state.status;
  }, [state.messages, state.status]);

  const setUserSpeakingActive = useCallback((active: boolean) => {
    if (active) {
      setState((s) => ({ ...s, isUserSpeaking: true }));
      return;
    }
    if (userSpeakingTimeoutRef.current) {
      clearTimeout(userSpeakingTimeoutRef.current);
      userSpeakingTimeoutRef.current = null;
    }
    setState((s) => ({ ...s, isUserSpeaking: false }));
  }, []);

  const toFortuneMessages = useCallback(
    (messages: ChatMessage[]): FortuneMessage[] =>
      messages
        .filter((m) => Boolean(m.text?.trim()))
        .map((m) => ({ role: m.role, text: m.text })),
    [],
  );

  const addMessage = useCallback((role: 'user' | 'assistant', text: string, timestamp = Date.now()) => {
    const msg: ChatMessage = {
      id: `${role}-${++messageIdCounter.current}-${timestamp}`,
      role,
      text,
      timestamp,
    };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
    return msg;
  }, []);

  const buildSeedMessage = useCallback((config: SessionConfig, rejectedUploadCount: number): string => {
    const retryNotice =
      rejectedUploadCount > 0
        ? `Bu faldan önce bu oturum için ${rejectedUploadCount} kez yanlış görsel denemesi yapıldı ve kredi hesabına dahil edildi. Yoruma bunu kısa bir arka plan notu olarak dahil et ama ana odağı falda tut.`
        : '';

    if (config.coffeeMode === 'ai-brew') {
      const target = config.profileIsSelf ? 'Benim için' : `${config.profileName} için`;
      return [
        `${target} benim yerime bir kahve içilmiş gibi fala başla.`,
        'Gerçek görsel yok; seçili profilin hafızası ve önceki temaları varsa onlardan sezgisel destek al.',
        'İlk yorumu doğal ve dolu dolu aç.',
        retryNotice,
      ]
        .filter(Boolean)
        .join(' ');
    }

    if (config.readingType === 'palm') {
      const target = config.profileIsSelf ? 'Benim' : `${config.profileName} için`;
      return [`${target} avuç içi fotoğrafını gönderdim. El falımı başlat lütfen.`, retryNotice]
        .filter(Boolean)
        .join(' ');
    }

    const target = config.profileIsSelf ? 'Benim' : `${config.profileName} için`;
    const hasCup = Boolean(config.cupImageUri);
    const hasSaucer = Boolean(config.saucerImageUri);
    const surfaces = hasCup && hasSaucer ? 'fincan içi ve tabak' : hasSaucer ? 'tabak' : 'fincan içi';
    return [
      `${target} ${surfaces} görsellerini gönderdim.`,
      'Falıma başla lütfen.',
      retryNotice,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const askAgent = useCallback(
    async (nextMessages: ChatMessage[]) => {
      const config = configRef.current;
      if (!config) return;

      setState((s) => ({ ...s, isAiSpeaking: true }));
      try {
        const text = await getFortuneReply({
          sessionId: sessionIdRef.current,
          devSettings: config.devSettings,
          profileId: config.profileId,
          profileName: config.profileName,
          profileIsSelf: config.profileIsSelf,
          readingType: config.readingType,
          coffeeMode: config.coffeeMode,
          memorySnippet: config.memorySnippet,
          messages: toFortuneMessages(nextMessages),
          images: imagesRef.current,
        });
        addMessage('assistant', text.text);
        setState((s) => ({
          ...s,
          tokenUsage: {
            inputTokens: s.tokenUsage.inputTokens + (text.usage.inputTokens || 0),
            outputTokens: s.tokenUsage.outputTokens + (text.usage.outputTokens || 0),
          },
        }));
      } catch (err: any) {
        const pendingInput = Number(err?.tokenUsage?.totalTokens || err?.tokenUsage?.inputTokens || 0);
        if (pendingInput > 0) {
          await addPendingInputTokens(pendingInput).catch(() => {});
        }
        if (err?.isImageValidation) {
          await addRejectedUploadAttempt(1).catch(() => {});
        }
        throw err;
      } finally {
        setState((s) => ({ ...s, isAiSpeaking: false, status: 'active' }));
      }
    },
    [addMessage, toFortuneMessages],
  );

  const startSession = useCallback(
    async (config: SessionConfig) => {
      configRef.current = config;
      sessionIdRef.current = `falci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setState((s) => ({
        ...s,
        status: 'connecting',
        messages: [],
        tokenUsage: { inputTokens: 0, outputTokens: 0 },
        isAiSpeaking: false,
        isUserSpeaking: false,
      }));

      const images: { cup?: string; saucer?: string; palm?: string } = {};
      if (config.cupImageUri) images.cup = (await compressImage(config.cupImageUri)).base64;
      if (config.saucerImageUri) images.saucer = (await compressImage(config.saucerImageUri)).base64;
      if (config.palmImageUri) images.palm = (await compressImage(config.palmImageUri)).base64;
      imagesRef.current = images;

      const [pendingInputDebt, rejectedUploadCount] = await Promise.all([
        consumePendingInputTokens().catch(() => 0),
        consumeRejectedUploadAttempts().catch(() => 0),
      ]);
      setState((s) => ({
        ...s,
        status: 'active',
        tokenUsage: {
          inputTokens: pendingInputDebt,
          outputTokens: 0,
        },
      }));

      const seed: ChatMessage = {
        id: `seed-${Date.now()}`,
        role: 'user',
        text: buildSeedMessage(config, rejectedUploadCount),
        timestamp: Date.now(),
      };
      await askAgent([seed]);
    },
    [askAgent, buildSeedMessage],
  );

  const sendUserTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current === 'ended') return;
      setUserSpeakingActive(true);
      const userMsg = addMessage('user', trimmed);
      const next = [...messagesRef.current, userMsg];
      try {
        if (looksLikeQuestion(trimmed)) {
          await appendUserConversationMemory(configRef.current?.profileId || '', trimmed).catch(() => {});
        }
        await askAgent(next);
      } finally {
        setUserSpeakingActive(false);
      }
    },
    [addMessage, askAgent, setUserSpeakingActive],
  );

  const updateSessionImage = useCallback(async (slot: 'cup' | 'saucer' | 'palm', uri: string) => {
    if (!uri) return;
    const compressed = await compressImage(uri);
    imagesRef.current = {
      ...imagesRef.current,
      [slot]: compressed.base64,
    };
  }, []);

  const endSession = useCallback(async () => {
    if (userSpeakingTimeoutRef.current) {
      clearTimeout(userSpeakingTimeoutRef.current);
      userSpeakingTimeoutRef.current = null;
    }
    setState((s) => ({
      ...s,
      status: 'ended',
      isAiSpeaking: false,
      isUserSpeaking: false,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      messages: [],
    }));
  }, []);

  const resetSession = useCallback(() => {
    setState({
      status: 'idle',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      messages: [],
      isAiSpeaking: false,
      isUserSpeaking: false,
    });
  }, []);

  return {
    state,
    startSession,
    endSession,
    resetSession,
    sendUserTranscript,
    updateSessionImage,
    setUserSpeakingActive,
  };
}
