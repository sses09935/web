/**
 * 全域字體縮放大小
 */
export type FontSize = "standard" | "large" | "xlarge";

/**
 * 系統主導航頁籤
 */
export type ActiveTab = "home" | "beihu" | "database" | "about";

/**
 * 台大北護本院子導航頁籤
 */
export type BeihuSubTab = "co-care" | "station" | "activities";

/**
 * 長照大總匯四大分類 Key
 */
export type DatabaseGroupKey = "subsidized" | "formal-non-subsidized" | "informal-resources" | "self-pay";

/**
 * 長照資源核心資料型別
 */
export type ResourceCategory = 
  | "照顧與專業服務"
  | "失智專責資源"
  | "喘息與住宿機構"
  | "輔具與交通環境";

export type ResourceSubCategory = 
  | "居家服務" | "老人日照" | "身障日照" | "專業服務" | "家事服務員" 
  | "送餐單位" | "居家醫療整合資源" | "健康維護" | "生活照顧"
  | "失智共同照護中心" | "失智社區服務據點" | "失智專責專區機構" | "團體家屋"
  | "居家喘息" | "社區喘息" | "機構喘息" | "護理之家" | "養護、長期照護" 
  | "精神復健機構(康復之家)" | "身心障礙福利機構"
  | "輔具特約" | "輔具租賃" | "交通接送" | "身障資源中心" | "社區資源" 
  | "C單位" | "經濟安全";

export interface Resource {
  id: string;
  category: ResourceCategory;
  subCategory: ResourceSubCategory;
  name: string;
  phone: string;
  address: string;
  navAddress?: string;
  district?: string;
  latitude: number | null;
  longitude: number | null;
  targetAudience: string;
  providedResources: string;
  referralMethod: string;
  notes: string;
  stableLabel?: string;
}
