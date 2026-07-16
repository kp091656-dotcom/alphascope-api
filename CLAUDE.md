# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-07-16（對話二十一）
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 🔴 Claude 操作規則

1. 使用者傳原始檔案給 Claude，Claude 修改後用 `present_files` 生成下載連結，由使用者自行上傳 GitHub。
2. 每次對話結束前（使用者主動要求），更新 CLAUDE.md，用 `present_files` 生成下載連結，並附上建議的 commit message。
3. CLAUDE.md 只記錄當前狀態；歷史改動以 GitHub commit history 為準。
4. ⚠️ Claude 不使用任何 MCP push 功能，一律生成檔案讓使用者手動上傳。
5. ⚠️ CLAUDE.md 只在使用者主動要求切換新對話時才更新。
6. Commit message 必須 50 字元以內（超過拆 subject + body）。

---

## ⚠️ 已知問題

- **FinMind `TaiwanStockTotalInstitutionalInvestors` 資料延遲**：有時回傳全 0，`collectInstitutional()` 已加防呆，全零略過不寫入。
- **BFIAMU**：`⚠️ BFIAMU 無匹配資料` 屬正常 warning，不中斷主流程。
- **openapi.twse.com.tw 偶爾整批回傳 HTML（維護中），不限週一**：`collectTWSEDaily`／`collectSectorIndex`／`collectValuation` 三支都打這個網域。曾在 Jul 6、Jul 13 兩個週一失敗（含手動重跑仍失敗，持續 2 小時以上），**Jul 16（週四）早上又失敗一次**，證實不是「週一限定」，樣本太少導致之前誤判規律。根因未 100% 確認（找不到官方維護公告），但同時間 `www.twse.com.tw`（舊版網域）是正常的。`collectTWSEDaily` 的 fallback（見「對話二十」）已於 Jul 16 實戰驗證成功（log 出現預期訊息，1198 筆 upsert）。`collectSectorIndex`／`collectValuation` 仍未加 fallback，會直接失敗，需要時再手動重跑。

---

## 專案概覽

**名稱：** AlphaScope — AI 驅動財經市場情報網站
**網址：** https://alphascope-fin.vercel.app
**GitHub：** github.com/kp091656-dotcom/alphascope-api
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

