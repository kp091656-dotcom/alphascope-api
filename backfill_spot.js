// backfill_spot.js
// 補正 market_chips_daily 的現貨欄位（6/3 ~ 6/8）
// 用法：node backfill_spot.js
// 需要環境變數：SUPABASE_URL, SUPABASE_SERVICE_KEY, FINMIND_TOKEN

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const FM_TOKEN     = process.env.FINMIND_TOKEN;

const START_DATE = '2026-06-03';
const END_DATE   = '2026-06-08';

async function fmFetch(dataset, params = {}) {
  if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定');
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', dataset);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${FM_TOKEN}` },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`FinMind HTTP ${res.status} — ${dataset}`);
  const json = await res.json();
  if (json.status !== 200 && json.msg && json.msg !== 'success')
    throw new Error(`FinMind error: ${json.msg} — ${dataset}`);
  return json.data || [];
}

async function main() {
  if (!SB_KEY) throw new Error('SUPABASE_SERVICE_KEY 未設定');
  if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定');

  console.log(`🔄 補正 market_chips_daily 現貨欄位：${START_DATE} ~ ${END_DATE}`);

  // 1. 從 FinMind 抓三大法人買賣超
  console.log('\n📡 從 FinMind 抓 TaiwanStockTotalInstitutionalInvestors...');
  const data = await fmFetch('TaiwanStockTotalInstitutionalInvestors', {
    start_date: START_DATE,
    end_date:   END_DATE,
  });
  console.log(`  取得 ${data.length} 筆原始資料`);
  if (!data.length) throw new Error('FinMind 無資料，請確認日期範圍');

  // 2. 依日期彙整
  const toB = (v) => v != null ? parseFloat((v / 100_000_000).toFixed(2)) : null;
  const byDate = {};
  for (const r of data) {
    const dt = r.date?.slice(0, 10);
    if (!dt) continue;
    if (!byDate[dt]) byDate[dt] = {
      date: dt,
      foreign_buy: 0, foreign_sell: 0, foreign_net: 0,
      trust_buy:   0, trust_sell:   0, trust_net:   0,
      dealer_buy:  0, dealer_sell:  0, dealer_net:  0,
      total_net:   0,
    };
    const buy  = parseInt(r.buy)  || 0;
    const sell = parseInt(r.sell) || 0;
    const net  = buy - sell;
    const name = r.name || '';
    if      (name.includes('外資'))   { byDate[dt].foreign_buy += buy; byDate[dt].foreign_sell += sell; byDate[dt].foreign_net += net; }
    else if (name.includes('投信'))   { byDate[dt].trust_buy   += buy; byDate[dt].trust_sell   += sell; byDate[dt].trust_net   += net; }
    else if (name.includes('自營商')) { byDate[dt].dealer_buy  += buy; byDate[dt].dealer_sell  += sell; byDate[dt].dealer_net  += net; }
    byDate[dt].total_net += net;
  }

  const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  console.log(`  整理後 ${rows.length} 個日期：${rows.map(r => r.date).join(', ')}`);

  // 3. 逐筆 PATCH 到 market_chips_daily
  console.log('\n📝 更新 market_chips_daily...');
  for (const r of rows) {
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

    if (patchRes.ok) {
      console.log(`  ✅ ${r.date}：外資 ${spotRow.spot_foreign_net} 億，投信 ${spotRow.spot_trust_net} 億，自營 ${spotRow.spot_dealer_net} 億`);
    } else {
      const txt = await patchRes.text();
      console.warn(`  ⚠️  ${r.date} PATCH 失敗 ${patchRes.status}: ${txt.slice(0, 100)}`);
    }
  }

  console.log('\n✅ 補正完成，請至 Supabase 確認資料。');
}

main().catch(e => { console.error('❌ 執行失敗：', e.message); process.exit(1); });
