import 'dotenv/config';
import express from 'express';
import Parser from 'rss-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());

type CustomItem = {
  'media:content'?: { $: { url: string } };
  'media:thumbnail'?: { $: { url: string } };
  enclosure?: { url: string; type?: string };
  'content:encoded'?: string;
};

const parser: Parser<Record<string, unknown>, CustomItem> = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: false }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: false }],
    ] as any,
  },
  timeout: 15000,
  headers: {
    'User-Agent': 'AsliCheck/1.0 (News Aggregator)',
  },
});

// Reddit needs direct fetch — rss-parser often fails on Reddit's Atom format
async function fetchRedditFeed(url: string): Promise<any[]> {
  const jsonUrl = url.replace(/\.rss$/, '.json');
  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'AsliCheck/1.0 (News Aggregator; compatible)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const data = await res.json();
  const posts = data?.data?.children || [];
  return posts
    .filter((p: any) => p.kind === 't3' && p.data)
    .slice(0, 8)
    .map((p: any) => {
      const d = p.data;
      return {
        title: d.title || 'Untitled',
        link: `https://www.reddit.com${d.permalink}`,
        pubDate: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
        contentSnippet: d.selftext?.slice(0, 300) || d.title || '',
        imageUrl: (d.url_overridden_by_dest && /\.(jpg|jpeg|png|gif|webp)/i.test(d.url_overridden_by_dest))
          ? d.url_overridden_by_dest
          : d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : undefined,
        score: d.score || 0,
        numComments: d.num_comments || 0,
        author: typeof d.author === 'string' && d.author !== '[deleted]' ? d.author : '',
      };
    });
}

// --- Mistral API config ---
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const mistralAvailable = !!MISTRAL_API_KEY;

if (mistralAvailable) {
  console.log(`Mistral API configured ✓ (model: ${MISTRAL_MODEL})`);
} else {
  console.log('MISTRAL_API_KEY not set — using heuristic verification mode');
}

type MistralMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function mistralChat(messages: MistralMessage[], timeoutMs = 30000): Promise<string> {
  if (!mistralAvailable) throw new Error('Mistral API key not configured');
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({ model: MISTRAL_MODEL, messages }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mistral error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractApiError(err: any): string {
  const msg = err?.message || '';
  if (msg.includes('not configured'))
    return 'AI is running in heuristic mode. Set MISTRAL_API_KEY in your .env file.';
  if (msg.includes('401'))
    return 'Invalid Mistral API key. Check your MISTRAL_API_KEY in .env.';
  if (msg.includes('429'))
    return 'Mistral rate limit reached. Please wait a moment and try again.';
  return msg || 'AI service error';
}

// --- Heuristic verification when Ollama is unavailable ---
// =====================  MULTI-SIGNAL CREDIBILITY SCORING  =====================
// All scores are deterministic (no Math.random). Each signal contributes a 0-100 value
// that represents a specific, independently-measurable dimension of credibility.

// Editorial credibility baseline per source — derived from known track records
const SOURCE_CREDIBILITY: Record<string, number> = {
  'BBC News': 90, 'BBC Politics': 90, 'BBC Health': 90, 'BBC Technology': 90, 'BBC Science': 90,
  'New York Times': 88, 'NY Times Politics': 88, 'NY Times Health': 88, 'NY Times Tech': 88, 'NY Times Science': 88,
  'Al Jazeera': 83,
  'NBC News': 80,
};

// Signal 1: Source credibility — who published it?
function computeSourceScore(source: string): number {
  for (const [key, val] of Object.entries(SOURCE_CREDIBILITY)) {
    if (source.includes(key)) return val;
  }
  if (source.toLowerCase().includes('reddit')) return 45; // community-sourced, not editorially vetted
  return 30; // unrecognised source — assume low credibility
}

// Signal 2: Text quality — does the writing show signs of manipulation?
function computeTextScore(title: string): number {
  if (!title) return 50;
  let score = 70; // neutral starting point
  const lower = title.toLowerCase();
  const words = title.split(/\s+/);

  const SENSATIONAL = [
    'shocking', 'unbelievable', "won't believe", 'bombshell', 'explosive',
    'exposed', 'conspiracy', 'secret', "don't want you to know", 'miracle', 'hoax',
  ];
  const hits = SENSATIONAL.filter(w => lower.includes(w)).length;
  score -= hits * 15; // each sensational word costs 15 points

  const capsWords = words.filter((w: string) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  score -= Math.min(capsWords * 8, 24); // excessive caps up to -24

  if (lower.endsWith('?')) score -= 10;                                  // question framing = clickbait signal
  if (words.length >= 6 && words.length <= 18) score += 8;               // well-sized, specific headline
  if (hits === 0 && capsWords === 0 && !lower.endsWith('?')) score += 7; // clean, professional writing

  return Math.max(0, Math.min(100, score));
}

// Signal 3: Engagement quality — is the audience reaction authentic?
// Only meaningful for Reddit posts where we have real numbers.
// News article likes/comments are randomly generated, so we return neutral for those.
function computeEngagementScore(article: any): number {
  if (article.postType !== 'social') return 65; // fake data → neutral
  const likes = article.likes || 0;
  const comments = article.comments || 0;
  if (likes === 0) return 40;
  const ratio = comments / likes;
  // Low comment-to-like ratio is a bot amplification pattern:
  // bots can mass-like content but rarely produce meaningful comments.
  if (ratio < 0.01) return 25;
  if (ratio < 0.03) return 40;
  if (ratio < 0.08) return 60;
  if (ratio < 0.20) return 75;
  return 85; // rich discussion = authentic audience engagement
}

// Signal 4: Posting time — bots and coordinated campaigns prefer off-hours
function computeTimingScore(rawDate: string): number {
  try {
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) return 65;
    const hour = date.getUTCHours();
    const ageHours = (Date.now() - date.getTime()) / 3_600_000;
    let score = 75;
    if (hour >= 2 && hour <= 5) score -= 12;  // 2–5 AM UTC: classic bot posting window
    if (ageHours < 0.5) score -= 12;           // brand new: no time for cross-verification
    if (ageHours > 48) score += 8;             // older content: corrections would exist if wrong
    return Math.max(0, Math.min(100, score));
  } catch {
    return 65;
  }
}

// Combine all 4 signals with weights → deterministic status + confidence
function multiSignalScore(article: any): {
  status: string;
  confidence: number;
  factCheck: string;
  signals: { source: number; text: number; engagement: number; timing: number };
} {
  const source     = computeSourceScore(article.source || '');
  const text       = computeTextScore(article.title || '');
  const engagement = computeEngagementScore(article);
  const timing     = computeTimingScore(article.rawDate || new Date().toISOString());

  // Weights: source + text dominate editorial judgment; engagement + timing are supporting signals
  const weighted = source * 0.40 + text * 0.30 + engagement * 0.20 + timing * 0.10;
  const confidence = Math.round(weighted);

  const issues: string[] = [];
  if (text < 45)       issues.push('sensationalist language');
  if (engagement < 40) issues.push('suspicious engagement ratio');
  if (source < 40)     issues.push('low source credibility');
  if (timing < 55)     issues.push('suspicious posting time');

  let status: string;
  let factCheck: string;

  if (confidence >= 74) {
    status = 'verified';
    factCheck = `Source credibility: ${source}%. Content quality: ${text}%. Multi-signal analysis indicates high reliability.${issues.length ? ` Note: ${issues.join('; ')}.` : ''}`;
  } else if (confidence >= 54) {
    status = 'unverified';
    factCheck = `Moderate credibility score (${confidence}%). ${issues.length ? `Concerns: ${issues.join('; ')}.` : 'Verify independently before sharing.'}`;
  } else if (confidence >= 36) {
    status = 'disputed';
    factCheck = `Multiple signals raise concerns (${confidence}% confidence). ${issues.length ? `Issues: ${issues.join('; ')}.` : 'Content quality and source credibility are uncertain.'}`;
  } else {
    status = 'misleading';
    factCheck = `Low multi-signal score (${confidence}%). ${issues.length ? `Red flags: ${issues.join('; ')}.` : 'Treat with extreme caution.'}`;
  }

  return { status, confidence, factCheck, signals: { source, text, engagement, timing } };
}

const RSS_FEEDS: Record<string, { url: string; source: string; type: string }[]> = {
  all: [
    { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC News', type: 'news' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', source: 'New York Times', type: 'news' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', type: 'news' },
    { url: 'https://feeds.nbcnews.com/nbcnews/public/news', source: 'NBC News', type: 'news' },
    { url: 'https://www.reddit.com/r/worldnews/.rss', source: 'Reddit r/worldnews', type: 'social' },
    { url: 'https://www.reddit.com/r/news/.rss', source: 'Reddit r/news', type: 'social' },
    { url: 'https://www.reddit.com/r/technology/.rss', source: 'Reddit r/technology', type: 'social' },
    { url: 'https://www.reddit.com/r/popular/.rss', source: 'Reddit r/popular', type: 'social' },
    { url: 'https://www.reddit.com/r/todayilearned/.rss', source: 'Reddit r/todayilearned', type: 'social' },
  ],
  politics: [
    { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', source: 'BBC Politics', type: 'news' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NY Times Politics', type: 'news' },
    { url: 'https://www.reddit.com/r/politics/.rss', source: 'Reddit r/politics', type: 'social' },
  ],
  health: [
    { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', source: 'BBC Health', type: 'news' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', source: 'NY Times Health', type: 'news' },
    { url: 'https://www.reddit.com/r/health/.rss', source: 'Reddit r/health', type: 'social' },
  ],
  tech: [
    { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Technology', type: 'news' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NY Times Tech', type: 'news' },
    { url: 'https://www.reddit.com/r/technology/.rss', source: 'Reddit r/technology', type: 'social' },
  ],
  science: [
    { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', type: 'news' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', source: 'NY Times Science', type: 'news' },
    { url: 'https://www.reddit.com/r/science/.rss', source: 'Reddit r/science', type: 'social' },
  ],
};

// --- Cache ---
interface CacheEntry {
  data: unknown;
  timestamp: number;
}
const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 15 * 60 * 1000;

// Velocity cache: stores engagement snapshots between poll cycles — never expires, only updates.
const velocityCache: Record<string, { score: number; comments: number; ts: number }> = {};

// Signal 5: Engagement velocity — how fast is the post growing between server polls?
// First call for a given article id seeds the cache and returns neutral (65).
// Subsequent polls (after CACHE_TTL elapses) compute real delta-per-hour.
function computeVelocitySignal(article: any): number {
  const id = String(article.id);
  const now = Date.now();
  const cur = { score: article.likes || 0, comments: article.comments || 0, ts: now };
  const prev = velocityCache[id];
  if (!prev) { velocityCache[id] = cur; return 65; }
  const elapsedHours = (now - prev.ts) / 3_600_000;
  if (elapsedHours < 0.1) return 65; // too soon to measure
  const scoreDelta   = (cur.score    - prev.score)    / elapsedHours;
  const commentDelta = (cur.comments - prev.comments) / elapsedHours;
  velocityCache[id] = cur;
  if (scoreDelta < 0)      return 35; // losing score = brigaded / controversial
  if (scoreDelta > 20000)  return 38; // extreme spike = potential coordinated push
  if (scoreDelta > 5000)   return 52; // high virality — organic or coordinated
  if (commentDelta > 500)  return 48; // comment flood = possible brigading
  return 72; // steady, normal growth
}

// Signal 6: Reddit comment thread quality (async, per-post background fetch).
// Measures duplicate rate, deleted-account fraction, and average comment depth.
async function fetchCommentSignal(sourceUrl: string): Promise<number> {
  try {
    const jsonUrl = sourceUrl.replace(/\/$/, '').replace(/\.json$/, '') + '.json?limit=50&depth=1&sort=new';
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'AsliCheck/1.0 (fact-checking research tool)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return 60;
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length < 2) return 60;
    const allChildren: any[] = (data[1]?.data?.children || []).filter((c: any) => c.kind === 't1');
    const real = allChildren
      .map((c: any) => c.data)
      .filter((c: any) => c.body && c.body !== '[deleted]' && c.body !== '[removed]');
    if (real.length < 3) return 60;
    // Duplicate detection: compare normalised first-80-chars of each comment body
    const keys = real.map((c: any) =>
      (c.body as string).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80)
    );
    const dupRate = 1 - new Set(keys).size / keys.length;
    // Deleted / bot account ratio
    const deletedRate = allChildren.filter((c: any) =>
      c.data.author === '[deleted]' || c.data.author === 'AutoModerator'
    ).length / Math.max(allChildren.length, 1);
    // Average comment length — real discourse tends to be substantive
    const avgLen = real.reduce((s: number, c: any) => s + (c.body as string).length, 0) / real.length;
    let score = 78;
    if (dupRate > 0.30)         score -= 30;
    else if (dupRate > 0.15)    score -= 14;
    if (deletedRate > 0.40)     score -= 18;
    else if (deletedRate > 0.20) score -= 8;
    if (avgLen < 15)            score -= 12; // one-word replies = low discourse quality
    else if (avgLen > 120)      score += 8;  // substantive discussion
    return Math.max(10, Math.min(95, Math.round(score)));
  } catch {
    return 60;
  }
}

// Signal 7: Reddit author credibility (async, per-post background fetch).
// Uses Reddit public API: account age, combined karma, and suspension status.
async function fetchAuthorSignal(username: string): Promise<number> {
  if (!username || username.startsWith('[') || username === 'AutoModerator') return 40;
  try {
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {
        headers: { 'User-Agent': 'AsliCheck/1.0 (fact-checking research tool)' },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return 55;
    const json = await res.json() as any;
    const d = json?.data;
    if (!d) return 55;
    if (d.is_suspended) return 10;
    const ageMonths = (Date.now() / 1000 - (d.created_utc || 0)) / (30 * 24 * 3600);
    const karma = (d.link_karma || 0) + (d.comment_karma || 0);
    let score = 60;
    if (ageMonths < 1)       score -= 22; // brand-new = high bot probability
    else if (ageMonths < 3)  score -= 12;
    else if (ageMonths < 6)  score -= 5;
    else if (ageMonths > 24) score += 10;
    if (karma < 10)          score -= 18;
    else if (karma < 100)    score -= 8;
    else if (karma > 5000)   score += 8;
    else if (karma > 25000)  score += 14;
    return Math.max(5, Math.min(95, Math.round(score)));
  } catch {
    return 55;
  }
}

// Async enrichment pipeline: fetches comment + author signals for top Reddit posts.
// Chains after Phase 1 (heuristic or Mistral). Re-weights with full 7-signal formula.
async function enrichRedditPosts(articles: any[]): Promise<any[]> {
  const enriched = [...articles];
  // Only process Reddit posts where we have a real author username
  const targets = enriched
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.postType === 'social' && a.sourceUrl?.includes('/r/') && a.redditAuthor)
    .slice(0, 5); // cap at 5 to respect Reddit public API ~1 req/sec guideline
  for (const { a, idx } of targets) {
    try {
      const [commentScore, authorScore] = await Promise.all([
        fetchCommentSignal(a.sourceUrl),
        fetchAuthorSignal(a.redditAuthor),
      ]);
      const sig = ((enriched[idx].signals ?? {}) as Record<string, number>);
      const velocity = computeVelocitySignal(enriched[idx]);
      // 7-signal weighted formula — only applied to Reddit posts with full data
      const weighted =
        (sig.source     ?? 45) * 0.28 +
        (sig.text       ?? 70) * 0.22 +
        (sig.engagement ?? 65) * 0.13 +
        (sig.timing     ?? 65) * 0.08 +
        commentScore           * 0.14 +
        authorScore            * 0.10 +
        velocity               * 0.05;
      const confidence = Math.round(weighted);
      let status: string;
      if (confidence >= 74)      status = 'verified';
      else if (confidence >= 54) status = 'unverified';
      else if (confidence >= 36) status = 'disputed';
      else                       status = 'misleading';
      const issues: string[] = [];
      if (commentScore < 45) issues.push('suspicious comment patterns');
      if (authorScore  < 40) issues.push('low-credibility account');
      if (velocity     < 45) issues.push('abnormal engagement velocity');
      enriched[idx] = {
        ...enriched[idx],
        status,
        confidence,
        factCheck: issues.length
          ? `Reddit signals (${confidence}%): ${issues.join('; ')}.`
          : `Reddit signals (${confidence}%): comments ${commentScore}%, author ${authorScore}%, velocity normal.`,
        signals: { ...sig, velocity, comments_signal: commentScore, author: authorScore },
      };
    } catch { /* keep existing scores on error */ }
    // Respect Reddit public API rate limit
    await new Promise<void>((r) => setTimeout(r, 1200));
  }
  return enriched;
}

// --- Helpers ---
function extractImage(item: any): string | undefined {
  // Direct media fields
  if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url;
  if (item['media:content']?.$?.url) {
    const url = item['media:content'].$.url;
    // Some media:content are videos — skip those
    const type = item['media:content'].$?.type || '';
    if (!type.includes('video')) return url;
  }
  if (item.enclosure?.url) {
    const t = item.enclosure.type || '';
    if (t.startsWith('image') || !t) return item.enclosure.url;
  }
  // Parse HTML content for images
  const html: string = item.content || item['content:encoded'] || item.summary || '';
  // Get all img src matches and pick the largest-looking one
  const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    const src = m[1];
    // Skip tiny tracking pixels and Reddit emoji images
    if (src.includes('pixel') || src.includes('1x1') || src.includes('emoji')) continue;
    return src;
  }
  // Reddit-specific: look for preview images in links
  const linkMatch = html.match(/href=["'](https:\/\/(?:i\.redd\.it|preview\.redd\.it|i\.imgur\.com)\/[^"']+)["']/);
  if (linkMatch) return linkMatch[1];
  return undefined;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Ollama batch analysis ---

function sanitizeJson(raw: string): string {
  // Fix common LLM JSON issues
  let s = raw;
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Fix unescaped newlines inside strings
  s = s.replace(/(?<=":.*)"([^"]*)\n([^"]*)"(?=\s*[,}\]])/g, '"$1 $2"');
  // Remove control characters
  s = s.replace(/[\x00-\x1f\x7f]/g, (ch) => ch === '\n' || ch === '\t' ? ' ' : '');
  return s;
}

function tryParseJsonArray(text: string): any[] | null {
  // Try to extract and parse a JSON array from LLM output
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  // Attempt 1: direct parse
  try { return JSON.parse(jsonMatch[0]); } catch {}

  // Attempt 2: sanitized parse
  try { return JSON.parse(sanitizeJson(jsonMatch[0])); } catch {}

  // Attempt 3: parse objects individually
  try {
    const objectMatches = [...jsonMatch[0].matchAll(/\{[^{}]*\}/g)];
    const results: any[] = [];
    for (const m of objectMatches) {
      try {
        results.push(JSON.parse(sanitizeJson(m[0])));
      } catch { /* skip bad object */ }
    }
    if (results.length > 0) return results;
  } catch {}

  return null;
}

async function analyzeNewsBatch(articles: any[]): Promise<any[]> {
  if (articles.length === 0) return articles;

  // Mistral is fast (~2-4s per chunk of 3). Run sequentially to stay within rate limits.
  const MAX_AI_ARTICLES = 9;  // 3 sequential chunks of 3
  const CHUNK_SIZE = 3;
  const CHUNK_TIMEOUT = 30000; // 30s per chunk
  const toAnalyze = articles.slice(0, MAX_AI_ARTICLES);
  const allResults: any[] = [...articles];

  for (let start = 0; start < toAnalyze.length; start += CHUNK_SIZE) {
    const items = toAnalyze.slice(start, start + CHUNK_SIZE);
    const headlines = items
      .map((a, i) => `${i + 1}. "${a.title}" — Source: ${a.source}`)
      .join('\n');

    try {
      const text = await mistralChat([
        { role: 'system', content: 'You are a fact-checking AI. Respond ONLY with a valid JSON array, no markdown, no explanation.' },
        { role: 'user', content: `Analyze these ${items.length} news headlines for factual accuracy. For EACH respond with: index, status (verified/unverified/disputed/misleading), content_score (0-100, your semantic credibility assessment of the headline itself), factCheck (1 sentence explaining the verdict).\n\n${headlines}\n\nJSON array only:\n[{"index":1,"status":"verified","content_score":85,"factCheck":"Reason."}]` },
      ], CHUNK_TIMEOUT);
      const analysis = tryParseJsonArray(text);
      if (analysis) {
        for (let i = 0; i < items.length; i++) {
          const a = analysis.find((x: any) => x.index === i + 1);
          if (a) {
            const idx = start + i;
            const existing = allResults[idx];
            const signals = existing.signals as { source: number; text: number; engagement: number; timing: number };
            // Blend Mistral's semantic judgment with heuristic signals.
            // content_score (semantic) replaces the text signal weight since it is a superset.
            const contentScore = typeof a.content_score === 'number'
              ? Math.min(100, Math.max(0, a.content_score))
              : null;
            const blendedConfidence = contentScore !== null
              ? Math.round(signals.source * 0.35 + contentScore * 0.35 + signals.engagement * 0.20 + signals.timing * 0.10)
              : existing.confidence;
            allResults[idx] = {
              ...existing,
              status: ['verified', 'unverified', 'disputed', 'misleading'].includes(a.status) ? a.status : existing.status,
              confidence: blendedConfidence,
              factCheck: typeof a.factCheck === 'string' ? a.factCheck.slice(0, 300) : existing.factCheck,
              signals: contentScore !== null ? { ...signals, content: contentScore } : signals,
            };
          }
        }
        console.log(`Mistral chunk (${start}-${start + items.length}) OK`);
      }
    } catch (err: any) {
      console.error(`Mistral chunk (${start}-${start + items.length}) failed:`, err.message);
      break;
    }
  }

  // Fill any articles that didn't get AI analysis with multi-signal scoring + velocity
  return allResults.map((a) => {
    if (!a.status || a.status === undefined) {
      const scored = multiSignalScore(a);
      const velocity = computeVelocitySignal(a);
      return { ...a, ...scored, signals: { ...scored.signals, velocity } };
    }
    return a;
  });
}

// --- Fetch + analyse news ---
async function fetchAndAnalyzeNews(category: string) {
  const cacheKey = `news_${category}`;
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.timestamp < CACHE_TTL) return hit.data;

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.all;
  const allArticles: any[] = [];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const isReddit = feed.url.includes('reddit.com');

      if (isReddit) {
        // Use direct JSON API for Reddit
        const items = await fetchRedditFeed(feed.url);
        return items.map((item, idx) => {
          const rawImg = item.imageUrl;
          return {
            id: `${feed.source.replace(/\s/g, '-').toLowerCase()}-${idx}-${Date.now()}`,
            title: item.title,
            content: item.contentSnippet?.replace(/\s+/g, ' ').trim().slice(0, 300) || '',
            author: `@${feed.source.replace(/\s/g, '')}`,
            timestamp: item.pubDate ? timeAgo(item.pubDate) : 'Recently',
            rawDate: item.pubDate || new Date().toISOString(),
            imageUrl: rawImg ? `/api/img?url=${encodeURIComponent(rawImg)}` : undefined,
            sourceUrl: item.link || '',
            sourceDomain: 'reddit.com',
            source: feed.source,
            postType: 'social' as const,
            redditAuthor: item.author || '',
            likes: item.score || Math.floor(Math.random() * 15000) + 200,
            comments: item.numComments || Math.floor(Math.random() * 800) + 20,
            shares: Math.floor(Math.random() * 3000) + 50,
            isAiGenerated: false,
          };
        });
      }

      // Standard RSS for news feeds
      const result = await parser.parseURL(feed.url);
      return result.items.slice(0, 8).map((item, idx) => {
        const rawImg = extractImage(item);
        return {
          id: `${feed.source.replace(/\s/g, '-').toLowerCase()}-${idx}-${Date.now()}`,
          title: item.title || 'Untitled',
          content:
            item.contentSnippet?.replace(/\s+/g, ' ').trim().slice(0, 300) ||
            item.content?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) ||
            '',
          author: `@${feed.source.replace(/\s/g, '')}`,
          timestamp: item.pubDate ? timeAgo(item.pubDate) : 'Recently',
          rawDate: item.pubDate || new Date().toISOString(),
          imageUrl: rawImg ? `/api/img?url=${encodeURIComponent(rawImg)}` : undefined,
          sourceUrl: item.link || '',
          sourceDomain: item.link ? getDomain(item.link) : '',
          source: feed.source,
          postType: 'news' as const,
          likes: Math.floor(Math.random() * 5000) + 100,
          comments: Math.floor(Math.random() * 200) + 10,
          shares: Math.floor(Math.random() * 3000) + 50,
          isAiGenerated: false,
        };
      });
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allArticles.push(...r.value);
    } else {
      console.warn('Feed fetch failed:', r.reason?.message || r.reason);
    }
  }

  if (allArticles.length === 0) {
    return { articles: [], trending: [], fetchedAt: Date.now() };
  }

  // Sort newest first
  allArticles.sort(
    (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
  );

  // Ensure a mix of news and social — at least 5 social posts if available
  const newsArticles = allArticles.filter(a => a.postType === 'news');
  const socialArticles = allArticles.filter(a => a.postType === 'social');
  const socialCount = Math.min(socialArticles.length, Math.max(5, Math.floor(allArticles.length * 0.3)));
  const newsCount = 20 - socialCount;
  const top = [...newsArticles.slice(0, newsCount), ...socialArticles.slice(0, socialCount)]
    .sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime())
    .slice(0, 25); // slightly more to give variety

  // INSTANT: multi-signal analysis + velocity seed (velocity first-call initialises snapshot)
  const analyzed = top.map((article) => {
    const scored = multiSignalScore(article);
    const velocity = computeVelocitySignal(article);
    return { ...article, ...scored, signals: { ...scored.signals, velocity } };
  });

  // Shuffle to mix verified/unverified/disputed naturally
  for (let i = analyzed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [analyzed[i], analyzed[j]] = [analyzed[j], analyzed[i]];
  }

  const buildPayload = (articles: any[]) => {
    const trending = articles.slice(0, 6).map((a: any, i: number) => ({
      id: String(i + 1),
      category: a.source.toUpperCase(),
      title: a.title,
      count:
        a.status === 'disputed' || a.status === 'misleading'
          ? `${Math.floor(Math.random() * 900 + 100)} Flags`
          : `${(Math.random() * 12 + 1).toFixed(1)}k Verifications`,
      type:
        a.status === 'disputed' || a.status === 'misleading'
          ? 'flag'
          : ('verification' as const),
    }));
    return { articles, trending, fetchedAt: Date.now() };
  };

  const payload = buildPayload(analyzed);
  cache[cacheKey] = { data: payload, timestamp: Date.now() };

  // BACKGROUND: Phase 1 (Mistral AI) → Phase 2 (Reddit enrichment), chained, non-blocking.
  const aiCacheKey = `ai_${category}`;
  const aiHit = cache[aiCacheKey];
  if (!aiHit || Date.now() - aiHit.timestamp > CACHE_TTL) {
    const shuffle = <T>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    // Phase 1: Mistral semantic analysis (if key is set), else fall through with heuristic
    const phase1: Promise<any[]> = mistralAvailable
      ? analyzeNewsBatch(top).then((aiAnalyzed) => {
          cache[cacheKey] = { data: buildPayload(shuffle(aiAnalyzed)), timestamp: Date.now() };
          cache[aiCacheKey] = { data: true, timestamp: Date.now() };
          console.log(`Mistral analysis complete for "${category}" — cache updated`);
          return aiAnalyzed;
        }).catch((err) => {
          console.error(`Background Mistral failed for "${category}":`, err.message);
          return analyzed;
        })
      : Promise.resolve(analyzed);
    // Phase 2: Reddit comment + author enrichment chains after Phase 1
    phase1
      .then((base) => enrichRedditPosts(base))
      .then((enriched) => {
        cache[cacheKey] = { data: buildPayload(shuffle(enriched)), timestamp: Date.now() };
        console.log(`Reddit enrichment complete for "${category}" — cache updated`);
      })
      .catch((err) => {
        console.error(`Reddit enrichment failed for "${category}":`, err.message);
      });
  }

  return payload;
}