> ⚠️ 2026-05-29：index.html 已拆分為獨立 JS/CSS 檔案

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|---------------|---------|
| 前端主檔 | `/home/claude/alphascope/index.html` | `index.html` |
| 共用樣式 | `/home/claude/alphascope/css/style.css` | `css/style.css` |
| Supabase/全域變數 | `/home/claude/alphascope/js/api.js` | `js/api.js` |
| 新聞渲染 | `/home/claude/alphascope/js/news_feed.js` | `js/news_feed.js` |
| 社群情緒 | `/home/claude/alphascope/js/sentiment.js` | `js/sentiment.js` |
| 股東紀念品 | `/home/claude/alphascope/js/gifts.js` | `js/gifts.js` |
| 台股熱圖 | `/home/claude/alphascope/js/heatmap.js` | `js/heatmap.js` |
| 多空訊號 + Max Pain + 部位風險 | `/home/claude/alphascope/js/signals.js` | `js/signals.js` |
| 個股 Modal | `/home/claude/alphascope/js/stock_modal.js` | `js/stock_modal.js` |
| Alpha 交易室 | `/home/claude/alphascope/js/alpha.js` | `js/alpha.js` |
| 估值/回測 | `/home/claude/alphascope/js/valuation.js` | `js/valuation.js` |
| 籌碼面板 | `/home/claude/alphascope/js/chips.js` | `js/chips.js` |
| 自選股 | `/home/claude/alphascope/js/watchlist.js` | `js/watchlist.js` |
| SW/PWA | `/home/claude/alphascope/js/utils.js` | `js/utils.js` |
| 產業輪動 RSM | `/home/claude/alphascope/js/sector_rsm.js` | `js/sector_rsm.js` |
| Vercel API | `/home/claude/news.js` | `api/news.js` |
| K 線圖 | `/home/claude/chart.html` | `chart.html` |
| 每日收集腳本 | `/home/claude/collect_market_data.js` | `.github/scripts/collect_market_data.js` |
| 備份腳本 | `/home/claude/backup.js` | `.github/scripts/backup.js` |
| 紀念品爬蟲 | `/home/claude/scrape_gifts.js` | `.github/scripts/scrape_gifts.js` |
| eGift 爬蟲 | `/home/claude/scrape_egift.js` | `.github/scripts/scrape_egift.js` |
| PWA SW | `/home/claude/service-worker.js` | `service-worker.js` |
| PWA Manifest | `/home/claude/pwa/manifest.json` | `manifest.json` |

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
<script src="/js/sector_rsm.js"></script>
```

---

## GitHub Actions Workflows

| 檔案 | 觸發 | 功能 | 狀態 |
|------|------|------|------|
| `collect-twse.yml` | 週一~五 14:30 | TWSE 股價/估值/產業指數 + `collectChips()` | ✅ |
| `collect-finmind.yml` | 週一~五 15:30 | FinMind 籌碼/選擇權/期貨；PATCH 現貨欄位 | ✅ |
| `collect-alpha.yml` | FinMind 完成後觸發 | Alpha 每日報告（`alpha_analyze` endpoint） | ✅ |
| `collect-news.yml` | 每小時 | 財經新聞 RSS | ✅ |
| `backup.yml` | 週日 09:00 + push main | Supabase + pCloud 備份 | ✅ |
| `scrape_gifts.yml` | 手動 | 爬股東紀念品 | ✅（停用自動）|
| `scrape_egift.yml` | 每週日 09:30 | 爬 eGift | ✅ |
| `alpha_thought.yml` | Collect Alpha Report 完成後 + 週五 16:00 | 三 job：Agent1→Agent2→Agent3 | ✅ |

### alpha_thought.yml 三 Job 架構

```
agent1（市場資料員）→ agent2（分析師）→ agent3（撰稿員）
```

- **Agent 1**：抓 8 項市場資料 + 技術指標 + 市場環境感知 → 存 `alpha_profile.agent1_*`
- **Agent 2**：評分昨日預測 + 弱點分析 + 生成檢討篇 → 存 `alpha_profile.agent2_*`
- **Agent 3**：讀 agent1/2 快取 → 生成隨筆 → 寫入 `alpha_thoughts`
- 任一 Agent 失敗，後續 job 停止（`if: success()`）

---

## Supabase

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）
**service_role key：** GitHub Secrets `SUPABASE_SERVICE_KEY`（勿公開）

### 資料表

| 表名 | 來源 | 內容 | 備註 |
|------|------|------|------|
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量；含 TAIEX | |
| `stock_valuation_daily` | TWSE OpenAPI | 本益比、股價淨值比、殖利率 | |
| `sector_index_daily` | TWSE OpenAPI | 產業指數（35 個） | |
| `market_chips_daily` | TWSE + FinMind | 三大法人現貨＋台指期＋散戶TMF | 新表 |
| `chips_daily` | FinMind | 三大法人（舊表） | 待刪⚠️ |
| `options_analytics_daily` | FinMind | 選擇權 PC Ratio / Max Pain | 新表 |
| `options_daily` | FinMind | 選擇權明細（舊表） | 待刪⚠️ |
| `institutional_daily` | FinMind | 法人舊表 | 待刪⚠️ |
| `margin_daily` | FinMind | 融資融券 | |
| `news_daily` | RSS + TheNewsAPI | 財經新聞 | |
| `alpha_thoughts` | Groq | Alpha 隨筆（含預測/評分/信心度） | |
| `alpha_profile` | 系統維護 | Alpha 成長檔案（id=1） | |
| `alpha_analyze` | Groq | 個股/大盤 AI 分析報告 | |
| `stock_gifts` | 爬蟲 | 股東紀念品 | |
| `egift_items` | 爬蟲 | 電子禮券 | |

### alpha_profile schema（最終版）

```sql
create table public.alpha_profile (
  id integer not null default 1,
  total_posts integer not null default 0,
  correct_calls integer not null default 0,
  total_calls integer not null default 0,
  rank text not null default '菜鳥交易員',
  style_memo text null,
  updated_at timestamptz null default now(),
  specialties jsonb null default '[]',
  market_regime text null default 'normal',
  weakness_analysis jsonb null default '{}',
  weakest_regime text null,
  agent1_context jsonb null,
  agent1_market_regime text null,
  agent1_updated_at timestamptz null,
  agent2_wrong_items jsonb null default '[]',
  agent2_streak integer null default 0,
  agent2_updated_at timestamptz null,
  constraint alpha_profile_pkey primary key (id),
  constraint alpha_profile_id_check check (id = 1)
);
```

---

## collect_market_data.js 重要備忘

### contract_date 格式

- 月選：`202606`（regex: `/^[0-9]{6}$/`）
- 週三：`202606W1`（regex: `/^[0-9]{6}W[1245]$/`）
- 週五：`202606F1`（regex: `/^[0-9]{6}F[1-5]$/`）

### collectOptions()

- 排除 `after_market`
- Max Pain：最近到期合約；**到期當天（結算日）視為已結算，改用次近合約**
- 移除欄位：`pc_ratio_vol`、`foreign_opt_net`

### collectChips() 現貨欄位策略

- `toB(n)` 解析到 n===0 → 回傳 null，避免覆蓋後續 FinMind 正確值
- TWSE 失敗 → spotOK=false → fallback FinMind
- 全失敗時：只寫期貨欄位，不寫 spot_ 欄位
- `collectInstitutional()`（15:30）用 PATCH 補填現貨欄位，不覆蓋 fut_ 欄位

### lastTradingDay() 邏輯

- `nowTW()` 加 8h，用 `getUTCHours()` 即為台灣時間
- 三層偵測：① Supabase `stock_daily_twse` ② TWSE `STOCK_DAY`（2330）③ fallback 週末跳過
- 全域快取 `_lastTradingDayCache`：同一次執行只呼叫一次

### collectTWSEDaily() openapi 失敗 fallback

- `openapi.twse.com.tw` 失敗（HTML response）時，自動改打舊版端點 `www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json`（回傳 CSV，非 JSON）
- 新增 `parseCSVLine()` / `twseFetchLegacyCSV()` 兩個輔助函式；重試 2 次、間隔 8 秒
- 欄位對應（CSV 無表頭語意，靠固定順序）：`c[1]`=證券代號、`c[2]`=證券名稱、`c[3]`=成交股數、`c[8]`=收盤價、`c[9]`=漲跌價差
- 已用真實抓到的 CSV 資料手動驗算過（台積電、台泥、元大50、瑞祺電通漲停、材料*-KY 特殊符號代號等案例），計算與過濾邏輯均正確
- ⚠️ **`collectSectorIndex`（MI_INDEX）、`collectValuation`（BWIBBU_ALL）尚未加 fallback**：查過 `www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX` 回傳是巢狀多子表格 JSON，跟 openapi 版本（扁平陣列）結構完全不同，沒實際打過無法保證解析正確，怕做出「不報錯但寫入錯誤資料」的更糟情況，先不動；`BWIBBU_ALL` 舊版路徑則還沒查到。之後要做的話，必須先手動打一次 API 看真實回應格式再寫解析邏輯。

### Schema 過渡期（待舊表資料穩定 1~2 個月後刪除）

| 函式 | 舊表（保留） | 新表 |
|------|-----------|------|
| `collectChips()` | `chips_daily` | `market_chips_daily` |
| `collectOptions()` | `options_daily` | `options_analytics_daily` |
| `collectInstitutional()` | `institutional_daily` | `market_chips_daily`（PATCH）|

---

## Alpha 成長系統

### 頭銜規則

| 頭銜 | 條件 |
|------|------|
| 菜鳥交易員 🐣 | 初始 |
| 盤中觀察者 👁️ | ≥10 篇 |
| 資深操盤手 📊 | ≥30 篇 |
| 市場老狐狸 🦊 | ≥100 篇 |
| Alpha 傳奇 👑 | ≥300 篇 |
| 精準狙擊手 🎯 | 準確率 ≥55%（≥10次） |
| 市場預言家 🔮 | 準確率 ≥70% |
| 鐵血操盤手 ⚔️ | ≥100 篇 + 準確率 ≥55% |
| 傳奇預言家 🌟 | ≥300 篇 + 準確率 ≥55% |

### 前端 alpha.js 重要函式

- `_escHtml(str)` — HTML escape（防止 `<` `>` 截斷內容）
- `_renderAccuracyChart(canvasId, thoughts)` — Canvas 折線圖
- `_streakBadge(streak)` — 連勝/連錯徽章
- `_confBadge(conf)` — 信心度標籤

### 弱點自覺 + 動態成長系統

- `alpha_thoughts.market_regime`：每篇記錄生成當下環境（volatile/trending_up/trending_down/consolidating/normal）
- 評分後自動統計最近 60 篇各 regime 命中率（樣本 ≥ 3 才計入）
- `alpha_profile.specialties`：`[{ regime, confidence, rate, total }, ...]` 成功模式物件陣列（Agent 2 每日更新）
- **三層提示同時注入 Agent 3（alpha_thought）+ alpha_analyze**：
  - `weaknessHint`：最弱環境 < 50% → 警示
  - `dynamicWeightHint`（B）：當前環境 < 50% → 強制 confidence「低」；≥ 65% → 正常
  - `successHint`（C）：當前環境符合成功模式 → 提示最佳信心度
- systemPrompt 注入順序：styleHint → streakHint → regimeHint → weaknessHint → dynamicWeightHint → successHint

### 產業輪動 RSM（sector_rsm.js）

- X 軸 RSR = MA10/MA30×100，Y 軸 RSM = 最新RSR÷9期RSR均值×100
- 象限色：右上強勢→紅，左下弱勢→綠
- 基準：發行量加權股價指數；資料來源：`sector_index_daily`
- `heatmapTab` onclick：`showHeatmap();loadSectorRSM()`

---

## 開發慣例

1. 改籌碼只需讀 `chips.js`；改新聞只需讀 `news_feed.js`
2. JS 語法驗證：`node --check file.js`
3. 漲跌色一律 `var(--up)` / `var(--down)`
4. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
5. Supabase 寫入前先對照本文件確認欄位名稱
6. `str_replace` 後務必確認相鄰上下文
7. 新增 `showXxx()` 時，記得在所有其他 `showXxx()` 裡加隱藏新 panel 邏輯
8. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`
9. 三大法人合計：直接加總 `spot_foreign_net + spot_trust_net + spot_dealer_net`（不用 `spot_total_net`）
10. 新功能查詢一律用 `stock_daily_twse`，禁止用 `stock_daily`（已刪）
11. 多 ID 篩選用 `stock_id=in.(2330,2454,...)`，155 支分兩批（各 ~77 支）

