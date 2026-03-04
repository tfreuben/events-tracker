import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ColumnVisibilityState } from "@/types";

interface AuthStore {
  isAdmin: boolean;
  isLoading: boolean;
  setAdmin: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAdmin: false,
  isLoading: true,
  setAdmin: (value) => set({ isAdmin: value }),
  setLoading: (value) => set({ isLoading: value }),
  login: async (password: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      set({ isAdmin: true });
      return true;
    }
    return false;
  },
  logout: async () => {
    await fetch("/api/auth", { method: "DELETE" });
    set({ isAdmin: false });
  },
  checkSession: async () => {
    try {
      const res = await fetch("/api/auth");
      set({ isAdmin: res.ok, isLoading: false });
    } catch {
      set({ isAdmin: false, isLoading: false });
    }
  },
}));

interface UIStore {
  columnVisibility: ColumnVisibilityState;
  setColumnVisibility: (visibility: ColumnVisibilityState) => void;
  toggleColumn: (columnId: string) => void;
}

const DEFAULT_HIDDEN_COLUMNS: string[] = [
  "staff_names",
  "sponsorship_level",
  "booth_number",
  "products_to_feature",
  "pre_event_goals",
  "post_event_notes",
  "article_url",
  "event_description",
  "target_audience",
  "key_topics",
];

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      columnVisibility: Object.fromEntries(
        DEFAULT_HIDDEN_COLUMNS.map((col) => [col, false])
      ),
      setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
      toggleColumn: (columnId) => {
        const current = get().columnVisibility;
        set({
          columnVisibility: {
            ...current,
            [columnId]: current[columnId] === false ? true : false,
          },
        });
      },
    }),
    { name: "events-tracker-ui" }
  )
);
