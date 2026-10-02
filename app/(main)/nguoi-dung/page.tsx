import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listUsers, listVehicles } from "@/lib/repo";
import UserForm from "@/components/UserForm";
import UserCard from "@/components/UserCard";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const [users, vehiclesFull] = await Promise.all([listUsers(), listVehicles({ includeInactive: true })]);
  const vehicles = vehiclesFull.map((v) => ({ id: v.id, plate: v.plate, name: v.name }));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Người dùng & phân quyền</h1>
        <p className="text-sm text-slate-500">Tạo tài khoản cho tài xế / kế toán, giao xe và cấp quyền theo từng mục</p>
      </div>
      <details className="card group p-4">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-brand-700">
          <UserPlus className="size-5" /> Thêm người dùng mới
        </summary>
        <div className="mt-4">
          <UserForm vehicles={vehicles} />
        </div>
      </details>
      <div className="space-y-3">
        {users.map((u) => (
          <UserCard key={u.id} user={u} vehicles={vehicles} isSelf={u.id === me.id} />
        ))}
      </div>
    </div>
  );
}
