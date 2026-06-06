# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-06-06
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

-----

## ⚠️ 已知問題

### 1. collect-finmind.yml 狀態未知
- **狀態：** 尚未確認是否正常運作

### 2. collect-news.yml 狀態未知
- **狀態：** 尚未確認是否正常運作

-----

## ✅ 已解決問題

### market_chips_daily 補資料 ✅（2026-06-06）
- 從 `chips_daily` 補寫 6-03 資料至 `market_chips_daily`，已由 Claude Supabase MCP 直接執行
- 籌碼面板前端顯示已恢復正常

### 待 push 檔案已全部 push ✅（2026-06-06）
- `sentiment.js`、`collect_market_data.js`、`news.js`、`signals.js`、`index.html` 均已 push

### collect-twse.yml ✅（2026-06-06）
- 已排查，恢復正常

### GitHub MCP ✅（2026-06-06）
- **解法：** 安裝 Claude Github MCP Connector GitHub App（`https://github.com/apps/claude-github-mcp-connector/installations/new`），選 All repositories
- **使用方式：** 對話框 `+` → Connectors → 開啟 GitHub MCP toggle（Load tools when needed 即可，不需 Tools already loaded）
- **能力：** 直接讀取 repo 檔案、push commit，無需再手動上傳/下載

### backup.yml push trigger ✅（2026-06-05）
- push main 自動備份正常運作，已確認

-----

## 開發工作流程（GitHub MCP 可用後）

1. 告訴 Claude 要改什麼
2. Claude 直接用 `GitHub MCP:get_file_contents` 讀取 repo 檔案
3. 修改後用 `GitHub MCP:push_files` 直接 push，不需再上傳/下載
4. 重要改動後更新 CLAUDE.md 並 push

-----

## 專案概覽

**名稱：** AlphaScope — AI 驅動財經市場情報網站
**網址：** <https://alphascope-fin.vercel.app>
**GitHub：** github.com/kp091656-dotcom/alphascope-api
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫
**分支：** main → 自動部署到 Vercel

-----

## 本地工作檔案路徑

> ⚠️ **2026-05-29 重大架構變更：index.html 已拆分為獨立 JS/CSS 檔案**

|檔案           |Claude 工作路徑                                |部署位置                                    |
|-------------|-------------------------------------------|----------------------------------------|
|前端主檔         |`/home/claude/alphascope/index.html`       |`index.html`                            |
|共用樣式         |`/home/claude/alphascope/css/style.css`    |`css/style.css`                         |
|Supabase/全域變數|`/home/claude/alphascope/js/api.js`        |`js/api.js`                             |
|新聞渲染         |`/home/claude/alphascope/js/news_feed.js`  |`js/news_feed.js`                       |
|社群情緒         |`/home/claude/alphascope/js/sentiment.js`  |`js/sentiment.js`                       |
|股東紀念品        |`/home/claude/alphascope/js/gifts.js`      |`js/gifts.js`                           |
|台股熱圖         |`/home/claude/alphascope/js/heatmap.js`    |`js/heatmap.js`                         |
|多空訊號         |`/home/claude/alphascope/js/signals.js`    |`js/signals.js`                         |
|個股 Modal     |`/home/claude/alphascope/js/stock_modal.js`|`js/stock_modal.js`                     |
|Alpha 交易室    |`/home/claude/alphascope/js/alpha.js`      |`js/alpha.js`                           |
|估值/回測        |`/home/claude/alphascope/js/valuation.js`  |`js/valuation.js`                       |
|籌碼面板         |`/home/claude/alphascope/js/chips.js`      |`js/chips.js`                           |
|自選股          |`/home/claude/alphascope/js/watchlist.js`  |`js/watchlist.js`                       |
|SW/PWA       |`/home/claude/alphascope/js/utils.js`      |`js/utils.js`                           |
|Vercel API   |`/home/claude/news.js`                     |`api/news.js`                           |
|K 線圖         |`/home/claude/chart.html`                  |`chart.html`                            |
|每日收集腳本       |`/home/claude/collect_market_data.js`      |`.github/scripts/collect_market_data.js`|
|備份腳本         |`/home/claude/backup.js`                   |`.github/scripts/backup.js`             |
|紀念品爬蟲        |`/home/claude/scrape_gifts.js`             |`.github/scripts/scrape_gifts.js`       |
|紀念品排程        |`/home/claude/scrape_gifts.yml`            |`.github/workflows/scrape_gifts.yml`    |
|eGift 爬蟲     |`/home/claude/scrape_egift.js`             |`.github/scripts/scrape_egift.js`       |
|eGift 排程     |`/home/claude/scrape_egift.yml`            |`.github/workflows/scrape_egift.yml`    |
|PWA SW       |`/home/claude/service-worker.js`           |`service-worker.js`                     |
|PWA Manifest |`/home/claude/pwa/manifest.json`           |`manifest.json`                         |
|**紀念品後台**    |`gifts-admin.html`                         |`gifts-admin.html`（Vercel 公開）           |

