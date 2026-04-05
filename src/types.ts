export type VerificationStatus = 'verified' | 'unverified' | 'disputed' | 'misleading';

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  timestamp: string;
  status: VerificationStatus;
  confidence?: number;
  imageUrl?: string;
  likes: number;
  comments: number;
  shares?: number;
  factCheck?: string;
  isAiGenerated?: boolean;
  sourceUrl: string;
  sourceDomain?: string;
  postType?: 'news' | 'social';
}

export interface TrendingNews {
  id: string;
  category: string;
  title: string;
  count: string;
  type: 'verification' | 'flag';
}

export interface Source {
  id: string;
  name: string;
  initials: string;
  reliability: number;
  color: string;
}
