import "server-only";
import { query } from "./db";
import {
  DEFAULT_PRICING,
  monthRange,
  type FuelPrice,
  type PricingSettings,
  type Trip,
  type Vehicle,
} from "./billing";
import type { Permission } from "./permissions";

// ---------- Xe ----------
type VehicleRow = {
  id: number;
  plate: string;
  name: string;
  quota_km: number;
  base_price: string | number;
  excess_price: number;
  sort: number;
  active: boolean;
};
const toVehicle = (r: VehicleRow): Vehicle => ({
  id: Number(r.id),
  plate: r.plate,
  name: r.name,
  quotaKm: Number(r.quota_km),
  basePrice: Number(r.base_price),
  excessPrice: Number(r.excess_price),
  sort: Number(r.sort),
  active: r.active,
});

export async function listVehicles(opts: { includeInactive?: boolean } = {}): Promise<Vehicle[]> {
  const rows = await query<VehicleRow>(
    `select * from vehicles ${opts.includeInactive ? "" : "where active"} order by sort, id`,
  );
  return rows.map(toVehicle);
}

export async function getVehicle(id: number): Promise<Vehicle | null> {
  const [r] = await query<VehicleRow>("select * from vehicles where id = $1", [id]);
  return r ? toVehicle(r) : null;
}

export async function upsertVehicle(v: Omit<Vehicle, "id"> & { id?: number }) {
  if (v.id) {
    await query(
      `update vehicles set plate=$2, name=$3, quota_km=$4, base_price=$5, excess_price=$6, sort=$7, active=$8 where id=$1`,
      [v.id, v.plate, v.name, v.quotaKm, v.basePrice, v.excessPrice, v.sort, v.active],
    );
  } else {
    await query(
      `insert into vehicles (plate, name, quota_km, base_price, excess_price, sort, active) values ($1,$2,$3,$4,$5,$6,$7)`,
      [v.plate, v.name, v.quotaKm, v.basePrice, v.excessPrice, v.sort, v.active],
    );
  }
}

// ---------- Chuyến ----------
type TripRow = {
  id: number;
  vehicle_id: number;
  trip_date: string | Date;
  odo_start: number;
  odo_end: number | null;
  photo_start: string | null;
  photo_end: string | null;
  ocr_start: number | null;
  ocr_end: number | null;
  route: string;
  note: string;
  driver_name: string;
  started_at: string | Date;
  ended_at: string | Date | null;
};

