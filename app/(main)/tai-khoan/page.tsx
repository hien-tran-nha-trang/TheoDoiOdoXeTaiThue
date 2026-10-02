import { KeyRound, LogOut, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS, can } from "@/lib/permissions";
import { getUserById, listVehicles } from "@/lib/repo";
import { verifyPassword } from "@/lib/password";
import { changeOwnPasswordAction, logoutAction } from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import PlateBadge from "@/components/PlateBadge";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const [full, vehicles] = await Promise.all([getUserById(user.id), listVehicles()]);
  const mine = user.role === "admin" ? vehicles : vehicles.filter((v) => user.vehicleIds.includes(v.id));
  const defaultPw = full ? await verifyPassword("admin123", full.passwordHash) : false;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="card p-5">
        <div className="text-sm text-slate-500">Đăng nhập với</div>
        <div className="text-xl font-bold">{user.fullName}</div>
        <div className="font-mono text-sm text-slate-500">@{user.username}</div>
        <div className="mt-4">
          <div className="label">Xe được giao</div>
          <div className="flex flex-wrap gap-2">
            {mine.length ? mine.map((v) => <PlateBadge key={v.id} plate={v.plate} size="sm" />) : <span className="text-sm text-slate-500">Chưa có</span>}
          </div>
        </div>
        <div className="mt-4">
          <div className="label">Quyền</div>
          <ul className="space-y-1 text-sm">
            {PERMISSIONS.map((p) => (
              <li key={p.key} className={can(user, p.key) ? "text-emerald-700" : "text-slate-400 line-through"}>
                {can(user, p.key) ? "✓" : "✕"} {p.label}
              </li>
            ))}
            {user.role === "admin" && <li className="text-emerald-700">✓ Cài đặt & quản lý người dùng</li>}
          </ul>
        </div>
      </div>

      {defaultPw && (
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          Bạn đang dùng mật khẩu mặc định. Hãy đổi mật khẩu ngay để bảo mật hệ thống.
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <KeyRound className="size-5 text-slate-400" /> Đổi mật khẩu
        </h2>
        <ActionForm action={changeOwnPasswordAction} resetOnSuccess submitLabel="Đổi mật khẩu">
          <div className="space-y-3">
            <div>
              <label className="label">Mật khẩu hiện tại</label>
              <input name="current" type="password" className="input" autoComplete="current-password" required />
            </div>
            <div>
              <label className="label">Mật khẩu mới</label>
              <input name="next" type="password" className="input" autoComplete="new-password" minLength={6} required />
            </div>
          </div>
        </ActionForm>
      </div>

      <form action={logoutAction}>
        <button className="btn-secondary w-full py-3 text-rose-600">
          <LogOut className="size-5" /> Đăng xuất
        </button>
      </form>
    </div>
  );
}
