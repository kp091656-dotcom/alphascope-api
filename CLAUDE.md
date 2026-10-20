# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-10-20（對話二十九，chg_pct 單位三處修正 + Alpha 歷史評分重算 + 氣候分類器 v1 shadow + cron 改非整點）
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 🔴 Claude 操作規則

1. 使用者傳原始檔案給 Claude，Claude 修改後用 `present_files` 生成下載連結，由使用者自行上傳 GitHub。
2. 每次對話結束前（使用者主動要求），更新 CLAUDE.md，用 `present_files` 生成下載連結，並附上建議的 commit message。
3. CLAUDE.md 只記錄當前狀態；歷史改動以 GitHub commit history 為準。
4. ⚠️ Claude 不使用任何 MCP push 功能，一律生成檔案讓使用者手動上傳。
5. ⚠️ CLAUDE.md 只在使用者主動要求切換新對話時才更新。
6. Commit message 必須 50 字元以內（超過拆 subject + body）。
7. ⚠️ 因為 repo 是 public，Claude 可主動用 `raw.githubusercontent.com` 抓取檔案內容來對照除錯（不用每次都等使用者手動上傳），使用者已於「對話二十六」確認傾向維持這個做法。⚠️ **對話二十七實測限制**：WebFetch 抓 `github.com/.../raw/...` 會回 `ROBOTS_DISALLOWED`，抓 `blob` 頁面對大檔只顯示前約 1000 行（`api/news.js` 共 2865 行，後半段讀不到）。需要看大檔後半段時，請使用者貼 `grep -n "關鍵字" api/news.js` 的結果或直接上傳檔案，不要硬繞過。
8. ⚠️ **改 `api/news.js` 一律從 GitHub main 最新版出發，不要用本機放很久的副本**（對話二十八：8/14 就是舊副本蓋掉了 agent 功能，見「對話二十八更新」）。上傳前看 commit 的 diff 行數增減是否合理（該次是 −606 行）。
9. 需要查歷史時，Claude 可用 `add_repo`（read）取得唯讀存取後 `git clone` 完整歷史（613 commits，實測可行），用 `git log -S"關鍵字" -- 檔案` 找出加入／移除關鍵字的 commit，再用 `git show <commit>^:檔案 | grep -c 關鍵字` 比對前後版本。預設 clone 是 `--depth 1`，要歷史請先 `git fetch --depth=1000 origin main`。
10. ⚠️ **改檔流程（對話二十九實測）**：`add_repo`（read）→ clone 到 `/home/claude/kp091656-dotcom/alphascope-api`（讀得到 `api/news.js` 全文）→ 改檔 → `node --check`／YAML `safe_load`／`bash -n` → 用模擬 `fetch` 呼叫 handler 驗證邏輯 → 複製到輸出目錄並 `SendUserFile`。repo 唯讀，不 commit／push。Stop hook 會提醒「有未提交變更」，改完用 `git fetch origin main && git reset --hard origin/main` 清掉暫存 clone（先確認與使用者已上傳的版本一致，不會遺失內容）。
11. 使用者上傳前可用 GitHub 網頁 Edit → Preview changes（commit 前）或 commit 頁的 `+N −N`（commit 後）檢查 diff 行數是否合理。

---

## ⚠️ 已知問題

- **FinMind `TaiwanStockTotalInstitutionalInvestors` 資料延遲**：有時回傳全 0，`collectInstitutional()` 已加防呆，全零略過不寫入。
- **BFIAMU**：`⚠️ BFIAMU 無匹配資料` 屬正常 warning，不中斷主流程。
- **openapi.twse.com.tw 偶爾整批回傳 HTML（維護中），不限週一**：`collectTWSEDaily`／`collectSectorIndex`／`collectValuation` 三支都打這個網域。曾在 Jul 6、Jul 13 兩個週一失敗（含手動重跑仍失敗，持續 2 小時以上），**Jul 16（週四）早上又失敗一次**，證實不是「週一限定」，樣本太少導致之前誤判規律。根因未 100% 確認（找不到官方維護公告），但同時間 `www.twse.com.tw`（舊版網域）是正常的。`collectTWSEDaily` 的 fallback（見「對話二十」）已於 Jul 16 實戰驗證成功（log 出現預期訊息，1198 筆 upsert）。`collectSectorIndex`／`collectValuation` 已於「對話二十一」補上 fallback，但**尚未在真實失敗情境下驗證過**（只用截圖資料離線模擬過解析邏輯），需要時再手動重跑觀察 log。
- ~~`alpha_profile.specialties` 被 Agent 2 覆寫成物件陣列，畫面顯示 `[object Object]`／市場環境代碼~~：已於「對話二十二」修正，改用獨立的 `success_patterns` 欄位，`specialties` 只留給 Agent 3 寫入專長字串。
- **`collect_market_data.js` 的 Alpha 報告生成 Groq prompt，目前離 TPM 上限緩衝不算多**：詳見「對話二十四」，已把股票表格從 50 檔精簡欄位（拿掉 PB/殖利率）、`max_tokens` 降到 3000，估算約落在 7000/8000 TPM，緩衝約 1000。若之後新聞則數增加、個股名稱變長，或想加回 PB/殖利率，有可能再次觸發 413，屆時可考慮：① 進一步精簡 prompt ② 升級 Groq Dev Tier。
- **PTT JSON API（`ptt.cc/api/board/Stock/index`）持續 404 屬預期行為，非 bug**：PTT 從未提供正式穩定的公開 JSON API，這個端點本來就是非官方/實驗性質，說不通就不通。程式已有兩層防呆（JSON 失敗 → fallback 抓 HTML 頁面解析 → 都失敗才顯示「無法取得」），目前 HTML fallback 運作正常，不影響報告產出。若想省一次無謂的 fetch，可考慮直接拿掉 JSON 嘗試、只留 HTML 解析（尚未執行，待使用者確認是否要做）。
- ~~`heatmap.js` 新功能（產業貢獻拆解）展開全部顯示「無個股資料」~~：已於「對話二十五」修正，見下方章節。**通用提醒**：`heatmap.js` 內的全域變數 `heatmapData` 疑似用 `let` 宣告（非 `var`），**不會**自動掛在 `window` 物件上，之後在這個檔案裡新增功能時，一律用裸變數 `heatmapData` 存取，不要寫成 `window.heatmapData`（會拿到 `undefined`）。
- ~~`alpha_thoughts` 停更 15 天（8/16 後無新資料），GitHub Actions 卻顯示綠燈~~：已於「對話二十六」修正，見下方章節。**通用提醒**：`api/news.js` 裡任何寫死 Groq 模型名稱的呼叫點，日後 Groq 停用模型時要**逐一盤點全檔案**（`grep -n "model: '"`），不要只改「這次踩雷的那一個」——對話二十三/二十四只改了 `collect_market_data.js` 和通用 proxy，漏了 `alpha_thought` 系列與 `alpha_analyze` 共 6 處，導致問題延遲兩週才被發現。`market_regime` 欄位為 `null` 的問題已於「對話二十八」查明並修復（原因是 8/14 回歸，不是既有行為）。
- ~~Alpha 頁「本週總結」停在 65 天前（`weekly_recap` 只產生過 id 86、92 兩筆，8/14 後再無）~~：已於「對話二十七」修正（`alpha_thought.yml` 週報判斷由「UTC 小時 = 08」改為依觸發來源），手動補跑已成功（id 134）。**待驗證**：2026-10-23（週五）16:00 台灣時間的自動觸發路徑，見「對話二十七更新」。
- **Groq 429（TPM 暫時超額）**：Run #122、#156 都發生過。#156 的回應顯示 `openai/gpt-oss-20b` TPM 上限 8000、當分鐘已用 6667、此次需 1477、等約 1.08 秒即可。對話二十八起 `alpha_thought` 與 `weekly_recap` 已用 `groqFetch()` 自動重試（最多 2 次、需等 >8 秒則不重試）；額度為帳號共用，前端翻譯／簡報與其他 workflow 也會用到。若仍頻繁失敗，可考慮 Groq Dev Tier 或 AIAutoStocks 式的多 key 輪替。同一事件也是 `alpha_thought.yml` 失敗偵測的實戰驗證（job 如預期變紅）。
- ~~程式碼與文件可能不一致，待確認~~：已於「對話二十八」查明並修復——原因是 8/14 commit `551fb2f` 以舊檔蓋掉 `news.js`，不是文件寫錯。
- **8/14～10/19 期間的資料空缺**：`alpha_thoughts.market_regime` 在這段時間為 NULL，agent1／agent2 也沒有真正執行；各環境命中率（近 60 篇統計）需重新累積一陣子才準。詳見「對話二十八更新」。
- **`chg_pct` 是小數（0.0122 = +1.22%），不是百分比**：對話二十九發現三處當成百分比使用——Agent 1 顯示（少 100 倍）、Agent 1 regime 判斷（另有全形／半形括號 regex 比對不到，結果幾乎恆為 `consolidating`）、Agent 2 評分（自 6/10 起拿小數比 `0.3`，實際漲跌幾乎永遠被判 neutral）。三處皆已修正；歷史評分已用 `rescore_alpha_thoughts.sql` 重算，命中率由 81% 降到約 22%（27/123）。詳見「對話二十九更新」§5。**之後任何用到 `chg_pct` 的新程式，先確認單位**。
- **舊 `market_regime` 標籤不可靠、新舊語意不同**：`alpha_thoughts.market_regime` 在對話二十九修正前由有 bug 的規則標記（幾乎都是 `consolidating`，或 8/14～10/19 為 NULL）。近 60 篇各環境命中率要數週後才有參考價值；目前整體命中率只有約 22%，各環境（樣本 ≥3）幾乎都 <50%，`dynamicWeightHint` 會一律強制信心度「低」——是如實反映資料，不是 bug，但文章語氣會偏保守。
- **GitHub `schedule` 事件常延遲約 2 小時**：10/19～10/20 實測 Collect TWSE 晚 1 小時 54 分～2 小時 53 分。對話二十九把 cron 改成非整點（見「對話二十九更新」§1），是否改善待觀察。下游 `Collect Alpha Report`、`Alpha 隨筆生成` 以 `workflow_run` 串接，會連帶延後。
- **`stock_daily_twse` 的 TAIEX `volume` 一律為 0**（`collectSectorIndex` 寫入時 `volume: 0`），沒有指數量能；氣候分類器 v1 因此沒有量能特徵。

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
| `collect-twse.yml` | 週一~五 06:17（台灣時間；cron `17 22 * * 0-4`，UTC 前一天 22:17；實際常延遲約 2 小時） | TWSE 股價/估值/產業指數 + `collectChips()`，收的是上一個交易日資料 | ✅ |
| `collect-finmind.yml` | 週一~五 06:47（cron `47 22 * * 0-4`；同上會延遲） | FinMind 籌碼/選擇權/期貨；PATCH 現貨欄位 | ✅ |
| `collect-alpha.yml` | FinMind 完成後觸發 | Alpha 每日報告（`alpha_analyze` endpoint） | ✅ |
| `collect-news.yml` | 每小時 | 財經新聞 RSS | ✅ |
| `backup.yml` | 週日 09:00 + push main | Supabase + pCloud 備份 | ✅ |
| `scrape_gifts.yml` | 手動 | 爬股東紀念品 | ✅（停用自動）|
| `scrape_egift.yml` | 每週日 09:30 | 爬 eGift | ✅ |
| `alpha_thought.yml` | Collect Alpha Report 完成後 + 週五 16:00（cron `0 8 * * 5`，`schedule` 事件→週報）+ 手動（`mode=weekly` 可補跑週報） | 三 job：Agent1→Agent2→Agent3 | ✅（週五自動路徑待 10/23 驗證）|

