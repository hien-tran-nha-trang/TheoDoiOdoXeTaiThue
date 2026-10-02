import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query } from "./db";
import { can, type Permission, type SessionUser } from "./permissions";
import { SESSION_COOKIE, verifySession } from "./session";

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "user";
  permissions: Permission[] | string;
  vehicle_ids: number[] | string;
  password_hash: string;
  active: boolean;
};

function parseJson<T>(v: T | string): T {
  return typeof v === "string" ? (JSON.parse(v) as T) : v;
}

/** Dấu vân tay mật khẩu: đổi mật khẩu => mọi phiên cũ hết hiệu lực. */
export function passwordFingerprint(hash: string): string {
  return hash.slice(-10);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const [row] = await query<UserRow>("select * from users where id = $1", [payload.uid]);
  if (!row || !row.active || passwordFingerprint(row.password_hash) !== payload.pv) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name || row.username,
    role: row.role,
    permissions: parseJson(row.permissions),
    vehicleIds: parseJson(row.vehicle_ids).map(Number),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");
  return user;
}

export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, perm)) redirect("/?loi=khong-co-quyen");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/?loi=khong-co-quyen");
  return user;
}
