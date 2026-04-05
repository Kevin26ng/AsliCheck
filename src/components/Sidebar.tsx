import React from 'react';
import { cn } from '../lib/utils';

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 h-[calc(100vh-56px)] sticky top-14 p-4 space-y-6 border-r border-[#2f3336]">
      <div>
        <h2 className="text-[#e7e9ea] text-lg font-bold">AsliCheck</h2>
        <p className="text-[#71767b] text-[10px] uppercase tracking-widest mt-0.5 font-semibold">Platform Intervention</p>
      </div>

      {/* How it works */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-[#71767b] uppercase tracking-widest">How it works</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-[#00ba7c] text-xs mt-0.5">{'\u2713'}</span>
            <p className="text-[11px] text-[#8b8d91] leading-snug"><span className="text-[#e7e9ea] font-semibold">Verified</span> — confirmed by credible sources</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#f7931a] text-xs mt-0.5">?</span>
            <p className="text-[11px] text-[#8b8d91] leading-snug"><span className="text-[#e7e9ea] font-semibold">Unverified</span> — not independently confirmed</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#ff6b35] text-xs mt-0.5">{'\u26a0'}</span>
            <p className="text-[11px] text-[#8b8d91] leading-snug"><span className="text-[#e7e9ea] font-semibold">Disputed</span> — contested by experts</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#f4212e] text-xs mt-0.5">{'\u2716'}</span>
            <p className="text-[11px] text-[#8b8d91] leading-snug"><span className="text-[#e7e9ea] font-semibold">Misleading</span> — debunked or unsupported</p>
          </div>
        </div>
      </div>

      {/* The intervention */}
      <div className="bg-[#16181c] p-3 rounded-xl border border-[#2f3336]">
        <span className="text-[10px] font-bold uppercase tracking-tight text-[#f7931a]">The Intervention</span>
        <p className="text-[10px] text-[#8b8d91] leading-relaxed mt-1">
          When you share flagged content, AsliCheck pauses you with context — so misinformation stops at the moment it would spread.
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-[#2f3336]">
        <p className="text-[10px] text-[#71767b] mb-2 text-center">We don't tell you what to think.</p>
        <p className="text-[10px] text-[#71767b] text-center">We make sure you have the full picture.</p>
      </div>
    </aside>
  );
}
