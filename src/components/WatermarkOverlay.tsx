'use client';

import React, { useEffect, useState, useRef } from 'react';

interface WatermarkOverlayProps {
  children: React.ReactNode;
  label: string;
}

export default function WatermarkOverlay({ children, label }: WatermarkOverlayProps) {
  const [state, setState] = useState({ x: 0, y: 0, opacity: 0.055 });
  const watermarkRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Traceability clue for screenshots; this does not guarantee screenshot prevention.
  useEffect(() => {
    const intervalId = setInterval(() => {
      setState(() => {
        // Random drift within ±6px
        const newX = (Math.random() - 0.5) * 12;
        const newY = (Math.random() - 0.5) * 12;
        
        // Time-based opacity for timestamping
        // Map 0-99 to 0.050 - 0.062
        const minuteMod = Math.floor(Date.now() / 60000) % 100;
        const baseOpacity = 0.050;
        const newOpacity = baseOpacity + (minuteMod * (0.012 / 99));

        return { x: newX, y: newY, opacity: newOpacity };
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);

  // Adds friction to casual removal via MutationObserver.
  const [forceRenderCount, setForceRenderCount] = useState(0);

  useEffect(() => {
    if (!watermarkRef.current || !containerRef.current) return;
    
    const observer = new MutationObserver((mutations) => {
      let shouldReRender = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const removedNodes = Array.from(mutation.removedNodes);
          if (removedNodes.includes(watermarkRef.current!)) {
            shouldReRender = true;
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target === watermarkRef.current) {
            const computedStyle = window.getComputedStyle(target);
            if (
              computedStyle.display === 'none' ||
              computedStyle.visibility === 'hidden' ||
              computedStyle.opacity === '0'
            ) {
              shouldReRender = true;
            }
          }
        }
      }

      if (shouldReRender) {
        setForceRenderCount(c => c + 1);
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true
    });
    
    observer.observe(watermarkRef.current, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => observer.disconnect();
  }, [forceRenderCount]);

  const watermarkText = `© PoC（概念驗證網站）｜系統建置：連鈞成`;

  return (
    <div ref={containerRef} className="relative h-full min-h-full" data-watermark-label={label}>
      {children}
      {/* Watermark overlay for accountability cues, not screenshot blocking. */}
      <div
        key={`watermark-${forceRenderCount}`}
        ref={watermarkRef}
        className="fixed inset-0 pointer-events-none select-none overflow-hidden z-10 flex items-center justify-center"
        data-testid="watermark-overlay"
        style={{
          opacity: state.opacity,
          transform: `translate(${state.x}px, ${state.y}px)`,
          transition: 'transform 0.8s ease',
        }}
        aria-hidden="true"
      >
        <div
          className="w-[200vw] h-[200vh] flex flex-wrap gap-8 items-center justify-center opacity-100"
          style={{ transform: 'rotate(-28deg)' }}
        >
          {Array.from({ length: 150 }).map((_, i) => (
            <span key={i} className="text-xl font-bold whitespace-nowrap opacity-100" style={{ color: 'inherit' }}>
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