// =====================  ROUTES  =====================

const VALID_CATEGORIES = ['all', 'politics', 'health', 'tech', 'science'];

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'AsliCheck API',
    mode: mistralAvailable ? 'ai' : 'heuristic',
    model: mistralAvailable ? MISTRAL_MODEL : null,
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const raw = String(req.query.category || 'all');
    const category = VALID_CATEGORIES.includes(raw) ? raw : 'all';
    const data = await fetchAndAnalyzeNews(category);
    res.json(data);
  } catch (err: any) {
    console.error('GET /api/news error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news', articles: [], trending: [] });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { claim } = req.body;
    if (!claim || typeof claim !== 'string')
      return res.status(400).json({ error: 'A claim string is required' });
    if (claim.length > 5000)
      return res.status(400).json({ error: 'Claim too long (max 5000 chars)' });

    if (mistralAvailable) {
      const text = await mistralChat([
        { role: 'system', content: 'You are a fact-checking AI. Respond ONLY with a valid JSON object, no markdown, no explanation.' },
        { role: 'user', content: `Analyze this claim for factual accuracy:\n\n"${claim}"\n\nRespond with ONLY a JSON object:\n{"status":"verified|unverified|disputed|misleading","confidence":<0-100>,"summary":"<2-3 sentences>","discrepancies":["<issue>"],"sources":[{"name":"<SOURCE>","title":"<title>","url":"#"}]}` },
      ], 30000);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return res.json(JSON.parse(sanitizeJson(jsonMatch[0])));
      res.status(500).json({ error: 'Could not parse AI response' });
    } else {
      const lower = claim.toLowerCase();
      const sensational = ['cure', 'miracle', "they don't want", 'conspiracy', 'secret', 'exposed', 'shocking', "you won't believe"];
      const questionable = sensational.some(w => lower.includes(w));
      const isQuestion = claim.trim().endsWith('?');

      let status = 'unverified';
      let confidence = 40 + Math.floor(Math.random() * 20);
      let summary = 'This claim could not be verified automatically. Using heuristic pattern analysis.';
      const discrepancies: string[] = [];

      if (questionable) {
        status = 'disputed';
        confidence = 55 + Math.floor(Math.random() * 20);
        summary = 'This claim contains language commonly associated with misinformation. Multiple red flags detected.';
        discrepancies.push('Sensationalist language detected', 'No credible source attribution');
      } else if (isQuestion) {
        summary = 'Claims framed as questions often lack verifiable substance. Look for direct evidence-backed assertions.';
        discrepancies.push('Framed as a question rather than a factual claim');
      }

      res.json({ status, confidence, summary, discrepancies, sources: [{ name: 'AsliCheck Heuristic', title: 'Pattern analysis', url: '#' }], mode: 'heuristic' });
    }
  } catch (err: any) {
    console.error('POST /api/analyze error:', err.message);
    res.status(500).json({ error: extractApiError(err) });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'Message is required' });
    if (message.length > 5000)
      return res.status(400).json({ error: 'Message too long' });

    if (mistralAvailable) {
      const messages: MistralMessage[] = [
        {
          role: 'system',
          content: 'You are AsliCheck Assistant — an AI fact-checking assistant. Help users verify claims, identify bots, analyze comment authenticity, and understand media literacy. Be concise and direct. When fact-checking a specific claim, end your response with exactly: <!--ANALYSIS:{"tag":"Verified","details":"explanation"}--> where tag is one of: Verified, Unverified, Disputed, Misleading. Only include this annotation when analyzing a specific factual claim.',
        },
      ];
      if (Array.isArray(history)) {
        for (const m of history.slice(-10)) {
          if (m.role === 'user' || m.role === 'assistant') {
            messages.push({ role: m.role, content: String(m.content).slice(0, 2000) });
          }
        }
      }
      messages.push({ role: 'user', content: message });

      const text = await mistralChat(messages, 30000);
      const analysisMatch = text.match(/<!--ANALYSIS:([\s\S]*?)-->/);
      let analysis = null;
      const content = text.replace(/<!--ANALYSIS:[\s\S]*?-->/g, '').trim();
      if (analysisMatch) {
        try { analysis = JSON.parse(analysisMatch[1]); } catch { /* ignore */ }
      }
      res.json({ content, analysis });
    } else {
      // Heuristic chat responses (no API key configured)
      const lower = message.toLowerCase();
      let content = '';
      let analysis = null;

      if (lower.includes('verify') || lower.includes('fact check') || lower.includes('is it true') || lower.includes('real or fake')) {
        content = `I'm currently running in heuristic mode (no API key configured). Here's what I can tell you:\n\nTo verify any claim, I recommend:\n1. Check multiple credible sources (Reuters, AP, BBC)\n2. Look for the original source of the claim\n3. Check if experts in the relevant field have commented\n4. Be skeptical of sensationalist language\n5. Verify images using reverse image search\n\nFor full AI-powered analysis, set MISTRAL_API_KEY in your .env file.`;
        analysis = { tag: 'Unverified', details: 'Heuristic mode — set MISTRAL_API_KEY for deep analysis.' };
      } else if (lower.includes('how') || lower.includes('what') || lower.includes('explain')) {
        content = `Great question! AsliCheck helps you navigate the information landscape by:\n\n• **Checking source credibility** — We score sources based on editorial standards and track record\n• **Detecting patterns** — Sensationalist language, clickbait, and emotional manipulation are flagged\n• **Bot detection** — Comments and replies are analyzed for automated/inauthentic authorship\n• **Comment authenticity** — Coordinated inauthentic behavior is flagged across comment threads\n\nThe goal isn't to tell you what to think — it's to make sure you have the full picture before you amplify something.`;
      } else {
        content = `I'm AsliCheck Assistant, running in heuristic mode. I can help you understand media literacy, evaluate sources, and think critically about claims.\n\nTry asking me to verify a specific claim, or ask about how misinformation spreads!`;
      }

      res.json({ content, analysis });
    }
  } catch (err: any) {
    console.error('POST /api/chat error:', err.message);
    res.status(500).json({ error: extractApiError(err) });
  }
});

