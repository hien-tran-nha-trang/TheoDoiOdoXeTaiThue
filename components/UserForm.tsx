"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { saveUserAction } from "@/app/actions";
import { DEFAULT_USER_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import ActionForm from "./ActionForm";

type U = {
  id?: number;
  username?: string;
  fullName?: string;
  phone?: string;
  role?: "admin" | "user";
  permissions?: Permission[];
  vehicleIds?: number[];
  active?: boolean;
};

export default function UserForm({
  user,
  vehicles,
  onDone,
}: {
  user?: U;
  vehicles: { id: number; plate: string; name: string }[];
  onDone?: () => void;
}) {
  const isNew = !user?.id;
  const [role, setRole] = useState<"admin" | "user">(user?.role ?? "user");
  return (
    <ActionForm action={saveUserAction} resetOnSuccess={isNew} onSuccess={onDone} submitLabel={isNew ? "Tạo tài khoản" : "Lưu thay đổi"}>
      {!isNew && <input type="hidden" name="id" value={user!.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Tên đăng nhập</label>
          <input
            name="username"
            defaultValue={user?.username}
            disabled={!isNew}
            className="input font-mono lowercase disabled:bg-slate-100"
            placeholder="vd: taixe.an"
            autoCapitalize="none"
            required={isNew}
          />
        </div>
        <div>
          <label className="label">{isNew ? "Mật khẩu" : "Đặt lại mật khẩu"}</label>
          <input
            name="password"
            type="text"
            className="input"
            placeholder={isNew ? "Tối thiểu 6 ký tự" : "Bỏ trống nếu không đổi"}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">Họ tên</label>
          <input name="fullName" defaultValue={user?.fullName} className="input" required />
        </div>
        <div>
          <label className="label">Số điện thoại</label>
          <input name="phone" defaultValue={user?.phone} className="input" inputMode="tel" />
        </div>
      </div>

      <div className="mt-4">
        <span className="label">Vai trò</span>
        <div className="grid grid-cols-2 gap-2">
          {(["user", "admin"] as const).map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm ring-1 transition ${
                role === r ? "bg-brand-50 font-semibold text-brand-800 ring-brand-400" : "bg-white ring-slate-200"
              }`}
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-brand-600" />
              {r === "admin" ? "Quản trị viên" : "Người dùng (tài xế, kế toán…)"}
            </label>
          ))}
        </div>
      </div>

      {role === "admin" ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
          <ShieldCheck className="size-4" /> Quản trị viên có toàn quyền trên tất cả các xe và mục cài đặt.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Quyền theo mục</legend>
            <div className="space-y-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-slate-200 has-[:checked]:bg-emerald-50 has-[:checked]:ring-emerald-300">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p.key}
                    defaultChecked={(user?.permissions ?? DEFAULT_USER_PERMISSIONS).includes(p.key)}
                    className="mt-0.5 size-4 accent-emerald-600"
                  />
                  <span className="text-sm">
                    <span className="font-semibold">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Xe được giao</legend>
            <div className="space-y-2">
              {vehicles.map((v) => (
                <label key={v.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-slate-200 has-[:checked]:bg-amber-50 has-[:checked]:ring-amber-300">
                  <input
                    type="checkbox"
                    name="vehicleIds"
                    value={v.id}
                    defaultChecked={user?.vehicleIds?.includes(v.id)}
                    className="size-4 accent-amber-600"
                  />
                  <span className="font-mono font-bold">{v.plate}</span>
                  <span className="text-sm text-slate-500">{v.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {!isNew && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={user?.active ?? true} className="size-4 accent-brand-600" /> Tài khoản đang hoạt động
        </label>
      )}
      {isNew && <input type="hidden" name="active" value="on" />}
    </ActionForm>
  );
}
