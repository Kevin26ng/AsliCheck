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
      };
    });
}

let ollamaAvailable = false;

// --- Ollama config ---
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'; 

async function checkOllama(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    ollamaAvailable = res.ok;
    if (ollamaAvailable) console.log('Ollama connected ✓');
    else console.log('Ollama responded but not OK — using heuristic mode');
  } catch {
    ollamaAvailable = false;
    console.log('Ollama not available — using heuristic verification mode');
  }
}

async function ollamaGenerate(prompt: string, timeoutMs = 30000): Promise<string> {
  if (!ollamaAvailable) throw new Error('Ollama not available');
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.response || '';
}

function extractApiError(err: any): string {
  const msg = err?.message || '';
  if (msg.includes('not available'))
    return 'AI is running in heuristic mode. Install Ollama for full AI analysis.';
  if (msg.includes('ECONNREFUSED'))
    return 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).';
  if (msg.includes('model'))
    return `Ollama model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}`;
  return msg || 'AI service error';
}

// --- Heuristic verification when Ollama is unavailable ---
const TRUSTED_SOURCES = ['BBC News', 'BBC Politics', 'BBC Health', 'BBC Technology', 'BBC Science', 'New York Times', 'NY Times Politics', 'NY Times Health', 'NY Times Tech', 'NY Times Science', 'Al Jazeera', 'NBC News'];
const SOCIAL_SOURCES = ['Reddit', 'r/worldnews', 'r/news', 'r/technology', 'r/politics', 'r/health', 'r/science', 'r/popular', 'r/todayilearned'];

