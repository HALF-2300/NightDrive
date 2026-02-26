console.log('[ND] app.js LOADED:', location.href);
window.__ND_APP_LOADED = true;
document.documentElement.setAttribute('data-nd-app', 'loaded');

/* ========================================
   AutoElite — Dark Predator Engine Sound
   ======================================== */
const PredatorAudio = (function () {
  const PLAYED_KEY = 'ae_engine_played';
  let played = false;

  function playOnce() {
    if (played || sessionStorage.getItem(PLAYED_KEY)) return;
    played = true;
    sessionStorage.setItem(PLAYED_KEY, '1');
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dur = 2.2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        const rumble = Math.sin(2 * Math.PI * 42 * t) * 0.3 +
                       Math.sin(2 * Math.PI * 84 * t) * 0.15 +
                       Math.sin(2 * Math.PI * 126 * t) * 0.08 +
                       (Math.random() - 0.5) * 0.05;
        const env = t < 0.3 ? t / 0.3 : t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.7) : 1;
        data[i] = rumble * env * 0.12;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close();
    } catch (e) {}
  }

  function init() {
    if (sessionStorage.getItem(PLAYED_KEY)) return;
    const handler = () => {
      playOnce();
      document.removeEventListener('click', handler);
      document.removeEventListener('scroll', handler);
    };
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('scroll', handler, { once: true, passive: true });
  }

  return { init };
})();

/* ========================================
   AutoElite — Location Detection
   ======================================== */
const UserLocation = (function () {
  const STORAGE_KEY = 'ae_user_location';
  const PROMPT_KEY = 'nd_loc_prompt';
  const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
  const PROMPT_COOLDOWN_MS = 10 * 60 * 1000;  // show again at most once after 10 min
  const PROMPT_MAX_SHOWS = 2;                   // ask at most twice (then never auto-show again)

  function getPromptState() {
    try {
      const raw = localStorage.getItem(PROMPT_KEY);
      return raw ? JSON.parse(raw) : { count: 0, lastShown: 0 };
    } catch { return { count: 0, lastShown: 0 }; }
  }

  function setPromptShown() {
    const s = getPromptState();
    s.count += 1;
    s.lastShown = Date.now();
    localStorage.setItem(PROMPT_KEY, JSON.stringify(s));
  }

  function get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.ts > EXPIRY_MS) { localStorage.removeItem(STORAGE_KEY); return null; }
      return data;
    } catch { return null; }
  }

  function save(loc) {
    loc.ts = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    updateNavLabel(loc);
    window.dispatchEvent(new CustomEvent('ae:location', { detail: loc }));
  }

  function updateNavLabel(loc) {
    const label = document.getElementById('navLocLabel');
    const btn = document.getElementById('navLocBtn');
    if (label && loc && loc.city) {
      label.textContent = loc.city + (loc.state ? ', ' + loc.state : '');
      if (btn) btn.classList.add('has-loc');
    }
  }

  function reverseGeocode(lat, lng) {
    return fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    })
    .then(r => r.json())
    .then(data => {
      const addr = data.address || {};
      return {
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || '',
        zip: addr.postcode || '',
        country: addr.country_code || '',
        lat: lat,
        lng: lng,
      };
    });
  }

  function geocodeZip(zip) {
    return fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=us&format=json&limit=1&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    })
    .then(r => r.json())
    .then(data => {
      if (!data.length) throw new Error('ZIP not found');
      const item = data[0];
      const addr = item.address || {};
      return {
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || '',
        zip: zip,
        country: addr.country_code || 'us',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });
  }

  function requestGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  function init() {
    const existing = get();
    if (existing) { updateNavLabel(existing); return; }
    const prompt = getPromptState();
    if (prompt.count >= PROMPT_MAX_SHOWS) return;
    if (prompt.count >= 1 && (Date.now() - prompt.lastShown) < PROMPT_COOLDOWN_MS) return;
    setTimeout(() => {
      const overlay = document.getElementById('locOverlay');
      if (overlay) {
        overlay.classList.add('visible');
        setPromptShown();
      }
    }, 800);
  }

  return { get, save, reverseGeocode, geocodeZip, requestGeolocation, updateNavLabel, init };
})();

/* ========================================
   AutoElite — Premium Market-Aware Feed v2
   ======================================== */

/* ── Helpers ── */
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmt = p => '$' + Number(p).toLocaleString('en-US');
const fmtMi = m => m == null ? 'N/A' : Number(m).toLocaleString('en-US') + ' mi';
const fmtCompact = n => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return n.toString();
};

/* ── Card Data Maps ── */
const VARIANT_MAP = {
  'best-value':   { cls: 'card-best-value',   label: 'HUNTED DEAL',  icon: 'fa-bolt' },
  'low-mileage':  { cls: 'card-low-mileage',  label: 'NIGHT PICK',   icon: 'fa-moon' },
  'newly-listed': { cls: 'card-newly-listed',  label: 'HIGH DEMAND',  icon: 'fa-fire' },
};

const DEAL_BADGE_MAP = {
  'great-deal':   { cls: 'deal-great', text: 'HUNTED DEAL' },
  'fair-price':   { cls: 'deal-fair',  text: 'FAIR PRICE' },
  'above-market': { cls: 'deal-above', text: 'OVERPRICED', icon: 'fa-triangle-exclamation' },
};

const TRUST_ICON_MAP = {
  'verified-vin':      { icon: 'fa-shield-halved',    text: 'Verified VIN' },
  'franchise-dealer':  { icon: 'fa-store',            text: 'Franchise Dealer' },
  'one-owner':         { icon: 'fa-user-check',       text: 'One Owner' },
  'clean-title':       { icon: 'fa-file-circle-check',text: 'Clean Title' },
};

function conditionBadge(listing) {
  const t = (listing.inventory_type || '').toLowerCase();
  if (t === 'new')       return { cls: 'badge-new',  text: 'New' };
  if (t === 'certified') return { cls: 'badge-cert', text: 'Certified' };
  const fuel = (listing.build?.fuel_type || '').toLowerCase();
  if (fuel === 'electric') return { cls: 'badge-ev', text: 'EV' };
  return { cls: 'badge-used', text: 'Pre-Owned' };
}

/* ========================================================
   CARD COMPONENT V2 — Price-First, Variant Highlights
   ======================================================== */
