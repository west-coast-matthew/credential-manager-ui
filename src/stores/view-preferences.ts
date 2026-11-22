import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** How the account library is laid out: cards, or compact rows. */
export type ViewMode = 'cards' | 'list'

interface ViewPreferences {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

/**
 * Display preferences, remembered across reloads in localStorage. If storage is
 * unavailable (private window, blocked site data) the store still works for the
 * session and starts from the defaults next time.
 */
export const useViewPreferences = create<ViewPreferences>()(
  persist(
    (set) => ({
      viewMode: 'cards',
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'credential-manager:view-preferences',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ viewMode }) => ({ viewMode }),
    },
  ),
)
