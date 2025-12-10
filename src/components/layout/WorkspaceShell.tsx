"use client";

import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

type ActiveNav = "inbox" | "channels" | "team" | "api" | "settings" | "billing";
type LayoutMode = "default" | "chat-2col" | "chat-3col";

export function WorkspaceShell({
  children,
  activeNav,
  layout = "default",
}: {
  children: React.ReactNode;
  activeNav: ActiveNav;
  layout?: LayoutMode;
}) {
  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Sidebar variant="tenant" activeNav={activeNav} />
      <div className="flex-1 flex flex-col">
        <Topbar variant="tenant" />
        <main className="flex-1 overflow-y-hidden bg-[hsl(var(--background))] pb-24">
          {layout === "chat-2col" || layout === "chat-3col" ? (
            <div className="h-full">
              <div className="grid grid-cols-12 h-[calc(100vh-64px)]">
                {children}
              </div>
            </div>
          ) : (
            <div className="max-w-screen-xl mx-auto w-full px-6 py-10 pb-28 space-y-6 overflow-y-auto">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
