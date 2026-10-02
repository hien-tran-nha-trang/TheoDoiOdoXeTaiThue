/** Nén ảnh trên điện thoại trước khi gửi (ảnh gốc 4-12MB → ~200-500KB) */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Không đọc được ảnh"));
      el.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dự phòng khi máy chủ chưa cấu hình AI: đọc số bằng Tesseract ngay trên trình duyệt */
export async function localOcr(image: Blob, lastOdo: number | null): Promise<number | null> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({ tessedit_char_whitelist: "0123456789 " });
    const { data } = await worker.recognize(image);
    const candidates = (data.text.match(/\d[\d ]{2,9}\d/g) ?? [])
      .map((s) => Number(s.replace(/\s/g, "")))
      .filter((n) => n >= 100 && n < 10_000_000);
    if (!candidates.length) return null;
    if (lastOdo != null) {
      const plausible = candidates.filter((n) => n >= lastOdo && n - lastOdo < 5000);
      if (plausible.length) return plausible.sort((a, b) => a - lastOdo - (b - lastOdo))[0];
    }
    return candidates.sort((a, b) => String(b).length - String(a).length)[0];
  } finally {
    await worker.terminate();
  }
}
