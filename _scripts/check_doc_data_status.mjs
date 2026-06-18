import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const resources = JSON.parse(readProjectFile("src/data/resources.build.json"));
const manifest = JSON.parse(readProjectFile("src/data/resource-manifest.json"));
const totalResources = resources.length;
const validCoordinates = resources.filter(
  (resource) => {
    const latitude = Number(resource.latitude);
    const longitude = Number(resource.longitude);

    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude !== 0 &&
      longitude !== 0 &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  },
).length;
const invalidCoordinates = totalResources - validCoordinates;

const appSource = readProjectFile("src/app/page.tsx");
const mapSource = readProjectFile("src/components/Map.tsx");
const appRadiusMatch = appSource.match(/dist\s*>\s*([0-9]+(?:\.[0-9]+)?)/);
const mapRadiusMatch = mapSource.match(
  /turf\.circle\(\s*center\s*,\s*([0-9]+(?:\.[0-9]+)?)/,
);

const errors = [];

if (!Array.isArray(resources)) {
  errors.push("src/data/resources.build.json 必須是 JSON array。");
}

if (!["private", "sample"].includes(manifest.mode)) {
  errors.push("src/data/resource-manifest.json 的 mode 必須是 private 或 sample。");
}

if (manifest.recordCount !== totalResources) {
  errors.push(
    `resource-manifest recordCount (${manifest.recordCount}) 與 resources.build.json 筆數 (${totalResources}) 不一致。`,
  );
}

if (!appRadiusMatch) {
  errors.push("src/app/page.tsx 中找不到雷達篩選半徑。");
}

if (!mapRadiusMatch) {
  errors.push("src/components/Map.tsx 中找不到雷達覆蓋圈半徑。");
}

const appRadius = appRadiusMatch?.[1];
const mapRadius = mapRadiusMatch?.[1];

if (appRadius && mapRadius && appRadius !== mapRadius) {
  errors.push(`雷達半徑不一致：page.tsx=${appRadius}km, Map.tsx=${mapRadius}km。`);
}

const radarRadius = appRadius ?? mapRadius;
const radarLabel = radarRadius ? `${radarRadius}km` : null;

const publicSourcesToCheck = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/dashboard/page.tsx",
];
const docsToCheck = ["README.md", "CONTRIBUTING.md"];
const readme = readProjectFile("README.md");

const requiredReadmeTerms = [
  "src/data/resources.public.json",
  "src/data/resources.build.json",
  "src/data/resources.json",
  "PRIVATE_RESOURCE_DATA_PATH",
];

for (const term of requiredReadmeTerms) {
  if (!readme.includes(term)) {
    errors.push(`README.md 缺少私有資料載入說明：${term}。`);
  }
}

for (const docPath of [...docsToCheck, ...publicSourcesToCheck]) {
  const content = readProjectFile(docPath);

  if (/607\s*筆|536\s*筆|71\s*筆|站內數據皆取自政府與公開資料/.test(content)) {
    errors.push(`${docPath} 仍含舊的真實資料硬編指標或公開來源宣稱。`);
  }

  if (/559\s*筆|48\s*筆|3km Radar|3\s*公里/.test(content)) {
    errors.push(`${docPath} 仍含更舊資料狀態或舊雷達半徑。`);
  }
}

if (errors.length > 0) {
  console.error("文件資料狀態檢查失敗：");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  [
    "文件資料狀態檢查通過。",
    `資料模式：${manifest.mode} (${manifest.sourceKind})`,
    `總筆數：${totalResources}`,
    `有效座標：${validCoordinates}`,
    `缺漏或無效座標：${invalidCoordinates}`,
    radarLabel ? `雷達半徑：${radarLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n"),
);
