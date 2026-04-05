import React, { useState, useEffect } from 'react';
import { fetchNews } from '../lib/api';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { cn } from '../lib/utils';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'politics', label: 'Politics' },
  { key: 'health', label: 'Health' },
  { key: 'tech', label: 'Tech' },
  { key: 'science', label: 'Science' },
];

const FILTERS = [
  { key: 'all', label: 'All Posts' },
  { key: 'news', label: 'News' },
  { key: 'social', label: 'Social' },
  { key: 'verified', label: '\u2713 Verified' },
  { key: 'flagged', label: '\u26a0 Flagged' },
];

export default function FeedView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = async (cat: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchNews(cat);
      setPosts(data.articles || []);
    } catch {
      setError('Failed to load news. Make sure the API server is running (npm start).');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews(category);
  }, [category]);

  const filteredPosts = posts.filter((p) => {
    if (filter === 'news') return p.postType === 'news' || !p.postType;
    if (filter === 'social') return p.postType === 'social';
    if (filter === 'verified') return p.status === 'verified';
    if (filter === 'flagged') return p.status === 'disputed' || p.status === 'misleading';
    return true;
  });

  const stats = {
    total: posts.length,
    verified: posts.filter(p => p.status === 'verified').length,
    unverified: posts.filter(p => p.status === 'unverified').length,
    flagged: posts.filter(p => p.status === 'disputed' || p.status === 'misleading').length,
  };

  return (
    <div className="flex flex-col gap-0 pb-20">
      <div className="px-4 py-3 border-b border-[#2f3336]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#e7e9ea]">Feed</h1>
          <button
            onClick={() => loadNews(category, true)}
            disabled={refreshing}
            className="text-[#71767b] hover:text-[#e7e9ea] text-xs font-bold transition-colors"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                category === cat.key
                  ? "bg-[#e7e9ea] text-black"
                  : "bg-[#16181c] text-[#71767b] border border-[#2f3336] hover:text-[#e7e9ea] hover:bg-[#1d1f23]"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold transition-all",
                filter === f.key
                  ? "bg-[#1d9bf0]/10 text-[#1d9bf0] border border-[#1d9bf0]/30"
                  : "text-[#71767b] hover:text-[#e7e9ea] hover:bg-[#16181c]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {!loading && posts.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#2f3336] text-[11px]">
          <span className="text-[#71767b]">{stats.total} posts</span>
          <span className="text-[#00ba7c]">{stats.verified} verified</span>
          <span className="text-[#f7931a]">{stats.unverified} unverified</span>
          {stats.flagged > 0 && <span className="text-[#f4212e]">{stats.flagged} flagged</span>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b border-[#2f3336] p-4 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-9 h-9 bg-[#2f3336] rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-[#2f3336] rounded mb-2" />
                  <div className="h-3 w-24 bg-[#16181c] rounded" />
                </div>
              </div>
              <div className="ml-[46px]">
                <div className="h-5 w-3/4 bg-[#2f3336] rounded mb-3" />
                <div className="h-4 w-full bg-[#16181c] rounded mb-2" />
                <div className="h-4 w-2/3 bg-[#16181c] rounded mb-4" />
                <div className="h-48 bg-[#16181c] rounded-2xl mb-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="bg-[#16181c] border border-[#2f3336] rounded-xl p-6 text-center mx-4 mt-4">
          <p className="text-[#f4212e] font-medium mb-3">{error}</p>
          <button onClick={() => loadNews(category)} className="text-xs font-bold text-[#e7e9ea] underline">
            Try Again
          </button>
        </div>
      )}

      {!loading &&
        filteredPosts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}

      {!loading && !error && filteredPosts.length === 0 && (
        <div className="text-center py-16 text-[#71767b]">
          <p className="text-lg font-bold">No posts match this filter</p>
          <p className="text-sm mt-1">Try a different filter or category</p>
        </div>
      )}
    </div>
  );
}
