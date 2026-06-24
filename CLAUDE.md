# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-06-24（對話十二）
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。
> 歷史改動請見 GitHub commit history。

-----

## 🔴 Claude 操作規則（必讀）

1. **使用者傳原始檔案給 Claude，Claude 修改後用 `present_files` 生成下載連結，由使用者自行上傳 GitHub。**
1. 每次對話結束前（使用者主動要求），更新 CLAUDE.md，用 `present_files` 生成下載連結，並附上建議的 commit message，由使用者自行上傳。
1. CLAUDE.md 只記錄當前狀態；歷史改動以 GitHub commit history 為準。
1. ⚠️ **Claude 不使用任何 MCP push 功能，一律生成檔案讓使用者手動上傳。**
1. ⚠️ **文件更新（CLAUDE.md）只在使用者主動要求切換新對話時才執行，平時不主動生成。**
1. **Commit message 必須 50 字元以內**（GitHub 規範）。超過時拆成 subject + extended description。

-----

## ⚠️ 已知問題

- **FinMind `TaiwanStockTotalInstitutionalInvestors` 資料延遲**：有時回傳全 0，`collectInstitutional()` 已加防呆，全零時略過不寫入，避免蓋掉 TWSE 已正確寫入的數字。

### 對話十二新增（2026-06-24）

- **多 Agent 分工重構**：`api/news.js` 新增 `alpha_agent1`、`alpha_agent2` 兩個 endpoint；`alpha_thought` 改為讀 agent1/2 快取，不再自己抓資料。
- **`alpha_profile` 新增欄位**（已執行 migration）：
  ```sql
  ALTER TABLE public.alpha_profile
    ADD COLUMN agent1_context       jsonb        NULL,
    ADD COLUMN agent1_market_regime text         NULL,
    ADD COLUMN agent1_updated_at    timestamptz  NULL,
    ADD COLUMN agent2_wrong_items   jsonb        NULL DEFAULT '[]'::jsonb,
    ADD COLUMN agent2_streak        integer      NULL DEFAULT 0,
    ADD COLUMN agent2_updated_at    timestamptz  NULL;
  ```
- **`alpha_thought.yml` 簡化**：移除 02:00/14:30/20:00 時段，只保留 08:00 完整跑三個 Agent（依序）+ 週五 16:00 週報。

### 對話十一新增（2026-06-22）

- **collect_market_data.js**：`lastTradingDay()` 從 sync 改為 **async**，新增國定假日動態偵測（三層）：
  1. 查 Supabase `stock_daily_twse`（TAIEX）確認候選日有無資料
  2. 呼叫 TWSE `STOCK_DAY`（2330）取當月最後一筆交易日期（民國年自動轉換）
  3. Fallback 回原本週末跳過的候選日
- **全域快取** `_lastTradingDayCache`：同一次執行只呼叫一次外部 API
- 所有呼叫 `lastTradingDay()` 的地方均已加 `await`（共 5 處）
- `collectInstitutional()`：新增非交易日跳過邏輯（`daysDiff > 1` 時 `ok: true` 略過，不拋錯）
- **髒資料清理**：6/19 假日被誤寫，需執行以下 SQL：
  ```sql
  DELETE FROM stock_daily_twse      WHERE date = '2026-06-19';
  DELETE FROM sector_index_daily    WHERE date = '2026-06-19';
  DELETE FROM stock_valuation_daily WHERE date = '2026-06-19';
  DELETE FROM chips_daily           WHERE date = '2026-06-19';
  DELETE FROM market_chips_daily    WHERE date = '2026-06-19';
  ```

### 對話十新增（2026-06-18）

- **collect_market_data.js**：`collectOptions()` 修正月選/週三選/週五選到期當天（結算日）排除邏輯。到期日與 `tradeDate` 相同時，視為已結算略過，改用下一個最近合約計算 Max Pain。
- **api/news.js（alpha_analyze）**：`userPrompt` 新增 `【技術面指標（加權指數）】` 區塊，後端即時自算 RSI14/KD/MACD/MA5.20/布林，注入給 Groq 生成 `market_summary`；`market_summary` prompt 從 50 字改為 80 字，要求涵蓋技術面訊號（RSI/KD/MA）。

