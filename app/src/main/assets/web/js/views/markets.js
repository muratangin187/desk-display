import { fetchJson } from '../bridge.js';

const TROY_OZ_TO_GRAM = 31.1034768;

const ASSETS = [
  { id: 'usd', label: 'DOLAR / TL', unit: '₺', decimals: 2, color: '#38bdf8' },
  { id: 'eur', label: 'EURO / TL', unit: '₺', decimals: 2, color: '#818cf8' },
  { id: 'gold', label: 'GRAM ALTIN', unit: '₺', decimals: 0, color: '#f59e0b' },
  { id: 'bist', label: 'BIST 100', unit: '', decimals: 2, color: '#10b981' },
];

export function initMarketsView(rootEl) {
  let selectedId = localStorage.getItem('desk_market_selected') || 'usd';
  let rangeKey = localStorage.getItem('desk_market_range') || '7d';
  let dataByAsset = {};
  let activePointIndex = null;

  rootEl.innerHTML = `
    <div class="markets-container">
      <div class="markets-cards" id="markets-cards"></div>
      <div class="chart-panel">
        <div class="chart-header">
          <div class="chart-title-group">
            <span class="chart-title" id="chart-title">DOLAR / TL</span>
            <div class="chart-readout" id="chart-readout">
              <span class="readout-date">Yükleniyor...</span>
            </div>
          </div>
          <div class="chart-controls">
            <button class="pill-btn ${rangeKey === '7d' ? 'active' : ''}" data-range="7d">1 Hafta</button>
            <button class="pill-btn ${rangeKey === '1mo' ? 'active' : ''}" data-range="1mo">1 Ay</button>
            <button class="pill-btn" id="markets-refresh" title="Yenile">↻</button>
          </div>
        </div>
        <div class="chart-canvas-wrap" id="chart-wrap">
          <canvas id="markets-canvas"></canvas>
        </div>
      </div>
    </div>
  `;

  const cardsEl = rootEl.querySelector('#markets-cards');
  const chartTitleEl = rootEl.querySelector('#chart-title');
  const chartReadoutEl = rootEl.querySelector('#chart-readout');
  const canvasWrap = rootEl.querySelector('#chart-wrap');
  const canvas = rootEl.querySelector('#markets-canvas');
  const ctx = canvas.getContext('2d');

  rootEl.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeKey = btn.dataset.range;
      localStorage.setItem('desk_market_range', rangeKey);
      rootEl.querySelectorAll('[data-range]').forEach((b) =>
        b.classList.toggle('active', b.dataset.range === rangeKey)
      );
      loadAll();
    });
  });

  rootEl.querySelector('#markets-refresh').addEventListener('click', () => {
    loadAll();
  });

  function formatPrice(val, asset) {
    if (val == null || Number.isNaN(val)) return '—';
    const formatted = val.toLocaleString('tr-TR', {
      minimumFractionDigits: asset.decimals,
      maximumFractionDigits: asset.decimals,
    });
    return asset.unit ? `${asset.unit}${formatted}` : formatted;
  }

  function formatSigned(val, asset) {
    if (val == null || Number.isNaN(val)) return '—';
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    const absVal = Math.abs(val).toLocaleString('tr-TR', {
      minimumFractionDigits: asset.decimals,
      maximumFractionDigits: asset.decimals,
    });
    return asset.unit ? `${sign}${asset.unit}${absVal}` : `${sign}${absVal}`;
  }

  function formatPct(pct) {
    if (pct == null || Number.isNaN(pct)) return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }

  function formatDateLabel(ts, includeTime) {
    const d = new Date(ts * 1000);
    const dateStr = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
    if (!includeTime) return dateStr;
    const timeStr = d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} · ${timeStr}`;
  }

  async function fetchYahoo(symbol, range) {
    const interval = range === '7d' ? '1h' : '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);

    const meta = result.meta || {};
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const points = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null && !Number.isNaN(c)) {
        points.push({ ts: timestamps[i], value: c });
      }
    }

    const price = meta.regularMarketPrice ?? points[points.length - 1]?.value;
    const dailyChange =
      meta.fulldayChange ??
      meta.regularMarketChange ??
      (meta.previousClose != null && price != null ? price - meta.previousClose : 0);
    const dailyChangePct =
      meta.fulldayChangePercent ??
      meta.regularMarketChangePercent ??
      (meta.previousClose ? (dailyChange / meta.previousClose) * 100 : 0);

    return {
      price,
      prevClose: price - dailyChange,
      change: dailyChange,
      changePct: dailyChangePct,
      points,
    };
  }

  function buildGoldSeries(goldData, usdData) {
    const usdPoints = usdData.points;
    const points = [];
    let uIdx = 0;

    for (const gp of goldData.points) {
      while (uIdx + 1 < usdPoints.length && usdPoints[uIdx + 1].ts <= gp.ts) {
        uIdx++;
      }
      const usdRate = usdPoints[uIdx]?.value ?? usdData.price;
      if (usdRate) {
        points.push({
          ts: gp.ts,
          value: (gp.value / TROY_OZ_TO_GRAM) * usdRate,
        });
      }
    }

    const price = (goldData.price / TROY_OZ_TO_GRAM) * usdData.price;
    const prevClose = (goldData.prevClose / TROY_OZ_TO_GRAM) * usdData.prevClose;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return { price, prevClose, change, changePct, points };
  }

  async function loadAll() {
    try {
      const [usd, eur, goldRaw, bist] = await Promise.all([
        fetchYahoo('USDTRY=X', rangeKey),
        fetchYahoo('EURTRY=X', rangeKey),
        fetchYahoo('GC=F', rangeKey),
        fetchYahoo('XU100.IS', rangeKey),
      ]);

      dataByAsset = {
        usd,
        eur,
        gold: buildGoldSeries(goldRaw, usd),
        bist,
      };
      renderCards();
      renderChart();
    } catch (err) {
      chartReadoutEl.innerHTML = `<span class="readout-date">Veri alınamadı: ${err.message}</span>`;
    }
  }

  function renderCards() {
    cardsEl.innerHTML = ASSETS.map((asset) => {
      const d = dataByAsset[asset.id];
      const activeClass = asset.id === selectedId ? 'active' : '';
      const dir = !d ? 'flat' : d.change > 0 ? 'up' : d.change < 0 ? 'down' : 'flat';
      return `
        <div class="market-card ${activeClass}" data-id="${asset.id}">
          <div class="market-card-top">
            <span class="market-label">${asset.label}</span>
            <span class="market-badge ${dir}">${d ? formatPct(d.changePct) : '—'}</span>
          </div>
          <div class="market-price">${d ? formatPrice(d.price, asset) : '—'}</div>
          <div class="market-sub">Günlük: ${d ? formatSigned(d.change, asset) : '—'}</div>
        </div>
      `;
    }).join('');

    cardsEl.querySelectorAll('.market-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.id;
        localStorage.setItem('desk_market_selected', selectedId);
        activePointIndex = null;
        renderCards();
        renderChart();
      });
    });
  }

  function updateReadout(asset, series) {
    if (!series || !series.points.length) {
      chartReadoutEl.innerHTML = `<span class="readout-date">Veri yok</span>`;
      return;
    }

    const latest = series.price ?? series.points[series.points.length - 1].value;
    const isInspecting = activePointIndex != null && series.points[activePointIndex];

    if (isInspecting) {
      const pt = series.points[activePointIndex];
      const diffToNow = latest - pt.value;
      const pctToNow = pt.value ? (diffToNow / pt.value) * 100 : 0;
      const dir = diffToNow >= 0 ? 'up' : 'down';
      chartReadoutEl.innerHTML = `
        <span class="readout-date">${formatDateLabel(pt.ts, rangeKey === '7d')}</span>
        <span class="readout-value">${formatPrice(pt.value, asset)}</span>
        <span class="readout-diff ${dir}">Bugüne: ${formatPct(pctToNow)} (${formatSigned(diffToNow, asset)})</span>
      `;
    } else {
      const first = series.points[0];
      const diff = latest - first.value;
      const pct = first.value ? (diff / first.value) * 100 : 0;
      const dir = diff >= 0 ? 'up' : 'down';
      const label = rangeKey === '7d' ? '7G Değişim' : '1A Değişim';
      chartReadoutEl.innerHTML = `
        <span class="readout-date">Güncel</span>
        <span class="readout-value">${formatPrice(latest, asset)}</span>
        <span class="readout-diff ${dir}">${label}: ${formatPct(pct)} (${formatSigned(diff, asset)})</span>
      `;
    }
  }

  function renderChart() {
    const asset = ASSETS.find((a) => a.id === selectedId) || ASSETS[0];
    const series = dataByAsset[asset.id];
    chartTitleEl.textContent = asset.label;
    updateReadout(asset, series);

    const rect = canvasWrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (!series || series.points.length < 2) return;

    const pts = series.points;
    const values = pts.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const span = max - min || min * 0.01 || 1;
    min -= span * 0.08;
    max += span * 0.08;

    const pad = { top: 10, right: 24, bottom: 24, left: 56 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const getX = (i) => pad.left + (i / (pts.length - 1)) * plotW;
    const getY = (v) => pad.top + (1 - (v - min) / (max - min)) * plotH;

    // Horizontal grid + Y labels
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const ratio = i / gridSteps;
      const y = pad.top + ratio * plotH;
      const val = max - ratio * (max - min);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(formatPrice(val, asset), pad.left - 8, y);
    }
    ctx.setLineDash([]);

    // X-axis day labels (5 evenly spaced)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = 5;
    for (let i = 0; i < xTicks; i++) {
      const idx = Math.round((i / (xTicks - 1)) * (pts.length - 1));
      const x = getX(idx);
      const d = new Date(pts[idx].ts * 1000);
      const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      ctx.fillStyle = '#64748b';
      ctx.fillText(label, x, h - pad.bottom + 7);
    }

    // Area gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, `${asset.color}44`);
    grad.addColorStop(1, `${asset.color}00`);

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(pts[0].value));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(getX(i), getY(pts[i].value));
    }
    ctx.lineTo(getX(pts.length - 1), pad.top + plotH);
    ctx.lineTo(getX(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main line
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(pts[0].value));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(getX(i), getY(pts[i].value));
    }
    ctx.strokeStyle = asset.color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active crosshair & dot
    if (activePointIndex != null && pts[activePointIndex]) {
      const cx = getX(activePointIndex);
      const cy = getY(pts[activePointIndex].value);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = `${asset.color}44`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  function handlePointer(clientX) {
    const series = dataByAsset[selectedId];
    if (!series || !series.points.length) return;
    const rect = canvasWrap.getBoundingClientRect();
    const padLeft = 56;
    const padRight = 24;
    const plotW = rect.width - padLeft - padRight;
    const rel = Math.max(0, Math.min(1, (clientX - rect.left - padLeft) / plotW));
    const idx = Math.round(rel * (series.points.length - 1));
    if (idx !== activePointIndex) {
      activePointIndex = idx;
      renderChart();
    }
  }

  let scrubbing = false;
  canvasWrap.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    scrubbing = true;
    canvasWrap.setPointerCapture?.(e.pointerId);
    handlePointer(e.clientX);
  });

  canvasWrap.addEventListener('pointermove', (e) => {
    if (!scrubbing) return;
    e.stopPropagation();
    handlePointer(e.clientX);
  });

  const endScrub = (e) => {
    if (!scrubbing) return;
    e.stopPropagation();
    scrubbing = false;
  };
  canvasWrap.addEventListener('pointerup', endScrub);
  canvasWrap.addEventListener('pointercancel', endScrub);
  canvasWrap.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  canvasWrap.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

  new ResizeObserver(() => renderChart()).observe(canvasWrap);

  loadAll();
  setInterval(loadAll, 2 * 60 * 1000);
}