function listingCard(l) {
  const meta   = l._meta || {};
  const b      = l.build || {};
  const dealer = l.dealer || {};
  const title  = escapeHtml(l.heading || `${b.year || ''} ${b.make || ''} ${b.model || ''}`.trim());
  const price  = l.price || l.msrp || 0;
  const photo  = l.media?.photo_links?.[0] || '';

  /* Variant */
  const variant    = VARIANT_MAP[meta.variant];
  const variantCls = variant ? ` ${variant.cls}` : '';

  /* Condition badge */
  const cond = conditionBadge(l);

  /* Deal badge */
  const deal     = DEAL_BADGE_MAP[meta.dealBadge];
  const dealIcon = deal && deal.icon ? `<i class="fas ${deal.icon}"></i> ` : '';
  const dealHTML = deal ? `<span class="deal-badge ${deal.cls}">${dealIcon}${deal.text}</span>` : '';

  /* Variant tag (bottom of image) */
  const variantTagHTML = variant
    ? `<div class="card-variant-tag"><i class="fas ${variant.icon}"></i> ${variant.label}</div>`
    : '';

  /* Image — use eager so Edge/Windows doesn't replace with blank placeholders */
  const imgHTML = photo
    ? `<img src="${photo}" alt="${title}" loading="eager" onerror="this.parentElement.innerHTML='<div class=card-placeholder><i class=fas\\ fa-car></i></div>'">`
    : `<div class="card-placeholder"><i class="fas fa-car"></i></div>`;

  /* Location */
  const loc     = [dealer.city, dealer.state].filter(Boolean).map(escapeHtml).join(', ');
  const locHTML = loc ? `<div class="card-location"><i class="fas fa-map-marker-alt"></i> ${loc}</div>` : '';

  /* Variant highlight — contextual merchandising line */
  let highlightHTML = '';
  if (meta.variant === 'best-value' && meta.medianPrice && price && price < meta.medianPrice) {
    const savings = meta.medianPrice - price;
    highlightHTML = `<div class="card-highlight card-hl-crimson"><i class="fas fa-arrow-down"></i> ${fmt(Math.round(savings))} below market</div>`;
  } else if (meta.variant === 'low-mileage' && l.miles != null) {
    highlightHTML = `<div class="card-highlight card-hl-blue"><i class="fas fa-gauge-simple-high"></i> Only ${fmtMi(l.miles)}</div>`;
  } else if (meta.variant === 'newly-listed' && meta.daysSinceFirst != null) {
    const fresh = meta.daysSinceFirst === 0 ? 'Listed today' : `Listed ${meta.daysSinceFirst}d ago`;
    highlightHTML = `<div class="card-highlight card-hl-amber"><i class="fas fa-bolt"></i> ${fresh}</div>`;
  }

  /* Days on market */
  const domHTML = l.dom != null && l.dom > 0
    ? `<span class="card-dom">${l.dom}d on market</span>` : '';

  /* Trust signals (max 2) */
  const signals   = (meta.trustSignals || []).slice(0, 2);
  const trustHTML = signals.length
    ? `<div class="trust-line">${signals.map(s => {
        const t = TRUST_ICON_MAP[s];
        return t ? `<span><i class="fas ${t.icon}"></i> ${t.text}</span>` : '';
      }).join('')}</div>`
    : '';

  /* Monthly estimate disclaimer */
  const estHTML = price
    ? `<span class="card-est">est. ${fmt(Math.round(price / 60))}/mo*</span>`
    : '';

  /* Smart Deal Score (NightDrive) — red/gold, one strong reason */
  const scoreNum = Math.round((meta.score || 0.5) * 100) / 10;
  const scoreCls = (meta.dealBadge === 'great-deal') ? '' : (meta.dealBadge === 'above-market' ? 'above' : 'fair');
  const scoreLabel = meta.dealBadge === 'great-deal' ? 'Smart Deal' : (meta.dealBadge === 'above-market' ? 'Overpriced' : 'Fair price');
  const smartScoreHTML = `<div class="smart-deal-score ${scoreCls}"><i class="fas fa-bolt"></i> ${scoreLabel}: ${scoreNum}/10</div>`;
  let reasonHTML = '';
  if (meta.dealBadge === 'great-deal' && meta.medianPrice && price && price < meta.medianPrice) {
    const below = Math.round(meta.medianPrice - price);
    reasonHTML = `<div class="card-deal-reason"><span><i class="fas fa-arrow-down"></i> ${fmt(below)} below market</span></div>`;
  } else if (meta.dealBadge === 'above-market' || meta.priceFairness <= 0.3) {
    reasonHTML = `<div class="card-deal-reason"><span><i class="fas fa-triangle-exclamation"></i> Above market</span></div>`;
  } else if (meta.freshness >= 0.6) {
    reasonHTML = `<div class="card-deal-reason"><span><i class="fas fa-fire"></i> High demand</span></div>`;
  } else if ((meta.trustSignals || []).length >= 2) {
    reasonHTML = `<div class="card-deal-reason"><span><i class="fas fa-check"></i> Clean history</span></div>`;
  }
  const ctaText = meta.dealBadge === 'great-deal' ? 'See Why This Car Is a Deal' : 'View Deal';
  const ctaHref = '/car-details?id=' + encodeURIComponent(l.id || l.vin);
  const urgencyHTML = '<p class="card-urgency"><i class="fas fa-clock"></i> This deal won\'t last.</p>';

  /* Hunt badges (for Cars Being Hunted Now) */
  const opts = (typeof arguments[1] === 'object' && arguments[1]) ? arguments[1] : {};
  let huntBadgesHTML = '';
  if (opts.hunted) {
    const idNum = parseInt(String(l.id || l.vin).replace(/\D/g, '') || '0', 10);
    const viewing = 12 + (idNum % 28);
    const badges = [];
    if (meta.dealBadge === 'great-deal' && meta.medianPrice && price) badges.push('<span class="card-hunt-badge price-drop">⬇ Price drop</span>');
    if (meta.priceFairness >= 0.5) badges.push('<span class="card-hunt-badge high-demand">🔥 High demand</span>');
    badges.push('<span class="card-hunt-badge viewing">👀 ' + viewing + ' viewing</span>');
    huntBadgesHTML = '<div class="card-hunt-badges">' + badges.join('') + '</div>';
  }

  return `<article class="car-card${variantCls}" data-id="${l.id || l.vin}" data-car-card="1">
    <div class="car-card-img">
      ${opts.hunted ? huntBadgesHTML : ''}
      <div class="card-badges">
        <span class="badge ${cond.cls}">${cond.text}</span>
        ${dealHTML}
      </div>
      <button class="car-card-fav" aria-label="Save ${title}" onclick="event.stopPropagation();this.classList.toggle('active')"><i class="fas fa-heart"></i></button>
      ${imgHTML}
      ${variantTagHTML}
    </div>
    <div class="car-card-body">
      <div class="car-card-price-row">
        <div class="car-card-price">${price ? fmt(price) : 'Call for price'}</div>
        ${estHTML}
      </div>
      ${smartScoreHTML}
      ${reasonHTML}
      ${highlightHTML}
      <h3 class="car-card-name">${title}</h3>
      ${locHTML}
      <div class="car-card-specs">
        <span class="car-spec"><i class="fas fa-road"></i> ${fmtMi(l.miles)}</span>
        <span class="car-spec"><i class="fas fa-gas-pump"></i> ${escapeHtml(b.fuel_type || '—')}</span>
        <span class="car-spec"><i class="fas fa-gears"></i> ${escapeHtml(b.transmission || '—')}</span>
        ${domHTML}
      </div>
      ${trustHTML}
      ${urgencyHTML}
      <div class="car-card-actions">
        <a href="${ctaHref}" class="btn btn-primary btn-sm card-cta">${ctaText}</a>
        <button class="card-save-btn" aria-label="Bookmark ${title}" onclick="event.stopPropagation();this.classList.toggle('saved')"><i class="far fa-bookmark"></i></button>
      </div>
    </div>
  </article>`;
}

function safeCard(v, opts) {
  try {
    return listingCard(v, opts);
  } catch (e) {
    console.warn('[ND] listingCard failed -> using miniCard', e);
    return miniCard(v);
  }
}

/* ── Skeleton V2 — matches card V2 geometry exactly ── */
function skeletonCard() {
  return `<article class="car-card skeleton-card" aria-hidden="true">
    <div class="car-card-img skeleton-img"></div>
    <div class="car-card-body">
      <div class="skeleton-line" style="width:50%;height:20px;margin-bottom:4px"></div>
      <div class="skeleton-line" style="width:35%;height:10px;margin-bottom:10px"></div>
      <div class="skeleton-line" style="width:70%;height:14px;margin-bottom:4px"></div>
      <div class="skeleton-line" style="width:45%;height:10px;margin-bottom:12px"></div>
      <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:6px"></div>
      <div class="skeleton-line" style="width:80%;height:10px;margin-bottom:12px"></div>
      <div class="skeleton-line" style="width:100%;height:36px;border-radius:var(--r-md)"></div>
    </div>
  </article>`;
}

function showSkeletons(container, count) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (el) el.innerHTML = Array(count).fill(skeletonCard()).join('');
}

/* ── API base: set in config.js when frontend is on Pages and API is elsewhere ── */
function apiBase() {
  return (typeof window !== 'undefined' && window.ND_API_BASE) ? String(window.ND_API_BASE).replace(/\/$/, '') : '';
}

/* ── Fetch wrapper: throw on non-OK, safe JSON parse, log source ── */
async function apiFetch(path) {
  let base = (window.ND_API_BASE != null) ? String(window.ND_API_BASE).replace(/\/$/, '') : '';
  let url = base + path;

  let res = await fetch(url, { headers: { Accept: 'application/json' } }).catch(function () { return null; });

  /* If cross-origin request failed (e.g. Render down, CORS), retry same-origin so local server works */
  if ((!res || res.type === 'error') && base) {
    console.warn('[ND] apiFetch failed for', url, '-> retrying same-origin', path);
    url = path;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (e2) {
      throw new Error('apiFetch network error for ' + path + ' (same-origin retry failed)');
    }
  }

  if (!res) throw new Error('apiFetch network error for ' + path);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('apiFetch JSON parse failed for ' + url + ' (status ' + res.status + ')');
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : 'HTTP ' + res.status;
    throw new Error('apiFetch ' + path + ' failed: ' + msg);
  }

  const src = res.headers.get('X-ND-Source');
  if (src) console.log('[ND]', path, 'source=', src);

  return data;
}

