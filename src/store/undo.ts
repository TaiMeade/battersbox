import { create } from 'zustand';

import { undoPA } from '@/db/repo';

interface UndoToast {
  paId: string;
  label: string;
}

interface UndoState {
  toast: UndoToast | null;
  show: (toast: UndoToast) => void;
  clear: () => void;
  undo: () => Promise<void>;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** One-slot undo: every logged PA offers a 4-second takeback instead of a confirm dialog. */
export const useUndoStore = create<UndoState>((set, get) => ({
  toast: null,
  show: (toast) => {
    if (timer) clearTimeout(timer);
    set({ toast });
    timer = setTimeout(() => set({ toast: null }), 4000);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ toast: null });
  },
  undo: async () => {
    const current = get().toast;
    if (!current) return;
    get().clear();
    await undoPA(current.paId);
  },
}));
