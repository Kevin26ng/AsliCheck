import { getMockAnalysis, getMockChatResponse, MOCK_FEED_ARTICLES } from './mockData';
import { TRENDING_NEWS } from '../constants';

const API_BASE = '/api';
const FEED_TIMEOUT_MS = 8000;     // feed loads fast (heuristic)
const ANALYSIS_TIMEOUT_MS = 120000; // Ollama single-claim: ~17-30s
const CHAT_TIMEOUT_MS = 120000;     // Ollama chat: ~17-30s

/** Race a fetch against a timeout. Rejects on timeout. */
function fetchWithTimeout(input: RequestInfo, init?: RequestInit, timeoutMs = FEED_TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(input, init),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('API timeout')), timeoutMs),
    ),
  ]);
}

export async function fetchNews(category: string = 'all') {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/news?category=${encodeURIComponent(category)}`,
    );
    if (!res.ok) throw new Error('Failed to fetch news');
    return res.json() as Promise<{
      articles: any[];
      trending: any[];
      fetchedAt: number;
    }>;
  } catch {
    // Fallback: return mock feed data
    return {
      articles: MOCK_FEED_ARTICLES,
      trending: TRENDING_NEWS,
      fetchedAt: Date.now(),
    };
  }
}

export async function analyzeClaim(claim: string) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
    }, ANALYSIS_TIMEOUT_MS);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
      throw new Error(err.error || 'Analysis failed');
    }
    return res.json();
  } catch {
    // Fallback: return mock analysis
    return getMockAnalysis(claim);
  }
}

export async function chat(
  message: string,
  history: { role: string; content: string }[],
) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    }, CHAT_TIMEOUT_MS);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Chat failed' }));
      throw new Error(err.error || 'Chat failed');
    }
    return res.json() as Promise<{ content: string; analysis: any }>;
  } catch {
    // Fallback: return mock chat response
    return getMockChatResponse(message);
  }
}
