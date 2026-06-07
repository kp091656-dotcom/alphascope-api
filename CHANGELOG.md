# AlphaScope — 歷史改動記錄 (CHANGELOG.md)

-----

## 2026-06-07

### 三大功能新增

#### 1. Max Pain 近5日趨勢圖
- 新增 `renderMaxPainTrend(containerId)` 共用函式（在 `signals.js` 尾部）
- 資料來源：`options_analytics_daily`，`contract_type=monthly`，近5筆
- Canvas 折線圖：漸層填充 + 圓點 + 首末日期標籤 + 最新值/前日差摘要
- 渲染位置 ①：側欄選擇權面板 Max Pain 下方（`id="maxPainTrendChart"`）
- 渲染位置 ②：多空訊號儀表板欄① Max Pain stat-card 下方（`id="ms_maxPainTrend"`）

#### 2. Alpha 交易室部位風險總覽
- 新增 `renderRiskOverview(positions)` 函式（合併進 `signals.js` 尾部）
- 在 `showAlphaReport()` 取完持倉後呼叫，渲染在 `alphaReportModal` 頂部（`id="alphaRiskOverview"`）
- 總覽6格：總持倉成本、當前市值、浮動損益（%）、最大潛在虧損、持倉檔數、平均持有天數
- 個別持倉進度條：藍色=進場點、動態彩色=現價、橘色=目標、灰色=停損
- 市值計算：從 `stock_daily_twse` 取最新收盤價；取不到時 fallback 顯示提示

#### 3. 個股 Modal K線圖 iframe 嵌入（方案B）
- `openStockModal()` 偵測 `id="modalChartIframe"` DOM 是否存在
- 存在時：嵌入 `chart.html?id=...&name=...&embed=1`（iframe 高度 460px）
- 不存在時：fallback 回原本 bar chart（`_loadModalBarChart()`）
- 關閉 modal 時自動清空 iframe 釋放資源
- 歷史統計摘要改為獨立函式 `_loadModalStats()` 非同步載入

### 檔案異動
| 檔案 | 變更 | Commit |
|------|------|--------|
| `js/signals.js` | 完整取代（含3個新函式） | `8cc42c0` |
| `js/alpha.js` | 加入 `renderRiskOverview(open)` 呼叫 | `835e49c` |
| `index.html` | 加入4個新 DOM 元素 | `407cf9e` |

-----

## 2026-06-06

### 全面收尾
- 補資料：Supabase MCP 直接執行 SQL，從 `chips_daily` 補寫 6-03 至 `market_chips_daily` ✅
- 籌碼面板前端顯示恢復正常 ✅
- 所有待 push 檔案已 push ✅
- 所有 GitHub Actions Workflows 確認全部綠燈 ✅
- CLAUDE.md 拆分出 CHANGELOG.md ✅
- 新增 Claude push 規則：檔案做好先生成，詢問後才 push ✅

### GitHub MCP 連線成功

### js/watchlist.js — market_summary 截斷修正

-----

## 2026-06-04（第二次對話）

### collect_market_data.js — MTX/TMF netOnly 修正
### backup.yml — shell bug 修正
### api/news.js — options endpoint 完整重寫
### js/signals.js — 對應新 options API
### index.html — 新增 `id="optByContract"`

-----

## 2026-06-04（第一次對話）

### sentiment.js Groq JSON 解析強化
### backup.yml 新增 push trigger

-----

## 2026-06-01

### Bug 修復（9項）
### 今日總結大卡片升級
### Vercel API 新增 mis endpoint

-----

## 2026-05-29

### 前端架構重構（index.html 拆分）
- 7,624 行 → 1,230 行 + 12 個 JS 檔

-----

## 2026-05-27

- RLS 全面修正
- Workflow 拆分（collect.yml → 5 個獨立檔案）