### JS 載入順序（index.html 底部）

```html
<script src="/js/api.js"></script>        <!-- 必須第一個：Supabase、API_BASE、全域變數 -->
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

### 全域變數定義位置（全在 api.js）

```js
const SUPABASE_URL, SUPABASE_ANON  // Supabase 連線
const API_BASE                      // Vercel API base URL
const CLAUDE_MODEL                  // claude-sonnet-4-20250514
let allArticles, displayedCount, currentLang, currentCat
let _giftsData, _giftCat, _giftSort
let futuresData, futuresSortKey
```

> ⚠️ 開新對話時直接請 Claude 用 GitHub MCP 讀取需要修改的檔案，不需上傳。
> 例如改籌碼面板：「請讀取 js/chips.js 並修改 xxx」

-----

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 18 張）

|表名                     |來源                     |內容                            |每日筆數   |
|-----------------------|-----------------------|------------------------------|-------|
|`stock_daily_twse`     |TWSE OpenAPI           |全上市股票收盤、成交量；含 stock_id='TAIEX'|~1230+1|
|`institutional_daily`  |FinMind                |三大法人現貨買賣超                     |1      |⚠️ 過渡期待刪|
|`margin_daily`         |FinMind                |融資/融券餘額                       |1      |
|`options_daily`        |FinMind                |P/C Ratio、法人選擇權               |1      |⚠️ 過渡期待刪|
|`futures_daily`        |FinMind + Yahoo Finance|全球商品/指數（前端走 Vercel proxy）     |~35    |
|`sector_index_daily`   |TWSE OpenAPI           |官方產業指數（76個）                   |76     |
|`stock_valuation_daily`|TWSE OpenAPI           |個股本益比/殖利率/PBR                 |~1071  |
|`news_daily`           |RSS（多來源）               |財經新聞快取（保留 48 小時）              |~150   |
|`alpha_daily_report`   |Groq AI                |Alpha 交易員每日報告                 |1      |
|`trader_positions`     |Alpha 自動               |Alpha 持倉紀錄（open/closed）       |動態     |
|`chips_daily`          |FinMind + TAIFEX       |籌碼資料（現貨+期貨+選擇權）               |1      |⚠️ 過渡期待刪|
|`market_chips_daily`   |FinMind + TAIFEX       |新版籌碼（Domain重整）                  |1      |🆕 雙寫中   |
|`options_analytics_daily`|FinMind              |選擇權分析，複合PK(date,contract_type) |3      |🆕 雙寫中   |
|`shareholder_gifts`    |scrape_egift + 手動      |股東紀念品資訊（含 eGift）              |年度     |
|`gift_scrape_log`      |scrape_gifts.js        |爬蟲進度追蹤（每股每年一筆狀態紀錄）            |年度     |


> ⚠️ `stock_daily`（舊表）已刪除。

### RLS 政策（2026-05-27 全面修正 / 2026-06-03 新表補上）

**所有 14 張 SELECT 可讀表**的 RLS 已統一改為 `TO anon, authenticated`：

```sql
-- 已修正的表（全部）：
-- alpha_daily_report, chips_daily, futures_daily, institutional_daily,
-- margin_daily, news_daily, options_daily, sector_index_daily,
-- shareholder_gifts, stock_daily_twse, stock_valuation_daily, trader_positions,
-- market_chips_daily, options_analytics_daily（2026-06-03 新增）
-- policy name 統一為 "anon read"，roles = {anon,authenticated}
```

> ⚠️ 如果新建資料表，記得加 `CREATE POLICY "anon read" ON {table} FOR SELECT TO anon, authenticated USING (true);`

### 各表實際欄位（已逐一確認，嚴格遵守）

```
stock_daily_twse     : date, stock_id, name, close, prev, chg_pct, volume, source, created_at
                       ⚠️ stock_id='TAIEX' 為加權指數

