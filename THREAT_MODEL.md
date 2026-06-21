# THREAT_MODEL.md

NTUH 北護長照資源協作 PoC 的威脅模型與安全邊界說明。

本文件的定位是把 `README.md`「安全與 PoC 邊界」一節升級為正式威脅模型，
集中說明：保護什麼資料、對抗哪些對手、每個瀏覽器端控制「做什麼／不做什麼」、
以及明確的 non-goals。

## 本文件與其他文件的關係

- `THREAT_MODEL.md`（本文件）：安全邊界、資產、對手分類、控制對映、non-goals。
- `SECURITY.md`：**漏洞通報流程**與 supported scope。請勿把威脅模型內容混進該檔，
  也不要把通報流程搬到本檔。
- `README.md`：專案概觀與「安全與 PoC 邊界」摘要，細節以本文件為準。
- `AGENTS.md`「Security Component Invariants」：維護這些元件時的不可違反規則。

若三者描述出現漂移，以本文件為單一事實來源，並回頭修正其他檔，而不是兩處各自編輯。

## 核心定位（先讀這段）

本專案是**靜態匯出（`output: 'export'`）的概念驗證**：沒有 server-side
authentication、沒有 server-side authorization、沒有 API routes、沒有病歷整合、
沒有後端稽核。

因此一個必須誠實面對的前提是：

> **瀏覽器端控制是「威懾、追蹤、提高低階誤用成本」，不是「防止外洩」。**
> 一旦資料送進瀏覽器，就無法保證阻止複製、截圖、攔截或自動化讀取。

- 瀏覽器端控制 **不是** authentication（不驗證你是誰）。
- 瀏覽器端控制 **不是** authorization（不決定你能看什麼）。
- 本專案 **不是** 正式醫療或長照生產系統。
- 敏感資料 **不應** 被放進靜態前端 bundle（見「資產」與「資料邊界」）。

## 資產（要保護什麼）

| 資產 | 說明 | 目前所在 | 敏感度 |
| --- | --- | --- | --- |
| 正式／合作來源資源資料 | 真實長照機構聯絡與服務資料（ETL 私有輸出） | 僅本機／私有環境，由 `.gitignore` 排除，**不進 public repo、不進 public bundle** | 高 |
| 合成範例資料 | `src/data/resources.public.json`，公開建置使用 | 公開 repo + 公開 bundle | 低（可公開） |
| 聯絡欄位 | 電話、email、URL、LINE ID、`@` handle | 隨資料集所在層級 | 視來源而定 |
| 來源歸屬／浮水印線索 | ZWC 指紋、浮水印、footer 噪音 | 公開原始碼 + 執行期 DOM | 低（追蹤用途，刻意可見於原始碼） |
| 部署中介資料 | 非敏感 public metadata | `.env.local`（非機密值） | 低 |

關鍵不變量：**公開站或 fork 在沒有私有資料時只渲染合成範例資料**。
任何真實資料的可公開性必須另外取得明確授權；無法確認授權時，不得放入 public repo
或公開 bundle。這條邊界（資料是否進 bundle）才是本專案真正的保護界線，
瀏覽器端控制只是在這條界線之內降低誤用摩擦。

## 對手分類（Adversary classes）

威脅模型針對三類對手，能力遞增。每個控制只對應到它真正能影響的對手層級。

1. **隨手使用者（Casual user）**
   - 一般瀏覽者、家屬、未受訓的使用者。
   - 行為：右鍵另存、選取複製貼上、隨手截圖、`Ctrl/Cmd+U` 看原始碼、開 DevTools。
   - 動機低、不會繞過 JavaScript。瀏覽器端控制主要對抗的就是這一層。

2. **一般爬蟲（Crawler / bot）**
   - 搜尋引擎、通用抓取器、不執行或淺執行 JavaScript 的擷取腳本。
   - 行為：抓 HTML、跟連結、解析靜態 DOM。
   - 部分控制可對其增加噪音與偵測線索，但無法阻止會執行 JS 的爬蟲。

3. **有能力的自動化（Capable automation）**
   - headless 瀏覽器、手寫腳本的對手、會執行 JS／讀 canvas／解碼 ZWC／直接抓
     bundle 內 JSON 的人。
   - 行為：完整渲染頁面、繞過鍵盤／右鍵攔截、還原打亂文字、OCR 截圖、直接讀網路請求。
   - **本專案的瀏覽器端控制對這一層幾乎沒有阻擋力**；只剩「追蹤線索」具有殘餘價值
     （事後可追責，而非事前防堵）。

