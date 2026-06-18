"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import maplibregl, { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Safari does not properly support `worker-src blob:` in CSP — it falls back to
// `script-src` which blocks MapLibre's default blob:-based worker creation.
// Serving the worker as a physical file avoids blob: entirely.
setWorkerUrl("/maplibre-gl-csp-worker.js");

import * as turf from "@turf/turf";
import { Radar, Crosshair, Loader2 } from "lucide-react";
import { createRoot, type Root } from 'react-dom/client';
import PopupContent from '@/components/map/PopupContent';
import { Resource } from "@/types";
import { hasMapLocation, hasValidCoordinates } from "@/lib/resourceUtils";

// CartoDB free vector tile style URLs (no API key required)
const STYLE_DEFAULT = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const STYLE_HIGH_CONTRAST = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// NTU Hospital Bei-Hu Branch coordinates: [lng, lat] for Maplibre
const CENTER_LNG = 121.5035256;
const CENTER_LAT = 25.0418985;

function createFallbackStyle(isHighContrast: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "fallback-background",
        type: "background",
        paint: {
          "background-color": isHighContrast ? "#000000" : "#e2e8f0",
        },
      },
    ],
  };
}

interface MapProps {
  isHighContrast?: boolean;
  resources?: Resource[];
  onMarkerClick?: (res: Resource) => void;
  getMarkerLabel?: (res: Resource) => string;
  activeResourceId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  isRadarActive?: boolean;
  onRequestRadar?: () => void;
  isRadarLoading?: boolean;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "照顧與專業服務": return "#0891b2"; // Teal Cyan
    case "失智專責資源": return "#9333ea"; // Purple
    case "喘息與住宿機構": return "#e11d48"; // Rose Red
    case "輔具與交通環境": return "#16a34a"; // Green Emerald
    default: return "#1e3a8a"; // Default Blue
  }
}

function createHospitalMarkerHtml(isHighContrast: boolean): string {
  const bg = isHighContrast ? '#000000' : '#b91c1c';
  const textCol = isHighContrast ? '#FFFF00' : 'white';
  const borderCol = isHighContrast ? '#FFFF00' : 'white';
  
  return `
    <div class="transition-transform hover:scale-105 transform-gpu will-change-transform" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="background-color: ${bg}; color: ${textCol}; padding: 6px 10px; border-radius: 8px; font-weight: 900; font-size: 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid ${borderCol}; white-space: nowrap;">
        <span style="font-size: 16px;">🏥</span> 台大北護分院
      </div>
      <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${bg}; filter: drop-shadow(0 4px 2px rgba(0,0,0,0.2)); margin-top: -1px;"></div>
    </div>
  `;
}


function createMarkerElement(label: string, category: string, isHighContrast: boolean): HTMLElement {
  const bg = isHighContrast ? "#000000" : getCategoryColor(category);
  const textColor = isHighContrast ? "#FFFF00" : "#ffffff";
  const borderColor = isHighContrast ? "#FFFF00" : "#ffffff";

  const el = document.createElement("div");
  el.className = "maplibre-custom-marker cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 focus:ring-offset-2";
  el.style.width = "36px";
  el.style.height = "44px";
  el.style.display = "flex";
  el.style.justifyContent = "center";
  el.style.alignItems = "center";
  el.style.backgroundColor = "transparent";

  el.innerHTML = `
    <div class="transition-transform hover:scale-110 transform-gpu will-change-transform" style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true" style="position: absolute; top: 0; left: 0;">
        <path d="M18 0 C8 0 0 8 0 18 C0 30 18 44 18 44 C18 44 36 30 36 18 C36 8 28 0 18 0 Z" fill="${bg}" stroke="${borderColor}" stroke-width="2"/>
      </svg>
      <span style="position: absolute; top: 8px; color: ${textColor}; font-weight: 900; font-size: 13px; z-index: 1;">${label}</span>
    </div>
  `;
  return el;
}

