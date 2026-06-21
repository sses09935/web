# 正式資源檔資料更新 Checklist

> **Append-only 文件。** 流程變更請以新增條目 / 附註方式紀錄,不要破壞性覆寫既有步驟(見 [`AGENTS.md`](../AGENTS.md) 文件規則)。
>
> 對應 issue:[#3 Add data update checklist for canonical resource files](https://github.com/sses09935/web/issues/3)。

本 checklist 把資料更新流程鎖死成一條單向管線,讓任何維護者不必猜流程就能安全更新正式資源資料,且每一步都有可重現的驗證閘。

---

## 0. 鎖定的資料管線

```
來源 Excel
  └─▶ _raw_data/                         (私有,git-ignored)
        └─▶ python _scripts/data_cleaning.py
              ├─▶ _cleaned_data/         (私有,git-ignored:cleaned_resources.json / .csv / cleaning_report.json)
              └─▶ src/data/resources.json (legacy-private,腳本產生,不可手改)
                    └─▶ npm run prepare:data
                          ├─▶ src/data/resources.build.json     (前端實際匯入,不可手改)
                          └─▶ src/data/resource-manifest.json   (mode / recordCount,不可手改)
                                └─▶ npm run check:docs           (最終 gate)
```

**前端只匯入 `src/data/resources.build.json`。** 上游每一層都是它的輸入,任一層手改都會在 `check:docs` 或 build 時破壞一致性。

---

## 1. 逐步 checklist 與驗證閘

### 步驟 1 — 放置來源 Excel 到 `_raw_data/`

`_scripts/data_cleaning.py` 期望兩個固定來源檔(若上游檔名改變,需同步更新腳本中的路徑常數,不要改腳本以外的東西去遷就):

- `_raw_data/1.正式及非正式資源單位(1150323更新).xlsx` — 主資源表
- `_raw_data/資源經緯度.xlsx` — 經緯度對照表

**驗證閘:** 兩個檔都存在。缺檔時腳本會直接中止(腳本內 `os.path.exists` 檢查),不會產生半成品。

### 步驟 2 — 執行清洗腳本

```bash
python _scripts/data_cleaning.py
```

輸出:

- `_cleaned_data/cleaned_resources.json`、`cleaned_resources.csv`
- `_cleaned_data/cleaning_report.json`(逐 sheet 的 raw/cleaned 筆數、經緯度匹配率、行政區分類數、未匹配樣本)
- `src/data/resources.json`(同步寫入的 legacy-private 輸出)

**驗證閘:** 打開 `cleaning_report.json`,確認:
- `total_cleaned_rows_exported` 與預期量級相符(沒有整批掉資料)。
- 各 sheet 的 `match_rate` 沒有異常崩跌(代表經緯度對照表對齊正常)。

### 步驟 3 — 座標有效性閘(對應持續追蹤的 ~11% 缺漏)

部分來源地址 / 行政區 / 座標本就缺漏或不精準,前端會在渲染地圖 marker 前過濾無效座標(`src/lib/resourceUtils.ts` 的 `hasValidCoordinates`),`check:docs` 也會回報「有效座標 / 缺漏或無效座標」。

**驗證閘:**
- 檢視 `cleaning_report.json` 的經緯度匹配率,確認缺漏比例落在歷來追蹤的量級(約一成上下),沒有突然惡化。
- 無效座標(`0,0`、超出 lat∈[-90,90] / lng∈[-180,180]、非有限值)應被前端過濾而非渲染成錯誤點。若缺漏比例明顯上升,先回頭修經緯度對照表,不要在前端硬塞假座標。

> 不要為了「補滿座標」而手改任何 canonical JSON;缺漏要從來源或 `data_cleaning.py` 的對照邏輯解決。

### 步驟 4 — 必要欄位保留閘

清洗時必須保留以下聯絡 / 轉介資訊,不可被截斷或正規化掉:

- 電話 `phone`
- email
- URL(`http` / `www`)
- LINE ID
- `@` handle

腳本的 `simplify_referral` 會偵測 `LINE` / `http` / `www` / `電話：` / `@` 並保留這類欄位。

**驗證閘:** 抽查 `cleaned_resources.json` 數筆含上述資訊的記錄,確認聯絡方式完整可用(沒有被長度限制或文字簡化吃掉關鍵字元)。

### 步驟 5 — Whitespace 正規化閘

換行與多餘空白只能在 ETL 輸出層或 presentation layer 處理。腳本已將 `\n` 轉空白並 `strip`、把連續空白折成單一空白。

**驗證閘:** 抽查記錄的 `name` / `address` / `notes`,確認沒有殘留換行或頭尾空白。

### 步驟 6 — 產生 build 產物

```bash
npm run prepare:data
```

`prepare:data` 依序尋找資料來源並產生 `resources.build.json` + `resource-manifest.json`,候選順序:

1. `PRIVATE_RESOURCE_DATA_PATH` 指向的 JSON
2. `src/data/resources.private.json`
3. `src/data/resources.json`（步驟 2 的輸出)
4. `src/data/resources.public.json`（公開合成範例)

