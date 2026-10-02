import "server-only";
import { hashPassword } from "./password";

/**
 * Lớp truy cập CSDL tối giản: dùng Postgres thật khi có DATABASE_URL (Vercel/Neon),
 * ngược lại dùng PGlite (Postgres chạy trong WASM, lưu ở .data/pglite) để chạy local.
 * Cả hai cùng nhận câu SQL dạng $1, $2... nên chỉ cần một bộ câu lệnh.
 */
type Row = Record<string, unknown>;
type Executor = {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
};

const globalForDb = globalThis as unknown as {
  __dbPromise?: Promise<Executor>;
};

async function createExecutor(): Promise<Executor> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await sql.unsafe(text, params as any[]);
        return rows as unknown as T[];
      },
    };
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Chưa cấu hình DATABASE_URL. Vào Vercel > Storage > tạo Postgres (Neon) và kết nối vào project.",
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const fs = await import("node:fs");
  fs.mkdirSync(".data", { recursive: true });
  const db = await PGlite.create(".data/pglite");
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await db.query(text, params);
      return res.rows as T[];
    },
  };
}

const SCHEMA = `
create table if not exists vehicles (
  id serial primary key,
  plate text not null unique,
  name text not null default '',
  quota_km integer not null default 0,
  base_price bigint not null default 0,
  excess_price integer not null default 0,
  sort integer not null default 0,
  active boolean not null default true
);
create table if not exists users (
  id serial primary key,
  username text not null unique,
  full_name text not null default '',
  phone text not null default '',
  password_hash text not null,
  role text not null default 'user',
  permissions jsonb not null default '[]'::jsonb,
  vehicle_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists trips (
  id serial primary key,
  vehicle_id integer not null references vehicles(id) on delete cascade,
  trip_date date not null,
  odo_start integer not null,
  odo_end integer,
  photo_start text,
  photo_end text,
  ocr_start integer,
  ocr_end integer,
  route text not null default '',
  note text not null default '',
  driver_name text not null default '',
  created_by integer,
  ended_by integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists trips_vehicle_date on trips(vehicle_id, trip_date);
create table if not exists fuel_prices (
  month text primary key,
  price integer not null,
  price_date date,
  note text not null default ''
);
create table if not exists settings (
  key text primary key,
  value jsonb not null
);
`;

const DEFAULT_VEHICLES = [
  { plate: "74G-001.86", name: "Xe 1", quota_km: 5000, sort: 1 },
  { plate: "74G-001.91", name: "Xe 2", quota_km: 5000, sort: 2 },
  { plate: "74H-048.02", name: "Xe 3", quota_km: 3000, sort: 3 },
];

async function init(exec: Executor) {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await exec.query(stmt);
  }
  const [{ count: vCount }] = await exec.query<{ count: string | number }>(
    "select count(*)::int as count from vehicles",
  );
  if (Number(vCount) === 0) {
    for (const v of DEFAULT_VEHICLES) {
      await exec.query(
        "insert into vehicles (plate, name, quota_km, sort) values ($1,$2,$3,$4) on conflict (plate) do nothing",
        [v.plate, v.name, v.quota_km, v.sort],
      );
    }
  }
  const [{ count: uCount }] = await exec.query<{ count: string | number }>(
    "select count(*)::int as count from users",
  );
  if (Number(uCount) === 0) {
    const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "admin123";
    await exec.query(
      "insert into users (username, full_name, password_hash, role) values ($1,$2,$3,'admin') on conflict (username) do nothing",
      [username, "Quản trị viên", await hashPassword(password)],
    );
  }
}

export function getDb(): Promise<Executor> {
  if (!globalForDb.__dbPromise) {
    globalForDb.__dbPromise = (async () => {
      const exec = await createExecutor();
      await init(exec);
      return exec;
    })().catch((err) => {
      globalForDb.__dbPromise = undefined;
      throw err;
    });
  }
  return globalForDb.__dbPromise;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}
