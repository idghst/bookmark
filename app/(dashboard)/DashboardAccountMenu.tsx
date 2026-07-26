"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronUp,
  LogOut
} from "lucide-react";
import { DEMO_USER } from "@/app/lib/config/brand";
import { cn } from "@/lib/utils";

const MENU: Array<{ href: string; label: string; icon: typeof Bookmark }> = [
  { href: "/bookmarks", label: "북마크", icon: Bookmark }
];

export function DashboardAccountMenu({
  className,
  onNavigate
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleNavigate = () => {
    setProfileMenuOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={profileMenuRef} className={cn("relative mx-4 mb-4 shrink-0 border-t border-[#D9D9D9] pt-3", className)}>
      {profileMenuOpen ? (
        <div
          role="menu"
          aria-label="사용자 메뉴"
          className="pop-in absolute bottom-[calc(100%-2px)] left-0 right-0 z-30 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-[#D9D9D9] bg-white py-1 shadow-xl"
        >
          {MENU.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href as Route}
              role="menuitem"
              onClick={handleNavigate}
              className="flex h-10 items-center gap-2.5 px-3 text-sm font-bold text-[#262626] hover:bg-[#F5F6F8]"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="my-1 border-t border-[#D9D9D9]" />
          <button
            type="button"
            disabled
            role="menuitem"
            className="flex h-10 w-full cursor-not-allowed items-center gap-2.5 px-3 text-left text-sm font-bold text-[#A3A3A3]"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="사용자 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        onClick={() => setProfileMenuOpen((value) => !value)}
        className="flex h-12 w-full items-center gap-2 rounded px-2 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111111] text-xs font-bold text-white">
          {DEMO_USER.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[#262626]">{DEMO_USER.name}</span>
          <span className="block truncate text-[11px] text-[#797979]">{DEMO_USER.org}</span>
        </span>
        <ChevronUp className={cn("h-4 w-4 shrink-0 text-[#797979] transition-transform", profileMenuOpen && "rotate-180")} />
      </button>
    </div>
  );
}