### Alpha 弱點自覺系統（2026-06-17）

- `alpha_thoughts` 新增 `market_regime` 欄位：每篇隨筆記錄生成當下的市場環境
- `alpha_profile` 新增 `weakness_analysis`（jsonb）+ `weakest_regime`（text）
- 評分完後（批次3之後）自動撈最近 60 篇已評分隨筆，交叉統計各 regime 命中率（樣本 ≥ 3 才計入）
- 弱點注入 system prompt：若最弱環境命中率 < 50%，依當下是否為弱環境給出不同提示
- 前端 `alpha.js` profileCard 新增「🧠 各市場環境命中率」進度條區塊（需 ≥ 2 種環境才顯示）

### Alpha tab 獨立（2026-06-11）

- `alphaTraderSection` + `alphaThoughtsSection` 已從 `signalPanel` 移出，包成獨立 `alphaPanel`
- 新增 `🤖 Alpha` tab 按鈕，`showAlpha()` inline script 在 index.html
- 所有 `showXxx()` 已加隱藏 `alphaPanel` 邏輯
- `showSignal()` 移除 `initAlphaIfNeeded()`（Alpha 不再跟多空訊號一起載入）
- `_hideAlphaPanel()` helper 定義在 signals.js 頂部

### options endpoint 法人資料備註

- FinMind `TaiwanOptionInstitutionalInvestors` 盤後才更新，盤中法人欄位全 null
- `api/news.js` 已加 Supabase fallback：法人全 null 時自動從 `options_analytics_daily` 撈最近有值的一筆

### TMF 散戶多空比歷史資料備註（2026-06-09）

- 5/19、5/20 的 `fut_tmf_total_oi` 為 null，已在 `api/news.js` 加 `.filter(d => d.fut_tmf_total_oi != null)` 過濾，不顯示於圖表

-----

## 待辦

- [ ] 確認新表資料穩定 1～2 個月後再刪舊表（`chips_daily` 今日仍用於補正新表資料，不可提前刪除）

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
1. Claude 修改完成後用 `present_files` 生成下載連結
1. 使用者下載後自行上傳到 GitHub

-----

## 本地工作檔案路徑

> ⚠️ **2026-05-29 重大架構變更：index.html 已拆分為獨立 JS/CSS 檔案**

