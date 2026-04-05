import { Post } from '../types';

/* ── Analyzer: mock responses keyed by claim text ── */

export const MOCK_ANALYSIS: Record<string, any> = {
  'Drinking hot water with lemon cures COVID-19': {
    status: 'misleading',
    confidence: 96,
    summary:
      'There is no scientific evidence that drinking hot water with lemon can cure or prevent COVID-19. This claim has been widely debunked by the WHO, CDC, and multiple peer-reviewed studies. While staying hydrated is beneficial for general health, it has no antiviral effect against SARS-CoV-2.',
    discrepancies: [
      'No peer-reviewed study supports lemon water as a COVID-19 cure.',
      'The WHO explicitly lists this as a myth on its COVID-19 myth-busters page.',
      'The claim conflates general hydration benefits with antiviral properties.',
    ],
    sources: [
      { name: 'World Health Organization', title: 'Myth busters – COVID-19', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' },
      { name: 'CDC', title: 'COVID-19 Prevention & Treatment', url: 'https://www.cdc.gov/covid/prevention/index.html' },
      { name: 'Nature Medicine', title: 'Debunking viral COVID-19 cures', url: 'https://www.nature.com/nm/' },
    ],
  },

  'NASA confirms water on Mars surface': {
    status: 'verified',
    confidence: 88,
    summary:
      'NASA has confirmed evidence of water on Mars, though the details are nuanced. In 2015 NASA announced spectral evidence of hydrated salts suggesting seasonal briny water flows (recurring slope lineae). More recently, radar data from the Mars Express orbiter suggested a subsurface lake beneath the south polar ice cap. The claim is broadly accurate but the phrasing "water on Mars surface" oversimplifies — most confirmed water is subsurface ice or transient brine.',
    discrepancies: [
      'Surface liquid water has not been directly observed; evidence is indirect.',
      'Some recurring slope lineae findings were later disputed as dry granular flows.',
    ],
    sources: [
      { name: 'NASA JPL', title: 'NASA Confirms Evidence of Liquid Water on Mars', url: 'https://www.nasa.gov/solar-system/nasa-confirms-evidence-that-liquid-water-flows-on-todays-mars/' },
      { name: 'Science', title: 'Radar evidence of subglacial liquid water on Mars', url: 'https://www.science.org/doi/10.1126/science.aar7268' },
    ],
  },

  '5G cell towers cause cancer': {
    status: 'misleading',
    confidence: 97,
    summary:
      'Extensive scientific research has found no causal link between 5G radio-frequency emissions and cancer. 5G operates on non-ionizing frequencies that do not have enough energy to damage DNA. Major health organizations including the WHO, ICNIRP, and FDA have concluded that current evidence does not support health risks from 5G exposure within established safety limits.',
    discrepancies: [
      'No peer-reviewed epidemiological study links 5G specifically to cancer.',
      'The claim often conflates 5G with higher-energy ionizing radiation.',
      'Regulatory bodies worldwide have set exposure limits well below harmful thresholds.',
    ],
    sources: [
      { name: 'WHO', title: 'Electromagnetic fields and public health: mobile phones', url: 'https://www.who.int/news-room/fact-sheets/detail/electromagnetic-fields-and-public-health-mobile-phones' },
      { name: 'ICNIRP', title: 'Guidelines for Limiting Exposure to EMF (2020)', url: 'https://www.icnirp.org/en/activities/news/news-article/rf-guidelines-2020-published.html' },
      { name: 'FDA', title: 'Scientific Evidence for Cell Phone Safety', url: 'https://www.fda.gov/radiation-emitting-products/cell-phones/scientific-evidence-cell-phone-safety' },
    ],
  },

  'The Great Wall of China is visible from space': {
    status: 'disputed',
    confidence: 82,
    summary:
      'This is a popular myth. The Great Wall of China is generally not visible to the naked eye from low Earth orbit, let alone from the Moon. Multiple astronauts, including Chinese astronaut Yang Liwei, have confirmed they could not see it. While the Wall is extremely long, it is relatively narrow (about 5-8 meters wide) and blends with the surrounding landscape. Under very specific conditions with ideal lighting, some astronauts have reported barely spotting it with camera assistance.',
    discrepancies: [
      'Multiple astronauts have directly stated they cannot see the Wall from orbit.',
      'The Wall is only ~5-8 meters wide, far below naked-eye resolution from orbit.',
      'NASA has officially stated the Wall is not visible from space without aid.',
    ],
    sources: [
      { name: 'NASA', title: 'Is the Great Wall of China Visible from Space?', url: 'https://www.nasa.gov/mission/station/research-explorer/investigation/?#id=7680' },
      { name: 'Scientific American', title: 'Fact or Fiction: The Great Wall from Space', url: 'https://www.scientificamerican.com/article/is-chinas-great-wall-visible-from-space/' },
    ],
  },

  'Eating carrots significantly improves night vision': {
    status: 'disputed',
    confidence: 78,
    summary:
      'This claim is a mix of truth and wartime propaganda. Carrots contain beta-carotene, which the body converts to vitamin A — essential for healthy vision including night vision. However, eating extra carrots beyond normal dietary needs does not "significantly improve" night vision. The myth was amplified by British WWII propaganda designed to explain the success of radar-assisted night fighters without revealing the radar technology.',
    discrepancies: [
      'Vitamin A deficiency can impair night vision, but excess vitamin A provides no enhancement.',
      'The "carrots improve night vision" narrative originated as WWII disinformation.',
      'No clinical study shows above-normal carrot consumption enhances night sight.',
    ],
    sources: [
      { name: 'Smithsonian Magazine', title: 'A WWII Propaganda Campaign Popularized the Myth', url: 'https://www.smithsonianmag.com/arts-culture/a-wwii-propaganda-campaign-popularized-the-myth-that-carrots-help-you-see-in-the-dark-28812484/' },
      { name: 'Harvard Health', title: 'Vitamin A and vision: what the evidence shows', url: 'https://www.health.harvard.edu/staying-healthy/what-can-help-with-your-night-vision' },
    ],
  },
};

/** Return mock analysis for a claim. Falls back to a generic response. */
export function getMockAnalysis(claim: string) {
  if (MOCK_ANALYSIS[claim]) return MOCK_ANALYSIS[claim];

  // Generic fallback for arbitrary claims
  return {
    status: 'unverified',
    confidence: 55,
    summary:
      `The claim "${claim}" could not be verified against known databases. The analysis is based on limited information and no authoritative sources were found to confirm or deny this claim. We recommend checking with trusted fact-checking organizations.`,
    discrepancies: [
      'No authoritative source found to confirm this claim.',
      'The claim may require more context for proper verification.',
    ],
    sources: [
      { name: 'Snopes', title: 'Fact-checking resource', url: 'https://www.snopes.com/' },
      { name: 'PolitiFact', title: 'Fact-checking resource', url: 'https://www.politifact.com/' },
    ],
  };
}

/* ── Assistant: mock chat responses ── */

const CHAT_RESPONSES: { pattern: RegExp; content: string; analysis?: any }[] = [
  {
    pattern: /verify.*link|check.*url|link.*safe/i,
    content:
      'To verify a link, paste the full URL here and I\'ll analyze the domain reputation, check it against known misinformation databases, and look for any red flags such as clickbait patterns, fake domain impersonation, or previously flagged content.',
  },
  {
    pattern: /trust\s*tag|what.*trust|explain.*tag/i,
    content:
      'Trust Tags are labels assigned to news articles and social media posts by AsliCheck\'s AI engine:\n\n✅ **Verified** — Cross-referenced with multiple reliable sources and confirmed accurate.\n⚠️ **Disputed** — Conflicting information found; some sources support it, others refute it.\n❌ **Misleading** — Contains claims that are factually incorrect or deliberately deceptive.\n🔍 **Unverified** — Not enough evidence found to confirm or deny the claim.\n\nConfidence percentages indicate how strongly the AI assessment is supported by available evidence.',
  },
  {
    pattern: /today.*fact.?check|top.*fact|recent.*check/i,
    content:
      'Here are today\'s top fact-checks:\n\n1. 🔴 "New miracle supplement cures all allergies" — **Misleading** (97% confidence). No clinical trials support this claim.\n\n2. 🟡 "Government announces free solar panels for all homeowners" — **Disputed** (72% confidence). A subsidy program exists but eligibility is limited.\n\n3. 🟢 "Scientists discover high high high high-efficiency carbon capture method" — **Verified** (91% confidence). Published in Nature this week.\n\n4. 🔴 "Drinking alkaline water prevents cancer" — **Misleading** (95% confidence). No peer-reviewed evidence supports this.\n\n5. 🟡 "Major tech company to lay off 20,000 employees" — **Unverified** (60% confidence). Only one anonymous source; company has not confirmed.',
  },
  {
    pattern: /covid|vaccine|pandemic/i,
    content:
      'COVID-19 misinformation remains one of the most widespread categories. Here\'s what the evidence says:\n\n• Vaccines: Extensively tested and monitored. Side effects are tracked by VAERS, the WHO, and EMA. Serious side effects are extremely rare.\n• "Natural immunity is better": Studies show hybrid immunity (infection + vaccine) offers strongest protection, but vaccination is far safer than infection.\n• Masks: Meta-analyses confirm masks reduce transmission, especially high-quality masks (N95/KN95).\n\nAlways check claims against the WHO, CDC, and peer-reviewed journals.',
    analysis: { tag: 'Verified', details: 'Cross-referenced with WHO, CDC, and peer-reviewed meta-analyses.' },
  },
  {
    pattern: /how.*work|what.*aslicheck|about/i,
    content:
      'AsliCheck uses a multi-step AI verification pipeline:\n\n1. **Claim Extraction** — We parse the core factual claim from a headline or post.\n2. **Source Cross-Referencing** — The claim is checked against trusted news databases, fact-checking APIs, and scientific literature.\n3. **Sentiment & Bias Analysis** — We detect emotional manipulation, clickbait patterns, and ideological framing.\n4. **AI Content Detection** — Posts are scanned for signs of AI-generated text or deepfake media.\n5. **Trust Scoring** — A confidence score is computed and a Trust Tag is assigned.\n\nThe entire process typically takes a few seconds.',
  },
];

const GENERIC_CHAT_RESPONSE = {
  content:
    'That\'s an interesting question. Based on my analysis, I\'d recommend checking this claim against multiple authoritative sources. Here are some general tips:\n\n• Look for the original source — who first published the claim?\n• Check if established fact-checking organizations (Snopes, PolitiFact, FactCheck.org) have covered it.\n• Be wary of emotional language, urgency, and lack of citations.\n• Cross-reference with at least 2–3 independent, reputable outlets.\n\nWould you like me to analyze a specific claim or URL?',
};

export function getMockChatResponse(message: string): { content: string; analysis?: any } {
  for (const entry of CHAT_RESPONSES) {
    if (entry.pattern.test(message)) {
      return { content: entry.content, analysis: entry.analysis };
    }
  }
  return GENERIC_CHAT_RESPONSE;
}

/* ── Feed: mock news articles ── */

export const MOCK_FEED_ARTICLES: Post[] = [
  {
    id: 'mock-1',
    title: 'New Policy Reform Shows Immediate Impact on Urban Sustainability Infrastructure',
    content:
      'A comprehensive analysis of the latest urban planning data confirms that the decentralized energy initiative has reduced carbon footprints in three major metros by 14% this quarter.',
    author: '@JournalDaily',
    timestamp: '2h ago',
    status: 'verified',
    confidence: 94,
    imageUrl: 'https://picsum.photos/seed/city/800/450',
    likes: 1200,
    comments: 84,
    shares: 210,
    sourceUrl: 'https://twitter.com/journaldaily/status/1',
    sourceDomain: 'twitter.com',
    postType: 'news',
  },
  {
    id: 'mock-2',
    title: 'Viral Influencer "Deepfake" Video Circulates Across Major Social Platforms',
    content:
      'A highly realistic video of a prominent lifestyle influencer making controversial statements has been flagged. Initial forensic analysis suggests sophisticated AI synthesis.',
    author: '@TechWhisperer',
    timestamp: '4h ago',
    status: 'misleading',
    confidence: 91,
    imageUrl: 'https://picsum.photos/seed/influencer/800/450',
    isAiGenerated: true,
    likes: 4500,
    comments: 312,
    shares: 890,
    factCheck:
      'Forensic tools identified consistent artifacts in the facial mapping and audio synchronization, confirming this is a deepfake.',
    sourceUrl: 'https://reddit.com/r/tech/comments/2',
    sourceDomain: 'reddit.com',
    postType: 'social',
  },
  {
    id: 'mock-3',
    title: 'Controversial Report Claims Global Markets to Face Unprecedented Downturn by Friday',
    content:
      'This claim is based on a single anonymous source. Major financial institutions report stable growth forecasts for the upcoming quarter.',
    author: '@EconomyWatch',
    timestamp: '6h ago',
    status: 'disputed',
    confidence: 45,
    likes: 890,
    comments: 156,
    shares: 67,
    factCheck:
      'This claim is based on a single anonymous source. Major financial institutions report stable growth forecasts for the upcoming quarter.',
    sourceUrl: 'https://facebook.com/economywatch/posts/3',
    sourceDomain: 'facebook.com',
    postType: 'news',
  },
  {
    id: 'mock-4',
    title: '"Digital Detox" Movement Gains Massive Traction in Gen Z Communities',
    content:
      'New data shows a 40% increase in the use of non-smart "feature phones" among users aged 18-24, signaling a significant shift in digital consumption habits.',
    author: '@ViralNewsDaily',
    timestamp: '8h ago',
    status: 'unverified',
    confidence: 62,
    imageUrl: 'https://picsum.photos/seed/detox/800/450',
    likes: 2300,
    comments: 45,
    shares: 310,
    sourceUrl: 'https://instagram.com/p/4',
    sourceDomain: 'instagram.com',
    postType: 'social',
  },
  {
    id: 'mock-5',
    title: 'EU Passes Landmark AI Transparency Act Requiring Model Disclosure',
    content:
      'The European Parliament has approved the AI Transparency Act, mandating that companies disclose training data sources and model architectures for high-risk AI systems deployed in the EU.',
    author: '@EuroTechPolicy',
    timestamp: '10h ago',
    status: 'verified',
    confidence: 97,
    imageUrl: 'https://picsum.photos/seed/eu-ai/800/450',
    likes: 3100,
    comments: 220,
    shares: 540,
    sourceUrl: 'https://twitter.com/eurotechpolicy/status/5',
    sourceDomain: 'twitter.com',
    postType: 'news',
  },
  {
    id: 'mock-6',
    title: 'Viral Post Claims New Smartphone Battery Lasts 30 Days on Single Charge',
    content:
      'A social media post claiming a new graphene battery technology enables 30-day smartphone usage has gone viral. Battery experts say the claim exaggerates real advances in solid-state battery research.',
    author: '@GadgetLeaks',
    timestamp: '12h ago',
    status: 'misleading',
    confidence: 85,
    likes: 5800,
    comments: 430,
    shares: 1200,
    factCheck:
      'While solid-state battery research is advancing, no current technology supports 30-day smartphone battery life. The original post misrepresents a lab prototype\'s results.',
    sourceUrl: 'https://reddit.com/r/gadgets/comments/6',
    sourceDomain: 'reddit.com',
    postType: 'social',
  },
];
