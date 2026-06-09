function showFutures() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('futuresTab').classList.add('active');
  document.getElementById('newsFeed').style.display = 'none';
  const gp = document.getElementById('giftsPanel'); if (gp) gp.style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';
  document.querySelector('.feed-header').style.display = 'none';
  document.getElementById('sentimentPanel').style.display = 'none';
  document.getElementById('heatmapPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'none';
  document.getElementById('futuresPanel').style.display = 'block';
  if (!futuresData.length) loadFutures();
}

function hideFutures() {
  document.getElementById('futuresPanel').style.display = 'none';
  document.getElementById('newsFeed').style.display = 'block';
  document.querySelector('.feed-header').style.display = 'flex';
}

function setGroqStatus(msg, type) {
  const el = document.getElementById('groqStatus');
  if (!el) return;
  if (!el) return;
  el.textContent = msg;
  el.className = 'api-status' + (type ? ' ' + type : '');
}

function saveGroqKey() {
  setGroqStatus('✓ 已啟用（已記住）', 'ok');
}

function loadSavedKeys() {
}

function updateStickyOffsets() {
  const header   = document.querySelector('header');
  const apiBar   = document.querySelector('.api-config-bar');
  const catBar   = document.querySelector('.category-bar');
  if (!header || !apiBar || !catBar) return;
  const hH = header.offsetHeight;
  const aH = apiBar.offsetHeight;
  apiBar.style.top = hH + 'px';
  catBar.style.top = (hH + aH) + 'px';
}
updateStickyOffsets();
window.addEventListener('resize', updateStickyOffsets);

