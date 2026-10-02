/**
 * Logic tính km & tiền thuê theo đúng mẫu "BẢNG KÊ KM THỰC HIỆN THÁNG":
 *  - KM thực hiện = ODO về - ODO đi
 *  - Giá thuê tháng (cố định) tính cho số km định mức; km vượt định mức tính theo đơn giá đ/km vượt
 *  - Khi giá dầu DO biến động >= ngưỡng (mặc định 10%) so với giá dầu theo hợp đồng:
 *      Đơn giá mới = Đơn giá hiện tại * (1 + hệ số * (Giá dầu mới - Giá dầu HĐ) / Giá dầu HĐ)
 *    (hệ số mặc định 0,3) - áp dụng cho cả giá thuê tháng và đơn giá km vượt.
 */

export type Vehicle = {
  id: number;
  plate: string;
  name: string;
  quotaKm: number;
  basePrice: number;
  excessPrice: number;
  sort: number;
  active: boolean;
};

export type Trip = {
  id: number;
  vehicleId: number;
  tripDate: string; // YYYY-MM-DD
  odoStart: number;
  odoEnd: number | null;
  photoStart: string | null;
  photoEnd: string | null;
  ocrStart: number | null;
  ocrEnd: number | null;
  route: string;
  note: string;
  driverName: string;
  startedAt: string;
  endedAt: string | null;
};

export type PricingSettings = {
  contractFuelPrice: number; // giá dầu DO theo hợp đồng (đ/lít)
  fuelThresholdPct: number; // ngưỡng điều chỉnh, % (mặc định 10)
  fuelCoefficient: number; // hệ số ảnh hưởng của nhiên liệu (mặc định 0,3)
  applyOnDecrease: boolean; // giảm giá khi dầu giảm >= ngưỡng
  vatPct: number; // thuế VAT %
};

export const DEFAULT_PRICING: PricingSettings = {
  contractFuelPrice: 0,
  fuelThresholdPct: 10,
  fuelCoefficient: 0.3,
  applyOnDecrease: true,
  vatPct: 8,
};

export type FuelPrice = { month: string; price: number; priceDate: string | null; note: string };

export type FuelAdjustment = {
  applied: boolean;
  factor: number;
  changePct: number | null; // % chênh lệch so với giá HĐ
  diff: number | null; // đ/lít chênh lệch
  monthPrice: number | null;
  contractPrice: number;
  reason: string;
};

export function computeFuelAdjustment(
  pricing: PricingSettings,
  monthFuel: FuelPrice | null | undefined,
): FuelAdjustment {
  const contractPrice = pricing.contractFuelPrice;
  const base = { contractPrice, monthPrice: monthFuel?.price ?? null };
  if (!contractPrice) {
    return { ...base, applied: false, factor: 1, changePct: null, diff: null, reason: "Chưa cài giá dầu theo hợp đồng" };
  }
  if (!monthFuel?.price) {
    return { ...base, applied: false, factor: 1, changePct: null, diff: null, reason: "Chưa nhập giá dầu của tháng" };
  }
  const diff = monthFuel.price - contractPrice;
  const change = diff / contractPrice;
  const changePct = change * 100;
  const reached = Math.abs(changePct) + 1e-9 >= pricing.fuelThresholdPct;
  if (!reached) {
    return {
      ...base,
      applied: false,
      factor: 1,
      changePct,
      diff,
      reason: `Biến động ${fmtPct(changePct)} chưa tới ngưỡng ${pricing.fuelThresholdPct}%`,
    };
  }
  if (change < 0 && !pricing.applyOnDecrease) {
    return { ...base, applied: false, factor: 1, changePct, diff, reason: "Giá dầu giảm - hợp đồng không điều chỉnh giảm" };
  }
  const factor = 1 + pricing.fuelCoefficient * change;
  return {
    ...base,
    applied: true,
    factor,
    changePct,
    diff,
    reason: `Giá dầu ${change > 0 ? "tăng" : "giảm"} ${fmtPct(Math.abs(changePct))} → đơn giá × ${factor.toFixed(4)}`,
  };
}

export type DayRow = {
  date: string;
  odoStart: number;
  odoEnd: number | null;
  km: number;
  excessKm: number;
  excessAmount: number;
  trips: number;
  routes: string[];
};

