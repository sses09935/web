import fs from "fs";
import path from "path";
import {
  compactText,
  hasMapLocation,
  hasValidCoordinates,
  normalizeResource,
  resourceMatchesQuery,
} from "@/lib/resourceUtils";
import { Resource } from "@/types";

const resourcesPath = path.resolve(__dirname, "../../src/data/resources.build.json");
const rawResources = JSON.parse(fs.readFileSync(resourcesPath, "utf-8")) as Record<string, unknown>[];

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: "test-1",
    category: "照顧與專業服務",
    subCategory: "居家服務",
    name: "測試單位",
    phone: "02-1234-5678",
    address: "臺北市萬華區測試路1號",
    navAddress: "臺北市萬華區測試路1號",
    district: "臺北市萬華區",
    latitude: 25.03,
    longitude: 121.5,
    targetAudience: "",
    providedResources: "",
    referralMethod: "",
    notes: "",
    stableLabel: "A1",
    ...overrides,
  };
}

describe("resource canonical schema", () => {
  test("canonical JSON uses ETL output fields instead of legacy UI aliases", () => {
    expect(rawResources.length).toBeGreaterThan(0);
    expect(rawResources.some((res) => "providedResources" in res || "targetAudience" in res || "referralMethod" in res)).toBe(true);

    rawResources.forEach((res) => {
      expect(res).not.toHaveProperty("target");
      expect(res).not.toHaveProperty("resources");
      expect(res).not.toHaveProperty("booking");
    });
  });

  test("normalizeResource compacts display text without mutating source data", () => {
    const normalized = normalizeResource({
      id: "res-test",
      category: "照顧與專業服務",
      subCategory: "居家服務",
      name: " 測試\n單位 ",
      phone: " 02-1234\r\n5678 ",
      address: "臺北市  萬華區\n測試路1號",
      targetAudience: " 長者\n家屬 ",
      providedResources: " 居家\r照顧 ",
      referralMethod: " 電話\n預約 ",
      notes: " 備註\n內容 ",
    });

    expect(normalized.name).toBe("測試 單位");
    expect(normalized.phone).toBe("02-1234 5678");
    expect(normalized.address).toBe("臺北市 萬華區 測試路1號");
    expect(normalized.targetAudience).toBe("長者 家屬");
    expect(normalized.providedResources).toBe("居家 照顧");
    expect(normalized.referralMethod).toBe("電話 預約");
    expect(normalized.notes).toBe("備註 內容");
  });
});

describe("resource search and map guards", () => {
  test("resourceMatchesQuery searches canonical service, target, referral, and notes fields", () => {
    const resource = makeResource({
      targetAudience: "行動不便長者",
      providedResources: "居家照顧與送餐服務",
      referralMethod: "由個案管理師電話轉介",
      notes: "需先確認服務時段",
    });

    expect(resourceMatchesQuery(resource, "送餐")).toBe(true);
    expect(resourceMatchesQuery(resource, "行動不便")).toBe(true);
    expect(resourceMatchesQuery(resource, "電話轉介")).toBe(true);
    expect(resourceMatchesQuery(resource, "服務時段")).toBe(true);
    expect(resourceMatchesQuery(resource, "不存在的關鍵字")).toBe(false);
  });

  test("resourceMatchesQuery is safe when optional text fields are empty", () => {
    const resource = makeResource({
      targetAudience: "",
      providedResources: "",
      referralMethod: "",
      notes: "",
    });

    expect(() => resourceMatchesQuery(resource, "送餐")).not.toThrow();
    expect(resourceMatchesQuery(resource, "送餐")).toBe(false);
  });

  test("hasValidCoordinates rejects null, zero, NaN, and out-of-range coordinates", () => {
    expect(hasValidCoordinates(makeResource())).toBe(true);
    expect(hasValidCoordinates(makeResource({ latitude: null }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ longitude: null }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ latitude: 0 }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ longitude: 0 }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ latitude: Number.NaN }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ latitude: 91 }))).toBe(false);
    expect(hasValidCoordinates(makeResource({ longitude: 181 }))).toBe(false);
  });

  test("hasMapLocation also requires a usable physical address", () => {
    expect(hasMapLocation(makeResource())).toBe(true);
    expect(hasMapLocation(makeResource({ address: "" }))).toBe(false);
    expect(hasMapLocation(makeResource({ address: "無實體地址，請電話洽詢" }))).toBe(false);
  });

  test("processed dataset normalizes all compact display fields without line breaks", () => {
    const normalized = rawResources.map((res) => normalizeResource(res));
    const compactFields = normalized.flatMap((res) => [
      res.name,
      res.phone,
      res.address,
      res.navAddress ?? "",
      res.targetAudience,
      res.providedResources,
      res.referralMethod,
      res.notes,
    ]);

    expect(compactFields.every((value) => !/[\r\n]/.test(compactText(value)))).toBe(true);
  });
});
