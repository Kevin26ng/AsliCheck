import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { analyzeClaim, analyzeBot, analyzeComments, BotAnalysisResult, CommentAnalysisResult } from '../lib/api';

// ── shared helpers ──────────────────────────────────────────────────────────

const CLAIM_EXAMPLES = [
  'Drinking hot water with lemon cures COVID-19',
  'NASA confirms water on Mars surface',
  '5G cell towers cause cancer',
  'The Great Wall of China is visible from space',
  'Eating carrots significantly improves night vision',
];

const BOT_EXAMPLES = [
  'BUY NOW!!! BEST DEAL EVER!!! LIMITED OFFER!!! CLICK LINK IN BIO!!!',
  'I completely agree with this post. This is very important information that everyone should share.',
  'Great content! Follow me for more amazing updates and exclusive deals every single day!',
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    verified:        { label: '✓ Verified',         className: 'text-emerald-400 border-emerald-800' },
    unverified:      { label: '? Unverified',        className: 'text-[#71767b] border-[#2f3336]' },
    disputed:        { label: '⚠ Disputed',          className: 'text-amber-400 border-amber-800' },
    misleading:      { label: '✕ Likely Misleading', className: 'text-[#f4212e] border-red-900' },
    likely_human:    { label: '✓ Likely Human',      className: 'text-emerald-400 border-emerald-800' },
    suspicious:      { label: '⚠ Suspicious',        className: 'text-amber-400 border-amber-800' },
    likely_bot:      { label: '✕ Likely Bot',        className: 'text-[#f4212e] border-red-900' },
    likely_authentic:          { label: '✓ Likely Authentic',           className: 'text-emerald-400 border-emerald-800' },
    coordinated_inauthentic:   { label: '✕ Coordinated Inauthentic',    className: 'text-[#f4212e] border-red-900' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'text-[#71767b] border-[#2f3336]' };
  return (
    <span className={cn('inline-flex items-center px-3 py-1 border rounded-md text-[10px] font-bold uppercase tracking-wider', className)}>
      {label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div>
      <div className="text-[10px] text-[#71767b] font-bold uppercase tracking-widest mb-1">Confidence</div>
      <div className="text-4xl font-bold text-[#e7e9ea]">{value}%</div>
      <div className="w-24 h-1.5 bg-[#2f3336] rounded-full overflow-hidden mt-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full bg-[#e7e9ea]"
        />
      </div>
    </div>
  );
}

function RedFlags({ flags }: { flags: string[] }) {
  if (!flags?.length) return null;
  return (
    <div className="p-6 bg-[#16181c] border-t border-[#2f3336]">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-4">Red Flags</h3>
      <ul className="space-y-3">
        {flags.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-[#e7e9ea]">
            <span className="text-[#f4212e] font-bold shrink-0">✕</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyzeButton({ loading, disabled, label = 'Analyze' }: { loading: boolean; disabled: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="bg-[#e7e9ea] text-black px-8 py-3 rounded-full font-bold flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:bg-[#d7d9db]"
    >
      {loading ? (
        <><div className="w-4 h-4 border-2 border-[#71767b] border-t-transparent rounded-full animate-spin" />Analyzing...</>
      ) : label}
    </button>
  );
}

// ── Tab 1: Claim Analyzer ───────────────────────────────────────────────────

function ClaimTab() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true); setResult(null); setError('');
    try {
      setResult(await analyzeClaim(input));
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-[#71767b] mb-3">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {CLAIM_EXAMPLES.map((c, i) => (
            <button key={i} onClick={() => setInput(c)}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[11px] font-medium text-[#71767b] border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors">
              {c}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-black rounded-2xl p-8 border border-[#2f3336]">
        <div className="text-[10px] uppercase tracking-widest font-bold text-[#71767b] mb-4">Claim or Headline</div>
        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          className="w-full min-h-[120px] bg-transparent border-none focus:ring-0 text-lg leading-relaxed text-[#e7e9ea] placeholder:text-[#71767b] resize-none outline-none"
          placeholder="Paste a claim, headline, or social media post..."
        />
        <div className="flex justify-end mt-4">
          <AnalyzeButton loading={loading} disabled={!input.trim()} label="Verify Now" />
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#16181c] border border-[#2f3336] rounded-xl p-6">
            <p className="text-[#f4212e] font-medium">{error}</p>
          </motion.div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-black rounded-2xl border border-[#2f3336] overflow-hidden">
              <div className="p-8 border-b border-[#2f3336]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <StatusBadge status={result.status} />
                    <h2 className="text-3xl font-bold text-[#e7e9ea] mt-3">Analysis Result</h2>
                  </div>
                  <ConfidenceBar value={result.confidence} />
                </div>
                <p className="text-base leading-relaxed text-[#71767b]">{result.summary}</p>
              </div>
              {result.discrepancies?.length > 0 && (
                <div className="p-8 bg-[#16181c]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-4">Key Discrepancies</h3>
                  <ul className="space-y-4">
                    {result.discrepancies.map((d: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#e7e9ea]">
                        <span className="text-[#f4212e] font-bold shrink-0">✕</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {result.sources?.length > 0 && (
              <div className="bg-black rounded-2xl p-6 border border-[#2f3336]">
                <h3 className="text-xl font-bold mb-4 text-[#e7e9ea]">Sources</h3>
                <div className="space-y-4">
                  {result.sources.map((s: any, i: number) => (
                    <a key={i} href={s.url !== '#' ? s.url : undefined} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="text-[10px] text-[#71767b] font-bold mb-1 uppercase">{s.name}</div>
                      <div className="text-sm font-semibold text-[#e7e9ea] group-hover:underline">{s.title}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 2: Bot Detection ────────────────────────────────────────────────────

function BotTab() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BotAnalysisResult | null>(null);
  const [error, setError] = useState('');
  // Optional metadata fields
  const [showMeta, setShowMeta] = useState(false);
  const [accountAge, setAccountAge] = useState('');
  const [postsPerDay, setPostsPerDay] = useState('');
  const [followerRatio, setFollowerRatio] = useState('');
  const [replyLatency, setReplyLatency] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true); setResult(null); setError('');
    try {
      const metadata: Record<string, number> = {};
      if (accountAge) metadata.account_age_days = Number(accountAge);
      if (postsPerDay) metadata.posts_per_day = Number(postsPerDay);
      if (followerRatio) metadata.follower_ratio = Number(followerRatio);
      if (replyLatency) metadata.reply_latency_sec = Number(replyLatency);
      setResult(await analyzeBot(text, Object.keys(metadata).length ? metadata : undefined));
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const VERDICT_COLOR: Record<string, string> = {
    likely_human: 'text-emerald-400',
    suspicious: 'text-amber-400',
    likely_bot: 'text-[#f4212e]',
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-[#71767b] mb-3">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {BOT_EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setText(ex)}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[11px] font-medium text-[#71767b] border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors">
              {ex.slice(0, 60)}…
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-black rounded-2xl p-8 border border-[#2f3336] space-y-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#71767b] mb-4">Post / Comment / Reply Text</div>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            className="w-full min-h-[120px] bg-transparent border-none focus:ring-0 text-base leading-relaxed text-[#e7e9ea] placeholder:text-[#71767b] resize-none outline-none"
            placeholder="Paste the comment, reply, or post text to analyze for bot authorship..."
          />
        </div>

        <div>
          <button type="button" onClick={() => setShowMeta(!showMeta)}
            className="text-xs text-[#71767b] hover:text-[#e7e9ea] transition-colors font-medium flex items-center gap-1">
            {showMeta ? '▾' : '▸'} Account metadata (optional — improves accuracy)
          </button>
          {showMeta && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[
                { label: 'Account age (days)', val: accountAge, set: setAccountAge, placeholder: 'e.g. 14' },
                { label: 'Posts per day',      val: postsPerDay, set: setPostsPerDay, placeholder: 'e.g. 45' },
                { label: 'Follower ratio',     val: followerRatio, set: setFollowerRatio, placeholder: 'e.g. 0.02' },
                { label: 'Reply latency (sec)', val: replyLatency, set: setReplyLatency, placeholder: 'e.g. 2' },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] font-bold text-[#71767b] uppercase tracking-widest mb-1">{label}</label>
                  <input type="number" step="any" min="0" value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                    className="w-full bg-[#16181c] border border-[#2f3336] rounded-lg px-3 py-2 text-sm text-[#e7e9ea] placeholder:text-[#3f4347] outline-none focus:border-[#71767b]" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <AnalyzeButton loading={loading} disabled={!text.trim()} label="Detect Bot" />
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#16181c] border border-[#2f3336] rounded-xl p-6">
            <p className="text-[#f4212e] font-medium">{error}</p>
          </motion.div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Main verdict card */}
            <div className="bg-black rounded-2xl border border-[#2f3336] overflow-hidden">
              <div className="p-8 border-b border-[#2f3336]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <StatusBadge status={result.verdict} />
                    <h2 className="text-3xl font-bold text-[#e7e9ea] mt-3">Bot Detection Result</h2>
                    <p className="text-sm text-[#71767b] mt-2">{result.mode === 'ai' ? 'AI + heuristic blend' : 'Heuristic analysis only'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#71767b] font-bold uppercase tracking-widest mb-1">Bot Probability</div>
                    <div className={cn('text-5xl font-bold', VERDICT_COLOR[result.verdict])}>{result.bot_probability}%</div>
                    <div className="w-32 h-2 bg-[#2f3336] rounded-full overflow-hidden mt-2 ml-auto">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${result.bot_probability}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', result.verdict === 'likely_human' ? 'bg-emerald-500' : result.verdict === 'suspicious' ? 'bg-amber-500' : 'bg-[#f4212e]')} />
                    </div>
                    <div className="text-xs text-[#71767b] mt-1">Confidence: {result.confidence}%</div>
                  </div>
                </div>
                {result.explanation && <p className="text-base leading-relaxed text-[#71767b]">{result.explanation}</p>}
              </div>

              {/* Text feature breakdown */}
              <div className="p-8 border-b border-[#2f3336]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-5">Text Feature Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Vocabulary Diversity', value: `${Math.round(result.text_features.vocabulary_diversity * 100)}%`, note: 'Low = repetitive/bot-like' },
                    { label: 'Avg Sentence Length', value: `${result.text_features.avg_sentence_length} words`, note: 'Very short = templated' },
                    { label: 'Emoji Ratio', value: `${Math.round(result.text_features.emoji_ratio * 100)}%`, note: 'Very high = spam-like' },
                    { label: 'Caps Ratio', value: `${Math.round(result.text_features.caps_ratio * 100)}%`, note: 'High = aggressive/bot' },
                    { label: 'Repeated Phrases', value: result.text_features.has_repeated_phrases ? 'Detected' : 'None', note: 'Copy-paste patterns' },
                    { label: 'Sensational Words', value: String(result.text_features.sensational_word_count), note: 'Manipulation language' },
                  ].map(({ label, value, note }) => (
                    <div key={label} className="bg-[#16181c] rounded-xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-1">{label}</div>
                      <div className="text-lg font-bold text-[#e7e9ea]">{value}</div>
                      <div className="text-[11px] text-[#3f4347] mt-0.5">{note}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.meta_signals?.length > 0 && (
                <div className="p-8 border-b border-[#2f3336]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-4">Account Signals</h3>
                  <ul className="space-y-3">
                    {result.meta_signals.map((s, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-amber-400">
                        <span className="font-bold shrink-0">⚠</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <RedFlags flags={result.red_flags} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 3: Comment Thread Analysis ─────────────────────────────────────────

function CommentsTab() {
  const [post, setPost] = useState('');
  const [comments, setComments] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommentAnalysisResult | null>(null);
  const [error, setError] = useState('');

  const addComment = () => setComments(prev => [...prev, '']);
  const removeComment = (i: number) => setComments(prev => prev.filter((_, idx) => idx !== i));
  const updateComment = (i: number, val: string) => setComments(prev => prev.map((c, idx) => idx === i ? val : c));

  const validComments = comments.filter(c => c.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post.trim() || validComments.length === 0) return;
    setLoading(true); setResult(null); setError('');
    try {
      setResult(await analyzeComments(post, validComments));
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const AUTHENTICITY_COLOR: Record<string, string> = {
    likely_authentic: 'text-emerald-400',
    suspicious: 'text-amber-400',
    coordinated_inauthentic: 'text-[#f4212e]',
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-[#71767b]">
        Paste an original post and its comments/replies. The model checks semantic consistency, duplicate patterns, and coordinated inauthentic behavior.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Original post */}
        <div className="bg-black rounded-2xl p-8 border border-[#2f3336]">
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#71767b] mb-4">Original Post</div>
          <textarea
            value={post} onChange={e => setPost(e.target.value)}
            className="w-full min-h-[100px] bg-transparent border-none focus:ring-0 text-base leading-relaxed text-[#e7e9ea] placeholder:text-[#71767b] resize-none outline-none"
            placeholder="Paste the original post or article headline here..."
          />
        </div>

        {/* Comments list */}
        <div className="bg-black rounded-2xl p-8 border border-[#2f3336] space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#71767b]">
              Comments / Replies ({comments.length})
            </div>
            <button type="button" onClick={addComment} disabled={comments.length >= 50}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[11px] font-bold text-[#71767b] border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors disabled:opacity-40">
              + Add Comment
            </button>
          </div>

          <div className="space-y-3">
            {comments.map((c, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs text-[#3f4347] font-mono pt-2.5 w-5 shrink-0">{i + 1}</span>
                <input
                  type="text" value={c} onChange={e => updateComment(i, e.target.value)}
                  placeholder={`Comment ${i + 1}…`}
                  className="flex-1 bg-[#16181c] border border-[#2f3336] rounded-xl px-4 py-2.5 text-sm text-[#e7e9ea] placeholder:text-[#3f4347] outline-none focus:border-[#71767b] transition-colors"
                />
                {comments.length > 2 && (
                  <button type="button" onClick={() => removeComment(i)}
                    className="text-[#3f4347] hover:text-[#f4212e] transition-colors pt-2.5 font-bold">✕</button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-[#3f4347]">{validComments.length} non-empty · max 50</span>
            <AnalyzeButton loading={loading} disabled={!post.trim() || validComments.length === 0} label="Analyze Thread" />
          </div>
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#16181c] border border-[#2f3336] rounded-xl p-6">
            <p className="text-[#f4212e] font-medium">{error}</p>
          </motion.div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-black rounded-2xl border border-[#2f3336] overflow-hidden">
              <div className="p-8 border-b border-[#2f3336]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <StatusBadge status={result.overall_authenticity} />
                    <h2 className="text-3xl font-bold text-[#e7e9ea] mt-3">Thread Analysis</h2>
                    <p className="text-sm text-[#71767b] mt-1">
                      {result.total_comments_analyzed} comments analyzed · {result.mode === 'ai' ? 'AI-powered' : 'Heuristic'}
                    </p>
                  </div>
                  <div className="text-right space-y-4">
                    {result.semantic_consistency_score !== null && (
                      <div>
                        <div className="text-[10px] text-[#71767b] font-bold uppercase tracking-widest mb-1">Semantic Consistency</div>
                        <div className={cn('text-4xl font-bold', AUTHENTICITY_COLOR[result.overall_authenticity])}>
                          {result.semantic_consistency_score}%
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] text-[#71767b] font-bold uppercase tracking-widest mb-1">Duplicate Rate</div>
                      <div className={cn('text-2xl font-bold', result.duplication_rate > 30 ? 'text-[#f4212e]' : 'text-[#e7e9ea]')}>
                        {result.duplication_rate}%
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-base leading-relaxed text-[#71767b]">{result.summary}</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-3 border-b border-[#2f3336]">
                {[
                  { label: 'Coordinated Behavior', value: result.coordinated_behavior ? 'Detected' : 'Not detected', warn: result.coordinated_behavior },
                  { label: 'Suspected Bot Comments', value: result.bot_comment_indices?.length ? `#${result.bot_comment_indices.join(', #')}` : 'None', warn: !!result.bot_comment_indices?.length },
                  { label: 'Duplicate Comments', value: `${result.duplication_rate}%`, warn: result.duplication_rate > 30 },
                ].map(({ label, value, warn }) => (
                  <div key={label} className="p-6 border-r border-[#2f3336] last:border-r-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-2">{label}</div>
                    <div className={cn('text-base font-bold', warn ? 'text-[#f4212e]' : 'text-emerald-400')}>{value}</div>
                  </div>
                ))}
              </div>

              <RedFlags flags={result.red_flags} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main View ───────────────────────────────────────────────────────────────

type Tab = 'claim' | 'bot' | 'comments';

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'claim',    label: 'Claim Analyzer',    description: 'Verify facts, headlines, and statements' },
  { id: 'bot',      label: 'Bot Detection',      description: 'Detect automated or inauthentic authorship' },
  { id: 'comments', label: 'Comment Thread',     description: 'Analyze replies for coordinated behavior' },
];

export default function AnalyzerView() {
  const [activeTab, setActiveTab] = useState<Tab>('claim');

  return (
    <div className="max-w-4xl mx-auto py-8">
      <section className="mb-10">
        <h1 className="text-4xl font-bold text-[#e7e9ea] mb-2">Analyzer</h1>
        <p className="text-base text-[#71767b]">
          Verify claims, detect bot authorship, and analyze comment thread authenticity.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#16181c] rounded-2xl p-1.5 border border-[#2f3336]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all text-left',
              activeTab === tab.id
                ? 'bg-black text-[#e7e9ea] shadow-sm'
                : 'text-[#71767b] hover:text-[#e7e9ea]',
            )}
          >
            <div>{tab.label}</div>
            <div className="text-[10px] font-normal mt-0.5 opacity-70 hidden md:block">{tab.description}</div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {activeTab === 'claim'    && <ClaimTab />}
          {activeTab === 'bot'      && <BotTab />}
          {activeTab === 'comments' && <CommentsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