### alpha_thought.yml 三 Job 架構

```
agent1（市場資料員）→ agent2（分析師）→ agent3（撰稿員）
```

- **Agent 1**：抓 8 項市場資料 + 技術指標 + 市場環境感知 → 存 `alpha_profile.agent1_*`
- **Agent 2**：評分昨日預測 + 弱點分析 + 生成檢討篇 → 存 `alpha_profile.agent2_*`
- **Agent 3**：讀 agent1/2 快取 → 生成隨筆 → 寫入 `alpha_thoughts`
- 任一 Agent 失敗，後續 job 停止（`if: success()`）
- Agent 1／2 對應 `api/news.js` 的 `alpha_agent1`／`alpha_agent2` endpoint。
- **失敗偵測（對話二十九補強）**：每個 agent 依序檢查 HTTP 200 → 無 `error` 欄位 → 回應 `.ok == true`，任一不符 `exit 1`。`api/news.js` 結尾對 `endpoint !== 'news'`（預設 endpoint 為 `news`，前端 `fetch(API_BASE)` 不帶參數走 RSS 流程）回 404，未知 endpoint 不再落入 RSS 流程回 200（對話二十八的假成功）。⚠️ `weekly_recap` 在本週無隨筆時回 `{ok:false}`，job 會變紅（預期）。
- Agent 1 回應多一個 `shadow: { regime, saved }` 欄位（氣候分類器 v1，見「對話二十九更新」§3）。
- Agent 2 評分的單位與排除規則見「Alpha 成長系統」與「對話二十九更新」§5。
- **Agent 3 的 endpoint 選擇（對話二十七起）**：`github.event_name == schedule`（只有週五 cron 觸發）或手動 `mode=weekly` → `weekly_recap`；其餘（`workflow_run` 鏈、一般手動）→ `alpha_thought`。⚠️ 不要再用 `date -u +%H` 判斷，GitHub 排程延遲加上前兩個 job 的執行時間會讓小時錯位（對話二十七根因）。

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
| `market_regime_daily` | `api/news.js` Agent 1 | 氣候分類器 v1 shadow 記錄：PK(`asof_date`,`rule_version`)，`regime`、`legacy_regime`、`features` jsonb、`run_date`；僅 service_role 可讀寫（RLS 啟用、無 policy） | 對話二十九新增；建表 SQL 是否已執行未確認，以 Agent 1 回應 `shadow.saved` 為準 |
| `alpha_thoughts_backup_20261020`／`alpha_profile_backup_20261020`／`alpha_rescore_20261020` | 重算評分時建立 | 備份與新舊對照 | 暫存，觀察一兩週後可刪 |
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
  success_patterns jsonb null default '[]',   -- 對話二十二新增：Agent 1／2 的成功模式 [{regime,confidence,rate,total}]
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
- `collectInstitutional()`（FinMind workflow，現為台灣 06:47）用 PATCH 補填現貨欄位，不覆蓋 fut_ 欄位

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
- `alpha_profile.success_patterns`：`[{ regime, confidence, rate, total }, ...]` 成功模式物件陣列（Agent 2 每日更新）；`alpha_profile.specialties` 只放 Agent 3 每 10 篇產生的專長字串（對話二十二起分離）
- **評分規則（Agent 2，對話二十九修正）**：對 `pred_result='pending'` 且 `pred_date <= 今天` 的隨筆，取當日 TAIEX（目標為 4 位數股票代號則取該股，查無則退回 TAIEX）的 `chg_pct`，**先 ×100 轉成百分比**；> +0.3% → bullish、< −0.3% → bearish、其餘 neutral，與 `prediction` 相同為 correct。`chg_pct` 為 null 或當日無資料者跳過（維持 pending）。`weekly_recap` 與 `reflection` 不評分。預測錯且 |漲跌| > 0.3% 時，每次執行最多產生一篇檢討篇（`angle='reflection'`、`prediction='neutral'`、`pred_result='pending'`）。
- **regime 規則（Agent 1，現行規則）**：VIX ≥ 25 → volatile；FGI ≥ 75 → trending_up；FGI ≤ 25 → trending_down；當日漲 > 1% 且外資買超 → trending_up；跌 < −1% 且外資賣超 → trending_down；|漲跌| < 0.3% → consolidating；其餘 normal。漲跌幅缺值不判 consolidating。氣候分類器 v1（shadow）見「對話二十九更新」§3。
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
- [ ] 2026-10-21 起：確認 Agent 1 log 有 `[Agent 1] 氣候分類器 v1：…`、回應 `shadow.saved: true`，且 `select * from market_regime_daily` 有資料（若 `saved:false` 且 error 為 404，代表尚未建表，執行 `market_regime_daily.sql`）
- [ ] 觀察 cron 改為 06:17／06:47 後的實際觸發延遲（改前延遲 1 小時 54 分～2 小時 53 分）
- [ ] 2026-10-23（週五）16:00 台灣時間後（排程可能延遲，建議晚上再看）：確認 `alpha_thought.yml` agent3 log 出現「週報觸發 → weekly_recap」、`alpha_thoughts` 新增 `angle='weekly_recap'` 一筆（驗證週報自動路徑）
- [ ] 觀察一～兩週：預測中性占比（修正前約 81%，修正後是否下降）、`alpha_profile.rank` 是否重算（預期降為「市場老狐狸」，未驗證）、檢討篇是否開始產生、`dynamicWeightHint` 是否讓文章過度保守。沒問題後刪 `alpha_thoughts_backup_20261020`、`alpha_profile_backup_20261020`、`alpha_rescore_20261020`
- [ ] 氣候分類器 shadow 累積 2～4 週後：比對 v1 與舊規則（`legacy_regime`）對隔日預測命中率的差異，再決定是否升 v2、是否進入 Phase 2（以新標籤重算命中率）；量能特徵需先找 TAIEX 成交金額來源（`stock_daily_twse.volume` 為 0）
- [ ] （選用）`alpha_thoughts` 加 `regime_version` 欄位，區分對話二十九前後語意不同的 `market_regime` 標籤

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

