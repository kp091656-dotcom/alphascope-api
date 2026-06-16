/**
 * AlphaScope — 每日資料收集腳本 v3
 * 路徑：.github/scripts/collect_market_data.js
 * Node.js 24（原生 fetch）
 */

const SUPABASE_URL = process.env.SUPABASE_URL   || 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const FM_TOKEN     = process.env.FINMIND_TOKEN;
const MODE         = process.env.COLLECT_MODE   || 'all';

function nowTW() { return new Date(Date.now() + 8 * 3600_000); }

function lastTradingDay() {
  const tw   = nowTW();
  // nowTW() 已加 8 小時，用 getUTCHours() 即可得到台灣時間的小時數
  const hour = tw.getUTCHours();
  let d = new Date(tw);
  // 台灣時間 16:00 前（收盤前），當天資料尚未就緒，退回前一天
  if (hour < 16) d.setUTCDate(d.getUTCDate() - 1);
  // 跳過週末
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayTW()  { return nowTW().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

async function fmFetch(dataset, params = {}) {
  if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定');
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', dataset);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${FM_TOKEN}` },
    signal: AbortSignal.timeout(45_000), // 45 秒
  });
  if (!res.ok) throw new Error(`FinMind HTTP ${res.status} — ${dataset}`);
  const json = await res.json();
  if (json.status !== 200 && json.msg && json.msg !== 'success')
    throw new Error(`FinMind error: ${json.msg} — ${dataset}`);
  return json.data || [];
}

