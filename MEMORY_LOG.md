# 專案開發日誌 (Memory Log)

## [2026-05-26] 實務派案優化：ETL 防護網與地圖無障礙卡片升級

### 架構與決策紀錄 (Architecture & Decisions)
1. **防禦性效能過濾 (Frontend Rendering Filter)**
   - **痛點**：交通接送等無地址服務被強行指派空經緯度，導致 Maplibre 將大量大頭針重疊渲染在座標 `(0,0)` 或是經緯度不明的區域，消耗 WebGL 效能。
   - **解法**：在 `Map.tsx` 導入 `useMemo` 實作 `validResources`，只有具備有效地址與經緯度的資料才會進入繪製迴圈，完美達成「清單顯示全資料、地圖僅畫實體點」的職責分離。

2. **長照地址雙軌制 (Dual-Track Address)**
   - **解法**：修改 Python ETL 腳本，透過 `TAIWAN_CITIES` Mapping 自動修補缺漏縣市。產出供人類閱讀的 `address` 與供機器導航的 `navAddress`，徹底解決了導航定位失誤的問題。

3. **實務資訊卡片與高對比適配 (Practical Info Popup & High Contrast)**
   - 透過模糊匹配抓取「服務對象」、「資源」與「轉介方式」。
   - 在 Map Popup 中實作 Tailwind 條件渲染區塊。
   - 完美適配 `isHighContrast`：在深色模式下切換為 `bg-black border-yellow-400 text-yellow-400`，並補上「行動呼籲 (CTA)」頁尾，讓個管師能更直覺地進行下一步派案動作。
