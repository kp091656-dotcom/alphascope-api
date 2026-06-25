// ════════════════════════════════════════
// 🤖 Alpha 交易員
// ════════════════════════════════════════

let alphaPendingCloseId = null;

const MOOD_STYLE = {
  '樂觀': { bg: 'rgba(220,38,38,0.12)',  color: 'var(--up)',   border: 'rgba(220,38,38,0.3)' },
  '中性': { bg: 'rgba(148,163,184,0.12)', color: 'var(--muted)', border: 'rgba(148,163,184,0.25)' },
  '謹慎': { bg: 'rgba(251,191,36,0.12)',  color: '#d97706',   border: 'rgba(251,191,36,0.35)' },
  '悲觀': { bg: 'rgba(22,163,74,0.12)',   color: 'var(--down)', border: 'rgba(22,163,74,0.3)' },
};
const ACTION_STYLE = {
  '買進': { bg: 'rgba(220,38,38,0.07)',  color: 'var(--up)',   border: 'rgba(220,38,38,0.2)' },
  '觀察': { bg: 'rgba(110,110,126,0.07)', color: 'var(--muted)', border: 'rgba(110,110,126,0.18)' },
  '避開': { bg: 'rgba(22,163,74,0.07)',  color: 'var(--down)', border: 'rgba(22,163,74,0.2)' },
};
const CONF_STYLE = { '高': 'var(--up)', '中': '#d97706', '低': 'var(--down)' };

function _alphaBadge(el, text, bgColor, textColor) {
  el.textContent = text;
  el.style.background = bgColor;
  el.style.color = textColor;
}

