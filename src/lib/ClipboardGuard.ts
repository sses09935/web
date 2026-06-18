const sessionHash = typeof crypto !== 'undefined' && crypto.randomUUID 
  ? crypto.randomUUID() 
  : Math.random().toString(36).substring(2, 15);

let listeners: { copy: EventListener; cut: EventListener } | null = null;

// Adds visible and zero-width source clues to copied text for traceability.
// This does not guarantee that copying can be blocked in a browser.
export interface ClipboardGuardDecodeResult {
  timestamp: number | null;
  sessionHash: string | null;
}

export interface ClipboardGuardApi {
  init(config?: { enabled?: boolean }): void;
  destroy(): void;
  decode(text: string): ClipboardGuardDecodeResult;
}

declare global {
  interface Window {
    __CG?: ClipboardGuardApi;
  }
}

function encodeToZWC(str: string): string {
  let zwcStr = '';
  for (let i = 0; i < str.length; i++) {
    const codeUnit = str.charCodeAt(i);
    const binStr = codeUnit.toString(2).padStart(16, '0');
    for (const bit of binStr) {
      zwcStr += bit === '0' ? '\u200B' : '\u200C';
    }
  }
  return zwcStr;
}

const handler = (e: Event) => {
  const clipboardEvent = e as ClipboardEvent;
  const original = window.getSelection()?.toString() || '';
  
  if (!original) return;

  const visible = "\n\n© 版權所有，資料來源：NTUH-BEIHU，轉載請標明出處";
  const fingerprint = encodeToZWC("SRC_" + Date.now() + "_" + sessionHash);
  const finalString = original + fingerprint + visible;

  clipboardEvent.clipboardData?.setData('text/plain', finalString);
  clipboardEvent.preventDefault();

  if (clipboardEvent.type === 'cut') {
    document.execCommand('delete');
  }
};

export const ClipboardGuard: ClipboardGuardApi = {
  init(config?: { enabled?: boolean }): void {
    if (config?.enabled === false) return;
    if (listeners) {
      this.destroy();
    }

    listeners = {
      copy: handler as EventListener,
      cut: handler as EventListener
    };

    document.addEventListener('copy', listeners.copy);
    document.addEventListener('cut', listeners.cut);
  },

  destroy(): void {
    if (!listeners) return;
    document.removeEventListener('copy', listeners.copy);
    document.removeEventListener('cut', listeners.cut);
    listeners = null;
  },

  decode(text: string): ClipboardGuardDecodeResult {
    const matches = text.match(/[\u200B\u200C]+/g);
    if (!matches) return { timestamp: null, sessionHash: null };

    const bitStr = matches.join('').replace(/\u200B/g, '0').replace(/\u200C/g, '1');
    if (bitStr.length % 16 !== 0) return { timestamp: null, sessionHash: null };

    let decodedStr = '';
    for (let i = 0; i < bitStr.length; i += 16) {
      const chunk = bitStr.slice(i, i + 16);
      decodedStr += String.fromCharCode(parseInt(chunk, 2));
    }

    const regex = /^SRC_(\d+)_(.+)$/;
    const parsed = decodedStr.match(regex);
    if (!parsed) return { timestamp: null, sessionHash: null };

    return {
      timestamp: Number(parsed[1]),
      sessionHash: parsed[2]
    };
  }
};

// Expose for E2E testing: allows Playwright to call ClipboardGuard.decode() from page context
if (typeof window !== 'undefined') {
  window.__CG = ClipboardGuard;
}
