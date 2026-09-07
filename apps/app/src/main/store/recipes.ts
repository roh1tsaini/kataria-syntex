import { create } from "zustand";
import { api } from "@/lib/api";
import { friendlyError } from "@/ui/lib/errors";

type RecipeIngredient = {
  id: string;
  recipeId: string;
  seq: number;
  name: string;
  quantity: number;
  unit: string;
};

export type RecipeListItem = {
  id: string;
  colorId: string;
  colorName: string;
  colorCode: string | null;
  denierId: string;
  denierName: string;
  processTempC: number | null;
  processTimeHrs: number | null;
  processTimeMin: number | null;
  processTimeSec: number | null;
  notes: string | null;
  version: number;
  ingredientCount: number;
  updatedAt: string;
};

type RecipeVersionMeta = {
  version: number;
  restoredFrom: number | null;
  createdAt: string;
  savedByName: string | null;
};

export type RecipeDetail = {
  recipe: RecipeListItem & { createdAt: string; createdBy: string };
  ingredients: RecipeIngredient[];
  versions: RecipeVersionMeta[];
};

export type RecipeVersionPayload = {
  ingredients: { seq: number; name: string; quantity: number; unit: string }[];
  processTempC: number | null;
  processTimeHrs: number | null;
  processTimeMin: number | null;
  processTimeSec: number | null;
  notes: string | null;
};

type RecipeIngredientInput = {
  name: string;
  quantity: number;
  unit: string;
};

export type RecipeInput = {
  colorId: string;
  denierId: string;
  ingredients: RecipeIngredientInput[];
  processTempC: number | null;
  processTimeHrs: number | null;
  processTimeMin: number | null;
  processTimeSec: number | null;
  notes: string | null;
};

type RecipesState = {
  recipes: RecipeListItem[];
  recipesLoading: boolean;
  recipesError: string | null;
  refreshRecipes: () => Promise<void>;
  createRecipe: (input: RecipeInput) => Promise<string>;
  updateRecipe: (id: string, input: RecipeInput) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  fetchRecipe: (id: string) => Promise<RecipeDetail>;
  fetchVersion: (id: string, version: number) => Promise<RecipeVersionPayload>;
  restoreRecipe: (id: string, version: number) => Promise<void>;
  lookupRecipe: (colorId: string, denierId: string) => Promise<string | null>;
};

export const useRecipes = create<RecipesState>()((set) => ({
  recipes: [],
  recipesLoading: false,
  recipesError: null,

  refreshRecipes: async () => {
    set({ recipesLoading: true, recipesError: null });
    try {
      const res = await api<{ items: RecipeListItem[] }>("/recipes");
      set({ recipes: res.items });
    } catch (err) {
      set({ recipesError: friendlyError(err) });
      throw err;
    } finally {
      set({ recipesLoading: false });
    }
  },

  createRecipe: async (input) => {
    const res = await api<{ ok: true; id: string }>("/recipes", {
      method: "POST",
      body: input,
    });
    await useRecipes.getState().refreshRecipes();
    return res.id;
  },

  updateRecipe: async (id, input) => {
    await api(`/recipes/${id}`, { method: "PUT", body: input });
    await useRecipes.getState().refreshRecipes();
  },

  deleteRecipe: async (id) => {
    await api(`/recipes/${id}`, { method: "DELETE" });
    await useRecipes.getState().refreshRecipes();
  },

  fetchRecipe: (id) => api<RecipeDetail>(`/recipes/${id}`),

  fetchVersion: (id, version) =>
    api<{ version: number; payload: RecipeVersionPayload }>(
      `/recipes/${id}/versions/${version}`,
    ).then((res) => res.payload),

  restoreRecipe: async (id, version) => {
    await api(`/recipes/${id}/restore`, {
      method: "POST",
      body: { version },
    });
    await useRecipes.getState().refreshRecipes();
  },

  lookupRecipe: async (colorId, denierId) => {
    const qs = new URLSearchParams({ colorId, denierId });
    const res = await api<{ recipeId: string | null }>(
      `/recipes/lookup?${qs.toString()}`,
    );
    return res.recipeId;
  },
}));
