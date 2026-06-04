# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-06-04
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

-----

## ⚠️ 已知問題（2026-06-04）

### 1. Claude GitHub MCP write 權限問題
- **現象：** Claude 透過 GitHub MCP 呼叫 `create_or_update_file` 回傳 403
- **根因：** `Claude Github MCP Connector`（OAuth App）已授權但未安裝到 repo，GitHub App 安裝步驟未完成
- **嘗試過：** Revoke → Reconnect → Authorize，但 OAuth 流程沒有跳出 repo 選擇畫面
- **目前狀態：** 新增了 Fine-grained PAT custom connector（`https://api.githubcopilot.com/mcp`，token 已填入），下次對話測試是否生效
- **暫時解法：** Claude 輸出檔案到 `/mnt/user-data/outputs/`，由使用者手動貼到 GitHub

### 2. 前端網站數據無資料問題
- **現象：** 網站某些面板顯示無資料或空白
- **狀態：** 尚未診斷根因，待下次對話確認是 RLS / API endpoint / 資料收集哪個環節出問題
- **排查方向：** 瀏覽器 DevTools Console → Network → 確認哪個 API 回傳空值或錯誤

### 3. GitHub Actions 問題
- **Collect TWSE（collect-twse.yml）：** 有問題，尚未確認根因
- **Backup to pCloud（backup.yml）：** 有問題，尚未確認根因
- **注意：** backup.yml 已於 2026-06-04 新增 push trigger（備份改動的 source code），但尚未實際驗證能否正確執行
- **排查方向：** GitHub Actions → 查看各 workflow 的 run log

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

> ⚠️ 開新對話時上傳需要修改的 **單一 js 檔**，不必上傳整個 index.html。
> 例如改籌碼面板只需上傳 `js/chips.js`，改新聞只需上傳 `js/news_feed.js`。
> `api.js` 與 `index.html` 骨架通常不需改動。

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
| `collect-twse.yml` | 週一~五 14:30 | 抓 TWSE 股價/估值/產業指數 | ⚠️ 有問題 |
| `collect-finmind.yml` | 週一~五 15:30 | 抓 FinMind 籌碼/選擇權/期貨 | 未知 |
| `collect-alpha.yml` | 週一~五 16:00 | 產生 Alpha 每日報告 | 正常 |
| `collect-news.yml` | 每小時 | 抓財經新聞 RSS | 未知 |
| `backup.yml` | 週日 09:00 + 每次 push main | Supabase 備份 + source code 備份到 pCloud | ⚠️ 有問題 |
| `scrape_gifts.yml` | 手動觸發 | 爬股東紀念品 | 正常（停用自動排程）|
| `scrape_egift.yml` | 每週日 09:30 | 爬 eGift 紀念品 | 正常 |

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
|------|------------|-----------|
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
- [ ] 前端 `chips.js` 的 `/api/news?endpoint=chips` 已正確讀新表（news.js 已改）
- [ ] 前端期權相關切換至 `options_analytics_daily`（signals.js 等）
- [ ] 確認新表資料穩定 3～5 天後刪舊表（chips_daily / options_daily / institutional_daily）
- [ ] 診斷前端數據無資料問題（⚠️ 2026-06-04 新增）
- [ ] 修復 collect-twse.yml 問題（⚠️ 2026-06-04 新增）
- [ ] 修復 backup.yml 問題（⚠️ 2026-06-04 新增）

-----

## 2026-06-04 本次對話改動總覽

### sentiment.js Groq JSON 解析強化

- 新增 `extractGroqJSON()` 函式：先去 markdown 圍欄（` ```json ``` `），再用**括號深度配對**找完整 `[...]`
- 取代原本貪婪正則 `/\[.*\]/s`，解決巢狀陣列或截斷時匹配錯誤
- `max_tokens` 900 → 1200，減少截斷機率
- 解析失敗時 `console.error` 印出 rawText 前 200 字供 debug
- **注意：** 由於 GitHub MCP write 權限問題，此修改尚未 push，檔案在 `/mnt/user-data/outputs/sentiment.js`

