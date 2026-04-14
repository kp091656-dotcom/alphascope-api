# NewsDigest.AI — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-04-15
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 專案概覽

**名稱：** NewsDigest.AI — AI 驅動財經新聞網站  
**網址：** https://newsdigest-api.vercel.app  
**GitHub：** github.com/kp091656-dotcom/newsdigest-api  
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫  
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|----------------|---------|
| 前端主檔 | `/home/claude/index.html` | `index.html` |
| Vercel API | `/home/claude/news.js` | `api/news.js` |
| K 棒圖 | — | `chart.html` |
| 每日收集腳本 | `/home/claude/collect_market_data.js` | `.github/scripts/collect_market_data.js` |
| Actions（每日收集）| — | `.github/workflows/collect.yml` |
| Actions（TWSE測試）| — | `.github/workflows/test_twse.yml` |

> 每次對話開始，請先上傳 index.html 和 news.js，Claude 複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 8 張）

| 表名 | 來源 | 內容 | 每日筆數 |
|------|------|------|---------|
| `stock_daily` | FinMind | 86支個股收盤、漲跌幅、市值 | ~86 |
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量 | ~1227 |
| `institutional_daily` | FinMind | 三大法人現貨買賣超 | 1 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 |
| `options_daily` | FinMind | P/C Ratio、Max Pain、法人選擇權 | 1 |
| `futures_daily` | stooq+FinMind | 全球商品/指數 | ~35 |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1070 |

### Supabase 前端查詢

```js
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';

async function sbFetch(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  });
  return r.json();
}
// 例：查台積電近30天
sbFetch('stock_daily', 'stock_id=eq.2330&order=date.desc&limit=30&select=date,close,chg_pct');
// 例：查半導體類指數
sbFetch('sector_index_daily', 'index_name=eq.半導體類指數&order=date.desc&limit=30');
```

### GitHub Actions 每日收集

**排程：** 台灣時間 20:30（UTC 12:30），週一至週五  
**Node.js：** 24  
**8個並行收集：**
1. FinMind 86支個股 → `stock_daily`
2. FinMind 三大法人 → `institutional_daily`
3. FinMind 融資融券 → `margin_daily`
4. FinMind 台指選擇權 → `options_daily`
5. stooq+FinMind 全球商品 → `futures_daily`
6. TWSE 全上市1227支 → `stock_daily_twse`
7. TWSE 官方產業指數76個 → `sector_index_daily`
8. TWSE 本益比/殖利率 → `stock_valuation_daily`

---

## TWSE OpenAPI（GitHub Actions 可用，Vercel IP 403 封鎖）

**Base URL：** `https://openapi.twse.com.tw/v1`

| endpoint | 內容 | 筆數 |
|----------|------|------|
| `/exchangeReport/STOCK_DAY_ALL` | 全上市個股每日成交 | ~1350 |
| `/exchangeReport/MI_INDEX` | 各類官方指數（含產業）| ~267 |
| `/exchangeReport/MI_MARGN` | 個股融資融券明細 | ~1260 |
| `/exchangeReport/BWIBBU_ALL` | 個股本益比/殖利率/PBR | ~1070 |
| `/opendata/t187ap05_L` | 個股月營收 | ~1056 |
| `/exchangeReport/MI_INDEX20` | 成交量前20名 | 20 |

**三大法人整體買賣超：** TWSE 無提供，繼續用 FinMind。

---

## Vercel API 端點

**Base URL：** `https://newsdigest-api.vercel.app/api/news`

| endpoint | 說明 | Cache TTL |
|----------|------|-----------|
| `?endpoint=news` | RSS 新聞 | 無 |
| `?endpoint=fgi` | CNN Fear & Greed | 無 |
| `?endpoint=vix` | VIX term structure | 無 |
| `?endpoint=futures` | 全球商品排行榜 | **30 分鐘** |
| `?endpoint=options` | 台指選擇權籌碼 | **60 分鐘** |
| `?endpoint=institutional` | 三大法人現貨 | **60 分鐘** |
| `?endpoint=margin` | 融資融券 | **60 分鐘** |
| `?endpoint=twheatmap` | 台股86支熱圖（手動載入）| **60 分鐘** |
| `?endpoint=twheatmap&refresh=1` | 強制跳過 cache | — |
| `?endpoint=ptt` | PTT 股票版 | 無 |
| `?endpoint=ptt_article&url=...` | PTT 文章內文 | 無 |
| `?endpoint=reddit&sub=...` | Reddit RSS | 無 |

---

## 前端常數

```js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api/news' : 'https://newsdigest-api.vercel.app/api/news';
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
```

---

## 台股熱圖

