# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-06-09（規則更新）
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。
> 歷史改動請見 CHANGELOG.md。

-----

## 🔴 Claude 操作規則（必讀）

1. **使用者傳原始檔案給 Claude，Claude 修改後用 `present_files` 生成下載連結，由使用者自行上傳 GitHub。**
2. 每次對話結束前（使用者主動要求），更新 CLAUDE.md + CHANGELOG.md，用 `present_files` 生成下載連結，由使用者自行上傳。
3. CLAUDE.md 只記錄當前狀態；歷史改動寫入 CHANGELOG.md。
4. ⚠️ **Claude 不使用任何 MCP push 功能，一律生成檔案讓使用者手動上傳。**
5. ⚠️ **文件更新（CLAUDE.md / CHANGELOG.md）只在使用者主動要求切換新對話時才執行，平時不主動生成。**

-----

## ⚠️ 已知問題

> 目前無已知問題。

-----

## 待辦

- [ ] 確認新表資料穩定 3～5 天後刪舊表（`chips_daily`、`options_daily`、`institutional_daily`）

-----

## 專案概覽

**名稱：** AlphaScope — AI 驅動財經市場情報網站
**網址：** <https://alphascope-fin.vercel.app>
**GitHub：** github.com/kp091656-dotcom/alphascope-api
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫
**分支：** main → 自動部署到 Vercel

-----

## 開發工作流程

1. 告訴 Claude 要改什麼，並傳原始檔案
2. Claude 修改完成後用 `present_files` 生成下載連結
3. 使用者下載後自行上傳到 GitHub

-----

## 本地工作檔案路徑

> ⚠️ **2026-05-29 重大架構變更：index.html 已拆分為獨立 JS/CSS 檔案**

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|--------------|--------|
| 前端主檔 | `/home/claude/alphascope/index.html` | `index.html` |
| 共用樣式 | `/home/claude/alphascope/css/style.css` | `css/style.css` |
| Supabase/全域變數 | `/home/claude/alphascope/js/api.js` | `js/api.js` |
| 新聞渲染 | `/home/claude/alphascope/js/news_feed.js` | `js/news_feed.js` |
| 社群情緒 | `/home/claude/alphascope/js/sentiment.js` | `js/sentiment.js` |
| 股東紀念品 | `/home/claude/alphascope/js/gifts.js` | `js/gifts.js` |
| 台股熱圖 | `/home/claude/alphascope/js/heatmap.js` | `js/heatmap.js` |
| 多空訊號 + Max Pain趨勢 + 部位風險 | `/home/claude/alphascope/js/signals.js` | `js/signals.js` |
| 個股 Modal | `/home/claude/alphascope/js/stock_modal.js` | `js/stock_modal.js` |
| Alpha 交易室 | `/home/claude/alphascope/js/alpha.js` | `js/alpha.js` |
| 估值/回測 | `/home/claude/alphascope/js/valuation.js` | `js/valuation.js` |
| 籌碼面板 | `/home/claude/alphascope/js/chips.js` | `js/chips.js` |
| 自選股 | `/home/claude/alphascope/js/watchlist.js` | `js/watchlist.js` |
| SW/PWA | `/home/claude/alphascope/js/utils.js` | `js/utils.js` |
| Vercel API | `/home/claude/news.js` | `api/news.js` |
| K 線圖 | `/home/claude/chart.html` | `chart.html`（獨立頁面）|
| 每日收集腳本 | `/home/claude/collect_market_data.js` | `.github/scripts/collect_market_data.js` |
| 備份腳本 | `/home/claude/backup.js` | `.github/scripts/backup.js` |
| 紀念品爬蟲 | `/home/claude/scrape_gifts.js` | `.github/scripts/scrape_gifts.js` |
| 紀念品排程 | `/home/claude/scrape_gifts.yml` | `.github/workflows/scrape_gifts.yml` |
| eGift 爬蟲 | `/home/claude/scrape_egift.js` | `.github/scripts/scrape_egift.js` |
| eGift 排程 | `/home/claude/scrape_egift.yml` | `.github/workflows/scrape_egift.yml` |
| PWA SW | `/home/claude/service-worker.js` | `service-worker.js` |
| PWA Manifest | `/home/claude/pwa/manifest.json` | `manifest.json` |
| 紀念品後台 | `gifts-admin.html` | `gifts-admin.html`（Vercel 公開）|

### JS 載入順序（index.html 底部）

```html
<script src="/js/api.js"></script>        <!-- 必須第一個 -->
<script src="/js/news_feed.js"></script>
<script src="/js/sentiment.js"></script>
<script src="/js/gifts.js"></script>
<script src="/js/heatmap.js"></script>
<script src="/js/signals.js"></script>
<script src="/js/stock_modal.js"></script>
<script src="/js/alpha.js"></script>
<script src="/js/valuation.js"></script>
<script src="/js/chips.js"></script>
<script src="/js/watchlist.js"></script>
<script src="/js/utils.js"></script>
```

### signals.js 內含函式（2026-06-09 更新）

