import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Fuel, Info } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  currentMonthVN,
  fmtDate,
  fmtMoney,
  fmtMonth,
  fmtNum,
  fmtPct,
  isValidMonth,
  shiftMonth,
  sortTrips,
} from "@/lib/billing";
import { loadMonthReport } from "@/lib/report";
import PlateBadge from "@/components/PlateBadge";
import ProgressBar from "@/components/ProgressBar";
import TripList from "@/components/TripList";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ thang?: string; xe?: string }> }) {
  const user = await requirePermission("report.view");
  const sp = await searchParams;
  const month = isValidMonth(sp.thang) ? sp.thang : currentMonthVN();
  const { summaries, trips, fuel, fuelPrice, pricing } = await loadMonthReport(month, user);
  const selected = Number(sp.xe) || null;
  const plates = Object.fromEntries(summaries.map((s) => [s.vehicle.id, s.vehicle.plate]));
  const shownTrips = sortTrips(selected ? trips.filter((t) => t.vehicleId === selected) : trips).reverse();
  const totalKm = summaries.reduce((a, s) => a + s.totalKm, 0);
  const total = summaries.reduce((a, s) => a + s.totalAmount, 0);
  const totalVat = summaries.reduce((a, s) => a + s.totalWithVat, 0);
  const missingPrice = summaries.filter((s) => !s.vehicle.basePrice);
  const isCurrent = month === currentMonthVN();
  const q = (m: string, xe?: number | null) => `/bao-cao?thang=${m}${xe ? `&xe=${xe}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={q(shiftMonth(month, -1), selected)} className="btn-secondary p-2.5" aria-label="Tháng trước">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-40 text-center">
            <div className="text-xs font-medium text-slate-500 uppercase">Báo cáo km & chi phí</div>
            <h1 className="text-xl font-bold">{fmtMonth(month)}</h1>
          </div>
          <Link
            href={q(shiftMonth(month, 1), selected)}
            className={`btn-secondary p-2.5 ${isCurrent ? "pointer-events-none opacity-40" : ""}`}
            aria-label="Tháng sau"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        {can(user, "report.export") && (
          <a href={`/api/export?month=${month}`} className="btn-primary">
            <Download className="size-4" /> Xuất Excel bảng kê
          </a>
        )}
      </div>

      {/* Giá dầu */}
      <div
        className={`flex items-start gap-3 rounded-2xl p-4 text-sm ring-1 ${
          fuel.applied ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-white text-slate-700 ring-slate-200"
        }`}
      >
        <Fuel className={`mt-0.5 size-5 shrink-0 ${fuel.applied ? "text-amber-600" : "text-slate-400"}`} />
        <div>
          <div className="font-semibold">
            Giá dầu DO: {fuelPrice ? `${fmtNum(fuelPrice.price)} đ/lít` : "chưa nhập"}
            {fuelPrice?.priceDate && <span className="font-normal"> (ngày {fmtDate(fuelPrice.priceDate)})</span>}
            {fuel.contractPrice > 0 && (
              <span className="font-normal"> · Giá HĐ {fmtNum(fuel.contractPrice)} đ/lít</span>
            )}
            {fuel.changePct != null && <span className="font-normal"> · chênh {fmtPct(fuel.changePct)}</span>}
          </div>
          <div className="mt-0.5">{fuel.reason}</div>
          {user.role === "admin" && (
            <Link href="/cai-dat#gia-dau" className="mt-1 inline-block font-medium text-brand-700">
              Cập nhật giá dầu →
            </Link>
          )}
        </div>
      </div>

      {missingPrice.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Chưa cài đơn giá thuê cho xe {missingPrice.map((s) => s.vehicle.plate).join(", ")}.{" "}
            {user.role === "admin" && (
              <Link href="/cai-dat" className="font-semibold underline">
                Cài đặt ngay
              </Link>
            )}
          </span>
        </div>
      )}

      {/* Tổng */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Tổng km thực hiện", value: `${fmtNum(totalKm)} km` },
          { label: "Km vượt định mức", value: `${fmtNum(summaries.reduce((a, s) => a + s.excessKm, 0))} km` },
          { label: "Tổng tiền (chưa VAT)", value: fmtMoney(total) },
          { label: `Sau VAT ${fmtNum(pricing.vatPct)}%`, value: fmtMoney(totalVat), strong: true },
        ].map((k) => (
          <div key={k.label} className={`card p-4 ${k.strong ? "bg-brand-700 text-white ring-brand-700" : ""}`}>
            <div className={`text-xs font-medium ${k.strong ? "text-brand-100" : "text-slate-500"}`}>{k.label}</div>
            <div className="mt-1 text-lg font-extrabold tabular-nums sm:text-xl">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Từng xe */}
      <div className="grid gap-4 lg:grid-cols-3">
        {summaries.map((s) => {
          const edited = trips.filter(
            (t) =>
              t.vehicleId === s.vehicle.id &&
              ((t.ocrStart != null && t.ocrStart !== t.odoStart) || (t.ocrEnd != null && t.odoEnd != null && t.ocrEnd !== t.odoEnd)),
          ).length;
          return (
            <div key={s.vehicle.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
                <PlateBadge plate={s.vehicle.plate} />
                <Link
                  href={q(month, selected === s.vehicle.id ? null : s.vehicle.id)}
                  className={`badge ${selected === s.vehicle.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {s.completedTrips} chuyến
                </Link>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-extrabold tabular-nums">{fmtNum(s.totalKm)} km</span>
                    <span className="text-sm text-slate-500">ĐM {fmtNum(s.quotaKm)} km</span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar pct={s.usagePct} />
                  </div>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Giá thuê tháng{fuel.applied ? " (đã đ/c)" : ""}</dt>
                    <dd className="font-semibold tabular-nums">{fmtMoney(s.basePriceAdj)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">
                      Km vượt: {fmtNum(s.excessKm)} × {fmtNum(s.excessPriceAdj)}đ
                    </dt>
                    <dd className={`font-semibold tabular-nums ${s.excessAmount ? "text-rose-600" : ""}`}>{fmtMoney(s.excessAmount)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5">
                    <dt className="font-semibold">Tổng chưa VAT</dt>
                    <dd className="font-bold tabular-nums">{fmtMoney(s.totalAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Sau VAT</dt>
                    <dd className="font-bold text-brand-700 tabular-nums">{fmtMoney(s.totalWithVat)}</dd>
                  </div>
                </dl>
                {(s.openTrips > 0 || s.gaps.length > 0 || edited > 0) && (
                  <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                    {s.openTrips > 0 && <li>• {s.openTrips} chuyến chưa ghi ODO về (chưa tính km)</li>}
                    {s.gaps.map((g) => (
                      <li key={g.tripId}>
                        • {fmtDate(g.date)}: ODO đi {fmtNum(g.start)} ≠ ODO về trước {fmtNum(g.prevEnd)} (
                        {g.km > 0 ? `hở ${fmtNum(g.km)} km chưa ghi` : `chồng ${fmtNum(-g.km)} km`})
                      </li>
                    ))}
                    {edited > 0 && <li>• {edited} chuyến có số km sửa tay khác số đọc từ ảnh</li>}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bảng theo ngày (giống mẫu Excel) */}
      {summaries.some((s) => s.days.length) && (
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <Info className="size-4 text-slate-400" />
            <h2 className="font-bold">Bảng kê km theo ngày</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th rowSpan={2} className="border-b border-slate-200 px-3 py-2 text-left">
                    Ngày
                  </th>
                  {summaries.map((s) => (
                    <th key={s.vehicle.id} colSpan={4} className="border-b border-l border-slate-200 px-3 py-2 font-mono">
                      {s.vehicle.plate}
                    </th>
                  ))}
                </tr>
                <tr>
                  {summaries.map((s) => (
                    <FragmentHeaders key={s.vehicle.id} />
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...new Set(summaries.flatMap((s) => s.days.map((d) => d.date)))].sort().map((date) => (
                  <tr key={date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{fmtDate(date)}</td>
                    {summaries.map((s) => {
                      const d = s.days.find((x) => x.date === date);
                      return (
                        <DayCells key={s.vehicle.id} d={d ? [d.odoStart, d.odoEnd, d.km, d.excessKm] : null} />
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-amber-50 font-bold">
                  <td className="px-3 py-2">Tổng</td>
                  {summaries.map((s) => (
                    <DayCells key={s.vehicle.id} d={[null, null, s.totalKm, s.excessKm]} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center justify-between text-lg font-bold">
          <span>Chi tiết chuyến{selected ? ` - ${plates[selected]}` : ""}</span>
          {selected && (
            <Link href={q(month)} className="text-sm font-medium text-brand-700">
              Xem tất cả xe
            </Link>
          )}
        </h2>
        <TripList trips={shownTrips} canEdit={can(user, "odo.edit")} plates={plates} emptyText="Không có chuyến nào trong tháng" />
      </section>
    </div>
  );
}

function FragmentHeaders() {
  return (
    <>
      <th className="border-b border-l border-slate-200 px-2 py-1.5 text-right font-medium">Đi</th>
      <th className="border-b border-slate-200 px-2 py-1.5 text-right font-medium">Về</th>
      <th className="border-b border-slate-200 px-2 py-1.5 text-right font-medium">Km</th>
      <th className="border-b border-slate-200 px-2 py-1.5 text-right font-medium">Vượt</th>
    </>
  );
}

function DayCells({ d }: { d: (number | null)[] | null }) {
  if (!d)
    return (
      <>
        <td className="border-l border-slate-100 px-2 py-2" />
        <td />
        <td />
        <td />
      </>
    );
  return (
    <>
      <td className="border-l border-slate-100 px-2 py-2 text-right text-slate-500">{d[0] != null ? fmtNum(d[0]) : ""}</td>
      <td className="px-2 py-2 text-right text-slate-500">{d[1] != null ? fmtNum(d[1]) : ""}</td>
      <td className="px-2 py-2 text-right font-semibold">{fmtNum(d[2])}</td>
      <td className={`px-2 py-2 text-right ${d[3] ? "font-semibold text-rose-600" : "text-slate-300"}`}>{d[3] ? fmtNum(d[3]) : "–"}</td>
    </>
  );
}
