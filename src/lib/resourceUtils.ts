import { Resource } from "@/types";

type RawResourceLike = Record<string, unknown>;

export function compactText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeResource(raw: RawResourceLike, stableLabel?: string): Resource {
  return {
    id: compactText(raw.id),
    category: compactText(raw.category) as Resource["category"],
    subCategory: compactText(raw.subCategory) as Resource["subCategory"],
    name: compactText(raw.name),
    phone: compactText(raw.phone),
    address: compactText(raw.address),
    navAddress: compactText(raw.navAddress) || undefined,
    district: compactText(raw.district) || undefined,
    latitude: nullableNumber(raw.latitude),
    longitude: nullableNumber(raw.longitude),
    targetAudience: compactText(raw.targetAudience),
    providedResources: compactText(raw.providedResources),
    referralMethod: compactText(raw.referralMethod),
    notes: compactText(raw.notes),
    stableLabel,
  };
}

export function hasValidCoordinates(resource: Pick<Resource, "latitude" | "longitude">): boolean {
  const { latitude, longitude } = resource;

  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function hasUsableMapAddress(resource: Pick<Resource, "address">): boolean {
  const address = compactText(resource.address);
  return address !== "" && !address.includes("無實體地址");
}

export function hasMapLocation(resource: Pick<Resource, "latitude" | "longitude" | "address">): boolean {
  return hasValidCoordinates(resource) && hasUsableMapAddress(resource);
}

export function resourceMatchesQuery(resource: Resource, query: string): boolean {
  const normalizedQuery = compactText(query).toLowerCase();
  if (normalizedQuery === "") return true;

  const fields = [
    resource.name,
    resource.phone,
    resource.address,
    resource.navAddress,
    resource.district,
    resource.category,
    resource.subCategory,
    resource.targetAudience,
    resource.providedResources,
    resource.referralMethod,
    resource.notes,
  ];

  return fields.some((field) => compactText(field).toLowerCase().includes(normalizedQuery));
}