/* ── Never blank grid: if 0 cards rendered, run demo render ── */
function ensureNonEmpty(container, renderDemoFn) {
  if (!container) return;
  const cards = container.querySelectorAll('[data-car-card], .car-card');
  if (cards.length === 0) {
    console.warn('[ND] rendered 0 cards -> forcing demo');
    renderDemoFn();
  }
}

function isInventoryPage() {
  const p = (location.pathname || '').toLowerCase();
  return p.includes('inventory');
}

function panicDemo(reason) {
  console.warn('[ND] PANIC DEMO ->', reason);
  try {
    if (isInventoryPage()) renderDemoInventory();
    else renderDemoHome();
  } catch (e) {
    console.error('[ND] PANIC DEMO failed:', e);
    hardInject6Cards();
  }
}

window.addEventListener('error', (e) => {
  // Only panic if the grid has no cards — don't wipe real content for unrelated errors
  const hasCards = document.querySelectorAll('[data-car-card]').length > 0;
  if (!hasCards) panicDemo('window.error: ' + (e?.message || 'unknown'));
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || String(e?.reason || 'unknown');
  const hasCards = document.querySelectorAll('[data-car-card]').length > 0;
  if (!hasCards) panicDemo('unhandledrejection: ' + msg);
});

function miniCard(v) {
  const title = (v && (v.heading || v.title)) ? String(v.heading || v.title) : 'Vehicle';
  const price = (v && (v.price != null)) ? `$${Number(v.price).toLocaleString()}` : '—';
  const img =
    (v && v.media && Array.isArray(v.media.photo_links) && v.media.photo_links[0]) ? v.media.photo_links[0] :
    (v && v.photo) ? v.photo :
    'https://picsum.photos/640/420';

  return `
    <div class="car-card" data-car-card="1" style="border:1px solid rgba(255,255,255,.12); border-radius:14px; overflow:hidden;">
      <div style="aspect-ratio: 16/10; background:#111;">
        <img src="${img}" alt="${title}" loading="eager" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="padding:12px;">
        <div style="font-weight:700; line-height:1.2;">${title}</div>
        <div style="opacity:.85; margin-top:6px;">${price}</div>
      </div>
    </div>
  `;
}

function hardInject6Cards() {
  const grid =
    document.querySelector('#inventoryCars') ||
    document.querySelector('[data-inventory-grid]') ||
    document.querySelector('[data-rail="editorPicks"]') ||
    document.querySelector('#curatedFeed') ||
    document.querySelector('#huntedGrid');

  if (!grid) {
    const wrap = document.createElement('div');
    wrap.id = 'nd-hard-fallback';
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
    wrap.style.gap = '12px';
    wrap.style.padding = '12px';
    document.body.prepend(wrap);
  }

  const target = grid || document.querySelector('#nd-hard-fallback') || document.body;

  const list = (window.demoVehicles && window.demoVehicles.length)
    ? window.demoVehicles.slice(0, 6)
    : new Array(6).fill(0).map((_, i) => ({ heading: `Demo Vehicle ${i+1}`, price: 20000 + i * 1500 }));

  target.style.display = 'grid';
  target.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
  target.style.gap = '12px';

  target.innerHTML = list.map(miniCard).join('');
}

function renderDemoInventory() {
  let grid = document.getElementById('inventoryCars') || document.querySelector('[data-inventory-grid]');
  if (!grid) {
    const wrap = document.createElement('div');
    wrap.id = 'inventoryCars';
    wrap.className = 'cars-grid';
    const main = document.querySelector('main');
    if (main) main.appendChild(wrap);
    else document.body.appendChild(wrap);
    grid = wrap;
  }
  grid.innerHTML = demoVehicles.map(v => safeCard(v)).join('');
  const countEl = document.querySelector('.results-count');
  if (countEl) countEl.innerHTML = 'Showing <strong>1–' + demoVehicles.length + '</strong> of <strong>' + demoVehicles.length + '</strong>';
}

function renderDemoHome() {
  const feedContainer = document.getElementById('curatedFeed');
  if (!feedContainer) return;
  const rail = feedContainer.querySelector('[data-rail="editorPicks"]');
  /* Never use document.body — inject only into #curatedFeed so we don't wipe the page */
  const target = rail || feedContainer;
  const html = (window.demoVehicles && window.demoVehicles.length ? window.demoVehicles : demoVehicles).slice(0, HOME_RAIL_SIZE).map(v => safeCard(v)).join('');
  if (rail) {
    rail.innerHTML = html;
    var railWrap = rail.closest('.car-rail');
    if (railWrap) railWrap.style.display = '';
  } else {
    var fallbackGrid = feedContainer.querySelector('.cars-grid, [data-rail]');
    if (fallbackGrid) fallbackGrid.innerHTML = html; else feedContainer.insertAdjacentHTML('beforeend', '<div class="cars-grid rail-grid" data-rail="editorPicks">' + html + '</div>');
  }
  var huntedGrid = document.getElementById('huntedGrid');
  if (huntedGrid) huntedGrid.innerHTML = (window.demoVehicles && window.demoVehicles.length ? window.demoVehicles : demoVehicles).slice(0, HOME_RAIL_SIZE).map(l => safeCard(l, { hunted: true })).join('');
}

/* ========================================================
   DEMO FALLBACK
   ======================================================== */
