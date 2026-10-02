import "server-only";
import { computeFuelAdjustment, summarizeVehicleMonth } from "./billing";
import { getCompany, getFuelPrice, getPricing, listTripsForMonth, listVehicles } from "./repo";
import type { SessionUser } from "./permissions";

export async function loadMonthReport(month: string, user: SessionUser) {
  const allowed = user.role === "admin" ? undefined : user.vehicleIds;
  const [vehiclesAll, trips, pricing, fuelPrice, company] = await Promise.all([
    listVehicles(),
    listTripsForMonth(month, allowed),
    getPricing(),
    getFuelPrice(month),
    getCompany(),
  ]);
  const vehicles = allowed ? vehiclesAll.filter((v) => allowed.includes(v.id)) : vehiclesAll;
  const fuel = computeFuelAdjustment(pricing, fuelPrice);
  const summaries = vehicles.map((v) => summarizeVehicleMonth(v, trips, fuel, pricing));
  return { vehicles, trips, pricing, fuelPrice, fuel, summaries, company };
}
