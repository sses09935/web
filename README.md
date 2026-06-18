# NTUH 北護長照資源協作 PoC

這是一個給 NTUH 北護長照情境使用的靜態資源派案與查詢工作台 PoC。系統以可近用性、穩定靜態輸出、資料防禦式渲染與地圖互動為核心，協助使用者快速篩選、定位與轉介長照相關資源。

本專案不是正式醫療系統，也不包含伺服器端身分驗證、正式病歷整合或即時資料交換能力。

## Open source status

This repository is released as an open-source static Next.js PoC under the MIT License. It can be used, studied, forked, and adapted as a reference for accessible, static-export resource lookup workspaces.

Before publishing a fork or deployment, review `.env.example`, `.gitignore`, and `SECURITY.md`. Do not commit real credentials, private exports, or sensitive operational data.

Demo site: https://ntuh-beihu-poc.web.app

## 使用者

- 個管師
- 社工
- 長照服務從業者
- 家屬照顧者

## 專案目的

- 建立 NTUH 北護長照資源協作 PoC。
- 提供靜態派案、資源查詢、分類篩選與地圖定位工作台。
- 保持靜態輸出相容性，讓成果可部署到 Firebase Hosting 的靜態站台。
- 以鍵盤操作、語意標記、焦點樣式與高對比支援維持 accessibility-first 體驗。

## 技術棧

- Framework: Next.js 16.2.6，App Router
- UI: React 19
- Language: TypeScript
- Styling: Tailwind CSS v4 with `@tailwindcss/postcss`
- Map engine: Maplibre GL JS
- State: React native state only，使用 `useState`、`useMemo`、`useCallback` 等 React 內建能力

禁止引入 Leaflet、Redux、Zustand、MobX 或其他全域狀態管理套件。

## 資料載入策略

Public repo 不追蹤正式或合作來源資料。下列路徑保留在本機或私有環境，並由 `.gitignore` 排除：

- `_raw_data/`
- `_cleaned_data/`
- `_docs/`
- `src/data/resources.json`
- `src/data/resources.private.json`
- `src/data/resources.build.json`
- `src/data/resource-manifest.json`

公開 repo 只保留一份合成範例資料：

- `src/data/resources.public.json`

前端實際匯入的是 build-time 產物：

- `src/data/resources.build.json`

`npm run prepare:data` 會依序尋找資料來源並產生 `src/data/resources.build.json`：

1. `PRIVATE_RESOURCE_DATA_PATH` 指向的 JSON 檔
2. `src/data/resources.private.json`
3. `src/data/resources.json`
4. `src/data/resources.public.json`

需要強制驗證公開範例資料路徑時，可使用：

```bash
RESOURCE_DATA_MODE=sample npm run build
```

若沒有私有資料，公開 clone 會自動使用 `src/data/resources.public.json`，因此仍可 install、lint、test 與 build。若要用真實資料，請把 ETL 輸出或授權後資料放在 ignored 私有路徑，不要 commit 到 public repo。

## 目前資料狀態

畫面與儀表板會依 `src/data/resources.build.json` 於建置時重新計算：

- 總筆數
- 有效座標
- 缺漏或無效座標
- 生活圈雷達半徑：1.5km

公開站或 fork 在沒有私有資料時只會顯示合成範例資料。正式或合作來源資料的可公開性必須另外取得明確授權；無法確認授權時，不得放入 public repo。

## ETL 規則

資料清洗腳本：

```bash
python _scripts/data_cleaning.py
```

維護資料時請遵守：

- 不手改 `src/data/resources.json`、`src/data/resources.private.json` 或 `src/data/resources.build.json`。
- 欄位名稱不穩定時，清洗流程需使用模糊或防禦式匹配。
- 保留有意義的聯絡資訊，例如電話、email、URL、LINE ID、`@` handle。
- UI 顯示前應清理換行與多餘空白。
- 長文字只能在 ETL 輸出層或 presentation layer 截斷。
- 地圖 marker 渲染前必須排除無效座標。

## 開發

Clone the repository:

```bash
git clone https://github.com/sses09935/web.git
cd web
```

安裝依賴：

```bash
npm install
```

`npm install` 會自動執行 `npm run prepare:data`。沒有私有資料時，專案會使用公開合成範例資料。

啟動本機開發：

```bash
npm run dev
```

Local development does not require secrets. If deployment-specific public metadata is needed, copy `.env.example` to `.env.local` and update only non-sensitive values.

開發入口重點：

- `src/app/page.tsx`: 主要派案與查詢工作台。
- `src/components/Map.tsx`: Maplibre 地圖互動。
- `src/components/ResourceCard.tsx`: 資源卡片。
- `src/components/ResourceDashboard.tsx`: 資源統計。
- `src/lib/resourceUtils.ts`: 資料正規化與查詢輔助。
- `src/data/resourceDataset.ts`: 前端資料匯入與統計入口。
- `src/data/resources.public.json`: public-safe 合成範例資料。
- `src/data/resources.build.json`: 本機產生的 ignored build data。

