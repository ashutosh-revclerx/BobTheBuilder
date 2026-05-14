import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { ComponentStyle } from '../types/template';

export function useDebouncedStyle(componentId: string, delay = 150) {
  const updateStyle = useEditorStore(s => s.updateStyle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef<Partial<ComponentStyle>>({});

  const debouncedUpdate = useCallback(
    (styleKey: keyof ComponentStyle, value: unknown) => {
      // Accumulate updates
      pendingUpdates.current = {
        ...pendingUpdates.current,
        [styleKey]: value
      };

      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => {
        updateStyle(componentId, pendingUpdates.current);
        pendingUpdates.current = {}; // Clear after commit
      }, delay);
    },
    [componentId, updateStyle, delay]
  );

  return debouncedUpdate;
}