const demoVehicles = [
  { id:'demo-1', heading:'2026 BMW M4 Competition', price:82900, miles:1250, inventory_type:'new', build:{year:2026,make:'BMW',model:'M4 Competition',fuel_type:'Gasoline',transmission:'Automatic',body_type:'Coupe'}, media:{photo_links:['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'New York',state:'NY',dealer_type:'franchise'}, _meta:{score:0.8,variant:'best-value',dealBadge:'great-deal',trustSignals:['verified-vin','franchise-dealer'],priceFairness:0.85,freshness:0.7,mileageValue:0.6,daysSinceFirst:5,medianPrice:91000} },
  { id:'demo-2', heading:'2026 Mercedes-Benz S-Class', price:118300, miles:500, inventory_type:'new', build:{year:2026,make:'Mercedes-Benz',model:'S-Class',fuel_type:'Gasoline',transmission:'Automatic',body_type:'Sedan'}, media:{photo_links:['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'Los Angeles',state:'CA',dealer_type:'franchise'}, _meta:{score:0.75,variant:'low-mileage',dealBadge:'fair-price',trustSignals:['verified-vin','franchise-dealer'],priceFairness:0.5,freshness:0.8,mileageValue:0.9,daysSinceFirst:3,medianPrice:125000} },
  { id:'demo-3', heading:'2025 Tesla Model S Plaid', price:89990, miles:3200, inventory_type:'used', build:{year:2025,make:'Tesla',model:'Model S',fuel_type:'Electric',transmission:'Automatic',body_type:'Sedan'}, media:{photo_links:['https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'San Francisco',state:'CA',dealer_type:'independent'}, _meta:{score:0.7,variant:'newly-listed',dealBadge:null,trustSignals:['verified-vin'],priceFairness:0.5,freshness:0.9,mileageValue:0.85,daysSinceFirst:1,medianPrice:95000} },
  { id:'demo-4', heading:'2025 Porsche 911 Turbo S', price:216100, miles:2100, inventory_type:'certified', build:{year:2025,make:'Porsche',model:'911',fuel_type:'Gasoline',transmission:'Automatic',body_type:'Coupe'}, media:{photo_links:['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'Miami',state:'FL',dealer_type:'franchise'}, _meta:{score:0.72,variant:null,dealBadge:'fair-price',trustSignals:['verified-vin','franchise-dealer','one-owner'],priceFairness:0.55,freshness:0.5,mileageValue:0.7,daysSinceFirst:14,medianPrice:220000} },
  { id:'demo-5', heading:'2026 Toyota RAV4 Hybrid', price:35400, miles:50, inventory_type:'new', build:{year:2026,make:'Toyota',model:'RAV4',fuel_type:'Hybrid',transmission:'Automatic',body_type:'SUV'}, media:{photo_links:['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'Chicago',state:'IL',dealer_type:'franchise'}, _meta:{score:0.78,variant:'best-value',dealBadge:'great-deal',trustSignals:['verified-vin','franchise-dealer'],priceFairness:0.9,freshness:0.6,mileageValue:0.95,daysSinceFirst:8,medianPrice:39500} },
  { id:'demo-6', heading:'2025 Ford Mustang GT', price:42300, miles:8500, inventory_type:'used', build:{year:2025,make:'Ford',model:'Mustang',fuel_type:'Gasoline',transmission:'Manual',body_type:'Coupe'}, media:{photo_links:['https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=640&h=400&fit=crop&auto=format&q=80']}, dealer:{city:'Dallas',state:'TX',dealer_type:'independent'}, _meta:{score:0.65,variant:'low-mileage',dealBadge:'fair-price',trustSignals:['verified-vin'],priceFairness:0.5,freshness:0.4,mileageValue:0.8,daysSinceFirst:20,medianPrice:45000} },
];
window.demoVehicles = demoVehicles;

/* ========================================================
   PAGE: HOME — Curated Rail System (one rail size constant)
   ======================================================== */
const HOME_RAIL_SIZE = 6;  // per-rail count from API; hunted section uses same

async function loadHomeFeed() {
  const feedContainer = document.getElementById('curatedFeed');
  if (!feedContainer) {
    console.warn('[ND] home feed container missing -> demo');
    renderDemoHome();
    return;
  }

  const railGrids = feedContainer.querySelectorAll('.rail-grid');
  railGrids.forEach(g => showSkeletons(g, HOME_RAIL_SIZE));

  try {
    const data = await apiFetch('/api/home-feed');
    const rails = data.rails || {};
    const hasAnyRail = ['editorPicks', 'bestDeals', 'lowMileage', 'justArrived']
      .some(k => Array.isArray(rails[k]) && rails[k].length > 0);
    if (!hasAnyRail) {
      renderDemoHome();
      return;
    }

    const railMap = {
      editorPicks: feedContainer.querySelector('[data-rail="editorPicks"]'),
      bestDeals:   feedContainer.querySelector('[data-rail="bestDeals"]'),
      lowMileage:  feedContainer.querySelector('[data-rail="lowMileage"]'),
      justArrived: feedContainer.querySelector('[data-rail="justArrived"]'),
    };

    const totalEl = feedContainer.querySelector('.total-available');
    if (totalEl && data.totalAvailable) {
      totalEl.textContent = fmtCompact(data.totalAvailable) + '+ vehicles available';
    }

    for (const [key, grid] of Object.entries(railMap)) {
      if (!grid) continue;
      try {
        const items = rails[key] || [];
        const railWrap = grid.closest('.car-rail');
        if (items.length > 0) {
          grid.innerHTML = items.map(safeCard).join('');
          if (railWrap) railWrap.style.display = '';
        } else {
          if (railWrap) railWrap.style.display = 'none';
        }
      } catch (e) {
        console.error('[ND] Rail render failed:', key, e);
      }
    }

    /* Cars Being Hunted Now — same count as one rail (no 4 vs 6 mismatch) */
    const huntedGrid = document.getElementById('huntedGrid');
    if (huntedGrid) {
      const hunted = [...(rails.bestDeals || []), ...(rails.editorPicks || [])];
      const seen = new Set();
      const unique = hunted.filter(x => {
        const id = x.id || x.vin;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      huntedGrid.innerHTML = unique.slice(0, HOME_RAIL_SIZE).map(l => safeCard(l, { hunted: true })).join('');
    }

    var firstRailGrid = feedContainer.querySelector('[data-rail="editorPicks"]');
    if (firstRailGrid) ensureNonEmpty(firstRailGrid, renderDemoHome);
    /* Force first rail visible when we have content */
    var firstRail = feedContainer.querySelector('.car-rail');
    if (firstRail) firstRail.style.removeProperty('display');

    /* Scroll first cars section into view (helps Edge/Windows where hero is empty) */
    var firstCars = document.getElementById('huntedSection') || feedContainer.querySelector('.car-rail');
    if (firstCars && firstCars.querySelector('.car-card')) {
      firstCars.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (err) {
    console.error('[ND] loadHomeFeed failed:', err);
    renderDemoHome();
  }

  /* Delayed safety: if still no cards after 2s, force demo so user always sees cars */
  setTimeout(function () {
    var feed = document.getElementById('curatedFeed');
    if (!feed) return;
    var cards = feed.querySelectorAll('.car-card:not(.skeleton-card)');
    if (cards.length === 0) {
      console.warn('[ND] No cards after load -> forcing demo');
      renderDemoHome();
      var h = document.getElementById('huntedGrid');
      if (h && h.querySelectorAll('.car-card').length === 0) h.innerHTML = (window.demoVehicles || demoVehicles).slice(0, HOME_RAIL_SIZE).map(function (l) { return safeCard(l, { hunted: true }); }).join('');
    }
  }, 2000);
}

/* ── Hero search ── */
function setupHeroSearch() {
  const searchBtn = document.getElementById('heroSearchBtn');
  if (!searchBtn) return;
  searchBtn.addEventListener('click', () => {
    const make  = document.getElementById('sMake')?.value || '';
    const model = document.getElementById('sModel')?.value || '';
    const price = document.getElementById('sPrice')?.value || '';
    const type  = document.getElementById('sType')?.value || '';
    const activeTab = document.querySelector('.search-tab.active')?.dataset?.tab || 'all';
    const params = new URLSearchParams();
    if (make)  params.set('make', make);
    if (model) params.set('model', model);
    if (price) params.set('price', price);
    if (type)  params.set('type', type);
    if (activeTab === 'new')  params.set('car_type', 'new');
    if (activeTab === 'used') params.set('car_type', 'used');
    window.location.href = '/inventory' + (params.toString() ? '?' + params.toString() : '');
  });
}

/* ========================================================
   PAGE: INVENTORY — Single PAGE_SIZE for initial + loadMore
   ======================================================== */
const PAGE_SIZE = 12;  // single source of truth: first render and every load more
let invPage = 0;

async function loadInventory(page, opts) {
  const replace = opts && opts.replace;
  const grid = document.getElementById('inventoryCars') || document.querySelector('[data-inventory-grid]');
  if (!grid) {
    console.warn('[ND] inventory grid container missing -> demo');
    renderDemoInventory();
    return;
  }

  if (replace) invPage = 0;
  else if (typeof page === 'number') invPage = page;
  showSkeletons('inventoryCars', PAGE_SIZE);

  const params = new URLSearchParams(window.location.search);
  const qs = new URLSearchParams();
  qs.set('rows', PAGE_SIZE);
  qs.set('start', invPage * PAGE_SIZE);

  if (params.get('make'))  qs.set('make', params.get('make'));
  if (params.get('model')) qs.set('model', params.get('model'));
  if (params.get('type'))  qs.set('body_type', params.get('type'));

  const priceVal = params.get('price') || '';
  if (priceVal.includes('Under'))      qs.set('price_range', '0-30000');
  else if (priceVal.includes('30'))    qs.set('price_range', '30000-60000');
  else if (priceVal.includes('60'))    qs.set('price_range', '60000-100000');
  else if (priceVal.includes('100'))   qs.set('price_range', '100000-500000');

  /* Sidebar: Make */
  const filterMake = document.getElementById('filterMake')?.value;
  if (filterMake) qs.set('make', filterMake);

  /* Sidebar: Price range */
  const minP = document.querySelector('.price-range input[placeholder="Min"]')?.value;
  const maxP = document.querySelector('.price-range input[placeholder="Max"]')?.value;
  if (minP || maxP) qs.set('price_range', `${minP || '0'}-${maxP || '500000'}`);

  /* Sidebar: Body type */
  const bodyTypes = [];
  document.querySelectorAll('.filter-group').forEach(fg => {
    if (fg.querySelector('h3')?.textContent.trim() === 'Body Type') {
      fg.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const label = cb.closest('label')?.textContent.trim();
        if (label) bodyTypes.push(label);
      });
    }
  });
  if (bodyTypes.length) qs.set('body_type', bodyTypes.join(','));

  /* Sidebar: Fuel type */
  const fuelTypes = [];
  document.querySelectorAll('.filter-group').forEach(fg => {
    if (fg.querySelector('h3')?.textContent.trim() === 'Fuel Type') {
      fg.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const label = cb.closest('label')?.textContent.trim();
        if (label) fuelTypes.push(label === 'Gasoline' ? 'Unleaded' : label);
      });
    }
  });
  if (fuelTypes.length) qs.set('fuel_type', fuelTypes.join(','));

  /* Sidebar: Transmission */
  const transTypes = [];
  document.querySelectorAll('.filter-group').forEach(fg => {
    if (fg.querySelector('h3')?.textContent.trim() === 'Transmission') {
      fg.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const label = cb.closest('label')?.textContent.trim();
        if (label) transTypes.push(label);
      });
    }
  });
  if (transTypes.length) qs.set('transmission', transTypes.join(','));

  /* Sidebar: Year range */
  const yearFrom = document.getElementById('filterYearFrom')?.value;
  const yearTo = document.getElementById('filterYearTo')?.value;
  if (yearFrom || yearTo) qs.set('year_range', `${yearFrom || '2000'}-${yearTo || '2026'}`);

  /* Sidebar: Mileage */
  const milesMax = document.getElementById('filterMilesMax')?.value;
  if (milesMax) qs.set('miles_range', `0-${milesMax}`);

  /* Sidebar: Condition */
  const condTypes = [];
  document.querySelectorAll('.filter-group').forEach(fg => {
    if (fg.querySelector('h3')?.textContent.trim() === 'Condition') {
      fg.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const label = cb.closest('label')?.textContent.trim().toLowerCase();
        if (label === 'new') condTypes.push('new');
        else if (label === 'pre-owned') condTypes.push('used');
        else if (label === 'certified') condTypes.push('certified');
      });
    }
  });
  if (condTypes.length === 1) qs.set('car_type', condTypes[0]);

  /* Sort */
  const sortSel = document.getElementById('sortSelect')?.value || 'featured';
  if (sortSel === 'price-asc')  { qs.set('sort_by', 'price'); qs.set('sort_order', 'asc'); }
  if (sortSel === 'price-desc') { qs.set('sort_by', 'price'); qs.set('sort_order', 'desc'); }
  if (sortSel === 'newest')     { qs.set('sort_by', 'year');  qs.set('sort_order', 'desc'); }
  if (sortSel === 'mileage')    { qs.set('sort_by', 'miles'); qs.set('sort_order', 'asc'); }

  try {
    const data = await apiFetch('/api/inventory?' + qs.toString());
    const listings = data.listings || [];
    const total = data.num_found || 0;

    if (listings.length === 0) {
      renderDemoInventory();
      updateActiveFilterChips();
      buildPagination(demoVehicles.length);
      return;
    }

    grid.innerHTML = listings.map(safeCard).join('');
    ensureNonEmpty(grid, renderDemoInventory);

    const countEl = document.querySelector('.results-count');
    if (countEl) {
      const start = invPage * PAGE_SIZE + 1;
      const end = invPage * PAGE_SIZE + listings.length;
      countEl.innerHTML = `Showing <strong>${start.toLocaleString()}–${end.toLocaleString()}</strong> of <strong>${total.toLocaleString()}</strong>`;
    }

    updateActiveFilterChips();
    buildPagination(total);

  } catch (err) {
    console.error('[ND] loadInventory failed:', err);
    renderDemoInventory();
  }
}

function updateActiveFilterChips() {
  const container = document.getElementById('activeFilters');
  if (!container) return;
  const chips = [];

  const make = document.getElementById('filterMake')?.value;
  if (make) chips.push({ label: make, clear: () => { document.getElementById('filterMake').value = ''; } });

  const minP = document.querySelector('.price-range input[placeholder="Min"]')?.value;
  const maxP = document.querySelector('.price-range input[placeholder="Max"]')?.value;
  if (minP || maxP) chips.push({ label: `$${minP || '0'} – $${maxP || '∞'}`, clear: () => {
    document.querySelector('.price-range input[placeholder="Min"]').value = '';
    document.querySelector('.price-range input[placeholder="Max"]').value = '';
  }});

  const yFrom = document.getElementById('filterYearFrom')?.value;
  const yTo = document.getElementById('filterYearTo')?.value;
  if (yFrom || yTo) chips.push({ label: `Year: ${yFrom || '—'} – ${yTo || '—'}`, clear: () => {
    document.getElementById('filterYearFrom').value = '';
    document.getElementById('filterYearTo').value = '';
  }});

  document.querySelectorAll('.sidebar input[type="checkbox"]:checked').forEach(cb => {
    const txt = cb.closest('label')?.textContent.trim();
    if (txt && txt !== 'All Vehicles') chips.push({ label: txt, clear: () => { cb.checked = false; } });
  });

  if (chips.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = chips.map((c, i) =>
    `<button class="chip active" data-idx="${i}">${c.label} <i class="fas fa-xmark" style="font-size:0.6rem;opacity:0.7"></i></button>`
  ).join('') + `<button class="chip" id="clearAllFilters">Clear all</button>`;

  container.querySelectorAll('.chip.active').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (chips[idx]) { chips[idx].clear(); loadInventory(0, { replace: true }); }
    });
  });
  document.getElementById('clearAllFilters')?.addEventListener('click', () => {
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    window.history.replaceState({}, '', '/inventory');
    loadInventory(0, { replace: true });
  });
}

function buildPagination(total) {
  const pag = document.querySelector('.pagination');
  if (!pag) return;
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), 50);
  const current = invPage + 1;

  let html = `<button class="page-btn" aria-label="Previous page" ${current === 1 ? 'disabled' : ''} data-page="${invPage - 1}"><i class="fas fa-chevron-left"></i></button>`;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i);
    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') html += `<button class="page-btn" disabled>...</button>`;
    else html += `<button class="page-btn${p === current ? ' active' : ''}" data-page="${p - 1}">${p}</button>`;
  });

  html += `<button class="page-btn" aria-label="Next page" ${current >= totalPages ? 'disabled' : ''} data-page="${invPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
  pag.innerHTML = html;

  pag.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (isNaN(p) || p < 0 || p >= totalPages) return;
      loadInventory(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function setupInventoryFilters() {
  if (!document.getElementById('inventoryCars')) return;
  const applyBtn = document.querySelector('.filter-actions .btn-primary');
  const resetBtn = document.querySelector('.filter-actions .btn-secondary');
  const sortSel = document.getElementById('sortSelect');

  if (applyBtn) applyBtn.addEventListener('click', () => loadInventory(0, { replace: true }));
  if (resetBtn) resetBtn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    window.history.replaceState({}, '', '/inventory');
    loadInventory(0, { replace: true });
  });
  if (sortSel) sortSel.addEventListener('change', () => loadInventory(0, { replace: true }));

  const filterMake = document.getElementById('filterMake');
  if (filterMake) {
    const urlMake = new URLSearchParams(window.location.search).get('make');
    if (urlMake) filterMake.value = urlMake;
  }
}

/* ========================================================
   PAGE: CAR DETAILS
   ======================================================== */
async function loadCarDetails() {
  const detailLayout = document.querySelector('.detail-layout');
  if (!detailLayout) return;

  const params = new URLSearchParams(window.location.search);
  const listingId = params.get('id');
  if (!listingId) return;

  try {
    const listing = await apiFetch(`/api/listing/${encodeURIComponent(listingId)}`);
    if (!listing || listing.error) throw new Error('Listing not found');

    const build = listing.build || {};
    const meta  = listing._meta || {};
    const dealer = listing.dealer || {};
    const title = escapeHtml(listing.heading || `${build.year || ''} ${build.make || ''} ${build.model || ''}`.trim());
    const photos = listing.media?.photo_links || [];

    document.title = `${title} — NightDrive`;

    const h1 = document.querySelector('.hero-page .h1, .page-hero .h1');
    if (h1) h1.textContent = `${build.make || ''} ${build.model || ''}`.trim();

    const breadCurrent = document.querySelector('.breadcrumb .current');
    if (breadCurrent) breadCurrent.textContent = title;

    /* Smart Deal Score block */
    const scoreNum = Math.round((meta.score || 0.5) * 100) / 10;
    const scoreCls = (meta.dealBadge === 'great-deal') ? '' : (meta.dealBadge === 'above-market' ? 'above' : 'fair');
    const scoreLabel = meta.dealBadge === 'great-deal' ? 'Smart Deal' : (meta.dealBadge === 'above-market' ? 'Above market' : 'Fair price');
    const bullets = [];
    if (meta.priceFairness >= 0.7 && meta.medianPrice && listing.price) bullets.push('<span><i class="fas fa-check"></i> Below market price</span>');
    else if (meta.priceFairness <= 0.3) bullets.push('<span><i class="fas fa-info-circle"></i> Above market</span>');
    if ((meta.trustSignals || []).length >= 2) bullets.push('<span><i class="fas fa-check"></i> Clean history</span>');
    if (meta.freshness >= 0.5) bullets.push('<span><i class="fas fa-check"></i> High demand</span>');
    const smartDealEl = document.getElementById('detailSmartDeal');
    if (smartDealEl) {
      smartDealEl.innerHTML = `<div class="smart-deal-score ${scoreCls}"><i class="fas fa-bolt"></i> ${scoreLabel}: ${scoreNum}/10</div>${bullets.length ? '<div class="detail-deal-bullets">' + bullets.join('') + '</div>' : ''}`;
    }

    /* Deal pressure */
    const idNum = parseInt(String(listing.id || listing.vin).replace(/\D/g, '') || '0', 10);
    const viewing = 15 + (idNum % 25);
    const pressureEl = document.getElementById('detailPressure');
    if (pressureEl) {
      pressureEl.innerHTML = `<strong>🔥 High interest right now</strong><br>👀 ${viewing} people viewed today<br>🕒 Updated ${10 + (idNum % 20)} min ago<br><br>⏳ Deals like this usually sell in 2–3 days.`;
    }

    /* Reserve / Compare links (eBay: primary CTA = View on eBay) */
    const reserveBtn = document.getElementById('detailReserveBtn');
    if (reserveBtn) {
      if (listing._source === 'ebay' && listing.itemWebUrl) {
        reserveBtn.href = listing.itemWebUrl;
        reserveBtn.target = '_blank';
        reserveBtn.rel = 'noopener noreferrer';
        reserveBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> View on eBay';
      } else {
        reserveBtn.href = '/contact?car=' + encodeURIComponent(listingId);
        reserveBtn.innerHTML = '<i class="fas fa-bolt"></i> Reserve This Car Now';
      }
    }
    const compareBtn = document.getElementById('detailCompareBtn');
    if (compareBtn && build.make) compareBtn.href = '/inventory?make=' + encodeURIComponent(build.make);

    /* Notify me if price drops */
    const notifyBtn = document.getElementById('detailNotifyBtn');
    if (notifyBtn) {
      notifyBtn.addEventListener('click', () => {
        try {
          const saved = JSON.parse(localStorage.getItem('nd_price_alerts') || '[]');
          if (!saved.includes(listingId)) saved.push(listingId);
          localStorage.setItem('nd_price_alerts', JSON.stringify(saved));
          notifyBtn.innerHTML = '<i class="fas fa-check"></i> We\'ll notify you';
          notifyBtn.disabled = true;
        } catch (e) {
          notifyBtn.innerHTML = '<i class="fas fa-bell"></i> Notify me if price drops';
        }
      });
    }

    /* Gallery */
    const mainImg = document.getElementById('mainImage');
    if (mainImg && photos.length) {
      mainImg.innerHTML = `<img src="${photos[0]}" alt="${title}" style="width:100%;height:100%;object-fit:cover">`;
    }

    const thumbs = document.querySelector('.gallery-thumbs');
    if (thumbs && photos.length > 1) {
      thumbs.innerHTML = photos.slice(0, 8).map((p, i) =>
        `<div class="gallery-thumb${i === 0 ? ' active' : ''}" data-idx="${i}">
          <img src="${p}" alt="Photo ${i + 1}" style="width:100%;height:100%;object-fit:cover">
        </div>`
      ).join('');
      thumbs.querySelectorAll('.gallery-thumb').forEach(th => {
        th.addEventListener('click', () => {
          const idx = parseInt(th.dataset.idx);
          thumbs.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
          th.classList.add('active');
          if (mainImg) mainImg.innerHTML = `<img src="${photos[idx]}" alt="${title}" style="width:100%;height:100%;object-fit:cover">`;
        });
      });
    }

    /* Sidebar info */
    const infoH2 = detailLayout.querySelector('.detail-info .h2');
    if (infoH2) infoH2.textContent = title;

    const subtitle = detailLayout.querySelector('.detail-subtitle');
    if (subtitle) subtitle.textContent = `${build.body_type || 'Vehicle'} — ${listing.exterior_color || 'N/A'}`;

    const priceEl = detailLayout.querySelector('.detail-price');
    if (priceEl) priceEl.textContent = listing.price ? fmt(listing.price) : 'Call for price';

    const estEl = detailLayout.querySelector('.detail-est');
    if (estEl && listing.price) estEl.textContent = `Est. ${fmt(Math.round(listing.price / 60))}/mo with financing*`;

    /* Deal badge */
    const dealBadge = DEAL_BADGE_MAP[meta.dealBadge];
    const badges = detailLayout.querySelector('.detail-info > div:first-child');
    if (badges) {
      const cond = conditionBadge(listing);
      badges.innerHTML = `<span class="badge ${cond.cls}">${cond.text}</span>${dealBadge ? ` <span class="deal-badge ${dealBadge.cls}">${dealBadge.text}</span>` : ''}`;
    }

    /* Specs */
    const specs = detailLayout.querySelectorAll('.detail-spec');
    const specData = [
      { label: 'Mileage', value: fmtMi(listing.miles) },
      { label: 'Transmission', value: build.transmission || 'N/A' },
      { label: 'Fuel Economy', value: build.highway_mpg ? `${build.city_mpg || '—'}/${build.highway_mpg} MPG` : 'N/A' },
      { label: 'Engine', value: build.engine || (build.cylinders ? `${build.cylinders} cyl` : 'N/A') },
      { label: 'Drivetrain', value: build.drivetrain || 'N/A' },
      { label: 'Doors', value: build.doors ? `${build.doors} Doors` : 'N/A' },
    ];
    specs.forEach((el, i) => {
      if (specData[i]) {
        el.querySelector('.detail-spec-label').textContent = specData[i].label;
        el.querySelector('.detail-spec-value').textContent = specData[i].value;
      }
    });

    /* Overview tab */
    const overviewTab = document.getElementById('tab-overview');
    if (overviewTab) {
      const trustHTML = (meta.trustSignals || []).map(s => {
        const t = TRUST_ICON_MAP[s];
        return t ? `<span class="detail-trust-badge"><i class="fas ${t.icon}"></i> ${t.text}</span>` : '';
      }).join('');

      const safeComments = listing.seller_comments
        ? escapeHtml(listing.seller_comments).replace(/\n/g, '<br>')
        : '';

      overviewTab.innerHTML = `
        ${trustHTML ? `<div class="detail-trust-row">${trustHTML}</div>` : ''}
        <h3 class="h3" style="margin-bottom:16px">About This Vehicle</h3>
        <p class="body-lg" style="color:var(--text-2);line-height:1.8;margin-bottom:16px">
          ${title}${listing.exterior_color ? ' finished in ' + escapeHtml(listing.exterior_color) : ''}.
          ${escapeHtml(build.transmission || '')} transmission${build.drivetrain ? ', ' + escapeHtml(build.drivetrain) + ' drivetrain' : ''}.
          ${listing.miles != null ? fmtMi(listing.miles) + ' on the odometer.' : ''}
        </p>
        ${safeComments ? `<p class="body-lg" style="color:var(--text-2);line-height:1.8;margin-bottom:16px">${safeComments}</p>` : ''}
        ${dealer.name ? `<div style="margin-top:24px;padding:20px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg)">
          <h4 class="h3" style="margin-bottom:12px"><i class="fas fa-store" style="color:var(--accent);margin-right:8px"></i>Dealer Information</h4>
          <p style="color:var(--text-1);font-weight:600;margin-bottom:4px">${escapeHtml(dealer.name)}</p>
          <p style="color:var(--text-3);font-size:0.875rem">${[dealer.street, dealer.city, dealer.state, dealer.zip].filter(Boolean).map(escapeHtml).join(', ')}</p>
          ${dealer.phone ? `<p style="color:var(--text-2);font-size:0.875rem;margin-top:8px"><i class="fas fa-phone" style="color:var(--accent);margin-right:6px"></i>${escapeHtml(dealer.phone)}</p>` : ''}
        </div>` : ''}
        <p style="margin-top:16px;font-size:0.6875rem;color:var(--text-3);line-height:1.5">*Monthly estimate based on 60-month financing. Actual terms may vary. Contact dealer for details.</p>
      `;
    }

    /* Specifications tab */
    const specTab = document.getElementById('tab-specifications');
    if (specTab) {
      const rows = [
        ['Year', build.year], ['Make', build.make], ['Model', build.model],
        ['Trim', build.trim], ['Body Type', build.body_type],
        ['Transmission', build.transmission], ['Drivetrain', build.drivetrain],
        ['Fuel Type', build.fuel_type], ['Engine', build.engine],
        ['Doors', build.doors], ['Seating', build.std_seating ? build.std_seating + ' passengers' : null],
        ['City MPG', build.city_mpg], ['Highway MPG', build.highway_mpg],
        ['Exterior Color', listing.exterior_color], ['Interior Color', listing.interior_color],
        ['VIN', listing.vin], ['Stock #', listing.stock_no],
      ].filter(([, v]) => v != null && v !== '');

      specTab.innerHTML = `
        <h3 class="h3" style="margin-bottom:20px">Full Specifications</h3>
        <table class="spec-table">${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
      `;
    }

    /* Similar cars */
    if (build.make) {
      try {
        const similar = await apiFetch(`/api/inventory?make=${encodeURIComponent(build.make)}&rows=3&year_range=2023-2026`);
        const simGrid = document.getElementById('similarCars');
        if (simGrid && similar.listings) {
          simGrid.innerHTML = similar.listings.filter(s => s.id !== listingId && s.vin !== listingId).slice(0, 3).map(safeCard).join('');
        }
      } catch {}
    }

  } catch (err) {
    console.warn('Car detail load failed:', err.message);
  }
}

/* ========================================================
   SHARED — Nav, Slider, FAQ, Forms, Reveal
   ======================================================== */
document.addEventListener('DOMContentLoaded', () => {

  /* Warn if not on same origin as API (common reason for "no cars") */
  const port = (location.port && location.port !== '80' && location.port !== '443') ? location.port : (location.protocol === 'https:' ? '443' : '80');
  if (location.protocol === 'file:' || (location.hostname === 'localhost' && port !== '2022') || (location.hostname === '127.0.0.1' && port !== '2022')) {
    console.warn('[ND] Wrong URL? Cars load from API at port 2022. Open http://localhost:2022 — current:', location.href);
  }

  const isHome      = !!document.getElementById('curatedFeed');
  const isInventory = !!document.getElementById('inventoryCars');
  const isDetail    = !!document.querySelector('.detail-layout');

  if (isHome) {
    loadHomeFeed();
    setupHeroSearch();
  }
  if (isInventory) {
    loadInventory(0, { replace: true });
    setupInventoryFilters();
    setTimeout(function () {
      var grid = document.getElementById('inventoryCars') || document.querySelector('[data-inventory-grid]');
      if (grid && grid.querySelectorAll('.car-card:not(.skeleton-card)').length === 0) {
        console.warn('[ND] Inventory still empty after load -> forcing demo');
        if (typeof renderDemoInventory === 'function') renderDemoInventory(); else if (typeof hardInject6Cards === 'function') hardInject6Cards();
      }
    }, 2500);
  }
  if (isDetail) {
    loadCarDetails();
  }

  /* Search tabs */
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  /* Predator engine sound */
  PredatorAudio.init();

  /* Location prompt */
  UserLocation.init();

  const locOverlay = document.getElementById('locOverlay');
  const locAllowBtn = document.getElementById('locAllow');
  const locZipInput = document.getElementById('locZipInput');
  const locZipBtn = document.getElementById('locZipBtn');
  const locSkipBtn = document.getElementById('locSkip');
  const navLocBtn = document.getElementById('navLocBtn');

  function closeLocModal() {
    if (locOverlay) locOverlay.classList.remove('visible');
  }

  function setLocStatus(msg, isError) {
    let el = document.querySelector('.loc-status');
    if (!el && locOverlay) {
      el = document.createElement('p');
      el.className = 'loc-status';
      locOverlay.querySelector('.loc-modal')?.appendChild(el);
    }
    if (el) { el.textContent = msg; el.style.color = isError ? 'var(--danger)' : 'var(--accent)'; }
  }

  if (locAllowBtn) {
    locAllowBtn.addEventListener('click', async () => {
      locAllowBtn.disabled = true;
      locAllowBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';
      try {
        const coords = await UserLocation.requestGeolocation();
        setLocStatus('Got your coordinates, finding your city...');
        const loc = await UserLocation.reverseGeocode(coords.lat, coords.lng);
        UserLocation.save(loc);
        setLocStatus(loc.city + (loc.state ? ', ' + loc.state : '') + ' — saved!');
        setTimeout(closeLocModal, 800);
      } catch (err) {
        const msg = err.code === 1 ? 'Permission denied. Enter a ZIP code instead.' : 'Could not detect location. Try entering a ZIP code.';
        setLocStatus(msg, true);
        locAllowBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Use My Location';
        locAllowBtn.disabled = false;
      }
    });
  }

  if (locZipBtn && locZipInput) {
    async function handleZip() {
      const zip = locZipInput.value.trim();
      if (!/^\d{5}$/.test(zip)) { setLocStatus('Enter a valid 5-digit ZIP code', true); return; }
      locZipBtn.disabled = true;
      locZipBtn.textContent = '...';
      try {
        const loc = await UserLocation.geocodeZip(zip);
        UserLocation.save(loc);
        setLocStatus(loc.city + (loc.state ? ', ' + loc.state : '') + ' — saved!');
        setTimeout(closeLocModal, 800);
      } catch {
        setLocStatus('Could not find that ZIP code. Try another.', true);
      }
      locZipBtn.disabled = false;
      locZipBtn.textContent = 'Go';
    }
    locZipBtn.addEventListener('click', handleZip);
    locZipInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleZip(); });
  }

  if (locSkipBtn) locSkipBtn.addEventListener('click', closeLocModal);

  if (navLocBtn) {
    navLocBtn.addEventListener('click', () => {
      if (locOverlay) locOverlay.classList.add('visible');
    });
  }

  /* Active nav link — set dynamically from current URL */
  (function setActiveNav() {
    const links = document.querySelectorAll('.nav-links a');
    const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    links.forEach(a => {
      const href = a.getAttribute('href').replace(/\.html$/, '').replace(/\/$/, '') || '/';
      a.classList.remove('active');
      if (path === href || (href !== '/' && path.startsWith(href))) {
        a.classList.add('active');
      }
    });
  })();

  /* Navbar scroll */
  const navbar = document.getElementById('navbar');
  if (navbar && !navbar.classList.contains('scrolled')) {
    let tick = false;
    window.addEventListener('scroll', () => {
      if (!tick) { requestAnimationFrame(() => { navbar.classList.toggle('scrolled', scrollY > 40); tick = false; }); tick = true; }
    }, { passive: true });
  }

  /* Mobile menu */
  const toggle = document.getElementById('mobileToggle');
  const navlinks = document.getElementById('navLinks');
  if (toggle && navlinks) {
    toggle.addEventListener('click', () => { navlinks.classList.toggle('open'); toggle.classList.toggle('active'); });
    navlinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => { navlinks.classList.remove('open'); toggle.classList.remove('active'); });
    });
  }

  /* Back to top */
  const btt = document.getElementById('btt');
  if (btt) {
    window.addEventListener('scroll', () => { btt.classList.toggle('visible', scrollY > 500); }, { passive: true });
    btt.addEventListener('click', () => { scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* AI Advisor panel + streaming chat */
  const aiBtn = document.getElementById('aiAdvisorBtn');
  const aiPanel = document.getElementById('aiAdvisorPanel');
  const aiClose = document.getElementById('aiAdvisorClose');
  const chatOut = document.getElementById('chatOut');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  function addUserBubble(container, text) {
    if (!container) return;
    const el = document.createElement('p');
    el.className = 'chat-bubble user';
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }
  function addAssistantBubble(container, initialText) {
    if (!container) return null;
    const el = document.createElement('p');
    el.className = 'chat-bubble assistant';
    el.textContent = initialText || '';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }
  function clearComposer() {
    if (chatInput) chatInput.value = '';
    if (typeof window.__voiceTranscriptBuffer !== 'undefined') window.__voiceTranscriptBuffer = '';
    if (sendBtn) sendBtn.disabled = true;
    chatInput && chatInput.dispatchEvent(new Event('input'));
  }
  async function streamChat(prompt) {
    if (!chatOut) return;
    const bubble = addAssistantBubble(chatOut, 'Thinking…');
    bubble.classList.add('thinking');
    try {
      const res = await fetch(apiBase() + '/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        bubble.classList.remove('thinking');
        bubble.textContent = 'Sorry, the advisor is unavailable. Try again or browse Inventory.';
        return;
      }
      bubble.textContent = '';
      bubble.classList.remove('thinking');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        bubble.textContent = acc;
        chatOut.scrollTop = chatOut.scrollHeight;
      }
    } catch (e) {
      bubble.classList.remove('thinking');
      bubble.textContent = 'Network error. Please try again.';
    }
  }
  if (aiBtn && aiPanel) {
    aiBtn.addEventListener('click', () => { aiPanel.classList.toggle('open'); });
    aiClose && aiClose.addEventListener('click', () => { aiPanel.classList.remove('open'); });
  }
  if (sendBtn && chatInput && chatOut) {
    chatInput.addEventListener('input', () => { sendBtn.disabled = !chatInput.value.trim(); });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatInput.value.trim()) sendBtn.click();
      }
    });
    sendBtn.addEventListener('click', async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      addUserBubble(chatOut, text);
      clearComposer();
      await streamChat(text);
    });
  }

  /* Testimonials slider */
  const track = document.getElementById('testTrack');
  const slides = track ? track.children : [];
  const dots = document.getElementById('sliderDots');
  let cur = 0, autoTimer;
  if (track && slides.length && dots) {
    [...slides].forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'slider-dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Slide ${i + 1}`);
      d.addEventListener('click', () => { go(i); resetAuto(); });
      dots.appendChild(d);
    });
    function go(i) { cur = i; track.style.transform = `translateX(-${i * 100}%)`; dots.querySelectorAll('.slider-dot').forEach((d, j) => d.classList.toggle('active', j === i)); }
    function resetAuto() { clearInterval(autoTimer); autoTimer = setInterval(() => go(cur < slides.length - 1 ? cur + 1 : 0), 6000); }
    document.getElementById('prevSlide')?.addEventListener('click', () => { go(cur > 0 ? cur - 1 : slides.length - 1); resetAuto(); });
    document.getElementById('nextSlide')?.addEventListener('click', () => { go(cur < slides.length - 1 ? cur + 1 : 0); resetAuto(); });
    resetAuto();
  }

  /* Detail tabs */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + btn.dataset.tab));
    });
  });

  /* FAQ */
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', () => item.classList.toggle('open'));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.classList.toggle('open'); } });
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
  });

  /* Forms — wired to backend endpoints */
  /* Honeypot + min time: set _t0 when form is first available (for spam/bot protection) */
  const newsletterFormTime = document.getElementById('newsletterFormTime');
  if (newsletterFormTime && !newsletterFormTime.value) newsletterFormTime.value = Date.now();
  const contactFormTime = document.getElementById('contactFormTime');
  if (contactFormTime && !contactFormTime.value) contactFormTime.value = Date.now();
  const accountFormTime = document.getElementById('accountFormTime');
  if (accountFormTime && !accountFormTime.value) accountFormTime.value = Date.now();

  document.getElementById('newsletterForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const inp = form.querySelector('input[type="email"]');
    const btn = form.querySelector('button[type="submit"]');
    const t0El = form.querySelector('input[name="_t0"]');
    if (!inp) return;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      const res = await fetch(apiBase() + '/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inp.value,
          _t0: t0El ? parseInt(t0El.value, 10) : Date.now(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        inp.value = '';
        btn.textContent = 'Subscribed!';
        setTimeout(() => { btn.textContent = 'Subscribe'; btn.disabled = false; }, 3000);
      } else {
        btn.textContent = data.error || 'Error';
        setTimeout(() => { btn.textContent = 'Subscribe'; btn.disabled = false; }, 3000);
      }
    } catch {
      btn.textContent = 'Network error';
      setTimeout(() => { btn.textContent = 'Subscribe'; btn.disabled = false; }, 3000);
    }
  });

  document.getElementById('contactForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, textarea, select');
    const firstName = inputs[2]?.value || '';
    const lastName = inputs[3]?.value || '';
    const email = inputs[4]?.value || '';
    const phone = inputs[5]?.value || '';
    const subject = (inputs[6] && inputs[6].value) ? inputs[6].value : '';
    const vehicle = inputs[7]?.value || '';
    const message = inputs[8]?.value || '';
    const name = (firstName + ' ' + lastName).trim();
    const t0El = form.querySelector('input[name="_t0"]');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    try {
      const res = await fetch(apiBase() + '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, message,
          phone: phone || undefined,
          subject: subject || undefined,
          vehicle: vehicle || undefined,
          _t0: t0El ? parseInt(t0El.value, 10) : Date.now(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        form.reset();
        btn.innerHTML = '<i class="fas fa-check"></i> Message Sent!';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message'; btn.disabled = false; }, 4000);
      } else {
        btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (data.error || 'Error');
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message'; btn.disabled = false; }, 3000);
      }
    } catch {
      btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Network error';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message'; btn.disabled = false; }, 3000);
    }
  });

  document.getElementById('accountRequestForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const nameEl = form.querySelector('input[name="name"]');
    const emailEl = form.querySelector('input[name="email"]');
    const btn = form.querySelector('button[type="submit"]');
    const t0El = form.querySelector('input[name="_t0"]');
    if (!emailEl || !btn) return;

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Sending...';

    try {
      const res = await fetch(apiBase() + '/api/account-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameEl ? nameEl.value : undefined,
          email: emailEl.value,
          _t0: t0El ? parseInt(t0El.value, 10) : Date.now(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (nameEl) nameEl.value = '';
        emailEl.value = '';
        btn.textContent = 'Request received!';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4000);
      } else {
        btn.textContent = data.error || 'Error';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
      }
    } catch {
      btn.textContent = 'Network error';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
    }
  });

  /* Dynamic models */
  const makeEl = document.getElementById('sMake');
  const modelEl = document.getElementById('sModel');
  const modelMap = {
    'BMW':['3 Series','5 Series','X3','X5','X7','M3','M4','iX','i4','i5','i7'],
    'Mercedes-Benz':['C-Class','E-Class','S-Class','GLC','GLE','GLS','AMG GT','EQS','EQE'],
    'Audi':['A4','A6','A8','Q5','Q7','Q8','RS e-tron GT','e-tron'],
    'Porsche':['911','Cayenne','Macan','Taycan','Panamera'],
    'Tesla':['Model 3','Model Y','Model S','Model X'],
    'Toyota':['Camry','RAV4','Highlander','Land Cruiser','Corolla','Supra'],
    'Honda':['Civic','Accord','CR-V','Pilot','HR-V'],
    'Ford':['Mustang','F-150','Bronco','Explorer','Mach-E'],
    'Lexus':['IS','ES','RX','NX','LX','LC'],
    'Chevrolet':['Camaro','Corvette','Tahoe','Equinox','Silverado'],
  };
  if (makeEl && modelEl) {
    makeEl.addEventListener('change', () => {
      modelEl.innerHTML = '<option value="">Any model</option>';
      (modelMap[makeEl.value] || []).forEach(m => { const o = document.createElement('option'); o.textContent = m; o.value = m; modelEl.appendChild(o); });
    });
  }

  /* Scroll reveal */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    reveals.forEach(el => obs.observe(el));
  }
});
