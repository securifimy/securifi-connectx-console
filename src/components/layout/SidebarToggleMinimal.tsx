"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SidebarToggleMinimalProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarToggleMinimal({ collapsed, onToggle }: SidebarToggleMinimalProps) {
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onToggle}
      className="h-10 w-10 rounded-full shadow-sm border border-border/60"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </Button>
  );
}
