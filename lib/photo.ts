/** Chuyển giá trị ảnh lưu trong CSDL thành URL hiển thị được */
export function photoSrc(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (/^https?:\/\//.test(ref)) return ref;
  return `/api/files?k=${encodeURIComponent(ref)}`;
}
