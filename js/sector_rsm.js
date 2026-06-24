// ── Sector RSR/RSM Bubble Chart ──────────────────────────────────────────────
// RSR = MA10 / MA30 * 100  (近期相對強弱)
// RSM = RSR(最新) / avg(RSR 9期) * 100  (動能持續性)
// 基準: 發行量加權股價指數

const RSM_BENCHMARK = '發行量加權股價指數';

const RSM_DEFAULT_SECTORS = [
  '半導體類指數', '電子零組件類指數', '電腦及週邊設備類指數',
  '光電類指數', '通信網路類指數', '電子工業類指數',
  '金融保險類指數', '傳統產業類指數', '鋼鐵類指數',
  '化學類指數', '生技醫療類指數', '航運類指數',
  '建材營造類指數', '觀光餐旅類指數', '電力及電纜類指數',
];

// 短顯示名稱
const RSM_LABEL = {
  '半導體類指數':       '半導體',
  '電子零組件類指數':   '電子零組件',
  '電腦及週邊設備類指數':'電腦週邊',
  '光電類指數':         '光電',
  '通信網路類指數':     '通信網路',
  '電子工業類指數':     '電子工業',
  '金融保險類指數':     '金融',
  '傳統產業類指數':     '傳產',
  '鋼鐵類指數':         '鋼鐵',
  '化學類指數':         '化學',
  '生技醫療類指數':     '生技',
  '航運類指數':         '航運',
  '建材營造類指數':     '建材',
  '觀光餐旅類指數':     '觀光',
  '電力及電纜類指數':   '電力電纜',
};

const RSM_COLORS = [
  '#38bdf8','#818cf8','#34d399','#fb923c','#f472b6',
  '#a78bfa','#4ade80','#fbbf24','#60a5fa','#f87171',
  '#2dd4bf','#e879f9','#facc15','#94a3b8','#fb7185',
];

// ── 狀態 ──────────────────────────────────────────────────────────────────────
let _rsmData       = null;   // { benchmark: [{date,close}], sectors: {name:[...]} }
let _rsmCustomList = null;   // null = 用預設
let _rsmChart      = null;   // SVG element reference
let _rsmLoaded     = false;

// ── 入口：從 showHeatmap 呼叫 ─────────────────────────────────────────────────
async function loadSectorRSM() {
  const wrap = document.getElementById('sectorRsmWrap');
  if (!wrap) return;
  if (_rsmLoaded) { renderRsmBubble(); return; }

  wrap.querySelector('#rsmLoading').style.display = 'block';
  wrap.querySelector('#rsmCanvas').style.display  = 'none';
  wrap.querySelector('#rsmError').style.display   = 'none';

  try {
    await _fetchRsmData();
    _rsmLoaded = true;
    renderRsmBubble();
  } catch (e) {
    console.error('[RSM]', e);
    wrap.querySelector('#rsmLoading').style.display = 'none';
    const err = wrap.querySelector('#rsmError');
    err.textContent = '資料載入失敗：' + e.message;
    err.style.display = 'block';
  }
}

// ── 抓資料 ────────────────────────────────────────────────────────────────────
async function _fetchRsmData() {
  const sectors = _rsmCustomList || RSM_DEFAULT_SECTORS;
  const allNames = [RSM_BENCHMARK, ...sectors];
  // 抓 100 天（含假日緩衝），確保有足夠交易日
  const since = new Date();
  since.setDate(since.getDate() - 100);
  const sinceStr = since.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    select: 'date,index_name,close,volume',
    date:   `gte.${sinceStr}`,
    order:  'date.asc',
  });
  // 用 in 篩選多個 index_name
  params.append('index_name', `in.(${allNames.map(n => `"${n}"`).join(',')})`);

  const rows = await sbFetch('sector_index_daily', params.toString());

  // 整理成 { name -> [{date, close, volume}] }
  const map = {};
  for (const r of rows) {
    if (!map[r.index_name]) map[r.index_name] = [];
    map[r.index_name].push({ date: r.date, close: +r.close, volume: +(r.volume||0) });
  }

  _rsmData = { benchmark: map[RSM_BENCHMARK] || [], sectors: {} };
  for (const s of sectors) {
    if (map[s]) _rsmData.sectors[s] = map[s];
  }
}

// ── RSR/RSM 計算 ──────────────────────────────────────────────────────────────
function _sortDaily(dailyArr) {
  // 直接用日資料，依日期排序
  return [...dailyArr].sort((a,b) => a.date.localeCompare(b.date));
}