## 工程原則

- **Debug**：遇到 bug 必須先看程式碼找根源，不可憑推測直接改。HTTP 500 → Vercel Logs；HTTP 400 → Supabase 欄位問題
- **Security**：API key 只存 Vercel env 或 GitHub Secrets；Groq endpoint 走 `requireOwner()` + `x-owner-token`
- **Supabase**：查詢加 `limit`；Upsert 必須指定 `on_conflict`；schema cache 更新：`NOTIFY pgrst, 'reload schema';`
- **全域變數**：全在 `api.js` 定義（`SUPABASE_URL`、`API_BASE`、`CLAUDE_MODEL` 等）

---

## 待辦

- [ ] 確認新表資料穩定 1～2 個月後再刪舊表（`chips_daily` 今日仍用於補正新表，不可提前刪除）

---

## 對話十五更新（2026-06-26）

- `alphascope_data_analysis.html`：全面更新（資料表 13→15、新增 05b/05c 章節、行動清單 14 項）
- `index.html` + `alpha.js`：30天回測從行內卡片改為 Modal（`alphaBacktestModal`）；`toggleAlphaBacktest()` 開 Modal；新增 `closeAlphaBacktest()`
- `api/news.js`：Alpha 自我成長機制串接（B 動態風控 + C 成功模式），Agent 2 / Agent 3 / alpha_analyze 三端同步注入