async function loadMktSignals() {
  if (loadMktSignals._busy) return;
  loadMktSignals._busy = true;
  try {
  const [optData, instData, marginData] = await Promise.allSettled([
    fetch(API_BASE + '?endpoint=options').then(r => r.json()),
    fetch(API_BASE + '?endpoint=institutional').then(r => r.json()),
    fetch(API_BASE + '?endpoint=margin').then(r => r.json()),
  ]);

  let score = 0;
  let oiScore = 0, vScore = 0;

  const opt  = optData.status  === 'fulfilled' ? optData.value  : null;
  const inst = instData.status === 'fulfilled' ? instData.value : null;

  if (opt && opt.pcRatio) {
    const pcOI  = opt.pcRatio.oi;

    const oiEl = document.getElementById('ms_pcOI');
    const oiLbl = document.getElementById('ms_pcOILabel');
    oiEl.textContent = pcOI != null ? pcOI.toFixed(2) : '—';
    let oiColor = 'var(--muted)', oiText = '中性'; oiScore = 0;
    if (pcOI != null) {
      if      (pcOI >= 1.7)  { oiColor='var(--up)';   oiText='強力偏多'; oiScore=2; }
      else if (pcOI >= 1.3)  { oiColor='var(--up)';   oiText='略偏多';   oiScore=1; }
      else if (pcOI >= 1.0)  { oiColor='var(--muted)'; oiText='中性';    oiScore=0; }
      else if (pcOI >= 0.7)  { oiColor='var(--down)';  oiText='略偏空';  oiScore=-1;}
      else                   { oiColor='var(--down)';  oiText='強力偏空'; oiScore=-2;}
    }
    oiEl.style.color  = oiColor;
    oiLbl.textContent = oiText;
    oiLbl.style.color = oiColor;
    score += oiScore;

    const mp = opt.maxPain;
    document.getElementById('ms_maxPain').textContent = mp ? mp.toLocaleString() + ' 點' : '—';

    const msTrendEl = document.getElementById('ms_maxPainTrend');
    if (msTrendEl) renderMaxPainTrend('ms_maxPainTrend');

    const instRows = document.getElementById('ms_instRows');
    const inst = opt.institution || {};
    instRows.innerHTML = ['外資','自營商','投信'].map(name => {
      const v = inst[name];
      if (!v || v.net == null) return '';
      const net   = v.net;
      const pos   = net >= 0;
      const color = pos ? 'var(--up)' : 'var(--down)';
      const sign  = pos ? '+' : '';
      const barW  = Math.min(100, Math.abs(net) / 5000 * 100);
      const callStr = v.call != null ? `${v.call >= 0 ? '+' : ''}${v.call.toLocaleString()}` : '—';
      const putStr  = v.put  != null ? `${v.put  >= 0 ? '+' : ''}${v.put.toLocaleString()}`  : '—';
      if (name === '外資') score += pos ? 1 : -1;
      return `<div style="margin-bottom:0.35rem;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:5px;background:var(--bg);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${color};font-weight:700;width:52px;text-align:right;">${sign}${net.toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:0.5rem;padding-left:42px;font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">
          <span>C <b style="color:var(--up);">${callStr}</b></span>
          <span>P <b style="color:var(--down);">${putStr}</b></span>
        </div>
      </div>`;
    }).join('');

    const optDate = opt.date || '';
    document.getElementById('ms_optTs').textContent = optDate ? `資料日期：${optDate}` : '';
  }

  (async () => {
    try {
      const tmf = await fetch(API_BASE + '?endpoint=tmf').then(r => r.json());
      document.getElementById('ms_tmfLoading').style.display = 'none';
      if (!tmf || !tmf.latest) return;
      document.getElementById('ms_tmfContent').style.display = 'block';

      const l = tmf.latest;
      const ratio = l.retail_ratio;
      const ratioColor = ratio > 0 ? 'var(--up)' : ratio < 0 ? 'var(--down)' : 'var(--muted)';

      const ratioEl = document.getElementById('ms_tmfRatio');
      ratioEl.textContent = (ratio >= 0 ? '+' : '') + ratio.toFixed(2);
      ratioEl.style.color = ratioColor;

      const lbl = document.getElementById('ms_tmfLabel');
      let lblText = '中性', lblBg = 'rgba(128,128,128,0.1)';
      if      (ratio >  20) { lblText = '散戶極度偏多 ⚠️'; lblBg = 'rgba(220,38,38,0.12)'; }
      else if (ratio >   5) { lblText = '散戶偏多';         lblBg = 'rgba(220,38,38,0.1)'; }
      else if (ratio >  -5) { lblText = '散戶中性';         lblBg = 'rgba(128,128,128,0.1)'; }
      else if (ratio > -20) { lblText = '散戶偏空';         lblBg = 'rgba(22,163,74,0.1)'; }
      else                  { lblText = '散戶極度偏空';     lblBg = 'rgba(22,163,74,0.12)'; }
      lbl.textContent       = lblText;
      lbl.style.color       = ratioColor;
      lbl.style.background  = lblBg;

      const tn = l.total_net;
      const to = l.total_oi;
      const tnEl = document.getElementById('ms_tmfTotalNet');
      tnEl.textContent = tn != null ? (tn >= 0 ? '+' : '') + tn.toLocaleString() : '—';
      tnEl.style.color = tn != null ? (tn >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--muted)';
      document.getElementById('ms_tmfTotalOI').textContent = to != null ? to.toLocaleString() : '—';

      document.getElementById('ms_tmfInstRows').innerHTML = [
        { name: '外資', val: l.foreign_net },
        { name: '投信', val: l.trust_net   },
        { name: '自營商', val: l.dealer_net },
      ].map(({ name, val }) => {
        if (val == null) return '';
        const pos   = val >= 0;
        const color = pos ? 'var(--up)' : 'var(--down)';
        const barW  = Math.min(100, Math.abs(val) / Math.max(1, Math.abs(tn || 1)) * 80);
        return `<div style="display:flex;align-items:center;gap:5px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:5px;background:var(--bg);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${color};font-weight:700;width:52px;text-align:right;">${pos?'+':''}${val.toLocaleString()}</span>
        </div>`;
      }).join('');

      const bars = (tmf.history || []).slice(0, 15).reverse();
      const maxR = Math.max(...bars.map(d => Math.abs(d.retail_ratio || 0)), 1);
      document.getElementById('ms_tmfBars').innerHTML = bars.map(d => {
        const r   = d.retail_ratio || 0;
        const h   = Math.abs(r / maxR * 36);
        const col = r > 0 ? 'var(--up)' : 'var(--down)';
        return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:38px;">
          <div style="height:${h.toFixed(1)}px;background:${col};border-radius:2px 2px 0 0;"></div>
        </div>`;
      }).join('');
      document.getElementById('ms_tmfDates').innerHTML = bars.map(d =>
        `<div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.42rem;color:var(--muted);text-align:center;overflow:hidden;">${d.date.slice(5)}</div>`
      ).join('');

      document.getElementById('ms_tmfTs').textContent = `公式：-1 × ${tn != null ? tn.toLocaleString() : '?'} ÷ ${to != null ? to.toLocaleString() : '?'} = ${ratio.toFixed(2)}%`;

      if (ratio > 10) score -= 1;
      else if (ratio < -10) score += 1;
    } catch(e) {
      document.getElementById('ms_tmfLoading').textContent = '微台 OI 資料載入失敗';
    }
  })();

  const margin = marginData.status === 'fulfilled' ? marginData.value : null;
  document.getElementById('ms_marginLoading').style.display = 'none';
  document.getElementById('ms_marginContent').style.display = margin ? 'block' : 'none';
  if (margin && margin.latest) {
    const lat = margin.latest;

    const mBal = lat.marginBalance ? Math.round(lat.marginBalance / 1e8 * 10) / 10 : null;
    const mChg = lat.marginChange  ? Math.round(lat.marginChange  / 1e8 * 10) / 10 : null;
    document.getElementById('ms_marginBal').textContent = mBal != null ? mBal.toFixed(1) : '—';
    const mChgEl = document.getElementById('ms_marginChg');
    if (mChg != null) {
      mChgEl.textContent = (mChg >= 0 ? '▲+' : '▼') + mChg.toFixed(1) + ' 億';
      mChgEl.style.color = mChg >= 0 ? '#dc2626' : '#16a34a';
      if (mChg > 0) score += 0.5;
    }

    const sBal = lat.shortBalance;
    const sChg = lat.shortChange;
    document.getElementById('ms_shortBal').textContent = sBal != null ? (sBal / 1000).toFixed(1) + 'k' : '—';
    const sChgEl = document.getElementById('ms_shortChg');
    if (sChg != null) {
      sChgEl.textContent = (sChg >= 0 ? '▲+' : '▼') + Math.abs(sChg / 1000).toFixed(1) + 'k張';
      sChgEl.style.color = sChg >= 0 ? '#16a34a' : '#dc2626';
    }

    const bars10m = (margin.data || []).slice(0, 10).reverse();
    const maxMar  = Math.max(...bars10m.map(d => d.marginBalance || 0));
    const minMar  = Math.min(...bars10m.map(d => d.marginBalance || 0));
    const rangeMar = maxMar - minMar || 1;
    document.getElementById('ms_marginBars').innerHTML = bars10m.map(d => {
      const h = ((d.marginBalance - minMar) / rangeMar * 28 + 4).toFixed(1);
      return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:32px;">
        <div style="height:${h}px;background:#dc2626;border-radius:2px 2px 0 0;opacity:0.75;"></div>
      </div>`;
    }).join('');

    document.getElementById('ms_marginTs').textContent = `資料日期：${margin.latestDate || ''}`;
  } else if (!margin) {
    document.getElementById('ms_marginLoading').textContent = '融資融券資料載入失敗';
    document.getElementById('ms_marginLoading').style.display = 'block';
  }

  const vixPriceEl = document.getElementById('vixPrice');
  const vixVal = vixPriceEl ? parseFloat(vixPriceEl.textContent) : NaN;
  let vixAdj = 0, vixNote = '';
  if (!isNaN(vixVal) && vixVal > 0) {
    if      (vixVal >= 35) { vixAdj = -2; vixNote = `VIX ${vixVal.toFixed(1)} 恐慌`; }
    else if (vixVal >= 25) { vixAdj = -1; vixNote = `VIX ${vixVal.toFixed(1)} 高波動`; }
    else if (vixVal <= 15) { vixAdj =  1; vixNote = `VIX ${vixVal.toFixed(1)} 低波動`; }
    else                   { vixNote = `VIX ${vixVal.toFixed(1)}`; }
    score += vixAdj;
  }

  const totalScore = Math.round(score * 10) / 10;
  const scoreEl = document.getElementById('mktSignalScore');
  const dotEl   = document.getElementById('mktSignalDot');
  const titleEl = document.getElementById('mktSignalTitle');
  const descEl  = document.getElementById('mktSignalDesc');
  scoreEl.textContent = (totalScore >= 0 ? '+' : '') + totalScore;
  let signalColor, signalTitle, signalDesc;
  if      (totalScore >= 5)  { signalColor='var(--up)';    signalTitle='強力多頭'; signalDesc='多指標共振偏多，動能強勁'; }
  else if (totalScore >= 3)  { signalColor='var(--up)';    signalTitle='明顯偏多'; signalDesc='多數指標偏多，注意過熱風險'; }
  else if (totalScore >= 1)  { signalColor='#f97316';      signalTitle='略偏多頭'; signalDesc='多空指標略偏多方'; }
  else if (totalScore >= -1) { signalColor='var(--muted)'; signalTitle='中性觀望'; signalDesc='多空訊號分歧，方向待確認'; }
  else if (totalScore >= -3) { signalColor='var(--down)';  signalTitle='略偏空頭'; signalDesc='多數指標偏空，留意下行風險'; }
  else                       { signalColor='#15803d';      signalTitle='明顯偏空'; signalDesc='空方訊號強烈，謹慎為宜'; }
  if (vixNote) signalDesc += `｜${vixNote}`;

  try {
    const alphaCache = sessionStorage.getItem('alpha_report_cache');
    const alphaData  = alphaCache ? JSON.parse(alphaCache) : null;
    const macro = alphaData?.macro_data;
    if (macro) {
      const y2  = macro['美債2Y殖利率']?.close;
      const y10 = macro['美債10Y殖利率']?.close;
      const fed = macro['聯準會利率']?.close;
      const dxy = macro['DXY美元指數']?.close;
      const sox = macro['SOX費城半導體']?.chg;
      const extraParts = [];
      if (y2 != null && y10 != null) {
        const spread = parseFloat((y10 - y2).toFixed(3));
        if (spread < 0) extraParts.push(`⚠️ 曲線倒掛(${spread}%)`);
        else extraParts.push(`利差+${spread}%`);
      }
      if (fed != null) extraParts.push(`Fed ${fed}%`);
      if (dxy != null) {
        const dxyChg = macro['DXY美元指數']?.chg;
        extraParts.push(`DXY ${dxy}${dxyChg != null ? `(${dxyChg > 0 ? '+' : ''}${dxyChg}%)` : ''}`);
      }
      if (sox != null) extraParts.push(`SOX ${sox > 0 ? '+' : ''}${sox}%`);
      if (extraParts.length) signalDesc += `｜${extraParts.join(' ')}`;
    }
  } catch { /* 靜默 */ }

  const gaugeVal = Math.round(Math.max(0, Math.min(100, (totalScore + 8) / 16 * 100)));
  const arcTotal = 331;
  const arcFill  = (gaugeVal / 100 * arcTotal).toFixed(1);

  const gaugeArc   = document.getElementById('signalGaugeArc');
  const gaugeScore = document.getElementById('signalGaugeScore');
  const gaugeLbl   = document.getElementById('signalGaugeLabel');

  gaugeScore.textContent = gaugeVal;
  gaugeScore.setAttribute('fill', signalColor);
  gaugeLbl.textContent   = signalTitle;
  gaugeLbl.setAttribute('fill', signalColor);
  gaugeArc.setAttribute('stroke', signalColor);
  gaugeArc.setAttribute('stroke-dasharray', `${arcFill} 415`);

  titleEl.textContent      = signalTitle;
  titleEl.style.color      = signalColor;
  descEl.textContent       = signalDesc;

  function _setSubGauge(arcId, txtId, lblId, rawScore, maxRaw, labelText, color) {
    const pct  = Math.max(0, Math.min(100, (rawScore + maxRaw) / (maxRaw * 2) * 100));
    const circ = 88;
    const fill = (pct / 100 * circ).toFixed(1);
    const arc  = document.getElementById(arcId);
    const txt  = document.getElementById(txtId);
    const lbl  = document.getElementById(lblId);
    if (!arc) return;
    arc.setAttribute('stroke-dasharray', `${fill} ${circ}`);
    arc.setAttribute('stroke', color);
    txt.setAttribute('fill', color);
    txt.textContent = Math.round(pct);
    if (lbl) { lbl.textContent = labelText; lbl.style.color = color; }
  }

  const chipsRaw   = (inst && inst.data && inst.data[0])
    ? (() => { const nb = Math.round(inst.data[0].net / 1e8 * 10) / 10; let s = nb >= 0 ? 1 : -1; const st = inst.streak || 0; s += st > 0 ? Math.min(2, Math.floor(Math.abs(st)/3)) : -Math.min(2, Math.floor(Math.abs(st)/3)); return s; })()
    : 0;
  const chipsColor = chipsRaw >= 1 ? 'var(--up)' : chipsRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const chipsLbl   = chipsRaw >= 2 ? '強力買超' : chipsRaw >= 1 ? '小幅買超' : chipsRaw <= -2 ? '強力賣超' : chipsRaw <= -1 ? '小幅賣超' : '中性';
  _setSubGauge('subArcChips', 'subTxtChips', 'subLblChips', chipsRaw, 3, chipsLbl, chipsColor);

  const optRaw   = opt ? (() => { let s = oiScore; const fw = (opt.institution||{})['外資']; if (fw && fw.net != null) s += (fw.net >= 0 ? 1 : -1); return s; })() : 0;
  const optColor = optRaw >= 1 ? 'var(--up)' : optRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const optLbl   = optRaw >= 2 ? 'PUT偏少' : optRaw >= 1 ? '略偏多' : optRaw <= -2 ? 'PUT偏多' : optRaw <= -1 ? '略偏空' : '中性';
  _setSubGauge('subArcOpt', 'subTxtOpt', 'subLblOpt', optRaw, 4, optLbl, optColor);

  const marginRaw   = (margin && margin.latest && margin.latest.marginChange != null)
    ? (margin.latest.marginChange > 0 ? 1 : margin.latest.marginChange < 0 ? -1 : 0) : 0;
  const marginColor = marginRaw >= 1 ? '#f97316' : marginRaw <= -1 ? 'var(--up)' : 'var(--muted)';
  const marginLbl   = marginRaw >= 1 ? '融資增加' : marginRaw <= -1 ? '融資減少' : '持平';
  _setSubGauge('subArcMargin', 'subTxtMargin', 'subLblMargin', marginRaw, 2, marginLbl, marginColor);

  const vixRaw   = vixAdj;
  const vixColor = vixRaw >= 1 ? 'var(--up)' : vixRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const vixLbl   = !isNaN(vixVal) && vixVal > 0 ? (vixVal >= 35 ? '極度恐慌' : vixVal >= 25 ? '高波動' : vixVal <= 15 ? '低波動' : '正常') : '待載入';
  _setSubGauge('subArcVix', 'subTxtVix', 'subLblVix', vixRaw, 2, vixLbl, vixColor);

  loadInstitutionalHistory();
  loadSignalBacktest();
  loadValuationSignal();
  loadBetaSignal();
  } catch(e) {
    console.error('[loadMktSignals] error:', e);
  } finally {
    loadMktSignals._busy = false;
  }
}

async function loadOptions() {
  const renderOptions = (data) => {
    document.getElementById('optLoading').style.display = 'none';
    document.getElementById('optContent').style.display = 'block';

    const pcOI  = data.pcRatio?.oi;
    const pcVal = document.getElementById('pcRatioVal');
    const pcLbl = document.getElementById('pcRatioLabel');
    pcVal.textContent = pcOI != null ? Number(pcOI).toFixed(2) : '—';
    let pcColor = 'var(--muted)', pcText = '中性';
    if (pcOI != null) {
      if      (pcOI >= 1.7)  { pcColor = 'var(--up)';    pcText = '強力偏多'; }
      else if (pcOI >= 1.3)  { pcColor = 'var(--up)';    pcText = '略偏多';   }
      else if (pcOI >= 1.0)  { pcColor = 'var(--muted)'; pcText = '中性';     }
      else if (pcOI >= 0.7)  { pcColor = 'var(--down)';  pcText = '略偏空';   }
      else                   { pcColor = 'var(--down)';   pcText = '強力偏空'; }
    }
    pcVal.style.color = pcColor;
    pcLbl.textContent = pcText;
    pcLbl.style.color = pcColor;
    document.getElementById('pcCallOI').textContent = data.pcRatio?.callOI?.toLocaleString() || '—';
    document.getElementById('pcPutOI').textContent  = data.pcRatio?.putOI?.toLocaleString()  || '—';

    const bc = data.byContract || {};
    const renderContractRow = (label, obj) => {
      if (!obj) return '';
      const pc = obj.pcRatio != null ? Number(obj.pcRatio).toFixed(2) : '—';
      const c  = obj.callOI  != null ? obj.callOI.toLocaleString()    : '—';
      const p  = obj.putOI   != null ? obj.putOI.toLocaleString()     : '—';
      const pcColor = obj.pcRatio == null ? 'var(--muted)'
                    : obj.pcRatio >= 1.3  ? 'var(--up)'
                    : obj.pcRatio >= 1.0  ? 'var(--muted)'
                    : 'var(--down)';
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:0.3rem;font-family:'IBM Plex Mono',monospace;font-size:0.6rem;">
        <span style="color:var(--muted);width:52px;flex-shrink:0;">${label}</span>
        <span style="color:${pcColor};font-weight:700;width:32px;">${pc}</span>
        <span style="color:var(--muted);">C</span><span style="color:var(--up);width:46px;">${c}</span>
        <span style="color:var(--muted);">P</span><span style="color:var(--down);width:46px;">${p}</span>
      </div>`;
    };
    const bcEl = document.getElementById('optByContract');
    if (bcEl) bcEl.innerHTML =
      renderContractRow('近月', bc.monthly) +
      renderContractRow('週三', bc.weekly_wed) +
      renderContractRow('週五', bc.weekly_fri);

    const instEl = document.getElementById('instRows');
    const inst = data.institution || {};
    instEl.innerHTML = ['外資','自營商','投信'].map(name => {
      const v = inst[name];
      if (!v || v.net == null) return '';
      const net   = v.net;
      const pos   = net >= 0;
      const color = pos ? 'var(--up)' : 'var(--down)';
      const sign  = pos ? '+' : '';
      const barW  = Math.min(100, Math.abs(net) / 5000 * 100);
      const callStr = v.call != null ? `${v.call >= 0 ? '+' : ''}${v.call.toLocaleString()}` : '—';
      const putStr  = v.put  != null ? `${v.put  >= 0 ? '+' : ''}${v.put.toLocaleString()}`  : '—';
      return `<div style="margin-bottom:0.5rem;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:7px;background:var(--surface);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${color};font-weight:700;width:56px;text-align:right;">${sign}${net.toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:0.6rem;padding-left:42px;font-family:'IBM Plex Mono',monospace;font-size:0.57rem;color:var(--muted);">
          <span>買權 <b style="color:var(--up);">${callStr}</b></span>
          <span>賣權 <b style="color:var(--down);">${putStr}</b></span>
        </div>
      </div>`;
    }).join('');

    const mp = data.maxPain;
    document.getElementById('maxPainVal').textContent = mp ? mp.toLocaleString() : '—';
    const today = new Date();
    const dow = today.getDay();
    const daysToWed = ((3 - dow + 7) % 7) || 7;
    const daysToFri = ((5 - dow + 7) % 7) || 7;
    const nearestDays = Math.min(daysToWed, daysToFri);
    const nearestDay  = daysToWed <= daysToFri ? '週三' : '週五';
    document.getElementById('maxPainNote').textContent =
      `距最近結算（${nearestDay}）${nearestDays} 天 · 賣方（法人）獲利最大點`;

    const trendEl = document.getElementById('maxPainTrendChart');
    if (trendEl) renderMaxPainTrend('maxPainTrendChart');

    document.getElementById('optTs').textContent = `資料日期：${data.date || '—'}${data._source === 'supabase' ? '（Supabase）' : ''}`;
  };

  try {
    const res  = await fetch(API_BASE + '?endpoint=options');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error || !data.pcRatio) throw new Error(data.error || 'no data');
    renderOptions(data);
  } catch(e) {
    console.warn('loadOptions FinMind 失敗，嘗試 Supabase fallback:', e.message);
    try {
      const rows = await sbFetch('options_analytics_daily', 'order=date.desc&limit=2&select=date,contract_type,pc_ratio_oi,call_oi,put_oi,foreign_opt_net');
      if (!rows?.length) throw new Error('Supabase 也無資料');
      const allRow = rows.find(r => r.contract_type === 'all') || rows[0];
      const fallbackData = {
        date:    allRow.date,
        _source: 'supabase',
        pcRatio: { oi: allRow.pc_ratio_oi, callOI: allRow.call_oi, putOI: allRow.put_oi },
        byContract: null,
        institution: {
          '外資':  { net: allRow.foreign_opt_net, call: null, put: null },
          '自營商': { net: null, call: null, put: null },
          '投信':  { net: null, call: null, put: null },
        },
        maxPain: null,
      };
      renderOptions(fallbackData);
    } catch(e2) {
      const is504 = e.message.includes('504') || e.message.includes('timeout');
      const msg = is504 ? '選擇權資料暫時無法取得（伺服器逾時），請稍後重新整理' : `選擇權資料載入失敗：${e.message}`;
      document.getElementById('optLoading').textContent = msg;
      console.warn('loadOptions fallback 也失敗:', e2.message);
    }
  }
}

// ════════ 個股歷史走勢圖 Modal ════════

async function openStockModal(stock) {
  const modal = document.getElementById('stockModal');
  modal.classList.add('open');
  document.body.classList.add('modal-open');

  const sign  = stock.chgPct >= 0 ? '+' : '';
  const pct   = (stock.chgPct * 100).toFixed(2);
  const color = stock.chgPct >= 0 ? '#dc2626' : '#16a34a';
  document.getElementById('modalStockName').textContent = `${stock.id} ${stock.name}`;
  document.getElementById('modalStockMeta').textContent = `${stock.sector} · 市值 ${stock.mcap >= 10000 ? (stock.mcap/10000).toFixed(1)+'兆' : stock.mcap.toLocaleString()+'億'}`;

  document.getElementById('modalTodayStats').innerHTML = [
    { label:'收盤', val: `$${stock.price?.toFixed(2) ?? '—'}`, color: 'var(--text)' },
    { label:'漲跌幅', val: `${sign}${pct}%`, color },
    { label:'昨收', val: `$${stock.prev?.toFixed(2) ?? '—'}`, color: 'var(--muted)' },
    { label:'漲跌', val: `${sign}${((stock.price - stock.prev) || 0).toFixed(2)}`, color },
  ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
    <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:800;color:${s.color};">${s.val}</div>
  </div>`).join('');

  document.getElementById('modalTVLink').href      = `https://tw.tradingview.com/chart/?symbol=TWSE:${stock.id}`;
  document.getElementById('modalTVLink2').href     = `https://tw.tradingview.com/chart/?symbol=TWSE:${stock.id}`;
  document.getElementById('modalGoodInfoLink').href = `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${stock.id}`;
  document.getElementById('modalAnueLink').href    = `https://www.cnyes.com/twstock/${stock.id}`;

  const aiResult = document.getElementById('modalAiResult');
  const aiBtn    = document.getElementById('modalAiBtn');
  if (aiResult) {
    const cached = sessionStorage.getItem(`aiResearch_${stock.id}`);
    if (cached) {
      try {
        const obj = JSON.parse(cached);
        aiResult.innerHTML = obj.html;
        aiResult.style.display = 'block';
        if (aiBtn) aiBtn.textContent = '✦ 重新生成';
      } catch(e) {
        aiResult.style.display = 'none';
        aiResult.innerHTML = '';
        if (aiBtn) aiBtn.textContent = '✦ 生成機構風格個股分析';
      }
    } else {
      aiResult.style.display = 'none';
      aiResult.innerHTML = '';
      if (aiBtn) aiBtn.textContent = '✦ 生成機構風格個股分析';
    }
  }

  if (typeof isTradingHours === 'function' && isTradingHours()) {
    fetch(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stock.id}.tw&_=${Date.now()}`,
      { headers: { Referer: 'https://mis.twse.com.tw/' }, signal: AbortSignal.timeout(5000) }
    ).then(r => r.json()).then(json => {
      const row = (json.msgArray || []).find(r => r.z && r.z !== '-');
      if (!row) return;
      const price  = parseFloat(row.z);
      const prev   = parseFloat(row.y);
      const up     = parseFloat(row.u);
      const down   = parseFloat(row.w);
      if (!price || !prev) return;
      const chg    = parseFloat((price - prev).toFixed(2));
      const chgPct = parseFloat((chg / prev * 100).toFixed(2));
      const sign   = chgPct >= 0 ? '+' : '';
      const color  = chgPct >= 0 ? '#dc2626' : '#16a34a';
      const limitTag = price >= up   ? '<span style="font-size:0.55rem;margin-left:4px;color:#ff9500;font-weight:700;">漲停</span>'
                     : price <= down ? '<span style="font-size:0.55rem;margin-left:4px;color:#06b6d4;font-weight:700;">跌停</span>'
                     : '';
      document.getElementById('modalTodayStats').innerHTML = [
        { label:'即時價 ⚡', val: `$${price.toFixed(2)}${limitTag}`, color, raw: true },
        { label:'漲跌幅',    val: `${sign}${chgPct.toFixed(2)}%`,    color },
        { label:'昨收',      val: `$${prev.toFixed(2)}`,             color: 'var(--muted)' },
        { label:'漲跌',      val: `${sign}${chg.toFixed(2)}`,        color },
      ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
        <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:800;color:${s.color};">${s.raw ? s.val : s.val}</div>
      </div>`).join('');
      const vol = parseInt(row.v);
      if (vol > 0) {
        const nameEl = document.getElementById('modalStockName');
        if (nameEl && !nameEl.querySelector('.mis-time')) {
          const timeTag = document.createElement('span');
          timeTag.className = 'mis-time';
          timeTag.style.cssText = 'font-size:0.55rem;color:var(--muted);margin-left:0.5rem;font-family:"IBM Plex Mono",monospace;font-weight:400;';
          timeTag.textContent = `${row.t} · ${(vol/1000).toFixed(0)}k張`;
          nameEl.appendChild(timeTag);
        }
      }
    }).catch(() => {});
  }

  document.getElementById('modalLoading').style.display = 'block';
  document.getElementById('modalChart').style.display   = 'none';
  document.getElementById('modalNoData').style.display  = 'none';
  document.getElementById('modalTVLink').style.display  = 'inline';

  // ── bar chart（Supabase 收盤走勢）──
  await _loadModalBarChart(stock);
}

