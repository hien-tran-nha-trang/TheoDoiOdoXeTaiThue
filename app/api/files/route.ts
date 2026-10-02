import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const key = new URL(req.url).searchParams.get("k");
  if (!key) return NextResponse.json({ error: "Thiếu tham số" }, { status: 400 });
  const img = await readImage(key);
  if (!img) return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  return new Response(img.body as BodyInit, {
    headers: { "Content-Type": img.contentType, "Cache-Control": "private, max-age=86400" },
  });
}
