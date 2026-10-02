export const PERMISSIONS = [
  {
    key: "odo.create",
    label: "Nhập ODO đi / về",
    desc: "Chụp ảnh đồng hồ, ghi số km lúc đi và lúc về",
  },
  {
    key: "odo.history",
    label: "Xem lịch sử chuyến",
    desc: "Xem các chuyến đã ghi của xe được giao",
  },
  {
    key: "odo.edit",
    label: "Sửa / xóa chuyến",
    desc: "Chỉnh sửa số km, tuyến đường hoặc xóa chuyến của xe được giao",
  },
  {
    key: "report.view",
    label: "Xem báo cáo km & chi phí",
    desc: "Xem tổng km, km vượt định mức và tiền thuê theo tháng",
  },
  {
    key: "report.export",
    label: "Xuất Excel bảng kê",
    desc: "Tải file Excel bảng kê km thực hiện trong tháng",
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const DEFAULT_USER_PERMISSIONS: Permission[] = ["odo.create", "odo.history"];

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "user";
  permissions: Permission[];
  vehicleIds: number[];
};

export function can(user: SessionUser | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions.includes(perm);
}

export function canAccessVehicle(user: SessionUser | null | undefined, vehicleId: number): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.vehicleIds.includes(vehicleId);
}
