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
    <div className="flex min-h-full w-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Sidebar variant="tenant" activeNav={activeNav} />
      <div className="flex-1 flex flex-col">
        <Topbar variant="tenant" />
        <main className="flex-1 bg-[hsl(var(--background))]">
          {layout === "chat-2col" || layout === "chat-3col" ? (
            <div className="h-full min-h-[calc(100vh-64px)] overflow-hidden">
              <div className="grid grid-cols-12 h-full">{children}</div>
            </div>
          ) : (
            <div className="max-w-screen-xl mx-auto w-full px-6 py-10 space-y-6">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