|檔案                      |Claude 工作路徑                                |部署位置                                    |
|------------------------|-------------------------------------------|----------------------------------------|
|前端主檔                    |`/home/claude/alphascope/index.html`       |`index.html`                            |
|共用樣式                    |`/home/claude/alphascope/css/style.css`    |`css/style.css`                         |
|Supabase/全域變數           |`/home/claude/alphascope/js/api.js`        |`js/api.js`                             |
|新聞渲染                    |`/home/claude/alphascope/js/news_feed.js`  |`js/news_feed.js`                       |
|社群情緒                    |`/home/claude/alphascope/js/sentiment.js`  |`js/sentiment.js`                       |
|股東紀念品                   |`/home/claude/alphascope/js/gifts.js`      |`js/gifts.js`                           |
|台股熱圖                    |`/home/claude/alphascope/js/heatmap.js`    |`js/heatmap.js`                         |
|多空訊號 + Max Pain趨勢 + 部位風險|`/home/claude/alphascope/js/signals.js`    |`js/signals.js`                         |
|個股 Modal                |`/home/claude/alphascope/js/stock_modal.js`|`js/stock_modal.js`                     |
|Alpha 交易室               |`/home/claude/alphascope/js/alpha.js`      |`js/alpha.js`                           |
|估值/回測                   |`/home/claude/alphascope/js/valuation.js`  |`js/valuation.js`                       |
|籌碼面板                    |`/home/claude/alphascope/js/chips.js`      |`js/chips.js`                           |
|自選股                     |`/home/claude/alphascope/js/watchlist.js`  |`js/watchlist.js`                       |
|SW/PWA                  |`/home/claude/alphascope/js/utils.js`      |`js/utils.js`                           |
|Vercel API              |`/home/claude/news.js`                     |`api/news.js`                           |
|K 線圖                    |`/home/claude/chart.html`                  |`chart.html`（獨立頁面）                      |
|每日收集腳本                  |`/home/claude/collect_market_data.js`      |`.github/scripts/collect_market_data.js`|
|備份腳本                    |`/home/claude/backup.js`                   |`.github/scripts/backup.js`             |
|紀念品爬蟲                   |`/home/claude/scrape_gifts.js`             |`.github/scripts/scrape_gifts.js`       |
|紀念品排程                   |`/home/claude/scrape_gifts.yml`            |`.github/workflows/scrape_gifts.yml`    |
|eGift 爬蟲                |`/home/claude/scrape_egift.js`             |`.github/scripts/scrape_egift.js`       |
|eGift 排程                |`/home/claude/scrape_egift.yml`            |`.github/workflows/scrape_egift.yml`    |
|PWA SW                  |`/home/claude/service-worker.js`           |`service-worker.js`                     |
|PWA Manifest            |`/home/claude/pwa/manifest.json`           |`manifest.json`                         |
|紀念品後台                   |`gifts-admin.html`                         |`gifts-admin.html`（Vercel 公開）           |

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

|函式                             |說明                                                |
|-------------------------------|--------------------------------------------------|
|`loadMktSignals()`             |多空訊號儀表板主函式                                        |
|`loadOptions()`                |選擇權面板（側欄）                                         |
|`openStockModal()`             |個股 Modal（bar chart，已移除 iframe）                    |
|`_loadModalBarChart()`         |K線 bar chart（Supabase 收盤走勢）                       |
|`_loadModalStats()`            |歷史統計摘要（非同步）                                       |
|`closeStockModal()`            |關閉 Modal                                          |
|`runStockAI()`                 |AI 個股快速研究                                         |
|`renderMaxPainTrend(id)`       |Max Pain 近5日趨勢圖（weekly_fri→weekly_wed→monthly 優先序）|
|`renderRiskOverview(positions)`|Alpha 部位風險總覽 + 個別進度條                              |
|`loadTechnicalSignal()`        |大盤技術面卡片（RSI/KD/MACD/MA/布林），自動建立容器插入 signalPanel 底部；技術快照寫入 sessionStorage('tech_signal_cache')|

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

|表名                       |來源               |內容                            |每日筆數     |備註   |
|-------------------------|-----------------|------------------------------|---------|-----|
|`stock_daily_twse`       |TWSE OpenAPI     |全上市股票收盤、成交量；含 stock_id='TAIEX'|~1231    |     |
|`stock_valuation_daily`  |TWSE OpenAPI     |本益比、股價淨值比、殖利率                |~1231    |     |
|`sector_index_daily`     |TWSE OpenAPI     |產業指數（35 個產業）                 |~35      |     |
|`market_chips_daily`     |TWSE + FinMind   |三大法人現貨＋台指期＋散戶TMF             |1        |新表  |
|`chips_daily`            |FinMind          |三大法人（舊表，過渡期保留）              |~1231    |待刪  |
|`options_analytics_daily`|FinMind          |選擇權 PC Ratio / Max Pain       |~3       |新表  |
|`options_daily`          |FinMind          |選擇權明細（舊表）                    |多        |待刪  |
|`institutional_daily`    |FinMind          |法人舊表                         |~1231    |待刪  |
|`margin_daily`           |FinMind          |融資融券                         |1        |     |
|`news_daily`             |RSS + TheNewsAPI |財經新聞（中英文）                    |~50/日    |     |
|`alpha_thoughts`         |Groq             |Alpha 隨筆（含預測/評分/信心度）         |4/日      |     |
|`alpha_profile`          |系統維護            |Alpha 成長檔案（頭銜/命中率/弱點）        |1（id=1） |     |
|`alpha_analyze`          |Groq             |個股/大盤 AI 分析報告               |1/日      |     |
|`stock_gifts`            |爬蟲              |股東紀念品                        |不定      |     |
|`egift_items`            |爬蟲              |電子禮券                         |不定      |     |