function _calcRSR(sectorDays, benchDays) {
  // Align by date, use daily data
  const bMap = Object.fromEntries(benchDays.map(d => [d.date, d.close]));
  const pairs = sectorDays
    .filter(d => bMap[d.date] && bMap[d.date] > 0)
    .map(d => ({ date: d.date, ratio: d.close / bMap[d.date] }));

  if (pairs.length < 30) return null;

  const last60 = pairs.slice(-60);
  const R = last60.map(p => p.ratio);
  const n = R.length;

  // MA30 = 最後30日均值, MA10 = 最後10日均值
  const ma30 = R.slice(-30).reduce((s,v) => s+v, 0) / 30;
  const ma10 = R.slice(-10).reduce((s,v) => s+v, 0) / 10;
  const rsr  = ma10 / ma30 * 100;

  // RSM: 9期滾動RSR（每期間隔1日）
  const rsrArr = [];
  for (let j = 1; j <= 9; j++) {
    const offset = 9 - j;  // j=9 → 最新
    const slice  = R.slice(n - 30 - offset, n - offset);
    if (slice.length < 30) { rsrArr.push(100); continue; }
    const m30 = slice.reduce((s,v) => s+v, 0) / 30;
    const m10 = slice.slice(-10).reduce((s,v) => s+v, 0) / 10;
    rsrArr.push(m10 / m30 * 100);
  }
  const rsrSum = rsrArr.reduce((s,v) => s+v, 0);
  const rsm    = rsrArr[8] / rsrSum * 900;

  return { rsr, rsm, avgVol: 0 };
}

// ── 渲染泡泡圖 ────────────────────────────────────────────────────────────────
function renderRsmBubble() {
  const wrap = document.getElementById('sectorRsmWrap');
  if (!wrap || !_rsmData) return;
  wrap.querySelector('#rsmLoading').style.display = 'none';

  const sectors = _rsmCustomList || RSM_DEFAULT_SECTORS;
  const benchW  = _sortDaily(_rsmData.benchmark);

  const points = [];
  let ci = 0;
  for (const name of sectors) {
    const arr = _rsmData.sectors[name];
    if (!arr) continue;
    const result = _calcRSR(_sortDaily(arr), benchW);
    if (!result) continue;
    points.push({ name, label: RSM_LABEL[name]||name, color: RSM_COLORS[ci % RSM_COLORS.length], ...result });
    ci++;
  }

  if (!points.length) {
    wrap.querySelector('#rsmError').textContent = '資料不足（需至少 30 日）';
    wrap.querySelector('#rsmError').style.display = 'block';
    return;
  }

  _drawBubble(wrap, points);
  wrap.querySelector('#rsmCanvas').style.display = 'block';
  wrap.querySelector('#rsmTs').textContent = '更新：' + new Date().toLocaleTimeString('zh-TW', {hour:'2-digit',minute:'2-digit'});
}