// --- Bot detection ---
// Takes post text + optional account metadata, returns bot probability.
// Concept: combines fast heuristic feature extraction (always runs) with
// Mistral semantic analysis (runs when API key is configured).
app.post('/api/analyze/bot', async (req, res) => {
  try {
    const { text, metadata } = req.body;
    if (!text || typeof text !== 'string')
      return res.status(400).json({ error: 'text is required' });
    if (text.length > 5000)
      return res.status(400).json({ error: 'Text too long (max 5000 chars)' });

    // --- Heuristic text features (fast, no LLM) ---
    const words = text.split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
    const vocabularyDiversity = words.length > 0 ? uniqueWords.size / words.length : 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLen = sentences.reduce((s, x) => s + x.split(/\s+/).filter(Boolean).length, 0) / Math.max(sentences.length, 1);
    const emojiCount = (text.match(/[\u{1F300}-\u{1FFFF}]/gu) || []).length;
    const emojiRatio = words.length > 0 ? emojiCount / words.length : 0;
    const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
    const capsRatio = words.length > 0 ? capsWords / words.length : 0;
    const hasRepeatedPhrases = /(\b\w+(?:\s+\w+){2,}\b).*\1/i.test(text);
    const sensationalWords = ['shocking', 'unbelievable', 'you won\'t believe', 'breaking', 'bombshell', 'exposed', 'conspiracy', 'secret', 'miracle', 'they don\'t want'];
    const sensationalCount = sensationalWords.filter(w => text.toLowerCase().includes(w)).length;

    // Build heuristic score (0 = human-like, 1 = bot-like)
    let heuristicScore = 0;
    if (vocabularyDiversity < 0.3) heuristicScore += 0.25;
    if (avgSentenceLen < 5) heuristicScore += 0.15;
    if (emojiRatio > 0.3) heuristicScore += 0.10;
    if (capsRatio > 0.2) heuristicScore += 0.15;
    if (hasRepeatedPhrases) heuristicScore += 0.20;
    if (sensationalCount > 1) heuristicScore += 0.15;

    // Account metadata signals (provided by client from social API)
    const meta = metadata || {};
    const metaSignals: string[] = [];
    if (typeof meta.account_age_days === 'number' && meta.account_age_days < 30)
      metaSignals.push('New account (< 30 days old)');
    if (typeof meta.posts_per_day === 'number' && meta.posts_per_day > 20)
      metaSignals.push(`Unusually high posting rate (${meta.posts_per_day.toFixed(1)} posts/day)`);
    if (typeof meta.follower_ratio === 'number' && meta.follower_ratio < 0.05)
      metaSignals.push('Very low follower/following ratio');
    if (typeof meta.reply_latency_sec === 'number' && meta.reply_latency_sec < 5)
      metaSignals.push(`Near-instant reply latency (${meta.reply_latency_sec}s)`);
    if (typeof meta.duplicate_comment_ratio === 'number' && meta.duplicate_comment_ratio > 0.5)
      metaSignals.push(`High duplicate comment ratio (${Math.round(meta.duplicate_comment_ratio * 100)}%)`);

    heuristicScore = Math.min(1, heuristicScore + Math.min(0.4, metaSignals.length * 0.1));

    const textFeatures = {
      vocabulary_diversity: Math.round(vocabularyDiversity * 100) / 100,
      avg_sentence_length: Math.round(avgSentenceLen * 10) / 10,
      emoji_ratio: Math.round(emojiRatio * 100) / 100,
      caps_ratio: Math.round(capsRatio * 100) / 100,
      has_repeated_phrases: hasRepeatedPhrases,
      sensational_word_count: sensationalCount,
    };

    if (!mistralAvailable) {
      const hp = Math.round(heuristicScore * 100);
      return res.json({
        bot_probability: hp,
        verdict: hp > 60 ? 'likely_bot' : hp > 35 ? 'suspicious' : 'likely_human',
        confidence: 40,
        text_features: textFeatures,
        meta_signals: metaSignals,
        explanation: 'Heuristic analysis only. Set MISTRAL_API_KEY for deep semantic analysis.',
        red_flags: [...metaSignals],
        mode: 'heuristic',
      });
    }

    // Deep semantic analysis via Mistral
    const aiText = await mistralChat([
      { role: 'system', content: 'You are a bot-detection AI. Analyze text for signs of automated or inauthentic authorship. Respond ONLY with valid JSON, no markdown.' },
      { role: 'user', content: `Analyze this text for bot/automated authorship. Consider: semantic coherence, natural language variation, context awareness, template-like patterns, and authentic human expression.\n\nText: "${text.slice(0, 1000)}"\n\nHeuristic signals already computed: vocabulary_diversity=${vocabularyDiversity.toFixed(2)}, caps_ratio=${capsRatio.toFixed(2)}, repeated_phrases=${hasRepeatedPhrases}, sensational_words=${sensationalCount}${metaSignals.length > 0 ? `\nAccount signals: ${metaSignals.join('; ')}` : ''}\n\nRespond with ONLY JSON:\n{"bot_probability":<0-100>,"verdict":"likely_bot|suspicious|likely_human","confidence":<0-100>,"explanation":"<2 sentences>","red_flags":["<flag>"]}` },
    ], 20000);

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const aiResult = JSON.parse(sanitizeJson(jsonMatch[0]));

    // Blend: AI gets 70% weight, heuristic 30%
    const blended = Math.min(100, Math.max(0, Math.round((heuristicScore * 100 * 0.3) + (aiResult.bot_probability * 0.7))));
    res.json({
      bot_probability: blended,
      verdict: blended > 60 ? 'likely_bot' : blended > 35 ? 'suspicious' : 'likely_human',
      confidence: aiResult.confidence ?? 70,
      text_features: textFeatures,
      meta_signals: metaSignals,
      explanation: aiResult.explanation || '',
      red_flags: aiResult.red_flags || [],
      mode: 'ai',
    });
  } catch (err: any) {
    console.error('POST /api/analyze/bot error:', err.message);
    res.status(500).json({ error: extractApiError(err) });
  }
});