## 對話十六更新（2026-06-30）

### 問題發現
`alpha_daily_report`（今日市場情緒，圖1）與 `alpha_thoughts`（Agent 3 隨筆，圖2）方向不一致，使用者誤以為矛盾。
追查後發現根本原因：Agent 3 隨筆的 `prediction` 是「對明天方向的預測」，`pred_date` 被設成隔天，跟 `alpha_daily_report.report_date`（今天）天生對不上日期，等於是在比較「今天的情緒」vs「對明天的預測」，本質上問的是不同問題。

### 修正內容（`api/news.js`，`endpoint === 'alpha_thought'` 區塊）

1. **一般隨筆 `pred_date`**：移除 `+1天` 與跳過週末邏輯，改為直接用台灣當天日期，與 `alpha_daily_report.report_date` 對齊。
2. **systemPrompt / userPrompt 措辭**：「對明天方向的預測」→「對『今天』大盤方向的預測」，避免 LLM 生成內容仍以「明天」措辭（與資料庫日期不符）。
3. **檢討篇（reflection）`pred_date`**：同步移除 `twNext`（隔天）邏輯，改用當天日期；`prediction` 維持固定 `'neutral'`（檢討文本身不具方向判斷意義，純為符合 schema）。

### 資料修正（手動執行於 Supabase）

