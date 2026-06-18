"use client";

import { distance, point } from "@turf/turf";
import dynamic from "next/dynamic";
import React, { useState, useEffect, useMemo, useRef, useCallback, memo, Suspense } from "react";
import Link from "next/link";
import PrescriptionModal from "@/components/PrescriptionModal";
import { QRCodeSVG } from "qrcode.react";
import { BudgetProvider } from "@/contexts/BudgetContext";
import BudgetSandbox from "@/components/BudgetSandbox";
import Footer from "@/components/Footer";

const MemoizedListItem = memo(({
  res, isActive, isExpanded, onClick, onToggleExpand, registerRef
}: {
  res: Resource;
  isActive: boolean;
  isExpanded: boolean;
  onClick: (res: Resource) => void;
  onToggleExpand: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) => (
  <div ref={(el) => registerRef(res.id, el)}>
    <ResourceCard
      res={res}
      isActive={isActive}
      isExpanded={isExpanded}
      onClick={onClick}
      onToggleExpand={onToggleExpand}
    />
  </div>
));
MemoizedListItem.displayName = 'MemoizedListItem';
import {
  Search,
  Accessibility,
  Heart,
  Sun,
  Moon,
  QrCode,
  RefreshCw,
  Stethoscope,
  Smile,
  ArrowRight,
  EyeOff,
  Eye,
  BarChart3
} from "lucide-react";
import {
  resourceDataset as rawResources,
  resourceDatasetLabel,
  resourceDatasetStats,
} from "@/data/resourceDataset";
import { Resource, FontSize, ActiveTab, BeihuSubTab, DatabaseGroupKey } from "@/types";
import { SCENARIOS, ARCHITECTURE_GROUPS, INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT } from "@/constants";
import ResourceCard from "@/components/ResourceCard";
import FilterPanel from "@/components/FilterPanel";
import ZeroStateUI from "@/components/ZeroStateUI";
import { compactText, normalizeResource, resourceMatchesQuery } from "@/lib/resourceUtils";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center animate-pulse min-h-[350px]" aria-busy="true" aria-label="長照地理資源地圖載入中">
      <div className="text-slate-500 dark:text-yellow-400 font-bold text-lg">🗺️ WebGL 向量地圖載入中...</div>
      <div className="text-slate-400 dark:text-yellow-500/80 text-sm mt-2 font-semibold">正在精準對齊派案經緯度</div>
    </div>
  )
});

const DATA_STATUS = {
  totalResources: `${resourceDatasetStats.totalResources} 筆`,
  validCoordinates: `${resourceDatasetStats.validCoordinates} 筆`,
  invalidCoordinates: `${resourceDatasetStats.invalidCoordinates} 筆`,
  radarRadius: `${resourceDatasetStats.radarRadiusKm}km`,
  datasetLabel: resourceDatasetLabel,
} as const;

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center" aria-live="polite">
        <div className="text-xl sm:text-2xl lg:text-3xl leading-snug font-bold text-blue-900 mb-2">臺大北護分院長照資源協作平台</div>
        <div className="text-sm sm:text-base lg:text-lg leading-relaxed text-slate-500 animate-bounce">安全載入中，請稍候...</div>
      </div>
    }>
      <BudgetProvider>
        <HomeContent />
      </BudgetProvider>
    </Suspense>
  );
}

