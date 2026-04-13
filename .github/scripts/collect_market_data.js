// .github/scripts/collect_market_data.js
// 每日盤後自動抓取市場資料並存入 Supabase

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;  // service_role key（有寫入權限）
const API_BASE          = process.env.VERCEL_API_BASE || 'https://newsdigest-api.vercel.app/api/news';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 工具：fetch with timeout ──
async function fetchJson(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── 工具：upsert（有就更新，沒有就新增）──
async function upsert(table, rows, conflictCols) {
  if (!rows.length) { console.log(`  ${table}: 無資料跳過`); return; }
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictCols, ignoreDuplicates: false });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  console.log(`  ✅ ${table}: ${rows.length} 筆`);
}

// ────────────────────────────────────────
// 1. 台股個股收盤（twheatmap）
// ────────────────────────────────────────
async function collectStockDaily() {
  console.log('\n📊 台股個股收盤...');
  // 強制 refresh=1 跳過 server cache，確保拿到最新資料
  const json = await fetchJson(`${API_BASE}?endpoint=twheatmap&refresh=1`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  const date = json.data[0].date;  // YYYY-MM-DD
  const rows = json.data.map(d => ({
    date:     date,
    stock_id: d.id,
    name:     d.name,
    sector:   d.sector,
    close:    d.price,
    prev:     d.prev,
    chg_pct:  d.chgPct,
    mcap:     d.mcap,
  }));

  await upsert('stock_daily', rows, 'date,stock_id');
  console.log(`  資料日期：${date}`);
}

// ────────────────────────────────────────
// 2. 三大法人現貨買賣超
// ────────────────────────────────────────
async function collectInstitutional() {
  console.log('\n🏢 三大法人買賣超...');
  const json = await fetchJson(`${API_BASE}?endpoint=institutional`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  const latest = json.data[0];
  const row = {
    date:        latest.date,
    foreign_net: latest.detail?.['外資']  ?? null,
    trust_net:   latest.detail?.['投信']  ?? null,
    dealer_net:  latest.detail?.['自營商'] ?? null,
    total_net:   latest.net ?? null,
  };

  await upsert('institutional_daily', [row], 'date');
  console.log(`  資料日期：${latest.date}`);
}

// ────────────────────────────────────────
// 3. 融資融券
// ────────────────────────────────────────
async function collectMargin() {
  console.log('\n💳 融資融券...');
  const json = await fetchJson(`${API_BASE}?endpoint=margin`);
  if (!json.latest || !json.latestDate) { console.log('  無資料'); return; }

  const row = {
    date:           json.latestDate,
    margin_balance: json.latest.marginBalance ?? null,
    margin_chg:     json.latest.marginChange  ?? null,
    short_balance:  json.latest.shortBalance  ?? null,
    short_chg:      json.latest.shortChange   ?? null,
  };

  await upsert('margin_daily', [row], 'date');
  console.log(`  資料日期：${json.latestDate}`);
}

// ────────────────────────────────────────
// 4. 台指選擇權
// ────────────────────────────────────────
async function collectOptions() {
  console.log('\n🎯 台指選擇權...');
  const json = await fetchJson(`${API_BASE}?endpoint=options`);
  if (!json.date || !json.pcRatio) { console.log('  無資料'); return; }

  const row = {
    date:            json.date,
    pc_ratio_oi:     json.pcRatio.oi      ?? null,
    pc_ratio_vol:    json.pcRatio.volume  ?? null,
    max_pain:        json.maxPain         ?? null,
    call_oi:         json.pcRatio.callOI  ?? null,
    put_oi:          json.pcRatio.putOI   ?? null,
    foreign_opt_net: json.institution?.['外資']  ?? null,
    dealer_opt_net:  json.institution?.['自營商'] ?? null,
    trust_opt_net:   json.institution?.['投信']  ?? null,
  };

  await upsert('options_daily', [row], 'date');
  console.log(`  資料日期：${json.date}`);
}

// ────────────────────────────────────────
// 5. 全球商品/指數
// ────────────────────────────────────────
async function collectFutures() {
  console.log('\n🌍 全球商品/指數...');
  const json = await fetchJson(`${API_BASE}?endpoint=futures`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  // futures 沒有明確 date，用今天台灣日期
  const twDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const rows = json.data
    .filter(d => d.price && d.symbol)
    .map(d => ({
      date:    twDate,
      symbol:  d.symbol,
      name:    d.name,
      cat:     d.cat,
      price:   d.price,
      chg_pct: d.chgPct,
    }));

  await upsert('futures_daily', rows, 'date,symbol');
  console.log(`  資料日期：${twDate}`);
}

// ────────────────────────────────────────
// 主程式
// ────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  NewsDigest.AI — 每日資料收集');
  console.log(`  執行時間：${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════');

  const results = await Promise.allSettled([
    collectStockDaily(),
    collectInstitutional(),
    collectMargin(),
    collectOptions(),
    collectFutures(),
  ]);

  console.log('\n═══════════════════════════════════════');
  let hasError = false;
  results.forEach((r, i) => {
    const names = ['台股個股', '三大法人', '融資融券', '台指選擇權', '全球商品'];
    if (r.status === 'rejected') {
      console.error(`❌ ${names[i]} 失敗：${r.reason?.message}`);
      hasError = true;
    }
  });

  if (hasError) {
    process.exit(1);  // 讓 GitHub Actions 標記為失敗並發通知
  }
  console.log('✅ 所有資料收集完成');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