function _drawBubble(wrap, points) {
  const canvas = wrap.querySelector('#rsmCanvas');
  canvas.innerHTML = '';

  const W = canvas.clientWidth || 680;
  const H = 420;
  const PAD = { t: 30, r: 20, b: 50, l: 55 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  // 軸範圍
  const rsrVals = points.map(p => p.rsr);
  const rsmVals = points.map(p => p.rsm);
  const xMin = Math.min(...rsrVals) - 2, xMax = Math.max(...rsrVals) + 2;
  const yMin = Math.min(...rsmVals) - 2, yMax = Math.max(...rsmVals) + 2;

  // 泡泡半徑 (RSM 動能值)
  const rsmMin = Math.min(...points.map(p => p.rsm));
  const rsmMax = Math.max(...points.map(p => p.rsm));
  const rsmRange = rsmMax - rsmMin || 1;
  const rScale = rsm => 8 + ((rsm - rsmMin) / rsmRange) * 20;

  // 座標轉換
  const px = v => PAD.l + (v - xMin) / (xMax - xMin) * CW;
  const py = v => PAD.t + CH - (v - yMin) / (yMax - yMin) * CH;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.style.overflow = 'visible';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  // 四象限背景漸層
  [
    { id:'q1', x:px(100), y:PAD.t,   w:px(xMax)-px(100), h:py(100)-PAD.t,   c:'#dc2626' }, // 強勢加速
    { id:'q2', x:PAD.l,   y:PAD.t,   w:px(100)-PAD.l,    h:py(100)-PAD.t,   c:'#ca8a04' }, // 弱勢反彈
    { id:'q3', x:PAD.l,   y:py(100), w:px(100)-PAD.l,    h:PAD.t+CH-py(100),'c':'#16a34a' }, // 弱勢惡化
    { id:'q4', x:px(100), y:py(100), w:px(xMax)-px(100), h:PAD.t+CH-py(100),'c':'#2563eb' }, // 強勢減速
  ].forEach(q => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', q.x); r.setAttribute('y', q.y);
    r.setAttribute('width', Math.max(0, q.w)); r.setAttribute('height', Math.max(0, q.h));
    r.setAttribute('fill', q.c); r.setAttribute('opacity', '0.06');
    svg.appendChild(r);
  });

  // 中心線 RSR=100, RSM=100
  const lineStyle = (el, dash=false) => {
    el.setAttribute('stroke', 'rgba(148,163,184,0.3)');
    el.setAttribute('stroke-width', '1');
    if (dash) el.setAttribute('stroke-dasharray', '4,3');
  };
  const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  vLine.setAttribute('x1', px(100)); vLine.setAttribute('y1', PAD.t);
  vLine.setAttribute('x2', px(100)); vLine.setAttribute('y2', PAD.t + CH);
  lineStyle(vLine, true); svg.appendChild(vLine);

  const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hLine.setAttribute('x1', PAD.l); hLine.setAttribute('y1', py(100));
  hLine.setAttribute('x2', PAD.l + CW); hLine.setAttribute('y2', py(100));
  lineStyle(hLine, true); svg.appendChild(hLine);

  // 象限標籤
  const qLabels = [
    { x: px(100)+6,  y: PAD.t+14, t: '強勢加速 ▲', c: '#f87171' },
    { x: PAD.l+4,    y: PAD.t+14, t: '反彈觀察',   c: '#fbbf24' },
    { x: PAD.l+4,    y: PAD.t+CH-6, t: '弱勢惡化 ▼', c: '#4ade80' },
    { x: px(100)+6,  y: PAD.t+CH-6, t: '強勢減速',  c: '#93c5fd' },
  ];
  qLabels.forEach(q => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', q.x); t.setAttribute('y', q.y);
    t.setAttribute('fill', q.c); t.setAttribute('font-size', '9');
    t.setAttribute('font-family', "'IBM Plex Mono',monospace");
    t.setAttribute('opacity', '0.7');
    t.textContent = q.t;
    svg.appendChild(t);
  });

  // X 軸刻度
  const xTicks = _niceTicks(xMin, xMax, 5);
  xTicks.forEach(v => {
    const x = px(v);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x); tick.setAttribute('y1', PAD.t+CH);
    tick.setAttribute('x2', x); tick.setAttribute('y2', PAD.t+CH+4);
    tick.setAttribute('stroke', 'rgba(148,163,184,0.4)'); tick.setAttribute('stroke-width','1');
    svg.appendChild(tick);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x); label.setAttribute('y', PAD.t+CH+14);
    label.setAttribute('text-anchor','middle'); label.setAttribute('font-size','9');
    label.setAttribute('fill','rgba(148,163,184,0.7)');
    label.setAttribute('font-family', "'IBM Plex Mono',monospace");
    label.textContent = v.toFixed(1);
    svg.appendChild(label);
  });

  // Y 軸刻度
  const yTicks = _niceTicks(yMin, yMax, 5);
  yTicks.forEach(v => {
    const y = py(v);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', PAD.l-4); tick.setAttribute('y1', y);
    tick.setAttribute('x2', PAD.l);   tick.setAttribute('y2', y);
    tick.setAttribute('stroke', 'rgba(148,163,184,0.4)'); tick.setAttribute('stroke-width','1');
    svg.appendChild(tick);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', PAD.l-6); label.setAttribute('y', y+3);
    label.setAttribute('text-anchor','end'); label.setAttribute('font-size','9');
    label.setAttribute('fill','rgba(148,163,184,0.7)');
    label.setAttribute('font-family', "'IBM Plex Mono',monospace");
    label.textContent = v.toFixed(1);
    svg.appendChild(label);
  });

  // 軸標題
  const xTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xTitle.setAttribute('x', PAD.l + CW/2); xTitle.setAttribute('y', H-4);
  xTitle.setAttribute('text-anchor','middle'); xTitle.setAttribute('font-size','10');
  xTitle.setAttribute('fill','rgba(148,163,184,0.6)');
  xTitle.setAttribute('font-family', "'IBM Plex Mono',monospace");
  xTitle.textContent = 'RSR（相對強弱）';
  svg.appendChild(xTitle);

  const yTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yTitle.setAttribute('transform', `rotate(-90,12,${PAD.t+CH/2})`);
  yTitle.setAttribute('x', 12); yTitle.setAttribute('y', PAD.t+CH/2);
  yTitle.setAttribute('text-anchor','middle'); yTitle.setAttribute('font-size','10');
  yTitle.setAttribute('fill','rgba(148,163,184,0.6)');
  yTitle.setAttribute('font-family', "'IBM Plex Mono',monospace");
  yTitle.textContent = 'RSM（動能）';
  svg.appendChild(yTitle);

  // tooltip
  const tip = document.getElementById('rsmTooltip');

  // 泡泡
  points.forEach(p => {
    const x = px(p.rsr), y = py(p.rsm), r = rScale(p.rsm);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', r);
    circle.setAttribute('fill', p.color); circle.setAttribute('opacity', '0.75');
    circle.setAttribute('stroke', p.color); circle.setAttribute('stroke-width', '1.5');
    circle.style.cursor = 'pointer';
    circle.style.transition = 'opacity 0.15s';

    circle.addEventListener('mouseenter', (e) => {
      circle.setAttribute('opacity','1');
      tip.style.display = 'block';
      tip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;color:${p.color}">${p.name}</div>
        <div>RSR <span style="color:${p.rsr>=100?'#4ade80':'#f87171'}">${p.rsr.toFixed(2)}</span></div>
        <div>RSM <span style="color:${p.rsm>=100?'#4ade80':'#f87171'}">${p.rsm.toFixed(2)}</span></div>
      `;
    });
    circle.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 12) + 'px';
      tip.style.top  = (e.clientY - rect.top  - 10) + 'px';
    });
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('opacity','0.75');
      tip.style.display = 'none';
    });
    svg.appendChild(circle);

    // 文字標籤
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', x); txt.setAttribute('y', y + r + 11);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','9');
    txt.setAttribute('fill', p.color);
    txt.setAttribute('font-family', "'IBM Plex Mono',monospace");
    txt.setAttribute('font-weight','600');
    txt.textContent = p.label;
    svg.appendChild(txt);
  });

  canvas.appendChild(svg);
}

// ── 自選產業清單 ──────────────────────────────────────────────────────────────
function openRsmCustom() {
  const modal = document.getElementById('rsmCustomModal');
  if (!modal) return;
  // 填入 checkbox 清單（從 _rsmData 已有的 key + 預設清單）
  const available = Object.keys(_rsmData?.sectors || {}).length
    ? Object.keys(_rsmData.sectors)
    : RSM_DEFAULT_SECTORS;
  const current = _rsmCustomList || RSM_DEFAULT_SECTORS;

  const body = modal.querySelector('#rsmCustomList');
  body.innerHTML = available.map(name => `
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:0.78rem;color:var(--text,#e2e8f0);">
      <input type="checkbox" value="${name}" ${current.includes(name)?'checked':''}>
      <span style="color:var(--text,#e2e8f0);">${RSM_LABEL[name]||name}</span>
    </label>
  `).join('');
  modal.style.display = 'flex';
  // 點擊遮罩背景關閉
  modal.onclick = (e) => { if (e.target === modal) closeRsmCustom(); };
}

function closeRsmCustom() {
  const modal = document.getElementById('rsmCustomModal');
  if (modal) modal.style.display = 'none';
}

function applyRsmCustom() {
  const checks = document.querySelectorAll('#rsmCustomList input[type=checkbox]:checked');
  const selected = Array.from(checks).map(c => c.value);
  if (selected.length < 2) { alert('請至少選擇 2 個產業'); return; }
  _rsmCustomList = selected;
  closeRsmCustom();
  _rsmLoaded = false;
  loadSectorRSM();
}

function resetRsmCustom() {
  _rsmCustomList = null;
  closeRsmCustom();
  _rsmLoaded = false;
  loadSectorRSM();
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────
function _niceTicks(min, max, n) {
  const step = (max - min) / (n - 1);
  const ticks = [];
  for (let i = 0; i < n; i++) ticks.push(min + step * i);
  return ticks;
}

function _fmtVol(v) {
  // volume 單位為億元
  if (v >= 100) return v.toFixed(0) + '億';
  if (v >= 1)   return v.toFixed(1) + '億';
  return (v * 10000).toFixed(0) + '萬';
}