// TWSE OpenAPI fetch with retry（應對 IP 暫時封鎖 / 伺服器維護）
async function twseFetch(url, retries = 3, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trimStart().startsWith('<')) throw new Error('HTML response（可能被封鎖或維護中）');
      return JSON.parse(text);
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`  ⚠️  第 ${i + 1} 次失敗（${e.message}），${delay / 1000}s 後重試…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function sbUpsert(table, rows, onConflict) {
  if (!SB_KEY) throw new Error('SUPABASE_SERVICE_KEY 未設定');
  if (!rows.length) { console.log(`  ⏭ ${table}：0 筆，略過`); return; }
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const conflictCols = Array.isArray(onConflict) ? onConflict.join(',') : onConflict;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCols}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Supabase ${table} upsert 失敗 HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }
    total += batch.length;
  }
  console.log(`  ✅ ${table}：${total} 筆 upserted`);
}

// ══════════════════════════════════════════
// TWSE 任務
// ══════════════════════════════════════════

async function collectTWSEDaily() {
  console.log('📊 台股個股收盤（TWSE OpenAPI）...');
  try {
    const raw = await twseFetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    const tradeDate = lastTradingDay();
    console.log(`  📅 寫入日期：${tradeDate}`);
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => {
        const close  = parseFloat(r.ClosingPrice?.replace(/,/g, '')) || 0;
        const change = parseFloat(r.Change?.replace(/,/g, ''))       || 0;
        const prev   = close > 0 ? parseFloat((close - change).toFixed(2)) : 0;
        const chgPct = prev  > 0 ? parseFloat((change / prev).toFixed(6))  : 0;
        return { date: tradeDate, stock_id: r.Code, name: r.Name || '',
          close, prev, chg_pct: chgPct, volume: parseInt(r.TradeVolume?.replace(/,/g, '')) || 0, source: 'twse' };
      }).filter(r => r.close > 0);
    await sbUpsert('stock_daily_twse', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 台股個股 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectSectorIndex() {
  console.log('📈 產業指數（TWSE MI_INDEX）...');
  try {
    const raw = await twseFetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX');
    if (!raw.length) throw new Error('API 回傳空陣列');
    console.log(`  🔍 欄位：${Object.keys(raw[0]).join(', ')}`);
    const tradeDate = lastTradingDay();
    const rows = raw
      .filter(r => {
        const name = r['指數'] || '';
        return name && !name.includes('報酬') && !name.includes('槓桿') && !name.includes('反向');
      })
      .map(r => {
        const indexName = r['指數']       || '';
        const close     = parseFloat((r['收盤指數'] || '').replace(/,/g, '')) || 0;
        const sign      = (r['漲跌']      || '').trim();
        const chgPts    = parseFloat((r['漲跌點數'] || '').replace(/,/g, '')) || 0;
        const rawPct    = parseFloat((r['漲跌百分比'] || '').replace(/,/g, '')) || 0;
        const chgPct    = sign === '-' ? -rawPct : rawPct;
        const change    = sign === '-' ? -chgPts : chgPts;
        return { date: tradeDate, index_name: indexName, close, change, chg_pct: chgPct };
      })
      .filter(r => r.close > 0 && r.index_name);
    if (!rows.length) {
      console.error(`  ⚠️ 0 筆（原始 ${raw.length} 筆），第一筆：${JSON.stringify(raw[0])}`);
    }
    await sbUpsert('sector_index_daily', rows, 'date,index_name');

    // ── 額外：把「發行量加權股價指數」寫入 stock_daily_twse（stock_id='TAIEX'）──
    const taiexRow = rows.find(r => r.index_name === '發行量加權股價指數');
    if (taiexRow) {
      const prev = taiexRow.close - taiexRow.change;
      const chgPct = prev > 0 ? parseFloat((taiexRow.change / prev).toFixed(6)) : 0;
      await sbUpsert('stock_daily_twse', [{
        date:     taiexRow.date,
        stock_id: 'TAIEX',
        name:     '台灣加權指數',
        close:    taiexRow.close,
        prev:     parseFloat(prev.toFixed(2)),
        chg_pct:  chgPct,
        volume:   0,
        source:   'twse_index',
      }], 'date,stock_id');
      console.log(`  📊 台灣加權指數寫入 stock_daily_twse：${taiexRow.close}（${chgPct >= 0 ? '+' : ''}${(chgPct*100).toFixed(2)}%）`);
    }

    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 產業指數 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectValuation() {
  console.log('💹 個股估值（TWSE BWIBBU_ALL）...');
  try {
    const raw = await twseFetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL');
    const tradeDate = lastTradingDay();
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => ({
        date: tradeDate, stock_id: r.Code,
        name: r.Name || null,
        pe_ratio: (() => {
          const v = parseFloat(r.PEratio);
          return (!isNaN(v) && v > 0 && v <= 200) ? v : null;
        })(),
        pb_ratio: (() => {
          const v = parseFloat(r.PBratio);
          return (!isNaN(v) && v > 0) ? v : null;
        })(),
        dividend_yield: (() => {
          const v = parseFloat(r.DividendYield);
          return (!isNaN(v) && v >= 0) ? v : null;
        })(),
      })).filter(r => r.pb_ratio != null || r.pe_ratio != null);
    await sbUpsert('stock_valuation_daily', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 估值 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// FinMind 任務
// ══════════════════════════════════════════

async function collectInstitutional() {
  console.log('🏢 三大法人買賣超（FinMind）...');
  try {
    const tradeDate = lastTradingDay();
    const data = await fmFetch('TaiwanStockTotalInstitutionalInvestors',
      { start_date: tradeDate, end_date: tradeDate });
    if (!data.length) throw new Error('無資料');
    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt, foreign_net: 0, foreign_buy: 0, foreign_sell: 0, trust_net: 0, trust_buy: 0, trust_sell: 0, dealer_net: 0, dealer_buy: 0, dealer_sell: 0, total_net: 0 };
      const buy  = parseInt(r.buy)  || 0;
      const sell = parseInt(r.sell) || 0;
      const net  = buy - sell;
      const name = r.name || '';
      if (name.includes('外資'))    { byDate[dt].foreign_net += net; byDate[dt].foreign_buy += buy; byDate[dt].foreign_sell += sell; }
      else if (name.includes('投信'))  { byDate[dt].trust_net  += net; byDate[dt].trust_buy  += buy; byDate[dt].trust_sell  += sell; }
      else if (name.includes('自營商')) { byDate[dt].dealer_net += net; byDate[dt].dealer_buy += buy; byDate[dt].dealer_sell += sell; }
      byDate[dt].total_net += net;
    }
    const rows = Object.values(byDate);

    // 雙寫：institutional_daily（舊）
    try {
      const instRows = rows.map(r => ({
        date:        r.date,
        foreign_net: r.foreign_net,
        trust_net:   r.trust_net,
        dealer_net:  r.dealer_net,
        total_net:   r.total_net,
      }));
      await sbUpsert('institutional_daily', instRows, 'date');
    } catch(e) { console.warn(`  ⚠️  institutional_daily：${e.message}`); }

    // ── 同步現貨欄位到 market_chips_daily ──
    // FinMind 單位：元，需除以 100,000,000 轉億元
    // ⚠️ 只更新 spot_ 欄位，不碰 fut_ 欄位（避免覆蓋 collectChips 寫的期貨資料）
    // ⚠️ 使用 PATCH 逐筆更新，確保只改現貨欄位
    try {
      for (const r of rows) {
        const toB = (v) => v != null ? parseFloat((v / 100_000_000).toFixed(2)) : null;
        const spotRow = {
          spot_foreign_buy:  toB(r.foreign_buy),
          spot_foreign_sell: toB(r.foreign_sell),
          spot_foreign_net:  toB(r.foreign_net),
          spot_trust_buy:    toB(r.trust_buy),
          spot_trust_sell:   toB(r.trust_sell),
          spot_trust_net:    toB(r.trust_net),
          spot_dealer_buy:   toB(r.dealer_buy),
          spot_dealer_sell:  toB(r.dealer_sell),
          spot_dealer_net:   toB(r.dealer_net),
          spot_total_net:    toB(r.total_net),
        };
        // ⚠️ 防呆：若外資、投信、自營買賣都是 0，代表 FinMind 資料尚未就緒，略過不寫入
        // 避免用 0 蓋掉其他路徑（TWSE）已正確寫入的數字
        if (r.foreign_buy === 0 && r.foreign_sell === 0 &&
            r.trust_buy   === 0 && r.trust_sell   === 0 &&
            r.dealer_buy  === 0 && r.dealer_sell  === 0) {
          console.warn(`  ⚠️  market_chips_daily 略過 ${r.date}：FinMind 現貨資料全為 0，疑似尚未更新`);
          continue;
        }
        // 先嘗試 INSERT（建立骨架），再 PATCH 更新現貨欄位
        // 使用 upsert + on_conflict=date，只有 spot 欄位
        const patchRes = await fetch(
          `${SUPABASE_URL}/rest/v1/market_chips_daily?date=eq.${r.date}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(spotRow),
          }
        );
        if (!patchRes.ok) {
          const txt = await patchRes.text();
          // 若 PATCH 失敗（通常是該日還沒有列），改用 POST 插入
          if (patchRes.status === 404 || txt.includes('0 rows')) {
            await fetch(`${SUPABASE_URL}/rest/v1/market_chips_daily?on_conflict=date`, {
              method: 'POST',
              headers: {
                apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify({ date: r.date, ...spotRow }),
            });
          } else {
            console.warn(`  ⚠️  market_chips_daily PATCH ${r.date} 失敗 ${patchRes.status}: ${txt.slice(0,100)}`);
          }
        }
        console.log(`  ✅ market_chips_daily 現貨欄位更新（${r.date}）：外資 ${spotRow.spot_foreign_net} 億，投信 ${spotRow.spot_trust_net} 億，自營 ${spotRow.spot_dealer_net} 億`);
      }
    } catch(e) { console.warn(`  ⚠️  market_chips_daily 現貨同步失敗：${e.message}`); }

    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 三大法人 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectMargin() {
  console.log('💳 融資融券（FinMind）...');
  try {
    const data = await fmFetch('TaiwanStockTotalMarginPurchaseShortSale',
      { start_date: daysAgo(5), end_date: todayTW() });
    if (!data.length) throw new Error('無資料');
    const names = [...new Set(data.map(r => r.name))];
    console.log(`  🔍 FinMind name 值：${names.join(' | ')}`);
    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt, margin_balance: null, margin_chg: null, short_balance: null, short_chg: null };
      const today = parseInt(r.TodayBalance) || 0;
      const yes   = parseInt(r.YesBalance)   || 0;
      const name  = r.name || '';
      if (name === 'MarginPurchase') {
        byDate[dt].margin_balance = today;
        byDate[dt].margin_chg    = today - yes;
      } else if (name === 'ShortSale') {
        byDate[dt].short_balance = today;
        byDate[dt].short_chg    = today - yes;
      }
    }
    const rows = Object.values(byDate).filter(r => r.margin_balance != null || r.short_balance != null);
    await sbUpsert('margin_daily', rows, 'date');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 融資融券 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectOptions() {
  console.log('🎯 台指選擇權（FinMind TaiwanOptionDaily）...');
  try {
    // ── 1. 找最近有「日盤」資料的交易日 ──
    let allOptData = [], tradeDate = '';
    for (let i = 0; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86_400_000);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = d.toISOString().slice(0, 10);
      const rows = await fmFetch('TaiwanOptionDaily', { data_id: 'TXO', start_date: ds, end_date: ds });
      if (!(rows || []).length) continue;
      const dayRows = rows.filter(r => {
        const sess = (r.trading_session ?? r.session ?? '').toLowerCase();
        return sess !== 'after_market' && sess !== 'night' && sess !== 'aftermarket';
      });
      const sessList = [...new Set(rows.map(r => r.trading_session ?? r.session ?? '(null)'))];
      console.log(`  🔍 ${ds}：${rows.length} 筆，session=${sessList.join('|')}，日盤=${dayRows.length} 筆`);
      if (dayRows.length > 0) { allOptData = dayRows; tradeDate = ds; break; }
    }
    if (!allOptData.length) throw new Error('找不到日盤選擇權資料（近 7 個交易日）');

    const optData = allOptData;
    const contractDates = [...new Set(optData.map(r => r.contract_date || ''))].sort();
    console.log(`  📅 日期：${tradeDate}，日盤 ${optData.length} 筆`);
    console.log(`  🔍 contract_date 種類（前10）：${contractDates.slice(0, 10).join(', ')}`);

    const isMonthly = (cd) => /^[0-9]{6}$/.test(cd);
    const isWed     = (cd) => /^[0-9]{6}W[1245]$/.test(cd);
    const isFri     = (cd) => /^[0-9]{6}F[1-5]$/.test(cd);

    const monthlyCDs = contractDates.filter(isMonthly).sort();
    const nearMonthCD = monthlyCDs[0] || null;
    console.log(`  📌 近月合約：${nearMonthCD}，週三合約：${contractDates.filter(isWed).join('/')}，週五合約：${contractDates.filter(isFri).join('/')}`);

    const isCallCP = (v) => { const s = (v||'').trim(); return s === '買權' || s.toUpperCase() === 'C' || s.toUpperCase() === 'CALL'; };
    const isPutCP  = (v) => { const s = (v||'').trim(); return s === '賣權' || s.toUpperCase() === 'P' || s.toUpperCase() === 'PUT';  };

    const aggregate = (filter) => {
      let callOI = 0, putOI = 0, callVol = 0, putVol = 0;
      const byStrike = {};
      for (const r of optData) {
        if (!filter(r.contract_date || '')) continue;
        const oi  = parseFloat(r.open_interest) || 0;
        const vol = parseFloat(r.volume)        || 0;
        const sp  = parseFloat(r.strike_price)  || 0;
        if (isCallCP(r.call_put)) { callOI += oi; callVol += vol; }
        if (isPutCP(r.call_put))  { putOI  += oi; putVol  += vol; }
        if (sp > 0 && oi > 0) {
          if (!byStrike[sp]) byStrike[sp] = { call: 0, put: 0 };
          if (isCallCP(r.call_put)) byStrike[sp].call += oi;
          if (isPutCP(r.call_put))  byStrike[sp].put  += oi;
        }
      }
      return { callOI, putOI, callVol, putVol, byStrike };
    };

    const all      = aggregate(() => true);
    const monthly  = nearMonthCD ? aggregate(cd => cd === nearMonthCD) : { callOI: 0, putOI: 0, callVol: 0, putVol: 0, byStrike: {} };
    const wedCDs   = contractDates.filter(isWed);
    const nearWedCD = wedCDs[0] || null;
    const wed      = nearWedCD ? aggregate(cd => cd === nearWedCD) : { callOI: 0, putOI: 0, byStrike: {} };
    const friCDs   = contractDates.filter(isFri);
    const nearFriCD = friCDs[0] || null;
    const fri      = nearFriCD ? aggregate(cd => cd === nearFriCD) : { callOI: 0, putOI: 0, byStrike: {} };

    console.log(`  📊 全部：Call OI=${all.callOI} Put OI=${all.putOI}`);
    console.log(`  📊 近月（${nearMonthCD}）：Call OI=${monthly.callOI} Put OI=${monthly.putOI}`);
    if (nearWedCD) console.log(`  📊 近週三（${nearWedCD}）：Call OI=${wed.callOI} Put OI=${wed.putOI}`);
    if (nearFriCD) console.log(`  📊 近週五（${nearFriCD}）：Call OI=${fri.callOI} Put OI=${fri.putOI}`);

    const tradeDateObj = new Date(tradeDate + 'T00:00:00Z');

    // 月選：找該月第三個週三
    const getMonthlyExpiry = (cd) => {
      const y = parseInt(cd.slice(0, 4)), m = parseInt(cd.slice(4, 6));
      let count = 0;
      for (let day = 1; day <= 31; day++) {
        const d = new Date(Date.UTC(y, m - 1, day));
        if (d.getMonth() !== m - 1) break;
        if (d.getDay() === 3) { count++; if (count === 3) return d; }
      }
      return null;
    };

    // 週三選：從 contract_code 解析第幾個週三（例如 202606W4 → 6月第4個週三）
    const getWeeklyWedExpiry = (cd) => {
      const mm = cd.match(/^(\d{4})(\d{2})W(\d)$/);
      if (!mm) return null;
      const [, y, mo, nth] = mm;
      let count = 0;
      for (let day = 1; day <= 31; day++) {
        const d = new Date(Date.UTC(+y, +mo - 1, day));
        if (d.getMonth() !== +mo - 1) break;
        if (d.getDay() === 3) { count++; if (count === +nth) return d; }
      }
      return null;
    };

    // 週五選：從 contract_code 解析第幾個週五（例如 202606F3 → 6月第3個週五）
    const getWeeklyFriExpiry = (cd) => {
      const mm = cd.match(/^(\d{4})(\d{2})F(\d)$/);
      if (!mm) return null;
      const [, y, mo, nth] = mm;
      let count = 0;
      for (let day = 1; day <= 31; day++) {
        const d = new Date(Date.UTC(+y, +mo - 1, day));
        if (d.getMonth() !== +mo - 1) break;
        if (d.getDay() === 5) { count++; if (count === +nth) return d; }
      }
      return null;
    };

    const mpCandidates = [];
    if (nearMonthCD) {
      const exp = getMonthlyExpiry(nearMonthCD);
      if (exp) mpCandidates.push({ label: `近月 ${nearMonthCD}`, byStrike: monthly.byStrike, expiry: exp });
    }
    if (nearWedCD) {
      const exp = getWeeklyWedExpiry(nearWedCD);
      if (exp) mpCandidates.push({ label: `近週三 ${nearWedCD}`, byStrike: wed.byStrike, expiry: exp });
    }
    if (nearFriCD) {
      const exp = getWeeklyFriExpiry(nearFriCD);
      if (exp) mpCandidates.push({ label: `近週五 ${nearFriCD}`, byStrike: fri.byStrike, expiry: exp });
    }

    const validCandidates = mpCandidates.filter(c => c.expiry >= tradeDateObj);
    validCandidates.sort((a, b) => a.expiry - b.expiry);
    const mpCandidate = validCandidates[0] || mpCandidates[0] || null;

    let maxPain = null;
    if (mpCandidate) {
      const mpStrikes = Object.keys(mpCandidate.byStrike).map(Number).sort((a, b) => a - b);
      if (mpStrikes.length > 0) {
        let minLoss = Infinity;
        for (const settle of mpStrikes) {
          let loss = 0;
          for (const sp of mpStrikes) {
            if (settle < sp) loss += (sp - settle) * mpCandidate.byStrike[sp].call;
            if (settle > sp) loss += (settle - sp) * mpCandidate.byStrike[sp].put;
          }
          if (loss < minLoss) { minLoss = loss; maxPain = settle; }
        }
        console.log(`  🎯 Max Pain（${mpCandidate.label}，到期 ${mpCandidate.expiry.toISOString().slice(0,10)}）：${maxPain}`);
      }
    }

    let callForeignNet = null, callTrustNet = null, callDealerNet = null;
    let putForeignNet  = null, putTrustNet  = null, putDealerNet  = null;
    try {
      const inst = await fmFetch('TaiwanOptionInstitutionalInvestors',
        { data_id: 'TXO', start_date: tradeDate, end_date: tradeDate });
      console.log(`  🔍 法人選擇權資料：${inst.length} 筆`);
      if (inst.length > 0) console.log(`  🔍 第一筆欄位：${Object.keys(inst[0]).join(', ')}`);

      for (const r of (inst || [])) {
        const inv  = (r.institutional_investors || r.name || '').trim();
        const cpRaw = (r.call_put || '').trim();
        const isCall = cpRaw === '買權' || cpRaw.toUpperCase() === 'C' || cpRaw.toUpperCase() === 'CALL';
        const isPut  = cpRaw === '賣權' || cpRaw.toUpperCase() === 'P' || cpRaw.toUpperCase() === 'PUT';
        const lBal = parseInt(r.long_open_interest_balance_volume)  || 0;
        const sBal = parseInt(r.short_open_interest_balance_volume) || 0;
        const net  = lBal - sBal;

        if (isCall) {
          if (inv.includes('外資') && !inv.includes('自營商')) callForeignNet = (callForeignNet || 0) + net;
          else if (inv.includes('投信'))  callTrustNet  = (callTrustNet  || 0) + net;
          else if (inv.includes('自營商')) callDealerNet = (callDealerNet || 0) + net;
        } else if (isPut) {
          if (inv.includes('外資') && !inv.includes('自營商')) putForeignNet = (putForeignNet || 0) + net;
          else if (inv.includes('投信'))  putTrustNet  = (putTrustNet  || 0) + net;
          else if (inv.includes('自營商')) putDealerNet = (putDealerNet || 0) + net;
        }
      }
      console.log(`  ✅ CALL 法人淨口：外資 ${callForeignNet} 投信 ${callTrustNet} 自營 ${callDealerNet}`);
      console.log(`  ✅ PUT  法人淨口：外資 ${putForeignNet}  投信 ${putTrustNet}  自營 ${putDealerNet}`);
    } catch (e) { console.warn(`  ⚠️ 法人選擇權資料失敗：${e.message}`); }

    const row = {
      date:                   tradeDate,
      pc_ratio_oi:            all.callOI > 0 ? parseFloat((all.putOI / all.callOI).toFixed(4)) : null,
      call_oi:                all.callOI || null,
      put_oi:                 all.putOI  || null,
      pc_ratio_oi_monthly:    monthly.callOI > 0 ? parseFloat((monthly.putOI / monthly.callOI).toFixed(4)) : null,
      call_oi_monthly:        monthly.callOI || null,
      put_oi_monthly:         monthly.putOI  || null,
      pc_ratio_oi_wed:        wed.callOI > 0 ? parseFloat((wed.putOI / wed.callOI).toFixed(4)) : null,
      call_oi_wed:            wed.callOI || null,
      put_oi_wed:             wed.putOI  || null,
      pc_ratio_oi_fri:        fri.callOI > 0 ? parseFloat((fri.putOI / fri.callOI).toFixed(4)) : null,
      call_oi_fri:            fri.callOI || null,
      put_oi_fri:             fri.putOI  || null,
      max_pain:               maxPain || null,
      call_foreign_net:       callForeignNet,
      call_trust_net:         callTrustNet,
      call_dealer_net:        callDealerNet,
      put_foreign_net:        putForeignNet,
      put_trust_net:          putTrustNet,
      put_dealer_net:         putDealerNet,
    };
    try {
      await sbUpsert('options_daily', [row], 'date');
      console.log('  ✅ options_daily（舊表）寫入完成');
    } catch (e) {
      console.warn(`  ⚠️  options_daily 寫入失敗：${e.message}`);
    }

    const analyticsRows = [];
    analyticsRows.push({
      date:             tradeDate,
      contract_type:    'monthly',
      contract_code:    nearMonthCD || null,
      call_oi:          monthly.callOI || null,
      put_oi:           monthly.putOI  || null,
      pc_ratio_oi:      monthly.callOI > 0 ? parseFloat((monthly.putOI / monthly.callOI).toFixed(4)) : null,
      max_pain:         (mpCandidate?.label || '').includes('近月') ? maxPain : null,
      call_foreign_net: callForeignNet,
      call_trust_net:   callTrustNet,
      call_dealer_net:  callDealerNet,
      put_foreign_net:  putForeignNet,
      put_trust_net:    putTrustNet,
      put_dealer_net:   putDealerNet,
    });

    if (nearWedCD) analyticsRows.push({
      date:             tradeDate,
      contract_type:    'weekly_wed',
      contract_code:    nearWedCD,
      call_oi:          wed.callOI || null,
      put_oi:           wed.putOI  || null,
      pc_ratio_oi:      wed.callOI > 0 ? parseFloat((wed.putOI / wed.callOI).toFixed(4)) : null,
      max_pain:         (mpCandidate?.label || '').includes('週三') ? maxPain : null,
      call_foreign_net: null, call_trust_net: null, call_dealer_net: null,
      put_foreign_net:  null, put_trust_net: null,  put_dealer_net:  null,
    });

    if (nearFriCD) analyticsRows.push({
      date:             tradeDate,
      contract_type:    'weekly_fri',
      contract_code:    nearFriCD,
      call_oi:          fri.callOI || null,
      put_oi:           fri.putOI  || null,
      pc_ratio_oi:      fri.callOI > 0 ? parseFloat((fri.putOI / fri.callOI).toFixed(4)) : null,
      max_pain:         (mpCandidate?.label || '').includes('週五') ? maxPain : null,
      call_foreign_net: null, call_trust_net: null, call_dealer_net: null,
      put_foreign_net:  null, put_trust_net: null,  put_dealer_net:  null,
    });

    try {
      await sbUpsert('options_analytics_daily', analyticsRows, ['date', 'contract_type']);
      console.log(`  ✅ options_analytics_daily（新表）寫入 ${analyticsRows.length} 列`);
    } catch (e) {
      console.error(`  ❌ options_analytics_daily 寫入失敗：${e.message}`);
    }
    return { ok: true, count: analyticsRows.length, date: tradeDate };
  } catch (e) { console.error(`  ❌ 選擇權 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectFutures() {
  console.log('🌍 全球商品/指數（FinMind + Yahoo Finance）...');
  try {
    async function yahooQuote(symbol, label, cat) {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok) return null;
        const j      = await r.json();
        const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const times  = j?.chart?.result?.[0]?.timestamp || [];
        const valid  = closes.map((c, i) => ({ c, t: times[i] })).filter(x => x.c != null && x.c > 0);
        if (!valid.length) return null;
        const curr = valid[valid.length - 1];
        const prev = valid.length >= 2 ? valid[valid.length - 2] : curr;
        return {
          date: new Date(curr.t * 1000).toISOString().slice(0, 10),
          symbol, name: label, cat,
          close:   parseFloat(curr.c.toFixed(4)),
          prev:    parseFloat(prev.c.toFixed(4)),
          chg_pct: prev.c ? parseFloat(((curr.c - prev.c) / prev.c).toFixed(6)) : 0,
          source: 'yahoo',
        };
      } catch { return null; }
    }

    const FM_ITEMS = [
      { ds: 'USStockPrice',         id: '^GSPC',                   name: 'S&P500',        cat: '美股指數', ck: 'Close'    },
      { ds: 'USStockPrice',         id: '^IXIC',                   name: '那斯達克',      cat: '美股指數', ck: 'Close'    },
      { ds: 'USStockPrice',         id: '^DJI',                    name: '道瓊',          cat: '美股指數', ck: 'Close'    },
      { ds: 'USStockPrice',         id: '^SOX',                    name: 'SOX費城半導體', cat: '美股指數', ck: 'Close'    },
      { ds: 'USStockPrice',         id: '^VIX',                    name: 'VIX',           cat: '波動率',   ck: 'Close'    },
      { ds: 'GoldPrice',            id: '',                        name: '黃金現貨',      cat: '金屬',     ck: 'price'    },
      { ds: 'CrudeOilPrices',       id: 'WTI',                     name: 'WTI原油',       cat: '能源',     ck: 'price'    },
      { ds: 'CrudeOilPrices',       id: 'Brent',                   name: 'Brent原油',     cat: '能源',     ck: 'price'    },
      { ds: 'TaiwanExchangeRate',   id: 'USD',                     name: '台幣USD/TWD',   cat: '外匯',     ck: 'spot_buy' },
      { ds: 'GovernmentBondsYield', id: 'United States 2-Year',   name: '美債2Y殖利率',  cat: '債券',     ck: 'value'    },
      { ds: 'GovernmentBondsYield', id: 'United States 10-Year',  name: '美債10Y殖利率', cat: '債券',     ck: 'value'    },
    ];

    const fmRows = FM_TOKEN ? (await Promise.all(FM_ITEMS.map(async s => {
      try {
        const params = { start_date: daysAgo(7) };
        if (s.id) params.data_id = s.id;
        const rows = await fmFetch(s.ds, params);
        const sorted = (rows||[]).filter(r => {
          const v = r[s.ck] ?? r.Close ?? r.close ?? r.price ?? r.value;
          return v != null && v > 0;
        }).sort((a, b) => (a.date||'').localeCompare(b.date||''));
        if (!sorted.length) { console.log(`  ⚠️  ${s.name}(${s.ds}) 無資料`); return null; }
        const curr   = sorted[sorted.length - 1];
        const prev   = sorted.length >= 2 ? sorted[sorted.length - 2] : curr;
        const getV   = r => r[s.ck] ?? r.Close ?? r.close ?? r.price ?? r.value ?? 0;
        const close  = getV(curr);
        const pClose = getV(prev);
        return {
          date: curr.date?.slice(0, 10), symbol: s.id || s.ds, name: s.name, cat: s.cat,
          close, prev: pClose,
          chg_pct: pClose ? parseFloat(((close - pClose) / pClose).toFixed(6)) : 0,
          source: 'finmind',
        };
      } catch(e) { console.log(`  ⚠️  ${s.name}(${s.ds}) 失敗：${e.message}`); return null; }
    }))).filter(Boolean) : [];

    const dxyRow = await yahooQuote('DX-Y.NYB', 'DXY美元指數', '外匯');
    const allRows = [...fmRows, ...(dxyRow ? [dxyRow] : [])];

    console.log(`  FinMind: ${fmRows.length}/${FM_ITEMS.length}，Yahoo(DXY): ${dxyRow ? 1 : 0}，合計: ${allRows.length}`);
    console.log(`  ℹ️  futures_daily 前端走 Vercel proxy 即時取得，本函式資料供 Alpha AI 使用`);

    return { ok: true, count: allRows.length, rows: allRows };
  } catch (e) { console.error(`  ❌ 全球商品 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// 籌碼資料任務 v2（含小台/微台/選擇權）
// ══════════════════════════════════════════

async function collectChips() {
  console.log('📡 籌碼資料（FinMind 現貨法人 + TAIFEX 期貨/選擇權三大法人）...');
  const tradeDate = lastTradingDay();

  const result = {
    date: tradeDate,
    spot_dealer_buy: null, spot_dealer_sell: null, spot_dealer_net: null,
    spot_trust_buy:  null, spot_trust_sell:  null, spot_trust_net:  null,
    spot_foreign_buy:null, spot_foreign_sell:null, spot_foreign_net:null,
    spot_total_net:  null,
    fut_tx_dealer_long: null, fut_tx_dealer_short: null, fut_tx_dealer_net: null,
    fut_tx_trust_long:  null, fut_tx_trust_short:  null, fut_tx_trust_net:  null,
    fut_tx_foreign_long:null, fut_tx_foreign_short:null, fut_tx_foreign_net:null,
    fut_tx_total_net:   null,
    fut_mtx_dealer_net: null, fut_mtx_trust_net: null, fut_mtx_foreign_net: null, fut_mtx_total_net: null,
    fut_tmf_dealer_net: null, fut_tmf_trust_net: null, fut_tmf_foreign_net: null, fut_tmf_total_net: null, fut_tmf_total_oi: null,
    opt_call_dealer_long: null, opt_call_dealer_short: null, opt_call_dealer_net: null,
    opt_call_trust_long:  null, opt_call_trust_short:  null, opt_call_trust_net:  null,
    opt_call_foreign_long:null, opt_call_foreign_short:null, opt_call_foreign_net:null,
    opt_put_dealer_long:  null, opt_put_dealer_short:  null, opt_put_dealer_net:  null,
    opt_put_trust_long:   null, opt_put_trust_short:   null, opt_put_trust_net:   null,
    opt_put_foreign_long: null, opt_put_foreign_short: null, opt_put_foreign_net: null,
  };

  // ── 1. 現貨三大法人 ──
  // ⚠️ 修正：toB() 在 n===0 時回傳 null，避免以 0 覆蓋後續 FinMind 寫入的正確值
  try {
    const toB = (str) => {
      const n = parseFloat((str || '').replace(/,/g, ''));
      if (isNaN(n) || n === 0) return null; // ← 修正：0 視為無效值，回傳 null
      return parseFloat((n / 100000).toFixed(2)); // 千元 → 億元
    };

    const parseSpot = (raw, keyMap) => {
      for (const row of raw) {
        const type = (row[keyMap.typeKey] || '').trim();
        const buy  = toB(row[keyMap.buyKey]  || '');
        const sell = toB(row[keyMap.sellKey] || '');
        const net  = toB(row[keyMap.netKey]  || '');

        // ⚠️ 修正：只有 buy/sell/net 都不為 null 時才寫入，避免用 null/0 覆蓋已有的資料
        const isDealer = type.includes('自營商') && (type.includes('自行') || !type.includes('避險'));
        const isTrust  = type.includes('投信');
        const isForeign = type.includes('外資') && !type.includes('自營');
        const isTotal  = type.includes('合計') || type.includes('三大法人');

        if (isDealer && buy !== null && sell !== null && net !== null) {
          result.spot_dealer_buy = buy; result.spot_dealer_sell = sell; result.spot_dealer_net = net;
        } else if (isTrust && buy !== null && sell !== null && net !== null) {
          result.spot_trust_buy  = buy; result.spot_trust_sell  = sell; result.spot_trust_net  = net;
        } else if (isForeign && buy !== null && sell !== null && net !== null) {
          result.spot_foreign_buy = buy; result.spot_foreign_sell = sell; result.spot_foreign_net = net;
        } else if (isTotal && net !== null) {
          result.spot_total_net = net;
        }
      }
      // 若合計為 null 但三個分項都有值，自動計算
      if (result.spot_total_net === null &&
          result.spot_dealer_net !== null && result.spot_trust_net !== null && result.spot_foreign_net !== null) {
        result.spot_total_net = parseFloat((result.spot_dealer_net + result.spot_trust_net + result.spot_foreign_net).toFixed(2));
      }
    };

    let spotOK = false;

    // 嘗試 MI_INST
    if (!spotOK) {
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_INST',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) });
        const t = await r.text();
        if (!t.includes('<!') && !t.includes('<html')) {
          const raw = JSON.parse(t);
          if (raw.length > 0) {
            console.log(`  🔍 MI_INST 欄位：${Object.keys(raw[0]).join(', ')}`);
            parseSpot(raw, { typeKey: '買賣別', buyKey: '買進金額', sellKey: '賣出金額', netKey: '買賣超額' });
            // ⚠️ 修正：只有真正解析到值才標記 OK
            spotOK = result.spot_foreign_net !== null || result.spot_trust_net !== null;
            if (spotOK) {
              console.log(`  ✅ 現貨（MI_INST）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億，自營 ${result.spot_dealer_net?.toFixed(2)} 億`);
            } else {
              console.log(`  ⚠️  MI_INST 有資料但解析到 null（欄位名稱可能已改變），嘗試下一來源`);
            }
          }
        }
      } catch(e) { console.log(`  ℹ️  MI_INST 失敗（${e.message}）`); }
    }

    // 嘗試 BFIA01
    if (!spotOK) {
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BFIA01',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) });
        const t = await r.text();
        if (!t.includes('<!') && !t.includes('<html')) {
          const raw = JSON.parse(t);
          if (raw.length > 0) {
            console.log(`  🔍 BFIA01 欄位：${Object.keys(raw[0]).join(', ')}`);
            parseSpot(raw, { typeKey: '買賣別', buyKey: '買進金額', sellKey: '賣出金額', netKey: '買賣超額' });
            spotOK = result.spot_foreign_net !== null || result.spot_trust_net !== null;
            if (spotOK) {
              console.log(`  ✅ 現貨（BFIA01）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億，自營 ${result.spot_dealer_net?.toFixed(2)} 億`);
            } else {
              console.log(`  ⚠️  BFIA01 有資料但解析到 null，嘗試 FinMind fallback`);
            }
          }
        }
      } catch(e) { console.log(`  ℹ️  BFIA01 失敗（${e.message}）`); }
    }

    // 嘗試 FinMind（需要 FM_TOKEN）
    if (!spotOK && FM_TOKEN) {
      try {
        const data = await fmFetch('TaiwanStockTotalInstitutionalInvestors', { start_date: daysAgo(3) });
        if (data.length > 0) {
          console.log(`  🔍 FinMind 欄位：${Object.keys(data[0]).join(', ')}`);
          const latest = data.sort((a,b) => b.date.localeCompare(a.date))[0].date.slice(0,10);
          for (const r of data.filter(r => r.date?.slice(0,10) === latest)) {
            const name = (r.name || '').trim();
            const buyRaw  = parseFloat(String(r.buy  ?? 0).replace(/,/g, ''));
            const sellRaw = parseFloat(String(r.sell ?? 0).replace(/,/g, ''));
            if (isNaN(buyRaw) || isNaN(sellRaw)) continue;
            const buy  = parseFloat((buyRaw  / 100_000_000).toFixed(2));
            const sell = parseFloat((sellRaw / 100_000_000).toFixed(2));
            const net  = parseFloat((buy - sell).toFixed(2));
            console.log(`    ${name}：買${buy.toFixed(2)} 賣${sell.toFixed(2)} 超${net.toFixed(2)} 億`);
            if (name === 'Dealer_self') {
              result.spot_dealer_buy = buy; result.spot_dealer_sell = sell; result.spot_dealer_net = net;
            } else if (name === 'Investment_Trust') {
              result.spot_trust_buy  = buy; result.spot_trust_sell  = sell; result.spot_trust_net  = net;
            } else if (name === 'Foreign_Investor') {
              result.spot_foreign_buy  = buy;
              result.spot_foreign_sell = sell;
              result.spot_foreign_net  = net;
            }
          }
          if (result.spot_dealer_net !== null && result.spot_trust_net !== null && result.spot_foreign_net !== null)
            result.spot_total_net = parseFloat((result.spot_dealer_net + result.spot_trust_net + result.spot_foreign_net).toFixed(2));
          spotOK = result.spot_foreign_net !== null || result.spot_trust_net !== null;
          if (spotOK)
            console.log(`  ✅ 現貨（FinMind ${latest}）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億`);
        }
      } catch(e) { console.log(`  ℹ️  FinMind 現貨失敗（${e.message}）`); }
    }

    if (!spotOK) console.warn('  ⚠️  現貨三大法人：所有來源均失敗，現貨欄位保持 null（等待 collectInstitutional 15:30 寫入）');
  } catch (e) {
    console.error(`  ❌ 現貨三大法人 失敗：${e.message}`);
  }

  // ── 2. TAIFEX 期貨三大法人（TX / MTX / TMF）──
  try {
    const dateStr = tradeDate.replace(/-/g, '');
    const toInt   = (v) => { const n = parseInt((String(v||'')).replace(/,/g,'')); return isNaN(n) ? null : n; };

    const futUrl = `https://openapi.taifex.com.tw/v1/MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate?queryDate=${dateStr}`;
    const futRes = await fetch(futUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) });
    if (!futRes.ok) throw new Error(`HTTP ${futRes.status}`);
    const allFut = await futRes.json();
    if (!Array.isArray(allFut) || !allFut.length) throw new Error('無資料');

    console.log(`  🔍 TAIFEX 期貨欄位：${Object.keys(allFut[0]).join(', ')}`);
    const getCode  = (r) => (r.ContractCode || r.commodity_id || '').trim();
    const getIdent = (r) => (r.Item || r.institutional_traders_name || r['身份別'] || '').trim();
    const allCodes = [...new Set(allFut.map(getCode))];
    console.log(`  📊 商品代碼：${allCodes.slice(0,6).join(', ')}，共 ${allFut.length} 筆`);

    const txForeignRaw = allFut.find(r => r.ContractCode === '臺股期貨' && getIdent(r).includes('外資'));
    if (txForeignRaw) console.log(`  🔍 臺股期貨外資原始：${JSON.stringify(txForeignRaw)}`);

    const parseFut = (rows, prefix, netOnly = false) => {
      let totalNet = 0;
      for (const row of rows) {
        const ident    = getIdent(row);
        const longVol  = toInt(row['OpenInterest(Long)']  || row.open_interest_long_volume  || 0);
        const shortVol = toInt(row['OpenInterest(Short)'] || row.open_interest_short_volume || 0);
        const netVol   = toInt(row['OpenInterest(Net)']   || row.open_interest_net_volume   || null);
        const finalNet = netVol !== null ? netVol : (longVol !== null && shortVol !== null ? longVol - shortVol : null);

        if (ident.includes('自營商') && !ident.includes('避險')) {
          if (!netOnly) { result[`${prefix}_dealer_long`]  = longVol; result[`${prefix}_dealer_short`] = shortVol; }
          result[`${prefix}_dealer_net`]   = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        } else if (ident.includes('投信')) {
          if (!netOnly) { result[`${prefix}_trust_long`]   = longVol; result[`${prefix}_trust_short`]  = shortVol; }
          result[`${prefix}_trust_net`]    = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        } else if (ident.includes('外資') && !ident.includes('自營商')) {
          if (!netOnly) { result[`${prefix}_foreign_long`]  = longVol; result[`${prefix}_foreign_short`] = shortVol; }
          result[`${prefix}_foreign_net`]   = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        }
      }
      if (result[`${prefix}_dealer_net`] !== null || result[`${prefix}_trust_net`] !== null || result[`${prefix}_foreign_net`] !== null)
        result[`${prefix}_total_net`] = totalNet;
    };

    const txRows  = allFut.filter(r => r.ContractCode === '臺股期貨');
    const mtxRows = allFut.filter(r => r.ContractCode === '小型臺指期貨');
    const tmfRows = allFut.filter(r => r.ContractCode === '微型臺指期貨');

    if (txRows.length) {
      parseFut(txRows, 'fut_tx');
      console.log(`  ✅ TX（臺股期貨）：外資 多${result.fut_tx_foreign_long}/空${result.fut_tx_foreign_short}/淨${result.fut_tx_foreign_net} 口，投信淨${result.fut_tx_trust_net}，自營淨${result.fut_tx_dealer_net}`);
    } else console.warn('  ⚠️  TX（臺股期貨）無資料');

    if (mtxRows.length) {
      parseFut(mtxRows, 'fut_mtx', true);
      console.log(`  ✅ MTX（小型臺指期貨）：外資淨 ${result.fut_mtx_foreign_net} 口，投信淨 ${result.fut_mtx_trust_net}，自營淨 ${result.fut_mtx_dealer_net}`);
    } else console.warn('  ⚠️  MTX（小型臺指期貨）無資料');

    if (tmfRows.length) {
      parseFut(tmfRows, 'fut_tmf', true);
      console.log(`  ✅ TMF（微型臺指期貨）：外資淨 ${result.fut_tmf_foreign_net} 口，投信淨 ${result.fut_tmf_trust_net}，自營淨 ${result.fut_tmf_dealer_net}`);
    } else console.warn('  ⚠️  TMF（微型臺指期貨）無資料');

    // TMF 全體未平倉量
    try {
      let tmfOI = null;

      try {
        const apiRes = await fetch('https://openapi.taifex.com.tw/v1/DailyMarketReportFut', {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        });
        if (!apiRes.ok) throw new Error('OpenAPI HTTP ' + apiRes.status);
        const allFutDaily = await apiRes.json();
        if (!Array.isArray(allFutDaily) || !allFutDaily.length) throw new Error('OpenAPI 回傳空陣列');
        const tmfDailyRows = allFutDaily.filter(r =>
          r.Contract === 'TMF' &&
          r['TradingSession'] === '一般' &&
          r['OpenInterest'] && r['OpenInterest'] !== '-'
        );
        if (!tmfDailyRows.length) throw new Error('OpenAPI 無 TMF 一般時段資料');
        const total = tmfDailyRows.reduce((sum, r) => {
          const n = parseInt((r['OpenInterest'] || '').replace(/,/g, ''));
          return sum + (isNaN(n) ? 0 : n);
        }, 0);
        if (total <= 0) throw new Error('OpenAPI TMF OI 加總為 0');
        tmfOI = total;
        console.log(`  ✅ TMF 全體未平倉（OpenAPI）：${total} 口（${tmfDailyRows.length} 個月份）`);
      } catch(e1) { console.log('  ℹ️  OpenAPI 策略失敗：' + e1.message + '，切換 HTML fallback'); }

      if (!tmfOI) {
        const eUrl = 'https://www.taifex.com.tw/cht/3/futDailyMarketExcel?commodity_id=TMF';
        const eRes = await fetch(eUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.taifex.com.tw/' },
          signal: AbortSignal.timeout(12_000)
        });
        if (!eRes.ok) throw new Error('HTML HTTP ' + eRes.status);
        const html = await eRes.text();
        const rowM = html.match(/<tr[^>]*>([\s\S]*?小計[\s\S]*?)<\/tr>/);
        if (!rowM) throw new Error('HTML 找不到小計列');
        const rawBlock = rowM[0].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
        const afterSubtotal = rawBlock.slice(rawBlock.indexOf('小計'));
        const numsAfter = [...afterSubtotal.matchAll(/\b(\d[\d,]+)\b/g)]
          .map(m => parseInt(m[1].replace(/,/g, '')))
          .filter(v => !isNaN(v) && v > 0);
        console.log('  🔍 小計後數字：' + numsAfter.join(', '));
        const maxVal = Math.max(...numsAfter);
        const maxIdx2 = numsAfter.indexOf(maxVal);
        const n = numsAfter[maxIdx2 + 1];
        if (n && n > 0) { tmfOI = n; console.log('  ✅ TMF 全體未平倉（HTML fallback）：' + n + ' 口'); }
        else throw new Error('HTML 數字定位失敗：' + numsAfter.join(','));
      }

      result.fut_tmf_total_oi = tmfOI;
    } catch(e) { console.warn('  ⚠️  TMF 全體 OI 抓取失敗：' + e.message); }

  } catch (e) {
    console.error(`  ❌ TAIFEX 期貨法人 失敗：${e.message}`);
  }

  // ── 3. TAIFEX 選擇權三大法人（TXO CALL / PUT）──
  try {
    if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定，選擇權略過');
    const toInt2 = (v) => { const n = parseInt(String(v ?? 0).replace(/,/g,'')); return isNaN(n) ? null : n; };

    const optData = await fmFetch('TaiwanOptionInstitutionalInvestors',
      { data_id: 'TXO', start_date: daysAgo(3), end_date: todayTW() });
    if (!optData.length) throw new Error('FinMind TXO 無資料');

    console.log(`  🔍 FinMind TXO 欄位：${Object.keys(optData[0]).join(', ')}`);

    const latestOptDate = optData.map(r => r.date?.slice(0,10)).filter(Boolean).sort().reverse()[0];
    const latestOpt = optData.filter(r => r.date?.slice(0,10) === latestOptDate);
    console.log(`  📊 TXO ${latestOptDate}：${latestOpt.length} 筆，樣本：${JSON.stringify(latestOpt[0])}`);

    const getCP = (r) => r.call_put || '';

    const parseOptFM = (rows, prefix) => {
      for (const row of rows) {
        const ident    = (row.institutional_investors || row.name || '').trim();
        const longVol  = toInt2(row.long_open_interest_balance_volume  || 0);
        const shortVol = toInt2(row.short_open_interest_balance_volume || 0);
        const net = longVol - shortVol;
        if (ident.includes('自營商') && !ident.includes('避險')) {
          result[`${prefix}_dealer_long`] = longVol; result[`${prefix}_dealer_short`] = shortVol; result[`${prefix}_dealer_net`] = net;
        } else if (ident.includes('投信')) {
          result[`${prefix}_trust_long`]  = longVol; result[`${prefix}_trust_short`]  = shortVol; result[`${prefix}_trust_net`]  = net;
        } else if (ident.includes('外資') && !ident.includes('自營')) {
          result[`${prefix}_foreign_long`] = longVol; result[`${prefix}_foreign_short`] = shortVol; result[`${prefix}_foreign_net`] = net;
        }
      }
    };

    const callRows = latestOpt.filter(r => r.call_put === '買權');
    const putRows  = latestOpt.filter(r => r.call_put === '賣權');

    if (callRows.length) { parseOptFM(callRows, 'opt_call'); console.log(`  ✅ TXO CALL：外資淨 ${result.opt_call_foreign_net} 口，自營淨 ${result.opt_call_dealer_net}`); }
    else console.warn(`  ⚠️  TXO CALL 無資料（CP值：${[...new Set(latestOpt.map(getCP))].join(',')}）`);
    if (putRows.length)  { parseOptFM(putRows, 'opt_put');   console.log(`  ✅ TXO PUT：外資淨 ${result.opt_put_foreign_net} 口，自營淨 ${result.opt_put_dealer_net}`);  }
    else console.warn(`  ⚠️  TXO PUT 無資料`);

  } catch (e) {
    console.warn(`  ⚠️  選擇權（FinMind）失敗：${e.message}，嘗試 TAIFEX OpenAPI...`);
    try {
      const dateStr = tradeDate.replace(/-/g, '');
      const toInt2  = (v) => { const n = parseInt((String(v||'')).replace(/,/g,'')); return isNaN(n) ? null : n; };
      const optUrl  = `https://openapi.taifex.com.tw/v1/MarketDataOfMajorInstitutionalTradersDetailsOfOptionsContractsBytheDate?queryDate=${dateStr}`;
      const optRes  = await fetch(optUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
      const optText = await optRes.text();
      if (optText.includes('<!')) throw new Error('回傳 HTML');
      const allOpt  = JSON.parse(optText);
      const txoRows = (Array.isArray(allOpt) ? allOpt : []).filter(r => r.ContractCode === '臺指選擇權');
      console.log(`  📊 TAIFEX 臺指選擇權：${txoRows.length} 筆`);
      for (const row of txoRows) {
        const ident = (row.Item || '').trim();
        const loI   = toInt2(row['OpenInterest(Long)'] || 0);
        const soI   = toInt2(row['OpenInterest(Short)'] || 0);
        console.log(`    ${ident}：多OI ${loI} / 空OI ${soI} / 淨 ${loI-soI}`);
      }
      console.log('  ℹ️  TAIFEX 選擇權無 CALL/PUT 分開，需 FinMind token 才能取得完整資料');
    } catch(e2) { console.error(`  ❌ TAIFEX 選擇權 fallback 失敗：${e2.message}`); }
  }

  // ── 4. 雙寫：chips_daily（舊）+ market_chips_daily（新）──
  // ⚠️ 修正：市場現貨欄位若全為 null（TWSE 解析失敗），則 market_chips_daily 只寫期貨欄位
  // 讓 collectInstitutional（15:30）的 PATCH 負責填入正確的現貨欄位，不用 null 覆蓋
  try {
    await sbUpsert('chips_daily', [result], 'date');
    console.log('  ✅ chips_daily（舊表）寫入完成');
  } catch (e) {
    console.warn(`  ⚠️  chips_daily 寫入失敗：${e.message}`);
  }

  try {
    const spotAllNull = result.spot_foreign_net === null && result.spot_trust_net === null && result.spot_dealer_net === null;
    let mcdRow;
    if (spotAllNull) {
      // 只寫期貨/選擇權欄位，不寫 spot_ 欄位（避免以 null 覆蓋 collectInstitutional 的正確值）
      mcdRow = {
        date:               result.date,
        fut_tx_dealer_long: result.fut_tx_dealer_long, fut_tx_dealer_short: result.fut_tx_dealer_short, fut_tx_dealer_net: result.fut_tx_dealer_net,
        fut_tx_trust_long:  result.fut_tx_trust_long,  fut_tx_trust_short:  result.fut_tx_trust_short,  fut_tx_trust_net:  result.fut_tx_trust_net,
        fut_tx_foreign_long:result.fut_tx_foreign_long,fut_tx_foreign_short:result.fut_tx_foreign_short,fut_tx_foreign_net:result.fut_tx_foreign_net,
        fut_tx_total_net:   result.fut_tx_total_net,
        fut_mtx_dealer_net: result.fut_mtx_dealer_net, fut_mtx_trust_net:   result.fut_mtx_trust_net,   fut_mtx_foreign_net: result.fut_mtx_foreign_net, fut_mtx_total_net: result.fut_mtx_total_net,
        fut_tmf_dealer_net: result.fut_tmf_dealer_net, fut_tmf_trust_net:   result.fut_tmf_trust_net,   fut_tmf_foreign_net: result.fut_tmf_foreign_net, fut_tmf_total_net: result.fut_tmf_total_net, fut_tmf_total_oi: result.fut_tmf_total_oi,
        opt_call_dealer_long: result.opt_call_dealer_long, opt_call_dealer_short: result.opt_call_dealer_short, opt_call_dealer_net: result.opt_call_dealer_net,
        opt_call_trust_long:  result.opt_call_trust_long,  opt_call_trust_short:  result.opt_call_trust_short,  opt_call_trust_net:  result.opt_call_trust_net,
        opt_call_foreign_long:result.opt_call_foreign_long,opt_call_foreign_short:result.opt_call_foreign_short,opt_call_foreign_net:result.opt_call_foreign_net,
        opt_put_dealer_long:  result.opt_put_dealer_long,  opt_put_dealer_short:  result.opt_put_dealer_short,  opt_put_dealer_net:  result.opt_put_dealer_net,
        opt_put_trust_long:   result.opt_put_trust_long,   opt_put_trust_short:   result.opt_put_trust_short,   opt_put_trust_net:   result.opt_put_trust_net,
        opt_put_foreign_long: result.opt_put_foreign_long, opt_put_foreign_short: result.opt_put_foreign_short, opt_put_foreign_net: result.opt_put_foreign_net,
      };
      console.log('  ℹ️  現貨欄位全為 null，market_chips_daily 只寫期貨欄位，待 collectInstitutional 補填現貨');
    } else {
      mcdRow = { ...result };
    }
    await sbUpsert('market_chips_daily', [mcdRow], 'date');
    console.log('  ✅ market_chips_daily（新表）寫入完成');
    return { ok: true, date: tradeDate };
  } catch (e) {
    console.error(`  ❌ market_chips_daily 寫入失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// 新聞收集任務
// ══════════════════════════════════════════

function parseRSS(xml, source, lang = 'en') {
  const items = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of itemMatches.slice(0, 30)) {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title')
      .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&#[^;]+;/g, '').replace(/<[^>]+>/g, '').trim();
    const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    const desc = get('description').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#[^;]+;/g, '').trim().slice(0, 300);
    const pubDate = get('pubDate');
    if (!title || title.length < 5 || !link) continue;
    const pub = pubDate ? new Date(pubDate) : new Date();
    if (isNaN(pub.getTime())) continue;
    items.push({ title, url: link.trim(), description: desc, source, lang, publishedAt: pub.toISOString() });
  }
  return items;
}

async function collectNews() {
  console.log('📰 財經新聞收集（RSS）...');
  try {
    const cutoff = new Date(Date.now() - 48 * 3600_000);

    const RSS_FEEDS = [
      { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',  source: 'CNBC',         lang: 'en' },
      { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',   source: 'CNBC',         lang: 'en' },
      { url: 'https://feeds.bloomberg.com/markets/news.rss',                                          source: 'Bloomberg',    lang: 'en' },
      { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',                           source: 'MarketWatch',  lang: 'en' },
      { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',                          source: 'MarketWatch',  lang: 'en' },
      { url: 'https://www.ft.com/?format=rss',                                                        source: 'FT',           lang: 'en' },
      { url: 'https://news.google.com/rss/search?q=台股+OR+台積電+OR+外資+OR+加權指數&hl=zh-TW&gl=TW&ceid=TW:zh-Hant', source: 'Google News TW', lang: 'zh' },
      { url: 'https://money.udn.com/rssfeed/news/1001/5590/index.xml',                               source: '經濟日報',     lang: 'zh' },
      { url: 'https://news.google.com/rss/search?q=工商時報+台股&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',    source: '工商時報',     lang: 'zh' },
      { url: 'https://www.cnyes.com/rss/cat/tw_stock',                                               source: '鉅亨網',       lang: 'zh' },
    ];

    const CUSTOM_HEADERS = {
      '鉅亨網': { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': 'https://www.cnyes.com/' },
    };

    const fetchResults = await Promise.all(RSS_FEEDS.map(async ({ url, source, lang }) => {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            ...(CUSTOM_HEADERS[source] || {}),
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) { console.log(`  ⚠️  ${source} HTTP ${r.status}`); return []; }
        const xml = await r.text();
        return parseRSS(xml, source, lang);
      } catch (e) { console.log(`  ⚠️  ${source} 失敗：${e.message}`); return []; }
    }));

    const seen = new Set();
    const articles = fetchResults.flat().filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      if (new Date(a.publishedAt) < cutoff) return false;
      const low = (a.title + ' ' + (a.description || '')).toLowerCase();
      const blacklist = ['czech', 'czechia', 'prague', 'koruna', 'philippines', 'philippine', 'manila', 'bangko sentral',
        'safaricom', 'nairobi', 'kenya', 'nigeria', 'lagos', 'johannesburg', 'south africa', 'ghana'];
      if (blacklist.some(w => low.includes(w))) return false;
      if (/^[A-Za-z\s&]+\d{1,2}\/\d{1,2}\/\d{4}$/.test(a.title.trim())) return false;
      return true;
    });

    console.log(`  📊 合計 ${articles.length} 篇（去重後）`);
    if (!articles.length) return { ok: true, count: 0 };

    const rows = articles.map(a => ({
      url:          a.url,
      title:        a.title,
      title_zh:     null,
      description:  a.description || null,
      source:       a.source,
      lang:         a.lang,
      published_at: a.publishedAt,
      collected_at: new Date().toISOString(),
    }));

    await sbUpsert('news_daily', rows, 'url');

    const deleteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/news_daily?collected_at=lt.${new Date(Date.now() - 48 * 3_600_000).toISOString()}`,
      { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (deleteRes.ok) console.log('  🗑️  已清理 48 小時前舊新聞');
    else console.warn(`  ⚠️  清理失敗 HTTP ${deleteRes.status}`);

    return { ok: true, count: articles.length };
  } catch (e) { console.error(`  ❌ 新聞收集 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// Alpha 自動停損停利檢查
// ══════════════════════════════════════════
async function checkAlphaStopLossTarget() {
  console.log('🔍 Alpha 停損停利檢查...');
  try {
    const posRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.open&select=id,stock_id,stock_name,entry_price,target_price,stop_loss,shares,opened_at`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const positions = await posRes.json();
    if (!Array.isArray(positions) || positions.length === 0) {
      console.log('  ℹ️  目前無開倉持倉');
      return { ok: true, closed: 0 };
    }

    const dateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?order=date.desc&limit=1&select=date`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const dateJson = await dateRes.json();
    const latestDate = Array.isArray(dateJson) && dateJson[0]?.date ? dateJson[0].date : null;
    if (!latestDate) { console.log('  ⚠️  無法取得最新收盤日'); return { ok: true, closed: 0 }; }

    const stockIds = [...new Set(positions.map(p => p.stock_id))];
    const priceRes = await fetch(
      `${SUPABASE_URL}/rest/v1/stock_daily_twse?date=eq.${latestDate}&stock_id=in.(${stockIds.join(',')})&select=stock_id,close`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const priceRows = await priceRes.json();
    const priceMap = {};
    if (Array.isArray(priceRows)) for (const r of priceRows) priceMap[r.stock_id] = r.close;

    let closedCount = 0;
    for (const pos of positions) {
      const close = priceMap[pos.stock_id];
      if (!close || close <= 0) {
        console.log(`  ⚠️  ${pos.stock_id} 無收盤價資料（${latestDate}），跳過`);
        continue;
      }

      let exitReason = null;
      let exitPrice  = close;
      let exitType   = null;

      if (close >= pos.target_price) {
        exitType   = 'target';
        exitReason = `停利出場（收盤 ${close} ≥ 目標 ${pos.target_price}，漲幅 +${((close-pos.entry_price)/pos.entry_price*100).toFixed(2)}%）`;
      } else if (close <= pos.stop_loss) {
        exitType   = 'stop';
        exitReason = `停損出場（收盤 ${close} ≤ 停損 ${pos.stop_loss}，跌幅 ${((close-pos.entry_price)/pos.entry_price*100).toFixed(2)}%）`;
      }

      if (!exitReason) continue;

      const pnl     = parseFloat(((exitPrice - pos.entry_price) * (pos.shares || 1) * 1000).toFixed(0));
      const pnl_pct = parseFloat(((exitPrice - pos.entry_price) / pos.entry_price * 100).toFixed(2));
      const openedDate = pos.opened_at ? pos.opened_at.slice(0, 10) : null;
      const daysHeld   = openedDate && latestDate
        ? Math.max(0, Math.round((new Date(latestDate) - new Date(openedDate)) / 86400000))
        : '-';

      const fullReason = [pos.reason, exitReason].filter(Boolean).join('｜');
      const closeRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?id=eq.${pos.id}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed', exit_price: exitPrice, pnl, pnl_pct,
          closed_at: new Date().toISOString(), reason: fullReason,
        }),
      });

      if (closeRes.ok) {
        const emoji = exitType === 'target' ? '🎯' : '🔴';
        console.log(`  ${emoji} [${exitType.toUpperCase()}] ${pos.stock_id} ${pos.stock_name} ${exitReason}`);
        console.log(`     損益：${pnl >= 0 ? '+' : ''}${pnl} 元（${pnl_pct >= 0 ? '+' : ''}${pnl_pct}%）  持有 ${daysHeld} 天`);
        closedCount++;
      } else {
        const errText = await closeRes.text().catch(() => '');
        console.warn(`  ⚠️  ${pos.stock_id} 平倉更新失敗 HTTP ${closeRes.status}：${errText.slice(0,100)}`);
      }
    }

    if (closedCount === 0) console.log(`  ✅ 所有持倉未觸及停損停利（收盤日：${latestDate}）`);
    else console.log(`  📊 共自動平倉 ${closedCount} 筆`);

    return { ok: true, closed: closedCount };
  } catch(e) {
    console.error(`  ❌ 停損停利檢查失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// Alpha 每日報告生成
// ══════════════════════════════════════════
async function collectAlphaReport() {
  console.log('🤖 Alpha 每日報告生成...');
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) { console.warn('  ⚠️  GROQ_API_KEY 未設定'); return { ok: false, error: 'no groq key' }; }

  try {
    const today = todayTW();

    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/alpha_daily_report?report_date=eq.${today}&select=id,market_context`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      const hasContext = existing[0]?.market_context && existing[0].market_context.trim().length > 0;
      if (hasContext) {
        console.log(`  ℹ️  今日報告已存在（${today}），跳過`);
        return { ok: true, skipped: true };
      }
      console.log(`  ⚠️  今日報告存在但 market_context 為空，重新產生…`);
    }

    const dateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?order=date.desc&limit=1&select=date`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const dateJson = await dateRes.json();
    const latestDate = Array.isArray(dateJson) && dateJson[0]?.date ? dateJson[0].date : null;

    let stocks = [], valuation = [];
    if (latestDate) {
      const [sRes, vRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?date=eq.${latestDate}&order=volume.desc&limit=100&select=stock_id,name,close,prev,chg_pct,volume`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }).then(r => r.json()).catch(() => []),
        fetch(`${SUPABASE_URL}/rest/v1/stock_valuation_daily?order=dividend_yield.desc&limit=100&select=stock_id,pe_ratio,pb_ratio,dividend_yield`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }).then(r => r.json()).catch(() => []),
      ]);
      stocks    = Array.isArray(sRes) ? sRes : [];
      valuation = Array.isArray(vRes) ? vRes : [];
    }

    const newsRes = await fetch(`${SUPABASE_URL}/rest/v1/news_daily?order=published_at.desc&limit=40&select=title,source,lang`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const news = await newsRes.json().catch(() => []);

    let pttTitles = '';
    try {
      const pttRes = await fetch('https://www.ptt.cc/api/board/Stock/index', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
        signal: AbortSignal.timeout(8000),
      });
      if (!pttRes.ok) throw new Error(`PTT JSON API HTTP ${pttRes.status}`);
      const pttJson = await pttRes.json();
      const posts = pttJson?.posts || pttJson?.items || [];
      const items = [];
      for (const post of posts.slice(0, 20)) {
        const title = (post.title || post.subject || '').trim();
        if (!title || ['[公告]', '[板規]', 'Fw:'].some(p => title.startsWith(p))) continue;
        const pushes = typeof post.num_comments === 'number' ? post.num_comments
                     : typeof post.recommend    === 'number' ? post.recommend : 0;
        items.push(`【${pushes >= 0 ? '+' : ''}${pushes}推】${title}`);
      }
      pttTitles = items.length ? items.join('\n') : '無熱門討論';
    } catch (e) {
      console.warn(`  ⚠️  PTT JSON API 失敗（${e.message}），fallback 到 HTML 解析`);
      try {
        const pttRes = await fetch('https://www.ptt.cc/bbs/Stock/index.html', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
          signal: AbortSignal.timeout(8000),
        });
        const html = await pttRes.text();
        const blocks = html.split('<div class="r-ent">').slice(1, 16);
        const items = [];
        for (const blk of blocks) {
          const linkM = blk.match(/href="(\/bbs\/Stock\/M\.[^"]+)"/i);
          const titM  = blk.match(/<a[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/i);
          if (!linkM || !titM) continue;
          const title = titM[1].trim();
          if (['[公告]', '[板規]', 'Fw:'].some(p => title.startsWith(p))) continue;
          const nrecM = blk.match(/<span[^>]*>(爆|\d+|X+)<\/span>/i);
          const nrecRaw = (nrecM?.[1] || '').trim();
          const pushes = nrecRaw === '爆' ? 99 : /^X+$/i.test(nrecRaw) ? -nrecRaw.length * 10 : parseInt(nrecRaw) || 0;
          items.push(`【${pushes >= 0 ? '+' : ''}${pushes}推】${title}`);
        }
        pttTitles = items.join('\n') || '無熱門討論';
      } catch { pttTitles = '無法取得'; }
    }

    // ── 抓最新籌碼資料（market_chips_daily，新表）──
    let chips = null;
    try {
      const chipsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/market_chips_daily?order=date.desc&limit=1&select=date,spot_foreign_net,spot_trust_net,spot_dealer_net,spot_total_net,fut_tmf_total_net,fut_tmf_total_oi,fut_tmf_foreign_net,fut_tmf_dealer_net`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      );
      const chipsJson = await chipsRes.json();
      chips = Array.isArray(chipsJson) && chipsJson[0] ? chipsJson[0] : null;
    } catch(e) { console.warn('  ⚠️  market_chips_daily 抓取失敗：' + e.message); }

    // 計算散戶多空比
    let retailRatio = null;
    if (chips && chips.fut_tmf_total_net != null && chips.fut_tmf_total_oi > 0) {
      retailRatio = (-1 * chips.fut_tmf_total_net / chips.fut_tmf_total_oi * 100).toFixed(2);
    }

    // ── 選擇權 P/C Ratio + Max Pain ──
    let optBlock = '【選擇權市場】（資料暫無）';
    try {
      const opt = (await fetch(
        `${SUPABASE_URL}/rest/v1/options_daily?order=date.desc&limit=1&select=date,pc_ratio_oi,pc_ratio_oi_monthly,pc_ratio_oi_wed,pc_ratio_oi_fri,max_pain,call_oi,put_oi,call_foreign_net,put_foreign_net`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      ).then(r => r.json()))?.[0] || null;
      if (opt) {
        const pcAll = opt.pc_ratio_oi         != null ? opt.pc_ratio_oi.toFixed(3)         : 'N/A';
        const pcMon = opt.pc_ratio_oi_monthly != null ? opt.pc_ratio_oi_monthly.toFixed(3) : 'N/A';
        const pcWed = opt.pc_ratio_oi_wed     != null ? opt.pc_ratio_oi_wed.toFixed(3)     : 'N/A';
        const pcFri = opt.pc_ratio_oi_fri     != null ? opt.pc_ratio_oi_fri.toFixed(3)     : 'N/A';
        const fNet  = n => n != null ? (n > 0 ? `+${n}` : `${n}`) : 'N/A';
        optBlock = `【選擇權市場（${opt.date}）】
P/C OI 全部：${pcAll}　近月：${pcMon}（>1偏空，<1偏多）　週三：${pcWed}　週五：${pcFri}
Max Pain（近月）：${opt.max_pain ?? 'N/A'}　全部 Call OI：${opt.call_oi ?? 'N/A'}　Put OI：${opt.put_oi ?? 'N/A'}
外資 CALL 淨口：${fNet(opt.call_foreign_net)}　PUT 淨口：${fNet(opt.put_foreign_net)}`;
        console.log(`  ✅ 選擇權：P/C OI全部=${pcAll} 近月=${pcMon}，Max Pain=${opt.max_pain}`);
      }
    } catch(e) { console.warn('  ⚠️  options_daily：' + e.message); }

    // ── 大台期貨（TX）三大法人淨口 ──
    let txBlock = '';
    try {
      const tx = (await fetch(
        `${SUPABASE_URL}/rest/v1/market_chips_daily?order=date.desc&limit=1&select=date,fut_tx_foreign_net,fut_tx_trust_net,fut_tx_dealer_net,fut_tx_total_net`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      ).then(r => r.json()))?.[0] || null;
      if (tx?.fut_tx_foreign_net != null) {
        const s = n => (n > 0 ? `+${n}` : `${n}`);
        txBlock = `\n大台期貨（TX）法人淨口：外資${s(tx.fut_tx_foreign_net)} 投信${s(tx.fut_tx_trust_net ?? 0)} 自營${s(tx.fut_tx_dealer_net ?? 0)} 合計${s(tx.fut_tx_total_net ?? 0)}`;
        console.log(`  ✅ TX：外資${s(tx.fut_tx_foreign_net)}`);
      }
    } catch(e) { console.warn('  ⚠️  TX期貨：' + e.message); }

    // ── 產業指數 Top5 / Bottom5 ──
    let sectorBlock = '【產業指數】（資料暫無）';
    try {
      const [topRes, botRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/sector_index_daily?order=date.desc,chg_pct.desc&limit=5&select=index_name,chg_pct,date`,
          { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json()).catch(() => []),
        fetch(`${SUPABASE_URL}/rest/v1/sector_index_daily?order=date.desc,chg_pct.asc&limit=5&select=index_name,chg_pct,date`,
          { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json()).catch(() => []),
      ]);
      const top = Array.isArray(topRes) ? topRes.filter(r => r.chg_pct != null) : [];
      const bot = Array.isArray(botRes) ? botRes.filter(r => r.chg_pct != null) : [];
      if (top.length || bot.length) {
        const fmt = r => `${r.index_name}${r.chg_pct > 0 ? '+' : ''}${(r.chg_pct * 100).toFixed(2)}%`;
        sectorBlock = `【產業指數強弱（${top[0]?.date || latestDate}）】
強勢 Top5：${top.map(fmt).join('　')}
弱勢 Bot5：${bot.map(fmt).join('　')}`;
        console.log(`  ✅ 產業指數：${top.slice(0,2).map(r => r.index_name).join('/')}`);
      }
    } catch(e) { console.warn('  ⚠️  sector_index_daily：' + e.message); }

    // ── 總體經濟指標 ──
    let macroBlock = '【總體經濟指標】（資料暫無）';
    let macroData  = {};
    try {
      const fmMacroItems = [
        { ds: 'USStockPrice',          id: '^SOX',                   name: 'SOX費城半導體', ck: 'Close'         },
        { ds: 'TaiwanExchangeRate',    id: 'USD',                    name: '台幣USD/TWD',   ck: 'spot_buy'      },
        { ds: 'GovernmentBondsYield',  id: 'United States 2-Year',  name: '美債2Y殖利率',  ck: 'value'         },
        { ds: 'GovernmentBondsYield',  id: 'United States 10-Year', name: '美債10Y殖利率', ck: 'value'         },
        { ds: 'InterestRate',          id: 'FED',                    name: '聯準會利率',    ck: 'interest_rate' },
        { ds: 'USStockPrice',          id: '^GSPC',                  name: 'S&P500',        ck: 'Close'         },
      ];

      const fmMacroRows = FM_TOKEN ? (await Promise.all(fmMacroItems.map(async s => {
        try {
          const startDate = s.ds === 'InterestRate' ? daysAgo(90) : daysAgo(7);
          const rows = await fmFetch(s.ds, { data_id: s.id, start_date: startDate });
          const sorted = (rows||[]).filter(r => {
            const v = r[s.ck] ?? r.Close ?? r.close ?? r.value ?? r.interest_rate;
            return v != null && v > 0;
          }).sort((a, b) => (a.date||'').localeCompare(b.date||''));
          if (!sorted.length) return { label: s.name, close: null, chg: null };
          const curr   = sorted[sorted.length - 1];
          const prev   = sorted.length >= 2 ? sorted[sorted.length - 2] : curr;
          const getV   = r => r[s.ck] ?? r.Close ?? r.close ?? r.value ?? r.interest_rate ?? 0;
          const close  = getV(curr);
          const pClose = getV(prev);
          const chg    = pClose ? parseFloat(((close - pClose) / pClose * 100).toFixed(2)) : null;
          const display = s.ds === 'InterestRate' ? { label: s.name, close, chg, date: curr.date } : { label: s.name, close, chg };
          return display;
        } catch { return { label: s.name, close: null, chg: null }; }
      }))).filter(Boolean) : [];

      let dxyRow = { label: 'DXY美元指數', close: null, chg: null };
      try {
        const r = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d',
          { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
        );
        if (r.ok) {
          const j      = await r.json();
          const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const valid  = closes.filter(c => c != null && c > 0);
          if (valid.length >= 1) {
            const close  = valid[valid.length - 1];
            const pClose = valid.length >= 2 ? valid[valid.length - 2] : close;
            dxyRow = { label: 'DXY美元指數', close: parseFloat(close.toFixed(3)),
              chg: pClose ? parseFloat(((close - pClose) / pClose * 100).toFixed(2)) : null };
          }
        }
      } catch { /* DXY 失敗不中斷 */ }

      const macroRows = [...fmMacroRows, dxyRow];

      const y2  = fmMacroRows.find(r => r.label === '美債2Y殖利率')?.close;
      const y10 = fmMacroRows.find(r => r.label === '美債10Y殖利率')?.close;
      let yieldCurveNote = '';
      if (y2 != null && y10 != null) {
        const spread = parseFloat((y10 - y2).toFixed(3));
        const status = spread < 0 ? '⚠️ 殖利率曲線倒掛（衰退警示）' : spread < 0.3 ? '殖利率曲線平坦（注意）' : '殖利率曲線正常';
        yieldCurveNote = `\n10Y-2Y 利差：${spread > 0 ? '+' : ''}${spread}%（${status}）`;
      }

      const fedRow = fmMacroRows.find(r => r.label === '聯準會利率');
      let fedNote = '';
      if (fedRow?.close != null) {
        fedNote = `（最新決議日：${fedRow.date || '近期'}）`;
      }

      for (const r of macroRows) {
        if (r.close != null) macroData[r.label] = { close: r.close, chg: r.chg };
      }

      const fmt = r => {
        if (r.close == null) return `${r.label}：N/A`;
        const chgStr = r.chg != null ? `（${r.chg > 0 ? '+' : ''}${r.chg}%）` : '';
        if (r.label === '聯準會利率') return `${r.label}：${r.close}%${fedNote}`;
        return `${r.label}：${r.close}${chgStr}`;
      };

      macroBlock = `【總體經濟指標】
${macroRows.map(fmt).join('\n')}${yieldCurveNote}`;
      console.log(`  ✅ 總經：${macroRows.filter(r => r.close != null).map(r => r.label).join('、')}`);
      if (yieldCurveNote) console.log(`  📐 ${yieldCurveNote.trim()}`);
    } catch(e) { console.warn('  ⚠️  總經指標：' + e.message); }

    // ── CNN Fear & Greed Index ──
    let fearGreedBlock = '【市場情緒 Fear & Greed】（資料暫無）';
    let fearGreedData  = null;
    try {
      const fgRes = await fetch(
        'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
        { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://edition.cnn.com/' }, signal: AbortSignal.timeout(8000) }
      );
      if (fgRes.ok) {
        const fg     = (await fgRes.json())?.fear_and_greed;
        const score  = fg?.score;
        const rating = fg?.rating;
        const prev7  = fg?.previous_1_week?.score;
        if (score != null) {
          fearGreedData = { score: Math.round(score), rating, prev_week: prev7 ? Math.round(prev7) : null };
          const trend = prev7 != null ? `（上週 ${Math.round(prev7)}，${score > prev7 ? '貪婪升溫 ▲' : '恐懼升溫 ▼'}）` : '';
          fearGreedBlock = `【CNN Fear & Greed Index】
目前分數：${Math.round(score)} / 100（${rating}）${trend}
解讀：0-25極度恐懼　26-44恐懼　45-55中性　56-74貪婪　75-100極度貪婪`;
          console.log(`  ✅ Fear & Greed：${Math.round(score)}（${rating}）`);
        }
      }
    } catch(e) { console.warn('  ⚠️  Fear & Greed：' + e.message); }

    const valMap = {};
    for (const v of valuation) valMap[v.stock_id] = v;

    const stockTable = stocks.slice(0, 50).map(s => {
      const v = valMap[s.stock_id] || {};
      return `${s.stock_id} ${s.name} 收${s.close} 漲跌${s.chg_pct != null ? (s.chg_pct*100).toFixed(2) : 'N/A'}% 量${s.volume} PE${v.pe_ratio ?? '-'} PB${v.pb_ratio ?? '-'} 殖${v.dividend_yield ?? '-'}%`;
    }).join('\n');

    const newsTitles = (Array.isArray(news) ? news : []).slice(0, 30)
      .map(n => `[${n.source}] ${n.title}`).join('\n');

    const systemPrompt = `你是 Alpha，一位台股專業交易員兼市場分析師，思維框架來自機構級研究邏輯。
今天是 ${today}，台股將於 09:00 開盤。

【核心分析框架】
1. 全觀研究（Research Everything）：不迷信單一指標。必須綜合評估：
   - 籌碼面：三大法人方向、融資增減、散戶多空比
   - 基本面：PE/PB/殖利率是否合理
   - 事件面：新聞催化劑、產業鏈邏輯
   - 供需邏輯：誰在買？誰在賣？市場有需求嗎？
   - 總經面：SOX/DXY/美債/台幣/聯準會利率/Fear&Greed 綜合研判

2. 找出今日主導者（Who Took My Money）：
   - 外資大買 → 外資主導；散戶偏多 + 外資賣 → 小心散戶接刀
   - 明確指出今日誰是主導力量（外資/自營商/投信/散戶）

3. 供需邏輯選股（Business Mindset）：
   - 成交量爆量 → 誰是直接受惠方？
   - 融資大減 + 維持率低 → 籌碼危機，逆向機會

4. 賣方思維的市場情緒判讀：
   - 散戶多空比 > +10% → 賣方警戒，可能反轉
   - 散戶多空比 < -10% → 賣方有利，可能反彈
   - Fear & Greed > 75 + 外資賣超 → 高度警戒
   - Fear & Greed < 25 + 外資買超 → 逆向機會

5. 總經環境研判：
   - SOX 上漲 → 半導體族群順風
   - DXY 強升 → 外資撤出新興市場壓力，台股承壓
   - 美債10Y 升 → 科技股本益比受壓
   - 台幣升值（數字下降）→ 外資匯入，有利台股
   - 聯準會利率高（>4%）→ 高利率環境，壓縮估值空間，留意資金成本
   - 殖利率曲線倒掛（10Y-2Y < 0）→ 衰退警示，偏保守

6. 空手也是一種策略（Cash is a Position）：
   - 若市場方向不明、籌碼混亂 → 建議空手

【信心來源標記】
- "籌碼面"：三大法人方向明確
- "基本面"：PE/PB/殖利率有優勢
- "事件面"：有明確新聞催化劑
- "供需面"：成交量/融資/產業鏈邏輯支撐
- "總經面"：SOX/DXY/美債/匯率/利率方向支撐

【融資危機訊號】
若某股融資大幅減少（< -5000張）且已跌一段，標記為逆向機會。

【價格規則 — 嚴格遵守】
- entry_price 必須在收盤價 ±5% 範圍內
- target_price 必須在 entry_price +3%~+20% 範圍內
- stop_loss 必須在 entry_price -3%~-10% 範圍內
- 禁止使用訓練資料的歷史股價，只能用表格提供的收盤價

只能回傳純 JSON，不含 markdown、不含任何說明文字。所有字串值必須用英文半形雙引號，數字不加引號。
格式：
{
  "market_summary": "今日整體市場判斷（2-3句，指數表現+主導力量+氛圍）",
  "market_context": "盤勢背景（2-3句，含總經：SOX/DXY/聯準會/殖利率曲線影響、與上週比較）",
  "key_risks": ["風險1（具體來源與影響）", "風險2", "風險3（最多3項）"],
  "sector_focus": [
    { "name": "產業名稱", "reason": "為何今日值得關注", "sentiment": "強勢或中性或弱勢" }
  ],
  "market_mood": "樂觀或中性或謹慎或悲觀",
  "dominant_player": "今日主導者：外資或自營商或投信或散戶或混沌",
  "retail_signal": "散戶訊號：偏多警戒或偏空機會或中性",
  "suggest_cash": true或false,
  "cash_reason": "空手理由（suggest_cash=true時填寫，否則空字串）",
  "margin_alert": "融資警示：正常或偏高注意或危機",
  "recommendations": [
    {
      "stock_id": "4碼",
      "stock_name": "名稱",
      "style": "短線或中線或價值",
      "action": "買進或觀察或避開",
      "entry_price": 數字,
      "target_price": 數字,
      "stop_loss": 數字,
      "expected_return_pct": 數字,
      "holding_days": 數字,
      "confidence": "高或中或低",
      "signal_source": "籌碼面或基本面或事件面或供需面或總經面",
      "reason": "操作理由（含供需邏輯，至少2句）",
      "risk": "風險提示（具體）"
    }
  ],
  "alpha_note": "今日一句話警語（直接、有觀點，像機構交易台開盤提醒）"
}
若 suggest_cash=true，recommendations 可以只有 0-2 檔觀察標的。
若 suggest_cash=false，recommendations 包含 3-5 檔，action=買進 至少 2 檔。
market_context 必須填寫，提及聯準會利率與殖利率曲線狀態。
key_risks 必須 2-3 項，每項 15 字以上。
sector_focus 必須 2-3 個產業。`;

    let chipsBlock = '【今日籌碼面板】\n（資料暫無）';
    if (chips) {
      const fNet = chips.spot_foreign_net != null ? chips.spot_foreign_net.toFixed(2) : '—';
      const tNet = chips.spot_trust_net   != null ? chips.spot_trust_net.toFixed(2)   : '—';
      const dNet = chips.spot_dealer_net  != null ? chips.spot_dealer_net.toFixed(2)  : '—';
      const tmfNet = chips.fut_tmf_total_net != null ? chips.fut_tmf_total_net.toLocaleString() : '—';
      const tmfOI  = chips.fut_tmf_total_oi  != null ? chips.fut_tmf_total_oi.toLocaleString()  : '—';
      const tmfFor = chips.fut_tmf_foreign_net != null ? chips.fut_tmf_foreign_net.toLocaleString() : '—';
      const tmfDlr = chips.fut_tmf_dealer_net  != null ? chips.fut_tmf_dealer_net.toLocaleString()  : '—';
      chipsBlock = `【今日籌碼面板（${chips.date}）】
三大法人現貨：外資 ${fNet} 億 ／ 投信 ${tNet} 億 ／ 自營商 ${dNet} 億
微台指 TMF：三大法人淨額 ${tmfNet} 口（外資 ${tmfFor} ／自營 ${tmfDlr}） ／ 全體 OI ${tmfOI} 口
散戶多空比：${retailRatio != null ? retailRatio + '%（正=散戶偏多，負=散戶偏空）' : '資料不足'}`;
    }

    const userPrompt = `【今日日期】${today}（09:00 開盤）

${chipsBlock}

${optBlock}

${sectorBlock}

${macroBlock}

${fearGreedBlock}

【台股最新收盤（${latestDate}）前50大成交量】
${stockTable}

【近期財經新聞】
${newsTitles}

【PTT Stock 板熱門】
${pttTitles}

請依照你的分析框架，給出今日開盤操作建議。`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 3000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!groqRes.ok) throw new Error(`Groq HTTP ${groqRes.status}`);
    const groqData = await groqRes.json();
    let raw = groqData.choices?.[0]?.message?.content || '';
    raw = raw
      .replace(/```json|```/g, '')
      .replace(/"|"|'|'/g, '"')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    if (si === -1 || ei === -1) throw new Error(`Groq 未回傳 JSON，原始內容：${raw.slice(0,200)}`);
    let jsonStr = raw.slice(si, ei + 1);
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch(parseErr) {
      console.error('  JSON 解析失敗，原始內容：', jsonStr.slice(0, 500));
      throw new Error(`JSON 解析失敗：${parseErr.message}`);
    }

    // ── 校正價格 ──
    const priceMap = {};
    for (const s of stocks) priceMap[s.stock_id] = s.close;
    for (const rec of (result.recommendations || [])) {
      const realClose = priceMap[rec.stock_id];
      if (!realClose || realClose <= 0) continue;
      if (!rec.entry_price || Math.abs(rec.entry_price - realClose) / realClose > 0.20) {
        rec.entry_price  = parseFloat((realClose * 1.00).toFixed(1));
        rec.target_price = parseFloat((realClose * 1.08).toFixed(1));
        rec.stop_loss    = parseFloat((realClose * 0.94).toFixed(1));
        rec.price_corrected = true;
      } else {
        if (!rec.target_price || rec.target_price <= rec.entry_price)
          rec.target_price = parseFloat((rec.entry_price * 1.08).toFixed(1));
        if (!rec.stop_loss || rec.stop_loss >= rec.entry_price)
          rec.stop_loss = parseFloat((rec.entry_price * 0.94).toFixed(1));
      }
    }

    // ── 存入 Supabase alpha_daily_report ──
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/alpha_daily_report?on_conflict=report_date`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        report_date:     today,
        market_mood:     result.market_mood     || '中性',
        market_summary:  result.market_summary  || '',
        market_context:  result.market_context  || '',
        key_risks:       Array.isArray(result.key_risks)    ? result.key_risks    : [],
        sector_focus:    Array.isArray(result.sector_focus) ? result.sector_focus : [],
        alpha_note:      result.alpha_note       || '',
        dominant_player: result.dominant_player  || '',
        retail_signal:   result.retail_signal    || '',
        suggest_cash:    result.suggest_cash     || false,
        cash_reason:     result.cash_reason      || '',
        margin_alert:    result.margin_alert     || '',
        recommendations: result.recommendations  || [],
        macro_data:      Object.keys(macroData).length ? macroData : null,
        fear_greed:      fearGreedData,
        data_sources:    { stocks: stocks.length, news: Array.isArray(news) ? news.length : 0, ptt: (pttTitles && pttTitles !== '無法取得') ? pttTitles.split('\n').filter(l => l.trim()).length : 0 },
        generated_at:    new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) throw new Error(`Supabase upsert HTTP ${upsertRes.status}`);

    // ── 清理 180 天前舊報告 ──
    try {
      const cutoffDate = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alpha_daily_report?report_date=lt.${cutoffDate}`,
        { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' } }
      );
      if (delRes.ok) console.log(`  🗑️  已清理 ${cutoffDate} 前的舊 Alpha 報告`);
    } catch { /* 清理失敗不中斷主流程 */ }

    // ── 自動建立買進持倉 ──
    const buyRecs = (result.recommendations || []).filter(r => r.action === '買進');
    if (buyRecs.length > 0) {
      const todayStr = today;

      const [existRes, todayClosedRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.open&select=stock_id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.closed&closed_at=gte.${todayStr}T00:00:00&select=stock_id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }),
      ]);
      const existRows       = await existRes.json().catch(() => []);
      const todayClosedRows = await todayClosedRes.json().catch(() => []);

      const existIds       = new Set(Array.isArray(existRows)       ? existRows.map(r => r.stock_id)       : []);
      const todayClosedIds = new Set(Array.isArray(todayClosedRows) ? todayClosedRows.map(r => r.stock_id) : []);

      const newRecs = buyRecs.filter(r => {
        if (existIds.has(r.stock_id)) {
          console.log(`  ⏭️  ${r.stock_id} 已有開倉持倉，跳過重複建倉`);
          return false;
        }
        if (todayClosedIds.has(r.stock_id)) {
          console.log(`  🚫  ${r.stock_id} 今日已停損/停利出場，當天不再重新進場`);
          return false;
        }
        return true;
      });

      if (newRecs.length > 0) {
        const openedAt = new Date().toISOString();
        const positions = newRecs.map(r => ({
          stock_id:     r.stock_id,
          stock_name:   r.stock_name,
          entry_price:  r.entry_price,
          target_price: r.target_price,
          stop_loss:    r.stop_loss,
          shares:       1,
          style:        r.style,
          reason:       r.reason,
          status:       'open',
          opened_at:    openedAt,
        }));
        const posRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions`, {
          method: 'POST',
          headers: {
            apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify(positions),
        });
        if (posRes.ok) {
          console.log(`  📈 Alpha 自動進場：${newRecs.map(r => r.stock_id).join('、')}（${newRecs.length} 檔）`);
        } else {
          const errText = await posRes.text().catch(() => '');
          console.warn(`  ⚠️  持倉建立失敗 HTTP ${posRes.status}：${errText.slice(0,100)}`);
        }
      } else {
        console.log(`  ℹ️  所有買進推薦均已有開倉，本次不新增持倉`);
      }
    }

    console.log(`  ✅ Alpha 報告已生成並儲存（${today}，${result.recommendations?.length || 0} 檔推薦，${buyRecs.length} 檔進場）`);
    return { ok: true, date: today, count: result.recommendations?.length || 0, bought: buyRecs.length };

  } catch (e) {
    console.error(`  ❌ Alpha 報告生成失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// 主程式
// ══════════════════════════════════════════
async function main() {
  const isTWSE    = MODE === 'twse'    || MODE === 'all';
  const isFinMind = MODE === 'finmind' || MODE === 'all';
  const isNews    = MODE === 'news'    || MODE === 'all';
  const isAlpha   = MODE === 'alpha'   || MODE === 'all';
  console.log('═══════════════════════════════════════');
  console.log('  AlphaScope — 每日資料收集 v3');
  console.log(`  執行時間：${new Date().toISOString()}`);
  console.log(`  模式：${MODE}  (TWSE:${isTWSE} / FinMind:${isFinMind})`);
  if (!FM_TOKEN) console.warn('  ⚠️  FINMIND_TOKEN 未設定');
  if (!SB_KEY)   console.warn('  ⚠️  SUPABASE_SERVICE_KEY 未設定');
  console.log('═══════════════════════════════════════');

  const results = {};
  if (isTWSE) {
    console.log('\n── TWSE OpenAPI ──');
    results.twseDaily   = await collectTWSEDaily();
    results.sectorIndex = await collectSectorIndex();
    results.valuation   = await collectValuation();
    results.chips       = await collectChips();
  }
  if (isNews) {
    console.log('\n── 新聞收集 ──');
    results.news        = await collectNews();
  }
  if (isAlpha) {
    console.log('\n── Alpha 停損停利檢查 ──');
    results.alphaCheck  = await checkAlphaStopLossTarget();
    console.log('\n── Alpha 報告生成 ──');
    results.alpha       = await collectAlphaReport();
  }
  if (isFinMind) {
    console.log('\n── FinMind API ──');
    results.institutional = await collectInstitutional();
    results.margin        = await collectMargin();
    results.options       = await collectOptions();
    results.futures       = await collectFutures();
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  執行結果摘要');
  console.log('═══════════════════════════════════════');
  let hasError = false;
  for (const [key, val] of Object.entries(results)) {
    if (val.ok) console.log(`  ✅ ${key}：${val.count??'—'} 筆${val.date?` (${val.date})`:''}`);
    else { console.log(`  ❌ ${key}：${val.error}`); hasError = true; }
  }
  console.log('═══════════════════════════════════════');
  if (hasError) process.exit(1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