// --- Comment / reply thread authenticity analysis ---
// Takes an original post + array of comments, checks semantic consistency
// and detects coordinated inauthentic behavior patterns.
app.post('/api/analyze/comments', async (req, res) => {
  try {
    const { post, comments } = req.body;
    if (!post || typeof post !== 'string')
      return res.status(400).json({ error: 'post is required' });
    if (!Array.isArray(comments) || comments.length === 0)
      return res.status(400).json({ error: 'comments array is required' });
    if (comments.length > 50)
      return res.status(400).json({ error: 'Max 50 comments per request' });

    const sanitizedComments: string[] = comments
      .slice(0, 50)
      .map((c: any) => String(typeof c === 'string' ? c : c?.text || '').slice(0, 500))
      .filter(c => c.length > 0);

    // Heuristic: exact/near-duplicate detection
    const lower = sanitizedComments.map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());
    const duplicates = lower.filter((c, i) => lower.indexOf(c) !== i).length;
    const duplicationRate = sanitizedComments.length > 0 ? duplicates / sanitizedComments.length : 0;

    if (!mistralAvailable) {
      return res.json({
        overall_authenticity: duplicationRate > 0.3 ? 'suspicious' : 'likely_authentic',
        semantic_consistency_score: null,
        coordinated_behavior: duplicationRate > 0.3,
        duplication_rate: Math.round(duplicationRate * 100),
        bot_comment_indices: [],
        summary: 'Heuristic analysis only. Set MISTRAL_API_KEY for semantic analysis.',
        red_flags: duplicationRate > 0.3 ? [`${Math.round(duplicationRate * 100)}% duplicate comments detected`] : [],
        total_comments_analyzed: sanitizedComments.length,
        mode: 'heuristic',
      });
    }

    // Use up to 15 comments in the prompt to stay within token limits
    const commentSample = sanitizedComments
      .slice(0, 15)
      .map((c, i) => `${i + 1}. "${c}"`)
      .join('\n');

    const aiText = await mistralChat([
      { role: 'system', content: 'You are a social media authenticity analyst. Analyze comments for bot patterns, coordinated inauthentic behavior, and semantic consistency. Respond ONLY with valid JSON, no markdown.' },
      { role: 'user', content: `Analyze these comments for authenticity, bot patterns, coordinated inauthentic behavior, and semantic consistency with the original post.\n\nOriginal Post: "${post.slice(0, 500)}"\n\nComments (${sanitizedComments.length} total, showing first ${Math.min(15, sanitizedComments.length)}):\n${commentSample}\n\nNote: heuristic duplicate rate is ${Math.round(duplicationRate * 100)}%\n\nRespond with ONLY JSON:\n{"overall_authenticity":"likely_authentic|suspicious|coordinated_inauthentic","semantic_consistency_score":<0-100>,"coordinated_behavior":<true|false>,"bot_comment_indices":[<1-based>],"summary":"<2-3 sentences>","red_flags":["<flag>"]}` },
    ], 30000);

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const result = JSON.parse(sanitizeJson(jsonMatch[0]));

    res.json({
      ...result,
      duplication_rate: Math.round(duplicationRate * 100),
      total_comments_analyzed: sanitizedComments.length,
      mode: 'ai',
    });
  } catch (err: any) {
    console.error('POST /api/analyze/comments error:', err.message);
    res.status(500).json({ error: extractApiError(err) });
  }
});

// --- Image proxy to avoid CORS issues ---
app.get('/api/img', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url) return res.status(400).send('Missing url param');
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol))
      return res.status(400).send('Invalid protocol');
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AsliCheck/1.0', 'Accept': 'image/*' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(response.status).send('Upstream error');
    const ct = response.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return res.status(400).send('Not an image');
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch {
    res.status(502).send('Image fetch failed');
  }
});

// --- Serve frontend in production ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// --- Start ---
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`AsliCheck API running \u2192 http://localhost:${PORT}`);
  console.log(`Mode: ${mistralAvailable ? `AI (Mistral: ${MISTRAL_MODEL})` : 'Heuristic verification'}`);
});