async function _loadModalBarChart(stock) {
  try {
    const rows = await sbFetch('stock_daily_twse',
      `stock_id=eq.${stock.id}&order=date.desc&limit=60&select=date,close,chg_pct,prev`);
    if (!rows || rows.length < 2) {
      document.getElementById('modalLoading').style.display = 'none';
      document.getElementById('modalNoData').style.display  = 'block';
      return;
    }
    const data = rows.slice().reverse();
    document.getElementById('modalDays').textContent       = data.length;
    document.getElementById('modalDataSource').textContent = '· Supabase';

    const closes  = data.map(d => d.close);
    const minC    = Math.min(...closes);
    const maxC    = Math.max(...closes);
    const rangeC  = maxC - minC || (minC * 0.01) || 1;
    const BAR_H   = 100;
    const BAR_W   = Math.max(4, Math.min(14, Math.floor(560 / data.length)));
    const GAP     = data.length > 30 ? 1 : 2;

    const barsWrap = document.getElementById('modalBars');
    barsWrap.style.overflowX = 'auto';
    barsWrap.style.overflowY = 'hidden';
    barsWrap.innerHTML = `<div style="display:flex;align-items:flex-end;gap:${GAP}px;height:${BAR_H}px;min-width:100%;">` +
      data.map((d, i) => {
        const hPct  = (d.close - minC) / rangeC * 80 + 15;
        const hPx   = Math.max(4, (hPct / 100 * BAR_H)).toFixed(1);
        const isPos = d.chg_pct >= 0;
        const col   = isPos ? '#dc2626' : '#16a34a';
        const isLast = i === data.length - 1;
        const opacity = isLast ? 1 : 0.65;
        return `<div style="flex-shrink:0;width:${BAR_W}px;display:flex;flex-direction:column;justify-content:flex-end;height:${BAR_H}px;cursor:default;"
          title="${d.date}\n$${d.close}\n${isPos?'+':''}${(d.chg_pct*100).toFixed(2)}%">
          <div style="height:${hPx}px;background:${col};border-radius:2px 2px 0 0;opacity:${opacity};"
            onmouseover="this.style.opacity=1" onmouseout="this.style.opacity='${opacity}'"></div>
        </div>`;
      }).join('') + '</div>';

    document.getElementById('modalBarDates').innerHTML =
      `<div style="display:flex;gap:${GAP}px;">` +
      data.map((d, i) =>
        `<div style="flex-shrink:0;width:${BAR_W}px;font-family:'IBM Plex Mono',monospace;font-size:0.4rem;color:var(--muted);text-align:center;overflow:hidden;">
          ${i % 5 === 0 ? d.date.slice(5) : ''}
        </div>`
      ).join('') + '</div>';

    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalChart').style.display   = 'block';
    _loadModalStats(stock);
  } catch(e) {
    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalNoData').style.display  = 'block';
    console.warn('stockModal bar chart error:', e);
  }
}

