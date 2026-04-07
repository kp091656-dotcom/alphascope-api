# NewsDigest.AI — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-04-07
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 專案概覽

**名稱：** NewsDigest.AI — AI 驅動財經新聞網站
**網址：** https://newsdigest-api.vercel.app
**GitHub：** github.com/kp091656-dotcom/newsdigest-api
**架構：** 單一 Vercel repo（前端 + 後端 API）
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|----------------|---------|
| 前端主檔 | `/home/claude/index.html` | `newsdigest-vercel/index.html` |
| Vercel API | `/home/claude/news.js` | `newsdigest-vercel/api/news.js` |
| K 棒圖 | — | `newsdigest-vercel/chart.html` |

> 每次對話開始，請先上傳 index.html 和 news.js，Claude 會複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Vercel API 端點

**Base URL：** `https://newsdigest-api.vercel.app/api/news`

| endpoint | 說明 | 來源 |
|----------|------|------|
| `?endpoint=news` | RSS 新聞（預設）| Reuters/CNBC/Bloomberg/MarketWatch/FT |
| `?endpoint=fgi` | CNN Fear & Greed Index | production.dataviz.cnn.io |
| `?endpoint=vix` | VIX 波動率 term structure | Yahoo Finance（server-side）|
| `?endpoint=futures` | 全球商品排行榜 | stooq + FinMind 混合 |
| `?endpoint=finmind` | FinMind 通用端點 | FinMind API |
| `?endpoint=ptt` | PTT 股票版文章列表（含推文數）| PTT HTML index 翻頁爬蟲 |
| `?endpoint=ptt_article&url=...` | PTT 單篇文章內文 + 推/噓統計 | PTT 文章頁爬蟲 |
| `?endpoint=reddit&sub=...&sort=...` | Reddit RSS（含 selftext）| Reddit RSS feed |
| `?endpoint=options` | 台指選擇權籌碼（P/C Ratio + 三大法人 + Max Pain）| FinMind |
| `?endpoint=twvix` | 台股 VIX（未完成）| TAIFEX |
| `?endpoint=commodities` | 已整合進 futures，棄用 | — |

### PTT endpoint 說明
- `?endpoint=ptt`：抓最新頁往前翻最多 5 頁（約 100 篇），篩選 24 小時內，回傳 `{title, updated, link, pushes, rank, body}`
- `?endpoint=ptt_article&url=https://www.ptt.cc/...`：回傳 `{body, pushes, pushCount, booCount, neutCount}`
- 推文數從 HTML nrec span 解析（爆=99，XX=負分）

### Reddit endpoint 說明
- `?endpoint=reddit&sub=wallstreetbets&sort=hot&limit=25`
- 使用 RSS feed（不需授權），回傳 `{id, title, body, score:0, url, created, num_comments, rank}`
- **注意：** Reddit RSS 沒有 score 欄位，改用 `rank`（hot feed 排名位置）代表熱度

### options endpoint 說明
- 資料來源：`TaiwanOptionDaily` + `TaiwanOptionInstitutionalInvestors`（FinMind）
- 自動嘗試最近 3 個交易日，避免週末/尚未更新問題
- 回傳：`{date, pcRatio:{volume, oi, callOI, putOI}, institution:{外資, 自營商, 投信}, maxPain}`
- **更新頻率：** 盤後（約 17:00–19:00），每天只需載入一次

### FinMind 通用端點參數
```
?endpoint=finmind&dataset=TaiwanFuturesDaily&symbol=TX&start=2024-01-01
?endpoint=finmind&dataset=TaiwanStockPrice&symbol=TAIEX&start=2024-01-01
?endpoint=finmind&dataset=USStockPrice&symbol=^VIX&start=2024-01-01
```

---

## 環境變數（Vercel）

| 變數 | 用途 |
|------|------|
| `FINMIND_TOKEN` | FinMind API（600 req/hr）|
| `THENEWSAPI_TOKEN` | 已棄用 |
| `TWELVE_DATA_KEY` | 已棄用 |

---

## 全球商品排行榜（endpoint=futures）架構

### FinMind usSymbols（USStockPrice，欄位大寫：Open/High/Low/Close）
| symbol | 名稱 | cat |
|--------|------|-----|
| `^GSPC` | S&P500 | 美股指數 |
| `^IXIC` | 那斯達克 | 美股指數 |
| `^DJI` | 道瓊 | 美股指數 |
| `^VIX` | VIX波動率 | **波動率** |
| `^SOX` | 費城半導體 | 美股指數 |
| `GLD` | 黃金(GLD) | 金屬 |
| `SLV` | 白銀(SLV) | 金屬 |
| `USO` | WTI原油 | 能源 |
| `BNO` | 布倫特原油 | 能源 |
| `IBIT` | 比特幣ETF | 加密貨幣 |
| `FETH` | 以太幣ETF | 加密貨幣 |

