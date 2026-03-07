"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

type ActiveNav = "inbox" | "channels" | "team" | "api" | "settings" | "billing";
type LayoutMode = "default" | "chat-2col" | "chat-3col";
type WorkspaceHeader = {
  title?: string;
  subtitle?: string;
};

export function WorkspaceShell({
  children,
  activeNav,
  layout = "default",
  header,
}: {
  children: ReactNode;
  activeNav: ActiveNav;
  layout?: LayoutMode;
  header?: WorkspaceHeader;
}) {
  return (
    <div className="flex h-full min-h-0 w-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Sidebar variant="tenant" activeNav={activeNav} />
      <div className="flex-1 flex flex-col min-h-0">
        <Topbar
          variant="tenant"
          title={header?.title}
          subtitle={header?.subtitle}
        />
        <main className="flex-1 min-h-0 bg-[hsl(var(--background))] overflow-hidden">
          {layout === "chat-2col" || layout === "chat-3col" ? (
            <div className="h-full min-h-0 overflow-hidden">
              <div className="grid grid-cols-12 h-full min-h-0">{children}</div>
            </div>
          ) : (
            <div className="max-w-screen-xl mx-auto w-full h-full min-h-0 px-6 py-10 space-y-6 overflow-y-auto">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
