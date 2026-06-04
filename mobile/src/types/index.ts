// ============================================================
// FALCI - Type Definitions
// ============================================================

export interface SessionConfig {
  /** Reading type */
  readingType: 'coffee' | 'palm';
  /** Coffee reading mode */
  coffeeMode?: 'upload' | 'ai-brew';
  /** Cup image URI (local file) */
  cupImageUri: string | null;
  /** Second cup image URI (local file) */
  secondCupImageUri?: string | null;
  /** Saucer image URI (local file) */
  saucerImageUri: string | null;
  /** Palm image URI (local file) */
  palmImageUri?: string | null;
  /** Selected subject profile */
  profileId: string;
  /** Selected subject display name */
  profileName: string;
  /** Whether selected profile is the account owner's self profile */
  profileIsSelf: boolean;
  /** Optional topic/question the user wants this reading to focus on */
  focusQuestion?: string | null;
  /** Profile memory snippet for this turn */
  memorySnippet?: import('./memory').ProfileMemorySnippet | null;
  /** Dev controls */
  devSettings: DevSettings;
}

export interface DevSettings {
  /** Selected assistant persona id */
  assistantId: string;
  /** Gemini temperature (0.0 - 2.0) */
  temperature: number;
  /** Gemini thinking budget (0 = off, max 8192) */
  thinkingBudget: number;
  /** TTS voice instructions (natural language prompt for voice style) */
  ttsInstructions: string;
  /** TTS voice name */
  ttsVoiceName: string;
  /** Gemini system prompt for persona */
  systemPrompt: string;
  /** Input token price in USD per 1M tokens */
  inputPrice: number;
  /** Output token price in USD per 1M tokens */
  outputPrice: number;
}

export interface TokenUsageData {
  /** Cumulative input tokens this session */
  inputTokens: number;
  /** Cumulative output tokens this session */
  outputTokens: number;
  /** Estimated image input tokens this session */
  imageInputTokens?: number;
  /** Text input tokens this session */
  textInputTokens?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface SessionState {
  status: 'idle' | 'connecting' | 'active' | 'winding_down' | 'ended';
  tokenUsage: TokenUsageData;
  messages: ChatMessage[];
  isAiSpeaking: boolean;
  isUserSpeaking: boolean;
}
