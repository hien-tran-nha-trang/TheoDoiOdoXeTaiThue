import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can, canAccessVehicle } from "@/lib/permissions";
import { getLastOdo, getVehicle } from "@/lib/repo";
import { saveImage } from "@/lib/storage";
import { isServerOcrEnabled, readOdometer, type OcrResult } from "@/lib/ocr";
import { photoSrc } from "@/lib/photo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(user, "odo.create") && !can(user, "odo.edit")) {
    return NextResponse.json({ error: "Bạn không có quyền nhập ODO" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const vehicleId = Number(form.get("vehicleId"));
  const wantOcr = form.get("ocr") !== "0";
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Không nhận được ảnh" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh quá lớn (tối đa 4MB)" }, { status: 413 });
  }
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle || !canAccessVehicle(user, vehicleId)) {
    return NextResponse.json({ error: "Bạn không được giao xe này" }, { status: 403 });
  }

  const type = file.type || "image/jpeg";
  const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(type) ? type : "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/webp";
  const buffer = Buffer.from(await file.arrayBuffer());

  const ocrEnabled = wantOcr && isServerOcrEnabled();
  const [refResult, ocrResult] = await Promise.allSettled([
    saveImage(buffer, mediaType, vehicle.plate.replace(/[^\w-]/g, "")),
    ocrEnabled
      ? getLastOdo(vehicleId).then((lastOdo) => readOdometer(buffer, mediaType, { lastOdo }))
      : Promise.resolve(null),
  ]);

  if (refResult.status === "rejected") {
    console.error("saveImage failed", refResult.reason);
    return NextResponse.json({ error: "Không lưu được ảnh, vui lòng thử lại" }, { status: 500 });
  }
  let ocr: OcrResult | null = null;
  let ocrError: string | null = null;
  if (ocrResult.status === "fulfilled") ocr = ocrResult.value;
  else {
    console.error("OCR failed", ocrResult.reason);
    ocrError = "Máy chủ đọc số đang bận";
  }

  return NextResponse.json({
    ref: refResult.value,
    url: photoSrc(refResult.value),
    ocr,
    ocrError,
    serverOcr: ocrEnabled,
  });
}