只針對 `collectTWSEDaily()`（`STOCK_DAY_ALL`）加上 fallback：`openapi.twse.com.tw` 失敗時改打 `www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json`（CSV 格式，欄位順序見上方「collect_market_data.js 重要備忘」）。新增 `parseCSVLine()` / `twseFetchLegacyCSV()`。`sectorIndex`／`valuation` 因舊版端點格式跟 openapi 版差異太大（巢狀多表格 JSON vs 扁平陣列）且未實際驗證過，怕引入「不報錯但資料錯」的風險，這次先不動（已於「對話二十一」補上，見下方）。

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

### `collectSectorIndex` / `collectValuation` 補上 fallback（`collect_market_data.js`）

使用者提供 `MI_INDEX`／`BWIBBU_ALL` 舊版端點真實回應截圖後完成：

1. **`collectSectorIndex()`**：openapi 失敗時改打 `www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=YYYYMMDD&type=ALLBUT0999&response=json`，解析巢狀 `tables[0].data`（非 openapi 版本的扁平陣列）；漲跌符號藏在 HTML 標籤內（如 `<p style='color:red'>+</p>`），用 regex `/<p[^>]*>([+-])<\/p>/` 抓取還原正負號，未變動則為空字串（視為 0）
2. **`collectValuation()`**：openapi 失敗時改打 `BWIBBU_ALL?date=YYYYMMDD&response=json`，解析扁平 `data` 陣列（欄位順序：股票代號/名稱/本益比/殖利率/股價淨值比）；無資料以 `"-"` 表示，`parseFloat("-")` 為 `NaN`，沿用原本 `isNaN` 判斷邏輯即可自動轉為 `null`，不需額外處理
3. 兩個舊版端點都需要帶 `date=YYYYMMDD` 參數（openapi 版本不需要），用 `tradeDate.replace(/-/g,'')` 轉換
4. `BFIAMU` 成交金額補值邏輯（寫入 `sector_index_daily.volume`）不受影響，維持原樣
5. 已用截圖真實資料離線模擬解析（`node` 乾跑），數值、正負號、null 判斷皆正確；`node --check` 語法驗證通過

### 待辦

- [ ] fallback 觸發路徑本身尚未在真實失敗情境下驗證過（這次是離線模擬資料，非實際打 API 失敗觸發），下次 openapi 真的掛掉時需看 log 確認 catch 分支有走進去、且兩張表 Supabase upsert 成功

## 對話二十二更新（2026-08-02）

### Bug 修正：`specialties` 欄位被兩條 pipeline 互相覆蓋

**現象：** Alpha 隨筆頭銜卡片下方的徽章顯示 `[object Object]`，修完物件渲染防呆後又發現顯示成 `consolidating`／`normal` 這種市場環境代碼，而不是專長字串。

**根因：** `alpha_profile.specialties` 欄位被兩個不同用途的寫入路徑共用：
1. **Agent 3**（`alpha_thought` endpoint）：每 10 篇觸發一次，寫入 AI 生成的專長字串陣列（如 `["外資動向敏感","善抓恐慌底部"]`）——這是畫面該顯示的內容。
2. **Agent 2**（`alpha_agent2` endpoint）：**每次評分都執行**，把「環境×信心度組合命中率」物件陣列（`_successPatterns`，格式 `{regime, confidence, rate, total}`）也寫進同一個 `specialties` 欄位，蓋掉 Agent 3 寫的字串。因為 Agent 2 執行頻率遠高於 Agent 3，畫面顯示的幾乎都是 Agent 2 寫入的物件，前端強制轉字串後就變成 `[object Object]`，加防呆後又意外把物件裡的 `regime` 值（如 `consolidating`）當成字串顯示出來。

**修正內容：**
- `api/news.js`：新增獨立欄位 `success_patterns`，Agent 1／Agent 2 的「成功模式學習」邏輯改讀寫 `success_patterns`，不再碰 `specialties`；`specialties` 欄位之後只由 Agent 3 寫入真正的專長字串。
- `js/alpha.js`：徽章渲染加上防呆，相容字串與物件兩種格式（保留作為雙重保險，非根本修法）。
- Supabase 需手動執行：
  ```sql
  ALTER TABLE alpha_profile ADD COLUMN success_patterns jsonb DEFAULT '[]';
  UPDATE alpha_profile SET specialties = '[]' WHERE id = 1;
  ```
  （清空舊的髒資料，等 Agent 3 下次每 10 篇觸發時重新填入正確字串）

### 構想記錄：Utility Screen（尚未實作）

使用者提出參考 Mark Minervini 的 Utility Screen 概念，作為 AlphaScope 未來可能新增的濾網功能，目前僅為構想、尚未排入開發：

- **用途**：在大盤修正期間找出抗跌、可能是下一波領頭羊的個股，比固定一年期 RS 更即時。
- **觸發條件**：大盤距 200 日高點超過 20 個交易日未創新高才啟動；若距高點超過 200 個交易日，直接退回原本一年期 RS 濾網。
- **核心邏輯**：RS 計算區間 = 大盤自 200 日高點以來的交易日數，每日隨天數同步滾動延長（例：今天距高點 23 天則用 23 天區間算 RS，明天變 24 天）。直到大盤創新高或距高點超過 200 個交易日為止。
- **濾網條件**：沿用原本權重公式，只是計算區間改成動態值；拿掉「一年低點」相關條件，其餘不變（RS > 85、股價 > MA200、MA50 > MA200、成交額 > 1 億、距 200 日高點 < 25%）。
- **技術備註**：這種「浮動視窗、每日重算」的邏輯用 Python + 排程自動化比較容易做，之前用其他工具開發時只能做季 RS 替代。若之後要實作，適合放進 `collect_market_data.js` 的 alpha 分析流程或獨立的排程 script，需要每日大盤歷史高點/交易日數資料與可動態指定區間的 RS 計算函式。

## 對話二十三更新（2026-08-14）

### Groq 模型遷移：`llama-3.1-8b-instant` → `openai/gpt-oss-20b`

**觸發原因：** Groq 官方公告 `llama-3.1-8b-instant` 於 2026-08-16 停用，官方推薦替代模型為 `openai/gpt-oss-20b`。

