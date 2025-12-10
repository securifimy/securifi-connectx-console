import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserProfileMenuProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    initials?: string | null;
    avatarUrl?: string | null;
  } | null;
  plan?: string | null;
  onLogout?: () => void;
};

export function UserProfileMenu({ user, plan, onLogout }: UserProfileMenuProps) {
  const initials =
    user?.initials ||
    (user?.name ? user.name.split(" ").map((p) => p[0]).join("") : "")?.slice(0, 2).toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar className="h-9 w-9 border shadow-sm">
          <AvatarImage src={user?.avatarUrl || ""} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border border-ui-border-soft bg-white shadow-xl dark:bg-[#111418]"
      >
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border shadow-sm">
              <AvatarImage src={user?.avatarUrl || ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          {plan && (
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-[2px] text-[11px] font-semibold">
              {plan}
            </span>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem>Workspace Profile</DropdownMenuItem>
        <DropdownMenuItem>My Account</DropdownMenuItem>
        <DropdownMenuItem>Billing & Usage</DropdownMenuItem>
        <DropdownMenuItem>Workspace Settings</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-red-600 focus:text-red-700"
          onSelect={(e) => {
            e.preventDefault();
            onLogout?.();
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
