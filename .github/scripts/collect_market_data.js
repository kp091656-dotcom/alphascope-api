/**
 * AlphaScope — 每日資料收集腳本
 * 路徑：.github/scripts/collect_market_data.js
 * Node.js 24（原生 fetch）
 *
 * 環境變數：
 *   FINMIND_TOKEN         — FinMind API token（GitHub Secret）
 *   SUPABASE_URL          — https://fdxedcwtmlurumfjmlys.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role key（寫入用，GitHub Secret）
 *   COLLECT_MODE          — twse | finmind | all（workflow yml 設定）
 *
 * ⚠️ FinMind 2025-05-25 起必須用 header：Authorization: Bearer TOKEN
 *    舊的 &token=xxx URL 參數會回傳 HTTP 404
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const FM_TOKEN     = process.env.FINMIND_TOKEN;
const MODE         = process.env.COLLECT_MODE || 'all';

// ─────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────

/** 目前台灣時間 */
function nowTW() {
  return new Date(Date.now() + 8 * 3600_000);
}

/**
 * 推算最近交易日（台灣時間）
 * TWSE STOCK_DAY_ALL 不含日期欄位，必須自行推算：
 *   - 16:00 後才有當日收盤資料，16:00 前回傳的是前一交易日
 *   - 週末 → 往前找週五
 */
function lastTradingDay() {
  const tw  = nowTW();
  const hour = tw.getUTCHours(); // UTC hour = 台灣時間 hour（因為 +8h 已加進去）
  let d = new Date(tw);
  // 16:00（台灣）前，TWSE 尚未發布當日資料 → 用前一日
  if (hour < 16) d.setDate(d.getDate() - 1);
  // 跳過週末（TWSE 週六日不開盤）
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/** 今日日期（台灣時間，供 FinMind start/end_date 用）*/
function todayTW() {
  return nowTW().toISOString().slice(0, 10);
}

/** N 天前日期 */
function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/** FinMind fetch（自動帶 Bearer header）*/
async function fmFetch(dataset, params = {}) {
  if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定');
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', dataset);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${FM_TOKEN}` },
  });
  if (!res.ok) throw new Error(`FinMind HTTP ${res.status} — ${dataset}`);
  const json = await res.json();
  if (json.status !== 200 && json.msg && json.msg !== 'success') {
    throw new Error(`FinMind error: ${json.msg} — ${dataset}`);
  }
  return json.data || [];
}

/** Supabase upsert（service_role，以主鍵 merge）*/
async function sbUpsert(table, rows, onConflict) {
  if (!SB_KEY) throw new Error('SUPABASE_SERVICE_KEY 未設定');
  if (!rows.length) { console.log(`  ⏭ ${table}：0 筆，略過`); return; }

  // 分批 500 筆（Supabase REST 建議上限）
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
      {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Supabase ${table} upsert 失敗 HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    inserted += batch.length;
  }
  console.log(`  ✅ ${table}：${inserted} 筆 upserted`);
}

// ─────────────────────────────────────────
// TWSE 收集任務（MODE = twse | all）
// ─────────────────────────────────────────