news_daily           : id, url, title, title_zh, description, source, lang, published_at, collected_at

alpha_daily_report   : id, report_date, market_mood, market_summary,
                       market_context（盤勢背景，含總經分析）,
                       key_risks（jsonb 陣列，2-3項具體風險）,
                       sector_focus（jsonb 陣列，{name,reason,sentiment}）,
                       alpha_note,
                       dominant_player, retail_signal,
                       suggest_cash（boolean）, cash_reason, margin_alert,
                       recommendations(jsonb), data_sources(jsonb),
                       macro_data（jsonb，SOX/DXY/美債2Y+10Y/台幣/聯準會利率/S&P500）,
                       fear_greed（jsonb，{score,rating,prev_week}）,
                       generated_at
                       ⚠️ report_date 用台灣時間（todayTW()），避免 UTC 22:xx 寫入前一天

trader_positions     : id, stock_id, stock_name, entry_price, target_price, stop_loss,
                       shares, style, reason, status, exit_price, pnl, pnl_pct, opened_at, closed_at

stock_valuation_daily: date, stock_id, name, pe_ratio, pb_ratio, dividend_yield

institutional_daily  : date, foreign_net, trust_net, dealer_net, total_net
                       ⚠️ 欄位是 trust_net（不是 invest_net）
                       ⚠️ 單位：元（FinMind 原始值），前端顯示要 ÷ 1e8 轉億
                       ⚠️ 三大法人合計顯示請用 chips_daily.spot_total_net（億元，正確）
                          不要用 institutional_daily.total_net（有重複計算問題）

margin_daily         : date, margin_balance, margin_chg, short_balance, short_chg

options_daily        : date,
                       pc_ratio_oi（全部合約）, call_oi（全部）, put_oi（全部）,
                       pc_ratio_oi_monthly, call_oi_monthly, put_oi_monthly（近月合約）,
                       pc_ratio_oi_wed, call_oi_wed, put_oi_wed（近週三合約）,
                       pc_ratio_oi_fri, call_oi_fri, put_oi_fri（近週五合約）,
                       max_pain（最近到期合約計算：月/週三/週五誰快到期用誰）,
                       call_foreign_net, call_trust_net, call_dealer_net（CALL 三大法人淨口）,
                       put_foreign_net, put_trust_net, put_dealer_net（PUT 三大法人淨口）
                       ⚠️ pc_ratio_vol 已移除
                       ⚠️ 週五合約 FinMind contract_date 實際格式：202606F1（YYYYMMFx），已確認
                       ⚠️ 過渡期保留雙寫，新開發請用 options_analytics_daily

sector_index_daily   : date, index_name, close, change, chg_pct

market_chips_daily   : date（PRIMARY KEY）,
                       現貨（億元）: spot_foreign_buy/sell/net, spot_trust_buy/sell/net,
                                   spot_dealer_buy/sell/net, spot_total_net,
                       台指期TX（口）: fut_tx_foreign/trust/dealer_long/short/net, fut_tx_total_net,
                       小台MTX（口）: fut_mtx_foreign/trust/dealer_net, fut_mtx_total_net,
                       微台TMF（口）: fut_tmf_foreign/trust/dealer_net, fut_tmf_total_net, fut_tmf_total_oi,
                       選擇權CALL（口）: opt_call_foreign/trust/dealer_long/short/net,
                       選擇權PUT（口）:  opt_put_foreign/trust/dealer_long/short/net

options_analytics_daily : date, contract_type（'monthly'|'wed'|'fri'）,
                          pc_ratio_oi, call_oi, put_oi, max_pain,
                          call_foreign_net, call_trust_net, call_dealer_net,
                          put_foreign_net, put_trust_net, put_dealer_net
                          PRIMARY KEY: (date, contract_type)

shareholder_gifts    : id, stock_id, stock_name, year, gift_type, gift_desc,
                       record_date, ex_date, is_egift, source_url, created_at

