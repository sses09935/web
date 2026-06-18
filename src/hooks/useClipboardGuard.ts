import { useEffect, useRef } from 'react';
import { ClipboardGuard } from '@/lib/ClipboardGuard';

export function useClipboardGuard(config?: { enabled?: boolean }): void {
  const configRef = useRef(config);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    ClipboardGuard.init(configRef.current);
    
    return () => {
      ClipboardGuard.destroy();
    };
  }, []); // Mount-only initialization
}
