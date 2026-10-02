import { Building2, Calculator, Fuel, Plus, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  computeFuelAdjustment,
  currentMonthVN,
  fmtDate,
  fmtMonth,
  fmtNum,
  fmtPct,
  shiftMonth,
} from "@/lib/billing";
import { getCompany, getPricing, listFuelPrices, listVehicles } from "@/lib/repo";
import {
  deleteFuelPriceAction,
  saveCompanyAction,
  saveFuelPriceAction,
  savePricingAction,
  saveVehicleAction,
} from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import DeleteButton from "@/components/DeleteButton";
import PlateBadge from "@/components/PlateBadge";

export const dynamic = "force-dynamic";

function Section({ id, icon: Icon, title, desc, children }: { id?: string; icon: typeof Truck; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {desc && <p className="text-sm text-slate-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const [vehicles, pricing, fuelPrices, company] = await Promise.all([
    listVehicles({ includeInactive: true }),
    getPricing(),
    listFuelPrices(),
    getCompany(),
  ]);
  const month = currentMonthVN();
  const usedMonths = new Set(fuelPrices.map((f) => f.month));
  const suggestMonth = usedMonths.has(month) ? shiftMonth(month, 1) : month;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-slate-500">Đơn giá thuê, định mức km, giá dầu và thông tin hợp đồng</p>
      </div>

      <Section icon={Truck} title="Xe & đơn giá thuê" desc="Giá thuê tháng tính cho số km định mức; km vượt tính theo đơn giá đ/km vượt (giá theo hợp đồng, trước điều chỉnh giá dầu)">
        <div className="space-y-4">
          {vehicles.map((v) => (
            <ActionForm key={v.id} action={saveVehicleAction} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <input type="hidden" name="id" value={v.id} />
              <div className="mb-3 flex items-center justify-between">
                <PlateBadge plate={v.plate} size="sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={v.active} className="size-4 accent-brand-600" /> Đang sử dụng
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Biển số</label>
                  <input name="plate" defaultValue={v.plate} className="input font-mono font-bold uppercase" required />
                </div>
                <div>
                  <label className="label">Tên gọi</label>
                  <input name="name" defaultValue={v.name} className="input" />
                </div>
                <div>
                  <label className="label">Thứ tự</label>
                  <input name="sort" type="number" defaultValue={v.sort} className="input" />
                </div>
                <div>
                  <label className="label">Định mức km/tháng</label>
                  <MoneyInput name="quotaKm" defaultValue={v.quotaKm} suffix="km" />
                </div>
                <div>
                  <label className="label">Giá thuê tháng</label>
                  <MoneyInput name="basePrice" defaultValue={v.basePrice} suffix="đ" placeholder="VD: 35.000.000" />
                </div>
                <div>
                  <label className="label">Đơn giá km vượt</label>
                  <MoneyInput name="excessPrice" defaultValue={v.excessPrice} suffix="đ/km" placeholder="VD: 6.000" />
                </div>
              </div>
            </ActionForm>
          ))}
          <details className="rounded-2xl border-2 border-dashed border-slate-200 p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-700">
              <Plus className="size-4" /> Thêm xe mới
            </summary>
            <ActionForm action={saveVehicleAction} resetOnSuccess className="mt-4">
              <input type="hidden" name="active" value="on" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Biển số</label>
                  <input name="plate" className="input font-mono font-bold uppercase" placeholder="74C-123.45" required />
                </div>
                <div>
                  <label className="label">Tên gọi</label>
                  <input name="name" className="input" placeholder={`Xe ${vehicles.length + 1}`} />
                </div>
                <div>
                  <label className="label">Thứ tự</label>
                  <input name="sort" type="number" defaultValue={vehicles.length + 1} className="input" />
                </div>
                <div>
                  <label className="label">Định mức km/tháng</label>
                  <MoneyInput name="quotaKm" suffix="km" />
                </div>
                <div>
                  <label className="label">Giá thuê tháng</label>
                  <MoneyInput name="basePrice" suffix="đ" />
                </div>
                <div>
                  <label className="label">Đơn giá km vượt</label>
                  <MoneyInput name="excessPrice" suffix="đ/km" />
                </div>
              </div>
            </ActionForm>
          </details>
        </div>
      </Section>

      <Section icon={Calculator} title="Điều chỉnh đơn giá theo giá dầu" desc="Đơn giá mới = Đơn giá hiện tại × (1 + hệ số × (Giá dầu mới − Giá dầu HĐ) / Giá dầu HĐ)">
        <ActionForm action={savePricingAction}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Giá dầu DO 0,05S-II theo hợp đồng</label>
              <MoneyInput name="contractFuelPrice" defaultValue={pricing.contractFuelPrice} suffix="đ/lít" placeholder="VD: 27.620" />
            </div>
            <div>
              <label className="label">Ngưỡng biến động để điều chỉnh</label>
              <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500">
                <input name="fuelThresholdPct" inputMode="decimal" defaultValue={pricing.fuelThresholdPct} className="w-full rounded-xl border-0 bg-transparent px-3.5 py-2.5 font-semibold focus:outline-none" />
                <span className="pr-3 text-sm text-slate-400">%</span>
              </div>
            </div>
            <div>
              <label className="label">Hệ số ảnh hưởng nhiên liệu</label>
              <input name="fuelCoefficient" inputMode="decimal" defaultValue={pricing.fuelCoefficient} className="input font-semibold" />
            </div>
            <div>
              <label className="label">Thuế VAT</label>
              <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500">
                <input name="vatPct" inputMode="decimal" defaultValue={pricing.vatPct} className="w-full rounded-xl border-0 bg-transparent px-3.5 py-2.5 font-semibold focus:outline-none" />
                <span className="pr-3 text-sm text-slate-400">%</span>
              </div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="applyOnDecrease" defaultChecked={pricing.applyOnDecrease} className="size-4 accent-brand-600" />
            Giảm đơn giá khi giá dầu giảm vượt ngưỡng
          </label>
        </ActionForm>
      </Section>

      <Section id="gia-dau" icon={Fuel} title="Giá dầu theo tháng" desc="Nhập giá dầu DO thực tế ngày cuối cùng của tháng trước để áp dụng cho tháng tính tiền">
        <ActionForm action={saveFuelPriceAction} resetOnSuccess submitLabel="Lưu giá dầu" className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Tháng áp dụng</label>
              <input type="month" name="month" defaultValue={suggestMonth} className="input" required />
            </div>
            <div>
              <label className="label">Giá dầu</label>
              <MoneyInput name="price" suffix="đ/lít" placeholder="30.382" />
            </div>
            <div>
              <label className="label">Ngày công bố giá</label>
              <input type="date" name="priceDate" className="input" />
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input name="note" className="input" placeholder="Petrolimex vùng 1…" />
            </div>
          </div>
        </ActionForm>
        <div className="mt-4 overflow-x-auto">
          {fuelPrices.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Chưa có giá dầu tháng nào</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2">Tháng</th>
                  <th className="py-2 text-right">Giá dầu</th>
                  <th className="py-2 text-right">Chênh lệch</th>
                  <th className="py-2 pl-4">Kết quả</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fuelPrices.map((f) => {
                  const adj = computeFuelAdjustment(pricing, f);
                  return (
                    <tr key={f.month} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 font-medium">
                        {fmtMonth(f.month)}
                        {f.priceDate && <div className="text-xs font-normal text-slate-500">giá ngày {fmtDate(f.priceDate)}</div>}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{fmtNum(f.price)} đ</td>
                      <td className={`py-2.5 text-right tabular-nums ${adj.applied ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                        {adj.changePct != null ? fmtPct(adj.changePct) : "—"}
                      </td>
                      <td className="py-2.5 pl-4 text-xs text-slate-600">
                        {adj.applied ? <b className="text-amber-700">Điều chỉnh × {adj.factor.toFixed(4)}</b> : adj.reason}
                      </td>
                      <td className="py-2.5 text-right">
                        <DeleteButton action={deleteFuelPriceAction.bind(null, f.month)} confirmText={`Xóa giá dầu ${fmtMonth(f.month)}?`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section icon={Building2} title="Thông tin công ty & hợp đồng" desc="Dùng để in lên bảng kê Excel">
        <ActionForm action={saveCompanyAction}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Tên công ty (bên thuê)</label>
              <input name="companyName" defaultValue={company.companyName} className="input" />
            </div>
            <div>
              <label className="label">Địa chỉ</label>
              <input name="companyAddress" defaultValue={company.companyAddress} className="input" />
            </div>
            <div>
              <label className="label">Điện thoại</label>
              <input name="companyPhone" defaultValue={company.companyPhone} className="input" />
            </div>
            <div>
              <label className="label">Nhà cung cấp (bên cho thuê)</label>
              <input name="supplierName" defaultValue={company.supplierName} className="input" />
            </div>
            <div>
              <label className="label">Số hợp đồng</label>
              <input name="contractNo" defaultValue={company.contractNo} className="input" placeholder="…/2026/HĐTX" />
            </div>
            <div>
              <label className="label">Ngày ký hợp đồng</label>
              <input name="contractDate" defaultValue={company.contractDate} className="input" placeholder="01/01/2026" />
            </div>
            <div>
              <label className="label">Phụ lục hợp đồng</label>
              <input name="appendixText" defaultValue={company.appendixText} className="input" placeholder="phụ lục số 01 ký ngày …" />
            </div>
            <div>
              <label className="label">Đại diện bên A (ký tên)</label>
              <input name="signerA" defaultValue={company.signerA} className="input" />
            </div>
            <div>
              <label className="label">Đại diện bên B (ký tên)</label>
              <input name="signerB" defaultValue={company.signerB} className="input" />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="requirePhoto" defaultChecked={company.requirePhoto} className="size-4 accent-brand-600" />
            Bắt buộc tài xế chụp ảnh đồng hồ ODO khi ghi km
          </label>
        </ActionForm>
      </Section>
    </div>
  );
}
