"use client";

import { create } from "zustand";

interface ChannelWizardState {
  channelAccountId: number | null;
  status: string | null;
  qr: string | null;
  isLoading: boolean;
  error: string | null;

  setChannelAccountId: (id: number | null) => void;
  setStatus: (status: string | null) => void;
  setQr: (qr: string | null) => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;

  reset: () => void;
}

export const useChannelWizard = create<ChannelWizardState>((set) => ({
  channelAccountId: null,
  status: null,
  qr: null,
  isLoading: false,
  error: null,

  setChannelAccountId: (id) => set({ channelAccountId: id }),
  setStatus: (status) => set({ status }),
  setQr: (qr) => set({ qr }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (message) => set({ error: message }),

  reset: () =>
    set({
      channelAccountId: null,
      status: null,
      qr: null,
      isLoading: false,
      error: null,
    }),
}));
