"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, passwordFingerprint, requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { can, canAccessVehicle, PERMISSIONS, type Permission } from "@/lib/permissions";
import { isValidMonth, todayVN } from "@/lib/billing";
import * as repo from "@/lib/repo";

export type ActionResult = { ok: boolean; error?: string; message?: string; id?: number };

const MAX_ODO = 9_999_999;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string): number | null => {
  const raw = str(fd, k).replace(/[.,\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const validOdo = (n: number | null): n is number => n != null && Number.isInteger(n) && n >= 0 && n <= MAX_ODO;

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ======================= Đăng nhập =======================
export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const username = str(fd, "username").toLowerCase();
  const password = str(fd, "password");
  const next = str(fd, "next");
  if (!username || !password) return { ok: false, error: "Nhập tên đăng nhập và mật khẩu" };
  const user = await repo.getUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" };
  }
  if (!user.active) return { ok: false, error: "Tài khoản đã bị khóa. Liên hệ quản trị viên." };
  const token = await signSession({
    uid: user.id,
    pv: passwordFingerprint(user.passwordHash),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/dang-nhap");
}

export async function changeOwnPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Phiên đăng nhập đã hết hạn" };
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (next.length < 6) return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự" };
  const u = await repo.getUserById(me.id);
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { ok: false, error: "Mật khẩu hiện tại không đúng" };
  const hash = await hashPassword(next);
  await repo.setUserPassword(me.id, hash);
  (await cookies()).set(
    SESSION_COOKIE,
    await signSession({ uid: me.id, pv: passwordFingerprint(hash), exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE },
  );
  return { ok: true, message: "Đã đổi mật khẩu" };
}

// ======================= Ghi ODO (tài xế) =======================
/**
 * mode = "start": ghi ODO lúc đi (mở chuyến)
 * mode = "end":   ghi ODO lúc về cho chuyến đang mở
 * mode = "full":  ghi trọn chuyến (đi + về) một lần
 */
export async function saveOdoAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" };
  if (!can(user, "odo.create")) return { ok: false, error: "Bạn không có quyền nhập ODO" };

  const mode = str(fd, "mode");
  const vehicleId = Number(str(fd, "vehicleId"));
  if (!canAccessVehicle(user, vehicleId)) return { ok: false, error: "Bạn không được giao xe này" };
  const vehicle = await repo.getVehicle(vehicleId);
  if (!vehicle || !vehicle.active) return { ok: false, error: "Không tìm thấy xe" };

  const company = await repo.getCompany();
  const mustPhoto = company.requirePhoto && user.role !== "admin";
  const route = str(fd, "route").slice(0, 200);
  const note = str(fd, "note").slice(0, 500);
  const tripDate = str(fd, "tripDate") || todayVN();
  if (!isDate(tripDate)) return { ok: false, error: "Ngày không hợp lệ" };
  if (tripDate > todayVN()) return { ok: false, error: "Không được ghi cho ngày trong tương lai" };

  const odoStart = num(fd, "odoStart");
  const odoEnd = num(fd, "odoEnd");
  const photoStart = str(fd, "photoStart") || null;
  const photoEnd = str(fd, "photoEnd") || null;
  const ocrStart = num(fd, "ocrStart");
  const ocrEnd = num(fd, "ocrEnd");
  const cleanOcr = (n: number | null) => (n != null && Number.isFinite(n) ? n : null);

  if (mode === "start" || mode === "full") {
    if (!validOdo(odoStart)) return { ok: false, error: "Số ODO lúc đi không hợp lệ" };
    if (mustPhoto && !photoStart) return { ok: false, error: "Vui lòng chụp ảnh đồng hồ ODO lúc đi" };
    if (mode === "full") {
      if (!validOdo(odoEnd)) return { ok: false, error: "Số ODO lúc về không hợp lệ" };
      if (odoEnd < odoStart) return { ok: false, error: "ODO lúc về phải lớn hơn hoặc bằng ODO lúc đi" };
      if (mustPhoto && !photoEnd) return { ok: false, error: "Vui lòng chụp ảnh đồng hồ ODO lúc về" };
    }
    const open = await repo.getOpenTrip(vehicleId);
    if (open) return { ok: false, error: `Xe ${vehicle.plate} đang có chuyến chưa ghi ODO về. Hãy ghi ODO về trước.` };
    const id = await repo.insertTrip({
      vehicleId,
      tripDate,
      odoStart,
      odoEnd: mode === "full" ? odoEnd : null,
      photoStart,
      photoEnd: mode === "full" ? photoEnd : null,
      ocrStart: cleanOcr(ocrStart),
      ocrEnd: mode === "full" ? cleanOcr(ocrEnd) : null,
      route,
      note,
      driverName: user.fullName,
      userId: user.id,
    });
    revalidateAll();
    return { ok: true, id, message: mode === "full" ? "Đã lưu chuyến" : "Đã ghi ODO lúc đi. Chúc chuyến đi an toàn!" };
  }

  if (mode === "end") {
    const tripId = Number(str(fd, "tripId"));
    const trip = await repo.getTrip(tripId);
    if (!trip || trip.vehicleId !== vehicleId) return { ok: false, error: "Không tìm thấy chuyến đang chạy" };
    if (trip.odoEnd != null) return { ok: false, error: "Chuyến này đã ghi ODO về rồi" };
    if (!validOdo(odoEnd)) return { ok: false, error: "Số ODO lúc về không hợp lệ" };
    if (odoEnd < trip.odoStart)
      return { ok: false, error: `ODO lúc về (${odoEnd}) nhỏ hơn ODO lúc đi (${trip.odoStart})` };
    if (mustPhoto && !photoEnd) return { ok: false, error: "Vui lòng chụp ảnh đồng hồ ODO lúc về" };
    await repo.finishTrip(tripId, {
      odoEnd,
      photoEnd,
      ocrEnd: cleanOcr(ocrEnd),
      route: route || trip.route,
      note: note || trip.note,
      userId: user.id,
    });
    revalidateAll();
    return { ok: true, id: tripId, message: `Đã ghi ODO lúc về. Chuyến này chạy ${(odoEnd - trip.odoStart).toLocaleString("vi-VN")} km` };
  }
  return { ok: false, error: "Thao tác không hợp lệ" };
}

// ======================= Sửa / xóa chuyến =======================
export async function updateTripAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user, "odo.edit")) return { ok: false, error: "Bạn không có quyền sửa chuyến" };
  const id = Number(str(fd, "id"));
  const trip = await repo.getTrip(id);
  if (!trip || !canAccessVehicle(user, trip.vehicleId)) return { ok: false, error: "Không tìm thấy chuyến" };
  const tripDate = str(fd, "tripDate");
  const odoStart = num(fd, "odoStart");
  const odoEnd = num(fd, "odoEnd");
  if (!isDate(tripDate)) return { ok: false, error: "Ngày không hợp lệ" };
  if (!validOdo(odoStart)) return { ok: false, error: "ODO đi không hợp lệ" };
  if (odoEnd != null && (!validOdo(odoEnd) || odoEnd < odoStart))
    return { ok: false, error: "ODO về phải lớn hơn hoặc bằng ODO đi" };
  await repo.updateTrip(id, {
    tripDate,
    odoStart,
    odoEnd,
    route: str(fd, "route").slice(0, 200),
    note: str(fd, "note").slice(0, 500),
  });
  revalidateAll();
  return { ok: true, message: "Đã cập nhật chuyến" };
}