| 函式 | 說明 |
|------|------|
| `loadMktSignals()` | 多空訊號儀表板主函式 |
| `loadOptions()` | 選擇權面板（側欄）|
| `openStockModal()` | 個股 Modal（bar chart，已移除 iframe）|
| `_loadModalBarChart()` | K線 bar chart（Supabase 收盤走勢）|
| `_loadModalStats()` | 歷史統計摘要（非同步）|
| `closeStockModal()` | 關閉 Modal |
| `runStockAI()` | AI 個股快速研究 |
| `renderMaxPainTrend(id)` | Max Pain 近5日趨勢圖（weekly_fri→weekly_wed→monthly 優先序）|
| `renderRiskOverview(positions)` | Alpha 部位風險總覽 + 個別進度條 |

### chips.js 重要邏輯（2026-06-09 更新）

- 三大法人合計：直接加總 `spot_foreign_net + spot_trust_net + spot_dealer_net`（不用 `spot_total_net`，避免含陸資子項導致落差）

### 全域變數定義位置（全在 api.js）

```js
const SUPABASE_URL, SUPABASE_ANON  // Supabase 連線
const API_BASE                      // Vercel API base URL
const CLAUDE_MODEL                  // claude-sonnet-4-20250514
let allArticles, displayedCount, currentLang, currentCat
let _giftsData, _giftCat, _giftSort
let futuresData, futuresSortKey
```

-----

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表

| 表名 | 來源 | 內容 | 每日筆數 | 備註 |
|------|------|------|--------|------|
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量；含 stock_id='TAIEX' | ~1231 | |
| `institutional_daily` | FinMind | 三大法人現貨買賣超 | 1 | ⚠️ 待刪 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 | |
| `options_daily` | FinMind | P/C Ratio、法人選擇權 | 1 | ⚠️ 待刪 |
| `futures_daily` | FinMind + Yahoo | 全球商品/指數 | ~35 | |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 | |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1071 | |
| `news_daily` | RSS | 財經新聞快取（保留 48 小時）| ~150 | |
| `alpha_daily_report` | Groq AI | Alpha 交易員每日報告 | 1 | |
| `trader_positions` | Alpha 自動 | Alpha 持倉紀錄 | 動態 | |
| `chips_daily` | FinMind + TAIFEX | 籌碼資料 | 1 | ⚠️ 待刪 |
| `market_chips_daily` | FinMind + TAIFEX | 新版籌碼 | 1 | 🆕 雙寫中 |
| `options_analytics_daily` | FinMind | 選擇權分析 | 3 | 🆕 雙寫中 |
| `shareholder_gifts` | scrape_egift + 手動 | 股東紀念品 | 年度 | |
| `gift_scrape_log` | scrape_gifts.js | 爬蟲進度追蹤 | 年度 | |

### RLS 政策

所有可讀表統一：`CREATE POLICY "anon read" ON {table} FOR SELECT TO anon, authenticated USING (true);`

已修正表：alpha_daily_report, chips_daily, futures_daily, institutional_daily, margin_daily, news_daily, options_daily, sector_index_daily, shareholder_gifts, stock_daily_twse, stock_valuation_daily, trader_positions, market_chips_daily, options_analytics_daily

### 各表實際欄位

```
stock_daily_twse      : date, stock_id, name, close, prev, chg_pct, volume, source, created_at
                        ⚠️ stock_id='TAIEX' 為加權指數

news_daily            : id, url, title, title_zh, description, source, lang, published_at, collected_at

alpha_daily_report    : id, report_date, market_mood, market_summary, market_context,
                        key_risks(jsonb), sector_focus(jsonb), alpha_note,
                        dominant_player, retail_signal, suggest_cash(bool), cash_reason, margin_alert,
                        recommendations(jsonb), data_sources(jsonb),
                        macro_data(jsonb), fear_greed(jsonb), generated_at
                        ⚠️ report_date 用台灣時間（todayTW()）

trader_positions      : id, stock_id, stock_name, entry_price, target_price, stop_loss,
                        shares, style, reason, status, exit_price, pnl, pnl_pct, opened_at, closed_at

stock_valuation_daily : date, stock_id, name, pe_ratio, pb_ratio, dividend_yield

institutional_daily   : date, foreign_net, trust_net, dealer_net, total_net
                        ⚠️ trust_net（非 invest_net）；單位元，前端 ÷1e8 轉億
                        ⚠️ 合計請用 market_chips_daily.spot_total_net

margin_daily          : date, margin_balance, margin_chg, short_balance, short_chg

options_daily         : date, pc_ratio_oi, call_oi, put_oi,
                        pc_ratio_oi_monthly/wed/fri, call_oi_monthly/wed/fri, put_oi_monthly/wed/fri,
                        max_pain, call/put_foreign/trust/dealer_net
                        ⚠️ pc_ratio_vol 已移除；週五格式：202606F1
                        ⚠️ 新開發請用 options_analytics_daily

sector_index_daily    : date, index_name, close, change, chg_pct

market_chips_daily    : date（PK）,
                        現貨(億): spot_foreign/trust/dealer_buy/sell/net, spot_total_net,
                        TX(口): fut_tx_foreign/trust/dealer_long/short/net, fut_tx_total_net,
                        MTX(口): fut_mtx_foreign/trust/dealer_net, fut_mtx_total_net,
                        TMF(口): fut_tmf_foreign/trust/dealer_net, fut_tmf_total_net, fut_tmf_total_oi,
                        CALL(口): opt_call_foreign/trust/dealer_long/short/net,
                        PUT(口):  opt_put_foreign/trust/dealer_long/short/net

options_analytics_daily : date, contract_type('monthly'|'weekly_wed'|'weekly_fri'),
                          pc_ratio_oi, call_oi, put_oi, max_pain,
                          call/put_foreign/trust/dealer_net
                          PK: (date, contract_type)
                          ⚠️ renderMaxPainTrend() 查優先序：weekly_fri → weekly_wed → monthly

shareholder_gifts     : id, stock_id, stock_name, year, gift_type, gift_desc,
                        record_date, ex_date, is_egift, source_url, created_at

futures_daily         : date, symbol, name, close, chg, chg_pct, source
```

