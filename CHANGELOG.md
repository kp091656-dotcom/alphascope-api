# AlphaScope — 歷史改動記錄 (CHANGELOG.md)

-----

## 2026-06-06

### 全面收尾
- 補資料：Supabase MCP 直接執行 SQL，從 `chips_daily` 補寫 6-03 至 `market_chips_daily` ✅
- 籌碼面板前端顯示恢復正常 ✅
- 所有待 push 檔案已 push（`sentiment.js`、`collect_market_data.js`、`news.js`、`signals.js`、`index.html`）✅
- 所有 GitHub Actions Workflows 確認全部綠燈 ✅
- CLAUDE.md 拆分出 CHANGELOG.md，縮小主文件 token 消耗 ✅
- 新增 Claude push 規則：檔案做好先生成，詢問後才 push ✅

### GitHub MCP 連線成功
- 安裝 Claude Github MCP Connector GitHub App
- 現可直接讀取/push repo 檔案，不需手動上傳

### js/watchlist.js — market_summary 截斷修正
- 移除 `slice(0, 80)` 硬截斷，改為完整顯示 `alpha.market_summary`

-----

## 2026-06-04（第二次對話）

### collect_market_data.js — MTX/TMF netOnly 修正
- `parseFut()` 新增 `netOnly = false` 參數
- TX 照舊寫 long/short/net；MTX/TMF 只寫 net
- 根因：`market_chips_daily` 的 MTX/TMF 欄位只有 `_net`

### backup.yml — shell bug 修正
- 原：`rclone ... && echo ✅ && SUCCESS+=1 || echo ❌ && FAIL+=1`
- 改：`if rclone ...; then SUCCESS+=1; else FAIL+=1; fi`

### api/news.js — options endpoint 完整重寫
- 分合約類型：isMonthly / isWed / isFri
- 各自獨立計算 callOI / putOI / pcRatio，回傳 byContract
- 移除：`pc_ratio_vol`、`strikes` 陣列

### js/signals.js — 對應新 options API
- `renderOptions(data)` 共用渲染函式
- 新增 `optByContract` 區塊渲染
- Fallback 改讀 `options_analytics_daily`

### index.html — HTML 結構調整
- P/C Ratio Vol → Max Pain stat-card
- 新增 `id="optByContract"` 分合約 OI 容器

-----

## 2026-06-04（第一次對話）

### sentiment.js Groq JSON 解析強化
- 新增 `extractGroqJSON()` 函式：括號深度配對找完整 `[...]`
- `max_tokens` 900 → 1200

### backup.yml 新增 push trigger
- 每次 push main 自動備份到 pCloud（2026-06-05 已驗證）✅

-----

## 2026-06-01

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

## 2026-05-29

### 前端架構重構（index.html 拆分）
- 7,624 行 → 1,230 行（純 HTML 骨架）+ 12 個 JS 檔
- `js/news.js` → `js/news_feed.js`

### Workflow 調整
- `scrape_gifts.yml` 停用自動排程
- `scrape_egift.yml` 改為每週日執行

### 籌碼面板趨勢圖新增
- 近 10 日 Canvas 趨勢圖 × 4

-----

## 2026-05-27

- RLS 全面修正
- Workflow 拆分（collect.yml → 5 個獨立檔案）
- 多項 Bug 修復