export type VehicleMonthSummary = {
  vehicle: Vehicle;
  totalKm: number;
  quotaKm: number;
  excessKm: number;
  remainingKm: number;
  usagePct: number;
  basePriceAdj: number;
  excessPriceAdj: number;
  baseAmount: number;
  excessAmount: number;
  totalAmount: number;
  vatAmount: number;
  totalWithVat: number;
  completedTrips: number;
  openTrips: number;
  gaps: { tripId: number; date: string; prevEnd: number; start: number; km: number }[];
  days: DayRow[];
  firstOdo: number | null;
  lastOdo: number | null;
};

export function tripKm(t: Pick<Trip, "odoStart" | "odoEnd">): number {
  return t.odoEnd != null ? Math.max(0, t.odoEnd - t.odoStart) : 0;
}

export function sortTrips<T extends Pick<Trip, "tripDate" | "odoStart" | "id">>(trips: T[]): T[] {
  return [...trips].sort(
    (a, b) => a.tripDate.localeCompare(b.tripDate) || a.odoStart - b.odoStart || a.id - b.id,
  );
}

export function summarizeVehicleMonth(
  vehicle: Vehicle,
  trips: Trip[],
  fuel: FuelAdjustment,
  pricing: PricingSettings,
): VehicleMonthSummary {
  const sorted = sortTrips(trips.filter((t) => t.vehicleId === vehicle.id));
  const completed = sorted.filter((t) => t.odoEnd != null);
  const totalKm = completed.reduce((s, t) => s + tripKm(t), 0);
  const quotaKm = vehicle.quotaKm;
  const excessKm = Math.max(0, totalKm - quotaKm);
  const basePriceAdj = Math.round(vehicle.basePrice * fuel.factor);
  const excessPriceAdj = Math.round(vehicle.excessPrice * fuel.factor);
  const baseAmount = basePriceAdj;
  const excessAmount = excessKm * excessPriceAdj;
  const totalAmount = baseAmount + excessAmount;
  const vatAmount = Math.round((totalAmount * pricing.vatPct) / 100);

  // Phát hiện "km bị hở": ODO đi chuyến sau khác ODO về chuyến trước
  const gaps: VehicleMonthSummary["gaps"] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.odoEnd != null && cur.odoStart !== prev.odoEnd) {
      gaps.push({ tripId: cur.id, date: cur.tripDate, prevEnd: prev.odoEnd, start: cur.odoStart, km: cur.odoStart - prev.odoEnd });
    }
  }

  // Gộp theo ngày (giống mẫu Excel: mỗi dòng là một ngày) + tính km vượt lũy kế
  const byDate = new Map<string, Trip[]>();
  for (const t of completed) {
    const list = byDate.get(t.tripDate) ?? [];
    list.push(t);
    byDate.set(t.tripDate, list);
  }
  let cumulative = 0;
  const days: DayRow[] = [];
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const km = list.reduce((s, t) => s + tripKm(t), 0);
    const before = Math.max(0, cumulative - quotaKm);
    cumulative += km;
    const after = Math.max(0, cumulative - quotaKm);
    const dayExcess = after - before;
    days.push({
      date,
      odoStart: Math.min(...list.map((t) => t.odoStart)),
      odoEnd: Math.max(...list.map((t) => t.odoEnd ?? t.odoStart)),
      km,
      excessKm: dayExcess,
      excessAmount: dayExcess * excessPriceAdj,
      trips: list.length,
      routes: [...new Set(list.map((t) => t.route).filter(Boolean))],
    });
  }

  return {
    vehicle,
    totalKm,
    quotaKm,
    excessKm,
    remainingKm: Math.max(0, quotaKm - totalKm),
    usagePct: quotaKm > 0 ? (totalKm / quotaKm) * 100 : 0,
    basePriceAdj,
    excessPriceAdj,
    baseAmount,
    excessAmount,
    totalAmount,
    vatAmount,
    totalWithVat: totalAmount + vatAmount,
    completedTrips: completed.length,
    openTrips: sorted.length - completed.length,
    gaps,
    days,
    firstOdo: sorted[0]?.odoStart ?? null,
    lastOdo: completed.length ? Math.max(...completed.map((t) => t.odoEnd!)) : null,
  };
}

// ---------- Định dạng ----------
export const fmtNum = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("vi-VN");
export const fmtMoney = (n: number | null | undefined) => (n == null ? "—" : `${fmtNum(n)} đ`);
export const fmtPct = (n: number) => `${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
export function fmtDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
export function fmtMonth(month: string) {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** Ngày hiện tại theo giờ Việt Nam (UTC+7) dạng YYYY-MM-DD */
export function todayVN(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function currentMonthVN(): string {
  return todayVN().slice(0, 7);
}
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}
