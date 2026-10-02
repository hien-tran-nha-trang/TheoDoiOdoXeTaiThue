"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, ImageOff, LoaderCircle, Pencil, Route, Trash2, TriangleAlert, User, X } from "lucide-react";
import { deleteTripAction, updateTripAction, type ActionResult } from "@/app/actions";
import type { Trip } from "@/lib/billing";
import { photoSrc } from "@/lib/photo";

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("vi-VN"));
const fmtD = (d: string) => d.split("-").reverse().join("/");

function Thumb({ src, label, onOpen }: { src: string | null; label: string; onOpen: (s: string, l: string) => void }) {
  const url = photoSrc(src);
  if (!url)
    return (
      <span className="grid size-14 place-items-center rounded-lg bg-slate-100 text-slate-300" title={`Không có ảnh ${label}`}>
        <ImageOff className="size-5" />
      </span>
    );
  return (
    <button type="button" onClick={() => onOpen(url, label)} className="group relative size-14 overflow-hidden rounded-lg bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
      <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[10px] font-semibold text-white">{label}</span>
    </button>
  );
}

function EditDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateTripAction, null);
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Sửa chuyến</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Đóng">
            <X className="size-5" />
          </button>
        </div>
        <input type="hidden" name="id" value={trip.id} />
        <div className="space-y-3">
          <div>
            <label className="label">Ngày</label>
            <input type="date" name="tripDate" defaultValue={trip.tripDate} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ODO đi</label>
              <input name="odoStart" inputMode="numeric" defaultValue={trip.odoStart} className="input font-mono text-lg font-bold" required />
            </div>
            <div>
              <label className="label">ODO về</label>
              <input name="odoEnd" inputMode="numeric" defaultValue={trip.odoEnd ?? ""} className="input font-mono text-lg font-bold" placeholder="Chưa về" />
            </div>
          </div>
          <div>
            <label className="label">Tuyến đường</label>
            <input name="route" defaultValue={trip.route} className="input" maxLength={200} />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <textarea name="note" defaultValue={trip.note} className="input" rows={2} maxLength={500} />
          </div>
        </div>
        {state?.error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
            Hủy
          </button>
          <button className="btn-primary flex-1 py-3" disabled={pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" />} Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TripList({
  trips,
  canEdit,
  plates,
  emptyText = "Chưa có chuyến nào",
}: {
  trips: Trip[];
  canEdit: boolean;
  plates?: Record<number, string>;
  emptyText?: string;
}) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [pendingDelete, startDelete] = useTransition();

  if (trips.length === 0) return <p className="card px-4 py-8 text-center text-sm text-slate-500">{emptyText}</p>;

  return (
    <>
      <ul className="space-y-3">
        {trips.map((t) => {
          const km = t.odoEnd != null ? t.odoEnd - t.odoStart : null;
          const editedStart = t.ocrStart != null && t.ocrStart !== t.odoStart;
          const editedEnd = t.ocrEnd != null && t.odoEnd != null && t.ocrEnd !== t.odoEnd;
          return (
            <li key={t.id} className="card p-3.5">
              <div className="flex gap-3">
                <div className="flex shrink-0 gap-1.5">
                  <Thumb src={t.photoStart} label="Đi" onOpen={(src, label) => setLightbox({ src, label })} />
                  <Thumb src={t.photoEnd} label="Về" onOpen={(src, label) => setLightbox({ src, label })} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-500">
                      {fmtD(t.tripDate)}
                      {plates?.[t.vehicleId] && <span className="ml-1.5 font-mono text-slate-800">{plates[t.vehicleId]}</span>}
                    </div>
                    {km != null ? (
                      <div className="text-lg leading-none font-extrabold tabular-nums">{fmt(km)} km</div>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-800">
                        <CircleDot className="size-3 animate-pulse" /> Đang chạy
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-sm text-slate-700 tabular-nums">
                    {fmt(t.odoStart)} → {fmt(t.odoEnd)}
                  </div>
                  {t.route && (
                    <div className="mt-1 flex items-center gap-1 truncate text-sm text-slate-700">
                      <Route className="size-3.5 shrink-0 text-slate-400" /> <span className="truncate">{t.route}</span>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {t.driverName && (
                      <span className="flex items-center gap-1">
                        <User className="size-3" /> {t.driverName}
                      </span>
                    )}
                    {(editedStart || editedEnd) && (
                      <span className="flex items-center gap-1 font-medium text-amber-700" title="Số đã sửa khác với số đọc từ ảnh">
                        <TriangleAlert className="size-3" /> Sửa tay{editedStart ? ` đi (ảnh ${fmt(t.ocrStart)})` : ""}
                        {editedEnd ? ` về (ảnh ${fmt(t.ocrEnd)})` : ""}
                      </span>
                    )}
                  </div>
                  {t.note && <p className="mt-1 text-xs text-slate-500 italic">“{t.note}”</p>}
                </div>
              </div>
              {canEdit && (
                <div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-2">
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditing(t)}>
                    <Pencil className="size-3.5" /> Sửa
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                    disabled={pendingDelete}
                    onClick={() => {
                      if (!confirm(`Xóa chuyến ngày ${fmtD(t.tripDate)} (${fmt(t.odoStart)} → ${fmt(t.odoEnd)})?`)) return;
                      startDelete(async () => {
                        const r = await deleteTripAction(t.id);
                        if (!r.ok) alert(r.error);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" /> Xóa
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between p-3 text-white">
            <span className="font-semibold">Ảnh ODO lúc {lightbox.label.toLowerCase()}</span>
            <button className="rounded-full bg-white/10 p-2" aria-label="Đóng">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.src} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
      {editing && <EditDialog trip={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