function _alphaTodayStr() {
  return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    .replace(/\//g, '-')
    .replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
}

// ── 持倉浮動損益（從 Supabase 抓最新收盤）──
async function _alphaFetchLatestPrices(stockIds) {
  if (!stockIds || !stockIds.length) return {};
  try {
    const dateRes = await sbFetch('stock_daily_twse', 'order=date.desc&limit=1&select=date');
    const latestDate = Array.isArray(dateRes) && dateRes[0]?.date ? dateRes[0].date : null;
    if (!latestDate) return {};
    const rows = await sbFetch('stock_daily_twse',
      `date=eq.${latestDate}&stock_id=in.(${stockIds.join(',')})&select=stock_id,close`);
    const map = {};
    if (Array.isArray(rows)) rows.forEach(r => { map[r.stock_id] = { close: r.close, date: latestDate }; });
    return map;
  } catch { return {}; }
}

// 頁面載入時自動讀取今日報告
async function loadAlphaDailyReport() {
  const badge   = document.getElementById('alphaStatusBadge');
  const loading = document.getElementById('alphaLoading');
  loading.style.display = 'block';
  _alphaBadge(badge, '載入中', 'rgba(99,102,241,0.15)', '#818cf8');
  try {
    const res = await fetch(`${API_BASE}?endpoint=alpha_report&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    try { sessionStorage.setItem('alpha_report_cache', JSON.stringify(data)); } catch { }
    const today   = _alphaTodayStr();
    const isToday = data.report_date === today;
    await renderAlphaResult(data);
    _alphaBadge(badge,
      isToday ? '✓ 今日報告' : `報告：${data.report_date}`,
      isToday ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
      isToday ? '#22c55e' : '#d97706');
    const dateBadge = document.getElementById('alphaDateBadge');
    if (!isToday) {
      dateBadge.textContent = `⚠️ 非今日報告（${data.report_date}）`;
      dateBadge.style.display = 'inline';
      dateBadge.style.color = '#d97706';
    } else {
      dateBadge.style.display = 'none';
    }
  } catch(e) {
    _alphaBadge(badge, '尚無報告', 'rgba(148,163,184,0.15)', 'var(--muted)');
    document.getElementById('alphaRecommendations').innerHTML =
      `<div style="color:var(--muted);font-size:0.85rem;padding:1.5rem;text-align:center;">今日報告尚未生成<br><span style="font-size:0.75rem;opacity:0.55;">每個交易日 08:05 自動更新</span></div>`;
  } finally {
    loading.style.display = 'none';
  }
}

// 手動刷新（Owner 限定）
async function alphaAnalyze() {
  if (!isOwnerUnlocked()) { alert('需要 Owner 身份才能手動刷新'); return; }
  const btn     = document.getElementById('alphaBtn');
  const loading = document.getElementById('alphaLoading');
  const badge   = document.getElementById('alphaStatusBadge');
  const loadTxt = document.getElementById('alphaLoadingText');
  btn.disabled = true; btn.textContent = '分析中…';
  document.getElementById('alphaMarketSummary').style.display = 'none';
  document.getElementById('alphaRecommendations').innerHTML = '';
  document.getElementById('alphaDateBadge').style.display = 'none';
  _alphaBadge(badge, '分析中', 'rgba(99,102,241,0.15)', '#818cf8');

  const steps = ['正在抓取市場資料…', '分析新聞與社群情緒…', 'AI 生成交易建議…', '最終校正與儲存…'];
  let si = 0;
  loadTxt.textContent = steps[0];
  loading.style.display = 'block';
  const timer = setInterval(() => { si = Math.min(si+1, steps.length-1); loadTxt.textContent = steps[si]; }, 7000);

  try {
    const ownerToken = getOwnerToken();
    const res = await fetch(`${API_BASE}?endpoint=alpha_analyze`, {
      headers: { 'x-owner-token': ownerToken }
    });
    clearInterval(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    await renderAlphaResult(data);
    _alphaBadge(badge, '✓ 手動分析完成', 'rgba(34,197,94,0.15)', '#22c55e');
  } catch(e) {
    clearInterval(timer);
    _alphaBadge(badge, '錯誤', 'rgba(239,68,68,0.15)', '#ef4444');
    document.getElementById('alphaRecommendations').innerHTML =
      `<div style="color:var(--muted);font-size:0.85rem;padding:1rem;">Alpha 分析失敗：${e.message}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '🔄 手動刷新';
    loading.style.display = 'none';
  }
}

async function renderAlphaResult(data) {
  const mood = data.market_mood || '中性';
  const ms   = MOOD_STYLE[mood] || MOOD_STYLE['中性'];
  const moodBadge = document.getElementById('alphaMoodBadge');
  moodBadge.textContent = mood;
  moodBadge.style.cssText = `font-size:0.7rem;padding:2px 9px;border-radius:99px;font-weight:600;background:${ms.bg};color:${ms.color};border:1px solid ${ms.border};`;

  const genTime = document.getElementById('alphaGenTime');
  genTime.textContent = data.generated_at
    ? new Date(data.generated_at).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  document.getElementById('alphaMarketText').textContent = data.market_summary || '';

  const metaBar = document.getElementById('alphaMetaBar');
  if (metaBar) {
    const dominant = data.dominant_player || '';
    const retail   = data.retail_signal  || '';
    const margin   = data.margin_alert   || '';
    const cashSug  = data.suggest_cash;
    const cashRsn  = data.cash_reason    || '';

    const dominantColor = dominant.includes('外資') ? 'var(--up)' : dominant.includes('散戶') ? 'var(--down)' : 'var(--accent)';
    const retailColor   = retail.includes('警戒') ? 'var(--down)' : retail.includes('機會') ? 'var(--up)' : 'var(--muted)';
    const marginColor   = margin.includes('危機') ? 'var(--down)' : margin.includes('注意') ? '#d97706' : 'var(--muted)';

    metaBar.innerHTML = [
      dominant ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${dominantColor};font-weight:600;">👤 ${dominant}</span>` : '',
      retail   ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${retailColor};font-weight:600;">散戶：${retail}</span>` : '',
      margin   ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${marginColor};font-weight:600;">融資：${margin}</span>` : '',
    ].filter(Boolean).join('');
    metaBar.style.display = metaBar.innerHTML ? 'flex' : 'none';

    const cashBar = document.getElementById('alphaCashBar');
    if (cashBar) {
      if (cashSug) {
        cashBar.innerHTML = `<span style="font-size:0.75rem;font-weight:700;color:#d97706;">💰 今日建議空手觀望</span><span style="font-size:0.65rem;color:var(--muted);margin-left:0.5rem;">${cashRsn}</span>`;
        cashBar.style.display = 'flex';
      } else {
        cashBar.style.display = 'none';
      }
    }
  }

  const noteEl = document.getElementById('alphaNote');
  if (data.alpha_note) {
    noteEl.textContent = `💬 ${data.alpha_note}`;
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }

  let macroEl = document.getElementById('alphaMacroBar');
  if (!macroEl) {
    macroEl = document.createElement('div');
    macroEl.id = 'alphaMacroBar';
    macroEl.style.cssText = 'margin-top:0.6rem;display:none;';
    const noteEl2 = document.getElementById('alphaNote');
    if (noteEl2?.parentNode) noteEl2.parentNode.insertBefore(macroEl, noteEl2.nextSibling);
  }
  if (macroEl) {
    let macroHtml = '';
    const fg = data.fear_greed;
    if (fg?.score != null) {
      const score   = fg.score;
      const rating  = fg.rating || '';
      const prev7   = fg.prev_week;
      const fgColor = score >= 75 ? '#ef4444' : score >= 56 ? '#f97316'
                    : score <= 25 ? '#22c55e' : score <= 44 ? '#86efac' : '#94a3b8';
      const trendStr = prev7 != null
        ? `<span style="font-size:0.58rem;color:var(--muted);margin-left:3px;">${score > prev7 ? '▲' : '▼'}上週${prev7}</span>`
        : '';
      macroHtml += `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.45rem 0.6rem;background:var(--surface);border-radius:6px;border:1px solid var(--border);">
        <span style="font-size:0.6rem;color:var(--muted);flex-shrink:0;">😨 恐懼貪婪</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:700;color:${fgColor};">${score}</span>
        <span style="font-size:0.6rem;color:${fgColor};font-weight:600;">${rating}</span>
        ${trendStr}
      </div>`;
    }
    const macro = data.macro_data;
    if (macro && Object.keys(macro).length) {
      const KEY_ORDER = ['SOX費城半導體','DXY美元指數','美債10Y殖利率','美債2Y殖利率','台幣USD/TWD','聯準會利率','S&P500'];
      const items = KEY_ORDER.filter(k => macro[k]?.close != null).map(k => {
        const d     = macro[k];
        const chg   = d.chg;
        const chgColor = chg > 0 ? '#dc2626' : chg < 0 ? '#16a34a' : 'var(--muted)';
        const chgStr   = chg != null ? `<span style="font-size:0.55rem;color:${chgColor};margin-left:2px;">${chg > 0 ? '+' : ''}${chg}%</span>` : '';
        const valStr = k === '聯準會利率' ? `${d.close}%` : d.close;
        return `<div style="display:flex;flex-direction:column;align-items:center;padding:0.35rem 0.5rem;background:var(--surface);border-radius:6px;border:1px solid var(--border);min-width:0;">
          <span style="font-size:0.5rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56px;text-align:center;">${k.replace('殖利率','').replace('費城半導體','').replace('美元指數','').replace('USD/TWD','匯率')}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;font-weight:700;color:var(--text);">${valStr}</span>
          ${chgStr}
        </div>`;
      });
      if (items.length) {
        macroHtml += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:0.35rem;margin-top:0.4rem;">${items.join('')}</div>`;
        const y2  = macro['美債2Y殖利率']?.close;
        const y10 = macro['美債10Y殖利率']?.close;
        if (y2 != null && y10 != null) {
          const spread = parseFloat((y10 - y2).toFixed(3));
          if (spread < 0) {
            macroHtml += `<div style="font-size:0.65rem;color:#f97316;padding:0.3rem 0.5rem;background:rgba(249,115,22,0.08);border-radius:4px;border:1px solid rgba(249,115,22,0.2);margin-top:0.35rem;">
              ⚠️ 殖利率曲線倒掛（10Y-2Y=${spread > 0 ? '+' : ''}${spread}%）歷史衰退前兆
            </div>`;
          }
        }
      }
    }
    if (macroHtml) { macroEl.innerHTML = macroHtml; macroEl.style.display = 'block'; }
    else macroEl.style.display = 'none';
  }

  const src = data.data_sources || {};
  const srcEl = document.getElementById('alphaDataSources');
  const srcParts = [];
  if (src.stocks) srcParts.push(`${src.stocks} 支股票`);
  if (src.news)   srcParts.push(`${src.news} 則新聞`);
  if (src.ptt)    srcParts.push(`PTT×${src.ptt}`);
  srcEl.textContent = srcParts.join(' · ') || '多來源';

  document.getElementById('alphaMarketSummary').style.display = 'block';

  const buyIds = (data.recommendations || []).filter(r => r.action === '買進').map(r => r.stock_id);
  const priceMap = await _alphaFetchLatestPrices(buyIds);

  const container = document.getElementById('alphaRecommendations');
  container.innerHTML = '';
  for (const rec of (data.recommendations || [])) {
    const as    = ACTION_STYLE[rec.action] || ACTION_STYLE['觀察'];
    const isBuy = rec.action === '買進';
    const latest = priceMap[rec.stock_id];

    let floatHtml = '';
    if (isBuy && latest && rec.entry_price) {
      const close     = latest.close;
      const floatPct  = ((close - rec.entry_price) / rec.entry_price * 100);
      const floatClr  = floatPct >= 0 ? 'var(--up)' : 'var(--down)';
      const floatSign = floatPct >= 0 ? '+' : '';
      const lo  = rec.stop_loss    || (rec.entry_price * 0.94);
      const hi  = rec.target_price || (rec.entry_price * 1.10);
      const range = hi - lo;
      const barPct   = range > 0 ? Math.max(0, Math.min(100, (close - lo) / range * 100)) : 50;
      const entryPct = range > 0 ? Math.max(0, Math.min(100, (rec.entry_price - lo) / range * 100)) : 50;
      floatHtml = `
        <div style="margin:0.55rem 0 0.3rem;padding:0.5rem 0.7rem;background:rgba(0,0,0,0.03);border-radius:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">
            <span style="font-size:0.72rem;color:var(--muted);">現價 <b style="color:var(--text);">${close}</b>
              <span style="margin-left:0.35rem;color:${floatClr};font-weight:700;">${floatSign}${floatPct.toFixed(2)}%</span>
            </span>
            <span style="font-size:0.63rem;color:var(--muted);">${latest.date} 收盤</span>
          </div>
          <div style="position:relative;height:6px;background:rgba(22,163,74,0.15);border-radius:3px;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${barPct.toFixed(1)}%;background:${floatClr};border-radius:3px;transition:width 0.5s;"></div>
            <div style="position:absolute;top:-2px;height:10px;width:2px;background:var(--muted);border-radius:1px;left:${entryPct.toFixed(1)}%;" title="進場價"></div>
            <div style="position:absolute;top:-3px;left:calc(${barPct.toFixed(1)}% - 5px);width:10px;height:10px;border-radius:50%;background:${floatClr};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:left 0.5s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.3rem;font-size:0.62rem;color:var(--muted);">
            <span style="color:var(--down);">停損 ${rec.stop_loss ?? '-'}</span>
            <span>進場 ${rec.entry_price ?? '-'}</span>
            <span style="color:var(--up);">目標 ${rec.target_price ?? '-'}</span>
          </div>
        </div>`;
    }

    const card = document.createElement('div');
    card.style.cssText = `background:${as.bg};border:1px solid ${as.border};border-radius:12px;padding:0.9rem 1.1rem;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.55rem;flex-wrap:wrap;">
        <span style="font-weight:700;font-size:0.95rem;color:var(--text);">${rec.stock_id} ${rec.stock_name || ''}</span>
        <span style="font-size:0.68rem;padding:2px 8px;border-radius:99px;background:${as.bg};color:${as.color};border:1px solid ${as.border};font-weight:600;">${rec.action}</span>
        <span style="font-size:0.68rem;padding:2px 7px;border-radius:99px;background:var(--bg);color:var(--muted);border:1px solid var(--border);">${rec.style || ''}</span>
        <span style="font-size:0.55rem;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.1);color:var(--accent);font-weight:500;">${rec.signal_source || ''}</span>
        ${(()=>{
          const confMap = { '高': { score: 9, color: 'var(--up)', label: '高' }, '中': { score: 6, color: '#d97706', label: '中' }, '低': { score: 3, color: 'var(--down)', label: '低' } };
          const c = confMap[rec.confidence] || { score: 5, color: 'var(--muted)', label: rec.confidence || '-' };
          const r = 9; const circ = 2 * Math.PI * r;
          const dash = (c.score / 10 * circ).toFixed(1);
          return `<span title="信心度 ${c.score}/10" style="display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">
            <svg width="28" height="28" viewBox="0 0 28 28" style="display:block;">
              <circle cx="14" cy="14" r="${r}" fill="none" stroke="rgba(128,128,128,0.15)" stroke-width="2.5"/>
              <circle cx="14" cy="14" r="${r}" fill="none" stroke="${c.color}" stroke-width="2.5"
                stroke-dasharray="${dash} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>
              <text x="14" y="18" text-anchor="middle" font-size="7.5" font-weight="700" fill="${c.color}" font-family="inherit">${c.score}</text>
            </svg>
            <span style="font-size:0.62rem;color:${c.color};font-weight:600;">${c.label}</span>
          </span>`;
        })()}
        ${rec.expected_return_pct != null ? `<span style="font-size:0.75rem;color:var(--up);font-weight:700;margin-left:auto;">預期 +${rec.expected_return_pct}%</span>` : ''}
      </div>
      ${!isBuy ? `<div style="display:flex;gap:1.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:0.5rem;flex-wrap:wrap;">
        <span>進場 <b style="color:var(--text);">${rec.entry_price ?? '-'}</b></span>
        <span>目標 <b style="color:var(--up);">${rec.target_price ?? '-'}</b></span>
        <span>停損 <b style="color:var(--down);">${rec.stop_loss ?? '-'}</b></span>
        <span>持有 <b style="color:var(--text);">${rec.holding_days ?? '-'} 天</b></span>
      </div>` : ''}
      ${isBuy ? floatHtml : ''}
      <div style="font-size:0.82rem;color:var(--text);line-height:1.65;margin:0.5rem 0;">${rec.reason || ''}</div>
      <div style="font-size:0.74rem;color:#d97706;padding:0.3rem 0.6rem;background:rgba(251,191,36,0.09);border-radius:6px;">⚠️ ${rec.risk || ''}</div>
      ${isBuy ? `
      <div style="margin-top:0.65rem;padding-top:0.6rem;border-top:1px solid ${as.border};display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <span style="font-size:0.73rem;color:var(--up);font-weight:600;">✅ Alpha 已自動進場</span>
        <span style="font-size:0.68rem;color:var(--muted);">· 計畫持有 ${rec.holding_days ?? '-'} 天</span>
      </div>` : ''}
    `;
    container.appendChild(card);
  }
}

function alphaOpenCloseModal(id, stockId, stockName, entryPrice, currentClose) {
  alphaPendingCloseId = id;
  document.getElementById('alphaExitPriceInput').value = currentClose || '';
  const infoEl = document.getElementById('alphaCloseInfo');
  if (stockId) {
    const floatPct = (currentClose && entryPrice) ? ((currentClose - entryPrice) / entryPrice * 100) : null;
    const floatStr = floatPct != null ? `　浮動 <b style="color:${floatPct>=0?'var(--up)':'var(--down)'};">${floatPct>=0?'+':''}${floatPct.toFixed(2)}%</b>` : '';
    infoEl.innerHTML = `${stockId} ${stockName || ''}　進場 ${entryPrice ?? '-'}${floatStr}`;
  } else { infoEl.textContent = ''; }
  document.getElementById('alphaCloseModal').style.display = 'flex';
}

async function alphaConfirmClose() {
  const exitPrice = parseFloat(document.getElementById('alphaExitPriceInput').value);
  if (!exitPrice || exitPrice <= 0) { alert('請輸入有效出場價格'); return; }
  const ownerToken = getOwnerToken();
  try {
    const res = await fetch(`${API_BASE}?endpoint=alpha_positions&action=close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-owner-token': ownerToken },
      body: JSON.stringify({ id: alphaPendingCloseId, exit_price: exitPrice }),
    });
    const data = await res.json();
    document.getElementById('alphaCloseModal').style.display = 'none';
    const pnl = data.pnl; const pct = data.pnl_pct;
    alert(`平倉完成\n損益：${pnl >= 0 ? '+' : ''}${(pnl||0).toLocaleString()} 元（${pct >= 0 ? '+' : ''}${(pct||0).toFixed(2)}%）`);
    showAlphaReport();
  } catch(e) { alert(`平倉失敗：${e.message}`); }
}

async function showAlphaReport() {
  const modal = document.getElementById('alphaReportModal');
  const cont  = document.getElementById('alphaReportContent');
  modal.style.display = 'block';
  cont.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">載入中…</div>';
  const ownerToken = getOwnerToken();

  try {
    const [openRes, closedRes] = await Promise.all([
      fetch(`${API_BASE}?endpoint=alpha_positions&action=list&status=open`,   { headers: { 'x-owner-token': ownerToken } }),
      fetch(`${API_BASE}?endpoint=alpha_positions&action=list&status=closed`, { headers: { 'x-owner-token': ownerToken } }),
    ]);
    const open   = (await openRes.json()).data   || [];
    const closed = (await closedRes.json()).data || [];

    const openIds = open.map(p => p.stock_id);
    const latestPrices = await _alphaFetchLatestPrices(openIds);

    // ── 部位風險總覽（新功能）──
    renderRiskOverview(open);

    const wins     = closed.filter(p => (p.pnl||0) > 0).length;
    const losses   = closed.filter(p => (p.pnl||0) <= 0).length;
    const totalPnl = closed.reduce((s,p) => s+(p.pnl||0), 0);
    const winRate  = closed.length ? (wins/closed.length*100).toFixed(1) : '-';
    const avgPct   = closed.length ? (closed.reduce((s,p)=>s+(p.pnl_pct||0),0)/closed.length).toFixed(2) : '-';
    const maxWin   = closed.length ? Math.max(...closed.map(p=>p.pnl||0)) : 0;
    const maxLoss  = closed.length ? Math.min(...closed.map(p=>p.pnl||0)) : 0;

    let maxStreak = 0, maxLoseStreak = 0, curW = 0, curL = 0;
    const sortedClosed = [...closed].sort((a,b) => new Date(a.closed_at)-new Date(b.closed_at));
    for (const p of sortedClosed) {
      if ((p.pnl||0) > 0) { curW++; curL=0; maxStreak=Math.max(maxStreak,curW); }
      else { curL++; curW=0; maxLoseStreak=Math.max(maxLoseStreak,curL); }
    }

    let cum = 0;
    const cumData = sortedClosed.map(p => { cum += (p.pnl||0); return { date: p.closed_at?.slice(0,10), pnl: cum, label: p.stock_id }; });
    const sortedByPct = [...closed].sort((a,b) => (b.pnl_pct||0)-(a.pnl_pct||0));

    const renderOpenRow = (p) => {
      const lat = latestPrices[p.stock_id];
      const close = lat?.close;
      const fp = close && p.entry_price ? ((close-p.entry_price)/p.entry_price*100) : null;
      const fc = fp != null ? (fp>=0?'var(--up)':'var(--down)') : 'var(--muted)';
      const days = p.opened_at ? Math.floor((Date.now()-new Date(p.opened_at))/86400000) : '-';
      return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem;">
        <td style="padding:0.45rem 0.35rem;font-weight:600;">${p.stock_id}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.stock_name||''}</td>
        <td style="padding:0.45rem 0.35rem;">${p.entry_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--up);">${p.target_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--down);">${p.stop_loss??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${close??'–'}</td>
        <td style="padding:0.45rem 0.35rem;color:${fc};font-weight:600;">${fp!=null?(fp>=0?'+':'')+fp.toFixed(2)+'%':'–'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${days}天</td>
        <td style="padding:0.45rem 0.35rem;">
          <button onclick="alphaOpenCloseModal(${p.id},'${p.stock_id}','${(p.stock_name||'').replace(/'/g,'')}',${p.entry_price||0},${close||0})"
            style="font-size:0.7rem;padding:2px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);cursor:pointer;color:var(--text);">平倉</button>
        </td>
      </tr>`;
    };

    const renderClosedRow = (p) => {
      const pc = (p.pnl||0)>=0?'var(--up)':'var(--down)';
      const pt = `${(p.pnl||0)>=0?'+':''}${(p.pnl||0).toLocaleString()} (${(p.pnl_pct||0)>=0?'+':''}${(p.pnl_pct||0).toFixed(2)}%)`;
      const days = (p.opened_at&&p.closed_at) ? Math.round((new Date(p.closed_at)-new Date(p.opened_at))/86400000) : '-';
      return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem;">
        <td style="padding:0.45rem 0.35rem;font-weight:600;">${p.stock_id}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.stock_name||''}</td>
        <td style="padding:0.45rem 0.35rem;">${p.entry_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--up);">${p.target_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--down);">${p.stop_loss??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:${pc};font-weight:700;">${pt}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${days !== '-' ? days+'天' : '-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.closed_at?new Date(p.closed_at).toLocaleDateString('zh-TW'):''}</td>
      </tr>`;
    };

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-bottom:1.1rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${totalPnl>=0?'var(--up)':'var(--down)'};">${totalPnl>=0?'+':''}${totalPnl.toLocaleString()}</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">累計損益（元）</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${parseFloat(winRate)>=50?'var(--up)':'var(--down)'};">${winRate}%</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">${wins}勝 ${losses}敗</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${parseFloat(avgPct)>=0?'var(--up)':'var(--down)'};">${parseFloat(avgPct)>=0?'+':''}${avgPct}%</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">平均報酬率</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;">${open.length}</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">持倉中</div>
        </div>
      </div>

      ${closed.length >= 2 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">📈 累積損益曲線</div>
          <canvas id="alphaCumChart" height="120"></canvas>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">📊 個別交易損益（按報酬率排序）</div>
          <canvas id="alphaBarChart" height="120"></canvas>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">🥧 勝率分布</div>
          <canvas id="alphaWinChart" height="110" style="max-width:140px;"></canvas>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.6rem;">🏆 績效紀錄</div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大獲利</span><b style="color:var(--up);">+${maxWin.toLocaleString()} 元</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大虧損</span><b style="color:var(--down);">${maxLoss.toLocaleString()} 元</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大連勝</span><b>${maxStreak} 次</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大連敗</span><b>${maxLoseStreak} 次</b></div>
          <div style="font-size:0.8rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">總交易次數</span><b>${closed.length} 次</b></div>
        </div>
      </div>` : closed.length === 1 ? `
      <div style="background:var(--surface);border-radius:10px;padding:0.8rem;border:1px solid var(--border);margin-bottom:0.75rem;font-size:0.8rem;color:var(--muted);text-align:center;">累積 2 筆以上平倉後將顯示圖表分析</div>` : ''}

      ${open.length ? `
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.4rem;">📂 持倉中（${open.length}）</div>
      <div style="overflow-x:auto;margin-bottom:1rem;">
        <table style="width:100%;border-collapse:collapse;min-width:580px;">
          <thead><tr style="font-size:0.68rem;color:var(--muted);border-bottom:2px solid var(--border);">
            <th style="padding:0.4rem 0.35rem;text-align:left;">代號</th><th style="padding:0.4rem 0.35rem;text-align:left;">名稱</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">進場</th><th style="padding:0.4rem 0.35rem;text-align:left;">目標</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">停損</th><th style="padding:0.4rem 0.35rem;text-align:left;">現價</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">浮動</th><th style="padding:0.4rem 0.35rem;text-align:left;">持有</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">操作</th>
          </tr></thead>
          <tbody>${open.map(p => renderOpenRow(p)).join('')}</tbody>
        </table>
      </div>` : ''}

      ${closed.length ? `
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.4rem;">📜 歷史交易（${closed.length}）</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:560px;">
          <thead><tr style="font-size:0.68rem;color:var(--muted);border-bottom:2px solid var(--border);">
            <th style="padding:0.4rem 0.35rem;text-align:left;">代號</th><th style="padding:0.4rem 0.35rem;text-align:left;">名稱</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">進場</th><th style="padding:0.4rem 0.35rem;text-align:left;">目標</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">停損</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">損益</th><th style="padding:0.4rem 0.35rem;text-align:left;">持有天</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">平倉日</th>
          </tr></thead>
          <tbody>${closed.map(p => renderClosedRow(p)).join('')}</tbody>
        </table>
      </div>` : ''}

      ${!open.length && !closed.length ? `<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.85rem;">Alpha 尚無交易紀錄<br><span style="font-size:0.75rem;opacity:0.55;">每個交易日 08:05 自動生成報告並進場</span></div>` : ''}
      <div style="font-size:0.62rem;color:var(--muted);margin-top:1.2rem;text-align:center;padding-top:0.8rem;border-top:1px solid var(--border);">⚠️ 以上為 AI 模擬交易紀錄，不構成投資建議</div>
    `;

    if (closed.length >= 2) {
      if (!window.Chart) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#6e6e7e';
      const gridC = 'rgba(0,0,0,0.06)';
      const ax    = { ticks: { color: muted, font: { size: 9 } }, grid: { color: gridC } };

      new window.Chart(document.getElementById('alphaCumChart'), {
        type: 'line',
        data: {
          labels: cumData.map(d => d.date),
          datasets: [{
            data: cumData.map(d => d.pnl),
            borderColor: totalPnl >= 0 ? '#dc2626' : '#16a34a',
            backgroundColor: totalPnl >= 0 ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.07)',
            fill: true, tension: 0.35, pointRadius: 3,
            pointBackgroundColor: cumData.map(d => d.pnl >= 0 ? '#dc2626' : '#16a34a'),
            pointHoverRadius: 5,
          }],
        },
        plugins: [{
          id: 'zeroLine',
          afterDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!scales.y) return;
            const y0 = scales.y.getPixelForValue(0);
            if (y0 < chartArea.top || y0 > chartArea.bottom) return;
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
            ctx.setLineDash([4,3]); ctx.beginPath();
            ctx.moveTo(chartArea.left, y0); ctx.lineTo(chartArea.right, y0); ctx.stroke(); ctx.restore();
          }
        }],
        options: {
          responsive: true,
          plugins: { legend: { display: false }, tooltip: { callbacks: {
            title: ctx => `${ctx[0].label}　${cumData[ctx[0].dataIndex]?.label||''}`,
            label: ctx => `累積損益：${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toLocaleString()} 元`,
          }}},
          scales: { x: ax, y: { ...ax, ticks: { ...ax.ticks, callback: v => `${v>=0?'+':''}${(v/1000).toFixed(0)}K` } } },
        },
      });

      new window.Chart(document.getElementById('alphaBarChart'), {
        type: 'bar',
        data: {
          labels: sortedByPct.map(p => p.stock_id),
          datasets: [{ data: sortedByPct.map(p => p.pnl_pct||0),
            backgroundColor: sortedByPct.map(p => (p.pnl||0)>=0?'rgba(220,38,38,0.75)':'rgba(22,163,74,0.75)'), borderRadius: 3 }],
        },
        options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: ctx => `${ctx[0].label} ${sortedByPct[ctx[0].dataIndex]?.stock_name||''}`,
          label: ctx => [`報酬率：${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%`,
            `損益：${(sortedByPct[ctx[0].dataIndex]?.pnl||0)>=0?'+':''}${(sortedByPct[ctx[0].dataIndex]?.pnl||0).toLocaleString()} 元`],
        }}},
        scales: { x: ax, y: { ...ax, ticks: { ...ax.ticks, callback: v => `${v>=0?'+':''}${v}%` } } } },
      });

      new window.Chart(document.getElementById('alphaWinChart'), {
        type: 'doughnut',
        data: { labels: ['獲利','虧損'], datasets: [{ data: [wins, losses],
          backgroundColor: ['rgba(220,38,38,0.8)','rgba(22,163,74,0.8)'], borderWidth: 0 }] },
        options: { responsive: true, cutout: '60%', plugins: {
          legend: { display: true, position: 'bottom', labels: { color: muted, font: { size: 9 }, boxWidth: 10, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}：${ctx.parsed} 次` } },
        }},
      });
    }

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:1rem;">載入失敗：${e.message}</div>`;
  }
}