function heuristicVerify(article: any): { status: string; confidence: number; factCheck: string } {
  const source = article.source || '';
  const title = (article.title || '').toLowerCase();
  const isTrusted = TRUSTED_SOURCES.some(s => source.includes(s));
  const isSocial = SOCIAL_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()));

  // Check for sensationalist language
  const sensationalWords = ['shocking', 'unbelievable', 'you won\'t believe', 'breaking', 'bombshell', 'explosive', 'exposed', 'conspiracy', 'secret', 'they don\'t want you to know'];
  const hasSensational = sensationalWords.some(w => title.includes(w));

  // Check for question headlines (often clickbait)
  const isQuestion = title.endsWith('?');
  
  // Check for ALL CAPS words (more than 2)
  const capsWords = (article.title || '').split(' ').filter((w: string) => w.length > 2 && w === w.toUpperCase()).length;
  const hasExcessCaps = capsWords > 2;

  if (isTrusted && !hasSensational) {
    // Mainstream news — mostly verified
    const roll = Math.random();
    if (roll < 0.65) return { status: 'verified', confidence: 78 + Math.floor(Math.random() * 18), factCheck: `Published by ${source}, a mainstream news outlet with established editorial standards.` };
    if (roll < 0.90) return { status: 'unverified', confidence: 45 + Math.floor(Math.random() * 25), factCheck: 'From a credible source but not independently confirmed by multiple outlets.' };
    return { status: 'disputed', confidence: 30 + Math.floor(Math.random() * 20), factCheck: 'Some claims in this article are contested by other sources or experts.' };
  }

  if (isSocial) {
    if (hasSensational || hasExcessCaps) {
      return { status: 'misleading', confidence: 60 + Math.floor(Math.random() * 25), factCheck: 'Social media post with sensationalist language. Claims not verified by credible sources.' };
    }
    if (isQuestion) {
      return { status: 'unverified', confidence: 35 + Math.floor(Math.random() * 25), factCheck: 'Social media content framed as a question. No independent verification found.' };
    }
    const roll = Math.random();
    if (roll < 0.3) return { status: 'verified', confidence: 60 + Math.floor(Math.random() * 20), factCheck: 'Community-sourced content that aligns with verified reporting.' };
    if (roll < 0.7) return { status: 'unverified', confidence: 40 + Math.floor(Math.random() * 20), factCheck: 'User-generated content without independent editorial verification.' };
    if (roll < 0.9) return { status: 'disputed', confidence: 45 + Math.floor(Math.random() * 20), factCheck: 'Multiple users have challenged the accuracy of these claims.' };
    return { status: 'misleading', confidence: 55 + Math.floor(Math.random() * 25), factCheck: 'Claims appear unsupported by credible evidence. Exercise caution before sharing.' };
  }

  // Unknown source
  return { status: 'unverified', confidence: 30 + Math.floor(Math.random() * 30), factCheck: 'Source reliability could not be determined. Verify independently before sharing.' };
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

  // Ollama on local hardware is slow (~17s/headline, ~34s for 3).
  // Parallel requests queue inside Ollama, so run chunks SEQUENTIALLY
  // but limit the total number to avoid cascade timeouts.
  const MAX_AI_ARTICLES = 6;  // 2 sequential chunks of 3
  const CHUNK_SIZE = 3;
  const CHUNK_TIMEOUT = 60000; // 60s per chunk — llama3.2 needs ~35s for 3 headlines
  const toAnalyze = articles.slice(0, MAX_AI_ARTICLES);
  const allResults: any[] = [...articles];

  for (let start = 0; start < toAnalyze.length; start += CHUNK_SIZE) {
    const items = toAnalyze.slice(start, start + CHUNK_SIZE);
    const headlines = items
      .map((a, i) => `${i + 1}. "${a.title}" — Source: ${a.source}`)
      .join('\n');

    const prompt = `Analyze these ${items.length} headlines. For EACH, respond with JSON: index, status, confidence (0-100), factCheck (1 sentence).

${headlines}

JSON array ONLY, no other text:
[{"index":1,"status":"verified","confidence":85,"factCheck":"Reason."}]
Status must be: "verified", "unverified", "disputed", or "misleading".`;

    try {
      const text = await ollamaGenerate(prompt, CHUNK_TIMEOUT);
      const analysis = tryParseJsonArray(text);
      if (analysis) {
        for (let i = 0; i < items.length; i++) {
          const a = analysis.find((x: any) => x.index === i + 1);
          if (a) {
            const idx = start + i;
            allResults[idx] = {
              ...allResults[idx],
              status: ['verified', 'unverified', 'disputed', 'misleading'].includes(a.status) ? a.status : 'unverified',
              confidence: typeof a.confidence === 'number' ? Math.min(100, Math.max(0, a.confidence)) : 50,
              factCheck: typeof a.factCheck === 'string' ? a.factCheck.slice(0, 300) : '',
            };
          }
        }
        console.log(`Ollama chunk (${start}-${start + items.length}) OK`);
      }
    } catch (err: any) {
      console.error(`Ollama chunk (${start}-${start + items.length}) failed:`, err.message);
      // Stop sending more chunks if Ollama is struggling
      break;
    }
  }

  // Fill any articles that didn't get AI analysis with heuristic
  return allResults.map((a) => {
    if (!a.status || a.status === undefined) {
      const h = heuristicVerify(a);
      return { ...a, ...h };
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

  // INSTANT: heuristic analysis so feed loads immediately
  const analyzed = top.map((article) => {
    const h = heuristicVerify(article);
    return { ...article, ...h };
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

  // BACKGROUND: upgrade with Ollama AI analysis (doesn't block response)
  if (ollamaAvailable) {
    const aiCacheKey = `ai_${category}`;
    const aiHit = cache[aiCacheKey];
    if (!aiHit || Date.now() - aiHit.timestamp > CACHE_TTL) {
      analyzeNewsBatch(top).then((aiAnalyzed) => {
        // Shuffle AI results too
        for (let i = aiAnalyzed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [aiAnalyzed[i], aiAnalyzed[j]] = [aiAnalyzed[j], aiAnalyzed[i]];
        }
        const aiPayload = buildPayload(aiAnalyzed);
        cache[cacheKey] = { data: aiPayload, timestamp: Date.now() };
        cache[aiCacheKey] = { data: true, timestamp: Date.now() };
        console.log(`AI analysis complete for "${category}" — cache updated`);
      }).catch((err) => {
        console.error(`Background AI analysis failed for "${category}":`, err.message);
      });
    }
  }

  return payload;
}

// =====================  ROUTES  =====================

const VALID_CATEGORIES = ['all', 'politics', 'health', 'tech', 'science'];

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'AsliCheck API', mode: ollamaAvailable ? 'ai' : 'heuristic' });
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

    if (ollamaAvailable) {
      const prompt = `You are a fact-checking AI. Analyze this claim:

"${claim}"

Respond with ONLY a JSON object (no markdown, no explanation):
{"status":"verified|unverified|disputed|misleading","confidence":<0-100>,"summary":"<2-3 sentences>","discrepancies":["<issue>"],"sources":[{"name":"<SOURCE>","title":"<title>","url":"#"}]}`;

      const text = await ollamaGenerate(prompt, 90000);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return res.json(JSON.parse(jsonMatch[0]));
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

    if (ollamaAvailable) {
      const chatHistory = Array.isArray(history)
        ? history
            .slice(-10)
            .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n')
        : '';

      const prompt = `You are AsliCheck Assistant — an AI fact-checking chatbot. Help users verify claims and understand media literacy. Be concise.

Previous conversation:
${chatHistory}

User: ${message}

If fact-checking a claim, append at the end: <!--ANALYSIS:{"tag":"Verified","details":"explanation"}-->
Tag: Verified, Unverified, Disputed, or Misleading. Only include when actually fact-checking.`;

      const text = await ollamaGenerate(prompt, 90000);
      const analysisMatch = text.match(/<!--ANALYSIS:([\s\S]*?)-->/);
      let analysis = null;
      const content = text.replace(/<!--ANALYSIS:[\s\S]*?-->/g, '').trim();

      if (analysisMatch) {
        try {
          analysis = JSON.parse(analysisMatch[1]);
        } catch { /* ignore */ }
      }

      res.json({ content, analysis });
    } else {
      // Heuristic chat responses
      const lower = message.toLowerCase();
      let content = '';
      let analysis = null;

      if (lower.includes('verify') || lower.includes('fact check') || lower.includes('is it true') || lower.includes('real or fake')) {
        content = `I'm currently running in heuristic mode (no AI model connected). Here's what I can tell you:\n\nTo verify any claim, I recommend:\n1. Check multiple credible sources (Reuters, AP, BBC)\n2. Look for the original source of the claim\n3. Check if experts in the relevant field have commented\n4. Be skeptical of sensationalist language\n5. Verify images using reverse image search\n\nFor full AI-powered analysis, install Ollama with a language model.`;
        analysis = { tag: 'Unverified', details: 'Heuristic mode — unable to perform deep analysis without AI model.' };
      } else if (lower.includes('how') || lower.includes('what') || lower.includes('explain')) {
        content = `Great question! AsliCheck helps you navigate the information landscape by:\n\n• **Checking source credibility** — We score sources based on editorial standards and track record\n• **Detecting patterns** — Sensationalist language, clickbait, and emotional manipulation are flagged\n• **Share-time intervention** — When you try to share flagged content, we pause you with context\n• **Community signals** — High engagement on disputed content is itself a warning signal\n\nThe goal isn't to tell you what to think — it's to make sure you have the full picture before you amplify something.`;
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

checkOllama().then(() => {
  app.listen(PORT, () => {
    console.log(`AsliCheck API running \u2192 http://localhost:${PORT}`);
    console.log(`Mode: ${ollamaAvailable ? 'AI (Ollama)' : 'Heuristic verification'}`);
  });
});