既有 2 筆 pending 隨筆（id 51, 52）`pred_date` 用台灣時區重新校正：

```sql
UPDATE alpha_thoughts
SET pred_date = (created_at AT TIME ZONE 'Asia/Taipei')::date
WHERE pred_result = 'pending'
  AND angle != 'weekly_recap';
```

⚠️ 注意：`created_at` 是 UTC 時間，必須先轉 `Asia/Taipei` 時區再取日期，否則會差一天（UTC 23:xx 換算台灣時間已經是隔天早上）。

### 注意事項

- 之後新生成的隨筆會直接用「今天」當 `pred_date`，不需再手動修正。
- Agent 2 評分邏輯（`pred_date=lte.今天`）不受影響，本來就相容於「同天評分」設計。

## 對話十七更新（2026-06-30）

### 1. 移除 Alpha 挑戰模式 + 讀者押注系統

- `alpha.js`：刪除整個「讀者押注系統」與「Alpha 挑戰模式」區塊，包含 `_getBet`/`_saveBet`/`renderBetBar`/`placeBet`/`_getChallengeStats`/`_challengeRecord`/`_syncChallengeFromThoughts`/`renderChallengeStats`/`_resetChallenge`/`_injectBetBars`，共約 207 行；同步移除卡片上的 `data-bet-id`/`data-pred-result` 屬性與渲染流程中對 `_injectBetBars` 的呼叫。
- `index.html`：移除 `alphaChallengeStats` 容器 div。
- 兩檔皆已通過 `node --check` / 語法驗證。

### 2. 修正 `alpha_report` 與 `alpha_thought` 方向矛盾問題

**問題**：`alpha_daily_report`（市場情緒報告，由 `collect_market_data.js` 的 `collectAlphaReport()` 生成）與 `alpha_thought`（Agent 3 隨筆）是兩條完全獨立的資料管線與 LLM 判讀邏輯，互不參照，且 Agent 3 疊加了 `weaknessHint`／`dynamicWeightHint` 等風控降溫機制，導致即使底層資料重疊，兩邊結論仍可能方向相反（例如報告樂觀、隨筆謹慎）。

**修正內容**（`api/news.js`，`endpoint === 'alpha_agent1'` 區塊）：

1. Agent 1 的 `Promise.allSettled` 新增一筆查詢，抓取當天 `alpha_daily_report`（`market_mood`／`market_summary`／`dominant_player`），僅當 `report_date` 等於台灣時區今日日期才採用。
2. 抓到的話會多一行 `今日市場情緒報告（alpha_daily_report）｜氛圍：xxx 主導者：xxx 摘要` 寫入 `contextLines`，隨 `agent1_context` 存入 `alpha_profile`，供 Agent 3 讀取。
3. `alpha_thought` 的 systemPrompt 新增提示：若市場狀況中包含「今日市場情緒報告」，隨筆方向不可與報告直接相反；若因風控考量趨於保守，需在內容中簡短說明原因，避免讀者誤以為兩邊矛盾。

**資料來源比對**（`collectAlphaReport()` vs Agent 1）：兩者皆讀 `market_chips_daily`，但 `collectAlphaReport()` 多了總經指標（SOX/DXY/美債/聯準會利率）、PTT 熱門文、產業指數強弱、新聞量較多（30 vs 8）；Agent 1 則多了技術指標（RSI/KD/MACD/MA/布林）與 VIX。選擇權資料表也不同（`options_daily` 舊表 vs `options_analytics_daily` 新表）。

### 注意事項