futures_daily        : date, symbol, name, close, chg, chg_pct, source
```

-----

## GitHub Actions Workflows

| 檔案 | 觸發 | 功能 | 狀態 |
|------|------|------|------|
| `collect-twse.yml` | 週一~五 14:30 | 抓 TWSE 股價/估值/產業指數 | ✅ 正常 |
| `collect-finmind.yml` | 週一~五 15:30 | 抓 FinMind 籌碼/選擇權/期貨 | ⚠️ 未確認 |
| `collect-alpha.yml` | 週一~五 16:00 | 產生 Alpha 每日報告 | ✅ 正常 |
| `collect-news.yml` | 每小時 | 抓財經新聞 RSS | ⚠️ 未確認 |
| `backup.yml` | 週日 09:00 + 每次 push main | Supabase 備份 + source code 備份到 pCloud | ✅ 正常 |
| `scrape_gifts.yml` | 手動觸發 | 爬股東紀念品 | 正常（停用自動排程）|
| `scrape_egift.yml` | 每週日 09:30 | 爬 eGift 紀念品 | ✅ 正常 |

-----

## collect_market_data.js 重要備忘

### collectOptions() 重要提醒

- 抓取邏輯：逐日往前找，`dayRows.length > 0` 才停，不能只看有無資料
- `contract_date` 實際格式：
  - 月選：`202606`（regex: `/^[0-9]{6}$/`）
  - 週三：`202606W1`（regex: `/^[0-9]{6}W[1245]$/`）
  - 週五：`202606F1`（regex: `/^[0-9]{6}F[1-5]$/`）

### collectOptions() 最終重構

1. 日盤過濾：排除 `after_market`
2. Max Pain：取最近到期合約（月選=該月第三個週三；週三/週五=從 tradeDate 起最近的對應星期）
3. 移除：`pc_ratio_vol`、`foreign_opt_net`

### Schema 重整（雙寫過渡期）

| 函式 | 舊表（保留） | 新表（新增）|
|------|------------|----------|
| `collectChips()` | `chips_daily` | `market_chips_daily` |
| `collectOptions()` | `options_daily` | `options_analytics_daily`（3列/天）|
| `collectInstitutional()` | `institutional_daily` | `market_chips_daily`（現貨欄位）|

- `sbUpsert()` 新增支援陣列 `onConflict`：`['date','contract_type']` 自動轉逗號

### 待辦

- [x] Supabase 對兩張新表加 RLS ✅
- [x] `api/news.js` chips endpoint 切換至 `market_chips_daily` ✅
- [x] `api/news.js` tmf endpoint 切換至 `market_chips_daily` ✅
- [x] `valuation.js` 修正 `foreign_opt_net` 400 錯誤，改查 `options_analytics_daily` ✅
- [x] `backup.js` 新增 `market_chips_daily`、`options_analytics_daily` 備份 ✅
- [x] `backup.yml` shell bug 修正 ✅
- [x] `collect_market_data.js` MTX/TMF `netOnly` 修正 ✅
- [x] `api/news.js` options endpoint 重寫 ✅
- [x] `js/signals.js` 對應新 options API 結構 ✅
- [x] `index.html` 加 `optByContract` div ✅
- [x] GitHub MCP 連線 ✅（2026-06-06）
- [x] 補資料：從 `chips_daily` 補寫 6-03 至 `market_chips_daily` ✅（2026-06-06）
- [x] push 待 push 的檔案：`sentiment.js`、`collect_market_data.js`、`news.js`、`signals.js`、`index.html` ✅（2026-06-06）
- [x] 前端籌碼面板恢復顯示 ✅（2026-06-06）
- [x] 排查 `collect-twse.yml` 問題 ✅（2026-06-06）
- [ ] 確認 `collect-finmind.yml` 狀態
- [ ] 確認 `collect-news.yml` 狀態
- [ ] 確認新表資料穩定 3～5 天後刪舊表（`chips_daily`、`options_daily`、`institutional_daily`）

-----

## 2026-06-06 改動總覽

### 補資料 + 待辦清理
- Supabase MCP 直接執行 SQL，從 `chips_daily` 補寫 6-03 至 `market_chips_daily` ✅
- 籌碼面板前端顯示恢復正常 ✅
- 所有待 push 檔案已 push ✅
- collect-twse.yml 已排查恢復正常 ✅

### GitHub MCP 連線成功
- 安裝 Claude Github MCP Connector GitHub App
- 現可直接讀取/push repo 檔案，不需手動上傳

### js/watchlist.js — market_summary 截斷修正
- 移除 `slice(0, 80)` 硬截斷，改為完整顯示 `alpha.market_summary`

-----

## 2026-06-04（第二次對話）改動總覽

### collect_market_data.js — MTX/TMF netOnly 修正
- `parseFut()` 新增 `netOnly = false` 參數
- `parseFut(txRows, 'fut_tx')` → TX 照舊，寫 long/short/net
- `parseFut(mtxRows, 'fut_mtx', true)` / `parseFut(tmfRows, 'fut_tmf', true)` → 只寫 net
- 根因：`market_chips_daily` 的 MTX/TMF 欄位只有 `_net`，無 `_long`/`_short`

### backup.yml — shell bug 修正
- 原本：`rclone ... && echo ✅ && SUCCESS+=1 || echo ❌ && FAIL+=1`
- 改為：`if rclone ...; then SUCCESS+=1; else FAIL+=1; fi`

### api/news.js — options endpoint 完整重寫
- 分合約類型：`isMonthly` / `isWed` / `isFri`
- 各自獨立計算 callOI / putOI / pcRatio，回傳 `byContract`
- Max Pain、三大法人 CALL/PUT 分別累加
- 移除：`pc_ratio_vol`、`strikes` 陣列

### js/signals.js — 對應新 options API
- `renderOptions(data)` 共用渲染函式
- 新增 `optByContract` 區塊渲染
- Fallback 改讀 `options_analytics_daily`

### index.html — HTML 結構調整
- P/C Ratio Vol → Max Pain stat-card
- 新增 `id="optByContract"` 分合約 OI 容器

-----

## 2026-06-04（第一次對話）改動總覽

### sentiment.js Groq JSON 解析強化
- 新增 `extractGroqJSON()` 函式：括號深度配對找完整 `[...]`
- `max_tokens` 900 → 1200

### backup.yml 新增 push trigger
- 每次 push main 自動備份到 pCloud ✅（2026-06-05 已驗證）

-----

## 2026-06-01 本次對話改動總覽

### Bug 修復
1. VIX 顯示「見全球商品」
2. 加權指數 MIS 代碼錯誤（tse_TAIEX → tse_t00）
3. TWSE MIS CORS 錯誤 → Vercel proxy
4. 自選股顯示昨收 → MIS proxy 實作
5. 籌碼圖表最後一筆被截斷
6. Groq JSON 解析失敗
7. Alpha 報告 upsert 409
8. `market_context` 空值不重新產生
9. `FINMIND_TOKEN` 未傳入 Alpha workflow

### 今日總結大卡片升級
- 新增三個隱藏區塊：`dsbContext`、`dsbRisks`、`dsbSectors`

### Vercel API 新增 mis endpoint

-----

## 2026-05-29 本次對話改動總覽

### 前端架構重構（index.html 拆分）
- 7,624 行 → 1,230 行（純 HTML 骨架）+ 12 個 JS 檔

### 前端檔案命名
- `js/news.js` → `js/news_feed.js`

### Workflow 調整
- `scrape_gifts.yml` 停用自動排程
- `scrape_egift.yml` 改為每週日執行

### 籌碼面板趨勢圖新增
- 近 10 日 Canvas 趨勢圖 × 4

-----

## 2026-05-27 本次對話改動總覽

### RLS 全面修正
### Workflow 拆分（collect.yml → 5 個獨立檔案）
### 多項 Bug 修復

-----

## 開發慣例

1. **直接請 Claude 用 GitHub MCP 讀取並修改檔案**，不需上傳
1. 改籌碼相關只需讀 `chips.js`；改新聞只需讀 `news_feed.js`
1. JS 驗證：`node --check file.js`
1. HTML 驗證：用 Python 統計 `<script>/<style>` 開關標籤數量
1. 漲跌色一律 `var(--up)` / `var(--down)`
1. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
1. Supabase 寫入前先對照本文件確認欄位名稱
1. 新功能同步更新 CLAUDE.md 並 push
1. `str_replace` 後務必確認相鄰上下文
1. 新增 show 函式時，記得在其他所有 `showXxx()` 函式裡加上隱藏新 panel 的邏輯
1. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`

-----

## 工程原則

### Debug 流程
- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- HTTP 500 → 看 Vercel Logs；HTTP 400 → 多半是 Supabase 資料表/欄位問題

### Security
- API key 只存 Vercel env 或 GitHub Secrets
- Groq endpoint 一律走 `requireOwner()` + `x-owner-token` 雙層保護
- `gifts_admin` 走 `x-admin-key` header

### Supabase 查詢原則
- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（舊表）
- 查詢加 `limit` 避免回傳過多資料
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長
- Upsert 必須指定 `on_conflict` 欄位
- schema cache 更新：`NOTIFY pgrst, 'reload schema';`