async function _loadModalStats(stock) {
  try {
    const rows = await sbFetch('stock_daily_twse',
      `stock_id=eq.${stock.id}&order=date.desc&limit=60&select=date,close,chg_pct`);
    if (!rows || rows.length < 2) return;
    const data     = rows.slice().reverse();
    const chgPcts  = data.map(d => d.chg_pct * 100);
    const upDays   = chgPcts.filter(p => p >= 0).length;
    const maxGain  = Math.max(...chgPcts).toFixed(2);
    const maxLoss  = Math.min(...chgPcts).toFixed(2);
    const totalChg = ((data[data.length-1].close - data[0].close) / data[0].close * 100).toFixed(2);
    const statsEl  = document.getElementById('modalStats');
    if (statsEl) statsEl.innerHTML = [
      { label:`${data.length}日累積漲跌`, val:`${totalChg >= 0 ? '+':''}${totalChg}%`, color: totalChg >= 0 ? '#dc2626' : '#16a34a' },
      { label:'上漲天數', val:`${upDays} / ${data.length}`, color:'var(--accent2)' },
      { label:'單日最大漲/跌', val:`+${maxGain}% / ${maxLoss}%`, color:'var(--muted)' },
    ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;font-weight:700;color:${s.color};margin-top:2px;">${s.val}</div>
    </div>`).join('');
  } catch(e) { /* 靜默 */ }
}

function closeStockModal() {
  document.getElementById('stockModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  const aiBtn = document.getElementById('modalAiBtn');
  if (aiBtn) aiBtn.disabled = false;
}

async function runStockAI() {
  const btn      = document.getElementById('modalAiBtn');
  const resultEl = document.getElementById('modalAiResult');
  if (!btn || !resultEl) return;
  const nameEl = document.getElementById('modalStockName');
  const metaEl = document.getElementById('modalStockMeta');
  const statsEl= document.getElementById('modalTodayStats');
  if (!nameEl) return;
  const stockTitle = nameEl.textContent.trim();
  const stockMeta  = metaEl?.textContent.trim() || '';
  const statsText  = statsEl?.innerText?.replace(/\n/g,' ') || '';
  const stockId    = stockTitle.split(' ')[0];
  const hmData     = heatmapData || [];
  const stockData  = hmData.find(r => r.id === stockId) || {};
  const valInfo    = stockData.per > 0
    ? `本益比 ${stockData.per.toFixed(1)}x（${stockData.valLabel}）、殖利率 ${stockData.dy?.toFixed(2)||'N/A'}%、PBR ${stockData.pbr?.toFixed(2)||'N/A'}x`
    : '估值資料暫無';
  const bars       = document.querySelectorAll('#modalBars [title]');
  const recentDays = Array.from(bars).slice(-5).map(b => b.title).join('、') || '走勢資料暫無';
  btn.disabled = true;
  btn.textContent = '⏳ 分析中…';
  resultEl.style.display = 'none';
  const prompt = `你是台灣股市資深研究員，擅長從機構研究角度分析個股。請用繁體中文對以下股票進行快速研究分析（200-250字），嚴格按照此框架：

【基本資料】${stockTitle}｜${stockMeta}
【今日行情】${statsText}
【估值指標】${valInfo}
【近5日走勢】${recentDays}

請依序輸出以下五段（每段一行，加粗標題）：
**催化劑 Catalyst**：該股近期最可能的驅動事件或題材
**基本面 Fundamentals**：本益比合理性、獲利成長性評估
**價格動能 Momentum**：近期走勢強弱、與大盤相對表現
**風險因子 Risk**：需警惕的下行風險（地緣/產業/公司層面）
**投資論點 Thesis**：共識預期是否有誤判空間（where might consensus be wrong）

語氣專業、數據具體、避免空話。結尾加一行免責聲明：⚠ 本分析為 AI 生成，僅供參考，不構成投資建議。`;
  try {
    const text = await callGroq(prompt, 900, 0.65);
    const now  = new Date();
    const ts   = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false,
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tsHtml   = `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-bottom:0.5rem;opacity:0.75;">◆ AI 生成｜${ts}</div>`;
    resultEl.innerHTML = tsHtml + text.replace(/\n/g, '<br>');
    resultEl.style.display = 'block';
    btn.textContent = '✦ 重新生成';
    btn.disabled = false;
    sessionStorage.setItem(`aiResearch_${stockId}`, JSON.stringify({ html: resultEl.innerHTML, ts }));
  } catch(e) {
    resultEl.textContent = `分析失敗：${e.message}`;
    resultEl.style.display = 'block';
    btn.textContent = '✦ 生成機構風格個股分析';
    btn.disabled = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStockModal();
});

// ════════ Max Pain 近5日趨勢圖（共用函式）════════
async function renderMaxPainTrend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Max Pain 趨勢載入中…</span>';
  try {
    // ── 每天取最高優先有值的合約：weekly_fri → weekly_wed → monthly ──
    const contractPriority = ['weekly_fri', 'weekly_wed', 'monthly'];
    const allRows = await sbFetch('options_analytics_daily',
      `order=date.desc&limit=21&select=date,max_pain,contract_type`);
    // 按日期分組，每天只取優先序最高且有值的那筆
    const byDate = {};
    (allRows || []).forEach(d => {
      if (d.max_pain == null || d.max_pain <= 0) return;
      const pri = contractPriority.indexOf(d.contract_type);
      if (pri === -1) return;
      if (!byDate[d.date] || pri < byDate[d.date].pri) {
        byDate[d.date] = { ...d, pri };
      }
    });
    // 取最近 5 天有值的資料
    const rows = Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    // usedContract 取最新那天的合約類型（用於標籤）
    let usedContract = rows.length ? rows[0].contract_type : '';
    if (rows.length < 2) {
      el.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Max Pain 資料累積中…</span>';
      return;
    }
    const data = [...rows].reverse();
    const vals = data.map(d => d.max_pain || 0).filter(v => v > 0);
    if (vals.length < 2) { el.innerHTML = ''; return; }
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = maxV - minV || 200;
    const latest = vals[vals.length - 1];
    const prev   = vals[vals.length - 2];
    const diff   = latest - prev;
    const diffColor = diff > 0 ? 'var(--up)' : diff < 0 ? 'var(--down)' : 'var(--muted)';

    const W = 200, H = 52;
    const DPR = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const PL = 4, PR = 4, PT = 6, PB = 14;
    const iW = W - PL - PR, iH = H - PT - PB;

    ctx.strokeStyle = 'rgba(128,128,180,0.12)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(PL, PT + iH / 2);
    ctx.lineTo(W - PR, PT + iH / 2);
    ctx.stroke();

    const pts = data.filter(d => d.max_pain > 0).map((d, i, arr) => ({
      x: PL + (i / Math.max(arr.length - 1, 1)) * iW,
      y: PT + iH - ((d.max_pain - minV) / range) * iH,
      v: d.max_pain, date: d.date,
    }));
    if (pts.length < 2) { el.innerHTML = ''; return; }

    const grad = ctx.createLinearGradient(0, PT, 0, PT + iH);
    grad.addColorStop(0, 'rgba(99,102,241,0.2)');
    grad.addColorStop(1, 'rgba(99,102,241,0.02)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, PT + iH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, PT + iH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    pts.forEach((p, i) => {
      const isLast = i === pts.length - 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLast ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? '#818cf8' : 'rgba(129,140,248,0.55)';
      ctx.fill();
      if (isLast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
    });

    ctx.fillStyle = 'rgba(110,110,126,0.65)';
    ctx.font = `7px "IBM Plex Mono",monospace`;
    ctx.textBaseline = 'bottom';
    [[pts[0], 'left'], [pts[pts.length-1], 'right']].forEach(([p, align]) => {
      ctx.textAlign = align;
      ctx.fillText(p.date.slice(5), p.x, H - 1);
    });

    el.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border);';

    // ── 合約類型標籤 ──
    const ctLabel = usedContract === 'weekly_fri' ? '近週五' : usedContract === 'weekly_wed' ? '近週三' : '月選';
    const label = document.createElement('div');
    label.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-bottom:4px;";
    label.textContent = `近 ${data.length} 日 Max Pain 走勢（${ctLabel}）`;
    wrapper.appendChild(label);

    // ── canvas 容器（relative，用來放 tooltip）──
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:relative;display:inline-block;width:' + W + 'px;';
    canvasWrap.appendChild(canvas);

    // ── tooltip DOM ──
    const tip = document.createElement('div');
    tip.style.cssText = [
      'position:absolute;pointer-events:none;display:none;',
      "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;font-weight:700;",
      'color:#818cf8;background:var(--surface);border:1px solid var(--border);',
      'border-radius:5px;padding:2px 6px;white-space:nowrap;',
      'transform:translate(-50%,-100%);margin-top:-6px;z-index:10;',
    ].join('');
    canvasWrap.appendChild(tip);

    // ── hover 事件 ──
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left);
      // 找最近的點
      let closest = null, minDist = Infinity;
      pts.forEach(p => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (!closest || minDist > iW / pts.length * 0.8) { tip.style.display = 'none'; return; }
      tip.textContent = closest.date.slice(5) + '  ' + closest.v.toLocaleString();
      tip.style.display = 'block';
      // 水平位置：跟點對齊，但避免超出左右邊界
      const tipHalfW = 50;
      const clampedX = Math.max(tipHalfW, Math.min(W - tipHalfW, closest.x));
      tip.style.left = clampedX + 'px';
      tip.style.top  = closest.y + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    // touch 支援
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX - rect.left);
      let closest = null, minDist = Infinity;
      pts.forEach(p => { const d = Math.abs(p.x - mx); if (d < minDist) { minDist = d; closest = p; } });
      if (!closest) return;
      tip.textContent = closest.date.slice(5) + '  ' + closest.v.toLocaleString();
      tip.style.display = 'block';
      const tipHalfW = 50;
      const clampedX = Math.max(tipHalfW, Math.min(W - tipHalfW, closest.x));
      tip.style.left = clampedX + 'px';
      tip.style.top  = closest.y + 'px';
    }, { passive: false });
    canvas.addEventListener('touchend', () => { tip.style.display = 'none'; });

    wrapper.appendChild(canvasWrap);

    const summary = document.createElement('div');
    summary.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-top:4px;';
    summary.innerHTML = `
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;font-weight:700;color:#818cf8;">${latest.toLocaleString()} 點</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:${diffColor};">${diff >= 0 ? '+' : ''}${diff.toLocaleString()} vs 前日</span>
    `;
    wrapper.appendChild(summary);
    el.appendChild(wrapper);
  } catch(e) {
    el.innerHTML = '';
    console.warn('[renderMaxPainTrend]', e.message);
  }
}