## 控制對映（每個元件：威脅 / 做什麼 / 不做什麼 / 殘餘風險）

掛載位置：`SecurityProvider` 與 `WatermarkOverlay` 於 `src/app/layout.tsx` 包住全站；
其餘元件在使用處掛載。下表「殘餘風險」一律以最高能力對手（capable automation）為基準。

### SecurityProvider（`src/components/SecurityProvider.tsx`）

- **對應對手**：隨手使用者。
- **做什麼**：mount 後檢查 hostname／protocol（allow-list 外或 `file:` 顯示環境提示頁）；
  攔截 `F12`、DevTools／Console／View-Source 快捷鍵與右鍵選單；非預期環境時定期
  `console.clear()`。
- **不做什麼**：不是 authentication，也不是 authorization。不能阻止任何人從選單開
  DevTools、用 headless 瀏覽器、或直接抓靜態檔案。環境檢查在 client 端，可被改寫。
- **殘餘風險（高對手）**：完全可繞過。allow-list 與檢查邏輯都在公開 bundle 內，
  停用 JS 或改 host 即失效。**價值僅止於對隨手使用者增加摩擦。**

### ClipboardGuard（`src/lib/ClipboardGuard.ts` + `src/hooks/useClipboardGuard.ts`）

- **對應對手**：隨手使用者（複製行為）；對 capable automation 提供「事後追蹤」線索。
- **做什麼**：在 copy／cut 事件後，於複製內容附上可見來源聲明，以及一段零寬字元（ZWC）
  指紋（`SRC_<timestamp>_<sessionHash>`），可由 `window.__CG.decode()` 還原以支援事後溯源。
- **不做什麼**：**不保證阻止複製**。不加密、不阻擋手動重打、截圖、或直接讀 DOM／bundle。
  指紋是可見於原始碼的追蹤訊號，不是存取控制。
- **殘餘風險（高對手）**：可輕易剝除——重新輸入、貼到純文字後過濾 ZWC、或直接從來源讀取
  原文皆可規避指紋。對手知道機制後追蹤線索即失效。`decode()` 為 E2E 測試介面（勿當 debug 移除）。

### WatermarkOverlay（`src/components/WatermarkOverlay.tsx`）

- **對應對手**：隨手使用者（截圖流通後的可追責性）。
- **做什麼**：覆蓋漂移、時間相依透明度的浮水印（提供截圖時間線索）；以 `MutationObserver`
  偵測浮水印被移除／隱藏並重新渲染，提高隨手移除成本。
- **不做什麼**：**不保證防截圖**。低透明度浮水印可被裁切、用乾淨 viewport 重繪、或停用 JS 後消失。
- **殘餘風險（高對手）**：可移除或避開（停用 JS、直接讀資料層、外部截圖工具）。
  價值在「截圖外流後的事後追責線索」，而非阻止截圖本身。

### ScrambledText（`src/components/ScrambledText.tsx`）

- **對應對手**：一般爬蟲與隨手 DOM 擷取。
- **做什麼**：client 端 Fisher-Yates 打亂字元顯示順序（以 CSS `order` 還原視覺），
  增加直接 DOM 文字擷取成本。SSR 階段刻意輸出空節點以避免 hydration mismatch，
  真實文字以外層 `aria-label` 提供給螢幕閱讀器與會執行 JS 的搜尋引擎。
- **不做什麼**：不對抗瀏覽器自動化。真實文字仍在 `aria-label` 與 props 內，會執行 JS 的
  抓取器可直接讀取。
- **殘餘風險（高對手）**：幾乎為零阻擋——讀 `aria-label`、依 `order` 還原、或直接讀
  bundle 資料即可取得原文。請維持「SSR 空節點 + `aria-label`」契約不變。

### ProtectedText（`src/components/ProtectedText.tsx`）

- **對應對手**：一般爬蟲與隨手複製（把文字畫進 canvas，無法直接選取）。
- **做什麼**：mount 後以 `<canvas>` 繪製文字，避免直接 DOM 選取／複製；同時注入 JSON-LD
  與 `aria-label` fallback 以維持 SEO 與無障礙。
- **不做什麼**：不阻止截圖、OCR，或從 JSON-LD／`aria-label`／bundle 讀取原文。
  為了無障礙與 SEO，原文一定存在於可讀來源。
