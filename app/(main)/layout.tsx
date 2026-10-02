import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import NavLinks, { type NavItem } from "@/components/NavLinks";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items: NavItem[] = [{ href: "/", label: "Xe", icon: "truck" }];
  if (can(user, "report.view")) items.push({ href: "/bao-cao", label: "Báo cáo", icon: "chart" });
  if (user.role === "admin") {
    items.push({ href: "/cai-dat", label: "Cài đặt", icon: "settings" });
    items.push({ href: "/nguoi-dung", label: "Người dùng", icon: "users" });
  }
  items.push({ href: "/tai-khoan", label: "Tài khoản", icon: "user" });

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-900/95 text-white backdrop-blur supports-[backdrop-filter]:bg-brand-900/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <span className="text-[15px] leading-tight">
              ODO Xe Tải
              <span className="block text-[11px] font-medium text-brand-200">Theo dõi km xe thuê</span>
            </span>
          </Link>
          <nav className="ml-6 hidden flex-1 md:block">
            <NavLinks items={items} variant="top" />
          </nav>
          <div className="ml-auto text-right text-xs leading-tight md:ml-0">
            <div className="font-semibold">{user.fullName}</div>
            <div className="text-brand-200">@{user.username}{user.role === "admin" ? " · Quản trị" : ""}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-4 md:pt-6">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <NavLinks items={items} variant="bottom" />
      </nav>
    </div>
  );
}