// ════════ Alpha 部位風險總覽 ════════
function renderRiskOverview(positions) {
  const el = document.getElementById('alphaRiskOverview');
  if (!el) return;
  const open = positions.filter(p => p.status === 'open' || p.status === 'hold');
  if (!open.length) { el.style.display = 'none'; return; }
  const now = Date.now();
  const ids = [...new Set(open.map(p => p.stock_id))];
  sbFetch('stock_daily_twse',
    `stock_id=in.(${ids.join(',')})&order=date.desc&limit=${ids.length * 2}&select=stock_id,close,date`
  ).then(rows => {
    const priceMap = {};
    (rows || []).forEach(r => { if (!priceMap[r.stock_id]) priceMap[r.stock_id] = r.close; });
    let totalCost = 0, totalMktVal = 0, totalMaxLoss = 0, totalDays = 0;
    const enriched = open.map(p => {
      const cur    = priceMap[p.stock_id] || p.entry_price;
      const cost   = p.entry_price * p.shares * 1000;
      const mktVal = cur * p.shares * 1000;
      const pnlAmt = mktVal - cost;
      const pnlPct = cost > 0 ? pnlAmt / cost * 100 : 0;
      const maxLoss = p.stop_loss ? (p.stop_loss - p.entry_price) * p.shares * 1000 : -cost * 0.1;
      const days = p.opened_at ? Math.floor((now - new Date(p.opened_at).getTime()) / 86400000) : 0;
      totalCost += cost; totalMktVal += mktVal;
      totalMaxLoss += Math.min(0, maxLoss); totalDays += days;
      return { ...p, cur, cost, mktVal, pnlAmt, pnlPct, maxLoss, days };
    });
    const floatPnl    = totalMktVal - totalCost;
    const floatPnlPct = totalCost > 0 ? floatPnl / totalCost * 100 : 0;
    const avgDays     = open.length ? Math.round(totalDays / open.length) : 0;
    const fmt = (v, d = 1) => v >= 1e8 ? `${(v/1e8).toFixed(d)} 億` : v >= 1e4 ? `${(v/1e4).toFixed(d)} 萬` : v.toFixed(0) + ' 元';
    const pnlColor = floatPnl >= 0 ? 'var(--up)' : 'var(--down)';
    el.style.display = 'block';
    el.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--accent);border-left:2px solid var(--accent);padding-left:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.75rem;">⚖️ 部位風險總覽</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;margin-bottom:0.75rem;">
        ${[
          { label:'總持倉成本',   val: fmt(totalCost),      color:'var(--text)' },
          { label:'當前市值',     val: fmt(totalMktVal),    color:'var(--text)' },
          { label:'浮動損益',     val: `${floatPnl>=0?'+':''}${fmt(Math.abs(floatPnl))} (${floatPnl>=0?'+':''}${floatPnlPct.toFixed(2)}%)`, color: pnlColor },
          { label:'最大潛在虧損', val: fmt(Math.abs(totalMaxLoss)), color:'var(--down)' },
          { label:'持倉檔數',     val: `${open.length} 檔`, color:'var(--muted)' },
          { label:'平均持有',     val: `${avgDays} 天`,     color:'var(--muted)' },
        ].map(s => `<div style="background:var(--bg);border-radius:8px;padding:0.5rem 0.65rem;box-shadow:0 0 0 1px var(--border);">
          <div style="font-size:0.52rem;color:var(--muted);margin-bottom:2px;">${s.label}</div>
          <div style="font-size:0.72rem;font-weight:700;color:${s.color};">${s.val}</div>
        </div>`).join('')}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--accent);border-left:2px solid var(--accent);padding-left:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.5rem;">📊 個別持倉狀態</div>
      ${enriched.map(p => {
        const isLong = !p.style || p.style !== 'short';
        const pnlColor = p.pnlPct >= 0 ? 'var(--up)' : 'var(--down)';
        const lo = p.stop_loss ? Math.min(p.stop_loss, p.entry_price, p.cur) : Math.min(p.entry_price, p.cur) * 0.92;
        const hi = p.target_price ? Math.max(p.target_price, p.entry_price, p.cur) : Math.max(p.entry_price, p.cur) * 1.12;
        const range = hi - lo || 1;
        const toX = v => Math.max(0, Math.min(100, ((v - lo) / range * 100))).toFixed(1);
        const entX = toX(p.entry_price), curX = toX(p.cur);
        const tgtX = p.target_price ? toX(p.target_price) : null;
        const slX  = p.stop_loss    ? toX(p.stop_loss)    : null;
        const barLeft  = Math.min(parseFloat(entX), parseFloat(curX));
        const barWidth = Math.abs(parseFloat(curX) - parseFloat(entX));
        return `<div style="background:var(--surface);border-radius:10px;padding:0.65rem 0.8rem;box-shadow:0 0 0 1px var(--border);margin-bottom:0.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;font-weight:700;color:var(--text);">${p.stock_id} ${p.stock_name||''}</span>
              <span style="font-size:0.52rem;padding:1px 5px;border-radius:4px;background:${isLong?'rgba(220,38,38,0.1)':'rgba(22,163,74,0.1)'};color:${isLong?'var(--up)':'var(--down)'};font-family:'IBM Plex Mono',monospace;">${p.style||'多單'}</span>
              ${p.days ? `<span style="font-size:0.5rem;color:var(--muted);font-family:'IBM Plex Mono',monospace;">持有 ${p.days} 天</span>` : ''}
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;font-weight:700;color:${pnlColor};">${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%</div>
          </div>
          <div style="position:relative;height:10px;background:var(--bg);border-radius:4px;margin-bottom:4px;">
            <div style="position:absolute;top:0;left:${barLeft}%;width:${barWidth}%;height:100%;background:${pnlColor};border-radius:4px;opacity:0.75;"></div>
            <div style="position:absolute;top:-3px;left:${entX}%;transform:translateX(-50%);width:3px;height:16px;background:#818cf8;border-radius:2px;" title="進場 ${p.entry_price}"></div>
            <div style="position:absolute;top:-4px;left:${curX}%;transform:translateX(-50%);width:4px;height:18px;background:${pnlColor};border-radius:2px;box-shadow:0 0 4px ${pnlColor};" title="現價 ${p.cur}"></div>
            ${tgtX !== null ? `<div style="position:absolute;top:-2px;left:${tgtX}%;transform:translateX(-50%);width:2px;height:14px;background:#f59e0b;border-radius:2px;opacity:0.8;" title="目標 ${p.target_price}"></div>` : ''}
            ${slX  !== null ? `<div style="position:absolute;top:-2px;left:${slX}%;transform:translateX(-50%);width:2px;height:14px;background:#6b7280;border-radius:2px;opacity:0.7;" title="停損 ${p.stop_loss}"></div>` : ''}
          </div>
          <div style="position:relative;height:14px;margin-bottom:2px;">
            <span style="position:absolute;left:${entX}%;transform:translateX(-50%);font-family:'IBM Plex Mono',monospace;font-size:0.48rem;color:#818cf8;white-space:nowrap;">進 ${p.entry_price}</span>
            <span style="position:absolute;left:${curX}%;transform:translateX(-50%);font-family:'IBM Plex Mono',monospace;font-size:0.5rem;font-weight:700;color:${pnlColor};white-space:nowrap;">${p.cur}</span>
            ${tgtX !== null ? `<span style="position:absolute;left:${tgtX}%;transform:translateX(-50%);font-family:'IBM Plex Mono',monospace;font-size:0.48rem;color:#f59e0b;white-space:nowrap;">目標 ${p.target_price}</span>` : ''}
            ${slX  !== null ? `<span style="position:absolute;left:${slX}%;transform:translateX(-50%);font-family:'IBM Plex Mono',monospace;font-size:0.48rem;color:#6b7280;white-space:nowrap;">停損 ${p.stop_loss}</span>` : ''}
          </div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:4px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);">${p.shares} 張</span>
            ${p.reason ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.reason}">${p.reason}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;color:var(--muted);margin-top:0.5rem;opacity:0.7;">⚠ 市值以 Supabase 最新收盤價計算，非即時報價。僅供參考。</div>`;
  }).catch(() => {
    el.style.display = 'block';
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);">部位風險總覽：無法取得最新收盤價，請稍後重試。</div>`;
  });
}