/** ① 台股個股收盤 → stock_daily_twse */
async function collectTWSEDaily() {
  console.log('📊 台股個股收盤（TWSE OpenAPI）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // TWSE STOCK_DAY_ALL 不含日期欄位 → 用 lastTradingDay() 推算
    const tradeDate = lastTradingDay();
    console.log(`  📅 寫入日期：${tradeDate}（推算最近交易日）`);
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => {
        const close  = parseFloat(r.ClosingPrice?.replace(/,/g, '')) || 0;
        const prev   = parseFloat(r.LastBestBidPrice?.replace(/,/g, '')) ||
                       parseFloat(r.OpeningPrice?.replace(/,/g, '')) || 0;
        const chgStr = r.Change?.replace(/,/g, '') || '0';
        const chg    = parseFloat(chgStr) || 0;
        const chgPct = close > 0 && prev > 0 ? chg / (close - chg) : 0;
        const vol    = parseInt(r.TradeVolume?.replace(/,/g, '')) || 0;
        return {
          date:     tradeDate,
          stock_id: r.Code,
          name:     r.Name,
          close,
          prev:     close - chg,
          chg_pct:  parseFloat(chgPct.toFixed(6)),
          volume:   vol,
          source:   'twse',
        };
      })
      .filter(r => r.close > 0);

    await sbUpsert('stock_daily_twse', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error(`  ❌ 台股個股(TWSE) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** ② 產業指數 → sector_index_daily */
async function collectSectorIndex() {
  console.log('📈 產業指數（TWSE MI_INDEX）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Debug：印出前兩筆欄位名，確認 API 回傳格式
    if (raw.length > 0) {
      console.log(`  🔍 MI_INDEX 欄位：${Object.keys(raw[0]).join(', ')}`);
      console.log(`  🔍 第一筆：${JSON.stringify(raw[0])}`);
    }

    const tradeDate = lastTradingDay();

    // TWSE MI_INDEX 實際欄位（可能是中文 key）：
    // 嘗試多種可能的欄位名稱
    const rows = raw
      .filter(r => {
        // 排除報酬指數、槓桿反向版本（與 index.html 邏輯一致）
        const name = r.Index || r.指數名稱 || r.IndexName || r.NAME || '';
        return name && !name.includes('報酬') && !name.includes('槓桿') && !name.includes('反向');
      })
      .map(r => {
        // 嘗試各種可能欄位名
        const indexName = r.Index || r.指數名稱 || r.IndexName || r.NAME || '';
        const closingStr = r.ClosingIndex || r.收盤指數 || r.CloseIndex || r.CLOSE || '';
        const changeStr  = r.ChangePercent || r.漲跌百分比 || r.CHG_P || r.CHANGE_PERCENT || '0';
        const prevStr    = r.PreviousClosingIndex || r.昨收指數 || r.PrevClose || '';
        const close  = parseFloat(String(closingStr).replace(/[%+,]/g, '')) || 0;
        const prev   = parseFloat(String(prevStr).replace(/,/g, ''))   || 0;
        const chgPct = parseFloat(String(changeStr).replace(/[%+,]/g, '')) || 0;
        return {
          date:       tradeDate,
          index_name: indexName,
          chg_pct:    chgPct,   // ⚠️ sector_index_daily 已是百分比，直接存
          close,
          prev,
          source:     'twse',
        };
      })
      .filter(r => r.close > 0 && r.index_name);

    if (!rows.length && raw.length > 0) {
      // 格式完全不符時，印出更多資訊幫助偵錯
      console.error(`  ⚠️ 過濾後 0 筆（原始 ${raw.length} 筆），請查看上方欄位 debug`);
    }

    await sbUpsert('sector_index_daily', rows, 'date,index_name');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error(`  ❌ 產業指數(TWSE) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** ③ 個股本益比/殖利率/PBR → stock_valuation_daily */
async function collectValuation() {
  console.log('💹 個股估值（TWSE BWIBBU_ALL）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    const tradeDate = lastTradingDay();
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => ({
        date:           tradeDate,
        stock_id:       r.Code,
        pe_ratio:       parseFloat(r.PEratio)       || null,
        pb_ratio:       parseFloat(r.PBratio)       || null,
        dividend_yield: parseFloat(r.DividendYield) || null,
      }))
      .filter(r => r.pb_ratio || r.pe_ratio);

    await sbUpsert('stock_valuation_daily', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error(`  ❌ 估值(TWSE) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────
// FinMind 收集任務（MODE = finmind | all）
// ⚠️  全部改用 Authorization: Bearer header
// ─────────────────────────────────────────

/** ④ 三大法人整體買賣超 → institutional_daily */
async function collectInstitutional() {
  console.log('🏢 三大法人買賣超（FinMind）...');
  try {
    const start = daysAgo(5);
    const end   = todayTW();
    const data  = await fmFetch('TaiwanStockTotalInstitutionalInvestors', {
      start_date: start, end_date: end,
    });
    if (!data.length) throw new Error('無資料');

    // 依日期分組
    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt, foreign_net: 0, trust_net: 0, dealer_net: 0, total_net: 0 };
      const net  = (parseInt(r.buy) || 0) - (parseInt(r.sell) || 0);
      const name = r.name || '';
      if (name.includes('外資'))    byDate[dt].foreign_net += net;
      else if (name.includes('投信')) byDate[dt].trust_net  += net;
      else if (name.includes('自營')) byDate[dt].dealer_net += net;
      byDate[dt].total_net += net;
    }
    const rows = Object.values(byDate);
    await sbUpsert('institutional_daily', rows, 'date');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error(`  ❌ 三大法人(FM) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** ⑤ 融資融券 → margin_daily */
async function collectMargin() {
  console.log('💳 融資融券（FinMind）...');
  try {
    const start = daysAgo(5);
    const end   = todayTW();
    const data  = await fmFetch('TaiwanStockTotalMarginPurchaseShortSale', {
      start_date: start, end_date: end,
    });
    if (!data.length) throw new Error('無資料');

    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt };
      const name = r.name || '';
      if (name.includes('Margin') || name.includes('融資')) {
        byDate[dt].margin_balance     = parseInt(r.TodayBalance) || 0;
        byDate[dt].margin_yes_balance = parseInt(r.YesBalance)   || 0;
        byDate[dt].margin_buy         = parseInt(r.buy)          || 0;
        byDate[dt].margin_sell        = parseInt(r.sell)         || 0;
      } else if (name.includes('Short') || name.includes('融券')) {
        byDate[dt].short_balance      = parseInt(r.TodayBalance) || 0;
        byDate[dt].short_yes_balance  = parseInt(r.YesBalance)   || 0;
        byDate[dt].short_buy          = parseInt(r.buy)          || 0;
        byDate[dt].short_sell         = parseInt(r.sell)         || 0;
      }
    }
    const rows = Object.values(byDate).filter(r => r.margin_balance || r.short_balance);
    await sbUpsert('margin_daily', rows, 'date');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error(`  ❌ 融資融券(FM) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** ⑥ 台指選擇權 P/C Ratio + Max Pain → options_daily */
async function collectOptions() {
  console.log('🎯 台指選擇權（FinMind）...');
  try {
    // 往前最多找 7 個交易日
    let optData = [], date = '';
    for (let i = 0; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86_400_000);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // 跳過週末
      const ds = d.toISOString().slice(0, 10);
      const rows = await fmFetch('TaiwanOptionDaily', {
        data_id: 'TXO', start_date: ds, end_date: ds,
      });
      const pos = (rows || []).filter(r => r.trading_session === 'position');
      if (pos.length > 0) { optData = pos; date = ds; break; }
    }
    if (!optData.length) throw new Error('無選擇權資料');

    // 計算 P/C Ratio 與 Max Pain
    let callVol = 0, putVol = 0, callOI = 0, putOI = 0;
    const byStrike = {};
    for (const r of optData) {
      const cp  = (r.call_put || '').trim().toUpperCase();
      const vol = parseFloat(r.volume)        || 0;
      const oi  = parseFloat(r.open_interest) || 0;
      const sp  = parseFloat(r.strike_price)  || 0;
      if (cp === 'C' || cp === 'CALL') { callVol += vol; callOI += oi; }
      if (cp === 'P' || cp === 'PUT')  { putVol  += vol; putOI  += oi; }
      if (sp > 0) {
        if (!byStrike[sp]) byStrike[sp] = { call: 0, put: 0 };
        if (cp === 'C' || cp === 'CALL') byStrike[sp].call += oi;
        if (cp === 'P' || cp === 'PUT')  byStrike[sp].put  += oi;
      }
    }
    const pcVolRatio = callVol > 0 ? putVol / callVol : null;
    const pcOIRatio  = callOI  > 0 ? putOI  / callOI  : null;

    // Max Pain
    const strikes = Object.keys(byStrike).map(Number).sort((a, b) => a - b);
    let maxPain = null;
    if (strikes.length) {
      let minLoss = Infinity;
      for (const settle of strikes) {
        let loss = 0;
        for (const sp of strikes) {
          const { call, put } = byStrike[sp];
          if (settle < sp) loss += (sp - settle) * call;
          if (settle > sp) loss += (settle - sp) * put;
        }
        if (loss < minLoss) { minLoss = loss; maxPain = settle; }
      }
    }

    // 法人選擇權部位
    let foreignLong = 0, foreignShort = 0;
    try {
      const instRows = await fmFetch('TaiwanOptionInstitutionalInvestors', {
        data_id: 'TXO', start_date: date, end_date: date,
      });
      for (const r of (instRows || [])) {
        if ((r.institutional_investors || '').includes('外資')) {
          foreignLong  += parseInt(r.long_open_interest_balance_volume)  || 0;
          foreignShort += parseInt(r.short_open_interest_balance_volume) || 0;
        }
      }
    } catch (e) { /* 法人資料失敗不影響整體 */ }

    const rows = [{
      date,
      pc_ratio_vol:   pcVolRatio ? parseFloat(pcVolRatio.toFixed(4)) : null,
      pc_ratio_oi:    pcOIRatio  ? parseFloat(pcOIRatio.toFixed(4))  : null,
      call_vol:       Math.round(callVol),
      put_vol:        Math.round(putVol),
      call_oi:        Math.round(callOI),
      put_oi:         Math.round(putOI),
      max_pain:       maxPain,
      foreign_net:    foreignLong - foreignShort,
      foreign_long:   foreignLong,
      foreign_short:  foreignShort,
    }];
    await sbUpsert('options_daily', rows, 'date');
    return { ok: true, count: rows.length, date };
  } catch (e) {
    console.error(`  ❌ 台指選擇權(FM) 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** ⑦ 全球商品/指數 → futures_daily（stooq + FinMind USStockPrice）*/
async function collectFutures() {
  console.log('🌍 全球商品/指數（stooq + FinMind）...');
  try {
    const today = new Date();
    const d2 = today.toISOString().slice(0, 10).replace(/-/g, '');
    const past = new Date(today - 30 * 86_400_000);
    const d1 = past.toISOString().slice(0, 10).replace(/-/g, '');

    // ── stooq symbols ──
    const STOOQ = [
      { symbol: '%5Edax',   name: '德國DAX',      cat: '美股指數' },
      { symbol: '%5Esox',   name: '費城半導體',   cat: '美股指數' },
      { symbol: '%5Eftse',  name: '英國FTSE100',  cat: '美股指數' },
      { symbol: '%5Ecac',   name: '法國CAC40',    cat: '美股指數' },
      { symbol: '%5Etwii',  name: '台灣加權',     cat: '亞股指數' },
      { symbol: '%5Enk225', name: '日經225',      cat: '亞股指數' },
      { symbol: '%5Ehsi',   name: '香港恆生',     cat: '亞股指數' },
      { symbol: 'GLD.US',   name: '黃金ETF',      cat: '金屬' },
      { symbol: 'SLV.US',   name: '白銀ETF',      cat: '金屬' },
      { symbol: 'PPLT.US',  name: '白金ETF',      cat: '金屬' },
      { symbol: 'COPX.US',  name: '銅礦ETF',      cat: '金屬' },
      { symbol: 'USO.US',   name: '原油ETF',      cat: '能源' },
      { symbol: 'UNG.US',   name: '天然氣ETF',    cat: '能源' },
      { symbol: 'EURUSD',   name: '歐元/美元',    cat: '外匯' },
      { symbol: 'GBPUSD',   name: '英鎊/美元',    cat: '外匯' },
      { symbol: 'USDJPY',   name: '美元/日圓',    cat: '外匯' },
      { symbol: 'AUDUSD',   name: '澳幣/美元',    cat: '外匯' },
      { symbol: 'USDCAD',   name: '美元/加幣',    cat: '外匯' },
      { symbol: 'USDCNH',   name: '美元/人民幣',  cat: '外匯' },
      { symbol: 'TLT.US',   name: '20年美債ETF',  cat: '債券' },
      { symbol: 'IEF.US',   name: '10年美債ETF',  cat: '債券' },
      { symbol: 'IBIT.US',  name: '比特幣ETF',    cat: '加密貨幣' },
      { symbol: 'FETH.US',  name: '以太幣ETF',    cat: '加密貨幣' },
    ];

    // stooq 在 GitHub Actions 可能因 IP 被擋；逐筆嘗試，失敗靜默略過
    const stooqRows = (await Promise.all(STOOQ.map(async s => {
      try {
        const url = `https://stooq.com/q/d/l/?s=${s.symbol}&d1=${d1}&d2=${d2}&i=d`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000), // 8 秒逾時
        });
        if (!r.ok) return null;
        const csv = await r.text();
        if (!csv || csv.includes('No data') || csv.length < 20) return null;
        const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date'));
        if (!lines.length) return null;
        const lParts = lines[lines.length - 1].split(',');
        const pParts = lines.length >= 2 ? lines[lines.length - 2].split(',') : lParts;
        const close = parseFloat(lParts[4]);
        const prev  = parseFloat(pParts[4]);
        const hi    = parseFloat(lParts[2]);
        const lo    = parseFloat(lParts[3]);
        const date  = lParts[0];
        if (!close || isNaN(close)) return null;
        return {
          date, symbol: s.symbol, name: s.name, cat: s.cat,
          close, prev, high: hi, low: lo,
          chg_pct: prev ? parseFloat(((close - prev) / prev).toFixed(6)) : 0,
          source: 'stooq',
        };
      } catch { return null; }
    }))).filter(Boolean);

    console.log(`  stooq: ${stooqRows.length}/${STOOQ.length} 筆成功`);

    // ── FinMind US indices（需要 token）──
    const US_SYMBOLS = [
      { symbol: '^GSPC', name: 'S&P500',     cat: '美股指數' },
      { symbol: '^IXIC', name: '那斯達克',   cat: '美股指數' },
      { symbol: '^DJI',  name: '道瓊',       cat: '美股指數' },
      { symbol: '^VIX',  name: 'VIX恐慌',    cat: '波動率' },
      { symbol: '^SOX',  name: '費城半導體', cat: '美股指數' },
    ];

    const fmRows = FM_TOKEN ? (await Promise.all(US_SYMBOLS.map(async s => {
      try {
        const start = daysAgo(7);
        const rows  = await fmFetch('USStockPrice', { data_id: s.symbol, start_date: start });
        const sorted = (rows || []).filter(r => r.Close > 0).sort((a, b) => a.date.localeCompare(b.date));
        if (!sorted.length) return null;
        const curr = sorted[sorted.length - 1];
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : curr;
        return {
          date: curr.date?.slice(0, 10), symbol: s.symbol, name: s.name, cat: s.cat,
          close: curr.Close, prev: prev.Close, high: curr.High, low: curr.Low,
          chg_pct: prev.Close ? parseFloat(((curr.Close - prev.Close) / prev.Close).toFixed(6)) : 0,
          source: 'finmind',
        };
      } catch { return null; }
    }))).filter(Boolean) : [];

    const allRows = [...fmRows, ...stooqRows];
    console.log(`  FinMind: ${fmRows.length} 筆，stooq: ${stooqRows.length} 筆，合計: ${allRows.length} 筆`);

    // 兩邊都拿不到才算失敗
    if (!allRows.length) throw new Error('stooq 與 FinMind 均無法取得資料（可能被 IP 封鎖）');

    await sbUpsert('futures_daily', allRows, 'date,symbol');
    return { ok: true, count: allRows.length };
  } catch (e) {
    console.error(`  ❌ 全球商品 失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────
// 主程式
// ─────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AlphaScope — 每日資料收集');
  console.log(`  執行時間：${new Date().toISOString()}`);
  console.log(`  模式：${MODE}`);
  if (!FM_TOKEN) console.warn('  ⚠️  FINMIND_TOKEN 未設定');
  if (!SB_KEY)   console.warn('  ⚠️  SUPABASE_SERVICE_KEY 未設定');
  console.log('═══════════════════════════════════════');

  const results = {};
  const isTWSE    = MODE === 'twse'    || MODE === 'all';
  const isFinMind = MODE === 'finmind' || MODE === 'all';

  // TWSE 任務（16:00 排程）
  if (isTWSE) {
    console.log('\n── TWSE OpenAPI ──');
    results.twseDaily   = await collectTWSEDaily();
    results.sectorIndex = await collectSectorIndex();
    results.valuation   = await collectValuation();
  }

  // FinMind 任務（17:00 排程）
  if (isFinMind) {
    console.log('\n── FinMind API ──');
    results.institutional = await collectInstitutional();
    results.margin        = await collectMargin();
    results.options       = await collectOptions();
    results.futures       = await collectFutures();
  }

  // 結果摘要
  console.log('\n═══════════════════════════════════════');
  console.log('  執行結果摘要');
  console.log('═══════════════════════════════════════');
  let hasError = false;
  for (const [key, val] of Object.entries(results)) {
    if (val.ok) {
      console.log(`  ✅ ${key}：${val.count ?? '—'} 筆${val.date ? ` (${val.date})` : ''}`);
    } else {
      console.log(`  ❌ ${key}：${val.error}`);
      hasError = true;
    }
  }
  console.log('═══════════════════════════════════════');

  if (hasError) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