export default function Map({ 
  isHighContrast = false, 
  resources = [],
  onMarkerClick = () => {},
  getMarkerLabel = () => "",
  activeResourceId = null,
  userLocation = null,
  isRadarActive = false,
  onRequestRadar = () => {},
  isRadarLoading = false
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hospitalMarkerRef = useRef<maplibregl.Marker | null>(null);
  const popupRootsRef = useRef<globalThis.Map<string, Root>>(new globalThis.Map());
  const highContrastRef = useRef(isHighContrast);
  const [mapError, setMapError] = useState<string | null>(null);

  const updateMapError = useCallback((message: string | null) => {
    queueMicrotask(() => setMapError(message));
  }, []);

  useEffect(() => {
    highContrastRef.current = isHighContrast;
  }, [isHighContrast]);

  // 實作前端防禦性過濾，僅保留具備實體地址且經緯度有效的單位
  const validResources = useMemo(() => {
    return resources.filter(hasMapLocation);
  }, [resources]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Graceful Degradation: Disable antialias on low-end devices or high-DPI mobile screens to prevent overheating
    const isMobileOrLowEnd = window.innerWidth < 768 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: isHighContrast ? STYLE_HIGH_CONTRAST : STYLE_DEFAULT,
        center: [CENTER_LNG, CENTER_LAT],
        zoom: 16,
        attributionControl: false,
        maxPitch: 60, // Limit 3D rendering overhead
        fadeDuration: isMobileOrLowEnd ? 0 : 300 // Disable fade transitions on low-end
      });
    } catch {
      updateMapError("底圖暫時無法載入，已保留資源定位控制。");
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: createFallbackStyle(isHighContrast),
        center: [CENTER_LNG, CENTER_LAT],
        zoom: 16,
        attributionControl: false,
        maxPitch: 60,
        fadeDuration: 0,
      });
    }

    const handleMapError = (event: maplibregl.ErrorEvent) => {
      const message = event.error?.message ?? "";
      if (!map.current || map.current.isStyleLoaded() || !/style|fetch|load|network|Failed/i.test(message)) {
        return;
      }

      updateMapError("底圖暫時無法載入，已切換為簡易定位模式。");
      map.current.setStyle(createFallbackStyle(highContrastRef.current));
    };

    map.current.on("error", handleMapError);

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Static Hospital Marker
    const hospitalEl = document.createElement('div');
    // Using ring-blue-600 dark:ring-yellow-400 to ensure 7:1 contrast on focus
    hospitalEl.className = 'hospital-marker flex flex-col items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-yellow-400 rounded-xl';
    hospitalEl.style.cursor = 'pointer';
    hospitalEl.innerHTML = createHospitalMarkerHtml(isHighContrast);
    hospitalEl.setAttribute("role", "button");
    hospitalEl.setAttribute("tabIndex", "0");
    hospitalEl.setAttribute("aria-label", "台大北護分院");

    hospitalMarkerRef.current = new maplibregl.Marker({ element: hospitalEl, anchor: 'bottom' })
      .setLngLat([CENTER_LNG, CENTER_LAT])
      .addTo(map.current);

    const popupRoots = popupRootsRef.current;
    
    return () => {
      popupRoots.forEach((root) => {
        root.unmount();
      });
      popupRoots.clear();

      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.remove();
        hospitalMarkerRef.current = null;
      }
      map.current?.off("error", handleMapError);
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateMapError]);

  // Handle High Contrast
  useEffect(() => {
    if (!map.current) return;
    updateMapError(null);
    map.current.setStyle(isHighContrast ? STYLE_HIGH_CONTRAST : STYLE_DEFAULT);
    validResources.forEach(res => {
      const marker = markersRef.current[res.id];
      if (marker) {
        const newEl = createMarkerElement(getMarkerLabel(res), res.category, isHighContrast);
        const oldEl = marker.getElement();
        oldEl.innerHTML = newEl.innerHTML;
        
        // Update popup if it exists
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          const existingRoot = popupRootsRef.current.get(res.id);
          if (existingRoot) {
            existingRoot.render(<PopupContent resource={res} isHighContrast={isHighContrast} />);
          }
        }
      }
    });
    
    if (hospitalMarkerRef.current) {
      hospitalMarkerRef.current.getElement().innerHTML = createHospitalMarkerHtml(isHighContrast);
    }
  }, [isHighContrast, validResources, getMarkerLabel, updateMapError]);

  // Handle Markers Sync
  useEffect(() => {
    if (!map.current) return;
    
    // Explicitly clear ALL old markers to ensure zero artifact retention
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    validResources.forEach(res => {
      if (hasValidCoordinates(res)) {
        const el = createMarkerElement(getMarkerLabel(res), res.category, isHighContrast);
        el.setAttribute("role", "button");
        el.setAttribute("tabIndex", "0");
        el.setAttribute("aria-label", res.name);
        el.setAttribute("data-testid", "map-marker");
        // Note: Do not use stopPropagation() here as it prevents Maplibre from opening the Popup
        const popup = new maplibregl.Popup({ offset: [0, -40], closeButton: true, maxWidth: '320px' });
        
        popup.on('open', () => {
          const container = document.createElement('div');
          popup.setDOMContent(container);
          
          const existingRoot = popupRootsRef.current.get(res.id);
          if (existingRoot) {
            existingRoot.unmount();
            popupRootsRef.current.delete(res.id);
          }

          const root = createRoot(container);
          root.render(<PopupContent resource={res} isHighContrast={isHighContrast} />);
          popupRootsRef.current.set(res.id, root);
        });

        popup.on('close', () => {
          queueMicrotask(() => {
            const root = popupRootsRef.current.get(res.id);
            if (root) {
              root.unmount();
              popupRootsRef.current.delete(res.id);
            }
          });
        });
          
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([res.longitude!, res.latitude!])
          .setPopup(popup)
          .addTo(map.current!);

        el.addEventListener('click', () => {
          onMarkerClick(res);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onMarkerClick(res);
            // Programmatically open popup for keyboard users
            const popupInstance = marker.getPopup();
            if (popupInstance && !popupInstance.isOpen()) {
              popupInstance.addTo(map.current!);
            }
          }
        });
          
        markersRef.current[res.id] = marker;
      }
    });
  }, [validResources, getMarkerLabel, onMarkerClick, isHighContrast]);

  // Handle flyTo when activeResourceId changes (Bidirectional Sync)
  useEffect(() => {
    if (!map.current || !activeResourceId) return;
    const activeRes = resources.find(r => r.id === activeResourceId);
    if (activeRes && hasValidCoordinates(activeRes)) {
      map.current.flyTo({
        center: [activeRes.longitude!, activeRes.latitude!],
        zoom: 16,
        essential: true,
        duration: 1000
      });

      // Programmatically open the marker's popup so the resource card is shown
      const marker = markersRef.current[activeResourceId];
      if (marker) {
        // Close all other popups first
        Object.entries(markersRef.current).forEach(([id, m]) => {
          if (id !== activeResourceId) {
            const p = m.getPopup();
            if (p && p.isOpen()) p.remove();
          }
        });
        // Open the active marker's popup
        const popup = marker.getPopup();
        if (popup && !popup.isOpen()) {
          marker.togglePopup();
        }
      }
    }
  }, [activeResourceId, resources]);

  // Handle User Radar Marker
  useEffect(() => {
    if (!map.current) return;
    if (isRadarActive && userLocation) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#ef4444'; // Red-500
        el.style.border = '4px solid white';
        el.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.4), 0 0 15px rgba(239, 68, 68, 0.6)';
        
        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current);
          
        map.current.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 15, // Suitable zoom for 1.5km radar
          essential: true,
          duration: 1500
        });
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [isRadarActive, userLocation]);



  // Handle Radar Coverage Polygon (1.5km) & High Contrast Style Reload
  useEffect(() => {
    if (!map.current) return;

    const sourceId = 'radar-coverage-source';
    const fillLayerId = 'radar-coverage-fill';
    const lineLayerId = 'radar-coverage-line';

    const renderRadar = () => {
      if (!map.current || !isRadarActive) return;
      
      // Follow the logic: center at user location if available, else NTUH Bei-Hu
      const center = userLocation ? [userLocation.lng, userLocation.lat] : [CENTER_LNG, CENTER_LAT];
      const options = { steps: 64, units: 'kilometers' as const };
      const radarPolygon = turf.circle(center, 1.5, options);

      // Maplibre might not be fully loaded when style changes
      if (!map.current.isStyleLoaded()) return;

      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: radarPolygon
        });

        map.current.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.15
          }
        });

        map.current.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#2563eb',
            'line-width': 2,
            'line-dasharray': [4, 4]
          }
        });
      } else {
        const source = map.current.getSource(sourceId) as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(radarPolygon);
        }
      }
    };

    const removeRadar = () => {
      if (!map.current) return;
      if (map.current.getLayer(lineLayerId)) map.current.removeLayer(lineLayerId);
      if (map.current.getLayer(fillLayerId)) map.current.removeLayer(fillLayerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
    };

    if (isRadarActive) {
      // Draw immediately if style is loaded
      if (map.current.isStyleLoaded()) {
        renderRadar();
      }
      // Re-draw whenever styledata (e.g., high-contrast toggle) finishes loading
      map.current.on('styledata', renderRadar);
    } else {
      removeRadar();
      map.current.off('styledata', renderRadar);
    }

    return () => {
      if (map.current) {
        map.current.off('styledata', renderRadar);
        removeRadar();
      }
    };
  }, [isRadarActive, userLocation]);

  const handleFlyToHome = useCallback(() => {
    if (!map.current) return;
    map.current.flyTo({
      center: [CENTER_LNG, CENTER_LAT],
      zoom: 16,
      essential: true,
      duration: 1000
    });
  }, []);

  // Perfect ResizeObserver for Orientation & Flex container changes
  useEffect(() => {
    if (!mapContainer.current || !map.current) return;
    
    let animationFrameId: number;
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to sync with native refresh rate (90Hz/120Hz compatible)
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (map.current) {
          map.current.resize();
        }
      });
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full bg-slate-100 dark:bg-black transition-colors duration-300"
        aria-label="長照資源互動地圖"
      />
      {mapError && (
        <div
          className="pointer-events-none absolute top-4 left-4 right-4 z-[25] rounded-xl border-2 border-amber-500 bg-amber-50/95 px-4 py-3 text-sm font-bold text-amber-900 shadow-lg dark:border-yellow-400 dark:bg-black/90 dark:text-yellow-300"
          role="status"
          aria-live="polite"
        >
          {mapError}
        </div>
      )}
      <div className="absolute bottom-6 left-4 z-[20] pointer-events-none flex flex-col gap-3">
        {/* Radar Button */}
        <button 
          onClick={onRequestRadar}
          disabled={isRadarLoading}
          className={`pointer-events-auto font-black px-4 py-2 text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-transform focus:outline-none focus:ring-4 border-2 min-h-[44px] transform-gpu will-change-transform ${
            isRadarActive 
              ? "bg-red-500 hover:bg-red-600 text-white border-red-600 focus:ring-white dark:bg-red-600 dark:hover:bg-red-700 dark:border-white" 
              : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300 focus:ring-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-600 dark:focus:ring-yellow-400"
          } ${isRadarLoading ? "opacity-70 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
          aria-label={isRadarActive ? "關閉 1.5 公里生活圈雷達" : "啟動 1.5 公里生活圈雷達，需要取得定位授權"}
          aria-pressed={isRadarActive}
        >
          {isRadarLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : isRadarActive ? (
            <Crosshair className="w-5 h-5 animate-pulse" aria-hidden="true" />
          ) : (
            <Radar className="w-5 h-5" aria-hidden="true" />
          )}
          {isRadarLoading ? "定位中..." : isRadarActive ? "關閉雷達" : "啟動 1.5 公里雷達"}
        </button>

        {/* Home Button */}
        <button
          onClick={handleFlyToHome}
          className="pointer-events-auto bg-white dark:bg-yellow-400 text-black font-extrabold text-sm px-4 py-2 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-2 border-slate-300 dark:border-black focus:outline-none focus:ring-4 focus:ring-blue-600 dark:focus:ring-white transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 min-h-[44px] transform-gpu will-change-transform"
          aria-label="回到台大北護分院初始位置"
          tabIndex={0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          回到台大北護分院
        </button>
      </div>
    </div>
  );
}
