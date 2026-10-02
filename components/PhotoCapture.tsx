"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, LoaderCircle, RotateCcw, ScanLine, Sparkles, TriangleAlert } from "lucide-react";
import { compressImage, localOcr } from "@/lib/client-image";

export type PhotoState = {
  ref: string | null;
  previewUrl: string | null;
  ocrValue: number | null;
  ocrConfidence: "high" | "medium" | "low" | null;
  ocrNote: string;
  engine: "claude" | "local" | null;
};

export const EMPTY_PHOTO: PhotoState = {
  ref: null,
  previewUrl: null,
  ocrValue: null,
  ocrConfidence: null,
  ocrNote: "",
  engine: null,
};

const CONF_LABEL = { high: "cao", medium: "trung bình", low: "thấp" } as const;

export default function PhotoCapture({
  label,
  vehicleId,
  lastOdo,
  value,
  onChange,
  onOcr,
  required,
}: {
  label: string;
  vehicleId: number;
  lastOdo: number | null;
  value: PhotoState;
  onChange: (p: PhotoState) => void;
  onOcr: (km: number) => void;
  required?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "reading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setStatus("uploading");
    const localPreview = URL.createObjectURL(file);
    onChange({ ...EMPTY_PHOTO, previewUrl: localPreview });
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append("file", blob, "odo.jpg");
      fd.append("vehicleId", String(vehicleId));
      const res = await fetch("/api/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Tải ảnh thất bại");

      let next: PhotoState = { ...EMPTY_PHOTO, ref: data.ref, previewUrl: localPreview };
      if (data.ocr) {
        next = {
          ...next,
          ocrValue: data.ocr.value,
          ocrConfidence: data.ocr.confidence,
          ocrNote: data.ocr.note,
          engine: "claude",
        };
        onChange(next);
        if (data.ocr.value != null) onOcr(data.ocr.value);
        setStatus("idle");
      } else {
        // Máy chủ chưa có AI => đọc ngay trên điện thoại
        onChange(next);
        setStatus("reading");
        const km = await localOcr(blob, lastOdo).catch(() => null);
        onChange({
          ...next,
          ocrValue: km,
          ocrConfidence: km != null ? "low" : null,
          ocrNote: km != null ? "Đọc bằng máy - hãy kiểm tra kỹ" : "Không đọc được số, vui lòng nhập tay",
          engine: "local",
        });
        if (km != null) onOcr(km);
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      onChange({ ...EMPTY_PHOTO });
    }
  }

  const busy = status === "uploading" || status === "reading";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
        {value.previewUrl && !busy && (
          <button type="button" className="flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => cameraRef.current?.click()}>
            <RotateCcw className="size-3.5" /> Chụp lại
          </button>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!value.previewUrl ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-4 py-8 text-brand-700 transition active:scale-[.99] active:bg-brand-100"
          >
            <span className="grid size-16 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <Camera className="size-8" />
            </span>
            <span className="text-base font-bold">Chụp ảnh đồng hồ ODO</span>
            <span className="text-xs text-brand-600/80">Hệ thống sẽ tự đọc số km từ ảnh</span>
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="btn-ghost w-full text-sm">
            <ImagePlus className="size-4" /> Chọn ảnh có sẵn trong máy
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt="Ảnh ODO" className={`max-h-72 w-full object-contain ${busy ? "opacity-60" : ""}`} />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-amber-400 shadow-[0_0_20px_4px_rgba(251,191,36,.6)]" />
              {status === "uploading" ? (
                <>
                  <LoaderCircle className="size-8 animate-spin" />
                  <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold">Đang tải ảnh & đọc số km…</span>
                </>
              ) : (
                <>
                  <ScanLine className="size-8 animate-pulse" />
                  <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold">Đang nhận dạng số trên máy…</span>
                </>
              )}
            </div>
          )}
          {!busy && value.ref && (
            <span className="absolute top-2 left-2 badge bg-emerald-500 text-white shadow">
              <CheckCircle2 className="size-3.5" /> Đã lưu ảnh
            </span>
          )}
        </div>
      )}

      {!busy && value.engine && (
        <div
          className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
            value.ocrValue == null
              ? "bg-amber-50 text-amber-800"
              : value.ocrConfidence === "high"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {value.ocrValue == null ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : <Sparkles className="mt-0.5 size-4 shrink-0" />}
          <div>
            {value.ocrValue != null ? (
              <>
                Đọc được <b className="tabular-nums">{value.ocrValue.toLocaleString("vi-VN")} km</b>
                {value.ocrConfidence && <> · độ tin cậy {CONF_LABEL[value.ocrConfidence]}</>}. Kiểm tra lại số bên dưới.
              </>
            ) : (
              "Không đọc được số km từ ảnh - vui lòng nhập tay."
            )}
            {value.ocrNote && <div className="text-xs opacity-80">{value.ocrNote}</div>}
          </div>
        </div>
      )}
      {status === "error" && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}.{" "}
          <button type="button" className="font-semibold underline" onClick={() => cameraRef.current?.click()}>
            Thử lại
          </button>
        </p>
      )}
    </div>
  );
}
