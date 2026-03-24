# NewsDigest.AI — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-03-24
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

| 檔案 | 路徑 |
|------|------|
| 主要工作檔 | `/mnt/user-data/outputs/newsdigest-gnews.html` |
| 部署用前端 | `/mnt/user-data/outputs/newsdigest-vercel/index.html` |
| Vercel API | `/mnt/user-data/outputs/newsdigest-vercel/api/news.js` |
| K 棒圖 | `/mnt/user-data/outputs/newsdigest-vercel/chart.html` |

> 修改後記得：
> `cp newsdigest-gnews.html index.html && cp index.html newsdigest-vercel/index.html`

---

## Vercel API 端點

**Base URL：** `https://newsdigest-api.vercel.app/api/news`

| endpoint | 說明 | 來源 |
|----------|------|------|
| `?endpoint=news` | RSS 新聞（預設）| Reuters/CNBC/Bloomberg/MarketWatch/FT |
| `?endpoint=fgi` | CNN Fear & Greed Index | production.dataviz.cnn.io |
| `?endpoint=vix` | VIX 波動率 term structure | Yahoo Finance（server-side）|
| `?endpoint=futures` | 全球商品排行榜 | stooq + FinMind 混合 |
| `?endpoint=commodities` | 黃金/原油（舊，已整合進 futures）| FinMind |
| `?endpoint=finmind` | FinMind 通用端點 | FinMind API |
| `?endpoint=twvix` | 台股 VIX（未完成）| TAIFEX |

### FinMind 通用端點參數
```
?endpoint=finmind&dataset=TaiwanFuturesDaily&symbol=TX&start=2024-01-01
?endpoint=finmind&dataset=TaiwanStockPrice&symbol=TAIEX&start=2024-01-01
?endpoint=finmind&dataset=USStockPrice&symbol=^VIX&start=2024-01-01
?endpoint=finmind&dataset=CrudeOilPrices&data_id=WTI&start=2024-01-01
?endpoint=finmind&dataset=GoldPrice&start=2024-01-01
```

---

## 環境變數（Vercel）

| 變數 | 用途 |
|------|------|
| `FINMIND_TOKEN` | FinMind API（在 Vercel Settings 設定）|
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

### 資料來源標籤
- `ST`（灰色）= stooq
- `FM`（藍色）= FinMind

---

## FinMind 資料集重要欄位

| dataset | 欄位 | 備註 |
|---------|------|------|
| `TaiwanStockPrice` | `date, open, max, min, close, Trading_Volume` | TAIEX 也適用 |
| `USStockPrice` | `date, Open, High, Low, Close, Adj_Close, Volume` | **大寫欄位** |
| `TaiwanFuturesDaily` | `date, contract_date, open, max, min, close, volume, trading_session` | 篩選 `position`，取最近月 |
| `CrudeOilPrices` | `date, name, price` | WTI / Brent |
| `GoldPrice` | `date`(含時間), `Price`(大寫) | **台幣計價**，用 GLD ETF 替代 |

---

## chart.html

**URL：** https://newsdigest-api.vercel.app/chart.html

### type 參數對應
| type | dataset |
|------|---------|
| `'tw'` | `TaiwanStockPrice` |
| `'us'` | `USStockPrice` |
| `'futures'` | `TaiwanFuturesDaily`（篩選 position + 近月）|
| `'stock'` | 自動轉 `'tw'` |

### 快捷按鈕
- **台股：** 加權指數(TAIEX/tw)、台指期(TX/futures)、台積電(2330/tw)、聯發科(2454/tw)、元大台50(0050/tw)
- **美股：** S&P500(^GSPC/us)、那斯達克(^IXIC/us)、道瓊(^DJI/us)、VIX(^VIX/us)、蘋果(AAPL/us)、輝達(NVDA/us)、台積電ADR(TSM/us)

### 指標
MA5/20/60/120/240、布林通道(20日)、RSI(14)、MACD(12,26,9)

---

## 前端設計規範

**字體：** Playfair Display + IBM Plex Mono + Noto Sans TC
```css
--accent: #c8521a   /* 橘 */
--accent2: #1a6bc8  /* 藍 */
--accent3: #2a9d5c  /* 綠 */
--bg: #faf8f3  --surface: #f5f3ee  --border: #e8e4dc
--text: #1a1814  --muted: #8a8278
```

**AI 引擎：** Groq（`llama-3.3-70b-versatile`）
**函式名稱（歷史遺留，勿改）：** `callGemini()` = Groq、`fetchMarketaux()` = RSS

---

## 功能狀態

| 功能 | 狀態 |
|------|------|
| RSS 新聞 | ✅ |
| AI 翻譯（Groq）| ✅ |
| 今日市場摘要 | ✅ |
| 美股/台股簡報 | ✅ |
| Fear & Greed (CNN + 加密) | ✅ |
| VIX term structure + Contango/Backwardation | ✅ |
| 全球商品排行榜（ST/FM 標籤）| ✅ |
| K 棒圖（台股+美股+指標）| ✅ |
| 台股 VIX | ❌ 無免費來源 |
| 語言切換 | ❌ 已移除 |
| 自動刷新（15分鐘）| ✅ |

---

## 已知限制

1. **stooq `.F`** — 需登入，用 ETF 替代
2. **Yahoo Finance** — 完全 CORS 封鎖
3. **台股 VIX** — 無免費 API
4. **FinMind GoldPrice** — 台幣計價，用 GLD ETF 替代
5. **stooq .US ETF** — 偶爾間歇性回傳空白

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `saveGroqKey`/`fetchMarketaux`/`showFutures` 是否存在 |
| stooq 空白 | `.F` 不支援；`^` 需編碼為 `%5E` |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位是大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Contango 不更新 | 確認 vix3m?.price 和 price 都有值 |

---

## 開發慣例

1. 修改 `newsdigest-gnews.html`
2. `cp newsdigest-gnews.html index.html && cp index.html newsdigest-vercel/index.html`
3. 上傳 GitHub → Vercel 自動部署
4. 測試 API：瀏覽器直接開 endpoint URL
5. JS 語法：`node -e "new Function(js_string)"`