**受影響範圍確認：**
- `api/news.js` 的 `endpoint === 'groq'`（通用 AI proxy，前端透過 `js/news_feed.js` 的 `callGroq()` 呼叫）：唯一直接寫死 `llama-3.1-8b-instant` 的地方，共 2 處（正常呼叫 + 429 重試）
- `alpha_analyze`／`alpha_agent1/2/3` 等 Alpha 隨筆主流程：用的是 `llama-3.3-70b-versatile`，**當時未停用，不受影響，未改動**（⚠️ 更正：Groq 已於 2026-06-17 同時公告停用 `llama-3.3-70b-versatile`，這條在「對話二十四」踩到，8/16 停用生效後才 404，並非本次判斷錯誤，而是 Groq 分兩批停用同一輪公告的模型）
- `collect_market_data.js` 內建的 Groq 呼叫：同樣是 `llama-3.3-70b-versatile`，**當時未改動**（同上，已於「對話二十四」換掉）
- `js/alpha.js`：不直接呼叫 Groq，走 `alpha_*` endpoint，**未改動**
- `index.html`：首頁 UI 提示文字 `llama-3.1-8b` 已同步改為 `gpt-oss-20b`（純顯示用途，不影響功能）

**Bug：換模型後翻譯與簡報「假成功」**

**現象：** 上線後英文新聞標題沒被翻譯成中文，美股/台股簡報顯示「無法生成內容」，但翻譯區塊的狀態文字仍顯示綠色「✓ 翻譯完成」。

**根因：** `openai/gpt-oss-20b` 是**推理模型**，預設 `reasoning_effort: medium`，呼叫時會先在內部產生一段思維鏈再輸出最終答案，這段思考過程本身會消耗 `max_tokens` 額度。原本針對 `llama-3.1-8b-instant`（非推理模型）設計的 `max_tokens`（翻譯 600、簡報用量更小）不夠讓模型「想完又答完」，導致 `message.content` 被截斷成空字串。`js/news_feed.js` 的 `translateArticles()` 又沒有檢查 `callGroq()` 是否真的回傳有效內容，空字串直接被空迴圈吞掉，最後仍無條件顯示「✓ 翻譯完成」，造成畫面「假成功」。

**修正內容：**
- `api/news.js`：2 處 Groq 呼叫皆加上 `reasoning_effort: 'low'`，讓模型少花 token 在思考鏈，把額度留給實際輸出
- `js/news_feed.js` 的 `translateArticles()`：
  - `callGroq()` 回傳空字串時主動拋錯（原本會被靜默吞掉）
  - 新增 `translatedCount` 追蹤實際成功翻譯篇數，依結果分三種狀態顯示：全部成功／部分成功（`X/N 篇`）／完全失敗（顯示失敗原因，標題維持原文），完全失敗與部分失敗都用專案既有的 `'err'` class（非自創的 `'error'`）

**待觀察：** `reasoning_effort: 'low'` 上線後是否完全解決截斷問題，若簡報仍偶發失敗，可考慮：① 適度調高 `maxTokens` 當緩衝 ② 在 `api/news.js` 回應解析處加 log，方便排查是 token 不足還是其他原因。

**模型差異速記（供之後排查參考）：** `gpt-oss-20b` 是 MoE 架構、有推理鏈機制，`llama-3.1-8b-instant` 是傳統 dense 架構、無推理鏈。前者跑分/品質明顯較好，Groq 上實測速度更快、綜合成本更低，但呼叫方式不能直接無縫替換——任何未來要換成推理模型（reasoning model）的 Groq 呼叫，都要記得處理 `reasoning_effort` 與 token 額度，否則會重演這次「空內容」的坑。

---

## 對話二十四更新（2026-08-19）

### `collect_market_data.js` Alpha 報告生成連續三輪修正：模型停用 → TPM 超標 → prompt 精簡

**觸發：** GitHub Actions 排程執行 `collect_market_data.js` 時，Alpha 每日報告生成失敗，`❌ Alpha 報告生成失敗：Groq HTTP 404`。

**第一輪— 模型停用（HTTP 404）**

**根因：** Groq 已於 2026-06-17 公告同時停用 `llama-3.1-8b-instant` 與 `llama-3.3-70b-versatile`，後者正是 `collect_market_data.js` 主流程寫死呼叫的模型，8/16 停用生效後直接 404。（對話二十三當時只確認了前者停用，誤判後者「未受影響」，見上方更正註記。）

**修正：** 模型換成官方推薦替代品 `openai/gpt-oss-120b`，同步比照對話二十三的教訓加上 `reasoning_effort: 'low'`（避免推理模型思維鏈吃光 `max_tokens` 導致空內容），並新增空內容檢查（`raw` 為空字串時明確拋錯，附 `finish_reason`）。

**第二輪 — 換模型後改踩 TPM 上限（HTTP 413）**

**根因：** `openai/gpt-oss-120b` 免費層的 TPM（每分鐘 token 上限）比 `llama-3.3-70b-versatile` 更低。`collect_market_data.js` 的 prompt（前 50 檔股票表格 + 30 則新聞標題 + PTT 熱門 + 選擇權/總經數據）份量不小，加上當時 `max_tokens: 4000`，單次請求就超過 120b 免費層的 TPM 門檻，回傳 413。

**修正：** 模型再換成 TPM 額度較寬鬆的 `openai/gpt-oss-20b`（比照對話二十三 `api/news.js` 已驗證過的模型），並在 `!groqRes.ok` 分支補上讀取並印出 Groq 回應 body（截斷至 300 字），下次再失敗能直接看到 Groq 回傳的精確數字，不用再靠第三方文件猜測額度。

**第三輪 — 仍超標，用精確錯誤數字定位（HTTP 413，附精確數字）**

**根因：** 換 20b 後仍 413，這次 Groq 回應 body 給出精確數字：`Limit 8000, Requested 8639`，超標 639 tokens。

**修正（`collect_market_data.js`）：**
- 股票表格一度從 50 檔縮到 35 檔、`max_tokens` 4000→3000 先驗證方向正確
- 使用者要求維持 50 檔，改為精簡欄位：`stockTable` 拿掉 `PB${...}` 與 `殖${...}%`，只留 PE（原本欄位：代號/名稱/收盤/漲跌/量/PE/PB/殖利率 → 精簡後：代號/名稱/收盤/漲跌/量/PE）
- `max_tokens` 維持 3000（不變）
- 同步修正 `systemPrompt` 的分析框架指示，「基本面：PE/PB/殖利率是否合理」改為「基本面：PE 是否合理」，避免 Alpha 對著已不存在的資料欄位瞎猜

**驗證：** 使用者實際跑過 GitHub Actions，`✅ Alpha 報告已生成並儲存（2026-08-19，3 檔推薦，3 檔進場）`，三修正皆已在真實環境驗證成功。

**待觀察：** 目前估算 TPM 用量約 7000/8000，緩衝約 1000，不算寬裕（詳見「已知問題」）。若之後想加回 PB/殖利率或新聞則數增加，需重新評估是否再次逼近上限。

**通用教訓：** Groq 換模型時不能只確認「模型是否還存在」，還要一併確認該模型在**目前帳號的免費層 rate limit（尤其 TPM）**是否足夠——不同模型的免費層額度差異很大（120b 的 TPM 反而比 70b 更低，跟參數量大小沒有直接關係），且 Groq 常常同一輪公告分批停用多個模型，光看單一模型公告很容易誤判「另一個模型還安全」。

---

## 對話二十五更新（2026-08-27）

### `heatmap.js` 新增「產業貢獻拆解」+ 修正 heatmapData window 存取 bug

**緣起：** 參考 sinotrade/shioaji-pro-app（永豐金開源交易終端）的 Market Pulse 功能，討論後決定不另開大面板，改為輕量整合進現有 `hmSectorBar`（產業漲跌幅 bar）。

**新功能：** `hmSectorBar` 每個產業列前加入可點擊 ▸ 箭頭，點擊展開該產業內「貢獻最大的前 6 檔個股」（依 `|chgPct × mcap|` 排序），用小型橫條呈現方向與相對貢獻大小。完全複用 `loadHeatmap()` 已抓好的 `heatmapData`，**零額外 API 成本**，不用重抓、不動後端。原本點整列篩選 treemap 的行為（`hmFilterSectorByName`）完全不變，兩個互動互不干擾。

**新增函式：** `hmToggleSectorContrib()`、`_computeSectorContrib()`、`_renderContribBreakdown()`。

**踩到的 bug（HTTP 無關，是變數作用域問題）：**

**現象：** 功能上線後，使用者回報無論點哪個產業，展開都顯示「無個股資料（熱圖尚未載入該產業）」，但截圖確認熱圖本體（treemap）其實有正常資料（台積電、聯電等個股都在）。

