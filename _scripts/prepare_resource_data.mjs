import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const srcDataDir = path.join(projectRoot, "src", "data");

const outputDataPath = path.join(srcDataDir, "resources.build.json");
const outputManifestPath = path.join(srcDataDir, "resource-manifest.json");
const publicSamplePath = path.join(srcDataDir, "resources.public.json");
const forceSampleMode = process.env.RESOURCE_DATA_MODE === "sample";

const privateCandidates = [
  process.env.PRIVATE_RESOURCE_DATA_PATH
    ? {
        mode: "private",
        sourceKind: "private-env",
        path: path.resolve(projectRoot, process.env.PRIVATE_RESOURCE_DATA_PATH),
      }
    : null,
  {
    mode: "private",
    sourceKind: "private-local",
    path: path.join(srcDataDir, "resources.private.json"),
  },
  {
    mode: "private",
    sourceKind: "legacy-private",
    path: path.join(srcDataDir, "resources.json"),
  },
];

const sampleCandidate = {
  mode: "sample",
  sourceKind: "sample",
  path: publicSamplePath,
};

const candidates = [
  ...(forceSampleMode ? [] : privateCandidates),
  {
    ...sampleCandidate,
  },
].filter(Boolean);

function readResourceArray(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Resource data must be a JSON array: ${filePath}`);
  }
  return parsed;
}

mkdirSync(srcDataDir, { recursive: true });

const selected = candidates.find((candidate) => existsSync(candidate.path));
if (!selected) {
  throw new Error("No resource dataset found. Expected resources.public.json to exist.");
}

const resources = readResourceArray(selected.path);
copyFileSync(selected.path, outputDataPath);
writeFileSync(
  outputManifestPath,
  `${JSON.stringify(
    {
      mode: selected.mode,
      sourceKind: selected.sourceKind,
      generatedAt: new Date().toISOString(),
      recordCount: resources.length,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Prepared ${selected.mode} resource dataset (${selected.sourceKind}, ${resources.length} records).`,
);
