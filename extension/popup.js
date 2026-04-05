/* popup.js — AsliCheck browser extension popup */

const API_BASE = 'http://localhost:3001/api';
const TIMEOUT_MS = 6000;

/* ── Mock data (mirrors the main app) ── */
const MOCK_ANALYSIS = {
  'Drinking hot water with lemon cures COVID-19': {
    status: 'misleading', confidence: 96,
    summary: 'There is no scientific evidence that drinking hot water with lemon can cure or prevent COVID-19. This claim has been widely debunked by the WHO, CDC, and multiple peer-reviewed studies.',
    discrepancies: ['No peer-reviewed study supports lemon water as a COVID-19 cure.', 'The WHO lists this as a myth on its COVID-19 myth-busters page.'],
    sources: [
      { name: 'WHO', title: 'Myth busters – COVID-19', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' },
      { name: 'CDC', title: 'COVID-19 Prevention & Treatment', url: 'https://www.cdc.gov/covid/prevention/index.html' },
    ],
  },
  'NASA confirms water on Mars surface': {
    status: 'verified', confidence: 88,
    summary: 'NASA has confirmed evidence of water on Mars – spectral evidence of hydrated salts and radar data suggesting subsurface lakes. The phrasing oversimplifies; most confirmed water is subsurface ice or transient brine.',
    discrepancies: ['Surface liquid water has not been directly observed.', 'Some recurring slope lineae findings were later disputed.'],
    sources: [
      { name: 'NASA JPL', title: 'Evidence of Liquid Water on Mars', url: 'https://www.nasa.gov/solar-system/nasa-confirms-evidence-that-liquid-water-flows-on-todays-mars/' },
    ],
  },
  '5G cell towers cause cancer': {
    status: 'misleading', confidence: 97,
    summary: 'Extensive scientific research has found no causal link between 5G radio-frequency emissions and cancer. 5G operates on non-ionizing frequencies that cannot damage DNA.',
    discrepancies: ['No peer-reviewed study links 5G to cancer.', 'Conflates 5G with ionizing radiation.'],
    sources: [
      { name: 'WHO', title: 'EMF and public health', url: 'https://www.who.int/news-room/fact-sheets/detail/electromagnetic-fields-and-public-health-mobile-phones' },
    ],
  },
};

function getMockAnalysis(claim) {
  if (MOCK_ANALYSIS[claim]) return MOCK_ANALYSIS[claim];
  const lower = claim.toLowerCase();
  const sensational = ['cure', 'miracle', "they don't want", 'conspiracy', 'secret', 'exposed', 'shocking'];
  const questionable = sensational.some(w => lower.includes(w));

  if (questionable) {
    return {
      status: 'disputed', confidence: 58,
      summary: `The claim contains language commonly associated with misinformation. Multiple red flags detected. We recommend verifying with credible sources.`,
      discrepancies: ['Sensationalist language detected.', 'No credible source found.'],
      sources: [
        { name: 'Snopes', title: 'Fact-checking resource', url: 'https://www.snopes.com/' },
        { name: 'PolitiFact', title: 'Fact-checking resource', url: 'https://www.politifact.com/' },
      ],
    };
  }

  return {
    status: 'unverified', confidence: 55,
    summary: `The claim "${claim.slice(0, 80)}${claim.length > 80 ? '…' : ''}" could not be verified against known databases. We recommend checking with trusted fact-checking organisations.`,
    discrepancies: ['No authoritative source found to confirm this claim.'],
    sources: [
      { name: 'Snopes', title: 'Fact-checking resource', url: 'https://www.snopes.com/' },
      { name: 'PolitiFact', title: 'Fact-checking resource', url: 'https://www.politifact.com/' },
    ],
  };
}

/* ── API call with timeout + fallback ── */
async function analyzeClaim(claim) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    clearTimeout(timer);
    return getMockAnalysis(claim);
  }
}

/* ── Status helpers ── */
function statusLabel(s) {
  if (s === 'verified') return '✅ Verified';
  if (s === 'unverified') return '🔍 Unverified';
  if (s === 'disputed') return '⚠️ Disputed';
  return '❌ Misleading';
}

/* ── DOM refs ── */
const inputSection = document.getElementById('input-section');
const resultSection = document.getElementById('result-section');
const claimInput = document.getElementById('claim-input');
const verifyBtn = document.getElementById('verify-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const backBtn = document.getElementById('back-btn');
const statusBadge = document.getElementById('status-badge');
const confValue = document.getElementById('confidence-value');
const summaryText = document.getElementById('summary-text');
const discBox = document.getElementById('discrepancies-box');
const discList = document.getElementById('discrepancies-list');
const srcBox = document.getElementById('sources-box');
const srcList = document.getElementById('sources-list');

/* ── Render result ── */
function showResult(data) {
  inputSection.classList.add('hidden');
  resultSection.classList.remove('hidden');

  statusBadge.textContent = statusLabel(data.status);
  statusBadge.className = data.status;
  confValue.textContent = `${data.confidence}%`;
  summaryText.textContent = data.summary;

  if (data.discrepancies && data.discrepancies.length) {
    discBox.classList.remove('hidden');
    discList.innerHTML = '';
    data.discrepancies.forEach(d => {
      const li = document.createElement('li');
      li.textContent = d;
      discList.appendChild(li);
    });
  } else {
    discBox.classList.add('hidden');
  }

  if (data.sources && data.sources.length) {
    srcBox.classList.remove('hidden');
    srcList.innerHTML = '';
    data.sources.forEach(s => {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = `<div class="source-name">${escapeHtml(s.name)}</div><div class="source-title">${escapeHtml(s.title)}</div>`;
      srcList.appendChild(a);
    });
  } else {
    srcBox.classList.add('hidden');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── Event handlers ── */
verifyBtn.addEventListener('click', async () => {
  const claim = claimInput.value.trim();
  if (!claim) return;
  verifyBtn.disabled = true;
  btnText.textContent = 'Analyzing…';
  btnLoader.classList.remove('hidden');

  const result = await analyzeClaim(claim);
  showResult(result);

  verifyBtn.disabled = false;
  btnText.textContent = 'Verify Now';
  btnLoader.classList.add('hidden');
});

claimInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    verifyBtn.click();
  }
});

backBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  claimInput.value = '';
  claimInput.focus();
});

/* ── Pre-fill from context menu selection (passed via storage) ── */
chrome.storage.local.get('pendingClaim', (data) => {
  if (data.pendingClaim) {
    claimInput.value = data.pendingClaim;
    chrome.storage.local.remove('pendingClaim');
    verifyBtn.click();
  }
});
