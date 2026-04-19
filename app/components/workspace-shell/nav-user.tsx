"use client";

import { RiArrowUpDownLine, RiCloseCircleLine, RiLogoutBoxLine, RiShieldKeyholeLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useTranslator } from "@/lib/i18n/provider";

import type { WorkspaceShellUser } from "./workspace-context";

// Sidebar footer user menu, adapted from `sidebar-16` per the design
// (`add-workspace-app-shell`): replace `IconPlaceholder` with remix
// icons, route the avatar fallback to user initials computed from
// name/email, and populate items from the existing account-security,
// account-close, and sign-out entries.
export function NavUser({ user }: { user: WorkspaceShellUser }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const translate = useTranslator();
  const [signingOut, setSigningOut] = useState(false);

  const initials = userInitials(user);
  const displayName = user.name.trim().length > 0 ? user.name : user.email;
  const signOutLabel = signingOut ? translate("auth.signOut.submit.loading") : translate("auth.signOut.submit");

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) {
        toast.error("We couldn't sign you out. Please try again.");
        setSigningOut(false);
        return;
      }
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("We couldn't sign you out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-testid="workspace-shell-user-menu-trigger"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
                <AvatarFallback className="rounded-md text-xs font-medium">{initials}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-[0.625rem] text-sidebar-foreground/70">{user.email}</span>
              </span>
              <RiArrowUpDownLine className="ml-auto size-3.5 opacity-70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-(--radix-dropdown-menu-trigger-width) max-w-72 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-xs">
                <Avatar className="size-8 rounded-md">
                  {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
                  <AvatarFallback className="rounded-md text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate text-xs font-medium">{displayName}</span>
                  <span className="truncate text-[0.625rem] text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => router.push("/account/security")} data-testid="workspace-shell-user-menu-security">
                <RiShieldKeyholeLine />
                Account security
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/account/close")} data-testid="workspace-shell-user-menu-close">
                <RiCloseCircleLine />
                Close account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
              disabled={signingOut}
              data-testid="workspace-shell-user-menu-signout"
            >
              <RiLogoutBoxLine />
              {signOutLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Build a 1–2 character avatar initial set. Prefer name parts, fall
// back to the email local-part so users without a configured name
// still see a meaningful glyph instead of a generic placeholder.
function userInitials(user: WorkspaceShellUser): string {
  const source = user.name.trim().length > 0 ? user.name.trim() : (user.email.split("@")[0] ?? "");
  const tokens = source.split(/[\s._-]+/u).filter((token) => token.length > 0);
  if (tokens.length === 0) return "U";
  if (tokens.length === 1) {
    const first = tokens[0] ?? "";
    return first.slice(0, 2).toUpperCase();
  }
  const first = tokens[0]?.charAt(0) ?? "";
  const second = tokens[tokens.length - 1]?.charAt(0) ?? "";
  return `${first}${second}`.toUpperCase();
}
