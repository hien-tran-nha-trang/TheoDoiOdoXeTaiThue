"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Flag, LoaderCircle, MapPin, Route, Save, TriangleAlert } from "lucide-react";
import { saveOdoAction, type ActionResult } from "@/app/actions";
import PhotoCapture, { EMPTY_PHOTO, type PhotoState } from "./PhotoCapture";

type OpenTrip = { id: number; odoStart: number; tripDate: string; route: string; note: string; photoStart: string | null };

function OdoInput({
  name,
  label,
  value,
  onChange,
  highlight,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} <span className="text-rose-500">*</span>
      </label>
      <div
        className={`flex items-center rounded-2xl bg-white ring-2 transition focus-within:ring-brand-500 ${
          highlight ? "ring-emerald-400" : "ring-slate-300"
        }`}
      >
        <input
          id={name}
          name={name}
          inputMode="numeric"
          pattern="[0-9.]*"
          autoComplete="off"
          placeholder="0"
          value={value ? Number(value).toLocaleString("vi-VN") : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 7))}
          className="w-full min-w-0 rounded-2xl border-0 bg-transparent px-4 py-3 font-mono text-3xl font-extrabold tracking-wider text-slate-900 tabular-nums placeholder:text-slate-300 focus:outline-none"
        />
        <span className="pr-4 text-lg font-semibold text-slate-400">km</span>
      </div>
    </div>
  );
}