**根因：** `heatmap.js` 裡的全域變數 `heatmapData` 在別處（推測是 `index.html` 內聯 script 或其他檔案）用 `let heatmapData = []` 宣告。`let`／`const` 宣告的頂層變數**不會**自動掛到 `window` 物件上（跟 `var` 不同）。首版 `_computeSectorContrib()` 誤寫成 `window.heatmapData`，永遠拿到 `undefined`，篩選自然找不到任何股票。

**修正：** 全部改用裸變數 `heatmapData`（改成 `typeof heatmapData !== 'undefined' ? heatmapData : []` 防呆）。順便發現既有的 `hmFilterSectorByName()` 函式裡也有同樣的 `window.heatmapData` 誤用（判斷式 `if (!found && window.heatmapData)`），只是這個 fallback 分支平常很少觸發所以沒被發現，這次一併修正。

**驗證：** 語法用 `node --check` 驗證通過；使用者尚未回報第二次實測結果，**下次對話請先確認使用者是否已實際點擊測試過**。

**通用教訓：** 這個檔案（以及任何用 `<script>` classic script 拆成多檔、彼此共用全域變數的架構）裡，新增程式碼要存取別的檔案宣告的全域變數時，優先比照該變數在同檔案內既有的存取方式（裸變數 or `window.` 前綴），不要自行假設用 `window.` 前綴一定安全——`let`/`const` 宣告的全域變數是例外。

---

## 對話二十六更新（2026-08-31）

### Bug 修正：`alpha_thoughts` 停更 15 天，`alpha_thought.yml` 卻一路顯示綠燈

**現象：** 使用者在 Supabase 截圖發現 `alpha_thoughts` 表最新一筆卡在 2026-08-16 22:43，但 GitHub Actions 上「Alpha 隨筆生成」（`alpha_thought.yml`）每天都顯示 ✅ succeeded，agent1/agent2/agent3 三個 job 都是綠燈，完全沒有任何失敗跡象。

**根因（雙重問題）：**

1. **模型停用（本體）：** `api/news.js` 裡的 `alpha_thought` endpoint（agent3 撰稿員呼叫）共 5 處仍寫死 `llama-3.3-70b-versatile`，另外 `alpha_analyze` endpoint（個股/大盤 AI 分析報告，`js/stock_modal.js` 觸發）也有 1 處，合計 6 處。此模型已於 2026-06-17 由 Groq 公告停用，8/16 停用生效——與 `alpha_thoughts` 停更的日期完全吻合。對話二十三、二十四當時只修了 `collect_market_data.js` 主流程和 `api/news.js` 通用 Groq proxy（`endpoint === 'groq'`），**遺漏了 `alpha_thought` 系列與 `alpha_analyze` 這 6 個獨立寫死模型名稱的呼叫點**，是這次問題延遲兩週才被發現的根本原因。
2. **「假成功」（掩護問題）：** `alpha_thought.yml` 的三個 job 都是 `curl -s ... | jq .`，只要 curl 打到 API、拿到合法 JSON（哪怕內容是 `{"error": "Groq HTTP 404"}`），管線最後一個指令 `jq` 的 exit code 就是 0，GitHub Actions 因此判定 job 成功，不會變紅燈、不會寄失敗通知信。這正是問題被隱藏 15 天都沒人發現的原因。

**除錯過程（供之後排查參考）：**
- Supabase 排序容易誤判：一開始使用者看到的排序畫面其實捲到了資料表最舊的一批（id 1~13，2026-06-10~12），並非真正最新資料，捲回最上面才確認到真正卡住的日期（8/16）
- 用 GitHub Actions 網頁介面點進 `alpha_thought.yml` 執行紀錄 → 找到 agent3 log，裡面直接印出 `{"error": "Groq HTTP 404"}`，才鎖定根因
- 因為 repo 是 public，Claude 直接用 `raw.githubusercontent.com` 抓 `api/news.js` 原始碼比對 log，不需要使用者手動上傳（見上方操作規則第 7 條）

**修正內容：**

1. **`api/news.js`**：全部 6 處 `model: 'llama-3.3-70b-versatile'` 改成 `model: 'openai/gpt-oss-20b'`（比照對話二十三已驗證過的模型），所有 8 個 Groq 呼叫（含原本已用 gpt-oss-20b 的 2 處）統一補上 `reasoning_effort: 'low'`，避免推理鏈吃光 `max_tokens` 導致空內容（對話二十三的教訓）
2. **`api/news.js` 靜默 catch 補強**：風格分析、專長標籤分析、檢討篇這 3 處原本 `catch(e) { /* 不中斷主流程 */ }` 完全吞掉錯誤，改為額外印 `console.error(...)`，日後這幾個小功能壞掉至少 log 看得到
3. **`.github/workflows/alpha_thought.yml` 重寫**：三個 job 的 curl 改用 `curl -s -w "\n%{http_code}"` 取得真實 HTTP status，若 status 非 200 或回應 JSON 含 `error` 欄位 → `exit 1`，讓 job 真正變紅燈；搭配既有的 `needs: [agent1, agent2]` + `if: success()`，上游一失敗，下游 agent 會自動連鎖停止，不再產生半套資料

**驗證：** 使用者實際部署後手動觸發「Alpha 隨筆生成」，agent3 log 顯示 `"ok": true`，新一筆隨筆（id 94，`created_at: 2026-08-31T06:31:13`）成功寫入，`content` 為正常繁體中文內容，非空字串或錯誤訊息。模型修正確認生效；workflow 失敗偵測強化的部分屬於「下次真的失敗時才會驗證到」，目前只驗證過正常流程沒被改壞、語法（`node --check` / YAML `safe_load`）通過。

**待辦：**
- [ ] `alpha_thought` 系列新寫入的隨筆 `market_regime` 欄位是 `null`（id 94），需比對 8/16 前的正常資料是否也是如此，確認是既有行為還是另一個小問題
- [x] `alpha_thought.yml` 的失敗偵測邏輯（HTTP status + error 欄位檢查）：已於「對話二十七」實戰驗證（Run #122，Groq 429 → HTTP 500 → job 變紅）；GitHub 失敗通知信是否收到**未確認**
- [ ] `alpha_analyze` endpoint（個股 AI 分析報告）同樣受模型停用影響，且本來就有正確拋錯（`res.status(500)`），代表過去若使用者曾在前端觸發過，應該會看到明確錯誤畫面（非靜默失敗）；建議下次使用這個功能時順便留意是否正常

**通用教訓：** Groq／任何第三方服務公告「模型即將停用」時，換模型不能只改「這次踩雷的那一個呼叫點」，要對整個 repo 做 `grep -n "model: '"` 全面盤點，逐一確認每個寫死模型名稱的地方都有跟上。另外，`curl ... | jq .` 這種寫法在 shell 裡永遠不會因為 API 回傳錯誤內容而失敗（只要回應是合法 JSON），CI/CD 裡呼叫外部 API 一定要額外檢查 HTTP status 或回應內容本身，否則「假成功」會讓問題不知不覺潛伏很多天才被發現。

---

## 對話二十七更新（2026-10-19）

### 1. 修復：Alpha 頁「本週總結」停在 65 天前（週報停更）

**現象：** Alpha 頁「本週總結」顯示「65 天前」。Supabase 查 `select id, created_at, angle from alpha_thoughts where angle='weekly_recap' order by created_at desc` 只有兩筆：id 86（2026-08-07 08:46 UTC）、id 92（2026-08-14 08:58 UTC）。8/14 之後的 9 個週五（8/21～10/16）都沒有週報。（週報是 `alpha_thoughts` 裡 `angle='weekly_recap'` 的一種列，評分邏輯以 `angle=neq.weekly_recap` 排除它。）

**根因（推論，尚未用 10/16 的 agent3 log 佐證）：** `alpha_thought.yml` 的 agent3 原本用 `HOUR=$(date -u +%H)`、`[ "$HOUR" = "08" ]` 決定呼叫 `weekly_recap` 還是 `alpha_thought`。cron `0 8 * * 5` 常被 GitHub 延遲，agent1→agent2 又要先跑完，agent3 一旦跨過 09:00 UTC 就默默改產一般隨筆（HTTP 200，失敗偵測不會變紅）。證據：前兩筆建立時間離 09:00 邊界只差 14 分鐘與 1 分多鐘（08:58:35）。對話二十六修復只驗證了日常隨筆（id 94），週五路徑沒驗到，所以 8/31 之後週報仍沒回來。

