"use client";

import { create } from "zustand";

type Entity = Record<string, unknown> | null;

type AuthState = {
  token: string | null;
  user: Entity;
  tenant: Entity;
  setAuth: (token: string, user: Record<string, unknown>, tenant: Record<string, unknown>) => void;
  clearAuth: () => void;
  hydrateFromStorage: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  tenant: null,
  setAuth: (token, user, tenant) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "securifi_connect_auth",
        JSON.stringify({ token, user, tenant })
      );
    }
    set({ token, user, tenant });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("securifi_connect_auth");
    }
    set({ token: null, user: null, tenant: null });
  },
  hydrateFromStorage: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("securifi_connect_auth");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      set({
        token: parsed.token || null,
        user: (parsed.user as Record<string, unknown>) || null,
        tenant: (parsed.tenant as Record<string, unknown>) || null,
      });
    } catch {
      // ignore
    }
  },
}));