export async function deleteTripAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user, "odo.edit")) return { ok: false, error: "Bạn không có quyền xóa chuyến" };
  const trip = await repo.getTrip(id);
  if (!trip || !canAccessVehicle(user, trip.vehicleId)) return { ok: false, error: "Không tìm thấy chuyến" };
  await repo.deleteTrip(id);
  revalidateAll();
  return { ok: true, message: "Đã xóa chuyến" };
}

// ======================= Quản trị: xe & đơn giá =======================
export async function saveVehicleAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = Number(str(fd, "id")) || undefined;
  const plate = str(fd, "plate").toUpperCase();
  if (!plate) return { ok: false, error: "Nhập biển số xe" };
  const quotaKm = num(fd, "quotaKm") ?? 0;
  const basePrice = num(fd, "basePrice") ?? 0;
  const excessPrice = num(fd, "excessPrice") ?? 0;
  if ([quotaKm, basePrice, excessPrice].some((n) => !Number.isFinite(n) || n < 0))
    return { ok: false, error: "Số liệu không hợp lệ" };
  try {
    await repo.upsertVehicle({
      id,
      plate,
      name: str(fd, "name"),
      quotaKm,
      basePrice,
      excessPrice,
      sort: num(fd, "sort") ?? 0,
      active: fd.get("active") === "on",
    });
  } catch {
    return { ok: false, error: "Biển số đã tồn tại" };
  }
  revalidateAll();
  return { ok: true, message: `Đã lưu xe ${plate}` };
}