- **86支股票**，19個產業，全部並行抓取
- **手動載入**：需按「↻ 更新」（節省 FinMind quota）
- **個股 Modal**：點股票開走勢圖，讀 Supabase `stock_daily`
- **產業漲跌幅 bar**：`renderSectorBar()` 市值加權，點擊聯動篩選
- **DRAM 已合併進記憶體**

### SECTOR_COLORS
```js
半導體:'#3b82f6', IC設計:'#6366f1', 記憶體:'#8b5cf6',
電子製造:'#f59e0b', 電子零件:'#fbbf24', 光學:'#f97316', 網通:'#fb923c',
工業電腦:'#ef4444', 電腦:'#f87171', 金融:'#10b981', 電信:'#34d399',
石化:'#6b7280', 鋼鐵:'#9ca3af', 汽車:'#84cc16', 零售:'#a3e635',
食品:'#facc15', 紡織:'#fb7185', 橡膠:'#c084fc'
```

### 多空訊號儀表板（mktSignalPanel）
- 開啟熱圖分頁自動呼叫 `loadMktSignals()`
- 完成後非同步：`loadInstitutionalHistory()`（Supabase 30日）+ `loadSignalBacktest()`（P/C 回測）
- Max Pain = **賣方（法人）獲利最大點**（非買方總損失最小）

---

## 設計規範

```css
--accent: #c8521a   /* 漲/多頭（紅）*/
--accent2: #1a6bc8  /* 藍 */
--accent3: #2a9d5c  /* 跌/空頭（綠）*/
--bg: #f7f6f2  --surface: #ffffff  --border: #e4e2d9  --border-dark: #c8c5b8
--text: #1a1a18  --muted: #7a7870
/* ring shadow */
box-shadow: 0 0 0 1px var(--border-dark);
```

**字體：** Playfair Display + IBM Plex Mono + Noto Sans TC  
**台股慣例：漲=🔴紅、跌=🟢綠**

---

## AI 引擎

**Groq：** `llama-3.3-70b-versatile`  
**歷史遺留函式名：** `callGemini()` = Groq、`fetchMarketaux()` = RSS  
**翻譯：** 兩波策略，各25篇，間隔62秒，429時等20秒重試

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | 手動觸發 |
| AI 翻譯 | ✅ | Groq 兩波 |
| Fear & Greed | ✅ | CNN + 加密 |
| VIX term structure | ✅ | |
| 全球商品排行榜 | ✅ | |
| K 棒圖 | ✅ | |
| 社群情緒（PTT+Reddit）| ✅ | |
| 台指選擇權籌碼 | ✅ | 60min cache |
| 台股熱圖 | ✅ | 86支，手動載入 |
| 產業漲跌幅 bar | ✅ | 市值加權 |
| 多空訊號儀表板 | ✅ | 含回測 |
| 個股走勢圖 Modal | ✅ | Supabase |
| Supabase 歷史資料庫 | ✅ | 8張表 |
| 官方產業指數收集 | ✅ | TWSE → sector_index_daily |
| 全上市股票收盤 | ✅ | TWSE → stock_daily_twse |
| 個股估值收集 | ✅ | TWSE → stock_valuation_daily |
| **前端用官方產業指數** | 🔜 | 讀 sector_index_daily |
| **Modal 加估值資料** | 🔜 | PER/殖利率/PBR |
| **月營收收集** | 🔜 | TWSE t187ap05_L |
| 台股 VIX | ❌ | 無免費來源 |

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `saveGroqKey`/`fetchMarketaux`/`showFutures`/`showHeatmap` |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Groq 429 | 翻譯有 retry；社群分析等 20 秒 |
| options 無資料 | 往前找 7 個交易日 |
| 熱圖條紋 | squarify 需正方形版面 |
| 產業漲跌幅太小 | chgPct 是小數需 ×100 |
| Modal 無法彈出 | 確認 #stockModal CSS 有 display:flex (.open) |
| Supabase 無法寫入 | 確認用 service_role key |
| TWSE 從 Vercel 403 | 只能從 GitHub Actions 或瀏覽器呼叫 |

---

## 開發慣例

1. 開新對話上傳 `index.html` 和 `news.js`，Claude 複製到 `/home/claude/`
2. 修改後輸出到 `/mnt/user-data/outputs/`
3. 上傳 GitHub → Vercel 自動部署
4. JS 語法驗證：`node --check news.js`
5. 所有 Vercel API 用 `API_BASE`
6. Shadow：`box-shadow: 0 0 0 1px` ring shadow
7. Supabase 讀取用 anon key，寫入用 service_role key
8. 新增功能同步更新 CLAUDE.md

---

## 設計參考

- **awesome-design-md**：ring shadow、warm dark palette
- **graphify**：filter by community → 產業篩選
- **nstock.tw/market_index/heatmap**：熱圖 UI
- **tradingview.com/heatmap**：分組 treemap
