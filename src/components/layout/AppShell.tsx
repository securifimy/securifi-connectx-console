"use client";

import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ui-bg text-ui-text flex">
      <Sidebar variant="tenant" />
      <div className="flex-1 flex flex-col">
        <Topbar variant="tenant" />
        <main className="flex-1 bg-ui-bg overflow-auto pb-24">
          <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
