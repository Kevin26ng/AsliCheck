import React, { useState, useEffect } from 'react';
import { fetchNews } from '../lib/api';
import { cn } from '../lib/utils';

interface TrendingItem {
  id: string;
  category: string;
  title: string;
  count: string;
  type: 'verification' | 'flag';
}

const TOP_SOURCES = [
  { id: '1', name: 'BBC News', initials: 'BB', reliability: 99.2 },
  { id: '2', name: 'New York Times', initials: 'NY', reliability: 98.4 },
  { id: '3', name: 'Al Jazeera', initials: 'AJ', reliability: 96.1 },
  { id: '4', name: 'NBC News', initials: 'NB', reliability: 97.5 },
  { id: '5', name: 'Reddit', initials: 'R', reliability: 72.0 },
];

export default function RightSidebar() {
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews('all')
      .then((data) => setTrending(data.trending || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <aside className="hidden xl:block w-72 space-y-6 py-4">
      <div className="bg-[#16181c] rounded-xl p-5 border border-[#2f3336]">
        <h3 className="text-lg font-bold mb-4 text-[#e7e9ea]">Trending Now</h3>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-2 w-16 bg-[#2f3336] rounded mb-1.5" />
                <div className="h-3 w-full bg-[#2f3336] rounded mb-1" />
                <div className="h-2 w-20 bg-[#16181c] rounded" />
              </div>
            ))}
          </div>
        ) : trending.length > 0 ? (
          <div className="space-y-5">
            {trending.map((news) => (
              <div key={news.id} className="group cursor-pointer">
                <span className={cn(
                  "text-[9px] font-bold tracking-widest uppercase",
                  news.type === 'verification' ? "text-[#71767b]" : "text-[#f4212e]"
                )}>
                  {news.category}
                </span>
                <h4 className="text-xs font-semibold text-[#e7e9ea] group-hover:underline transition-colors mt-0.5 leading-tight line-clamp-2">
                  {news.title}
                </h4>
                <p className="text-[#71767b] text-[9px] mt-1.5">{news.count}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#71767b] text-xs text-center py-4">No trending data</p>
        )}
      </div>

      <div className="bg-[#16181c] rounded-xl p-5 border border-[#2f3336]">
        <h3 className="text-lg font-bold mb-4 text-[#e7e9ea]">Top Sources</h3>
        <div className="space-y-4">
          {TOP_SOURCES.map((source) => (
            <div key={source.id} className="flex items-center gap-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#2f3336] flex items-center justify-center text-[#e7e9ea] font-bold text-xs">
                {source.initials}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#e7e9ea] group-hover:underline leading-tight">{source.name}</p>
                <p className="text-[9px] text-[#71767b] font-medium">
                  {source.reliability}% Reliability
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 text-center">
        <p className="text-[9px] text-[#71767b] uppercase tracking-widest font-bold mb-3">
          &copy; 2026 AsliCheck
        </p>
        <div className="flex justify-center gap-3 text-[9px] text-[#71767b] font-medium">
          <a href="#" className="hover:underline hover:text-[#e7e9ea]">Privacy</a>
          <a href="#" className="hover:underline hover:text-[#e7e9ea]">Terms</a>
          <a href="#" className="hover:underline hover:text-[#e7e9ea]">Methodology</a>
        </div>
      </div>
    </aside>
  );
}