### backup.yml 新增 push trigger

- 每次 push main 自動備份改動的 source code 到 `pcloud:AlphaScope-Backups/source-code/`
- 用 `git diff --name-only --diff-filter=ACM HEAD~1 HEAD` 找出改動檔案
- 保留原始目錄結構（e.g. `js/sentiment.js` → `source-code/js/sentiment.js`）
- **注意：** 尚未驗證能否正確執行（⚠️ 待確認）

### GitHub MCP 權限排查

- 問題：Claude Github MCP Connector 回傳 403，`has not been installed on any accounts`
- 嘗試：Revoke → Reconnect，OAuth 頁面出現但只有 Authorize，沒有 repo 安裝步驟
- 新增 Fine-grained PAT connector（URL: `https://api.githubcopilot.com/mcp`）
- 權限：Contents R/W、Actions R/W、Metadata R
- **下次對話開始時先測試 GitHub write 是否生效**

-----

## 2026-06-01 本次對話改動總覽

### Bug 修復

1. **VIX 顯示「見全球商品」** — `watchlist.js` 第二段重複 VIX 邏輯覆蓋正確結果，刪除重複段
1. **加權指數 MIS 代碼錯誤** — `tse_TAIEX` → `tse_t00`（TWSE MIS 正確代碼）
1. **TWSE MIS CORS 錯誤** — `service-worker.js` 新增 `mis.twse.com.tw` 直接放行，前端改走 Vercel proxy（`news.js` 新增 `mis` endpoint）
1. **自選股顯示昨收** — MIS proxy 實作，`fetchMISPrice` 改打 `${API_BASE}?endpoint=mis&ex_ch=...`
1. **籌碼圖表最後一筆被截斷** — `chips.js` `makeCanvasChart` PR: 10→32、`makeCumulativeChart` PR: 10→35；tooltip 加 `Math.min` clamp；`roTarget` 從 `chartEl.parentElement` 改為 `chartEl`
1. **Groq JSON 解析失敗** — `sentiment.js` 改用 `/\[.*\]/s` 正則提取 JSON array（後於 2026-06-04 進一步強化）
1. **Alpha 報告 upsert 409** — `news.js` upsert URL 加 `?on_conflict=report_date`
1. **`market_context` 空值不重新產生** — `collect_market_data.js` 跳過邏輯改為：`market_context` 有值才跳過，否則重新產生
1. **`FINMIND_TOKEN` 未傳入 Alpha workflow** — `collect-alpha.yml` 補上 `FINMIND_TOKEN: ${{ secrets.FINMIND_TOKEN }}`

### 今日總結大卡片升級

- `index.html` 新增三個隱藏區塊（有值才顯示）：
  - `dsbContext`：靛藍左邊線，顯示 `market_context`（盤勢背景）
  - `dsbRisks`：橙色標題 + ul 列表，顯示 `key_risks`
  - `dsbSectors`：產業卡片，依 `sentiment` 上色（強勢=紅/中性=灰/弱勢=綠）
- `watchlist.js` `loadDailySummary` 新增渲染邏輯填入上述三個區塊

### Vercel API 新增 endpoint

- `news.js` 新增 `mis` endpoint：伺服器端打 TWSE MIS，帶正確 Referer，解決前端 CORS

### GitHub Actions

- `collect-alpha.yml` 補上 `FINMIND_TOKEN`，Alpha 報告現可正確抓取全部 7 個總經指標：
  SOX、DXY、美債2Y、美債10Y、聯準會利率、S&P500、台幣匯率

-----

## 2026-05-29 本次對話改動總覽

### 前端架構重構（index.html 拆分）

- 原本 7,624 行的 `index.html` 拆成 1 個 CSS + 12 個 JS 獨立檔案
- `index.html` 瘦身到 ~1,230 行（純 HTML 骨架）
- 好處：跟 AI 對話只需上傳單一 js 檔，省 80%+ token

