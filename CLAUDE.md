# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-06-26（對話十五）
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
- `renderBetBar(thoughtId, alphaPrediction, predResult)` — 押注欄 HTML
- `placeBet(thoughtId, direction, alphaPrediction)` — 全域函式（onclick 用，**不可改名**）
- `_injectBetBars(normalList)` — 批次注入押注欄 + 同步挑戰統計
- `renderChallengeStats()` — 挑戰模式面板
- `_resetChallenge()` — 全域函式（**不可改名**）

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
