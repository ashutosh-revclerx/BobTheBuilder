import { useCallback, useMemo } from 'react';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';

// ─── Shared constants ───────────────────────────────────────────────
const LABEL_FONT  = '600 11px "DM Sans"';
const LABEL_LS    = 0.88;             // letter-spacing: 0.08em → 11 * 0.08
const CELL_FONT   = '13px "DM Sans"';
const NAME_FONT   = '600 15px "DM Sans"';

// ─── Feature A — Live canvas component label pill width ─────────────
export function useLabelWidth(text: string): number {
  return useMemo(() => {
    if (!text) return 0;
    try {
      const prepared = prepareWithSegments(text, LABEL_FONT, { letterSpacing: LABEL_LS });
      const measured = measureNaturalWidth(prepared);
      return Math.ceil(measured) + 16; // +16px padding
    } catch {
      // Fallback: rough estimate
      return text.length * 7 + 16;
    }
  }, [text]);
}

// Global cache for truncate operation since we can't write to refs during render
const truncationCache = new Map<string, { display: string; isTruncated: boolean }>();

// ─── Feature B — Truncation intelligence for table cells ────────────
export function useTruncatedText(
  text: string,
  maxWidthPx: number
): { display: string; isTruncated: boolean } {
  const key = `${text}|${maxWidthPx}`;
  const cached = truncationCache.get(key);
  if (cached) return cached;

  if (!text || maxWidthPx <= 0) {
    const r = { display: text, isTruncated: false };
    truncationCache.set(key, r);
    return r;
  }

  try {
    const prepared = prepareWithSegments(text, CELL_FONT);
    const naturalW = measureNaturalWidth(prepared);

    if (naturalW <= maxWidthPx) {
      const r = { display: text, isTruncated: false };
      truncationCache.set(key, r);
      return r;
    }

    // Binary search for the max chars that fit (including the "…")
    const ellipsis = '…';
    let lo = 0;
    let hi = text.length;
    let bestLen = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = text.slice(0, mid) + ellipsis;
      const p = prepareWithSegments(candidate, CELL_FONT);
      const w = measureNaturalWidth(p);
      if (w <= maxWidthPx) {
        bestLen = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const display = bestLen > 0 ? text.slice(0, bestLen) + ellipsis : ellipsis;
    const r = { display, isTruncated: true };
    truncationCache.set(key, r);
    return r;
  } catch {
    // Rough fallback
    const avgCharW = 7.5;
    const maxChars = Math.floor(maxWidthPx / avgCharW);
    if (text.length <= maxChars) {
      return { display: text, isTruncated: false };
    }
    const r = { display: text.slice(0, maxChars - 1) + '…', isTruncated: true };
    truncationCache.set(key, r);
    return r;
  }
}

// Batch truncation for an entire column of texts
export function truncateTexts(
  texts: string[],
  maxWidthPx: number
): { display: string; full: string; isTruncated: boolean }[] {
  return texts.map((text) => {
    const str = String(text ?? '');
    if (!str || maxWidthPx <= 0) {
      return { display: str, full: str, isTruncated: false };
    }
    try {
      const prepared = prepareWithSegments(str, CELL_FONT);
      const naturalW = measureNaturalWidth(prepared);
      if (naturalW <= maxWidthPx) {
        return { display: str, full: str, isTruncated: false };
      }
      // Binary search
      let lo = 0, hi = str.length, bestLen = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = str.slice(0, mid) + '…';
        const p = prepareWithSegments(candidate, CELL_FONT);
        const w = measureNaturalWidth(p);
        if (w <= maxWidthPx) { bestLen = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      const display = bestLen > 0 ? str.slice(0, bestLen) + '…' : '…';
      return { display, full: str, isTruncated: true };
    } catch {
      const maxChars = Math.floor(maxWidthPx / 7.5);
      if (str.length <= maxChars) return { display: str, full: str, isTruncated: false };
      return { display: str.slice(0, maxChars - 1) + '…', full: str, isTruncated: true };
    }
  });
}

// ─── Feature C — Kinetic width for dashboard name input ─────────────
export function useKineticWidth(value: string): number {
  return useMemo(() => {
    if (!value) return 80;
    try {
      const prepared = prepareWithSegments(value, NAME_FONT);
      const measured = measureNaturalWidth(prepared);
      return Math.ceil(measured) + 32; // 16px padding each side
    } catch {
      return value.length * 9 + 32;
    }
  }, [value]);
}

// ─── Convenience hook combining all three ───────────────────────────
export function useTextMeasure() {
  const measureLabel = useCallback((text: string): number => {
    if (!text) return 0;
    try {
      const prepared = prepareWithSegments(text, LABEL_FONT, { letterSpacing: LABEL_LS });
      return Math.ceil(measureNaturalWidth(prepared)) + 16;
    } catch {
      return text.length * 7 + 16;
    }
  }, []);

  const measureName = useCallback((text: string): number => {
    if (!text) return 80;
    try {
      const prepared = prepareWithSegments(text, NAME_FONT);
      return Math.ceil(measureNaturalWidth(prepared)) + 32;
    } catch {
      return text.length * 9 + 32;
    }
  }, []);

  const measureCell = useCallback((text: string, maxWidth: number): { display: string; isTruncated: boolean } => {
    if (!text || maxWidth <= 0) return { display: text, isTruncated: false };
    try {
      const prepared = prepareWithSegments(text, CELL_FONT);
      const naturalW = measureNaturalWidth(prepared);
      if (naturalW <= maxWidth) return { display: text, isTruncated: false };
      let lo = 0, hi = text.length, bestLen = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = text.slice(0, mid) + '…';
        const p = prepareWithSegments(candidate, CELL_FONT);
        const w = measureNaturalWidth(p);
        if (w <= maxWidth) { bestLen = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      return { display: bestLen > 0 ? text.slice(0, bestLen) + '…' : '…', isTruncated: true };
    } catch {
      return { display: text, isTruncated: false };
    }
  }, []);

  return { measureLabel, measureName, measureCell };
}