- `news.js` 改動僅限 `alpha_agent1` 區塊，未影響其他 endpoint。
- 若之後 `alpha_daily_report` 的欄位（`market_mood`/`market_summary`/`dominant_player`）改名或棄用，需同步調整 Agent 1 查詢與 contextLines 組裝邏輯。

## 對話十八更新（2026-07-08）

### 1. `utils.js`：每日 08:30 自動重新整理

在 `utils.js` 尾端新增定時器，每分鐘比對台灣時間（`Asia/Taipei`），偵測到 08:30 時觸發 `location.reload()`，並以 `reloadedDate` 記錄今日已刷新，避免同一天重複觸發。

### 2. `sentiment.js`：修正 BY SOURCE 長條圖百分比計算錯誤

**問題**：BY SOURCE 三色長條圖視覺與右側數字（多/中/空）嚴重不符（例如 PTT 多6中2空2，但空頭綠色佔長條最大塊）。

**根因**：`total` 使用 `sp.length`（該來源所有貼文數），但部分貼文在 AI 分析前 `sentiment` 仍為 `null`，導致分母偏大，三段百分比加起來遠小於 100%，殘差 `ePct = 100 - bPct - nPct` 把所有未分析的空間全歸給空頭（第三段），造成空頭長條異常寬。

**修正**（`sentiment.js` 第 59-62 行）：
- `total` 改為 `bull + neu + bear`（只計算已有 sentiment 的篇數）
- `ePct` 改為 `Math.round(bear/total*100)`，三段各自獨立計算，不再使用殘差

## 對話十九更新（2026-07-09）

### Max Pain 卡片數字與趨勢圖不一致問題

**問題**：Max Pain 卡片主數字（46,400）與近 5 日趨勢圖最新一點（44,700）方向/數值對不上，使用者誤以為矛盾。

**根因**：卡片數字來自 `api/news.js` 的 `endpoint=options`（即時打 FinMind API 現算，有 60 分鐘快取）；趨勢圖數字來自 Supabase `options_analytics_daily` 表（`collect_market_data.js` 於每日 15:30 批次算好寫入）。兩份程式碼各自實作了一套「近週選合約到期日」判斷邏輯，且不一致：

- `collect_market_data.js`：用 `getWeeklyWedExpiry` / `getWeeklyFriExpiry` 直接解析 `contract_code`（如 `202606F3`）算出該合約實際是當月第幾個週三/週五，並有「到期當天（結算日）視為已結算，改用次近合約」的排除判斷。
- `news.js`（修正前）：用 `getNextWeekday` 只算「今天起最近的週三/週五」，未核對合約代碼實際到期日，也完全沒有結算日排除判斷。

兩邊邏輯不同，在特定情況下會選到不同合約去算 Max Pain，導致數字不一致。

**修正內容：**

1. `signals.js`：`renderMaxPainTrend()` 算出趨勢圖最新一筆數值後，回頭覆寫卡片主數字（`maxPainVal` / `ms_maxPain`），確保畫面顯示統一改用 Supabase 批次計算值（與趨勢圖同源）。若 Supabase 資料不足 2 天（`renderMaxPainTrend` 提前 return），卡片維持即時值不覆寫。
2. `api/news.js`（`endpoint === 'options'` 區塊）：將 `getNextWeekday` 換成與 `collect_market_data.js` 完全一致的 `getWeeklyWedExpiry` / `getWeeklyFriExpiry`，直接解析 `contract_code`；並補上「到期當天視為已結算、改用次近合約」的排除判斷（移除原本 `validCandidates[0] || mpCandidates[0]` 的 fallback，因候選清單本身已排除結算日）。

兩檔皆已通過 `node --check` 語法驗證。

### 注意事項

- `signals.js` 的卡片覆寫是雙重保險；`news.js` 的到期日邏輯修正是根因修正。理論上之後即時運算與批次運算應選到同一口合約，數字會一致（前提是抓到的當日 OI 資料本身相同）。
- 若之後兩邊仍偶爾出現微小差異，可能是即時抓取與批次收集之間 FinMind 資料被盤後修正所致，屬正常時間差，非合約選擇邏輯問題。

## 對話二十更新（2026-07-13）

### 問題發現：Collect TWSE 週一早上常失敗