### stooq SYMBOLS（欄位小寫，`^` 需編碼為 `%5E`）
| symbol | 名稱 | cat |
|--------|------|-----|
| `%5Edax` | 德國DAX | 美股指數 |
| `%5Eftse` | 英國FTSE100 | 美股指數 |
| `%5Ecac` | 法國CAC40 | 美股指數 |
| `%5Etwii` | 台灣加權 | 亞股指數 |
| `%5Enk225` | 日經225 | 亞股指數 |
| `%5Ehsi` | 香港恆生 | 亞股指數 |
| `PPLT.US` | 白金 | 金屬 |
| `PALL.US` | 鈀金 | 金屬 |
| `COPX.US` | 銅礦ETF | 金屬 |
| `UNG.US` | 天然氣 | 能源 |
| `XLE.US` | 能源類股 | 能源 |
| `EURUSD` | 歐元/美元 | 外匯 |
| `GBPUSD` | 英鎊/美元 | 外匯 |
| `USDJPY` | 美元/日圓 | 外匯 |
| `AUDUSD` | 澳幣/美元 | 外匯 |
| `USDCAD` | 美元/加幣 | 外匯 |
| `USDCNH` | 美元/人民幣 | 外匯 |
| `TLT.US` | 20年美債 | 債券 |
| `IEF.US` | 10年美債 | 債券 |

**注意：** stooq `.F` 期貨（CL.F, GC.F 等）CSV 需登入，不支援直接下載

### 排行榜類別顯示順序
`['波動率','美股指數','亞股指數','能源','金屬','農產品','外匯','債券','加密貨幣']`

### 漲跌顏色（台股慣例）
- 漲/多頭 → 🔴 紅色（`var(--accent)` = `#c8521a`）
- 跌/空頭 → 🟢 綠色（`var(--accent3)` = `#2a9d5c`）

---

## FinMind 資料集重要欄位

| dataset | 欄位 | 備註 |
|---------|------|------|
| `TaiwanStockPrice` | `date, open, max, min, close, Trading_Volume` | TAIEX 也適用 |
| `USStockPrice` | `date, Open, High, Low, Close, Adj_Close, Volume` | **大寫欄位** |
| `TaiwanFuturesDaily` | `date, contract_date, open, max, min, close, volume, trading_session` | 篩選 `position`，取最近月 |
| `TaiwanOptionDaily` | `date, option_id, contract_date, strike_price, call_put, volume, open_interest, trading_session` | 篩選 `position` |
| `TaiwanOptionInstitutionalInvestors` | `institutional_investors, long_open_interest_balance_volume, short_open_interest_balance_volume` | 三大法人選擇權部位 |
| `CrudeOilPrices` | `date, name, price` | WTI / Brent |

---

## 社群情緒儀表板（sentimentPanel）