**驗證閘 — 確認選到正確來源:** 若同時存在 `resources.private.json`,它會**蓋過**步驟 2 寫出的 `resources.json`。要讓剛清洗的資料真的進到 build,擇一:
- 讓 `resources.json` 成為最高優先的私有來源(移除 / 更新 `resources.private.json`),或
- 設 `PRIVATE_RESOURCE_DATA_PATH=src/data/resources.json` 強制指定,或
- 把清洗輸出放到 `resources.private.json`。

執行後檢查 `resource-manifest.json` 的 `mode`(應為 `private`)、`sourceKind` 與 `recordCount` 是否符合本次更新。

### 步驟 7 — 最終 gate:`npm run check:docs`

```bash
npm run check:docs
```

此步驟會從 `resources.build.json` 重新計算總筆數與有效座標,並驗證:
- `resource-manifest.json` 的 `recordCount` 與 `resources.build.json` 實際筆數一致。
- `page.tsx` 與 `Map.tsx` 的雷達半徑一致。
- README / 公開原始碼沒有回填舊的硬編真實資料指標或過度公開來源宣稱。

通過後 console 會印出資料模式、總筆數、有效座標、缺漏或無效座標、雷達半徑——這就是本次更新的官方數據快照。

### 步驟 8 — 文件更新(不硬編私有指標)

若資料量或座標覆蓋狀態改變:

- 依 README 「目前資料狀態」段落的寫法,以**描述性**方式更新(總筆數 / 有效座標 / 缺漏由 `check:docs` 計算得出),**不要把私有資料的實際數字硬編進 README、CONTRIBUTING 或公開原始碼**——`check:docs` 會擋下舊式硬編指標。
- 若資料載入行為有變,同步更新文件漂移檢查涵蓋範圍後才算完成。

完整大型驗證(視變更影響面)依序:`npm run lint` → `npm run check:docs` → `npm run build` → `npm run test:unit` → `npm run test:e2e` → `npm run test:memory`。

---

## 2. 不可手改清單(canonical / 生成檔)

以下檔案一律由腳本產生,**禁止手動編輯**;要改內容請回到來源 Excel 或 `data_cleaning.py`:

- `src/data/resources.json`(`data_cleaning.py` 輸出)
- `src/data/resources.private.json`(私有來源,若採用)
- `src/data/resources.build.json`(`prepare:data` 輸出,前端匯入)
- `src/data/resource-manifest.json`(`prepare:data` 輸出)
- `_cleaned_data/`(`data_cleaning.py` 輸出)

---

## 3. 不可 commit 清單(私有 / 敏感)

下列路徑由 `.gitignore` 排除,公開 repo **不得**追蹤:

- `_raw_data/`(來源 Excel)
- `_cleaned_data/`(清洗中間產物)
- `src/data/resources.json`、`src/data/resources.private.json`
- `src/data/resources.build.json`、`src/data/resource-manifest.json`

公開 repo 只保留一份合成範例 `src/data/resources.public.json`。正式或合作來源資料的可公開性必須另外取得明確授權;無法確認授權時,不得放入 public repo。

---

## 4. honeypot / ZWC 注入屬於 render-time,不在本管線

issue #3 提到 honeypot / ZWC(zero-width characters)注入步驟「若屬 ETL 環節」。**經確認,這些不是 ETL 環節。** `data_cleaning.py` 不做、也不應做任何 ZWC 或 honeypot 注入。

這類控制是瀏覽器 / 渲染時的低階誤用威懾與可追蹤性機制(`ClipboardGuard` / ZWC、`WatermarkOverlay`、honeypot footer noise),屬於前端執行期,定位是 friction / traceability / deterrence,**不是**資料外洩防護,也不是 ETL 資料正規化的一部分。細節見 [`THREAT_MODEL.md`](../THREAT_MODEL.md) 與 README 安全段落。

把這類注入混進 canonical 資料會污染 `phone` / `email` / `URL` 等必要欄位的可用性,並破壞步驟 4 的欄位保留閘——因此刻意排除在本管線之外。

---

## 相關文件

- [`README.md`](../README.md) — 資料載入策略、ETL 規則、目前資料狀態
- [`AGENTS.md`](../AGENTS.md) — Data Rules 與 Documentation Rules
- [`THREAT_MODEL.md`](../THREAT_MODEL.md) — 安全邊界與 render-time 控制
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — 部署與 static-export 契約
