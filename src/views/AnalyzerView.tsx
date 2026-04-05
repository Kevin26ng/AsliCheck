import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { analyzeClaim } from '../lib/api';

const EXAMPLE_CLAIMS = [
  'Drinking hot water with lemon cures COVID-19',
  'NASA confirms water on Mars surface',
  '5G cell towers cause cancer',
  'The Great Wall of China is visible from space',
  'Eating carrots significantly improves night vision',
];

export default function AnalyzerView() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<{ type: 'image' | 'url', value: string, name?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    if (!input.trim() && attachments.length === 0) return;
    setIsAnalyzing(true);
    setResult(null);
    setError('');
    try {
      const data = await analyzeClaim(input);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Make sure the server is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [...prev, { type: 'image', value: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const addUrl = () => {
    const url = prompt('Enter the URL to analyze:');
    if (url) {
      setAttachments(prev => [...prev, { type: 'url', value: url }]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const statusLabel = (s: string) => {
    if (s === 'verified') return '? Verified';
    if (s === 'unverified') return '? Unverified';
    if (s === 'disputed') return '? Disputed';
    return '? Likely Misleading';
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <section className="mb-12">
        <h1 className="text-4xl font-bold text-[#e7e9ea] mb-4">Claim Analyzer</h1>
        <p className="text-base text-[#71767b] max-w-2xl">
          Paste any claim, headline, or social media post to check its authenticity using AI cross-referencing.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {EXAMPLE_CLAIMS.map((claim, i) => (
            <button
              key={i}
              onClick={() => setInput(claim)}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[11px] font-medium text-[#71767b] border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors"
            >
              {claim}
            </button>
          ))}
        </div>
      </section>

      <div className="bg-black rounded-2xl p-8 mb-12 border border-[#2f3336] relative">
        <div className="flex items-center gap-2 mb-4 text-[#71767b]">
          <span className="text-[10px] uppercase tracking-widest font-bold">Verification Input</span>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full min-h-[120px] bg-transparent border-none focus:ring-0 text-lg leading-relaxed text-[#e7e9ea] placeholder:text-[#71767b] resize-none outline-none"
          placeholder="Paste a claim, social media post, or link here..."
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative group">
                {att.type === 'image' ? (
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-[#2f3336]">
                    <img src={att.value} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-24 w-48 bg-[#16181c] rounded-lg border border-[#2f3336] p-3 flex flex-col justify-center">
                    <p className="text-[10px] font-mono truncate text-[#71767b]">{att.value}</p>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-2 -right-2 bg-[#e7e9ea] text-black rounded-full w-5 h-5 text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ?
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[#71767b] text-xs font-bold border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors"
            >
              Upload
            </button>
            <button
              onClick={addUrl}
              className="px-3 py-1.5 rounded-full bg-[#16181c] text-[#71767b] text-xs font-bold border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors"
            >
              Paste URL
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!input.trim() && attachments.length === 0)}
            className="bg-[#e7e9ea] text-black px-8 py-3 rounded-full font-bold flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:bg-[#d7d9db]"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#71767b] border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              'Verify Now'
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#16181c] border border-[#2f3336] rounded-xl p-6 text-center"
          >
            <p className="text-[#f4212e] font-medium">{error}</p>
          </motion.div>
        )}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="md:col-span-2 space-y-8">
              <div className="bg-black rounded-2xl overflow-hidden border border-[#2f3336]">
                <div className="p-8 border-b border-[#2f3336]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className={cn(
                        "inline-flex items-center px-3 py-1 border rounded-md text-[10px] font-bold uppercase tracking-wider mb-3",
                        result.status === 'verified' && "text-[#e7e9ea] border-[#2f3336]",
                        result.status === 'unverified' && "text-[#71767b] border-[#2f3336]",
                        result.status === 'disputed' && "text-[#f4212e] border-[#2f3336]",
                        result.status === 'misleading' && "text-[#f4212e] border-[#2f3336]",
                      )}>
                        {statusLabel(result.status)}
                      </div>
                      <h2 className="text-3xl font-bold text-[#e7e9ea]">Analysis Result</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#71767b] font-bold uppercase tracking-widest mb-1">Confidence</div>
                      <div className="text-4xl font-bold text-[#e7e9ea]">{result.confidence}%</div>
                      <div className="w-24 h-1.5 bg-[#2f3336] rounded-full overflow-hidden mt-2 ml-auto">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-full rounded-full bg-[#e7e9ea]"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-base leading-relaxed text-[#71767b] mb-6">
                    {result.summary}
                  </p>
                </div>
                {result.discrepancies?.length > 0 && (
                  <div className="p-8 bg-[#16181c]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#71767b] mb-4">Key Discrepancies</h3>
                    <ul className="space-y-4">
                      {result.discrepancies.map((d: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-[#e7e9ea]">
                          <span className="text-[#f4212e] font-bold">?</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {result.sources?.length > 0 && (
                <div className="bg-black rounded-2xl p-6 border border-[#2f3336]">
                  <h3 className="text-xl font-bold mb-4 text-[#e7e9ea]">Sources</h3>
                  <div className="space-y-4">
                    {result.sources.map((source: any, i: number) => (
                      <a key={i} href={source.url !== '#' ? source.url : undefined} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="text-[10px] text-[#71767b] font-bold mb-1 uppercase tracking-tight">{source.name}</div>
                        <div className="text-sm font-semibold text-[#e7e9ea] group-hover:underline">
                          {source.title}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