使用者回報 GitHub Actions `Collect TWSE` workflow 週一容易失敗。比對 Actions 執行紀錄：Jul 6（週一）#40/#41/#42 三次（含手動重跑）皆失敗，Jul 7~10（週二~五）#43~#46 全部成功，Jul 13（週一）#47（排程）/#48（手動重跑）又失敗，兩次間隔 2 小時 15 分。

拉 log 比對，兩次失敗（#47 06:44、#48 09:01）錯誤完全一致：`twseDaily`／`sectorIndex`／`valuation` 三支都回傳「HTML response（可能被封鎖或維護中）」，重試 2 次仍失敗；`chips`（走 FinMind/TAIFEX）不受影響。

### 根因排查

`lastTradingDay()` 內部第二層偵測打的是 `www.twse.com.tw/exchangeReport/STOCK_DAY`（舊版網域），在同一次失敗的執行裡是**成功**的——代表壞的不是 TWSE 全站，是 `openapi.twse.com.tw`（新版 OpenAPI v1 子網域）本身。搜尋未找到 TWSE 官方維護公告，根因無法 100% 確認，但已排除「全站掛掉」的可能。

### 修正內容（`collect_market_data.js`）

只針對 `collectTWSEDaily()`（`STOCK_DAY_ALL`）加上 fallback：`openapi.twse.com.tw` 失敗時改打 `www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json`（CSV 格式，欄位順序見上方「collect_market_data.js 重要備忘」）。新增 `parseCSVLine()` / `twseFetchLegacyCSV()`。`sectorIndex`／`valuation` 因舊版端點格式跟 openapi 版差異太大（巢狀多表格 JSON vs 扁平陣列）且未實際驗證過，怕引入「不報錯但資料錯」的風險，這次先不動。

### 驗證

1. 語法驗證 `node --check` 通過
2. 使用者實際觸發一次 workflow（此時 openapi 剛好正常），確認**主要路徑（非 fallback）沒被改壞**，`twseDaily`/`sectorIndex`/`valuation` 皆成功（1198/132/1078 筆）
3. 抓真實 TWSE 舊版 CSV 資料，把 fallback 分支的解析／欄位對應程式碼原封不動拿出來跑，手動驗算多筆案例（台積電、台泥、元大50、瑞祺電通漲停、材料*-KY 特殊符號代號）確認計算與過濾邏輯皆正確
4. ⚠️ **fallback 觸發路徑本身（try/catch 真的走進 catch 分支）尚未在真實失敗情境下驗證過**，需等下次 openapi 真的掛掉時看 log 確認

### 待辦

- [ ] 下次遇到 openapi.twse.com.tw 失敗時，確認 log 有出現「⚠️ openapi.twse.com.tw 失敗...改用舊版端點 fallback...」+「✅ fallback 成功：xxxx 筆」，驗證 fallback 路徑真的有跑
- [ ] 有空手動打一次 `www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=YYYYMMDD&type=ALLBUT0999&response=json` 和 `BWIBBU_ALL` 對應端點，把真實回應貼給 Claude，才能補上 `sectorIndex`／`valuation` 的 fallback

## 對話二十一更新（2026-07-16）

### fallback 路徑實戰驗證成功

Jul 16（週四）06:56 台灣時間執行再次觸發 `openapi.twse.com.tw` 失敗，log 完整印出預期訊息：

```
⚠️  openapi.twse.com.tw 失敗（HTML response（可能被封鎖或維護中）），改用舊版端點 fallback…
✅ fallback 成功：1198 筆
✅ stock_daily_twse：1198 筆 upserted
```

「對話二十」待辦的第一項（驗證 fallback 真的有走進 catch 分支）確認完成，`collectTWSEDaily` fallback 機制正式驗證有效。

### 新發現：失敗不限週一

這次失敗發生在週四，推翻「只有週一早上會失敗」的假設（原本只有 Jul 6、Jul 13 兩個週一樣本，樣本數太少）。已同步更新上方「已知問題」段落敘述。

`sectorIndex`／`valuation` 兩支這次依然直接失敗（尚未加 fallback），`chips`（FinMind/TAIFEX）不受影響。

### 待辦

- [ ] 補上 `collectSectorIndex`／`collectValuation` 的 fallback（等待使用者提供 `MI_INDEX`／`BWIBBU_ALL` 舊版端點真實回應）