function dateStr(d: string | Date): string {
  if (d instanceof Date) {
    // cột kiểu date trả về Date ở 00:00 giờ địa phương của server
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}
const isoStr = (d: string | Date | null) => (d == null ? null : d instanceof Date ? d.toISOString() : String(d));

const toTrip = (r: TripRow): Trip => ({
  id: Number(r.id),
  vehicleId: Number(r.vehicle_id),
  tripDate: dateStr(r.trip_date),
  odoStart: Number(r.odo_start),
  odoEnd: r.odo_end == null ? null : Number(r.odo_end),
  photoStart: r.photo_start,
  photoEnd: r.photo_end,
  ocrStart: r.ocr_start == null ? null : Number(r.ocr_start),
  ocrEnd: r.ocr_end == null ? null : Number(r.ocr_end),
  route: r.route,
  note: r.note,
  driverName: r.driver_name,
  startedAt: isoStr(r.started_at)!,
  endedAt: isoStr(r.ended_at),
});

const TRIP_COLS = `id, vehicle_id, to_char(trip_date, 'YYYY-MM-DD') as trip_date, odo_start, odo_end, photo_start, photo_end,
  ocr_start, ocr_end, route, note, driver_name, started_at, ended_at`;

export async function listTripsForMonth(month: string, vehicleIds?: number[]): Promise<Trip[]> {
  const { from, to } = monthRange(month);
  const params: unknown[] = [from, to];
  let filter = "";
  if (vehicleIds) {
    if (vehicleIds.length === 0) return [];
    params.push(JSON.stringify(vehicleIds));
    filter = `and vehicle_id in (select (jsonb_array_elements_text($3::jsonb))::int)`;
  }
  const rows = await query<TripRow>(
    `select ${TRIP_COLS} from trips where trip_date between $1 and $2 ${filter}
     order by trip_date desc, odo_start desc, id desc`,
    params,
  );
  return rows.map(toTrip);
}

export async function listRecentTrips(vehicleId: number, limit = 30): Promise<Trip[]> {
  const rows = await query<TripRow>(
    `select ${TRIP_COLS} from trips where vehicle_id = $1 order by trip_date desc, odo_start desc, id desc limit $2`,
    [vehicleId, limit],
  );
  return rows.map(toTrip);
}

export async function getTrip(id: number): Promise<Trip | null> {
  const [r] = await query<TripRow>(`select ${TRIP_COLS} from trips where id = $1`, [id]);
  return r ? toTrip(r) : null;
}

export async function getOpenTrip(vehicleId: number): Promise<Trip | null> {
  const [r] = await query<TripRow>(
    `select ${TRIP_COLS} from trips where vehicle_id = $1 and odo_end is null order by started_at desc limit 1`,
    [vehicleId],
  );
  return r ? toTrip(r) : null;
}

/** Số ODO lớn nhất đã ghi nhận của xe (dùng gợi ý & kiểm tra số mới) */
export async function getLastOdo(vehicleId: number, excludeTripId?: number): Promise<number | null> {
  const [r] = await query<{ v: number | null }>(
    `select max(greatest(odo_start, coalesce(odo_end, 0))) as v from trips where vehicle_id = $1 and id <> $2`,
    [vehicleId, excludeTripId ?? 0],
  );
  return r?.v == null ? null : Number(r.v);
}

export async function insertTrip(t: {
  vehicleId: number;
  tripDate: string;
  odoStart: number;
  odoEnd: number | null;
  photoStart: string | null;
  photoEnd: string | null;
  ocrStart: number | null;
  ocrEnd: number | null;
  route: string;
  note: string;
  driverName: string;
  userId: number;
}): Promise<number> {
  const [r] = await query<{ id: number }>(
    `insert into trips (vehicle_id, trip_date, odo_start, odo_end, photo_start, photo_end, ocr_start, ocr_end,
       route, note, driver_name, created_by, ended_by, ended_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, case when $4::int is null then null else $12::int end,
       case when $4::int is null then null else now() end)
     returning id`,
    [
      t.vehicleId, t.tripDate, t.odoStart, t.odoEnd, t.photoStart, t.photoEnd, t.ocrStart, t.ocrEnd,
      t.route, t.note, t.driverName, t.userId,
    ],
  );
  return Number(r.id);
}

export async function finishTrip(
  id: number,
  t: { odoEnd: number; photoEnd: string | null; ocrEnd: number | null; route: string; note: string; userId: number },
) {
  await query(
    `update trips set odo_end=$2, photo_end=$3, ocr_end=$4, route=$5, note=$6, ended_by=$7, ended_at=now(), updated_at=now()
     where id=$1`,
    [id, t.odoEnd, t.photoEnd, t.ocrEnd, t.route, t.note, t.userId],
  );
}

export async function updateTrip(
  id: number,
  t: { tripDate: string; odoStart: number; odoEnd: number | null; route: string; note: string },
) {
  await query(
    `update trips set trip_date=$2, odo_start=$3, odo_end=$4, route=$5, note=$6, updated_at=now(),
       ended_at = case when $4::int is null then null else coalesce(ended_at, now()) end
     where id=$1`,
    [id, t.tripDate, t.odoStart, t.odoEnd, t.route, t.note],
  );
}

export async function deleteTrip(id: number) {
  await query("delete from trips where id = $1", [id]);
}

export async function listRouteSuggestions(vehicleIds?: number[]): Promise<string[]> {
  const rows = await query<{ route: string }>(
    `select route from trips where route <> '' ${vehicleIds ? "and vehicle_id in (select (jsonb_array_elements_text($1::jsonb))::int)" : ""}
     group by route order by max(started_at) desc limit 40`,
    vehicleIds ? [JSON.stringify(vehicleIds)] : [],
  );
  return rows.map((r) => r.route);
}

// ---------- Giá dầu ----------
type FuelRow = { month: string; price: number; price_date: string | null; note: string };
const toFuel = (r: FuelRow): FuelPrice => ({
  month: r.month,
  price: Number(r.price),
  priceDate: r.price_date,
  note: r.note,
});

export async function listFuelPrices(): Promise<FuelPrice[]> {
  const rows = await query<FuelRow>(
    "select month, price, to_char(price_date, 'YYYY-MM-DD') as price_date, note from fuel_prices order by month desc",
  );
  return rows.map(toFuel);
}

export async function getFuelPrice(month: string): Promise<FuelPrice | null> {
  const [r] = await query<FuelRow>(
    "select month, price, to_char(price_date, 'YYYY-MM-DD') as price_date, note from fuel_prices where month = $1",
    [month],
  );
  return r ? toFuel(r) : null;
}

export async function upsertFuelPrice(f: FuelPrice) {
  await query(
    `insert into fuel_prices (month, price, price_date, note) values ($1,$2,$3,$4)
     on conflict (month) do update set price=excluded.price, price_date=excluded.price_date, note=excluded.note`,
    [f.month, f.price, f.priceDate, f.note],
  );
}

export async function deleteFuelPrice(month: string) {
  await query("delete from fuel_prices where month = $1", [month]);
}

// ---------- Cài đặt ----------
export type CompanySettings = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  supplierName: string;
  contractNo: string;
  contractDate: string;
  appendixText: string;
  signerA: string;
  signerB: string;
  requirePhoto: boolean;
};