地圖元件必須維持 client-only 載入，使用 `next/dynamic(..., { ssr: false })`。不得在 SSR 階段執行瀏覽器專用 API。

## 渲染與互動限制

- 專案只支援 static export: `output: 'export'`。
- 不使用 `getServerSideProps`。
- 不建立 dynamic API routes。
- 不依賴 Node.js server runtime 功能。
- 首頁需保留 `isMounted` gate，避免 hydration mismatch。
- 初始狀態需保持空資料顯示，不預設渲染卡片或 markers。
- 大量列表使用 progressive rendering，例如 `INITIAL_DISPLAY_COUNT` 與滾動/載入更多機制。
- 所有互動元素都必須可鍵盤聚焦與操作。
- 篩選與導覽狀態變更需使用 `aria-live="polite"` 或等效語意公告。

## 測試與驗證

常用驗證命令：

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm run test:memory
npm run check:docs
npm run build
```

`npm run check:docs` 會從 `src/data/resources.build.json` 重新計算資料筆數與有效座標數，確認資料 manifest 與公開文件沒有回到真實資料硬編指標或過度公開來源宣稱。

`npm run test:all` 會執行 unit、e2e、memory tests，但不包含 lint、文件漂移檢查與 build。

Playwright e2e 與 memory tests 預設使用 `http://localhost:3000`，執行前需先啟動本機開發站台。

## 部署

部署產物由 Next.js static export 產生：

```bash
npm run build
```

Static preview:

```bash
npm run preview:static
```

輸出目錄：

- `out/`

Firebase Hosting 設定：

- `firebase.json` 的 `hosting.public` 指向 `out`
- `.firebaserc` 的 default project 是 `ntuh-beihu-poc`

Firebase Hosting 應使用本地靜態產物部署。部署前至少確認 `out/index.html`、`out/dashboard.html`、`out/404.html` 與 `out/maplibre-gl-csp-worker.js` 存在。

## 安全與 PoC 邊界

本專案的安全設計定位是「威懾、追蹤、降低低階誤用摩擦」，不是「防止外洩」。靜態前端只要把資料送到瀏覽器，就不能保證阻止使用者複製、截圖、攔截或自動化讀取。

- `SecurityProvider`: 提供環境提示與低階誤用阻擋，例如阻擋常見快捷鍵、右鍵選單與非預期展示環境；這不是正式授權機制。
- `ClipboardGuard` / ZWC: 對複製內容加入可解碼的來源線索，支援事後追蹤；不保證阻止複製。
- `WatermarkOverlay`: 提高截圖流通後的可追責性；不保證防截圖。
- `ScrambledText` / Canvas text: 增加簡單 DOM scraping 成本；不對抗有能力的瀏覽器自動化。
- Honeypot / hidden footer noise: 提供爬蟲噪音與偵測線索；不是 bot 防護。

若要真正保護敏感資料，需要登入、伺服器端授權、最小揭露、正式 audit log 與組織層 DLP。本 PoC 目前是靜態派案展示與作業輔助工具，不是正式敏感資料保護系統。

## Contributing

Issues and pull requests are welcome. Read `CONTRIBUTING.md` before making changes, especially the static export, accessibility, data, and security wording rules.

## Roadmap

Useful starter areas for issues or pull requests:

- Improve accessibility regression coverage.
- Expand deployment documentation for static hosting.
- Improve private data loading documentation and sample-data coverage.
- Add small, well-scoped UI resilience tests.

Please do not manually edit private/generated resource JSON, rewrite historical documents, or commit generated caches unless maintainers explicitly approve it.

## Security reporting

If you discover a vulnerability, do not open a public issue. Follow `SECURITY.md` and report it privately.

## License

MIT. See `LICENSE`.

## 已知限制與風險

- 資料時效依賴來源 Excel 的更新頻率。
- 部分地址、行政區或座標可能缺漏或不精準。
- 靜態 PoC 無 server-side auth、API routes、SSR 或後端稽核流程。
- 瀏覽器端威懾與追蹤只能降低低階誤用摩擦，不能等同正式資安控管或資料外洩防護。
- `next@16.2.6` 目前仍宣告 `postcss@8.4.31`；本專案暫以 npm `overrides` 將其子依賴釘至 `postcss@8.5.15`，待 Next.js 官方更新後再移除 override。
- 地圖底圖、瀏覽器權限與 CSP 設定可能影響 Maplibre 載入。
- 本系統不能取代正式醫療、長照或派案系統的法定流程。

## 維護原則

- Accessibility 優先於視覺微調。
- Data integrity 優先於快速修補。
- 保持 static export compatibility。
- 對 optional fields 做 null-check 後再渲染。
- 不渲染空 row、空 button 或缺資料 placeholder。
- 大幅重構前先建立 checkpoint 或 commit。
- 歷史文件與歸檔文件採 append-only 或 localized diff，不做破壞性覆寫。
