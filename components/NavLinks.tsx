"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Settings, Truck, User, Users } from "lucide-react";

export type NavItem = { href: string; label: string; icon: "truck" | "chart" | "settings" | "users" | "user" };

const ICONS = { truck: Truck, chart: BarChart3, settings: Settings, users: Users, user: User };

export default function NavLinks({ items, variant }: { items: NavItem[]; variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/xe/") : pathname.startsWith(href));

  if (variant === "top") {
    return (
      <ul className="flex gap-1">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(it.href) ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10"
                }`}
              >
                <Icon className="size-4" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="mx-auto flex max-w-md">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = isActive(it.href);
        return (
          <li key={it.href} className="flex-1">
            <Link
              href={it.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-brand-700" : "text-slate-500"
              }`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-brand-100" : ""}`}>
                <Icon className="size-5" />
              </span>
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