### alpha_profile schema（2026-06-24 更新）

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
  -- Agent 快取欄位（對話十二新增）
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

### 歷史 Schema Migration

```sql
-- 對話8
ALTER TABLE alpha_thoughts ADD COLUMN IF NOT EXISTS market_regime text;
ALTER TABLE alpha_profile ADD COLUMN IF NOT EXISTS weakness_analysis jsonb DEFAULT '{}'::jsonb;
ALTER TABLE alpha_profile ADD COLUMN IF NOT EXISTS weakest_regime text;
-- 對話十二
ALTER TABLE public.alpha_profile
  ADD COLUMN agent1_context jsonb NULL,
  ADD COLUMN agent1_market_regime text NULL,
  ADD COLUMN agent1_updated_at timestamptz NULL,
  ADD COLUMN agent2_wrong_items jsonb NULL DEFAULT '[]'::jsonb,
  ADD COLUMN agent2_streak integer NULL DEFAULT 0,
  ADD COLUMN agent2_updated_at timestamptz NULL;
```

### market_chips_daily 資料修正紀錄

- **2026-06-08**：5/29～6/5 的 `spot_foreign_net / trust_net / dealer_net` 曾因 TWSE MI_INST 欄位解析失敗被寫成 0，已用 SQL `buy-sell` 反算補正。
- **2026-06-10**：6/3～6/8 的 spot 欄位因 FinMind 資料延遲回傳 0，已用 SQL 從 `chips_daily` 舊表複製補正。

-----

## GitHub Actions Workflows

|檔案                   |觸發                  |功能                                                   |狀態     |
|---------------------|--------------------|-----------------------------------------------------|-------|
|`collect-twse.yml`   |週一~五 14:30          |TWSE 股價/估值/產業指數 + `collectChips()`（現貨失敗不覆蓋，只寫期貨）     |✅      |
|`collect-finmind.yml`|週一~五 15:30          |FinMind 籌碼/選擇權/期貨；`collectInstitutional()` PATCH 現貨欄位|✅      |
|`collect-alpha.yml`  |FinMind 完成後觸發       |Alpha 每日報告（`alpha_analyze` endpoint）                 |✅      |
|`collect-news.yml`   |每小時                 |財經新聞 RSS                                             |✅      |
|`backup.yml`         |週日 09:00 + push main|Supabase + pCloud 備份                                 |✅      |
|`scrape_gifts.yml`   |手動                  |爬股東紀念品                                               |✅（停用自動）|
|`scrape_egift.yml`   |每週日 09:30           |爬 eGift                                              |✅      |
|`alpha_thought.yml`  |週一~五 08:00 + 週五16:00週報|三 job 依序：Agent1→Agent2→Agent3（撰稿）             |✅      |

### alpha_thought.yml 三 Job 架構（對話十二）

```
agent1（市場資料員）→ agent2（分析師）→ agent3（撰稿員）
```

- Agent 1：抓 8 項市場資料 + 技術指標 + 市場環境感知 → 存 `alpha_profile.agent1_*`
- Agent 2：評分昨日預測 + 弱點分析 + 生成檢討篇 → 存 `alpha_profile.agent2_*`
- Agent 3：讀 agent1/2 快取 → 生成隨筆 → 寫入 `alpha_thoughts`
- 任一 Agent 失敗，後續 job 停止（`if: success()`）

-----

## Alpha 成長系統（2026-06-10 全面升級）

### 頭銜規則（篇數 × 準確率雙維度）

