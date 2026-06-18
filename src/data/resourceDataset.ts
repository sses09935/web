import resourcesData from "./resources.build.json";
import resourceManifest from "./resource-manifest.json";
import type { Resource } from "@/types";
import { hasValidCoordinates, normalizeResource } from "@/lib/resourceUtils";

export type ResourceDatasetMode = "private" | "sample";

export type ResourceDatasetManifest = {
  mode: ResourceDatasetMode;
  sourceKind: "private-env" | "private-local" | "legacy-private" | "sample";
  generatedAt: string;
  recordCount: number;
};

const manifest = resourceManifest as ResourceDatasetManifest;
const resources = (resourcesData as Record<string, unknown>[]).map((resource) =>
  normalizeResource(resource),
);

const validCoordinates = resources.filter(hasValidCoordinates).length;

export const RESOURCE_RADAR_RADIUS_KM = 1.5;
export const resourceDataset: Resource[] = resources;
export const resourceDatasetManifest = manifest;
export const resourceDatasetLabel =
  manifest.mode === "private" ? "私有建置資料" : "公開範例資料";

export const resourceDatasetStats = {
  totalResources: resources.length,
  validCoordinates,
  invalidCoordinates: resources.length - validCoordinates,
  radarRadiusKm: RESOURCE_RADAR_RADIUS_KM,
} as const;