export const DEFAULT_COMPANY: CompanySettings = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  supplierName: "",
  contractNo: "",
  contractDate: "",
  appendixText: "",
  signerA: "",
  signerB: "",
  requirePhoto: true,
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [r] = await query<{ value: T | string }>("select value from settings where key = $1", [key]);
  if (!r) return fallback;
  const v = typeof r.value === "string" ? (JSON.parse(r.value) as T) : r.value;
  return { ...fallback, ...v };
}

async function setSetting(key: string, value: unknown) {
  await query(
    `insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

export const getPricing = () => getSetting<PricingSettings>("pricing", DEFAULT_PRICING);
export const savePricing = (p: PricingSettings) => setSetting("pricing", p);
export const getCompany = () => getSetting<CompanySettings>("company", DEFAULT_COMPANY);
export const saveCompany = (c: CompanySettings) => setSetting("company", c);

// ---------- Người dùng ----------
export type UserRecord = {
  id: number;
  username: string;
  fullName: string;
  phone: string;
  role: "admin" | "user";
  permissions: Permission[];
  vehicleIds: number[];
  active: boolean;
  createdAt: string;
};

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  role: "admin" | "user";
  permissions: Permission[] | string;
  vehicle_ids: number[] | string;
  active: boolean;
  created_at: string | Date;
  password_hash: string;
};
const parse = <T,>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);
const toUser = (r: UserRow): UserRecord => ({
  id: Number(r.id),
  username: r.username,
  fullName: r.full_name,
  phone: r.phone,
  role: r.role,
  permissions: parse(r.permissions),
  vehicleIds: parse(r.vehicle_ids).map(Number),
  active: r.active,
  createdAt: isoStr(r.created_at)!,
});

export async function listUsers(): Promise<UserRecord[]> {
  const rows = await query<UserRow>("select * from users order by role, username");
  return rows.map(toUser);
}

export async function getUserByUsername(username: string) {
  const [r] = await query<UserRow>("select * from users where lower(username) = lower($1)", [username]);
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

export async function getUserById(id: number) {
  const [r] = await query<UserRow>("select * from users where id = $1", [id]);
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

export async function createUser(u: {
  username: string;
  fullName: string;
  phone: string;
  role: "admin" | "user";
  permissions: Permission[];
  vehicleIds: number[];
  passwordHash: string;
}) {
  await query(
    `insert into users (username, full_name, phone, role, permissions, vehicle_ids, password_hash)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
    [u.username, u.fullName, u.phone, u.role, JSON.stringify(u.permissions), JSON.stringify(u.vehicleIds), u.passwordHash],
  );
}

export async function updateUser(
  id: number,
  u: {
    fullName: string;
    phone: string;
    role: "admin" | "user";
    permissions: Permission[];
    vehicleIds: number[];
    active: boolean;
    passwordHash?: string;
  },
) {
  await query(
    `update users set full_name=$2, phone=$3, role=$4, permissions=$5::jsonb, vehicle_ids=$6::jsonb, active=$7,
       password_hash = coalesce($8, password_hash)
     where id=$1`,
    [id, u.fullName, u.phone, u.role, JSON.stringify(u.permissions), JSON.stringify(u.vehicleIds), u.active, u.passwordHash ?? null],
  );
}

export async function setUserPassword(id: number, passwordHash: string) {
  await query("update users set password_hash=$2 where id=$1", [id, passwordHash]);
}

export async function deleteUser(id: number) {
  await query("delete from users where id = $1", [id]);
}

export async function countAdmins(): Promise<number> {
  const [r] = await query<{ c: number }>("select count(*)::int as c from users where role='admin' and active");
  return Number(r.c);
}