| 頭銜        | 條件                        |
|-----------|---------------------------|
| 菜鳥交易員 🐣  | 初始                        |
| 盤中觀察者 👁️ | ≥10 篇                     |
| 資深操盤手 📊  | ≥30 篇                     |
| 市場老狐狸 🦊  | ≥100 篇                    |
| Alpha 傳奇 👑 | ≥300 篇                   |
| 精準狙擊手 🎯  | 準確率 ≥55%（≥10次預測）          |
| 市場預言家 🔮  | 準確率 ≥70%                  |
| 鐵血操盤手 ⚔️  | ≥100 篇 + 準確率 ≥55%         |
| 傳奇預言家 🌟  | ≥300 篇 + 準確率 ≥55%         |

### 後端邏輯（api/news.js）— 對話十二重構後

每天 08:00 依序執行三個 Agent endpoint：

**alpha_agent1（POST）：**
1. 並行抓取 8 項市場資料（加權指數、籌碼、融資、選擇權、FGI+VIX、熱門股、新聞）
2. 後端自算 TAIEX 近120天技術指標（RSI14/KD/MACD/MA5.20.60/布林）
3. 市場環境感知（volatile/trending_up/trending_down/consolidating/normal）
4. 結果存入 `alpha_profile.agent1_context`、`agent1_market_regime`、`agent1_updated_at`

**alpha_agent2（POST）：**
1. 讀 agent1 輸出確認今日已執行
2. 評分所有 pending 預測（分流 TAIEX/個股）
3. 弱點分析（最近60篇各 regime 命中率）
4. 若有 wrongItems → 生成 `angle=reflection` 檢討篇
5. 計算 streak
6. 結果存入 `alpha_profile.agent2_wrong_items`、`agent2_streak`、`agent2_updated_at`

**alpha_thought（POST，Agent 3 撰稿員）：**
1. 讀 `alpha_profile` 的 agent1/2 快取（contextLines、marketRegime、wrongItems、streak）
2. 風格自我分析（每10篇）
3. AI 生成隨筆 JSON
4. 寫入 `alpha_thoughts` + 更新 `alpha_profile`

**endpoint=weekly_recap（批次1）：**
- GET：撈最新一篇 `angle=weekly_recap` 隨筆
- POST（需 x-owner-token）：統計本週命中率、最精準一筆，AI 生成週報文字，寫入 alpha_thoughts

### 前端顯示（js/alpha.js）— 批次 2~4 完整版

**頭銜卡片：**
- 頭銜 + streak 徽章（連中≥5 🔥神準週、連中3-4 連中N次、連錯≤-3 🔍反省中）
- 市場環境標籤（volatile紅/trending_up紅/trending_down綠/consolidating橙）（批次4）
- 命中率百分比、進度條、距下一頭銜篇數
- 專長標籤列（紫色膠囊，批次4）
- 準確率趨勢折線圖（Canvas，滾動10篇，55%基準線）（批次2）
- 信心度分布三色進度條（高/中/低）（批次2）
- style_memo（斜體）

**週報卡片**（批次2）：週報卡在 profile 卡下方、一般隨筆上方，橙色邊框

**隨筆卡片：**
- 信心度標籤（高/中/低）（批次1）
- 高信心預測失誤特別標示「✗ 高信打臉」（批次2）
- 反省模式檢討篇：`angle=reflection`，橙色邊框 + 📝 檢討篇標籤（批次3）
- pred_target 非 TAIEX 時顯示「預測標的：2330」（批次4）
- **押注欄**（批次3）：每篇底部可選↑/↓/→，localStorage 記錄，收盤後自動顯示「你✓ vs Alpha✗」結果
- `data-bet-id` + `data-pred-result` 屬性供 `_injectBetBars()` 定位

**挑戰模式**（批次3，`#alphaChallengeStats` 容器）：
- 我的命中率 vs Alpha 命中率即時對比
- 差距 >5% 給出評語
- 重置紀錄按鈕
- 全部 localStorage，函式：`_getChallengeStats()` / `_syncChallengeFromThoughts(list)` / `renderChallengeStats()`