function HomeContent() {
  // --- States ---
  const [isMounted, setIsMounted] = useState(false);
  const [visibleCountState, setVisibleCountState] = useState<{
    filterKey: string;
    count: number;
  }>({ filterKey: "", count: INITIAL_DISPLAY_COUNT });
  const [isMapVisible, setIsMapVisible] = useState<boolean>(true);

  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isRadarActive, setIsRadarActive] = useState<boolean>(false);
  const [isRadarLoading, setIsRadarLoading] = useState<boolean>(false);

  const isMountedRef = useRef(true);
  const [announcement, setAnnouncement] = useState<string>("");
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAnnouncement = useCallback((text: string) => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
    setAnnouncement(text);
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement("");
    }, 3000);
  }, []);

  useEffect(() => {
    // Project-required hydration gate: keep the first static render empty and stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [activeBeihuSubTab, setActiveBeihuSubTab] = useState<BeihuSubTab>("co-care");
  const [activeDatabaseGroup, setActiveDatabaseGroup] = useState<DatabaseGroupKey>("subsidized");
  const [filterBeihuOnly, setFilterBeihuOnly] = useState<boolean>(false);

  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<FontSize>("standard");
  const [searchQuery, setSearchQuery] = useState<string>(""); // Empty string for zero-load state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  
  // Radar States
  
  // Dropdown States
  const [selectedDistrict, setSelectedDistrict] = useState<string>("全部");
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");

  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    rawResources.forEach(res => {
      const district = compactText(res.district);
      if (district && district !== "未分類") set.add(district);
    });
    return Array.from(set).sort();
  }, []);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    rawResources.forEach(res => {
      const category = compactText(res.category);
      if (category && category !== "未分類") set.add(category);
    });
    return Array.from(set).sort();
  }, []);

  // All unique subcategories
  const allSubCategories = useMemo(() => {
    const set = new Set<string>();
    rawResources.forEach(res => set.add(compactText(res.subCategory)));
    return Array.from(set);
  }, []);

  // Initialize with empty set for zero-state load to eliminate white screen / DOM overload
  const [selectedSubCats, setSelectedSubCats] = useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  // List container ref for scrolling
  const cardListRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // URL Sync and Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  // Parse URL on mount
  useEffect(() => {
    if (!isMounted) return;

    const restoreUrlState = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'home' || tab === 'beihu' || tab === 'database' || tab === 'about') {
        setActiveTab(tab as ActiveTab);
      }

      const q = params.get('q');
      if (q) setSearchQuery(q);

      const beihu = params.get('beihu');
      if (beihu === 'true') setFilterBeihuOnly(true);

      const scenario = params.get('scenario');
      if (scenario) setSelectedScenario(scenario);

      const cats = params.get('cats');
      if (cats) {
        // Use '|' instead of ',' to avoid issues if any subcategory contains a comma
        const catArray = cats.split('|').filter(Boolean);
        if (catArray.length > 0) {
          setSelectedSubCats(new Set(catArray));
        }
      }

      setIsHydrating(false);
    }, 0);

    return () => clearTimeout(restoreUrlState);
  }, [isMounted]);

  // Sync state to URL (uses debouncedSearchQuery to avoid keystroke-level URL flickering)
  useEffect(() => {
    if (!isMounted || isHydrating) return;
    
    const params = new URLSearchParams();
    
    if (activeTab !== 'home') params.set('tab', activeTab);
    if (debouncedSearchQuery.trim() !== "") params.set('q', debouncedSearchQuery.trim());
    if (filterBeihuOnly) params.set('beihu', 'true');
    if (selectedScenario) params.set('scenario', selectedScenario);
    
    if (selectedSubCats.size > 0 && selectedSubCats.size < allSubCategories.length) {
      // Use '|' instead of ',' to avoid issues if any subcategory contains a comma
      params.set('cats', Array.from(selectedSubCats).join('|'));
    }

    const queryString = params.toString();
    const currentSearch = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
    
    if (queryString !== currentSearch) {
      // Use native window.history to prevent Next.js router throttling on high-frequency state updates
      window.history.replaceState(null, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
    }
  }, [activeTab, debouncedSearchQuery, filterBeihuOnly, selectedScenario, selectedSubCats, isMounted, isHydrating, allSubCategories.length]);

  const prescriptionSummary = useMemo(() => {
    const parts = [];
    if (activeTab === "home") parts.push("首頁工作台");
    if (activeTab === "beihu") parts.push("億起台大北護");
    if (activeTab === "database") parts.push("長照資料庫");
    
    if (filterBeihuOnly) parts.push("限北護本院網絡");
    if (selectedScenario) {
      const sc = SCENARIOS.find(s => s.id === selectedScenario);
      if (sc) parts.push(`情境: ${sc.title}`);
    }
    if (searchQuery.trim()) parts.push(`關鍵字: ${searchQuery.trim()}`);
    if (selectedSubCats.size > 0 && selectedSubCats.size < allSubCategories.length) {
      parts.push(`勾選分類: ${selectedSubCats.size}項`);
    } else if (selectedSubCats.size === allSubCategories.length) {
      parts.push("全部分類");
    }
    return parts.join(" / ");
  }, [activeTab, filterBeihuOnly, selectedScenario, searchQuery, selectedSubCats, allSubCategories.length]);

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    cardRefs.current[id] = el;
  }, []);

  // Pre-process raw data to append stable category codes (A1, B2, etc.)
  const processedResources = useMemo((): Resource[] => {
    const counters: { [key: string]: number } = {
      "照顧與專業服務": 0,
      "失智專責資源": 0,
      "喘息與住宿機構": 0,
      "輔具與交通環境": 0
    };

    return (rawResources as unknown as Record<string, unknown>[]).map(raw => {
      const cat = compactText(raw.category) as Resource["category"];
      let code = "O";
      if (cat === "照顧與專業服務") code = "A";
      else if (cat === "失智專責資源") code = "B";
      else if (cat === "喘息與住宿機構") code = "C";
      else if (cat === "輔具與交通環境") code = "D";

      counters[cat] = (counters[cat] || 0) + 1;
      const num = counters[cat];

      return normalizeResource(raw, `${code}${num}`);
    });
  }, []);

  // --- Search Debounce ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // --- Accessibility dynamic updates ---
  useEffect(() => {
    const announcementText = highContrast
      ? "已開啟黃黑高對比無障礙模式。"
      : "已恢復預設視覺模式。";

    if (highContrast) {
      document.documentElement.classList.add("theme-high-contrast");
    } else {
      document.documentElement.classList.remove("theme-high-contrast");
    }

    const announcementTimer = setTimeout(() => {
      triggerAnnouncement(announcementText);
    }, 0);

    return () => clearTimeout(announcementTimer);
  }, [highContrast, triggerAnnouncement]);

  useEffect(() => {
    document.documentElement.classList.remove("text-size-standard", "text-size-large", "text-size-xlarge");
    document.documentElement.classList.add(`text-size-${fontSize}`);
    
    let sizeText = "標準";
    if (fontSize === "large") sizeText = "放大";
    if (fontSize === "xlarge") sizeText = "特大";
    const announcementTimer = setTimeout(() => {
      triggerAnnouncement(`字體大小已設定為${sizeText}。`);
    }, 0);

    return () => clearTimeout(announcementTimer);
  }, [fontSize, triggerAnnouncement]);

  // --- Search & Filter Logic ---
  const filteredResources = useMemo(() => {
    const radarCenter = (isRadarActive && userLocation) 
      ? [userLocation.lng, userLocation.lat] 
      : (isRadarActive ? [121.5035256, 25.0418985] : null);

    return processedResources.filter(res => {
      // Defensive Rendering: filter out missing ID or broken nodes
      if (!res || !res.id) return false;

      // Dropdown filters
      if (selectedDistrict !== "全部" && res.district !== selectedDistrict) return false;
      if (selectedCategory !== "全部" && res.category !== selectedCategory) return false;

      // 0. Geo-filtering (Radar 1.5km)
      if (isRadarActive && radarCenter) {
        if (!res.longitude || !res.latitude) return false;
        const from = point(radarCenter);
        const to = point([res.longitude, res.latitude]);
        const dist = distance(from, to, { units: 'kilometers' });
        if (dist > 1.5) return false;
      }

      // 1. "億起台大北護" Gold Filter - Filter Beihu resources only
      if (filterBeihuOnly) {
        const nameClean = compactText(res.name).replace(/\s+/g, "");
        const isBeihu = nameClean.includes("北護") || nameClean.includes("臺大醫院北護") || nameClean.includes("臺大北護");
        if (!isBeihu) return false;
      }

      // 2. Tab 3 Database pre-filter: restrict to current database group
      if (activeTab === "database") {
        const allowedSubs = ARCHITECTURE_GROUPS[activeDatabaseGroup].subCategories;
        if (!allowedSubs.includes(res.subCategory)) {
          return false;
        }
      }

      // 4. Search query filter
      const trimmedQuery = debouncedSearchQuery.trim();

      // 3. Subcategory checkbox filter
      // If there's a search query and NO categories selected, we should search across ALL allowed categories.
      if (selectedSubCats.size > 0 && !selectedSubCats.has(res.subCategory)) {
        return false;
      } else if (selectedSubCats.size === 0 && trimmedQuery === "") {
        // Strict Zero-State: If no cats selected and no search query, return nothing
        return false;
      }

      if (trimmedQuery !== "") {
        if (!resourceMatchesQuery(res, trimmedQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [processedResources, selectedSubCats, debouncedSearchQuery, filterBeihuOnly, activeTab, activeDatabaseGroup, userLocation, isRadarActive, selectedDistrict, selectedCategory]);

  const visibleCountFilterKey = useMemo(() => {
    const selectedSubCatKey = Array.from(selectedSubCats).sort().join("|");
    return [
      selectedSubCatKey,
      debouncedSearchQuery,
      filterBeihuOnly ? "beihu" : "all",
      activeTab,
      activeDatabaseGroup,
      selectedDistrict,
      selectedCategory,
    ].join("\u001F");
  }, [selectedSubCats, debouncedSearchQuery, filterBeihuOnly, activeTab, activeDatabaseGroup, selectedDistrict, selectedCategory]);

  const visibleCount = visibleCountState.filterKey === visibleCountFilterKey
    ? visibleCountState.count
    : INITIAL_DISPLAY_COUNT;

  const handleLoadMoreResources = useCallback((total: number) => {
    setVisibleCountState(prev => {
      const currentCount = prev.filterKey === visibleCountFilterKey
        ? prev.count
        : INITIAL_DISPLAY_COUNT;

      return {
        filterKey: visibleCountFilterKey,
        count: Math.min(currentCount + DISPLAY_INCREMENT, total),
      };
    });
  }, [visibleCountFilterKey]);

  // Screen reader polite update when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerAnnouncement(`已篩選出 ${filteredResources.length} 筆長照資源單位。`);
    }, 600);
    return () => clearTimeout(timer);
  }, [selectedSubCats, searchQuery, filterBeihuOnly, activeTab, activeDatabaseGroup, filteredResources.length, triggerAnnouncement]);

  // Progressive Disclosure: User must manually click "Load More" button. Removed auto-scroll listener.

  // --- Tab Switch Actions ---
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setFilterBeihuOnly(false); // Reset gold filter on general navigation
    setSelectedScenario(null);
    setSelectedSubCats(new Set());
    setSearchQuery("");
    
    let tabLabel = "首頁決策工作台";
    if (tab === "beihu") tabLabel = "億起台大北護特色看板";
    if (tab === "database") {
      tabLabel = "長照資源大總匯";
    }
    if (tab === "about") tabLabel = "關於我們個管師專區";
    triggerAnnouncement(`已切換至「${tabLabel}」面版。`);
  }, [triggerAnnouncement]);

  const handleDatabaseGroupChange = useCallback((groupKey: DatabaseGroupKey) => {
    setActiveDatabaseGroup(groupKey);
    setSelectedSubCats(new Set());
    triggerAnnouncement(`已切換大分類「${ARCHITECTURE_GROUPS[groupKey].title}」，為確保流暢度已預設為零負載，請勾選下方細項載入資料。`);
  }, [triggerAnnouncement]);

  const handleBeihuOnlyToggle = useCallback(() => {
    const newVal = !filterBeihuOnly;
    setFilterBeihuOnly(newVal);
    setSelectedScenario(null);
    
    if (newVal) {
      setSelectedSubCats(new Set(allSubCategories));
      triggerAnnouncement("已開啟金黃色「億起台大北護」自有長照與失智共照網路專屬過濾，僅顯示北護分院之直屬資源。");
    } else {
      triggerAnnouncement("已關閉「億起台大北護」專屬過濾，恢復顯示所有單位。");
    }
  }, [filterBeihuOnly, allSubCategories, triggerAnnouncement]);

  // --- UI Operations ---
  const handleScenarioToggle = useCallback((scenarioId: string, subCats: string[]) => {
    setFilterBeihuOnly(false);
    if (selectedScenario === scenarioId) {
      setSelectedScenario(null);
      setSelectedSubCats(new Set(allSubCategories));
      triggerAnnouncement("已取消情境篩選，恢復顯示所有資源。");
    } else {
      setSelectedScenario(scenarioId);
      setSelectedSubCats(new Set(subCats));
      const sName = SCENARIOS.find(s => s.id === scenarioId)?.title;
      triggerAnnouncement(`已切換至照顧情境「${sName}」，已自動對齊子類別。`);
    }
  }, [selectedScenario, allSubCategories, triggerAnnouncement]);

  const handleSubCatCheckboxToggle = useCallback((subCat: string) => {
    setSelectedScenario(null);
    setSelectedSubCats(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(subCat)) {
        newSelected.delete(subCat);
        triggerAnnouncement(`已取消選取 ${subCat} 類別。`);
      } else {
        newSelected.add(subCat);
        triggerAnnouncement(`已勾選 ${subCat} 類別。`);
      }
      return newSelected;
    });
  }, [triggerAnnouncement]);

  const handleSelectAllFilters = useCallback(() => {
    setSelectedScenario(null);
    if (activeTab === "database") {
      const allowedSubs = ARCHITECTURE_GROUPS[activeDatabaseGroup].subCategories;
      setSelectedSubCats(new Set(allowedSubs));
    } else {
      setSelectedSubCats(new Set(allSubCategories));
    }
    triggerAnnouncement("已勾選當前顯示的所有子類別。");
  }, [activeTab, activeDatabaseGroup, allSubCategories, triggerAnnouncement]);

  const handleClearAllFilters = useCallback(() => {
    setSelectedScenario(null);
    setSelectedSubCats(new Set());
    triggerAnnouncement("已清除勾選的所有子類別。請重新勾選感興趣的項目。");
  }, [triggerAnnouncement]);

  const handleGlobalReset = useCallback(() => {
    setSearchQuery("");
    setSelectedScenario(null);
    setFilterBeihuOnly(false);
    setSelectedSubCats(new Set());
    setVisibleCountState({ filterKey: "", count: INITIAL_DISPLAY_COUNT });
    triggerAnnouncement("已將所有服務單位重置並取消選取");
  }, [triggerAnnouncement]);

  const toggleCardExpanded = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCardIds(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  }, []);

  
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("您的瀏覽器不支援地理定位功能，無法啟動生活圈雷達。");
      triggerAnnouncement("您的瀏覽器不支援地理定位功能。");
      return;
    }

    if (isRadarActive) {
      setIsRadarActive(false);
      setUserLocation(null);
      triggerAnnouncement("已關閉 1.5 公里生活圈雷達。");
      return;
    }

    setIsRadarLoading(true);
    triggerAnnouncement("正在取得您的當前位置，啟動生活圈雷達中...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        setIsRadarActive(true);
        setIsRadarLoading(false);
        triggerAnnouncement(`成功取得定位。已為您啟動 1.5 公里生活圈雷達。`);
      },
      (error) => {
        if (!isMountedRef.current) return;
        setIsRadarLoading(false);
        let errorMsg = "無法取得定位，請確認是否允許授權。";
        switch (error.code) {
          case error.PERMISSION_DENIED: errorMsg = "您已拒絕定位授權，無法使用雷達功能。"; break;
          case error.POSITION_UNAVAILABLE: errorMsg = "目前無法取得位置資訊。"; break;
          case error.TIMEOUT: errorMsg = "取得定位超時，請重新嘗試。"; break;
        }
        alert(errorMsg);
        triggerAnnouncement(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isRadarActive, triggerAnnouncement]);

  const handleCardClick = useCallback((res: Resource) => {
        if (cardRefs.current[res.id]) {
      cardRefs.current[res.id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
    
    setExpandedCardIds(prev => {
      const newExpanded = new Set(prev);
      newExpanded.add(res.id);
      return newExpanded;
    });

    // Ensure map is visible when locating a resource
    setIsMapVisible(true);

    setActiveResourceId(res.id);
    triggerAnnouncement(`聚焦地圖並選取：${res.name}。已自動為您展開詳細說明。`);
  }, [triggerAnnouncement]);

  const getMarkerLabel = useCallback((res: Resource) => {
    return res.stableLabel || "O";
  }, []);


  function renderMapPane(resources: Resource[]) {
    return (
      <section 
        className={`w-full lg:w-7/12 lg:order-2 order-1 touch-none pointer-events-auto flex flex-col bg-slate-200 dark:bg-slate-900 overflow-hidden border-2 border-slate-300 dark:border-white shadow-lg print:hidden transition-all duration-300 relative z-10 rounded-2xl lg:sticky lg:top-24`} 
        aria-label="長照資源互動地圖"
      >
        <div className="bg-slate-800 dark:bg-slate-950 text-white px-3 py-2 flex items-center justify-between shadow-md relative z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-yellow-300">長照資源地圖</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMapVisible(!isMapVisible)}
              className="text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 min-h-[36px]"
              aria-label={isMapVisible ? "隱藏地圖" : "顯示地圖"}
            >
              {isMapVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              <span className="hidden sm:inline">{isMapVisible ? "收合地圖" : "展開地圖"}</span>
            </button>
          </div>
        </div>
        <div className={`${!isMapVisible ? 'hidden' : 'block'} relative w-full h-[85dvh] lg:h-[calc(100dvh-16rem)] rounded-b-xl overflow-hidden`}>
          <Map 
            isHighContrast={highContrast}
            resources={resources}
            onMarkerClick={handleCardClick}
            getMarkerLabel={getMarkerLabel}
            activeResourceId={activeResourceId}
            userLocation={userLocation}
            isRadarActive={isRadarActive}
            onRequestRadar={requestGeolocation}
            isRadarLoading={isRadarLoading}
          />
        </div>
      </section>
    );
  }

  if (!isMounted) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center" aria-live="polite">
        <div className="text-xl sm:text-2xl lg:text-3xl leading-snug font-bold text-blue-900 mb-2">臺大北護分院長照資源協作平台</div>
        <div className="text-sm sm:text-base lg:text-lg leading-relaxed text-slate-500 animate-bounce">安全載入 {DATA_STATUS.datasetLabel} {DATA_STATUS.totalResources} 長照整合資源中，請稍候...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] print:h-auto print:overflow-visible print:bg-white flex flex-col bg-slate-50 dark:bg-black overflow-x-hidden break-words" lang="zh-TW">
      
      {/* Print-only Header & QR Code (guarded by isMounted to prevent SSR Hydration Mismatch) */}
      {isMounted && (
        <div className="hidden print:flex flex-col items-center justify-center pt-8 pb-4 border-b-2 border-slate-300 mb-6 w-full text-black bg-white">
          <h1 className="text-3xl font-black mb-2 text-black">臺大北護分院 長照服務需求</h1>
          <p className="font-bold text-lg text-slate-800 mb-4">請家屬掃描下方 QR Code，即可將此處方箋的資源清單同步至您的手機</p>
          <div className="p-3 border-4 border-slate-200 rounded-xl bg-white flex flex-col items-center">
            <QRCodeSVG value={window.location.href} size={150} level="M" />
            <p className="text-xs font-bold text-slate-500 mt-2">掃描還原派案清單</p>
          </div>
        </div>
      )}
      
      <PrescriptionModal 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        summaryText={prescriptionSummary} 
      />

      {/* 系統聲明 Banner */}
      <div className="w-full relative z-[2001] bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 leading-relaxed text-balance print:hidden">
        💡 <strong>【開發者與免責聲明】</strong>本網站為學術研究用途之 <span className="whitespace-nowrap">PoC</span>（概念驗證）系統，由國立臺北護理健康大學 健康事業管理系大四生 連鈞成 於 2026 年 5 月獨立建置，並依本次建置載入 {DATA_STATUS.datasetLabel} 與 PoC 邊界。公開 repo 僅保留合成範例資料；正式或合作來源資料不隨 public repo 發佈。非屬臺大醫院北護分院官方營運網站，亦無內部資訊技術對接，僅供展示與交流使用。
      </div>

      {/* 5.2 Skip Link - WCAG AAA */}
      <a href="#main-content" className="skip-link fixed top-0 left-0 -translate-y-full focus:translate-y-0 z-[9999] transition-transform duration-200 print:hidden">
        跳過導覽列，直接進入長照資源協作工作台
      </a>

      {/* Screen reader dynamic announcement node (hidden visually) */}
      <div 
        className="sr-only print:hidden" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* 4.A Header & Accessibility Panel */}
      <header className="sticky top-0 z-[2000] w-full overflow-hidden border-b border-slate-200 dark:border-white bg-slate-900 text-white shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 mt-1 sm:mt-0 p-2 bg-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
              <Accessibility className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white whitespace-normal break-words leading-snug">
                臺大北護分院長照資源協作 PoC
                {/* 強制手機版換行 (block)，大螢幕跟隨同行 (sm:inline) */}
                <span className="block sm:inline sm:ml-2 text-gray-300 text-lg sm:text-2xl mt-0.5 sm:mt-0">
                  靜態派案與查詢工作台
                </span>
              </h1>
              <div className="whitespace-normal break-words text-gray-300 font-semibold">
                <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                  以 W3C WCAG 2.2 無障礙 AAA 級為設計目標，優先維持鍵盤操作、語意標記、焦點樣式與高對比支援。
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  註：本平台目前為概念驗證（PoC）階段，不是正式醫療系統，尚未經官方正式審核與發布。
                </p>
              </div>
            </div>
          </div>

          {/* Accessibility Settings Panel */}
          <nav className="flex items-center gap-3 flex-wrap bg-slate-800 p-2 rounded-xl border border-slate-700" aria-label="無障礙輔助控制選單">
            {/* Font Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-700">
              <span className="text-xs font-extrabold px-2 text-slate-400" id="fontsize-label">字級：</span>
              <div className="flex gap-1" role="group" aria-labelledby="fontsize-label">
                <button
                  onClick={() => setFontSize("standard")}
                  className={`px-3 py-1.5 rounded font-extrabold text-sm transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                    fontSize === "standard"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  aria-pressed={fontSize === "standard"}
                  aria-label="標準字級大小"
                >
                  標準
                </button>
                <button
                  onClick={() => setFontSize("large")}
                  className={`px-3 py-1.5 rounded font-extrabold text-sm transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                    fontSize === "large"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  aria-pressed={fontSize === "large"}
                  aria-label="放大字級大小"
                >
                  放大
                </button>
                <button
                  onClick={() => setFontSize("xlarge")}
                  className={`px-3 py-1.5 rounded font-extrabold text-sm transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                    fontSize === "xlarge"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  aria-pressed={fontSize === "xlarge"}
                  aria-label="特大字級大小"
                >
                  特大
                </button>
              </div>
            </div>

            {/* High Contrast Mode Switch */}
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-extrabold text-sm transition-all border cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 ${
                highContrast
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
              aria-pressed={highContrast}
              aria-label="切換黃黑高對比無障礙視覺模式"
            >
              {highContrast ? (
                <>
                  <Sun className="w-4 h-4 text-black" aria-hidden="true" />
                  <span>預設色彩</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                  <span>高對比模式</span>
                </>
              )}
            </button>
          </nav>
        </div>

        {/* Site Map & Navigation Architecture: Dynamic RWD Navigation Bar */}
        <nav className="w-full bg-slate-950 border-t border-slate-800" aria-label="主目錄頁籤導覽">
          <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto whitespace-nowrap scrollbar-none py-1 md:py-0">
            <div className="flex gap-1.5 md:gap-3 py-1 flex-nowrap w-full">
              <button
                onClick={() => handleTabChange("home")}
                className={`px-4 py-3 text-sm md:text-base font-extrabold flex items-center gap-2 border-b-4 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                  activeTab === "home"
                    ? "border-blue-500 text-white bg-slate-900"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
                aria-current={activeTab === "home" ? "page" : undefined}
                aria-label="首頁決策智慧工作台"
              >
                🏠 首頁決策核心
              </button>
              <button
                onClick={() => handleTabChange("beihu")}
                className={`px-4 py-3 text-sm md:text-base font-extrabold flex items-center gap-2 border-b-4 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                  activeTab === "beihu"
                    ? "border-amber-500 text-white bg-slate-900"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
                aria-current={activeTab === "beihu" ? "page" : undefined}
                aria-label="億起台大北護本院自有長照網絡"
              >
                🏥 億起台大北護
              </button>
              <button
                onClick={() => handleTabChange("database")}
                className={`px-4 py-3 text-sm md:text-base font-extrabold flex items-center gap-2 border-b-4 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                  activeTab === "database"
                    ? "border-blue-500 text-white bg-slate-900"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
                aria-current={activeTab === "database" ? "page" : undefined}
                aria-label="長照資源大總匯分類資料庫"
              >
                🗂️ 長照資源大總匯
              </button>
              <button
                onClick={() => handleTabChange("about")}
                className={`px-4 py-3 text-sm md:text-base font-extrabold flex items-center gap-2 border-b-4 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer ${
                  activeTab === "about"
                    ? "border-blue-500 text-white bg-slate-900"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
                aria-current={activeTab === "about" ? "page" : undefined}
                aria-label="關於我們個案管理團隊"
              >
                👥 關於我們
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-3 text-sm md:text-base font-extrabold flex items-center gap-2 border-b-4 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                aria-label="長照資源數據儀表板"
              >
                <BarChart3 className="w-5 h-5" aria-hidden="true" /> 數據儀表板
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <div id="main-content" className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-black transform-gpu will-change-scroll">
          
          {/* ==================== TAB 1: HOME (DECISION CORE) ==================== */}
          {activeTab === "home" && (
            <>
              {/* Action Buttons: Radar & Prescription */}
              <div className="w-full max-w-7xl mx-auto px-4 pt-4 flex flex-col sm:flex-row justify-end gap-3 print:hidden">

                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-500 font-black px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 min-h-[44px]"
                  aria-label="產生專屬長照服務需求"
                >
                  <QrCode className="w-5 h-5" aria-hidden="true" /> 產生長照服務需求
                </button>
              </div>

              {/* Smart Care Filters */}
              <div className="print:hidden">
                <FilterPanel 
                  filterBeihuOnly={filterBeihuOnly}
                  selectedScenario={selectedScenario}
                  selectedSubCats={selectedSubCats}
                  allSubCategories={allSubCategories}
                  processedResources={processedResources}
                  filtersExpanded={filtersExpanded}
                  selectedDistrict={selectedDistrict}
                  selectedCategory={selectedCategory}
                  allDistricts={allDistricts}
                  allCategories={allCategories}
                  onDistrictChange={(d) => { setSelectedDistrict(d); triggerAnnouncement(`已將行政區篩選切換為 ${d}`); }}
                  onCategoryChange={(c) => { setSelectedCategory(c); triggerAnnouncement(`已將服務類別篩選切換為 ${c}`); }}
                  onBeihuOnlyToggle={handleBeihuOnlyToggle}
                  onScenarioToggle={handleScenarioToggle}
                  onSubCatToggle={handleSubCatCheckboxToggle}
                  onSelectAllFilters={handleSelectAllFilters}
                  onClearAllFilters={handleClearAllFilters}
                  setFiltersExpanded={setFiltersExpanded}
                />
              </div>


              

            <div className={`flex flex-col lg:flex-row w-full max-w-7xl mx-auto px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] py-6 lg:py-2 gap-6 flex-1 items-start print:block print:p-0`}>
                
                {/* Left Pane (col-span-12 xl:col-span-5) - Smart Resource Card List */}
                <section className={`w-full lg:w-5/12 order-2 lg:order-1 flex flex-col relative h-auto pr-1 print:w-full print:block print:h-auto print:overflow-visible print:pr-0 pb-40 transition-all duration-300`} aria-label="長照資源清單檢索欄">
                  <div className="mb-4 space-y-3 flex-shrink-0 print:hidden">
                    <div className="relative">
                      <label htmlFor="search-input-home" className="sr-only">關鍵字搜尋（名稱、地址、可協助資源、注意事項）</label>
                      <input
                        id="search-input-home"
                        type="text"
                        value={searchQuery === " " ? "" : searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="🔍 輸入關鍵字搜尋本院直屬據點、機構地址或計費注意事項..."
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-white rounded-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[48px]"
                      />
                      <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 dark:text-white" aria-hidden="true" />
                    </div>

                    {/* Counters */}
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-slate-950 p-3 rounded-lg border border-blue-100 dark:border-white text-sm font-extrabold">
                      <span className="text-slate-800 dark:text-yellow-400">
                        已篩選出 <span className="text-blue-600 dark:text-yellow-300 text-lg">{filteredResources.length}</span> 筆派案網絡資源
                      </span>
                      {(searchQuery.trim() !== "" || selectedScenario || selectedSubCats.size > 0 || filterBeihuOnly) && (
                        <button
                          onClick={handleGlobalReset}
                          className="text-xs text-red-600 dark:text-yellow-300 underline hover:text-red-800 flex items-center gap-1 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[36px]"
                          aria-label="將所有服務單位重置並取消選取"
                        >
                          <RefreshCw className="w-3 h-3" /> 將所有服務單位重置並取消選取
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resource List Scrollbar */}
                  {renderCardList(filteredResources)}
                </section>

                {/* Right Pane (55% Width) - Interactive Map */}
                {renderMapPane(filteredResources)}
              </div>
            </>
          )}

          {/* ==================== TAB 2: FEATURING BEIHU CENTER ==================== */}
          {activeTab === "beihu" && (
            <section className="max-w-7xl mx-auto px-4 py-8 flex-1 flex flex-col gap-6" aria-label="台大北護本院自有長照網絡看板">
              
              {/* Header Description */}
              <div className="bg-gradient-to-r from-blue-900 to-slate-900 dark:from-slate-950 dark:to-black text-white p-6 rounded-2xl border-2 border-amber-400 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-400 text-slate-950 text-xs px-2.5 py-1 rounded font-black uppercase">本院專責</span>
                  <h2 className="text-xl md:text-2xl font-black text-amber-300">億起台大北護 — 自有特色長照網絡</h2>
                </div>
                <p className="text-sm font-semibold text-slate-200 leading-relaxed max-w-4xl text-pretty">
                  國立臺灣大學醫學院附設醫院北護分院在萬華深耕多年，建構了「失智症共同照護中心」、「失智社區服務據點」及特色健康課程活動，協助個案家庭提供早期評估、跨專業轉介與全人照護指導，是萬華在地居家安老的首選後盾。
               </p>
              </div>

              {/* Sub-tabs for Beihu Center */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Left Sub-nav (Vertical/Horizontal list) */}
                <div className="flex md:flex-col gap-2 shrink-0 md:w-64" role="tablist" aria-label="北護特色服務清單">
                  <button
                    onClick={() => setActiveBeihuSubTab("co-care")}
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 flex items-center justify-between min-h-[48px] ${
                      activeBeihuSubTab === "co-care"
                        ? "bg-blue-600 dark:bg-yellow-400 text-white dark:text-black border-blue-700 dark:border-white shadow"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:border-blue-400"
                    }`}
                    role="tab"
                    aria-selected={activeBeihuSubTab === "co-care"}
                    aria-label="台大北護 失智共同照護中心"
                  >
                    <span>🧠 失智共同照護中心</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveBeihuSubTab("station")}
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 flex items-center justify-between min-h-[48px] ${
                      activeBeihuSubTab === "station"
                        ? "bg-blue-600 dark:bg-yellow-400 text-white dark:text-black border-blue-700 dark:border-white shadow"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:border-blue-400"
                    }`}
                    role="tab"
                    aria-selected={activeBeihuSubTab === "station"}
                    aria-label="台大北護 失智社區服務據點"
                  >
                    <span>🏫 失智社區服務據點</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveBeihuSubTab("activities")}
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 flex items-center justify-between min-h-[48px] ${
                      activeBeihuSubTab === "activities"
                        ? "bg-blue-600 dark:bg-yellow-400 text-white dark:text-black border-blue-700 dark:border-white shadow"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:border-blue-400"
                    }`}
                    role="tab"
                    aria-selected={activeBeihuSubTab === "activities"}
                    aria-label="台大北護 長照活動公佈欄與剪影"
                  >
                    <span>📅 台大北護 長照活動</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Right Content Panel */}
                <div className="flex-1 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-white shadow-sm min-h-[300px]">
                  
                  {/* 1. Co-Care Sub-tab */}
                  {activeBeihuSubTab === "co-care" && (
                    <div className="space-y-6" lang="zh-TW">
                      <div className="border-b pb-4 border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl md:text-2xl font-extrabold text-blue-900 dark:text-yellow-300 text-balance">
                          國立臺灣大學醫學院附設醫院北護分院 失智共同照護中心（編號 B1）
                        </h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          協助疑似失智症個案家庭早期介入、提供確診與跨領域個管管理。
                       </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4 font-semibold text-slate-800 dark:text-slate-200 leading-relaxed text-base text-pretty">
                          <p>
                            北護失智共照中心為萬華區失智照護的核心樞紐，專責建立社區失智個案之早期篩檢、門診綠色就醫通道，協助家屬對抗「失智超載焦慮」。
                         </p>
                          
                          <h4 className="text-lg font-extrabold text-blue-800 dark:text-yellow-400 pt-2">🌟 中心核心服務特色：</h4>
                          <ul className="list-disc pl-5 space-y-1 text-sm md:text-base">
                            <li><strong>早期確診輔導</strong>：專責門診排檢，提供整合式認知評估與神經科綠色通道。</li>
                            <li><strong>客製化照顧管理</strong>：個管師一對一諮詢，建立定期訪視、資源轉介與支持計畫。</li>
                            <li><strong>家屬支持培力</strong>：定期辦理失智照護技巧班、認知工作坊與心理協談。</li>
                          </ul>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                          <h4 className="font-extrabold text-base border-b border-slate-200 dark:border-slate-800 pb-2">📞 聯絡與預約窗口</h4>
                          <div className="space-y-3 text-sm">
                            <p><strong>專責專線：</strong>
                              <a href="tel:0223717101" className="underline text-blue-600 dark:text-yellow-400 font-bold block">
                                (02) 2371-7101 
                              </a>
                           </p>
                            <p><strong>服務地址：</strong>
                              <span className="block mt-0.5">臺北市萬華區康定路37號 (北護本院西址)</span>
                           </p>
                            <p><strong>服務時間：</strong>
                              <span className="block mt-0.5">週一至週五 08:30 - 17:00</span>
                           </p>
                          </div>
                          
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                            <a
                              href="tel:0223717101"
                              className="bg-blue-600 dark:bg-yellow-400 text-white dark:text-black text-xs px-3 py-2.5 rounded-lg font-extrabold hover:bg-blue-700 flex-1 text-center flex items-center justify-center gap-1.5 min-h-[48px]"
                            >
                              📞 撥打共照
                            </a>
                            <button
                              onClick={() => {
                                handleTabChange("home");
                                setFilterBeihuOnly(true);
                              }}
                              className="bg-green-600 dark:bg-yellow-500 text-white dark:text-black text-xs px-3 py-2.5 rounded-lg font-extrabold hover:bg-green-700 flex-1 text-center flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400"
                            >
                              🧭 地圖聚焦
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Station Sub-tab */}
                  {activeBeihuSubTab === "station" && (
                    <div className="space-y-6" lang="zh-TW">
                      <div className="border-b pb-4 border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl md:text-2xl font-extrabold text-blue-900 dark:text-yellow-300 text-balance">
                          臺大醫院北護分院附設失智社區服務據點（西門國小分站 - 編號 B2）
                        </h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          輕中度失智長者非藥物輔助認知刺激據點，週一至週五全日無休。
                       </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4 font-semibold text-slate-800 dark:text-slate-200 leading-relaxed text-base text-pretty">
                          <p>
                            據點租用成都路西門國小自強樓教室，讓失智症長輩在安全、熟悉的校園懷舊環境中上課交流，並有西區輔具中心及本院個管網絡的即時評估。
                         </p>
                          
                          <h4 className="text-lg font-extrabold text-blue-800 dark:text-yellow-400 pt-2">🌟 據點特色日常課程項目：</h4>
                          <ul className="list-disc pl-5 space-y-1 text-sm md:text-base">
                            <li><strong>認知刺激訓練</strong>：利用大腦懷舊療法、益智拼圖與日常計算延緩認知衰退。</li>
                            <li><strong>樂齡生活重塑</strong>：包含園藝輔助療癒、高齡防跌肌力伸展操與營養共餐。</li>
                            <li><strong>學童世代共融</strong>：定期舉辦西門國小學童交流活動，重新建立失智長者社交存在感。</li>
                          </ul>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                          <h4 className="font-extrabold text-base border-b border-slate-200 dark:border-slate-800 pb-2">📞 聯絡與預約窗口</h4>
                          <div className="space-y-3 text-sm">
                            <p><strong>服務專線：</strong>
                              <a href="tel:0223717101" className="underline text-blue-600 dark:text-yellow-400 font-bold block">
                                (02) 2371-7101 
                              </a>
                           </p>
                            <p><strong>據點地址：</strong>
                              <span className="block mt-0.5">臺北市萬華區菜園里成都路98號 (西門國小自強樓4樓)</span>
                           </p>
                            <p><strong>開放時間：</strong>
                              <span className="block mt-0.5">週一至週五 09:00 - 16:30</span>
                           </p>
                          </div>
                          
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                            <a
                              href="tel:0223717101"
                              className="bg-blue-600 dark:bg-yellow-400 text-white dark:text-black text-xs px-3 py-2.5 rounded-lg font-extrabold hover:bg-blue-700 flex-1 text-center flex items-center justify-center gap-1.5 min-h-[48px]"
                            >
                              📞 撥打據點
                            </a>
                            <button
                              onClick={() => {
                                handleTabChange("home");
                                setFilterBeihuOnly(true);
                              }}
                              className="bg-green-600 dark:bg-yellow-500 text-white dark:text-black text-xs px-3 py-2.5 rounded-lg font-extrabold hover:bg-green-700 flex-1 text-center flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400"
                            >
                              🧭 地圖聚焦
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Activities Sub-tab with AAA Compliant Image Alt Gallery */}
                  {activeBeihuSubTab === "activities" && (
                    <div className="space-y-6" lang="zh-TW">
                      <div className="border-b pb-4 border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl md:text-2xl font-extrabold text-blue-900 dark:text-yellow-300">
                          台大北護 長照活動公佈欄與社區剪影 (W3C WCAG 2.2 AAA 圖片規格)
                        </h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          歡迎社區長者與家庭照護者共同報名本院舉辦之社區促進課程與舒壓講座。
                       </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Activity 1 */}
                        <article className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          <div 
                            className="h-48 bg-teal-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-4 relative"
                            role="img"
                            aria-label="活動圖片一：臺大醫院北護分院失智社區據點長輩手工藝課程，銀髮族學員在社工輔助下，共同手作粘土相框與繪製水彩畫的團體活動現場。"
                          >
                            <Smile className="w-16 h-16 text-teal-600 dark:text-yellow-400 mb-2" aria-hidden="true" />
                            <span className="text-xs font-black text-teal-800 dark:text-yellow-300 bg-white dark:bg-black px-2 py-0.5 rounded border border-teal-200 dark:border-white">
                              據點日常課程
                            </span>
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <span className="text-xs font-bold text-slate-400 block mb-1">📅 每週二 10:00 - 11:30</span>
                              <h4 className="font-extrabold text-base text-slate-900 dark:text-yellow-400 leading-snug">
                                失智社區據點手工藝創作
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-semibold">
                                由專業藝術治療師帶領，利用多色粘土與彩繪著色，訓練失智長者手眼協調，提供充沛的感官刺激與認知功能保全。
                             </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center">
                              <span className="text-xs font-extrabold text-teal-600 dark:text-yellow-300">地點：西門小學據點</span>
                              <a href="tel:0223717101" className="text-xs font-bold underline text-blue-600 dark:text-yellow-400 min-h-[36px] flex items-center">電話報名</a>
                            </div>
                          </div>
                        </article>

                        {/* Activity 2 */}
                        <article className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          <div 
                            className="h-48 bg-purple-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-4 relative"
                            role="img"
                            aria-label="活動圖片二：臺大醫院北護分院長照健康促進活動，專業物理治療師帶領十餘位銀髮長者進行彈力帶伸展與徒手肌力訓練，長輩表情專注愉快。"
                          >
                            <Stethoscope className="w-16 h-16 text-purple-600 dark:text-yellow-400 mb-2" aria-hidden="true" />
                            <span className="text-xs font-black text-purple-800 dark:text-yellow-300 bg-white dark:bg-black px-2 py-0.5 rounded border border-purple-200 dark:border-white">
                              銀髮健康促進
                            </span>
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <span className="text-xs font-bold text-slate-400 block mb-1">📅 每週四 14:00 - 15:30</span>
                              <h4 className="font-extrabold text-base text-slate-900 dark:text-yellow-400 leading-snug">
                                樂齡防跌與肌力有氧訓練
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-semibold">
                                本院物理治療組專為高齡長輩量身設計，使用彈力伸縮帶與防滑小啞鈴，強化下肢肌肉群與平衡力，阻斷肌肉流失。
                             </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center">
                              <span className="text-xs font-extrabold text-purple-600 dark:text-yellow-300">地點：成都路輔具分站</span>
                              <a href="tel:0223717101" className="text-xs font-bold underline text-blue-600 dark:text-yellow-400 min-h-[36px] flex items-center">電話報名</a>
                            </div>
                          </div>
                        </article>

                        {/* Activity 3 */}
                        <article className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          <div 
                            className="h-48 bg-rose-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-4 relative"
                            role="img"
                            aria-label="活動圖片三：北護分院失智共照中心家屬心理舒壓工作坊，精油芳療與照顧技巧指導課堂現場，多位家屬圍坐聆聽芳療師示範，氣氛溫馨放鬆。"
                          >
                            <Heart className="w-16 h-16 text-rose-600 dark:text-yellow-400 mb-2" aria-hidden="true" />
                            <span className="text-xs font-black text-rose-800 dark:text-yellow-300 bg-white dark:bg-black px-2 py-0.5 rounded border border-rose-200 dark:border-white">
                              家屬支持喘息
                            </span>
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <span className="text-xs font-bold text-slate-400 block mb-1">📅 每月首週五 14:00 - 16:00</span>
                              <h4 className="font-extrabold text-base text-slate-900 dark:text-yellow-400 leading-snug">
                                家屬支持與精油舒壓工作坊
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-semibold">
                                專為長期照顧家屬及個管師開設。提供天然植物芳香療法舒緩神經焦慮，並有家庭照顧者權益宣導與個案轉介互助。
                             </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center">
                              <span className="text-xs font-extrabold text-rose-600 dark:text-yellow-300">地點：北護分院大禮堂</span>
                              <a href="tel:0223717101" className="text-xs font-bold underline text-blue-600 dark:text-yellow-400 min-h-[36px] flex items-center">電話報名</a>
                            </div>
                          </div>
                        </article>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ==================== TAB 3: COMPREHENSIVE DATABASE ==================== */}
          {activeTab === "database" && (
            <section className="flex-1 flex flex-col" aria-label="長照資源大總匯分類資料庫">
              
              {/* The Four Major Architecture Folders Selection Group */}
              <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-300 dark:border-white py-6 shadow-inner overflow-hidden pointer-events-none flex-shrink-0">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-lg md:text-xl font-extrabold flex items-center gap-2 text-slate-900 dark:text-yellow-300 text-balance">
                      <span aria-hidden="true">🗂️</span>
                      請選擇長照架構核心大目錄（<span className="whitespace-nowrap">Site Map</span> 完美映射）：
                    </h2>

                    {/* 4 Structural Group Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(ARCHITECTURE_GROUPS).map(([key, info]) => {
                        const isSelected = activeDatabaseGroup === key;
                        return (
                          <button
                            key={key}
                            onClick={() => handleDatabaseGroupChange(key as DatabaseGroupKey)}
                            className={`pointer-events-auto flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[96px] lg:min-h-0 ${
                              isSelected
                                ? "bg-blue-600 dark:bg-yellow-400 border-blue-700 dark:border-white text-white dark:text-black scale-[1.02] shadow-lg"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:border-blue-400"
                            }`}
                            aria-pressed={isSelected}
                            aria-describedby={`desc-db-${key}`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-extrabold text-base">{info.title}</span>
                              <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-black">
                                {info.subCategories.length} 類別
                              </span>
                            </div>
                            <p 
                              id={`desc-db-${key}`}
                              className={`text-xs font-semibold leading-relaxed ${
                                isSelected ? "text-blue-100 dark:text-black/80" : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {info.description}
                           </p>
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Database Tab Advanced Filter Box */}
                    <div className="mt-6 p-4 lg:p-5 bg-white dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-slate-700 shadow-sm pointer-events-auto">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
                        <h3 className="font-extrabold text-blue-900 dark:text-yellow-400 flex items-center gap-2">
                          <span aria-hidden="true">🎯</span> 
                          進階篩選：{ARCHITECTURE_GROUPS[activeDatabaseGroup].title} 細項
                        </h3>
                        <div className="flex gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              setSelectedSubCats(new Set(ARCHITECTURE_GROUPS[activeDatabaseGroup].subCategories));
                              triggerAnnouncement("已全選此分類下的所有資源細項。");
                            }}
                            className="text-xs bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-yellow-400 px-3 py-2 rounded-lg font-bold border border-blue-200 dark:border-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 transition-colors"
                          >
                            全選細項
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubCats(new Set());
                              triggerAnnouncement("已清空所有細項選取，進入零負載狀態。");
                            }}
                            className="text-xs bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg font-bold border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 transition-colors"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {ARCHITECTURE_GROUPS[activeDatabaseGroup].subCategories.map(subName => {
                          const isChecked = selectedSubCats.has(subName);
                          return (
                            <label key={subName} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSubCatCheckboxToggle(subName)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 dark:text-yellow-500 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400"
                                aria-label={`篩選分類：${subName}`}
                              />
                              <span className={`text-sm font-bold ${isChecked ? 'text-blue-700 dark:text-yellow-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {subName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                  </div>
                </div>
              </div>

              {/* Action Buttons: Radar & Prescription for Database Tab */}
              <div className="w-full max-w-7xl mx-auto px-4 pt-4 flex flex-col sm:flex-row justify-end gap-3 print:hidden">
                

                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-500 font-black px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 min-h-[44px]"
                  aria-label="產生專屬長照服務需求"
                >
                  <QrCode className="w-5 h-5" aria-hidden="true" /> 產生長照服務需求
                </button>
              </div>

            {/* Split Grid for Database Tab */}
            <div className={`flex flex-col lg:flex-row w-full max-w-7xl mx-auto px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] py-6 lg:py-2 gap-6 flex-1 items-start transition-all duration-300`}>
              
              {/* Left Pane (col-span-12 xl:col-span-5) - Card list of filtered resources */}
              <section className={`w-full lg:w-5/12 order-2 lg:order-1 flex flex-col relative h-auto pointer-events-none pr-1 pb-40 transition-all duration-300`} aria-label="大總匯分類清單">
                
                {/* Embedded Search and Total count inside Database */}
                <div className="mb-4 space-y-3 pointer-events-auto flex-shrink-0">
                  <div className="relative">
                    <label htmlFor="search-input-db" className="sr-only">關鍵字搜尋（名稱、地址、協助資源）</label>
                    <input
                      id="search-input-db"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 輸入關鍵字搜尋..."
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-white rounded-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[48px]"
                    />
                    <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400 dark:text-white" aria-hidden="true" />
                  </div>
                  
                  {/* Counters */}
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-slate-950 p-3 rounded-lg border border-blue-100 dark:border-white text-sm font-extrabold">
                    <span className="text-slate-800 dark:text-yellow-400">
                      <strong>{ARCHITECTURE_GROUPS[activeDatabaseGroup].title}</strong> (已篩選出 {filteredResources.length} 筆)
                    </span>
                    {(searchQuery.trim() !== "" || selectedScenario || selectedSubCats.size > 0 || filterBeihuOnly) && (
                      <button
                        onClick={handleGlobalReset}
                        className="text-xs text-red-600 dark:text-yellow-300 underline hover:text-red-800 flex items-center gap-1 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[36px]"
                        aria-label="將所有服務單位重置並取消選取"
                        tabIndex={0}
                      >
                        <RefreshCw className="w-3 h-3" /> 將所有服務單位重置並取消選取
                      </button>
                    )}
                  </div>
                </div>

                {renderCardList(filteredResources)}
              </section>

              {/* Right Pane (55% Width) - Map Pane */}
              {renderMapPane(filteredResources)}
            </div>
          </section>
        )}

        {/* ==================== TAB 4: ABOUT US ==================== */}
        {activeTab === "about" && (
          <section className="max-w-7xl mx-auto px-4 py-8 flex-1 flex flex-col gap-6" aria-label="關於我們及個案管理師諮詢">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Beihu Branch Long-term Care Team Details */}
              <div className="lg:col-span-2 space-y-6">
                <article className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-white shadow-sm space-y-6">
                  <h3 className="text-xl md:text-2xl font-black text-blue-900 dark:text-yellow-300 border-b pb-3 border-slate-100 dark:border-slate-800">
                    國立臺灣大學醫學院附設醫院北護分院<br className="md:hidden" />
                    社區整體照顧服務體系-A萬華區西門、龍山
                  </h3>
                  <div className="font-bold text-slate-800 dark:text-slate-200 space-y-4 leading-relaxed text-base">
                    <div className="bg-blue-50 dark:bg-slate-900 p-4 rounded-xl text-blue-900 dark:text-yellow-400 space-y-1">
                      <p>🤔 照顧問題? 照顧壓力大?</p>
                      <p>🤔 忘東忘西怎麼辦?</p>
                      <p>🤔 輔具哪裡找?家裡有門檻怎麼辦?</p>
                      <p>🤔 輪椅交通接送怎麼辦?</p>
                      <p>🤔 沒有人幫忙照顧長者怎麼辦?</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-slate-500">(本服務由台北市政府委託辦理)</p>
                      <p>📍 地址：台北市萬華區康定路37號(樂齡樓一樓)</p>
                      <p>⏰ 服務時間：週一至週五 8:00~12:00、13:00~17:00</p>
                      <p className="text-lg">📞 電話：<span className="font-black text-blue-600 dark:text-yellow-400">(02) 2371-7101</span> ~個管師來幫您~</p>
                    </div>
                  </div>
                </article>

                {/* Team Vision Panel -> Replaced with Service Target */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-black p-6 rounded-2xl border border-blue-100 dark:border-white">
                  <h4 className="text-lg font-extrabold text-blue-900 dark:text-yellow-300 mb-4">✨ 服務對象</h4>
                  <p className="mb-2 font-bold text-slate-800 dark:text-slate-200">
                    經個案長期照顧管理中心評估，符合長照需要等級2級以上者，並符合下列之一：
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300">
                    <li>六十五歲以上（但具原住民身份者，為五十五歲以上）</li>
                    <li>領有身心障礙證明</li>
                    <li>失智症</li>
                    <li>評估期間符合衛生福利部中央健康保險署公告之急性後期整合照護計畫之收案對象</li>
                  </ol>
                </div>
              </div>

              {/* Case Manager Contact Card */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl border-2 border-slate-700 shadow-lg space-y-6">
                <h3 className="text-lg font-black text-amber-300 border-b pb-2 border-slate-800">
                  📞 個案管理諮詢與轉介窗口
                </h3>
                
                <div className="space-y-4 font-bold text-sm">
                  <div className="space-y-1">
                    <span className="text-slate-400 block">諮詢電話 (Wanhua Branch)：</span>
                    <a 
                      href="tel:0223717101" 
                      className="text-lg text-yellow-300 underline font-black block min-h-[48px] flex items-center"
                      aria-label="撥打電話個案管理組"
                    >
                      (02) 2371-7101
                    </a>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 block">傳真熱線 (Fax Line)：</span>
                    <span className="text-base text-slate-200 block">(02) 2371-7102</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 block">服務時間：</span>
                    <span className="text-base text-slate-200 block">週一至週五 08:00 - 12:00, 13:00 - 17:00</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 block">實體辦公地址：</span>
                    <a 
                      href="https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E5%BA%B7%E5%AE%9A%E8%B7%AF37%E8%99%9F"
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-base text-slate-200 underline block min-h-[48px] flex items-center"
                      aria-label="開啟新視窗導航至辦公地址：台北市萬華區康定路37號"
                    >
                      台北市萬華區康定路37號 <br /> (樂齡樓一樓)
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <a
                    href="tel:0223717101"
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 min-h-[48px] focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400"
                    aria-label="一鍵撥打電話給長照A單位個案管理師"
                  >
                    📞 一鍵撥號諮詢個管師
                  </a>
                </div>
              </div>

            </div>

            {/* Quick Consultation Form Mockup */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-white shadow-sm max-w-3xl w-full mx-auto">
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-yellow-300 mb-2">📝 長照個案快速轉介與留言提問（模擬窗口）</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-semibold">
                個管師可在此快速輸入個案聯絡資訊或派案疑難雜症，本院長照服務組將儘速電話回覆。
              </p>
              
              <form onSubmit={(e) => { e.preventDefault(); alert('感謝您的提問！我們已收到您的訊息，將盡快安排專人回電。'); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold text-sm text-left">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-name" className="text-slate-700 dark:text-slate-300">諮詢人/個管師姓名：</label>
                    <input id="form-name" type="text" placeholder="例：林個管師" className="p-3 border-2 rounded-xl dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[48px]" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-phone" className="text-slate-700 dark:text-slate-300">回電聯絡電話：</label>
                    <input id="form-phone" type="tel" placeholder="例：0912-345-678" className="p-3 border-2 rounded-xl dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 min-h-[48px]" required />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 font-bold text-sm text-left">
                  <label htmlFor="form-message" className="text-slate-700 dark:text-slate-300">長照諮詢事由與個案狀況簡述：</label>
                  <textarea id="form-message" rows={4} placeholder="請輸入您遇到的長照資源整合、自費爬梯機安排或失智據點媒合疑問..." className="p-3 border-2 rounded-xl dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400" required></textarea>
                </div>
                <div className="pt-2">
                  <button type="submit" className="bg-blue-600 dark:bg-yellow-400 text-white dark:text-black font-extrabold text-sm px-6 py-3 rounded-xl hover:bg-blue-700 min-h-[48px] focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 cursor-pointer w-full md:w-auto">
                    🚀 送出提問並預約回電
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

      </div>



      {/* Budget Sandbox — fixed bottom floating panel */}
      <BudgetSandbox />

      {/* Semantic Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 dark:border-white py-6 text-sm font-bold text-center print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2 leading-relaxed text-pretty">
          <p className="text-white text-sm sm:text-base lg:text-lg leading-relaxed">臺大醫院北護分院 社區整體照顧服務體系長照 A 單位</p>
          <p className="text-xs sm:text-sm leading-relaxed">
            本平台為靜態資源派案與查詢工作台 <span className="whitespace-nowrap">PoC</span>，本次建置載入 {DATA_STATUS.datasetLabel} {DATA_STATUS.totalResources}。
         </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
            目前資料狀態：{DATA_STATUS.validCoordinates} 有效座標、{DATA_STATUS.invalidCoordinates} 缺漏或無效座標，生活圈雷達半徑 {DATA_STATUS.radarRadius}。
         </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
            瀏覽器端控制定位為威懾、追蹤、降低低階誤用摩擦；靜態前端不保證防止外洩、截圖、複製、攔截或自動化讀取。
         </p>
          
          <div className="col-span-12 w-full py-4 px-4 sm:px-6 mt-4 text-center border-t border-slate-700 dark:border-white">
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400 dark:text-yellow-400 font-medium">
              📌 提示：本地圖標記之位置與服務範圍僅供初步派案參考也可能存在誤差。如需精確導航或確認詳細資訊，建議另行以單位名稱查詢實際地址。
           </p>
          </div>
        </div>
      </footer>

      <Footer />
    </div>
  );

  // ==================== SHARED LAYOUT RENDERING FUNCTIONS ====================

  // 1. Shared Left Card List
  function renderCardList(resources: Resource[]) {
    return (
      <div 
        ref={cardListRef}
        className="flex flex-col space-y-3 focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 pointer-events-auto w-full transform-gpu will-change-transform"
        tabIndex={0}
        aria-live="polite"
        aria-label={`長照資源卡片清單。目前已載入前 ${Math.min(visibleCount, resources.length)} 筆（共 ${resources.length} 筆）。請使用 Tab 鍵在各張卡片間瀏覽，並使用清單底部的載入更多按鈕顯示更多資源。`}
      >
        {resources.length === 0 ? (
          <ZeroStateUI isInitialState={selectedSubCats.size === 0 && searchQuery.trim() === ""} />
        ) : (
          resources.slice(0, visibleCount).map((res) => {
            const isActive = res.id === activeResourceId;
            const isExpanded = expandedCardIds.has(res.id);
            
            return (
              <MemoizedListItem
                key={res.id}
                res={res}
                isActive={isActive}
                isExpanded={isExpanded}
                onClick={handleCardClick}
                onToggleExpand={toggleCardExpanded}
                registerRef={registerCardRef}
              />
            );
          })
        )}
        {visibleCount < resources.length && (
          <div className="pt-2 pb-4 text-center">
            <button
              onClick={() => handleLoadMoreResources(resources.length)}
              className={`w-full font-extrabold text-sm py-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 cursor-pointer min-h-[48px] transition-colors ${
                highContrast 
                  ? "border-2 border-yellow-400 text-yellow-400 bg-transparent" 
                  : "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:hover:bg-blue-800/60"
              }`}
              aria-label={`顯示更多資源（目前已顯示 ${Math.min(visibleCount, resources.length)} / 總共 ${resources.length} 筆）`}
            >
              ➕ 載入更多資源單位 (還有 {resources.length - visibleCount} 筆)
            </button>
          </div>
        )}
        
        {/* Global Reset Button */}
        <div className="pb-4 text-center print:hidden">
          <button
            onClick={handleGlobalReset}
            className={`w-full font-medium text-sm py-3 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 transition-all cursor-pointer min-h-[48px] ${
              highContrast
                ? "border-2 border-red-500 text-red-500 bg-transparent hover:bg-red-950"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 mt-2 border-2 border-transparent"
            }`}
            aria-label="將所有服務單位重置並取消選取"
          >
            🔄 將所有服務單位重置並取消選取
          </button>
        </div>
      </div>
    );
  }
}
