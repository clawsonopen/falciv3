import { useState, useCallback, useRef, useEffect } from 'react';
import type { SessionConfig, SessionState, ChatMessage } from '../types';
import { compressImage } from '../services/imageService';
import { getFortuneReply, type FortuneMessage } from '../services/fortuneApiService';
import { appendUserConversationMemory, loadAccountState, loadProfileMemorySnippet } from '../services/profileMemoryService';
import {
  addPendingInputTokens,
  addPersonalTokenUsage,
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

const GEMINI_IMAGE_TOKENS_768 = 258;

function readingNameForConfig(config: SessionConfig) {
  if (config.readingType === 'palm') return 'El Falı';
  return config.coffeeMode === 'ai-brew' ? 'Kahve Falı - Benim Yerime İç' : 'Kahve Falı';
}

function estimateImageInputTokens(config: SessionConfig, images: { cup?: string; saucer?: string; palm?: string }, isFollowUp: boolean) {
  if (isFollowUp) return 0;
  if (config.readingType === 'palm') return images.palm ? GEMINI_IMAGE_TOKENS_768 * 2 : 0;
  if (config.coffeeMode !== 'upload') return 0;
  const imageCount = [images.cup, images.saucer].filter(Boolean).length;
  return imageCount * GEMINI_IMAGE_TOKENS_768 * 2;
}

function normalizedWords(text: string): string[] {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function stripAssistantEchoFromUserText(text: string, messages: ChatMessage[]): string {
  const originalWords = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const userWords = normalizedWords(text);
  if (userWords.length < 12) return text.trim();

  const assistantJoined = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => normalizedWords(message.text).join(' '))
    .filter((stream) => stream.length > 0);

  let removablePrefixLength = 0;
  const maxCheck = Math.min(userWords.length, 180);
  for (const assistantText of assistantJoined) {
    for (let length = maxCheck; length >= 12; length -= 1) {
      const prefix = userWords.slice(0, length).join(' ');
      if (assistantText.includes(prefix)) {
        removablePrefixLength = Math.max(removablePrefixLength, length);
        break;
      }
    }
  }

  if (removablePrefixLength < 12) return text.trim();
  const cleaned = originalWords.slice(removablePrefixLength).join(' ').trim();
  return cleaned || text.trim();
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    status: 'idle',
    tokenUsage: { inputTokens: 0, outputTokens: 0, imageInputTokens: 0, textInputTokens: 0 },
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
    async (nextMessages: ChatMessage[], options?: { isFollowUp?: boolean }) => {
      const config = configRef.current;
      if (!config) return;

      setState((s) => ({ ...s, isAiSpeaking: true }));
      try {
        const semanticQuery = options?.isFollowUp
          ? [...nextMessages].reverse().find((message) => message.role === 'user')?.text
          : undefined;
        const semanticMemorySnippet = semanticQuery
          ? await loadAccountState()
              .then((accountState) =>
                loadProfileMemorySnippet(accountState, config.profileId, { semanticQuery }),
              )
              .catch(() => config.memorySnippet)
          : config.memorySnippet;
        const text = await getFortuneReply({
          sessionId: sessionIdRef.current,
          devSettings: config.devSettings,
          profileId: config.profileId,
          profileName: config.profileName,
          profileIsSelf: config.profileIsSelf,
          readingType: config.readingType,
          coffeeMode: config.coffeeMode,
          memorySnippet: semanticMemorySnippet,
          messages: toFortuneMessages(nextMessages),
          isFollowUp: Boolean(options?.isFollowUp),
          images: imagesRef.current,
        });
        addMessage('assistant', text.text);
        const imageInputTokens = Math.min(
          text.usage.inputTokens || 0,
          estimateImageInputTokens(config, imagesRef.current, Boolean(options?.isFollowUp)),
        );
        const textInputTokens = Math.max(0, (text.usage.inputTokens || 0) - imageInputTokens);
        setState((s) => ({
          ...s,
          tokenUsage: {
            inputTokens: s.tokenUsage.inputTokens + (text.usage.inputTokens || 0),
            outputTokens: s.tokenUsage.outputTokens + (text.usage.outputTokens || 0),
            imageInputTokens: (s.tokenUsage.imageInputTokens || 0) + imageInputTokens,
            textInputTokens: (s.tokenUsage.textInputTokens || 0) + textInputTokens,
          },
        }));
        await addPersonalTokenUsage({
          modelName: 'gemini-2.5-flash-lite',
          readingName: readingNameForConfig(config),
          imageInputTokens,
          textInputTokens,
          outputTokens: text.usage.outputTokens || 0,
        }).catch(() => {});
      } catch (err: any) {
        const pendingInput = Number(err?.tokenUsage?.totalTokens || err?.tokenUsage?.inputTokens || 0);
        const failedInputTokens = Number(err?.tokenUsage?.inputTokens || 0);
        const failedOutputTokens = Number(err?.tokenUsage?.outputTokens || 0);
        if (failedInputTokens || failedOutputTokens) {
          const imageInputTokens = Math.min(
            failedInputTokens,
            estimateImageInputTokens(config, imagesRef.current, Boolean(options?.isFollowUp)),
          );
          await addPersonalTokenUsage({
            modelName: 'gemini-2.5-flash-lite',
            readingName: `${readingNameForConfig(config)} - Hata/Validasyon`,
            imageInputTokens,
            textInputTokens: Math.max(0, failedInputTokens - imageInputTokens),
            outputTokens: failedOutputTokens,
          }).catch(() => {});
        }
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
        tokenUsage: { inputTokens: 0, outputTokens: 0, imageInputTokens: 0, textInputTokens: 0 },
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
          imageInputTokens: 0,
          textInputTokens: pendingInputDebt,
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
      const trimmed = stripAssistantEchoFromUserText(text, messagesRef.current);
      if (!trimmed || statusRef.current === 'ended') return;
      setUserSpeakingActive(true);
      const userMsg = addMessage('user', trimmed);
      const next = [...messagesRef.current, userMsg];
      try {
        if (looksLikeQuestion(trimmed)) {
          await appendUserConversationMemory(configRef.current?.profileId || '', trimmed).catch(() => {});
        }
        await askAgent(next, { isFollowUp: true });
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
      tokenUsage: { inputTokens: 0, outputTokens: 0, imageInputTokens: 0, textInputTokens: 0 },
      messages: [],
    }));
  }, []);

  const resetSession = useCallback(() => {
    setState({
      status: 'idle',
      tokenUsage: { inputTokens: 0, outputTokens: 0, imageInputTokens: 0, textInputTokens: 0 },
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
