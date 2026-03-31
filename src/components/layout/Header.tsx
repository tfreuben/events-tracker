"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, LogOut, LayoutDashboard, Table2, Inbox, MessageSquarePlus } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useState } from "react";
import { AdminGate } from "./AdminGate";
import { cn } from "@/lib/utils";

export function Header() {
  const { isAdmin, logout } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="bg-[#0b1a3b] text-white">
        <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              TrustFlight Events
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors",
                  pathname === "/"
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                <Table2 size={15} />
                Events
              </Link>
              {isAdmin && (
                <Link
                  href="/budget"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors",
                    pathname === "/budget"
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <LayoutDashboard size={15} />
                  Budget
                </Link>
              )}
              {isAdmin ? (
                <Link
                  href="/submissions"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors",
                    pathname === "/submissions"
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Inbox size={15} />
                  Submissions
                </Link>
              ) : (
                <Link
                  href="/suggest"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors",
                    pathname === "/suggest"
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  <MessageSquarePlus size={15} />
                  Suggest
                </Link>
              )}
            </nav>
          </div>
          <div>
            {isAdmin ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Lock size={14} />
                Admin
              </button>
            )}
          </div>
        </div>
      </header>
      {showLogin && <AdminGate onClose={() => setShowLogin(false)} />}
    </>
  );
}