**alpha.js 新增工具函式：**
- `_renderAccuracyChart(canvasId, thoughts)` — Canvas 折線圖
- `_streakBadge(streak)` — 連勝/連錯徽章
- `_confBadge(conf)` — 信心度標籤
- `renderBetBar(thoughtId, alphaPrediction, predResult)` — 押注欄 HTML
- `placeBet(thoughtId, direction, alphaPrediction)` — 全域函式（onclick 用）
- `_injectBetBars(normalList)` — 批次注入押注欄 + 同步挑戰統計
- `renderChallengeStats()` — 渲染挑戰模式面板
- `_resetChallenge()` — 全域函式（重置按鈕用）

-----

## collect_market_data.js 重要備忘

### contract_date 格式

- 月選：`202606`（regex: `/^[0-9]{6}$/`）
- 週三：`202606W1`（regex: `/^[0-9]{6}W[1245]$/`）
- 週五：`202606F1`（regex: `/^[0-9]{6}F[1-5]$/`）

### collectOptions() 邏輯

1. 日盤過濾：排除 `after_market`
1. Max Pain：最近到期合約；**到期當天（結算日）視為已結算，不納入**，改用次近合約
1. 移除：`pc_ratio_vol`、`foreign_opt_net`

### collectChips() 現貨欄位策略（2026-06-08 修正）

- `toB(n)` 解析到 n===0 → 回傳 null，避免覆蓋後續 FinMind 正確值
- TWSE MI_INST / BFIA01 失敗 → spotOK=false → fallback FinMind
- 全失敗時：`market_chips_daily` 只寫期貨欄位，不寫 spot_ 欄位
- `collectInstitutional()`（15:30）用 PATCH 逐筆補填現貨欄位，不覆蓋 fut_ 欄位
- ⚠️ 防呆：FinMind 回傳全零時略過不寫入（避免蓋掉 TWSE 正確值）

### lastTradingDay() 時區修正（2026-06-11）

- 舊版用 `getUTCHours()` 讀原始 UTC 時間（22），導致早上 06:00 執行時不退一天，抓當天（TWSE 無資料）
- 修正：`nowTW()` 已加 8h，`getUTCHours()` 即為台灣時間；`setDate/getDay` 改為 `setUTCDate/getUTCDay`
- `collectInstitutional()` 改用 `lastTradingDay()` 只抓單日，不再 `daysAgo(5)` 跨區間

### Schema 雙寫過渡期

|                        |舊表（保留）               |新表                              |
|------------------------|---------------------|--------------------------------|
|`collectChips()`        |`chips_daily`        |`market_chips_daily`            |
|`collectOptions()`      |`options_daily`      |`options_analytics_daily`       |
|`collectInstitutional()`|`institutional_daily`|`market_chips_daily`（PATCH 現貨欄位）|

`sbUpsert()` 支援陣列 onConflict：`['date','contract_type']` 自動轉逗號。

-----

## alpha.js 已修 bug（2026-06-11）

- **Canvas 空白**：`rated.length < 2` 時 `offsetWidth=0`，改用 `offsetWidth || 240` 設定實際尺寸再繪製
- **信心分布條全滿**：`flex:0` 撐滿問題，改用 `width: N%`（根據 confTotal 計算比例），外層加底色

## 開發慣例

1. 改籌碼只需讀 `chips.js`；改新聞只需讀 `news_feed.js`
1. JS 驗證：`node --check file.js`
1. 漲跌色一律 `var(--up)` / `var(--down)`
1. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
1. Supabase 寫入前先對照本文件確認欄位名稱
1. `str_replace` 後務必確認相鄰上下文
1. 新增 show 函式時，記得在其他所有 `showXxx()` 函式裡加上隱藏新 panel 的邏輯
1. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`
1. **alpha.js 押注欄**：`placeBet()` 和 `_resetChallenge()` 是全域函式，HTML onclick 直接呼叫，不可改名

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
