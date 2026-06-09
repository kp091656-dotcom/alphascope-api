# AlphaScope CHANGELOG

## 2026-06-09

### 工作流程變更
- 移除 GitHub MCP push 功能，改為 Claude 生成檔案、使用者手動上傳 GitHub

### signals.js
- **修正 `renderMaxPainTrend()`**：改為每天取最高優先有值的合約（weekly_fri → weekly_wed → monthly），而非固定用同一合約類型，解決走勢圖日期跳空問題
- **新增 Max Pain 走勢 hover tooltip**：滑鼠移到點上顯示日期 + 數值，支援觸控

### api/news.js
- **options endpoint 三大法人 Supabase fallback**：FinMind `TaiwanOptionInstitutionalInvestors` 盤中尚未更新時（法人全 null），自動從 `options_analytics_daily` 撈最近有值的一筆補填

---

## 2026-06-08

### collect_market_data.js / market_chips_daily
- `toB(n)` 解析到 n===0 → 回傳 null，避免覆蓋後續 FinMind 正確值
- TWSE MI_INST / BFIA01 失敗 → spotOK=false → fallback FinMind
- 全失敗時只寫期貨欄位，不寫 spot_ 欄位
- `collectInstitutional()`（15:30）用 PATCH 逐筆補填現貨欄位

### 資料修正
- 5/29～6/5 的 `spot_foreign_net / trust_net / dealer_net` 因 TWSE MI_INST 欄位解析失敗被寫成 0，已用 SQL `buy-sell` 反算補正

### chips.js
- 三大法人合計改為直接加總 `spot_foreign_net + spot_trust_net + spot_dealer_net`（不用 `spot_total_net`，避免含陸資子項導致落差）
