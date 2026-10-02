import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, canAccessVehicle } from "@/lib/permissions";
import { computeFuelAdjustment, currentMonthVN, fmtMonth, fmtNum, summarizeVehicleMonth, todayVN } from "@/lib/billing";
import {
  getCompany,
  getFuelPrice,
  getLastOdo,
  getOpenTrip,
  getPricing,
  getVehicle,
  listRecentTrips,
  listRouteSuggestions,
  listTripsForMonth,
} from "@/lib/repo";
import PlateBadge from "@/components/PlateBadge";
import ProgressBar from "@/components/ProgressBar";
import OdoForm from "@/components/OdoForm";
import TripList from "@/components/TripList";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  if (!canAccessVehicle(user, id)) redirect("/?loi=khong-co-quyen");
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  const month = currentMonthVN();
  const [openTrip, lastOdo, recent, routes, company, monthTrips, pricing, fuelPrice] = await Promise.all([
    getOpenTrip(id),
    getLastOdo(id),
    can(user, "odo.history") ? listRecentTrips(id, 40) : Promise.resolve([]),
    listRouteSuggestions([id]),
    getCompany(),
    listTripsForMonth(month, [id]),
    getPricing(),
    getFuelPrice(month),
  ]);
  const s = summarizeVehicleMonth(vehicle, monthTrips, computeFuelAdjustment(pricing, fuelPrice), pricing);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/" className="btn-ghost -ml-2 p-2" aria-label="Quay lại">
          <ChevronLeft className="size-6" />
        </Link>
        <PlateBadge plate={vehicle.plate} size="lg" />
        <span className="ml-auto text-sm text-slate-500">{vehicle.name}</span>
      </div>

      <div className="card p-4">
        <div className="flex items-end justify-between text-sm">
          <span className="text-slate-500">{fmtMonth(month)}</span>
          <span>
            <b className="text-xl tabular-nums">{fmtNum(s.totalKm)}</b>
            <span className="text-slate-400"> / {fmtNum(vehicle.quotaKm)} km</span>
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar pct={s.usagePct} />
        </div>
        <div className="mt-1.5 text-right text-xs">
          {s.excessKm > 0 ? (
            <span className="font-semibold text-rose-600">Đã vượt định mức {fmtNum(s.excessKm)} km</span>
          ) : (
            <span className="text-slate-500">Còn {fmtNum(s.remainingKm)} km trong định mức</span>
          )}
        </div>
      </div>

      {can(user, "odo.create") ? (
        <OdoForm
          vehicleId={vehicle.id}
          plate={vehicle.plate}
          openTrip={
            openTrip
              ? {
                  id: openTrip.id,
                  odoStart: openTrip.odoStart,
                  tripDate: openTrip.tripDate,
                  route: openTrip.route,
                  note: openTrip.note,
                  photoStart: openTrip.photoStart,
                }
              : null
          }
          lastOdo={lastOdo}
          routes={routes}
          requirePhoto={company.requirePhoto && user.role !== "admin"}
          today={todayVN()}
        />
      ) : (
        <div className="card flex items-center gap-3 p-4 text-sm text-slate-600">
          <Lock className="size-5 text-slate-400" /> Bạn không có quyền nhập ODO cho xe này.
        </div>
      )}

      {can(user, "odo.history") && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Lịch sử chuyến gần đây</h2>
          <TripList trips={recent} canEdit={can(user, "odo.edit")} />
        </section>
      )}
    </div>
  );
}