**修正（`.github/workflows/alpha_thought.yml`）：**
- agent3 改依觸發來源判斷：`github.event_name == schedule` 或手動 `mode=weekly` → `weekly_recap`；其餘 → `alpha_thought`。事件名稱與 mode 經 `env:` 傳入 shell。
- `workflow_dispatch` 新增 input `mode`（`auto`／`weekly`），可手動補跑週報。
- Agent 1/2 與失敗偵測邏輯不動。

**驗證：** 手動執行 Run #155（`mode=weekly`）三個 job 皆成功，`alpha_thoughts` 新增 id 134（2026-10-19 03:21:05 UTC，`angle='weekly_recap'`），證明 `weekly_recap` endpoint 本身與對話二十六的模型修復正常。YAML `safe_load`、`bash -n` 通過。**尚未驗證**：週五自動觸發路徑（`schedule` 事件），待 2026-10-23 16:00 台灣時間後確認。

**已知小問題／未確認：**
- 週五 `workflow_run` 鏈與 `schedule` 兩條路徑都會跑 agent1/agent2，Groq 用量多一份；暫不處理。
- 本次沒讀到 `weekly_recap` endpoint 本體，是否有「本週已存在則跳過」的防重複檢查未確認。
- 失敗偵測首次實戰（Run #122）：agent3 回 `{"error":"Groq HTTP 429"}`，API 回 HTTP 500，log 印 `❌ Agent 3（alpha_thought）失敗：HTTP 500`，job 變紅，符合預期。
- GitHub 通知 `ubuntu-latest` 自 2026-10-19 起逐步遷移到 Ubuntu 26，目前無影響；必要時可把 `runs-on` 釘成 `ubuntu-24.04`。

**通用教訓：** 用「執行當下的時鐘小時」判斷分支，遇到排程延遲就會靜默走錯路；分支條件應依「觸發來源」（`github.event_name`）或明確參數，而不是時間。

### 2. 研究記錄：Jpopaholic/AIAutoStocks（第三方開源專案，僅作參考，未複製任何程式碼）

**網址：** https://github.com/Jpopaholic/AIAutoStocks（137 commits、0 star、README 未公開任何績效數據）

**是什麼：** Python + Supabase + Gemini/OpenAI 的台股自動量化交易系統，可接永豐 Shioaji 實盤／模擬／沙盒，Fly.io 部署，FastAPI 控制台（TOTP）、Discord 通報。台灣時間 15:00–18:00 盤後執行，送次日開盤預約單。核心是三層 AI 代理（大盤氣候 → 技術分析師 → 組合經理）+ Python 硬護欄（同日不反向沖銷、虧損冷卻、型態機率低於 50% 過濾模型說法等）+ 月度／季度 AI 復盤自我演化 Skills。

**大盤氣候代理（`src/agents/regime_agent.py`，176 行）：**
- 輸入：加權指數近 30 天日 K（含 MA5/20/60、5/20 日均量、RSI、MACD、DMI）整段文字餵 LLM。
- 輸出（Pydantic schema）：`regime`（6 階：STRONG_BULL／REBOUND_BULL／CALM_RANGE／VOLATILE_RANGE／CORRECTION_BEAR／PANIC_BEAR）、`posture`（5 階）、`risk_multiplier`（0.15–1.0）、`target_cash_ratio`（0.05–0.90）、`allowed_buy_styles`、`tactical_directive`、`reason`。
- 6 階定義與姿態對照表全寫在 prompt，但定義本身是規則（例如 MA5>MA20>MA60 且站穩均線＝強勢多頭），本可用程式判斷；Python 端只做數值夾值與失敗時退回 CALM_RANGE，沒看到 regime↔posture 一致性與 enum 檢查。

**自我演化 Skills（`monthly_review_agent.py`、`quarterly_review_agent.py`、`services/trading_memory.py`）：**
- 月度：Python 先聚合硬指標（勝率、盈虧比、滑價、取消率、進場分位數、ATR）→ 對每檔股票各打一次 LLM 做指標檢討與執行檢討，再各 reduce 一次 → 產出 `indicator_skills` 與 `execution_skills`（買入門檻、單檔權重、停損停利、ATR 乘數、追價／讓價階梯、V 轉／A 頂規則、個股特徵）→ 寫入 `monthly_skills`。門檻：當月 `daily_analysis` ≥ 10 筆。
- 季度：同樣流程，再加一次「策略委員會」LLM 呼叫審視三個月 Skills 軌跡、輸出過度擬合裁定與校準參數 → 寫入 `quarterly_skills`；三個月都要有月檢討才執行。
- 注入：取最新一筆月度＋季度，純量參數季度覆蓋月度，規則列表季度排前面、字串去重，整包 JSON 塞進決策代理 prompt。
- 好設計：規則被要求「單日即可判定」，禁止「再觀望三天」這類跨日條文（避免前視偏誤）。
- 弱點：新 Skills 寫入即生效，無回測／樣本外驗證、無回滾；`expected_probability_pct` 是 LLM 自編數字；過度擬合審查是另一次 LLM 判斷而非統計檢定；10 天門檻樣本很薄；參數範圍（如買入門檻 40–90）只寫在欄位描述，這幾支檔案沒有強制檢查（下游 `decision_agent` 未讀）；氣候代理用 STRONG_BULL 等 6 階，Skills 內卻用 BULLISH_TREND 等另一套詞彙。
- 我沒讀到的檔案：`analyst_agent`、`decision_agent`、兩支 aggregator；無法驗證這套演化是否真的改善績效。

### 3. 移植 AlphaScope 評估與計畫（Phase 1 已於對話二十九以 A 方案實作 shadow，見該章 §3；Phase 2／3 尚未動工）

**⚠️ 更正：** 口頭評估時曾把「氣候層」當成新功能，但本文件「弱點自覺 + 動態成長系統」已有：規則式 `market_regime`（volatile／trending_up／trending_down／consolidating／normal，依 VIX、FGI、當日加權漲跌、外資淨買賣判斷，`api/news.js` 的 `alpha_thought` 區塊可見）、近 60 篇各環境命中率、三層提示（weakness／dynamicWeight／success）。因此可移植價值縮小為：① 升級氣候分類器（現行只看單日資料，沒有均線／趨勢／200 日高點特徵）② Skills 的版本化與驗證流程。

**Phase 0（前置，已於對話二十八完成）：**
- TAIEX 歷史天數：104 天（2026-05-15 ~ 10-16）。MA20／MA60／量能比可算；200 日高點約需等到 2027 年 2～3 月，暫以期間高點代替，或先補歷史資料。
- `market_regime` 為 `null` 與程式碼／文件不一致，皆為 8/14 回歸造成，已修復（見「對話二十八更新」）。

**Phase 1（氣候分類器，shadow 模式）：**
- JS 規則式判定，特徵：MA20／MA60 排列與收盤相對位置、距 200 日高點的天數與幅度、5 日／20 日量能比、既有 VIX／FGI／外資淨額。LLM 最多寫一段說明，可併入現有 Agent 1 呼叫，不要把 30 行原始 K 線塞 prompt（TPM 緊，見「已知問題」）。
- 新表 `market_regime_daily`（date、regime、features jsonb、rule_version）。先只記錄、不注入 prompt，跑 2–4 週比對命中率。
- ⚠️ 改分類定義會讓既有 `market_regime` 命中率統計失去可比性（目前已有 130 篇），需加 `regime_version` 或另起統計。
- 與構想中的 Utility Screen 共用特徵（距 200 日高點天數正是它的觸發條件）。

**Phase 2：** 以新氣候標籤重算命中率，沿用 `alpha_profile.weakness_analysis`，不另建系統。

