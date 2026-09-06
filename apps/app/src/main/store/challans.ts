import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import {
  listPending,
  randomId,
  readMasters,
  removePending,
} from "@/lib/offline/core";
import type { Customer, JobWorker } from "@/store/masters";
import type {
  ChallanBody,
  ChallanDto,
  ChallanItemDto,
} from "@kataria-syntex/shared";

export type ChallanType = "sales" | "outward";

// Server DTO shapes live in @kataria-syntex/shared — one truth for routes,
// offline sync, and this store.
export type ChallanItem = ChallanItemDto;

export type Challan = Omit<ChallanDto, "workspaceId"> & {
  /** Offline markers (locally-issued, not yet accepted by the server). */
  pendingSync?: boolean;
  conflict?: boolean;
  suggestion?: string;
};

export type ChallanInput = Omit<ChallanBody, "offline">;

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
  refresh: (filter?: ChallanListFilter) => Promise<void>;
  summary: (fy?: string) => Promise<{ sales: Challan[]; outward: Challan[] }>;
  load: (id: string) => Promise<ChallanDetail>;
  clearDetail: () => void;
  create: (input: ChallanInput) => Promise<Challan>;
  update: (id: string, input: ChallanInput) => Promise<Challan>;
  remove: (id: string) => Promise<void>;
};

/** Pending projections matching the given filter (type/fy/q applied locally).
 * Paginated lists show pending rows on page 1 only — prepending them to every
 * page would duplicate the same records across pages. */
function pendingProjections(filter?: ChallanListFilter): Challan[] {
  if (filter?.page && filter.page > 1) return [];
  return listPending()
    .map((p) => ({
      ...p.local,
      conflict: p.status === "conflict" || p.status === "error",
      suggestion: p.suggestion,
    }))
    .filter((c) => {
      if (filter?.type && c.type !== filter.type) return false;
      if (filter?.fy && c.fyLabel !== filter.fy) return false;
      if (filter?.q) {
        const q = filter.q.toLowerCase();
        const hay =
          `${c.customerName ?? ""} ${c.jobWorkerName ?? ""} ${c.challanNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Server rows + pending projections, newest first (pending carry their flags). */
function mergePending(
  server: Challan[],
  filter?: ChallanListFilter,
): Challan[] {
  return [...pendingProjections(filter), ...server].sort((a, b) =>
    a.date === b.date
      ? a.createdAt < b.createdAt
        ? 1
        : -1
      : a.date < b.date
        ? 1
        : -1,
  );
}

export const useChallans = create<ChallansState>()((set, get) => {
  // Monotonic request ids: overlapping refresh()/load() calls resolve out of
  // order (debounced search vs pagination vs post-create refresh), and the
  // stale response must never clobber newer state.
  let refreshSeq = 0;
  let loadSeq = 0;
  // The list page's current query. Post-mutation refreshes (create/update/
  // remove) pass no filter — reusing this keeps the paginated page state
  // (rows + total) consistent instead of resetting it to an unfiltered read.
  let lastFilter: ChallanListFilter | undefined;

  return {
    challans: [],
    total: 0,
    detail: null,
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
          challans: mergePending(res.items, active),
          total: res.total ?? res.items.length,
        });
      } catch (err) {
        if (seq !== refreshSeq) return;
        if (err instanceof ApiError && err.isNetworkError) {
          void import("@/lib/offline/sync").then(({ setOnline }) =>
            setOnline(false),
          );
          const local = pendingProjections(active);
          // Keep stale synced rows visible offline; only when nothing has been
          // loaded yet does the pending list stand in as the whole list.
          const keep = get().challans.length > 0;
          set({
            challans: keep ? get().challans : local,
            total: keep ? get().total : local.length,
          });
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
      const pending = listPending().find((p) => p.clientRef === id);
      if (pending) {
        const masters = readMasters();
        const detail: ChallanDetail = {
          challan: pending.local,
          items: pending.items,
          customer:
            masters?.customers.find((c) => c.id === pending.local.customerId) ??
            null,
          jobWorker:
            masters?.jobWorkers.find(
              (w) => w.id === pending.local.jobWorkerId,
            ) ?? null,
        };
        set({ detail });
        return detail;
      }
      const res = await api<ChallanDetail>(`/challans/${id}`);
      if (seq !== loadSeq) return res;
      set({ detail: res });
      return res;
    },

    clearDetail: () => set({ detail: null }),

    summary: async (fy) => {
      const fyParam = fy ? `&fy=${encodeURIComponent(fy)}` : "";
      try {
        const [salesRes, outwardRes] = await Promise.all([
          api<{ items: Challan[] }>(`/challans?type=sales${fyParam}`),
          api<{ items: Challan[] }>(`/challans?type=outward${fyParam}`),
        ]);
        return {
          sales: mergePending(salesRes.items, { type: "sales", fy }),
          outward: mergePending(outwardRes.items, { type: "outward", fy }),
        };
      } catch (err) {
        if (err instanceof ApiError && err.isNetworkError) {
          const local = pendingProjections({ fy });
          return {
            sales: local.filter((c) => c.type === "sales"),
            outward: local.filter((c) => c.type === "outward"),
          };
        }
        throw err;
      }
    },

    create: async (input) => {
      // Idempotency key: if the request dies after the server committed, the
      // offline fallback re-sends the SAME clientRef and the server dedupes.
      const clientRef = randomId();
      try {
        const res = await api<{ challan: Challan }>("/challans", {
          method: "POST",
          body: { ...input, offline: { clientRef } },
        });
        void get().refresh();
        return res.challan;
      } catch (err) {
        if (err instanceof ApiError && err.isNetworkError) {
          const { createOfflineChallan } = await import("@/lib/offline/create");
          const local = createOfflineChallan(input, clientRef);
          const { recountPending } = await import("@/lib/offline/sync");
          recountPending();
          set((s) => ({
            challans: [local, ...s.challans],
            total: s.total + 1,
          }));
          return local;
        }
        throw err;
      }
    },

    update: async (id, input) => {
      // A queued (offline) challan can't be edited until the server has it.
      if (listPending().some((p) => p.clientRef === id))
        throw new ApiError(0, "pending_sync_edit");
      const res = await api<{ challan: Challan }>(`/challans/${id}`, {
        method: "PUT",
        body: input,
      });
      void get().refresh();
      return res.challan;
    },

    remove: async (id) => {
      // Discarding a never-synced offline challan is purely local.
      if (listPending().some((p) => p.clientRef === id)) {
        removePending(id);
        void import("@/lib/offline/sync").then(({ recountPending }) =>
          recountPending(),
        );
        set((s) => ({
          challans: s.challans.filter((c) => c.id !== id),
          total: Math.max(0, s.total - 1),
        }));
        return;
      }
      await api(`/challans/${id}`, { method: "DELETE" });
      void get().refresh();
    },
  };
});
