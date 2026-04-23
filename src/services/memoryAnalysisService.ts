import { AGENT_API_URL } from '../config/constants';
import type { ProfileMemorySnippet } from '../types/memory';

export interface MemoryAnalysisTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
}

export interface MemoryAnalysisItem {
  key: string;
  label: string;
  relationship?: string;
  salience?: number;
  confidence?: number;
}

export interface MemoryAnalysisResult {
  userStated: {
    recurringTopics: MemoryAnalysisItem[];
    importantPeople: MemoryAnalysisItem[];
    emotionalPatterns: MemoryAnalysisItem[];
  };
  readingDerived: {
    recurringTopics: MemoryAnalysisItem[];
    importantPeople: MemoryAnalysisItem[];
    emotionalPatterns: MemoryAnalysisItem[];
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface MemoryAnalysisRequest {
  profileName: string;
  profileId: string;
  readingType: 'coffee' | 'palm';
  memorySnippet?: ProfileMemorySnippet | null;
  transcript: MemoryAnalysisTranscriptEntry[];
}

export async function analyzeMemoryTranscript(body: MemoryAnalysisRequest): Promise<MemoryAnalysisResult> {
  const response = await fetch(`${AGENT_API_URL}/memory-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<MemoryAnalysisResult> & {
    userMessage?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.userMessage || data.error || 'Hafıza analizi tamamlanamadı.');
  }

  return {
    userStated: {
      recurringTopics: data.userStated?.recurringTopics || [],
      importantPeople: data.userStated?.importantPeople || [],
      emotionalPatterns: data.userStated?.emotionalPatterns || [],
    },
    readingDerived: {
      recurringTopics: data.readingDerived?.recurringTopics || [],
      importantPeople: data.readingDerived?.importantPeople || [],
      emotionalPatterns: data.readingDerived?.emotionalPatterns || [],
    },
    usage: {
      inputTokens: Number(data.usage?.inputTokens || 0),
      outputTokens: Number(data.usage?.outputTokens || 0),
      totalTokens: Number(data.usage?.totalTokens || 0),
    },
  };
}