**Phase 3（Skills 輕量版）：**
- 新表 `alpha_skills`（version、status：candidate／active／retired、evidence jsonb、parent_id 以便回滾）。
- 每週一次 Actions：程式先算命中率分組（氣候 × 產業 × 信心）→ 一次 Groq 呼叫提出候選規則 → 用歷史預測重播驗證（樣本數與提升幅度達標才升 active，最多 5 條）→ 只把 3–5 行注入 Agent 3，**不要注入 `collect_market_data.js`**（TPM 約 7000/8000）。
- 資料量限制：每天約 3 檔預測，月約 60 筆；只演化文字經驗與信心校準，不自動調數值門檻。

**不移植：** 執行 Skills（ATR 停損、追價／讓價階梯、滑價，AlphaScope 沒有真實委託）、逐股 map-reduce（每次 2N+2 次呼叫，Groq 免費層撐不住）、季度委員會（資料量不足）。

**可借鏡的小設計：** 規則限定「單日可判定」；多 key 輪替＋冷卻處理 429；用 Python 護欄覆寫 LLM 輸出。

**風險：** 氣候誤判會讓 Alpha 過度保守（所以先 shadow）；「建議現金水位／風險乘數」類輸出容易被讀成投資建議，網站宜以市場狀態描述呈現，正式上線前建議找專業人士確認；注入 Skills 會增加 token。

### 4. ~~待確認：`news.js` 程式碼與本文件描述可能不一致~~

已於「對話二十八」查明：是 8/14 commit `551fb2f` 以舊檔蓋掉 `news.js`，文件描述本來是對的，程式碼已還原。

---

## 對話二十八更新（2026-10-19）

### 1. 事故：8/14 commit `551fb2f` 以舊檔蓋掉 `news.js`，agent 鏈空轉約 66 天

**發現過程：** 對話二十七 §4 懷疑文件與程式不一致。使用者上傳 `news.js`（2865 行）與 `alpha_thought.yml` 後發現：workflow 的 Agent 1／Agent 2 打 `?endpoint=alpha_agent1`／`alpha_agent2`，但 `news.js` 完全沒有這兩個 endpoint。未知 endpoint 會落入檔案尾端的 RSS 預設流程，回 HTTP 200 且無 `error` 欄位，所以失敗偵測判定成功——這是繼對話二十六（`curl | jq` 假成功）之後的第二種「假成功」。

**根因：** `551fb2f`（2026-08-14 09:03，「groq endpoint換 gpt-oss-20b」）本應只換 2 處模型名稱，實際 diff 為 +351／−606，`api/news.js` 由 3113 行變 2858 行。推測是用舊的本地副本修改後上傳（未證實，commit 本身不會說明）。

**因此遺失的功能**（以 `551fb2f^` 與 `551fb2f` 的關鍵字計數驗證）：
- `alpha_agent1`／`alpha_agent2` endpoint（`b1a7069`，06-24）
- `weaknessHint`／`dynamicWeightHint`／`successHint`（`be1d398`，06-17 起）
- `success_patterns` 欄位分離（`c0f246c`，07-29）
- Max Pain 到期日統一為 `getWeeklyWedExpiry`／`getWeeklyFriExpiry`（`87e5671`，07-09；被退回 `getNextWeekday`）
- `pred_date` 對齊當天（`42da0ee`，06-30）、Agent 1 讀 `alpha_daily_report`（`31d93ed`，06-30）
- 副作用：`alpha_thoughts` 的寫入從沒帶 `market_regime`，所以一直是 NULL

### 2. 修復

- 以 `551fb2f^` 為基底還原，重新套用 8 處 Groq 呼叫改 `openai/gpt-oss-20b` + `reasoning_effort: 'low'`（與對話二十六的 HEAD 一致）。
- 新增兩項：① `alpha_thought`、`weekly_recap` 的 `Groq HTTP` 錯誤訊息附上 Groq 回應前 300 字；② handler 開頭新增 `groqFetch()`，這兩處遇 429 時依 `retry-after`／訊息「try again in Xs」等待後重試最多 2 次，需等 >8 秒（如每日額度）則不重試。以假 429 單元測試過邏輯（兩次 429 後成功，約 3.2 秒）。
- Supabase 欄位檢查：`alpha_profile` 9 個欄位與 `alpha_thoughts.market_regime` 共 10 個欄位齊全，無需補 SQL。
- **驗證：** Run #156 重跑 agent3 成功。agent1 回 `ok:true, market_regime:consolidating, lines:11`；agent2 回 `ok:true, scored:0, streak:2, reflection:false`（當時無到期預測，`scored:0` 正常）。Supabase：id 135（2026-10-19 08:13 UTC）`market_regime=consolidating`、`pred_date=2026-10-19`；對照還原前的 id 133，`pred_date` 為隔天、`market_regime` 為 NULL。隨筆內容出現 RSI／KD，證明 agent1 的技術指標有傳到 agent3。
- **429 實際內容：** `gpt-oss-20b` TPM Limit 8000、Used 6667、Requested 1477，等約 1.08 秒。額度為帳號共用，誰用掉 6667 未查明。

### 3. 資料現況

- `stock_daily_twse` 的 TAIEX：104 天（2026-05-15 ~ 10-16）。MA20／MA60／量能比可算；距 200 日高點需約到 2027 年 2～3 月，暫以期間高點代替。
- 10/19 當日 TAIEX 於 16:20 尚未入庫（最後一天 10-16），需確認 `Collect TWSE`（見待辦）；這會影響 id 135 的評分。
- 8/14～10/19 的 `alpha_thoughts.market_regime` 為 NULL，各環境命中率需重新累積。

### 4. 教訓

- **別用舊副本改檔**：改 `news.js` 一律從 GitHub main 最新版出發，上傳前檢查 diff 行數是否異常（該次 −606）。
- **打到不存在的 endpoint 不會報錯**（落入 RSS 預設流程回 200），失敗偵測應檢查 `ok` 欄位，`news.js` 結尾宜對未知 endpoint 回 404。
- **Groq 429 要看回應內容**：TPM（每分鐘）等 1～2 秒就好，TPD（每日）才需要等很久；錯誤訊息要把回應 body 帶出來才分辨得出。
- **Groq 換模型時**：除了全檔 `grep -n "model: '"` 盤點，也要確認上傳的檔案確實是最新版（對話二十六教訓的延伸）。

### 5. 後續

上述起手式項目已於對話二十九處理（TWSE 10/19 已入庫、id 135 已被評分、Phase 1 走 A），新對話請看「對話二十九更新」§8。

---

## 對話二十九更新（2026-10-20）

### 1. 排程：GitHub `schedule` 延遲，cron 改成非整點

- **現象：** 10/20 08:50 台灣時間，Collect TWSE／FinMind／Alpha Report 還沒自動執行。實際 cron 是 `0 22 * * 0-4`（台灣 06:00）與 `30 22 * * 0-4`（台灣 06:30），本文件舊表寫的 14:30／15:30 是過時資訊，已更正。
- **證據：** 10/19 的 Collect TWSE #119 實際觸發時間為 UTC 10/18 23:54（台灣 07:54，晚約 1 小時 54 分）；FinMind #110 約 08:15（晚約 1 小時 45 分）。10/20 的 TWSE #120 於 08:53 才跑（晚約 2 小時 53 分），隨後 FinMind #111（09:06）、Alpha Report #119（09:07）、Alpha 隨筆 #157（09:07）依序成功。判斷為 GitHub 排程延遲（整點／半點負載高），不是程式問題；Collect News 同時間照常執行。
- **修改（commit `d479106`）：** `collect-twse.yml` 改 `17 22 * * 0-4`（台灣 06:17）、`collect-finmind.yml` 改 `47 22 * * 0-4`（台灣 06:47）。只能降低機率，不保證消除；效果待觀察（見待辦）。
- 這兩支收的是**上一個交易日**資料（`lastTradingDay()`）；FinMind → Collect Alpha Report → Alpha 隨筆以 `workflow_run` 串接，上游延遲會往後連帶。

### 2. 失敗偵測補強（commit `5ae4936`／`15d4348`）

