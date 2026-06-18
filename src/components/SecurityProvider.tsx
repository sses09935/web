'use client';

import React, { useEffect, useState } from 'react';
import { useClipboardGuard } from '@/hooks/useClipboardGuard';

interface SecurityProviderProps {
  children: React.ReactNode;
}

export default function SecurityProvider({ children }: SecurityProviderProps) {
  useClipboardGuard();

  // Environment hint state: SSR defaults to visible to avoid hydration mismatch.
  const [isDomainValid, setIsDomainValid] = useState(true);

  // Mount-only environment check. This is a PoC friction layer, not authorization.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const ALLOWED_HOSTS = [
      'ntuh-beihu-poc.web.app',
      'localhost',
      '127.0.0.1'
    ];

    if (!ALLOWED_HOSTS.includes(hostname) || protocol === 'file:') {
      // Domain lock must run after hydration so static export initially renders consistently.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDomainValid(false);
    }
  }, []);

  // Low-effort misuse friction: avoid presenting this as DevTools or leakage protection.
  useEffect(() => {
    if (isDomainValid) return;
    if (typeof window === 'undefined') return;

    const intervalId = setInterval(() => {
      console.clear();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isDomainValid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      
      // Ctrl+Shift+I / Cmd+Option+I (DevTools)
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === 'i')
      ) {
        e.preventDefault();
      }
      
      // Ctrl+Shift+J / Cmd+Option+J (Console)
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === 'j')
      ) {
        e.preventDefault();
      }
      
      // Ctrl+U / Cmd+Option+U (View Source)
      if (
        (e.ctrlKey && e.key.toLowerCase() === 'u') ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === 'u')
      ) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  // Unexpected environment notice. This is not a formal authorization boundary.
  if (!isDomainValid) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
        <p className="text-xl font-black mb-4">
          展示環境不符，已暫停顯示。
        </p>
        <p className="text-sm text-slate-400 font-semibold mb-2">
          這是靜態 PoC 的環境提示，不代表正式授權機制。
        </p>
        <p className="text-sm text-slate-400 font-semibold">
          版權所有 © 系統建置：連鈞成 ｜ 國立臺北護理健康大學 健康事業管理系
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
