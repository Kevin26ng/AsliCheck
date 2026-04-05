import { Post, TrendingNews, Source } from './types';

export const MOCK_POSTS: Post[] = [
  {
    id: '1',
    title: 'New Policy Reform Shows Immediate Impact on Urban Sustainability Infrastructure',
    content: 'A comprehensive analysis of the latest urban planning data confirms that the decentralized energy initiative has reduced carbon footprints in three major metros by 14% this quarter.',
    author: '@JournalDaily',
    timestamp: '2h ago',
    status: 'verified',
    imageUrl: 'https://picsum.photos/seed/city/800/450',
    likes: 1200,
    comments: 84,
    sourceUrl: 'https://twitter.com/journaldaily/status/1',
  },
  {
    id: '2',
    title: 'Viral Influencer "Deepfake" Video Circulates Across Major Social Platforms',
    content: 'A highly realistic video of a prominent lifestyle influencer making controversial statements has been flagged. Initial forensic analysis suggests sophisticated AI synthesis.',
    author: '@TechWhisperer',
    timestamp: '4h ago',
    status: 'misleading',
    imageUrl: 'https://picsum.photos/seed/influencer/800/450',
    isAiGenerated: true,
    likes: 4500,
    comments: 312,
    sourceUrl: 'https://reddit.com/r/tech/comments/2',
    factCheck: 'Forensic tools identified consistent artifacts in the facial mapping and audio synchronization, confirming this is a deepfake.'
  },
  {
    id: '3',
    title: 'Controversial Report Claims Global Markets to Face Unprecedented Downturn by Friday',
    content: 'This claim is based on a single anonymous source. Major financial institutions report stable growth forecasts for the upcoming quarter.',
    author: '@EconomyWatch',
    timestamp: '6h ago',
    status: 'disputed',
    factCheck: 'This claim is based on a single anonymous source. Major financial institutions report stable growth forecasts for the upcoming quarter.',
    likes: 890,
    comments: 156,
    sourceUrl: 'https://facebook.com/economywatch/posts/3',
  },
  {
    id: '4',
    title: 'Ongoing Trend: "Digital Detox" Movement Gains Massive Traction in Gen Z Communities',
    content: 'New data shows a 40% increase in the use of non-smart "feature phones" among users aged 18-24, signaling a significant shift in digital consumption habits.',
    author: '@ViralNewsDaily',
    timestamp: '8h ago',
    status: 'unverified',
    imageUrl: 'https://picsum.photos/seed/detox/800/450',
    likes: 2300,
    comments: 45,
    sourceUrl: 'https://instagram.com/p/4',
  },
];

export const TRENDING_NEWS: TrendingNews[] = [
  {
    id: '1',
    category: 'CLIMATE CHANGE',
    title: 'Arctic Ice Levels Hit 20-Year High',
    count: '4.2k Verifications',
    type: 'verification',
  },
  {
    id: '2',
    category: 'TECH POLICY',
    title: 'EU Passes New AI Transparency Act',
    count: '12.1k Verifications',
    type: 'verification',
  },
  {
    id: '3',
    category: 'HEALTH',
    title: 'Debunked: Miracle Cure for Common Cold',
    count: '890 Misleading Flags',
    type: 'flag',
  },
  {
    id: '4',
    category: 'SOCIAL TREND',
    title: 'Viral "Deepfake" Influencer Video',
    count: '25.4k Flags',
    type: 'flag',
  },
  {
    id: '5',
    category: 'LIFESTYLE',
    title: 'Digital Detox Movement Growth',
    count: '1.2k Verifications',
    type: 'verification',
  },
];

export const TOP_SOURCES: Source[] = [
  {
    id: '1',
    name: 'Reuters Today',
    initials: 'RT',
    reliability: 99.8,
    color: 'bg-emerald-600',
  },
  {
    id: '2',
    name: 'New York Times',
    initials: 'N',
    reliability: 98.4,
    color: 'bg-zinc-900',
  },
];