- `alpha_thought.yml`：三個 agent 在 HTTP 200、無 `error` 之後，再檢查 `.ok == true`（用假回應測過：`{ok:true}` 通過；`{error}`、RSS 陣列、`{ok:false}` 皆擋下）。
- `api/news.js`：結尾 `if (endpoint !== 'news') return 404`。已核對 repo 內所有呼叫端用到的 endpoint 名稱都有對應處理；前端 `fetch(API_BASE)` 不帶參數時預設 `news`，不受影響。以模擬請求驗證未知 endpoint 回 404。
- 補回 `c8b7f45` 的三處 `console.error`（風格分析、專長標籤、檢討篇）。

### 3. 氣候分類器 Phase 1（走 A，shadow）— commit `d57c75f`

- **實作：** `api/news.js` 模組層級純函式 `classifyRegimeV1(series, ctx)`，由 `alpha_agent1` 在算完現行 regime 後呼叫，寫入 `market_regime_daily`；**不改 `market_regime`、不進任何 prompt**。寫入失敗（例如表不存在）只 `console.error`，不中斷 Agent 1。
- **規則 v1（依序，第一個符合者）：** volatile＝VIX ≥ 25 或 20 日年化波動 `rv20` ≥ 28（%）或 5 日報酬 ≤ −5%；trending_up＝收盤 > MA20 > MA60 且 MA20 的 5 日斜率 > +0.2%；trending_down＝收盤 < MA20 < MA60 且斜率 < −0.2%；consolidating＝|收盤/MA20 − 1| ≤ 2% 且 |斜率| ≤ 0.3%；其餘 normal。MA60 需 ≥ 60 筆；序列 < 25 筆回傳 `regime: null`。
- **門檻是初版估計值**，要調請升版（v2…）並保留 v1 的紀錄，不要直接改 v1。
- **features（jsonb）：** `asof, n_bars, close, ma20, ma60, vs_ma20, vs_ma60, ma20_slope_5d, ret_5d, ret_20d, rv20, high_window_days, days_since_high, dd_from_high, vix, fgi, foreign_net`。高點取最近 200 筆最大值；目前不足 200 天，所以是期間高點（`high_window_days` 記錄實際視窗長度）。**沒有量能特徵**（TAIEX `volume` 為 0）。
- **資料表：** `market_regime_daily`，PK(`asof_date`,`rule_version`)，另有 `regime`、`legacy_regime`（同一次執行現行規則的判斷）、`run_date`、`created_at`；RLS 啟用、無 policy。建表 SQL 為 `market_regime_daily.sql`（交付過；使用者是否已執行**未確認**）。
- **驗證：** 六種合成情境與 `alpha_agent1` 全流程（資料表正常／回 404 兩條路徑）以模擬資料通過；**尚未在線上驗證**。

### 4. 修正：Agent 1 的 TAIEX 序列取到最舊 120 筆（潛伏 bug）

技術指標原本用 `order=date.asc&limit=120`，取到的是最舊的 120 筆；TAIEX 累積超過 120 天（約 11 月中）後，RSI／KD／MA 會凍結在舊資料。改為 `order=date.desc&limit=260` 再 `reverse()`，目前結果與修正前相同，分類器共用同一份序列（`taiexSeries`）。

### 5. 修正：`chg_pct` 單位（顯示、regime、評分）— commit `b43d382`

- **事實：** `stock_daily_twse.chg_pct`、`sector_index_daily.chg_pct` 是小數（0.0122 ＝ +1.22%）。`collect_market_data.js` 自 4～5 月起以 `toFixed(6)` 小數寫入；`heatmap.js`、`valuation.js`、`collect_market_data.js` 內的顯示都有 ×100。
- **Agent 1 顯示：** 加權指數、成交量前 5 大印成 `+0.0122%`（少 100 倍），Agent 3 看到的漲跌幅小了 100 倍；`alpha_analyze` 的個股表格同樣。已改為 ×100。
- **Agent 1 regime：** 原本用半形括號 regex 去解析全形括號的文字（永遠比對不到）→ 漲跌幅視為 0 → 除非 VIX ≥ 25 或 FGI 極端，一律 `consolidating`；就算比對到，小數也過不了 `> 1.0` 門檻。已改成直接用數值 `taiexChgPct`（百分比）；漲跌幅缺值時不再判 consolidating。模擬測試：+1.22% 且外資買超 → trending_up；−1.5% 且外資賣超 → trending_down；±0.3% 內 → consolidating；其餘 normal。
- **Agent 2 評分（最嚴重）：** 自 6/10 第一版（`366fa21`）起，`chg > 0.3 ? 'bullish' : chg < -0.3 ? 'bearish' : 'neutral'` 拿小數比 0.3，實際漲跌幾乎永遠是 neutral：只有預測中性才算對，檢討篇條件（|chg| > 0.3）永遠不成立。已改 `chg = chg_pct * 100`；`chg_pct` 為 null 者跳過；pending 查詢改成 `angle=not.in.(weekly_recap,reflection)`（否則修正後新產生的檢討篇會被當成 neutral 預測計入準確率）。模擬測試涵蓋上漲／盤整／個股／休市／null。
- **診斷（Supabase，已排除 weekly_recap／reflection）：** bearish → wrong 18、bullish → wrong 5、neutral → correct 100，共 123 筆，證實上述推測。
- **重新評分：** 執行 `rescore_alpha_thoughts.sql`（備份 → 對照表 → 更新 `pred_result` → 校正 `alpha_profile` 累計次數）。結果：correct→correct 20、correct→wrong 80、wrong→correct 7、wrong→wrong 16，123 筆全部查得到當日資料；`alpha_profile.total_calls = 123`、`correct_calls = 27`（約 22%）。預測中性 100 筆只有 20 筆對；方向預測 23 筆只有 7 筆對（樣本少，勿過度解讀）。Alpha 約 81% 的預測是中性。**推測（未證實）：** 與 Agent 1 把漲跌幅少報 100 倍有關。
- **連帶效果（預期，尚未全部驗證）：** ① 整體命中率僅約 22%，各環境（樣本 ≥ 3）幾乎都 < 50%，`dynamicWeightHint` 會一律強制信心度「低」；② `alpha_profile.rank` 仍顯示舊的「鐵血操盤手」，要到下次 Agent 3 發文才重算，預期降為「市場老狐狸」；③ 修正後 Agent 2 每次最多產生一篇檢討篇；④ 舊隨筆的 `market_regime` 是舊（有 bug）規則標的，近 60 篇各環境命中率需數週才有參考價值。

### 6. 作業備忘

- 改檔流程見「Claude 操作規則」第 10、11 條（clone → 改 → 驗證 → SendUserFile；Stop hook 提醒時以 `git reset --hard origin/main` 清暫存 clone）。
- 本次上傳的 commit：`d479106`（cron）、`5ae4936`／`15d4348`（失敗偵測）、`d57c75f`（regime shadow）、`b43d382`（單位修正）。
- 本次交付的 SQL：`market_regime_daily.sql`（建表）、`rescore_alpha_thoughts.sql`（已執行，含備份與還原語法；備份與對照表暫存於資料庫）。

### 7. 教訓

- **欄位單位要查寫入端與前端用法，不要靠名稱猜**：`chg_pct` 看名稱像百分比，實際是小數；同一個值在 Agent 1 顯示、regime 判斷、Agent 2 評分三處都被誤用。
- **別用 regex 去解析自己剛組出來的 prompt 文字**（全形／半形括號、格式改了就壞）；直接傳數值。
- **`order=date.asc&limit=N` 取的是最舊的 N 筆**；要最新 N 筆用 `desc` 再反轉。
- **自我成長的回饋迴路（評分 → 命中率 → 提示）建立在評分之上**，評分一壞整套都失真；新增這類機制要抽樣核對評分結果。
- **GitHub `schedule` 不準時**，整點／半點最容易延遲。

### 8. 新對話建議起手式

1. 確認 10/21 起 Agent 1 log／回應 `shadow.saved: true`，並查 `market_regime_daily`；若 `saved:false` 且 error 為 404，執行 `market_regime_daily.sql`。
2. 看 cron 06:17／06:47 實際觸發延遲有無改善。
3. 10/23（週五）16:00 後（建議晚上看）驗證週報自動觸發。
4. 觀察預測中性占比、`rank`、檢討篇與文章語氣；shadow 累積 2～4 週後比對 v1 與舊規則，再決定 Phase 2 或升 v2（細節見待辦）。