- **殘餘風險（高對手）**：可由 JSON-LD／`aria-label`／來源資料直接取得，或對 canvas OCR。
  僅對「選取複製」這個動作增加摩擦。

### Honeypot / 隱藏 footer 噪音（`src/components/Footer.tsx`）

- **對應對手**：一般爬蟲（偵測線索）。
- **做什麼**：在 DOM 內保留 visually-hidden、`aria-hidden` 的重複版權字串，作為爬蟲噪音與
  偵測訊號。可見 footer 才是給真實使用者與無障礙設備看的。
- **不做什麼**：**不是 bot 防護**。不阻止抓取、不識別身分、不阻擋任何請求。
- **殘餘風險（高對手）**：可被忽略或過濾；對會判斷可見性的抓取器無效。僅為弱偵測線索。

### 對映總表

| 元件 | 主要對手 | 處理的威脅 | 殘餘風險（capable automation） |
| --- | --- | --- | --- |
| SecurityProvider | 隨手使用者 | DevTools／右鍵／View-Source 摩擦、環境提示 | 完全可繞過；非授權 |
| ClipboardGuard | 隨手使用者 / 事後追蹤 | 複製來源溯源（ZWC 指紋） | 指紋可剝除；不阻止複製 |
| WatermarkOverlay | 隨手使用者 | 截圖外流後可追責 | 可移除／避開；不防截圖 |
| ScrambledText | 爬蟲 / 隨手擷取 | 增加 DOM 文字擷取成本 | `aria-label`／bundle 可直接讀 |
| ProtectedText | 爬蟲 / 隨手複製 | 阻止直接選取複製 | JSON-LD／OCR 可還原 |
| Honeypot footer | 爬蟲 | 爬蟲噪音／偵測線索 | 可忽略；非 bot 防護 |

## Non-goals（明確不做的事）

本 PoC **不**提供、也**不宣稱**提供以下任何能力：

- **不防止資料外洩、複製、截圖或爬取。** 控制只是摩擦與追蹤。
- **不提供 authentication。** 沒有登入、沒有身分驗證、沒有 session 授權。
- **不提供 authorization。** 沒有 server 端的「誰能看什麼」控制；所有送到瀏覽器的資料
  即視為已揭露。
- **不對抗有能力的自動化。** headless 瀏覽器、腳本對手、直接讀 bundle 者不在可阻擋範圍。
- **不加密前端資料**，也不對前端內容做存取控制。
- **不是 DRM、不是 DLP、不是稽核系統。**
- **不是醫療／長照生產系統**，不取代法定派案、病歷整合或合規流程。
- **不保證 bot 防護**；honeypot 與噪音只是偵測線索。
- 客戶端環境檢查（host/protocol、DevTools 攔截）**不是安全邊界**，只是 PoC 摩擦。

## 真正的保護需要什麼

若要實際保護敏感長照資料，瀏覽器端摩擦遠遠不夠，需要在架構層導入：

- **Authentication（登入）**：可信任的身分提供者，每個請求都需通過驗證，
  匿名請求無法取得敏感資料。
- **Server-side authorization**：在伺服器端依角色／情境決定「誰能看哪一筆」，
  並落實**最小揭露**——瀏覽器永遠不應收到使用者無權看的資料。
- **資料最小化與遮罩**：依角色回傳必要欄位，敏感聯絡資訊在後端遮罩或省略，
  而不是送到前端再用 JS 遮蔽。
- **Audit log（稽核記錄）**：在伺服器端記錄誰於何時存取／匯出哪些資料，
  以支援事後調查與課責（瀏覽器端 ZWC／浮水印只是無權威來源的線索，無法取代）。
- **組織層 DLP 與存取治理**：資料外流偵測、匯出控管、權限定期審查、金鑰與憑證輪替。
- **傳輸與儲存安全**：強制 TLS、敏感資料靜態加密、機密集中管理（不入 repo、不入 bundle）。

在具備上述能力之前，唯一可靠的控制仍是本文件「資產」一節的邊界：
**不把不可公開的資料放進靜態前端 bundle。**

## 維護提醒

- 變更任一保護元件時，必須在 PR 中明確標示（見 `AGENTS.md`），不可作為無關變更的副作用。
- 不得在程式碼註解或文件中加入「可防止外洩／複製／截圖／爬取」之類的宣稱。
- 若新增、移除或調整保護元件，請同步更新本文件的對映總表與 non-goals。
