import { getMockAnalysis, getMockChatResponse, MOCK_FEED_ARTICLES } from './mockData';
import { TRENDING_NEWS } from '../constants';

const API_BASE = '/api';
const FEED_TIMEOUT_MS = 8000;     // feed loads fast (heuristic)
const ANALYSIS_TIMEOUT_MS = 30000; // Mistral: ~2-5s
const CHAT_TIMEOUT_MS = 30000;     // Mistral: ~2-5s

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

export interface BotAnalysisResult {
  bot_probability: number;
  verdict: 'likely_bot' | 'suspicious' | 'likely_human';
  confidence: number;
  text_features: {
    vocabulary_diversity: number;
    avg_sentence_length: number;
    emoji_ratio: number;
    caps_ratio: number;
    has_repeated_phrases: boolean;
    sensational_word_count: number;
  };
  meta_signals: string[];
  explanation: string;
  red_flags: string[];
  mode: 'ai' | 'heuristic';
}

export interface CommentAnalysisResult {
  overall_authenticity: 'likely_authentic' | 'suspicious' | 'coordinated_inauthentic';
  semantic_consistency_score: number | null;
  coordinated_behavior: boolean;
  duplication_rate: number;
  bot_comment_indices: number[];
  summary: string;
  red_flags: string[];
  total_comments_analyzed: number;
  mode: 'ai' | 'heuristic';
}

export async function analyzeBot(
  text: string,
  metadata?: {
    account_age_days?: number;
    posts_per_day?: number;
    follower_ratio?: number;
    reply_latency_sec?: number;
    duplicate_comment_ratio?: number;
  },
): Promise<BotAnalysisResult> {
  const res = await fetchWithTimeout(`${API_BASE}/analyze/bot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, metadata }),
  }, ANALYSIS_TIMEOUT_MS);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Bot analysis failed' }));
    throw new Error(err.error || 'Bot analysis failed');
  }
  return res.json();
}

export async function analyzeComments(
  post: string,
  comments: string[],
): Promise<CommentAnalysisResult> {
  const res = await fetchWithTimeout(`${API_BASE}/analyze/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post, comments }),
  }, ANALYSIS_TIMEOUT_MS);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Comment analysis failed' }));
    throw new Error(err.error || 'Comment analysis failed');
  }
  return res.json();
}