### 前端檔案命名

- `js/news.js`（舊）→ `js/news_feed.js`（新），避免與 `api/news.js` 混淆
- `api/news.js` = Vercel Serverless Function（後端）
- `js/news_feed.js` = 前端新聞渲染 JS

### Workflow 調整

- `scrape_gifts.yml` 停用自動排程（cron 已注解），只保留手動觸發
- `scrape_egift.yml` 改為**每週日**09:30 執行（原為週一三五）

### 籌碼面板趨勢圖新增

- 多空訊號→籌碼面板底部新增 4 張近 10 日 Canvas 趨勢圖
- 支援 hover tooltip 顯示當日數值、Y 軸對稱零軸、X 軸全日期

-----

## 2026-05-27 本次對話改動總覽

### RLS 全面修正

- 所有 12 張 SELECT 可讀表的 RLS 從 `{public}` 改為 `{anon,authenticated}`

### Workflow 拆分

- `collect.yml` 拆成 5 個獨立檔案：`collect-twse.yml`、`collect-alpha.yml`、`collect-finmind.yml`、`collect-news.yml`、`backup.yml`

### Bug 修復

1. **頁面預設顯示** — 移除 `showHeatmap()` 自動執行，改為 `loadHeatmap()` 背景預載
1. **多空訊號 `inst is not defined`** — `opt`/`inst` 提升到外層 scope
1. **`loadMktSignals._busy` 鎖死** — 加 `try/finally` 確保 reset
1. **`institutional_daily.invest_net`** — 改為正確欄位名 `trust_net`
1. **三大法人合計數字錯誤** — 改從 `chips_daily.spot_total_net` 讀取
1. **TMF OI 解析錯誤** — 改取「小計:」後合計成交量之後第一個數字
1. **`showGifts()` 中 `mbnSetActive` 未定義** — 移除該呼叫
1. **`gifts` endpoint nocache** — 加 `nocache=1` 參數強制跳過 cache

-----

## 開發慣例

1. 開新對話上傳需要修改的**單一 js 檔** + `CLAUDE.md`（視需要加 `collect_market_data.js` 或 `news.js`）
1. **下次對話開始時先測試 GitHub MCP write 是否生效**（新增 PAT connector 後尚未驗證）
1. Claude 複製到 `/home/claude/alphascope/js/`，修改後輸出到 `/mnt/user-data/outputs/`
1. 改籌碼相關只需 `chips.js`；改新聞只需 `news_feed.js`；改樣式只需 `style.css`
1. JS 驗證：`node --check file.js`
1. HTML 驗證：用 Python 統計 `<script>/<style>` 開關標籤數量是否一致
1. 漲跌色一律 `var(--up)` / `var(--down)`
1. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
1. Supabase 寫入前先對照本文件確認欄位名稱
1. 新功能同步更新 CLAUDE.md
1. `str_replace` 後務必確認相鄰上下文，避免 if 語句被合併到注釋同行
1. 新增 show 函式時，記得在其他所有 `showXxx()` 函式裡加上隱藏新 panel 的邏輯
1. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`（會觸發無限 ResizeObserver 迴圈）

-----

## 工程原則

### Debug 流程

- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- HTTP 500 → 看 Vercel Logs；HTTP 400 → 多半是 Supabase 資料表/欄位問題
- 找到根源後說明原因，再提出修法
- 前端顯示異常優先用瀏覽器 DevTools Console 找錯誤

### Security

- API key 只存 Vercel env 或 GitHub Secrets
- Groq endpoint 一律走 `requireOwner()` + `x-owner-token` 雙層保護
- `gifts_admin` 走 `x-admin-key` header，`ADMIN_KEY` 存 Vercel env

### Supabase 查詢原則

- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（舊表）
- 查詢加 `limit` 避免回傳過多資料
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400
- Upsert 必須指定 `on_conflict` 欄位（URL 參數 `?on_conflict=欄位名`）
- schema cache 更新：`NOTIFY pgrst, 'reload schema';`
