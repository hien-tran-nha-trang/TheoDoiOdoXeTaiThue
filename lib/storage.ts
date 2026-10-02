import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Lưu ảnh ODO:
 *  - Có BLOB_READ_WRITE_TOKEN (Vercel Blob) => lưu lên Blob (public hoặc private theo BLOB_ACCESS)
 *  - Không có => lưu file vào .data/uploads (chỉ dùng khi chạy local)
 * Giá trị lưu trong CSDL:  URL https (blob public) | "bp:<pathname>" (blob private) | "local:<file>"
 */
export async function saveImage(data: Buffer, contentType: string, prefix: string): Promise<string> {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const name = `${prefix}/${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    const { put } = await import("@vercel/blob");
    const preferred = process.env.BLOB_ACCESS === "private" ? "private" : "public";
    const order: ("public" | "private")[] = preferred === "public" ? ["public", "private"] : ["private", "public"];
    let lastErr: unknown;
    for (const access of order) {
      try {
        const blob = await put(`odo/${name}`, data, { access, contentType, addRandomSuffix: true });
        return access === "public" ? blob.url : `bp:${blob.pathname}`;
      } catch (err) {
        lastErr = err; // store khác loại quyền truy cập => thử loại còn lại
      }
    }
    throw lastErr;
  }

  if (process.env.VERCEL) {
    throw new Error("Chưa cấu hình Vercel Blob (BLOB_READ_WRITE_TOKEN) để lưu ảnh.");
  }
  const fs = await import("node:fs/promises");
  const file = name.replace(/\//g, "_");
  await fs.mkdir(".data/uploads", { recursive: true });
  await fs.writeFile(`.data/uploads/${file}`, data);
  return `local:${file}`;
}

export async function readImage(ref: string): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (ref.startsWith("bp:")) {
    const { get } = await import("@vercel/blob");
    const res = await get(ref.slice(3), { access: "private" });
    if (!res || !res.stream) return null;
    return { body: res.stream, contentType: res.blob.contentType || "image/jpeg" };
  }
  if (ref.startsWith("local:")) {
    const file = ref.slice(6);
    if (!/^[\w.-]+$/.test(file)) return null;
    const fs = await import("node:fs/promises");
    try {
      const body = await fs.readFile(`.data/uploads/${file}`);
      return { body, contentType: file.endsWith(".png") ? "image/png" : "image/jpeg" };
    } catch {
      return null;
    }
  }
  return null;
}
