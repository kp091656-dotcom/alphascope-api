# AlphaScope CHANGELOG

## 2026-06-09

### 修正：三大法人合計數字錯誤（chips.js）
- 合計欄位改用 `spot_foreign_net + spot_trust_net + spot_dealer_net` 加總
- 不再使用 `spot_total_net`（該欄位含陸資子項，與分項加總不一致）

### 修正：K線 iframe 退回 bar chart（signals.js）
- `openStockModal()` 移除 iframe 邏輯，直接呼叫 `_loadModalBarChart(stock)`
- `closeStockModal()` 移除 `iframeWrap.innerHTML = ''` 清理（已不需要）
- `chart.html` 保留為獨立頁面，不做 modal 嵌入

### 修正：Max Pain 趨勢圖顯示「資料不足」（signals.js）
- `renderMaxPainTrend()` 改依優先序查合約：`weekly_fri → weekly_wed → monthly`
- 原本只查 `contract_type=eq.monthly`，但近週五/週三合約的 max_pain 資料較充足
- 圖表標題自動標示使用的合約類型（近週五 / 近週三 / 月選）
- 資料不足時顯示「Max Pain 資料累積中…」而非「歷史資料不足」

---

## 2026-06-08

### 修正：買賣超顯示 0.00 + 5/28 後資料不變

**`collect_market_data.js`（已 push）**
- `toB()` 解析到 n===0 時改回傳 null，避免用 0 覆蓋後續 FinMind 正確值
- `parseSpot()` 只在 buy/sell/net 均不為 null 時才寫入 result
- `collectChips()` upsert `market_chips_daily` 時：現貨欄位全為 null → 只寫期貨欄位
- `collectInstitutional()` 改用逐筆 PATCH 更新 `market_chips_daily` 現貨欄位，不覆蓋 fut_ 欄位
- 新增 `spot_foreign_buy/sell`、`spot_trust_buy/sell`、`spot_dealer_buy/sell` 欄位寫入

**Supabase 直接修正（SQL UPDATE）**
- `market_chips_daily` 5/29～6/5 的 `spot_foreign_net / trust_net / dealer_net` 從 buy-sell 反算補正
- `institutional_daily` 分項 foreign_net / trust_net / dealer_net 同步補正