export default function OdoForm({
  vehicleId,
  plate,
  openTrip,
  lastOdo,
  routes,
  requirePhoto,
  today,
}: {
  vehicleId: number;
  plate: string;
  openTrip: OpenTrip | null;
  lastOdo: number | null;
  routes: string[];
  requirePhoto: boolean;
  today: string;
}) {
  const router = useRouter();
  const [fullMode, setFullMode] = useState(false);
  const mode: "start" | "end" | "full" = openTrip ? "end" : fullMode ? "full" : "start";
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveOdoAction, null);

  const [photoStart, setPhotoStart] = useState<PhotoState>(EMPTY_PHOTO);
  const [photoEnd, setPhotoEnd] = useState<PhotoState>(EMPTY_PHOTO);
  const [odoStart, setOdoStart] = useState(openTrip ? String(openTrip.odoStart) : "");
  const [odoEnd, setOdoEnd] = useState("");
  const [route, setRoute] = useState(openTrip?.route ?? "");
  const [note, setNote] = useState(openTrip?.note ?? "");
  const [tripDate, setTripDate] = useState(openTrip?.tripDate ?? today);
  const [showDate, setShowDate] = useState(false);
  const [done, setDone] = useState<ActionResult | null>(null);

  // Khi chuyến mở/đóng (sau khi lưu), nạp lại dữ liệu mặc định cho bước tiếp theo
  useEffect(() => {
    setOdoStart(openTrip ? String(openTrip.odoStart) : "");
    setRoute(openTrip?.route ?? "");
    setNote(openTrip?.note ?? "");
    setTripDate(openTrip?.tripDate ?? today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrip?.id]);

  useEffect(() => {
    if (state?.ok) {
      setDone(state);
      setPhotoStart(EMPTY_PHOTO);
      setPhotoEnd(EMPTY_PHOTO);
      setOdoEnd("");
      if (mode === "full") {
        setOdoStart("");
        setRoute("");
        setNote("");
      }
      setFullMode(false);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  const startNum = odoStart ? Number(odoStart) : null;
  const endNum = odoEnd ? Number(odoEnd) : null;
  const tripKm = startNum != null && endNum != null ? endNum - startNum : null;

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (mode !== "end" && startNum != null && lastOdo != null) {
      if (startNum < lastOdo) w.push(`ODO đi thấp hơn số gần nhất đã ghi (${lastOdo.toLocaleString("vi-VN")} km).`);
      else if (startNum - lastOdo > 50)
        w.push(`ODO đi cao hơn lần ghi trước ${(startNum - lastOdo).toLocaleString("vi-VN")} km - có chuyến nào chưa ghi?`);
    }
    if (tripKm != null && tripKm < 0) w.push("ODO về đang nhỏ hơn ODO đi.");
    if (tripKm != null && tripKm > 1500) w.push(`Quãng đường ${tripKm.toLocaleString("vi-VN")} km lớn bất thường cho một chuyến.`);
    if (photoStart.ocrValue != null && startNum != null && photoStart.ocrValue !== startNum && mode !== "end")
      w.push(`Số ODO đi khác số đọc từ ảnh (${photoStart.ocrValue.toLocaleString("vi-VN")}).`);
    if (photoEnd.ocrValue != null && endNum != null && photoEnd.ocrValue !== endNum)
      w.push(`Số ODO về khác số đọc từ ảnh (${photoEnd.ocrValue.toLocaleString("vi-VN")}).`);
    return w;
  }, [mode, startNum, endNum, lastOdo, tripKm, photoStart.ocrValue, photoEnd.ocrValue]);

  const needStart = mode !== "end";
  const needEnd = mode !== "start";
  const missingPhoto = requirePhoto && ((needStart && !photoStart.ref) || (needEnd && !photoEnd.ref));
  const missingOdo = (needStart && !odoStart) || (needEnd && !odoEnd);
  const blocking = tripKm != null && tripKm < 0;

  if (done) {
    return (
      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-11" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Đã lưu thành công</h2>
        <p className="mt-1 text-slate-600">{done.message}</p>
        <button className="btn-primary mt-6 w-full max-w-xs py-3" onClick={() => setDone(null)}>
          Tiếp tục
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (warnings.length && !confirm(`Lưu ý:\n• ${warnings.join("\n• ")}\n\nBạn vẫn muốn lưu?`)) e.preventDefault();
      }}
      className="space-y-5"
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {openTrip && <input type="hidden" name="tripId" value={openTrip.id} />}
      <input type="hidden" name="photoStart" value={photoStart.ref ?? ""} />
      <input type="hidden" name="photoEnd" value={photoEnd.ref ?? ""} />
      <input type="hidden" name="ocrStart" value={photoStart.ocrValue ?? ""} />
      <input type="hidden" name="ocrEnd" value={photoEnd.ocrValue ?? ""} />
      <input type="hidden" name="tripDate" value={tripDate} />
      {mode === "end" && <input type="hidden" name="odoStart" value={odoStart} />}

      {/* Tiêu đề bước */}
      <div
        className={`flex items-center gap-3 rounded-2xl p-4 text-white ${
          mode === "end" ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-brand-600 to-brand-800"
        }`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20">
          {mode === "end" ? <Flag className="size-6" /> : <MapPin className="size-6" />}
        </span>
        <div className="min-w-0">
          <div className="text-lg leading-tight font-bold">
            {mode === "end" ? "Ghi ODO lúc VỀ" : mode === "full" ? "Ghi cả chuyến (đi + về)" : "Ghi ODO lúc ĐI"}
          </div>
          <div className="truncate text-sm text-white/85">
            {mode === "end"
              ? `Đi từ ${openTrip!.odoStart.toLocaleString("vi-VN")} km · ${openTrip!.tripDate.split("-").reverse().join("/")}`
              : `Xe ${plate}${lastOdo != null ? ` · ODO gần nhất ${lastOdo.toLocaleString("vi-VN")} km` : ""}`}
          </div>
        </div>
      </div>

      {needStart && (
        <div className="card space-y-4 p-4">
          <PhotoCapture
            label={mode === "full" ? "Ảnh ODO lúc đi" : "Ảnh đồng hồ ODO"}
            vehicleId={vehicleId}
            lastOdo={lastOdo}
            value={photoStart}
            onChange={setPhotoStart}
            onOcr={(km) => setOdoStart(String(km))}
            required={requirePhoto}
          />
          <OdoInput
            name="odoStart"
            label="Số ODO lúc đi"
            value={odoStart}
            onChange={setOdoStart}
            highlight={photoStart.ocrValue != null && Number(odoStart) === photoStart.ocrValue}
          />
          {!odoStart && lastOdo != null && (
            <button type="button" onClick={() => setOdoStart(String(lastOdo))} className="text-sm font-medium text-brand-700">
              Dùng ODO gần nhất: {lastOdo.toLocaleString("vi-VN")} km
            </button>
          )}
        </div>
      )}

      {needEnd && (
        <div className="card space-y-4 p-4">
          <PhotoCapture
            label={mode === "full" ? "Ảnh ODO lúc về" : "Ảnh đồng hồ ODO"}
            vehicleId={vehicleId}
            lastOdo={startNum ?? lastOdo}
            value={photoEnd}
            onChange={setPhotoEnd}
            onOcr={(km) => setOdoEnd(String(km))}
            required={requirePhoto}
          />
          <OdoInput
            name="odoEnd"
            label="Số ODO lúc về"
            value={odoEnd}
            onChange={setOdoEnd}
            highlight={photoEnd.ocrValue != null && Number(odoEnd) === photoEnd.ocrValue}
          />
          {tripKm != null && (
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                tripKm < 0 ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-900"
              }`}
            >
              <span className="text-sm font-medium">Km chuyến này</span>
              <span className="text-2xl font-extrabold tabular-nums">{tripKm.toLocaleString("vi-VN")} km</span>
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4 p-4">
        <div>
          <label className="label flex items-center gap-1.5" htmlFor="route">
            <Route className="size-4 text-slate-400" /> Tuyến đường
          </label>
          <input
            id="route"
            name="route"
            className="input"
            list="route-suggestions"
            placeholder="VD: Nha Trang - Cam Ranh - Nha Trang"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            maxLength={200}
          />
          <datalist id="route-suggestions">
            {routes.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          {routes.length > 0 && !route && (
            <div className="mt-2 flex flex-wrap gap-2">
              {routes.slice(0, 6).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRoute(r)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 active:bg-brand-100"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="note">
            Ghi chú
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            className="input"
            placeholder="Hàng hóa, điểm giao, sự cố…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </div>
        {mode !== "end" && (
          <div className="text-sm">
            {showDate ? (
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="tripDateInput">
                  <CalendarDays className="size-4 text-slate-400" /> Ngày chạy
                </label>
                <input
                  id="tripDateInput"
                  type="date"
                  className="input"
                  value={tripDate}
                  max={today}
                  onChange={(e) => setTripDate(e.target.value)}
                />
              </div>
            ) : (
              <button type="button" className="flex items-center gap-1.5 text-slate-500" onClick={() => setShowDate(true)}>
                <CalendarDays className="size-4" /> Ngày {tripDate.split("-").reverse().join("/")} ·{" "}
                <span className="font-medium text-brand-700">Đổi ngày</span>
              </button>
            )}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
      {state?.error && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{state.error}</p>}

      <div className="pb-safe sticky bottom-[4.5rem] z-20 -mx-4 bg-gradient-to-t from-[var(--bg)] from-60% to-transparent px-4 pt-4 pb-2 md:bottom-0">
        <button
          className={`w-full rounded-2xl py-4 text-lg font-bold text-white shadow-xl transition active:scale-[.98] disabled:opacity-50 ${
            mode === "end" ? "bg-orange-600 shadow-orange-600/30" : "bg-brand-600 shadow-brand-600/30"
          }`}
          disabled={pending || missingOdo || missingPhoto || blocking}
        >
          <span className="flex items-center justify-center gap-2">
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}
            {mode === "end" ? "Lưu ODO lúc về" : mode === "full" ? "Lưu chuyến" : "Lưu ODO lúc đi"}
          </span>
        </button>
        {(missingPhoto || missingOdo) && (
          <p className="mt-2 text-center text-xs text-slate-500">
            {missingPhoto ? "Cần chụp ảnh đồng hồ ODO" : "Cần nhập số ODO"}
          </p>
        )}
      </div>

      {!openTrip && (
        <p className="text-center text-sm">
          <button type="button" className="font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => setFullMode((v) => !v)}>
            {fullMode ? "← Quay lại ghi ODO lúc đi" : "Quên ghi lúc đi? Ghi cả chuyến (đi + về) một lần"}
          </button>
        </p>
      )}
    </form>
  );
}