export async function savePricingAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const contractFuelPrice = num(fd, "contractFuelPrice") ?? 0;
  const fuelThresholdPct = Number(str(fd, "fuelThresholdPct").replace(",", "."));
  const fuelCoefficient = Number(str(fd, "fuelCoefficient").replace(",", "."));
  const vatPct = Number(str(fd, "vatPct").replace(",", "."));
  if (
    !Number.isFinite(contractFuelPrice) ||
    !(fuelThresholdPct >= 0) ||
    !(fuelCoefficient >= 0 && fuelCoefficient <= 1) ||
    !(vatPct >= 0 && vatPct <= 20)
  )
    return { ok: false, error: "Số liệu không hợp lệ" };
  await repo.savePricing({
    contractFuelPrice,
    fuelThresholdPct,
    fuelCoefficient,
    vatPct,
    applyOnDecrease: fd.get("applyOnDecrease") === "on",
  });
  revalidateAll();
  return { ok: true, message: "Đã lưu cài đặt đơn giá" };
}

export async function saveFuelPriceAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const month = str(fd, "month");
  const price = num(fd, "price");
  const priceDate = str(fd, "priceDate");
  if (!isValidMonth(month)) return { ok: false, error: "Chọn tháng áp dụng" };
  if (!price || !(price > 1000)) return { ok: false, error: "Nhập giá dầu (đ/lít)" };
  if (priceDate && !isDate(priceDate)) return { ok: false, error: "Ngày giá dầu không hợp lệ" };
  await repo.upsertFuelPrice({ month, price, priceDate: priceDate || null, note: str(fd, "note") });
  revalidateAll();
  return { ok: true, message: "Đã lưu giá dầu" };
}

export async function deleteFuelPriceAction(month: string): Promise<ActionResult> {
  await requireAdmin();
  await repo.deleteFuelPrice(month);
  revalidateAll();
  return { ok: true };
}

export async function saveCompanyAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await repo.saveCompany({
    companyName: str(fd, "companyName"),
    companyAddress: str(fd, "companyAddress"),
    companyPhone: str(fd, "companyPhone"),
    supplierName: str(fd, "supplierName"),
    contractNo: str(fd, "contractNo"),
    contractDate: str(fd, "contractDate"),
    appendixText: str(fd, "appendixText"),
    signerA: str(fd, "signerA"),
    signerB: str(fd, "signerB"),
    requirePhoto: fd.get("requirePhoto") === "on",
  });
  revalidateAll();
  return { ok: true, message: "Đã lưu thông tin" };
}

// ======================= Quản trị: người dùng & phân quyền =======================
export async function saveUserAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const id = Number(str(fd, "id")) || 0;
  const username = str(fd, "username").toLowerCase();
  const password = str(fd, "password");
  const role = str(fd, "role") === "admin" ? "admin" : "user";
  const validPerms = new Set<string>(PERMISSIONS.map((p) => p.key));
  const permissions = fd.getAll("permissions").map(String).filter((p) => validPerms.has(p)) as Permission[];
  const vehicleIds = fd.getAll("vehicleIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const active = fd.get("active") === "on";
  const fullName = str(fd, "fullName");
  const phone = str(fd, "phone");

  if (!fullName) return { ok: false, error: "Nhập họ tên" };
  if (password && password.length < 6) return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự" };

  if (!id) {
    if (!/^[a-z0-9._-]{3,30}$/.test(username))
      return { ok: false, error: "Tên đăng nhập 3-30 ký tự: chữ thường không dấu, số, dấu . _ -" };
    if (!password) return { ok: false, error: "Nhập mật khẩu cho tài khoản mới" };
    if (await repo.getUserByUsername(username)) return { ok: false, error: "Tên đăng nhập đã tồn tại" };
    await repo.createUser({
      username,
      fullName,
      phone,
      role,
      permissions,
      vehicleIds,
      passwordHash: await hashPassword(password),
    });
    revalidateAll();
    return { ok: true, message: `Đã tạo tài khoản ${username}` };
  }

  const existing = await repo.getUserById(id);
  if (!existing) return { ok: false, error: "Không tìm thấy tài khoản" };
  if (existing.role === "admin" && (role !== "admin" || !active) && (await repo.countAdmins()) <= 1)
    return { ok: false, error: "Phải còn ít nhất 1 quản trị viên đang hoạt động" };
  if (id === me.id && (!active || role !== "admin"))
    return { ok: false, error: "Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập" };
  await repo.updateUser(id, {
    fullName,
    phone,
    role,
    permissions,
    vehicleIds,
    active,
    passwordHash: password ? await hashPassword(password) : undefined,
  });
  revalidateAll();
  return { ok: true, message: `Đã cập nhật ${existing.username}` };
}

export async function deleteUserAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, error: "Không thể xóa tài khoản đang đăng nhập" };
  const u = await repo.getUserById(id);
  if (!u) return { ok: false, error: "Không tìm thấy tài khoản" };
  if (u.role === "admin" && (await repo.countAdmins()) <= 1)
    return { ok: false, error: "Phải còn ít nhất 1 quản trị viên" };
  await repo.deleteUser(id);
  revalidateAll();
  return { ok: true, message: "Đã xóa tài khoản" };
}
