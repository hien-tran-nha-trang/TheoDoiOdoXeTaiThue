"use client";

import { useState } from "react";
import { ChevronDown, Phone } from "lucide-react";
import { deleteUserAction } from "@/app/actions";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import UserForm from "./UserForm";
import DeleteButton from "./DeleteButton";

export default function UserCard({
  user,
  vehicles,
  isSelf,
}: {
  user: {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    role: "admin" | "user";
    permissions: Permission[];
    vehicleIds: number[];
    active: boolean;
  };
  vehicles: { id: number; plate: string; name: string }[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const plates = vehicles.filter((v) => user.vehicleIds.includes(v.id)).map((v) => v.plate);
  return (
    <div className={`card overflow-hidden ${!user.active ? "opacity-60" : ""}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full text-base font-bold ${
            user.role === "admin" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {(user.fullName || user.username).trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{user.fullName}</span>
            <span className="font-mono text-xs text-slate-500">@{user.username}</span>
            {user.role === "admin" && <span className="badge bg-brand-100 text-brand-800">Quản trị</span>}
            {!user.active && <span className="badge bg-slate-200 text-slate-700">Đã khóa</span>}
            {isSelf && <span className="badge bg-emerald-100 text-emerald-800">Bạn</span>}
          </div>
          {user.phone && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Phone className="size-3" /> {user.phone}
            </div>
          )}
          {user.role === "user" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plates.length ? (
                plates.map((p) => (
                  <span key={p} className="badge bg-amber-100 font-mono text-amber-900">
                    {p}
                  </span>
                ))
              ) : (
                <span className="badge bg-rose-50 text-rose-700">Chưa giao xe</span>
              )}
              {PERMISSIONS.filter((p) => user.permissions.includes(p.key)).map((p) => (
                <span key={p.key} className="badge bg-emerald-50 text-emerald-800">
                  {p.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={`mt-2 size-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
          <UserForm user={user} vehicles={vehicles} />
          {!isSelf && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <DeleteButton
                action={deleteUserAction.bind(null, user.id)}
                confirmText={`Xóa tài khoản ${user.username}? Lịch sử chuyến vẫn được giữ lại.`}
                label="Xóa tài khoản"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
