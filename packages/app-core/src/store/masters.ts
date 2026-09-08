import { create } from "zustand";
import { api } from "../api";
import { cacheMasters, readMasters } from "../offline/core";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
};
export type JobWorker = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Denier = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Color = {
  id: string;
  name: string;
  code: string | null;
  stockType: string;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SupplierInput = {
  name: string;
  phone: string;
  address: string;
  gstin: string;
};

export type CustomerInput = {
  name: string;
  phone: string;
  address: string;
  gstin: string;
};
export type JobWorkerInput = { name: string; phone: string; address: string };
export type DenierInput = { name: string; description: string };
export type ColorInput = { name: string; code: string; stockType?: string };

type MastersState = {
  customers: Customer[];
  customersLoading: boolean;
  jobWorkers: JobWorker[];
  jobWorkersLoading: boolean;
  deniers: Denier[];
  deniersLoading: boolean;
  colors: Color[];
  colorsLoading: boolean;
  suppliers: Supplier[];
  suppliersLoading: boolean;
  refreshCustomers: () => Promise<void>;
  createCustomer: (input: CustomerInput) => Promise<void>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  refreshJobWorkers: () => Promise<void>;
  createJobWorker: (input: JobWorkerInput) => Promise<void>;
  updateJobWorker: (id: string, input: JobWorkerInput) => Promise<void>;
  deleteJobWorker: (id: string) => Promise<void>;
  refreshDeniers: () => Promise<void>;
  createDenier: (input: DenierInput) => Promise<void>;
  updateDenier: (id: string, input: DenierInput) => Promise<void>;
  deleteDenier: (id: string) => Promise<void>;
  refreshColors: () => Promise<void>;
  createColor: (input: ColorInput) => Promise<void>;
  updateColor: (id: string, input: ColorInput) => Promise<void>;
  deleteColor: (id: string) => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  createSupplier: (input: SupplierInput) => Promise<void>;
  updateSupplier: (id: string, input: SupplierInput) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
};

/** Mirrors the current masters state into the offline cache. */
function cacheMastersSnapshot(state: MastersState): void {
  cacheMasters({
    customers: state.customers,
    jobWorkers: state.jobWorkers,
    deniers: state.deniers,
    colors: state.colors,
    suppliers: state.suppliers,
  });
}

export const useMasters = create<MastersState>()((set, get) => {
  // All five registers share one refresh/create/update/delete shape — one
  // factory keeps their loading/error behavior identical by construction.
  const crud = <T, I>(
    path: string,
    listKey: {
      [K in keyof MastersState]: MastersState[K] extends T[] ? K : never;
    }[keyof MastersState],
    loadingKey: {
      [K in keyof MastersState]: MastersState[K] extends boolean ? K : never;
    }[keyof MastersState],
  ) => {
    const setField = (key: keyof MastersState, value: unknown) =>
      set({ [key]: value } as Partial<MastersState>);
    const refresh = async () => {
      setField(loadingKey, true);
      try {
        const res = await api<{ items: T[] }>(`/masters/${path}`);
        setField(listKey, res.items);
        cacheMastersSnapshot(get());
      } finally {
        setField(loadingKey, false);
      }
    };
    return {
      refresh,
      create: async (input: I) => {
        await api(`/masters/${path}`, { method: "POST", body: input });
        await refresh();
      },
      update: async (id: string, input: I) => {
        await api(`/masters/${path}/${id}`, { method: "PUT", body: input });
        await refresh();
      },
      remove: async (id: string) => {
        await api(`/masters/${path}/${id}`, { method: "DELETE" });
        await refresh();
      },
    };
  };

  const customers = crud<Customer, CustomerInput>(
    "customers",
    "customers",
    "customersLoading",
  );
  const jobWorkers = crud<JobWorker, JobWorkerInput>(
    "job-workers",
    "jobWorkers",
    "jobWorkersLoading",
  );
  const deniers = crud<Denier, DenierInput>(
    "deniers",
    "deniers",
    "deniersLoading",
  );
  const colors = crud<Color, ColorInput>("colors", "colors", "colorsLoading");
  const suppliers = crud<Supplier, SupplierInput>(
    "suppliers",
    "suppliers",
    "suppliersLoading",
  );

  return {
    customers: [],
    customersLoading: false,
    jobWorkers: [],
    jobWorkersLoading: false,
    deniers: [],
    deniersLoading: false,
    colors: [],
    colorsLoading: false,
    suppliers: [],
    suppliersLoading: false,

    refreshCustomers: customers.refresh,
    createCustomer: customers.create,
    updateCustomer: customers.update,
    deleteCustomer: customers.remove,

    refreshJobWorkers: jobWorkers.refresh,
    createJobWorker: jobWorkers.create,
    updateJobWorker: jobWorkers.update,
    deleteJobWorker: jobWorkers.remove,

    refreshDeniers: deniers.refresh,
    createDenier: deniers.create,
    updateDenier: deniers.update,
    deleteDenier: deniers.remove,

    refreshColors: colors.refresh,
    createColor: colors.create,
    updateColor: colors.update,
    deleteColor: colors.remove,

    refreshSuppliers: suppliers.refresh,
    createSupplier: suppliers.create,
    updateSupplier: suppliers.update,
    deleteSupplier: suppliers.remove,
  };
});

/** Boots the masters pickers from the offline cache — call at app mount,
 * alongside auth bootstrap (never at module scope: stores evaluate before
 * the shell configures the adapter). Online refreshes overwrite it. */
export function hydrateMastersCache(): void {
  const boot = readMasters();
  if (!boot) return;
  useMasters.setState({
    customers: boot.customers,
    jobWorkers: boot.jobWorkers,
    deniers: boot.deniers,
    colors: boot.colors,
    suppliers: boot.suppliers,
  });
}
