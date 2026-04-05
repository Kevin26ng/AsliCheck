import React, { useState } from 'react';
import { Post } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PostCardProps {
  post: Post;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const [showShareWarning, setShowShareWarning] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareBlocked, setShareBlocked] = useState(false);

  const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
    verified: {
      label: 'Verified',
      color: 'text-[#00ba7c]',
      bg: 'bg-[#00ba7c]/10',
      border: 'border-[#00ba7c]/30',
      icon: '\u2713',
    },
    unverified: {
      label: 'Unverified',
      color: 'text-[#f7931a]',
      bg: 'bg-[#f7931a]/10',
      border: 'border-[#f7931a]/30',
      icon: '?',
    },
    disputed: {
      label: 'Disputed',
      color: 'text-[#ff6b35]',
      bg: 'bg-[#ff6b35]/10',
      border: 'border-[#ff6b35]/30',
      icon: '\u26a0',
    },
    misleading: {
      label: 'Likely Misleading',
      color: 'text-[#f4212e]',
      bg: 'bg-[#f4212e]/10',
      border: 'border-[#f4212e]/30',
      icon: '\u2716',
    },
  };

  const config = statusConfig[post.status] || statusConfig.unverified;
  const isFlagged = post.status === 'disputed' || post.status === 'misleading';
  const isUnverified = post.status === 'unverified';
  const isSocial = post.postType === 'social';

  const handleShare = () => {
    if (isFlagged || isUnverified) {
      setShowShareWarning(true);
    } else {
      doShare();
    }
  };

  const doShare = () => {
    if (navigator.share) {
      navigator.share({ title: post.title, url: post.sourceUrl }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(post.sourceUrl);
    }
    setShared(true);
    setShowShareWarning(false);
    setTimeout(() => setShared(false), 2000);
  };

  const handleBlockShare = () => {
    setShareBlocked(true);
    setShowShareWarning(false);
    setTimeout(() => setShareBlocked(false), 3000);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className={cn(
          "bg-black border-b border-[#2f3336] overflow-hidden transition-colors",
          isFlagged && "border-l-2 border-l-[#f4212e]/30"
        )}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                isSocial ? "bg-[#ff4500]/10 text-[#ff4500] border border-[#ff4500]/20" : "bg-[#16181c] text-[#e7e9ea] border border-[#2f3336]"
              )}>
                {isSocial ? 'R' : (post.author?.slice(1, 3).toUpperCase() || 'N')}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[#e7e9ea] text-[13px] font-bold truncate">{post.author}</span>
                  {isSocial && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ff4500]/10 text-[#ff4500] font-bold uppercase">Social</span>
                  )}
                  <span className="text-[#71767b] text-[12px]">&middot;</span>
                  <span className="text-[#71767b] text-[12px]">{post.timestamp}</span>
                  {post.sourceDomain && (
                    <>
                      <span className="text-[#71767b] text-[12px]">&middot;</span>
                      <span className="text-[#71767b] text-[11px]">{post.sourceDomain}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 border",
              config.bg, config.color, config.border
            )}>
              <span className="text-[11px]">{config.icon}</span>
              {config.label}
            </span>
          </div>

          {/* Confidence bar */}
          {post.confidence != null && (
            <div className="flex items-center gap-2 mb-2 ml-[46px]">
              <div className="flex-1 h-[3px] bg-[#2f3336] rounded-full overflow-hidden max-w-[120px]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    post.status === 'verified' ? "bg-[#00ba7c]" :
                    post.status === 'unverified' ? "bg-[#f7931a]" :
                    post.status === 'disputed' ? "bg-[#ff6b35]" : "bg-[#f4212e]"
                  )}
                  style={{ width: `${post.confidence}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-mono font-bold", config.color)}>
                {post.confidence}%
              </span>
            </div>
          )}

          {/* Body */}
          <div className="ml-[46px]">
            <h2
              onClick={() => setShowDetail(true)}
              className={cn(
                "text-[15px] font-bold leading-snug mb-1.5 text-[#e7e9ea] cursor-pointer hover:underline",
                post.status === 'disputed' && "italic",
                post.status === 'misleading' && "line-through decoration-[#f4212e]/40 decoration-2"
              )}
            >
              {post.title}
            </h2>

            <p className="text-[#8b8d91] text-[13px] leading-relaxed mb-2.5">
              {post.content}
            </p>

            {post.factCheck && (
              <div className={cn(
                "p-3 rounded-lg mb-3",
                isFlagged ? "bg-[#f4212e]/5 border-l-2 border-l-[#f4212e]/50" : "bg-[#16181c] border-l-2 border-l-[#71767b]/30"
              )}>
                <p className={cn("text-[9px] font-bold uppercase mb-1 tracking-wide", isFlagged ? "text-[#f4212e]" : "text-[#71767b]")}>
                  {isFlagged ? '\u26a0 AsliCheck Warning' : 'AsliCheck Analysis'}
                </p>
                <p className="text-[11px] text-[#e7e9ea] leading-snug">{post.factCheck}</p>
              </div>
            )}

            {post.imageUrl && !imgError && (
              <div className="rounded-2xl overflow-hidden mb-3 border border-[#2f3336] cursor-pointer" onClick={() => setShowDetail(true)}>
                <img
                  src={post.imageUrl}
                  alt=""
                  className="w-full max-h-[350px] object-cover bg-[#16181c]"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              </div>
            )}

            {/* Engagement */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-5">
                <span className="text-[#71767b] text-[12px] hover:text-[#e7e9ea] cursor-pointer transition-colors">
                  {formatNumber(post.comments)} replies
                </span>
                <span className="text-[#71767b] text-[12px] hover:text-[#00ba7c] cursor-pointer transition-colors">
                  {formatNumber(post.likes)} likes
                </span>
                {post.shares != null && (
                  <span className="text-[#71767b] text-[12px]">
                    {formatNumber(post.shares)} shares
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#71767b] hover:text-[#e7e9ea] px-3 py-1 rounded-full text-[11px] font-bold transition-colors hover:bg-[#16181c]"
                >
                  Source
                </a>
                <button
                  onClick={handleShare}
                  disabled={shareBlocked}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95",
                    shared ? "bg-[#00ba7c] text-white" :
                    shareBlocked ? "bg-[#16181c] text-[#71767b] border border-[#2f3336] cursor-not-allowed" :
                    isFlagged ? "bg-[#f4212e]/10 text-[#f4212e] border border-[#f4212e]/30 hover:bg-[#f4212e]/20" :
                    isUnverified ? "bg-[#f7931a]/10 text-[#f7931a] border border-[#f7931a]/30 hover:bg-[#f7931a]/20" :
                    "bg-[#e7e9ea] text-black hover:bg-[#d7d9db]"
                  )}
                >
                  {shared ? 'Shared \u2713' : shareBlocked ? 'Blocked' : isFlagged ? '\u26a0 Share' : 'Share'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.article>

      {/* ===== THE PRODUCT: SHARE-TIME WARNING INTERVENTION ===== */}
      <AnimatePresence>
        {showShareWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#000] rounded-2xl max-w-lg w-full shadow-2xl border border-[#2f3336] overflow-hidden"
            >
              {/* Warning header */}
              <div className={cn(
                "p-5 text-center",
                isFlagged ? "bg-[#f4212e]/10 border-b border-[#f4212e]/20" : "bg-[#f7931a]/10 border-b border-[#f7931a]/20"
              )}>
                <div className={cn("text-4xl mb-2", isFlagged ? "text-[#f4212e]" : "text-[#f7931a]")}>
                  {isFlagged ? '\u26d4' : '\u26a0'}
                </div>
                <h3 className="text-xl font-bold text-[#e7e9ea]">
                  {isFlagged ? 'Stop \u2014 This content is flagged' : 'Wait \u2014 This is unverified'}
                </h3>
                <p className="text-[13px] text-[#71767b] mt-1">
                  {isFlagged
                    ? 'Sharing flagged content amplifies potential misinformation'
                    : "This hasn't been verified by independent sources yet"}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* What you're about to share */}
                <div className="bg-[#16181c] rounded-xl p-4 border border-[#2f3336]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                      config.bg, config.color, config.border
                    )}>
                      {config.icon} {config.label}
                    </span>
                    {post.confidence != null && (
                      <span className={cn("text-[10px] font-mono font-bold", config.color)}>
                        {post.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#e7e9ea] font-medium leading-snug line-clamp-2">
                    {post.title}
                  </p>
                </div>

                {/* Why flagged */}
                {post.factCheck && (
                  <div className={cn("rounded-xl p-4")} style={{
                    borderLeft: `3px solid ${isFlagged ? '#f4212e' : '#f7931a'}`,
                    background: isFlagged ? 'rgba(244,33,46,0.03)' : 'rgba(247,147,26,0.03)',
                  }}>
                    <p className={cn("text-[10px] font-bold uppercase tracking-wide mb-1", isFlagged ? "text-[#f4212e]" : "text-[#f7931a]")}>
                      Why this is flagged
                    </p>
                    <p className="text-[12px] text-[#e7e9ea] leading-relaxed">{post.factCheck}</p>
                  </div>
                )}

                {/* Impact stats for flagged content */}
                {isFlagged && (
                  <div className="bg-[#16181c] rounded-xl p-4 border border-[#2f3336]">
                    <p className="text-[10px] font-bold text-[#71767b] uppercase tracking-wide mb-2">Impact if shared</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[#f4212e] text-lg font-bold">{formatNumber(post.shares || 0)}</p>
                        <p className="text-[10px] text-[#71767b]">potential reach</p>
                      </div>
                      <div>
                        <p className="text-[#f4212e] text-lg font-bold">{Math.floor((post.confidence || 50) * 0.6)}%</p>
                        <p className="text-[10px] text-[#71767b]">may believe it</p>
                      </div>
                      <div>
                        <p className="text-[#f4212e] text-lg font-bold">{Math.floor((post.shares || 100) * 0.08)}</p>
                        <p className="text-[10px] text-[#71767b]">onward shares</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons — THE INTERVENTION */}
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={handleBlockShare}
                    className="w-full py-3 rounded-full font-bold text-sm bg-[#e7e9ea] text-black hover:bg-[#d7d9db] transition-all active:scale-[0.98]"
                  >
                    {isFlagged ? "Don't Share \u2014 Protect Your Network" : "Not Now \u2014 I'll Verify First"}
                  </button>
                  
                  <button
                    onClick={() => { window.open(post.sourceUrl, '_blank'); setShowShareWarning(false); }}
                    className="w-full py-3 rounded-full font-bold text-sm bg-[#16181c] text-[#e7e9ea] border border-[#2f3336] hover:bg-[#1d1f23] transition-all active:scale-[0.98]"
                  >
                    Read Original Source First
                  </button>

                  <button
                    onClick={doShare}
                    className={cn(
                      "w-full py-2.5 rounded-full text-[12px] font-medium transition-all",
                      isFlagged ? "text-[#71767b] hover:text-[#f4212e]" : "text-[#71767b] hover:text-[#f7931a]"
                    )}
                  >
                    {isFlagged ? 'I understand the risks \u2014 Share anyway' : 'Share without verifying'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Article Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-black rounded-2xl max-w-2xl w-full shadow-2xl border border-[#2f3336] overflow-hidden mb-12"
            >
              <div className="flex justify-end p-3">
                <button onClick={() => setShowDetail(false)} className="p-1.5 rounded-full hover:bg-[#16181c] transition-colors text-[#71767b] hover:text-[#e7e9ea] text-lg font-bold">
                  &#x2715;
                </button>
              </div>
              {post.imageUrl && !imgError && (
                <img
                  src={post.imageUrl}
                  alt=""
                  className="w-full max-h-[400px] object-cover bg-[#16181c]"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border",
                    config.bg, config.color, config.border
                  )}>
                    {config.icon} {config.label}
                  </span>
                  {post.confidence != null && (
                    <span className={cn("text-[10px] font-mono font-bold", config.color)}>{post.confidence}%</span>
                  )}
                  <span className="text-[#71767b] text-[11px]">{post.author} &middot; {post.timestamp}</span>
                  {isSocial && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ff4500]/10 text-[#ff4500] font-bold">SOCIAL</span>}
                </div>
                <h2 className="text-2xl font-bold text-[#e7e9ea] leading-tight">{post.title}</h2>
                <p className="text-[#8b8d91] leading-relaxed">{post.content}</p>
                {post.factCheck && (
                  <div className={cn(
                    "p-4 rounded-xl",
                    isFlagged ? "bg-[#f4212e]/5 border-l-2 border-l-[#f4212e]/50" : "bg-[#16181c] border-l-2 border-l-[#71767b]/30"
                  )}>
                    <p className={cn("text-[10px] font-bold uppercase mb-2", isFlagged ? "text-[#f4212e]" : "text-[#71767b]")}>
                      AsliCheck Analysis
                    </p>
                    <p className="text-sm text-[#e7e9ea] leading-relaxed">{post.factCheck}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#e7e9ea] text-black px-5 py-2 rounded-full font-bold text-xs hover:bg-[#d7d9db] transition-colors"
                  >
                    Read Full Article
                  </a>
                  <button
                    onClick={handleShare}
                    className={cn(
                      "px-5 py-2 rounded-full font-bold text-xs border transition-colors",
                      isFlagged
                        ? "bg-[#f4212e]/10 text-[#f4212e] border-[#f4212e]/30 hover:bg-[#f4212e]/20"
                        : "bg-[#16181c] text-[#e7e9ea] border-[#2f3336] hover:bg-[#1d1f23]"
                    )}
                  >
                    {isFlagged ? '\u26a0 Share' : 'Share'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
