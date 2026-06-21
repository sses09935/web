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

## [2026-06-21] 安全邊界文件化：新增 THREAT_MODEL.md（issue #4）

### 決策紀錄 (Decisions)
1. **威脅模型獨立成檔，與 SECURITY.md 區分**
   - **痛點**：README 已有「安全與 PoC 邊界」摘要，但缺正式威脅模型；SECURITY.md 是漏洞通報用途，不應混入邊界論述。
   - **解法**：新增 `THREAT_MODEL.md`，結構為 assets → adversary classes（隨手使用者／爬蟲／有能力的自動化）→ 各控制「做什麼／不做什麼」+ residual risk → non-goals →「真正的保護需要什麼」（登入、server authz、最小揭露、DLP、audit log）。README 與 SECURITY.md 各加一行指向本檔，維持單一事實來源。
2. **維持威懾框架，不誇大**
   - 嚴守 AGENTS.md「Security Component Invariants」：不宣稱可防外洩／複製／截圖／爬取；各元件 residual risk 一律以最高能力對手為基準描述。真正的保護界線是「不可公開資料不進靜態 bundle」，瀏覽器端控制只是其內的摩擦與追蹤。
