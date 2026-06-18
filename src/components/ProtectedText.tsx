'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ProtectedTextProps {
  text: string;
  fontSize?: number;
  color?: string;
}

export default function ProtectedText({ text, fontSize = 16, color }: ProtectedTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Required mount gate keeps canvas-only text out of SSR to avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // SEO JSON-LD injection
  useEffect(() => {
    if (!mounted) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Text",
      "text": text
    });
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [mounted, text]);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawText = (isDarkTheme: boolean) => {
      const defaultColor = isDarkTheme ? '#ffffff' : '#000000';
      const textColor = color || defaultColor;

      ctx.font = `${fontSize}px sans-serif`;
      const metrics = ctx.measureText(text);
      const dpr = window.devicePixelRatio || 1;
      const height = fontSize * 1.5;
      const width = metrics.width;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${fontSize}px sans-serif`; 
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, height / 2);
    };

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    drawText(isDark);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
       drawText(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mounted, text, fontSize, color]);

  if (!mounted) {
    return <div aria-label={text} />;
  }

  return (
    <div 
      aria-label={text} 
      className="relative inline-block"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas 
        ref={canvasRef} 
        className="block"
        aria-hidden="true" 
      />
      <div 
        className="absolute inset-0 z-10 bg-transparent"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}