function initAlphaIfNeeded() {
  if (!window._alphaLoaded) {
    window._alphaLoaded = true;
    loadAlphaDailyReport();
    loadAlphaThoughts();
    _startAlphaThoughtsTimer();
  }
}

function toggleAlphaBacktest() {
  const p = document.getElementById('alphaBacktestPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

// ════════ 多空訊號回測（Supabase）════════

// ════════════════════════════════════════
// 📝 Alpha 隨筆專欄
// ════════════════════════════════════════

const MOOD_COLOR = {
  bullish:  { text: '看多', color: 'var(--up)',   bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.2)' },
  bearish:  { text: '看空', color: 'var(--down)', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  cautious: { text: '謹慎', color: '#d97706',     bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)' },
  neutral:  { text: '中性', color: 'var(--muted)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
};

const PRED_COLOR = {
  bullish: { text: '預測↑', color: 'var(--up)',   bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)' },
  bearish: { text: '預測↓', color: 'var(--down)', bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.18)' },
  neutral: { text: '預測→', color: 'var(--muted)', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)' },
};

const RESULT_STYLE = {
  correct: { text: '✓ 命中', color: 'var(--up)' },
  wrong:   { text: '✗ 失誤', color: 'var(--down)' },
  pending: { text: '待驗證', color: 'var(--muted)' },
};

const RANK_ICON = {
  '菜鳥交易員': '🐣',
  '盤中觀察者': '👁️',
  '資深操盤手': '📊',
  '市場老狐狸': '🦊',
  'Alpha 傳奇': '👑',
  '精準狙擊手': '🎯',
  '市場預言家': '🔮',
  '鐵血操盤手': '⚔️',
  '傳奇預言家': '🌟',
};

function _escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _alphaTimeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)   return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

// ── 準確率趨勢圖（Canvas）──
function _renderAccuracyChart(canvasId, thoughts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  // 只取已評分，依 created_at 升序，最多取近 30 筆
  const rated = [...thoughts]
    .filter(t => t.pred_result === 'correct' || t.pred_result === 'wrong')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-30);
  if (rated.length < 2) {
    // 確保 canvas 有實際尺寸再繪製（offsetWidth 在 DOM 剛插入時可能為 0）
    const W0 = canvas.offsetWidth || 240;
    const H0 = canvas.offsetHeight || 72;
    canvas.width  = W0;
    canvas.height = H0;
    canvas.style.width  = W0 + 'px';
    canvas.style.height = H0 + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W0, H0);
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('累積 2 筆已評分預測後顯示', W0 / 2, H0 / 2 + 4);
    return;
  }

  // 計算每個點的累積命中率（滾動 10 筆窗口）
  const points = rated.map((_, i) => {
    const window = rated.slice(Math.max(0, i - 9), i + 1);
    const wCorrect = window.filter(t => t.pred_result === 'correct').length;
    return { acc: Math.round(wCorrect / window.length * 100), t: rated[i] };
  });

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 240;
  const H = canvas.offsetHeight || 72;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 28, padR = 8, padT = 8, padB = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Y 軸：0% ~ 100%
  const toX = i => padL + (i / (points.length - 1)) * chartW;
  const toY = v => padT + chartH - (v / 100) * chartH;

  // 格線 & 55% 基準線
  const muted = 'rgba(148,163,184,0.25)';
  ctx.strokeStyle = muted; ctx.lineWidth = 0.5;
  [0, 25, 50, 75, 100].forEach(v => {
    ctx.beginPath(); ctx.moveTo(padL, toY(v)); ctx.lineTo(padL + chartW, toY(v)); ctx.stroke();
  });
  // 55% 門檻線（精準狙擊手）
  ctx.strokeStyle = 'rgba(99,102,241,0.35)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(padL, toY(55)); ctx.lineTo(padL + chartW, toY(55)); ctx.stroke();
  ctx.setLineDash([]);

  // 漸層填色
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(99,102,241,0.18)');
  grad.addColorStop(1, 'rgba(99,102,241,0)');
  ctx.beginPath();
  points.forEach((pt, i) => { i === 0 ? ctx.moveTo(toX(i), toY(pt.acc)) : ctx.lineTo(toX(i), toY(pt.acc)); });
  ctx.lineTo(toX(points.length - 1), toY(0)); ctx.lineTo(toX(0), toY(0)); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // 折線
  ctx.beginPath(); ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  points.forEach((pt, i) => { i === 0 ? ctx.moveTo(toX(i), toY(pt.acc)) : ctx.lineTo(toX(i), toY(pt.acc)); });
  ctx.stroke();

  // 最新點
  const last = points[points.length - 1];
  const lastColor = last.acc >= 55 ? '#22c55e' : last.acc >= 40 ? '#d97706' : '#ef4444';
  ctx.beginPath(); ctx.arc(toX(points.length - 1), toY(last.acc), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = lastColor; ctx.fill();

  // Y 軸標籤
  ctx.fillStyle = 'rgba(148,163,184,0.75)'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
  [0, 50, 100].forEach(v => { ctx.fillText(v + '%', padL - 3, toY(v) + 3); });

  // X 軸標籤（第一筆 & 最後一筆日期）
  ctx.textAlign = 'left'; ctx.font = '8px sans-serif';
  ctx.fillText(rated[0].created_at?.slice(5, 10) || '', padL, H - 4);
  ctx.textAlign = 'right';
  ctx.fillText(rated[rated.length - 1].created_at?.slice(5, 10) || '', W - padR, H - 4);

  // 55% 標籤
  ctx.fillStyle = 'rgba(99,102,241,0.6)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('55%', padL + 2, toY(55) - 2);
}

// ── streak 徽章 ──
function _streakBadge(streak) {
  if (!streak || streak === 0) return '';
  if (streak >= 5)  return `<span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:rgba(220,38,38,0.12);color:var(--up);border:1px solid rgba(220,38,38,0.3);font-weight:700;">🔥 神準週 ×${streak}</span>`;
  if (streak >= 3)  return `<span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:rgba(220,38,38,0.08);color:var(--up);border:1px solid rgba(220,38,38,0.2);font-weight:600;">連中 ${streak} 次</span>`;
  if (streak <= -3) return `<span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:rgba(22,163,74,0.08);color:var(--down);border:1px solid rgba(22,163,74,0.2);font-weight:600;">🔍 反省中</span>`;
  return '';
}

// ── 信心度標籤 ──
function _confBadge(conf) {
  if (!conf) return '';
  const map = {
    '高': { bg: 'rgba(220,38,38,0.08)',  color: 'var(--up)',   border: 'rgba(220,38,38,0.2)' },
    '中': { bg: 'rgba(251,191,36,0.08)', color: '#d97706',     border: 'rgba(251,191,36,0.25)' },
    '低': { bg: 'rgba(148,163,184,0.08)',color: 'var(--muted)', border: 'rgba(148,163,184,0.2)' },
  };
  const s = map[conf] || map['中'];
  return `<span style="font-size:0.65rem;padding:2px 7px;border-radius:99px;background:${s.bg};color:${s.color};border:1px solid ${s.border};font-weight:600;">信心${conf}</span>`;
}

async function loadAlphaThoughts() {
  const el = document.getElementById('alphaThoughtsFeed');
  if (!el) return;

  try {
    // 並行抓隨筆 + profile + 週報
    const [thoughtsRes, profileRes, recapRes] = await Promise.all([
      fetch(`${API_BASE}?endpoint=alpha_thought&_t=${Date.now()}`),
      fetch(`${SUPABASE_URL}/rest/v1/alpha_profile?id=eq.1&select=*`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
      }),
      fetch(`${API_BASE}?endpoint=weekly_recap&_t=${Date.now()}`),
    ]);
    const data    = await thoughtsRes.json();
    const profArr = await profileRes.json();
    const recapData = await recapRes.json().catch(() => ({}));
    const profile = profArr[0] || {};
    const list    = data.thoughts || [];
    const recap   = recapData.recap || null;

    // ── 頭銜計算 ──
    const rank     = profile.rank || '菜鳥交易員';
    const icon     = RANK_ICON[rank] || '📈';
    const total    = profile.total_posts || 0;
    const correct  = profile.correct_calls || 0;
    const calls    = profile.total_calls || 0;
    const accPct   = calls >= 5 ? Math.round(correct / calls * 100) : null;
    const accStr   = accPct !== null ? `${accPct}%` : '累計中';
    const styleMemo    = profile.style_memo || '';
    const specialties  = Array.isArray(profile.specialties) ? profile.specialties : [];
    const marketRegime = profile.market_regime || 'normal';
    const weaknessAnalysis = profile.weakness_analysis && typeof profile.weakness_analysis === 'object' ? profile.weakness_analysis : {};
    const weakestRegime    = profile.weakest_regime || null;

    // ── 弱點分析 HTML ──
    const REGIME_ZH = { volatile:'高波動恐慌', trending_up:'趨勢多頭', trending_down:'趨勢空頭', consolidating:'窄幅震盪', normal:'正常盤整' };
    const REGIME_COLOR = {
      volatile:      '#ef4444',
      trending_up:   'var(--up)',
      trending_down: 'var(--down)',
      consolidating: '#d97706',
      normal:        'var(--muted)',
    };
    const weakEntries = Object.entries(weaknessAnalysis).sort((a, b) => a[1].rate - b[1].rate);
    const weaknessHtml = weakEntries.length >= 2 ? (() => {
      const bars = weakEntries.map(([regime, s]) => {
        const label  = REGIME_ZH[regime] || regime;
        const pct    = Math.round(s.rate * 100);
        const color  = pct >= 60 ? 'var(--up)' : pct >= 45 ? '#d97706' : 'var(--down)';
        const isWeak = regime === weakestRegime;
        return `<div style="margin-bottom:0.35rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.15rem;">
            <span style="font-size:0.62rem;color:${isWeak ? 'var(--down)' : 'var(--muted)'};">${isWeak ? '⚠ ' : ''}${label}</span>
            <span style="font-size:0.62rem;font-weight:600;color:${color};">${pct}% <span style="font-weight:400;opacity:0.6;">${s.correct}/${s.total}</span></span>
          </div>
          <div style="height:4px;border-radius:99px;background:var(--border-dark);overflow:hidden;">
            <div style="width:${pct}%;height:100%;border-radius:99px;background:${color};transition:width 0.5s;"></div>
          </div>
        </div>`;
      }).join('');
      return `<div style="margin-top:0.5rem;padding-top:0.45rem;border-top:1px solid var(--border-dark);">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.4rem;font-weight:600;">🧠 各市場環境命中率</div>
        ${bars}
      </div>`;
    })() : '';

    const REGIME_LABEL = {
      volatile:      { text: '高波動恐慌', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)' },
      trending_up:   { text: '趨勢多頭',   color: 'var(--up)',  bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)' },
      trending_down: { text: '趨勢空頭',   color: 'var(--down)', bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.18)' },
      consolidating: { text: '窄幅震盪',   color: '#d97706',   bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.2)' },
      normal:        { text: '正常盤整',   color: 'var(--muted)', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)' },
    };
    const regimeStyle = REGIME_LABEL[marketRegime] || REGIME_LABEL.normal;
    const regimeHtml = `<span style="font-size:0.65rem;padding:2px 7px;border-radius:99px;background:${regimeStyle.bg};color:${regimeStyle.color};border:1px solid ${regimeStyle.border};font-weight:600;">${regimeStyle.text}</span>`;

    // 從最新隨筆取 streak（已評分中最新的）
    const latestStreak = list.find(t => t.streak !== undefined && t.streak !== null)?.streak ?? 0;

    // 下一個頭銜進度
    const RANK_THRESHOLDS = [10, 30, 100, 300, Infinity];
    const nextThresh = RANK_THRESHOLDS.find(t => t > total) || Infinity;
    const prevThresh = RANK_THRESHOLDS[RANK_THRESHOLDS.indexOf(nextThresh) - 1] || 0;
    const progress   = nextThresh === Infinity ? 100 : Math.min(100, Math.round((total - prevThresh) / (nextThresh - prevThresh) * 100));
    const nextLabel  = nextThresh === Infinity ? '已達頂峰' : `距下一頭銜 ${nextThresh - total} 篇`;

    // 信心度分布（本次載入的隨筆）
    const confCounts = { '高': 0, '中': 0, '低': 0 };
    list.filter(t => t.confidence && t.angle !== 'weekly_recap').forEach(t => { if (confCounts[t.confidence] !== undefined) confCounts[t.confidence]++; });
    const confTotal = confCounts['高'] + confCounts['中'] + confCounts['低'];
    // 信心分布進度條：flex:0 會讓單色撐滿，改用 width% 避免此問題
    const confBarHtml = confTotal > 0 ? `
      <div style="margin-top:0.5rem;padding-top:0.45rem;border-top:1px solid var(--border-dark);">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.3rem;">近 24 篇信心分布</div>
        <div style="display:flex;height:5px;border-radius:99px;overflow:hidden;background:var(--border-dark);">
          <div style="width:${Math.round(confCounts['高']/confTotal*100)}%;background:rgba(220,38,38,0.6);transition:width 0.4s;" title="高：${confCounts['高']}篇"></div>
          <div style="width:${Math.round(confCounts['中']/confTotal*100)}%;background:rgba(251,191,36,0.6);transition:width 0.4s;" title="中：${confCounts['中']}篇"></div>
          <div style="width:${Math.round(confCounts['低']/confTotal*100)}%;background:rgba(148,163,184,0.4);transition:width 0.4s;" title="低：${confCounts['低']}篇"></div>
        </div>
        <div style="display:flex;gap:0.7rem;margin-top:0.25rem;">
          <span style="font-size:0.62rem;color:var(--up);">高 ${confCounts['高']}</span>
          <span style="font-size:0.62rem;color:#d97706;">中 ${confCounts['中']}</span>
          <span style="font-size:0.62rem;color:var(--muted);">低 ${confCounts['低']}</span>
        </div>
      </div>` : '';

    const profileCard = `
      <div style="
        padding:1rem 1.1rem;border-radius:14px;
        background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03));
        border:1px solid rgba(99,102,241,0.2);margin-bottom:0.75rem;
      ">
        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.55rem;">
          <span style="font-size:1.3rem;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.85rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
              ${rank}
              ${_streakBadge(latestStreak)}
            </div>
            <div style="font-size:0.65rem;color:var(--muted);display:flex;align-items:center;gap:0.4rem;margin-top:0.15rem;flex-wrap:wrap;">
              共 ${total} 篇 ｜ 預測命中率 ${accStr}
              ${regimeHtml}
            </div>
          </div>
          ${accPct !== null ? `<div style="font-size:0.85rem;font-weight:700;color:${accPct>=55?'var(--up)':accPct>=40?'#d97706':'var(--down)'};">${accPct}%</div>` : ''}
        </div>
        <div style="background:var(--border-dark);border-radius:99px;height:4px;overflow:hidden;">
          <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#6366f1,#818cf8);border-radius:99px;transition:width 0.6s;"></div>
        </div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:0.3rem;">${nextLabel}</div>
        ${specialties.length ? `
        <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">
          ${specialties.map(s => `<span style="font-size:0.62rem;padding:2px 8px;border-radius:99px;background:rgba(99,102,241,0.08);color:#818cf8;border:1px solid rgba(99,102,241,0.18);">${s}</span>`).join('')}
        </div>` : ''}
        <div style="margin-top:0.5rem;">
          <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.25rem;">預測命中率趨勢（滾動 10 篇）</div>
          <canvas id="alphaAccChart" style="width:100%;height:72px;display:block;"></canvas>
        </div>
        ${confBarHtml}
        ${weaknessHtml}
        ${styleMemo ? `<div style="font-size:0.68rem;color:var(--muted);margin-top:0.5rem;padding-top:0.45rem;border-top:1px solid var(--border-dark);opacity:0.75;font-style:italic;">「${styleMemo}」</div>` : ''}
      </div>`;

    // ── 週報卡片 ──
    const recapCard = recap ? (() => {
      const m = MOOD_COLOR[recap.mood] || MOOD_COLOR.neutral;
      const ago = _alphaTimeAgo(recap.created_at);
      return `<div style="
        padding:0.9rem 1rem;border-radius:12px;
        background:linear-gradient(135deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02));
        border:1px solid rgba(251,191,36,0.3);margin-bottom:0.75rem;
      ">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;flex-wrap:wrap;">
          <span style="font-size:0.68rem;font-weight:700;color:#d97706;">📋 本週總結</span>
          <span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:${m.bg};color:${m.color};border:1px solid ${m.border};font-weight:600;">${m.text}</span>
          <span style="font-size:0.62rem;color:var(--muted);margin-left:auto;">${ago}</span>
        </div>
        <div style="font-size:0.875rem;color:var(--text);line-height:1.75;white-space:pre-line;">${_escHtml(recap.content)}</div>
      </div>`;
    })() : '';

    if (!list.length) {
      el.innerHTML = profileCard + recapCard + `<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:1.5rem 0;">Alpha 還沒說話…</div>`;
      // 渲染準確率圖（資料空時）
      requestAnimationFrame(() => _renderAccuracyChart('alphaAccChart', list));
      return;
    }

    // 過濾週報，不顯示在一般隨筆流
    const normalList = list.filter(t => t.angle !== 'weekly_recap');

    const cards = normalList.map((t, i) => {
      const m      = MOOD_COLOR[t.mood] || MOOD_COLOR.neutral;
      const p      = PRED_COLOR[t.prediction] || PRED_COLOR.neutral;
      const rs     = RESULT_STYLE[t.pred_result] || RESULT_STYLE.pending;
      const ago    = _alphaTimeAgo(t.created_at);
      const isFirst = i === 0;
      const rankBadge = t.rank_at_post ? `<span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:rgba(99,102,241,0.1);color:#818cf8;border:1px solid rgba(99,102,241,0.2);">${RANK_ICON[t.rank_at_post]||''}${t.rank_at_post}</span>` : '';
      const isHighConfWrong = t.confidence === '高' && t.pred_result === 'wrong';
      const rsHtml = isHighConfWrong
        ? `<span style="font-size:0.65rem;color:var(--down);font-weight:700;">✗ 高信打臉</span>`
        : `<span style="font-size:0.65rem;color:${rs.color};font-weight:600;">${rs.text}</span>`;
      const isReflection = t.angle === 'reflection';
      const cardBg     = isReflection ? 'rgba(251,191,36,0.04)' : isFirst ? 'rgba(99,102,241,0.06)' : 'var(--surface)';
      const cardBorder = isReflection ? 'rgba(251,191,36,0.25)' : isFirst ? 'rgba(99,102,241,0.25)' : 'var(--border-dark)';
      const reflectionTag = isReflection ? `<span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:rgba(251,191,36,0.12);color:#d97706;border:1px solid rgba(251,191,36,0.3);font-weight:600;">📝 檢討篇</span>` : '';
      return `<div data-bet-id="${t.id}" data-pred-result="${t.pred_result}" style="
        padding:1rem 1.1rem;border-radius:12px;
        background:${cardBg};
        border:1px solid ${cardBorder};
        margin-bottom:0.75rem;
        animation-delay:${i * 55}ms;
      ">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.55rem;flex-wrap:wrap;">
          <span style="font-size:0.78rem;font-weight:700;color:var(--text);">Alpha</span>
          <span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:${m.bg};color:${m.color};border:1px solid ${m.border};font-weight:600;">${m.text}</span>
          <span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:${p.bg};color:${p.color};border:1px solid ${p.border};font-weight:600;">${p.text}</span>
          ${_confBadge(t.confidence)}
          ${rsHtml}
          ${reflectionTag}
          ${isFirst?'<span style="font-size:0.65rem;padding:2px 8px;border-radius:99px;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25);font-weight:600;">最新</span>':''}
          ${rankBadge}
          <span style="font-size:0.65rem;color:var(--muted);margin-left:auto;">${ago}</span>
        </div>
        <div style="font-size:0.875rem;color:var(--text);line-height:1.75;white-space:pre-line;">${_escHtml(t.content)}</div>
        <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">
          ${t.angle && t.angle !== 'reflection' ? `<span style="font-size:0.62rem;color:var(--muted);opacity:0.6;">話題：${t.angle}</span>` : ''}
          ${t.pred_target && t.pred_target !== 'TAIEX' ? `<span style="font-size:0.62rem;padding:2px 7px;border-radius:3px;background:rgba(99,102,241,0.08);color:#818cf8;border:1px solid rgba(99,102,241,0.15);">預測標的：${t.pred_target}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    el.innerHTML = profileCard + recapCard + cards;

    // 渲染準確率趨勢圖 + 注入押注欄 + 同步挑戰統計（DOM 插入後）
    requestAnimationFrame(() => {
      _renderAccuracyChart('alphaAccChart', list);
      _injectBetBars(normalList);
    });

    const tsEl = document.getElementById('alphaThoughtsTs');
    if (tsEl && normalList.length) tsEl.textContent = `上次更新：${_alphaTimeAgo(normalList[0].created_at)}`;

  } catch(e) {
    el.innerHTML = `<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:1rem;">載入失敗</div>`;
  }
}

// 每小時自動重新整理顯示（不呼叫生成，只重撈已有資料更新時間顯示）
function _startAlphaThoughtsTimer() {
  setInterval(() => {
    loadAlphaThoughts();
  }, 60 * 60 * 1000);
}

// ════════════════════════════════════════
// 🎯 讀者押注系統（localStorage 匿名）
// ════════════════════════════════════════

// 取得某篇隨筆的押注資料（localStorage key = `bet_${thoughtId}`）
function _getBet(thoughtId) {
  try {
    const raw = localStorage.getItem(`bet_${thoughtId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _saveBet(thoughtId, direction) {
  try {
    localStorage.setItem(`bet_${thoughtId}`, JSON.stringify({ direction, ts: Date.now() }));
  } catch { /* 無法存就算了 */ }
}

// 全站押注統計（key = `bet_stats_${thoughtId}`，存 agree/disagree 計數）
// 因為是 localStorage（本機），只能模擬單使用者視角，不做跨用戶統計
// 改用「我的預測 vs Alpha」的呈現方式，不需要伺服器

// 渲染某篇隨筆的押注區塊（插入在 .alpha-thought-card 底部）
function renderBetBar(thoughtId, alphaPrediction, predResult) {
  const bet = _getBet(thoughtId);
  const voted = !!bet;
  const myDir = bet?.direction || null;

  const predMap = {
    bullish: { text: '↑ 看漲', color: 'var(--up)',   bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.2)' },
    bearish: { text: '↓ 看跌', color: 'var(--down)', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)' },
    neutral: { text: '→ 持平', color: 'var(--muted)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  };

  // 已評分時顯示對決結果
  let outcomeHtml = '';
  if (voted && predResult && predResult !== 'pending' && myDir) {
    const myCorrect = (() => {
      // 對比「我的預測」和實際結果（predResult 是 Alpha 的，這裡比我的方向 vs Alpha 的結果）
      // 若我跟 Alpha 同向 → 我的命中 = Alpha 命中
      // 若我跟 Alpha 反向 → 我的命中 = Alpha 失誤
      const sameAsAlpha = myDir === alphaPrediction;
      return sameAsAlpha ? predResult === 'correct' : predResult === 'wrong';
    })();
    outcomeHtml = `<div style="font-size:0.62rem;margin-top:0.35rem;padding:0.3rem 0.6rem;border-radius:6px;
      background:${myCorrect?'rgba(220,38,38,0.08)':'rgba(22,163,74,0.08)'};
      color:${myCorrect?'var(--up)':'var(--down)'};
      border:1px solid ${myCorrect?'rgba(220,38,38,0.2)':'rgba(22,163,74,0.2)'};">
      你：${myCorrect ? '✓ 猜對了' : '✗ 猜錯了'}　Alpha：${predResult === 'correct' ? '✓ 命中' : '✗ 失誤'}
    </div>`;
  }

  if (voted) {
    const s = predMap[myDir] || predMap.neutral;
    return `<div class="alpha-bet-bar" style="margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--border-dark);">
      <div style="font-size:0.6rem;color:var(--muted);margin-bottom:0.3rem;">你的押注</div>
      <span style="font-size:0.65rem;padding:2px 10px;border-radius:99px;background:${s.bg};color:${s.color};border:1px solid ${s.border};font-weight:600;">${s.text}</span>
      ${predResult === 'pending' ? `<span style="font-size:0.58rem;color:var(--muted);margin-left:0.5rem;">待收盤驗證</span>` : ''}
      ${outcomeHtml}
    </div>`;
  }

  // 未投票：顯示三個按鈕
  return `<div class="alpha-bet-bar" style="margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--border-dark);">
    <div style="font-size:0.6rem;color:var(--muted);margin-bottom:0.4rem;">你覺得明天怎麼走？</div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
      <button onclick="placeBet('${thoughtId}','bullish','${alphaPrediction}')" style="font-size:0.65rem;padding:3px 10px;border-radius:99px;background:rgba(220,38,38,0.08);color:var(--up);border:1px solid rgba(220,38,38,0.2);cursor:pointer;font-weight:600;">↑ 看漲</button>
      <button onclick="placeBet('${thoughtId}','bearish','${alphaPrediction}')" style="font-size:0.65rem;padding:3px 10px;border-radius:99px;background:rgba(22,163,74,0.08);color:var(--down);border:1px solid rgba(22,163,74,0.2);cursor:pointer;font-weight:600;">↓ 看跌</button>
      <button onclick="placeBet('${thoughtId}','neutral','${alphaPrediction}')" style="font-size:0.65rem;padding:3px 10px;border-radius:99px;background:rgba(148,163,184,0.08);color:var(--muted);border:1px solid rgba(148,163,184,0.2);cursor:pointer;">→ 持平</button>
    </div>
  </div>`;
}

function placeBet(thoughtId, direction, alphaPrediction) {
  _saveBet(thoughtId, direction);
  // 更新挑戰模式統計
  _challengeRecord(thoughtId, direction, alphaPrediction);
  // 重新渲染該卡片的押注區（只更新 .alpha-bet-bar，不重繪整個列表）
  const barEl = document.querySelector(`[data-bet-id="${thoughtId}"] .alpha-bet-bar`);
  if (barEl) {
    const parent = barEl.closest('[data-bet-id]');
    const predResult = parent?.dataset?.predResult || 'pending';
    barEl.outerHTML = renderBetBar(thoughtId, alphaPrediction, predResult);
  }
  // 更新挑戰模式顯示
  renderChallengeStats();
}

// ════════════════════════════════════════
// 🏆 Alpha 挑戰模式（我 vs Alpha）
// ════════════════════════════════════════

const CHALLENGE_KEY = 'alpha_challenge_stats';

function _getChallengeStats() {
  try {
    const raw = localStorage.getItem(CHALLENGE_KEY);
    return raw ? JSON.parse(raw) : { myCorrect: 0, myTotal: 0, alphaCorrect: 0, alphaTotal: 0 };
  } catch { return { myCorrect: 0, myTotal: 0, alphaCorrect: 0, alphaTotal: 0 }; }
}

// 記錄一筆押注（評分後才統計，押注時先存，收盤後在 loadAlphaThoughts 更新時計算）
function _challengeRecord(thoughtId, myDirection, alphaPrediction) {
  // 只記錄在 localStorage，實際對帳在 _syncChallengeFromThoughts
  try {
    const pending = JSON.parse(localStorage.getItem('alpha_challenge_pending') || '[]');
    // 避免重複記錄同一篇
    const exists = pending.find(p => p.id === thoughtId);
    if (!exists) {
      pending.push({ id: thoughtId, myDir: myDirection, alphaDir: alphaPrediction });
      localStorage.setItem('alpha_challenge_pending', JSON.stringify(pending));
    }
  } catch { /* ignore */ }
}

// 在 loadAlphaThoughts 拿到最新 list 後呼叫，把已評分的押注結算進統計
function _syncChallengeFromThoughts(list) {
  try {
    const pending = JSON.parse(localStorage.getItem('alpha_challenge_pending') || '[]');
    if (!pending.length) return;

    const stats = _getChallengeStats();
    const settled = [];
    const stillPending = [];

    for (const p of pending) {
      const thought = list.find(t => String(t.id) === String(p.id));
      if (!thought || thought.pred_result === 'pending') {
        stillPending.push(p); continue;
      }
      // 已評分：結算
      const sameAsAlpha = p.myDir === p.alphaDir;
      const myCorrect   = sameAsAlpha ? thought.pred_result === 'correct' : thought.pred_result === 'wrong';
      stats.myTotal++;
      stats.alphaTotal++;
      if (myCorrect) stats.myCorrect++;
      if (thought.pred_result === 'correct') stats.alphaCorrect++;
      settled.push(p.id);
      stillPending.push({ ...p, settled: true }); // 標記已結算，但保留供顯示
    }

    localStorage.setItem(CHALLENGE_KEY, JSON.stringify(stats));
    // 已結算的從 pending 移除
    localStorage.setItem('alpha_challenge_pending', JSON.stringify(stillPending.filter(p => !p.settled)));
  } catch { /* ignore */ }
}

function renderChallengeStats() {
  const el = document.getElementById('alphaChallengeStats');
  if (!el) return;
  const s = _getChallengeStats();
  if (s.myTotal === 0) {
    el.innerHTML = `<div style="font-size:0.72rem;color:var(--muted);text-align:center;padding:0.8rem 0;">對每篇隨筆押注方向，看看你能不能贏過 Alpha</div>`;
    return;
  }
  const myRate    = Math.round(s.myCorrect / s.myTotal * 100);
  const alphaRate = s.alphaTotal ? Math.round(s.alphaCorrect / s.alphaTotal * 100) : 0;
  const diff      = myRate - alphaRate;
  const diffColor = diff > 0 ? 'var(--up)' : diff < 0 ? 'var(--down)' : 'var(--muted)';
  const diffStr   = diff > 0 ? `+${diff}%` : `${diff}%`;
  const verdict   = diff > 5 ? '你正在贏過 Alpha 🎉' : diff < -5 ? 'Alpha 目前領先你' : '旗鼓相當';
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
      <div style="text-align:center;">
        <div style="font-size:1.1rem;font-weight:700;color:${myRate>=alphaRate?'var(--up)':'var(--muted)'};">${myRate}%</div>
        <div style="font-size:0.6rem;color:var(--muted);">你（${s.myCorrect}/${s.myTotal}）</div>
      </div>
      <div style="font-size:0.65rem;color:var(--muted);text-align:center;">vs</div>
      <div style="text-align:center;">
        <div style="font-size:1.1rem;font-weight:700;color:${alphaRate>=myRate?'var(--up)':'var(--muted)'};">${alphaRate}%</div>
        <div style="font-size:0.6rem;color:var(--muted);">Alpha（${s.alphaCorrect}/${s.alphaTotal}）</div>
      </div>
    </div>
    <div style="text-align:center;">
      <span style="font-size:0.65rem;color:${diffColor};font-weight:600;">${diffStr} ${verdict}</span>
    </div>
    <button onclick="_resetChallenge()" style="display:block;margin:0.6rem auto 0;font-size:0.6rem;padding:2px 10px;border-radius:99px;background:transparent;border:1px solid var(--border);color:var(--muted);cursor:pointer;">重置紀錄</button>
  `;
}

function _resetChallenge() {
  if (!confirm('確定要重置挑戰模式的所有紀錄？')) return;
  localStorage.removeItem(CHALLENGE_KEY);
  localStorage.removeItem('alpha_challenge_pending');
  renderChallengeStats();
}

// ── 在 loadAlphaThoughts 渲染完後注入押注 & 挑戰同步 ──
// 覆寫 normalList.map 的卡片，改用加上 data-bet-id 的版本
// 並在每篇底部插入 renderBetBar

function _injectBetBars(normalList) {
  normalList.forEach(t => {
    const card = document.querySelector(`[data-bet-id="${t.id}"]`);
    if (!card) return;
    const existing = card.querySelector('.alpha-bet-bar');
    if (existing) return; // 已有就跳過
    const bar = document.createElement('div');
    bar.innerHTML = renderBetBar(String(t.id), t.prediction, t.pred_result);
    card.appendChild(bar.firstElementChild);
  });
  // 同步挑戰統計
  _syncChallengeFromThoughts(normalList);
  renderChallengeStats();
}
