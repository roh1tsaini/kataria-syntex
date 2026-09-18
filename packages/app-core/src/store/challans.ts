import { create } from "zustand";
import { api, ApiError } from "../api";
import { randomId } from "../id";
import { setOnline } from "../offline/sync-state";
import type { Customer, JobWorker } from "./masters";
import type {
  ChallanBody,
  ChallanDto,
  ChallanItemDto,
  ChallanType,
} from "@kataria-syntex/shared";

export type { ChallanType };

// Server DTO shapes live in @kataria-syntex/shared — one truth for routes and
// this store.
export type ChallanItem = ChallanItemDto;

export type Challan = Omit<ChallanDto, "workspaceId">;

export type ChallanInput = Omit<ChallanBody, "clientRef">;

export type ChallanDetail = {
  challan: Challan;
  items: ChallanItem[];
  customer: Customer | null;
  jobWorker: JobWorker | null;
};

export type ChallanListFilter = {
  type?: ChallanType;
  fy?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export type RecentChallan = {
  id: string;
  number: string;
  type: "sales" | "outward";
  date: string;
  createdAt: string;
  party: string;
  boxes: number;
  netWt: number;
};

type ChallansState = {
  challans: Challan[];
  total: number;
  detail: ChallanDetail | null;
  loading: boolean;
  error: string | null;
  summaryCache: Record<string, { sales: Challan[]; outward: Challan[] }>;
  refresh: (filter?: ChallanListFilter) => Promise<void>;
  summary: (
    fy?: string,
    workspaceId?: string,
  ) => Promise<{ sales: Challan[]; outward: Challan[] }>;
  load: (id: string) => Promise<ChallanDetail>;
  clearDetail: () => void;
  clearSummaryCache: () => void;
  /** Account teardown (logout/401): in-memory rows go with the storage
   * wipes — the next account starts with an empty list, no detail, and no
   * carried-over filter. */
  reset: () => void;
  create: (input: ChallanInput) => Promise<Challan>;
  update: (id: string, input: ChallanInput) => Promise<Challan>;
  remove: (id: string) => Promise<void>;
};

/** Newest first. A comparator that never returns 0 leaves equal rows in an
 *  arbitrary order — the id tie-break keeps the order identical everywhere. */
function byCreatedDesc(a: Challan, b: Challan): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id === b.id ? 0 : -1;
}

/** Server rows newest first; equal dates fall back to the created/id order so
 * list and summary pages agree. */
function byDateDesc(a: Challan, b: Challan): number {
  return a.date === b.date ? byCreatedDesc(a, b) : a.date < b.date ? 1 : -1;
}

export const useChallans = create<ChallansState>()((set, get) => {
  // Monotonic request ids: overlapping refresh()/load() calls resolve out of
  // order (debounced search vs pagination vs post-create refresh), and the
  // stale response must never clobber newer state.
  let refreshSeq = 0;
  let loadSeq = 0;
  // Per-cache-key request ids: a summary for another FY/workspace must not
  // invalidate this one's cache write.
  const summarySeq = new Map<string, number>();
  // The list page's current query. Post-mutation refreshes (create/update/
  // remove) pass no filter — reusing this keeps the paginated page state
  // (rows + total) consistent instead of resetting it to an unfiltered read.
  let lastFilter: ChallanListFilter | undefined;

  return {
    challans: [],
    total: 0,
    detail: null,
    summaryCache: {},
    loading: false,
    error: null,

    refresh: async (filter) => {
      const seq = ++refreshSeq;
      const active = filter ?? lastFilter;
      if (filter) lastFilter = filter;
      if (get().challans.length === 0) {
        set({ loading: true, error: null });
      } else {
        set({ error: null });
      }
      try {
        const params = new URLSearchParams();
        if (active?.type) params.set("type", active.type);
        if (active?.fy) params.set("fy", active.fy);
        if (active?.q) params.set("q", active.q);
        if (active?.page) params.set("page", String(active.page));
        if (active?.limit) params.set("limit", String(active.limit));
        const qs = params.toString();
        const res = await api<{ items: Challan[]; total: number }>(
          `/challans${qs ? `?${qs}` : ""}`,
        );
        if (seq !== refreshSeq) return;
        set({
          challans: [...res.items].sort(byDateDesc),
          total: res.total ?? res.items.length,
        });
      } catch (err) {
        if (seq !== refreshSeq) return;
        if (err instanceof ApiError && err.isNetworkError) {
          // Offline: keep whatever the last successful load showed rather than
          // blanking the list. The flag flips so the shell says go online.
          setOnline(false);
        } else {
          set({
            error: err instanceof ApiError ? err.code : "Something went wrong.",
          });
        }
      } finally {
        if (seq === refreshSeq) set({ loading: false });
      }
    },

    load: async (id) => {
      // Clear any loaded challan first: `detail` is shared store state, and a
      // stale value would prefill the editor / print route with the wrong
      // challan while this one is still in flight (C2).
      set({ detail: null });
      const seq = ++loadSeq;
      const res = await api<ChallanDetail>(`/challans/${id}`);
      if (seq !== loadSeq) return res;
      set({ detail: res });
      return res;
    },

    clearDetail: () => set({ detail: null }),

    summary: async (fy, workspaceId) => {
      const fyParam = fy ? `&fy=${encodeURIComponent(fy)}` : "";
      const cacheKey = `${workspaceId ?? ""}:${fy ?? ""}`;
      const seq = (summarySeq.get(cacheKey) ?? 0) + 1;
      summarySeq.set(cacheKey, seq);
      const isCurrent = () => summarySeq.get(cacheKey) === seq;
      try {
        const [salesRes, outwardRes] = await Promise.all([
          api<{ items: Challan[] }>(`/challans?type=sales${fyParam}`),
          api<{ items: Challan[] }>(`/challans?type=outward${fyParam}`),
        ]);
        const res = {
          sales: [...salesRes.items].sort(byDateDesc),
          outward: [...outwardRes.items].sort(byDateDesc),
        };
        if (isCurrent()) {
          set((s) => ({
            summaryCache: { ...s.summaryCache, [cacheKey]: res },
          }));
        }
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.isNetworkError) {
          // Offline: leave the cached rows in place rather than showing a
          // stale mix, and flip the flag so the shell says go online.
          setOnline(false);
          const cached = get().summaryCache[cacheKey];
          if (cached) return cached;
        }
        throw err;
      }
    },

    clearSummaryCache: () => set({ summaryCache: {} }),

    reset: () => {
      lastFilter = undefined;
      set({
        challans: [],
        total: 0,
        detail: null,
        summaryCache: {},
        loading: false,
        error: null,
      });
    },

    create: async (input) => {
      // Idempotency key: if the request dies after the server committed, a
      // retry re-sends the SAME clientRef and the server dedupes it.
      const clientRef = randomId();
      // Online-only: a network failure propagates as a network_error, which
      // the editor surfaces as a go-online message while keeping the form.
      const res = await api<{ challan: Challan }>("/challans", {
        method: "POST",
        body: { ...input, clientRef },
      });
      void get().refresh();
      return res.challan;
    },

    update: async (id, input) => {
      const res = await api<{ challan: Challan }>(`/challans/${id}`, {
        method: "PUT",
        body: input,
      });
      void get().refresh();
      return res.challan;
    },

    remove: async (id) => {
      await api(`/challans/${id}`, { method: "DELETE" });
      void get().refresh();
    },
  };
});