### market_chips_daily 資料修正紀錄（2026-06-08）

5/29～6/5 的 `spot_foreign_net / trust_net / dealer_net` 曾因 TWSE MI_INST 欄位解析失敗被寫成 0，已用 SQL `buy-sell` 反算補正。`spot_total_net` 和 `buy/sell` 欄位本來就正確。

-----

## GitHub Actions Workflows

| 檔案 | 觸發 | 功能 | 狀態 |
|------|------|------|------|
| `collect-twse.yml` | 週一~五 14:30 | TWSE 股價/估值/產業指數 + `collectChips()`（現貨失敗不覆蓋，只寫期貨）| ✅ |
| `collect-finmind.yml` | 週一~五 15:30 | FinMind 籌碼/選擇權/期貨；`collectInstitutional()` PATCH 現貨欄位 | ✅ |
| `collect-alpha.yml` | 週一~五 16:00 | Alpha 每日報告 | ✅ |
| `collect-news.yml` | 每小時 | 財經新聞 RSS | ✅ |
| `backup.yml` | 週日 09:00 + push main | Supabase + pCloud 備份 | ✅ |
| `scrape_gifts.yml` | 手動 | 爬股東紀念品 | ✅（停用自動）|
| `scrape_egift.yml` | 每週日 09:30 | 爬 eGift | ✅ |

-----

## collect_market_data.js 重要備忘

### contract_date 格式
- 月選：`202606`（regex: `/^[0-9]{6}$/`）
- 週三：`202606W1`（regex: `/^[0-9]{6}W[1245]$/`）
- 週五：`202606F1`（regex: `/^[0-9]{6}F[1-5]$/`）

### collectOptions() 邏輯
1. 日盤過濾：排除 `after_market`
2. Max Pain：最近到期合約
3. 移除：`pc_ratio_vol`、`foreign_opt_net`

### collectChips() 現貨欄位策略（2026-06-08 修正）
- `toB(n)` 解析到 n===0 → 回傳 null，避免覆蓋後續 FinMind 正確值
- TWSE MI_INST / BFIA01 失敗 → spotOK=false → fallback FinMind
- 全失敗時：`market_chips_daily` 只寫期貨欄位，不寫 spot_ 欄位
- `collectInstitutional()`（15:30）用 PATCH 逐筆補填現貨欄位，不覆蓋 fut_ 欄位

### Schema 雙寫過渡期
| 函式 | 舊表（保留）| 新表 |
|------|-----------|------|
| `collectChips()` | `chips_daily` | `market_chips_daily` |
| `collectOptions()` | `options_daily` | `options_analytics_daily` |
| `collectInstitutional()` | `institutional_daily` | `market_chips_daily`（PATCH 現貨欄位）|

`sbUpsert()` 支援陣列 onConflict：`['date','contract_type']` 自動轉逗號。

-----

## 開發慣例

1. 改籌碼只需讀 `chips.js`；改新聞只需讀 `news_feed.js`
2. JS 驗證：`node --check file.js`
3. 漲跌色一律 `var(--up)` / `var(--down)`
4. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
5. Supabase 寫入前先對照本文件確認欄位名稱
6. `str_replace` 後務必確認相鄰上下文
7. 新增 show 函式時，記得在其他所有 `showXxx()` 函式裡加上隱藏新 panel 的邏輯
8. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`

-----

## 工程原則

### Debug 流程
- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- HTTP 500 → 看 Vercel Logs；HTTP 400 → 多半是 Supabase 欄位問題

### Security
- API key 只存 Vercel env 或 GitHub Secrets
- Groq endpoint 走 `requireOwner()` + `x-owner-token`
- `gifts_admin` 走 `x-admin-key` header

### Supabase 查詢原則
- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（已刪）
- 查詢加 `limit`
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)`
- 155 支股票 in() 查詢分兩批（各 ~77 支）避免 URL 過長
- Upsert 必須指定 `on_conflict`
- schema cache 更新：`NOTIFY pgrst, 'reload schema';`
