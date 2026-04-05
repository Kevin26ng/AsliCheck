/* content.js — AsliCheck content script: tooltip on selection + overlay panel */
(() => {
  'use strict';

  const API_BASE = 'http://localhost:3001/api';
  const TIMEOUT_MS = 6000;

  /* ── Inline mock data (same as popup.js) ── */
  const MOCK = {
    'Drinking hot water with lemon cures COVID-19': {
      status: 'misleading', confidence: 96,
      summary: 'No scientific evidence supports this. Debunked by WHO, CDC, and peer-reviewed studies.',
      discrepancies: ['No peer-reviewed study supports this.', 'WHO lists it as a myth.'],
      sources: [{ name: 'WHO', title: 'Myth busters – COVID-19', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' }],
    },
    'NASA confirms water on Mars surface': {
      status: 'verified', confidence: 88,
      summary: 'NASA confirmed evidence of water on Mars (hydrated salts, subsurface radar data). Broadly accurate but oversimplified.',
      discrepancies: ['Surface liquid water not directly observed.'],
      sources: [{ name: 'NASA JPL', title: 'Evidence of Liquid Water on Mars', url: 'https://www.nasa.gov/solar-system/nasa-confirms-evidence-that-liquid-water-flows-on-todays-mars/' }],
    },
    '5G cell towers cause cancer': {
      status: 'misleading', confidence: 97,
      summary: 'No causal link found. 5G uses non-ionizing frequencies that cannot damage DNA.',
      discrepancies: ['No peer-reviewed study links 5G to cancer.'],
      sources: [{ name: 'WHO', title: 'EMF and public health', url: 'https://www.who.int/news-room/fact-sheets/detail/electromagnetic-fields-and-public-health-mobile-phones' }],
    },
  };

  function getMock(claim) {
    if (MOCK[claim]) return MOCK[claim];
    const lower = claim.toLowerCase();
    const bad = ['cure', 'miracle', 'conspiracy', 'secret', 'exposed', 'shocking'];
    if (bad.some(w => lower.includes(w))) {
      return { status: 'disputed', confidence: 58, summary: 'This claim contains language commonly associated with misinformation.', discrepancies: ['Sensationalist language detected.'], sources: [{ name: 'Snopes', title: 'Fact-checking', url: 'https://www.snopes.com/' }] };
    }
    return { status: 'unverified', confidence: 55, summary: 'Could not be verified against known databases. Check trusted fact-checking organizations.', discrepancies: ['No authoritative source found.'], sources: [{ name: 'Snopes', title: 'Fact-checking', url: 'https://www.snopes.com/' }, { name: 'PolitiFact', title: 'Fact-checking', url: 'https://www.politifact.com/' }] };
  }

  async function fetchAnalysis(claim) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error();
      return await r.json();
    } catch {
      clearTimeout(t);
      return getMock(claim);
    }
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function statusLabel(s) {
    if (s === 'verified') return '✅ Verified';
    if (s === 'unverified') return '🔍 Unverified';
    if (s === 'disputed') return '⚠️ Disputed';
    return '❌ Misleading';
  }

  /* ── Selection tooltip ── */
  let tooltip = null;

  function removeTooltip() {
    if (tooltip) { tooltip.remove(); tooltip = null; }
  }

  function showTooltip(x, y, text) {
    removeTooltip();
    tooltip = document.createElement('div');
    tooltip.id = 'aslicheck-tooltip';
    tooltip.innerHTML = `<span class="ac-tt-icon">✓</span><span class="ac-tt-text">Verify with AsliCheck</span>`;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    document.body.appendChild(tooltip);

    tooltip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeTooltip();
      showOverlay(text);
    });
  }

  document.addEventListener('mouseup', (e) => {
    // Ignore clicks inside our own UI
    if (e.target.closest('#aslicheck-overlay') || e.target.closest('#aslicheck-tooltip')) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length > 10 && text.length < 5000) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTooltip(
          rect.left + window.scrollX + rect.width / 2 - 90,
          rect.top + window.scrollY - 44,
          text
        );
      } else {
        removeTooltip();
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#aslicheck-tooltip')) removeTooltip();
  });

  /* ── Overlay panel ── */
  function removeOverlay() {
    const existing = document.getElementById('aslicheck-overlay');
    if (existing) existing.remove();
  }

  async function showOverlay(claim) {
    removeOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'aslicheck-overlay';
    overlay.innerHTML = `
      <div id="aslicheck-panel">
        <div class="ac-header">
          <div class="ac-logo">
            <span class="ac-logo-icon">✓</span>
            <span class="ac-logo-text">AsliCheck</span>
          </div>
          <button class="ac-close" id="ac-close-btn">✕</button>
        </div>
        <div class="ac-claim">${esc(claim.length > 200 ? claim.slice(0, 200) + '…' : claim)}</div>
        <div class="ac-loading" id="ac-loading">
          <div class="ac-spinner"></div>
          <div class="ac-loading-text">Analyzing claim…</div>
        </div>
        <div id="ac-result" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close on backdrop click or button
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeOverlay();
    });
    document.getElementById('ac-close-btn').addEventListener('click', removeOverlay);

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') { removeOverlay(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // Fetch result
    const data = await fetchAnalysis(claim);
    const loading = document.getElementById('ac-loading');
    const resultDiv = document.getElementById('ac-result');
    if (!loading || !resultDiv) return; // overlay was closed

    loading.style.display = 'none';
    resultDiv.style.display = 'block';

    let discHtml = '';
    if (data.discrepancies && data.discrepancies.length) {
      discHtml = `
        <div class="ac-section-title">Key Issues</div>
        <ul class="ac-disc-list">${data.discrepancies.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      `;
    }

    let srcHtml = '';
    if (data.sources && data.sources.length) {
      srcHtml = `
        <div class="ac-section-title">Sources</div>
        ${data.sources.map(s => `<a class="ac-source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><div class="ac-source-name">${esc(s.name)}</div><div class="ac-source-title">${esc(s.title)}</div></a>`).join('')}
      `;
    }

    resultDiv.innerHTML = `
      <div class="ac-result-header">
        <span class="ac-status ${data.status}">${statusLabel(data.status)}</span>
        <div class="ac-confidence">
          <span class="ac-conf-label">Confidence</span>
          <span class="ac-conf-value">${data.confidence}%</span>
        </div>
      </div>
      <div class="ac-summary">${esc(data.summary)}</div>
      ${discHtml}
      ${srcHtml}
    `;
  }

  /* ── Listen for context-menu triggers from background.js ── */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'verify' && msg.text) {
      removeTooltip();
      showOverlay(msg.text);
    }
  });
})();