### 資料來源
| 來源 | API | 資料內容 |
|------|-----|---------|
| PTT 股票版 | `/api/news?endpoint=ptt` | 標題、時間排名(#1=最新)、推文淨值 |
| PTT 文章內文 | `/api/news?endpoint=ptt_article` | 內文前300字、推/噓/→詳細統計 |
| Reddit WSB | `/api/news?endpoint=reddit&sub=wallstreetbets` | 標題、熱度排名(#1=最熱)、body摘要 |
| r/investing | `/api/news?endpoint=reddit&sub=investing` | 同上 |

### 分析流程
1. 平行抓三個來源
2. PTT：逐篇呼叫 `ptt_article` 取內文（最多20篇，每篇300ms間隔，約20-30秒）
3. Groq 分析：標題 + 內文摘要 + 互動數 → `{sentiment, reason, title_zh, confidence}`
4. 生成 AI 情緒摘要（約150字）

### Groq Prompt 重點
- PTT 互動：「推文淨值:#N，正=多推認同」
- Reddit 互動：「熱度排名:#N（Reddit演算法，數字越小越熱門）」
- confidence：high（標題+摘要一致且互動有支持）/ mid / low

### 顯示規則
- BY SOURCE：三色分段條（紅=多頭 / 灰=中性 / 綠=空頭）+ 各論壇 多N/中N/空N 數字
- 貼文列表：顯示排名（PTT=時間排名、Reddit=熱度排名）+ confidence 標籤

---

## 台指選擇權籌碼（optSection）

### 位置：側邊欄 VIX 卡片下方
### 資料：頁面載入時自動呼叫一次，**無自動刷新**（盤後資料每日更新一次即可）

### P/C Ratio 解讀
| 數值（未平倉口數）| 訊號 |
|---|---|
| < 0.7 | 偏多頭（紅色）|
| 0.7–1.0 | 略偏多（藍色）|
| 1.0–1.3 | 中性（灰色）|
| 1.3–1.7 | 略偏空（橘色）|
| > 1.7 | 偏空頭（綠色）|

### 三大法人淨部位
- 正數（紅色）= 多單 > 空單
- 負數（綠色）= 空單 > 多單
- 橫條寬度：5000口為滿格

### Max Pain 最大痛點
- 定義：讓選擇權買方總損失最小的結算價
- 顯示距本週結算天數（台指週選，每週三結算）

---

## 前端設計規範

**字體：** Playfair Display + IBM Plex Mono + Noto Sans TC
```css
--accent: #c8521a   /* 橘紅（漲/多頭）*/
--accent2: #1a6bc8  /* 藍 */
--accent3: #2a9d5c  /* 綠（跌/空頭）*/
--bg: #faf8f3  --surface: #f5f3ee  --border: #e8e4dc
--text: #1a1814  --muted: #8a8278
```

**重要：台股慣例顏色與一般相反**
- 漲/多頭 = 紅色（accent）
- 跌/空頭 = 綠色（accent3）

**AI 引擎：** Groq（`llama-3.3-70b-versatile`）
**函式名稱（歷史遺留，勿改）：** `callGemini()` = Groq、`fetchMarketaux()` = RSS

---

## Sticky Header 架構

三層 sticky，從上到下：
1. `header`：`top: 0; z-index: 100`
2. `.api-config-bar`：`top: 64px; z-index: 90`（含 GROQ KEY 列）
3. `.category-bar`：`top` 由 JS `updateStickyOffsets()` 動態計算

`updateStickyOffsets()` 在頁面載入和 resize 時執行。

---

## 翻譯機制（Groq 兩波策略）

- 只翻英文文章（跳過含中文字元的 PTT 文章）
- **第一波：** 前 25 篇，每 8 篇一批，批次間隔 500ms
- **等待 62 秒**（TPM 重置，Groq 免費版 12,000 TPM/分鐘）
- **第二波：** 後 25 篇
- 遇到 429 rate limit：等待 20 秒後重試（最多 2 次）
- `max_tokens: 1024`（翻譯用不到 4096，降低 token 消耗）

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | 手動點「載入財經新聞」觸發 |
| AI 翻譯（Groq 兩波）| ✅ | 50篇分兩分鐘完成 |
| 今日市場摘要 | ✅ | |
| 美股/台股簡報 | ✅ | |
| Fear & Greed (CNN + 加密) | ✅ | |
| VIX term structure + Contango/Backwardation | ✅ | |
| 全球商品排行榜（ST/FM 標籤）| ✅ | 漲紅跌綠（台股慣例）|
| K 棒圖（台股+美股+指標）| ✅ | |
| 社群情緒儀表板 | ✅ | PTT + Reddit WSB + r/investing |
| 社群情緒 PTT 內文分析 | ✅ | 逐篇爬蟲，約20-30秒 |
| 社群情緒 BY SOURCE 三色分段條 | ✅ | |
| 台指選擇權籌碼（P/C Ratio + 三大法人 + Max Pain）| ✅ | 側邊欄，頁面載入自動呼叫 |
| 自動刷新新聞 | ❌ 已移除 | 避免 Groq TPM 超限 |
| 台股 VIX | ❌ | 無免費來源 |
| 語言切換 | ❌ | 已移除 |

---

## 已知限制

1. **Groq TPM 12,000/分鐘** — 翻譯改用兩波策略，間隔 62 秒
2. **stooq `.F`** — 需登入，用 ETF 替代
3. **Yahoo Finance** — 完全 CORS 封鎖
4. **台股 VIX** — 無免費 API
5. **FinMind GoldPrice** — 台幣計價，用 GLD ETF 替代
6. **Reddit score** — RSS 無此欄位，改用 hot feed 排名(rank)代替
7. **PTT 內文爬蟲** — Vercel 10s 上限，採逐篇呼叫方式（每篇獨立 endpoint）
8. **台指選擇權資料** — 盤後才更新，盤中看到的是昨日資料

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `saveGroqKey`/`fetchMarketaux`/`showFutures` 是否存在 |
| stooq 空白 | `.F` 不支援；`^` 需編碼為 `%5E` |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位是大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Contango 不更新 | 確認 vix3m?.price 和 price 都有值 |
| Groq 429 | TPM 超限，翻譯已有 retry 機制；社群分析等 20 秒重試 |
| PTT 推文數全是 0 | 用 split('<div class="r-ent">') 解析，勿用 regex |
| Reddit 500 | RSS 版本不需授權，JSON API 被 Vercel IP 封鎖 |
| options 無資料 | 自動往前找 3 個交易日；FinMind TaiwanOptionDaily 盤後才更新 |

---

## 開發慣例

1. 開新對話時上傳 `index.html` 和 `news.js`，Claude 複製到 `/home/claude/`
2. 修改完成後輸出到 `/mnt/user-data/outputs/`
3. 上傳 GitHub → Vercel 自動部署
4. 測試 API：瀏覽器直接開 endpoint URL
5. JS 語法驗證：`node --check news.js`
6. 重要：`isAnalyzing` 旗標在情緒分析期間保護 `fetchMarketaux` 不被意外觸發（已移除自動刷新後此旗標也已移除）
