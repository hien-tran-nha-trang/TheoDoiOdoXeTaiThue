import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleDot, Gauge, ParkingCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeFuelAdjustment, currentMonthVN, fmtDate, fmtMonth, fmtNum, summarizeVehicleMonth } from "@/lib/billing";
import { getFuelPrice, getOpenTrip, getPricing, listTripsForMonth, listVehicles } from "@/lib/repo";
import PlateBadge from "@/components/PlateBadge";
import ProgressBar from "@/components/ProgressBar";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const user = await requireUser();
  const { loi } = await searchParams;
  const month = currentMonthVN();
  const allowed = user.role === "admin" ? undefined : user.vehicleIds;
  const [all, trips, pricing, fuelPrice] = await Promise.all([
    listVehicles(),
    listTripsForMonth(month, allowed),
    getPricing(),
    getFuelPrice(month),
  ]);
  const vehicles = allowed ? all.filter((v) => allowed.includes(v.id)) : all;
  const fuel = computeFuelAdjustment(pricing, fuelPrice);
  const openTrips = await Promise.all(vehicles.map((v) => getOpenTrip(v.id)));
  const hour = Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 13));
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <div className="space-y-5">
      {loi === "khong-co-quyen" && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="size-4 shrink-0" /> Bạn không có quyền truy cập mục đó.
        </div>
      )}
      <section>
        <p className="text-sm text-slate-500">{greet},</p>
        <h1 className="text-2xl font-bold">{user.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {fmtMonth(month)} · Chọn xe để ghi ODO lúc <b>đi</b> hoặc lúc <b>về</b>
        </p>
      </section>

      {vehicles.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <ParkingCircle className="size-10 text-slate-300" />
          <p className="font-semibold">Bạn chưa được giao xe nào</p>
          <p className="text-sm text-slate-500">Liên hệ quản trị viên để được phân quyền xe.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => {
            const s = summarizeVehicleMonth(v, trips, fuel, pricing);
            const open = openTrips[i];
            return (
              <Link
                key={v.id}
                href={`/xe/${v.id}`}
                className="card group relative block overflow-hidden p-5 transition hover:shadow-md hover:ring-brand-300 active:scale-[.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <PlateBadge plate={v.plate} />
                    <p className="mt-2 text-sm text-slate-500">
                      {v.name} · Định mức {fmtNum(v.quotaKm)} km/tháng
                    </p>
                  </div>
                  {open ? (
                    <span className="badge bg-amber-100 text-amber-800">
                      <CircleDot className="size-3 animate-pulse" /> Đang chạy
                    </span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-800">Sẵn sàng</span>
                  )}
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">Km tháng này</div>
                    <div className="text-3xl font-extrabold tabular-nums">
                      {fmtNum(s.totalKm)}
                      <span className="ml-1 text-base font-semibold text-slate-400">/ {fmtNum(v.quotaKm)}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {s.excessKm > 0 ? (
                      <span className="font-bold text-rose-600">Vượt {fmtNum(s.excessKm)} km</span>
                    ) : (
                      <span className="text-slate-500">Còn {fmtNum(s.remainingKm)} km</span>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar pct={s.usagePct} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Gauge className="size-4" />
                    {open ? (
                      <>
                        Đi lúc ODO <b className="text-slate-800 tabular-nums">{fmtNum(open.odoStart)}</b> ({fmtDate(open.tripDate)})
                      </>
                    ) : s.lastOdo != null ? (
                      <>
                        ODO gần nhất <b className="text-slate-800 tabular-nums">{fmtNum(s.lastOdo)}</b>
                      </>
                    ) : (
                      "Chưa có chuyến trong tháng"
                    )}
                  </span>
                  <span className="flex items-center font-semibold text-brand-700">
                    {open ? "Ghi về" : "Ghi đi"}
                    <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {can(user, "report.view") && vehicles.length > 0 && (
        <Link href="/bao-cao" className="card flex items-center justify-between p-4 text-sm font-semibold text-brand-700">
          Xem báo cáo km & chi phí tháng <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
