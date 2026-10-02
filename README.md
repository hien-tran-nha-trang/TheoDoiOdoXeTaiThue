# ODO Xe Tải Thuê

Ứng dụng web (Next.js) theo dõi km xe tải thuê theo tháng, tối ưu cho tài xế dùng điện thoại:

- **Chụp ảnh đồng hồ ODO → tự đọc số km** (OCR bằng Claude AI; nếu chưa cấu hình AI thì tự dùng Tesseract ngay trên điện thoại).
- Ghi ODO **lúc đi / lúc về**, hoặc ghi cả chuyến một lần; ghi chú **tuyến đường** (gợi ý tuyến hay chạy, bấm 1 chạm).
- Cảnh báo thông minh: ODO thấp hơn lần trước, km bị "hở" giữa 2 chuyến, chuyến dài bất thường, số nhập tay khác số đọc từ ảnh.
- **Tính tiền theo đúng mẫu bảng kê**: giá thuê tháng cho số km định mức + km vượt × đơn giá vượt;
  tự **điều chỉnh đơn giá theo giá dầu DO**: `Đơn giá mới = Đơn giá × (1 + 0,3 × (Giá dầu mới − Giá dầu HĐ) / Giá dầu HĐ)` khi biến động ≥ 10%.
- **Xuất Excel "BẢNG KÊ KM THỰC HIỆN THÁNG"** theo mẫu + sheet chi tiết chuyến (link ảnh ODO, tài xế, tuyến đường, cảnh báo sửa tay).
- **Phân quyền**: Quản trị viên / Người dùng. Người dùng được giao **xe nào** và **quyền theo từng mục**:
  nhập ODO, xem lịch sử, sửa/xóa chuyến, xem báo cáo chi phí, xuất Excel.
- Có thể "Thêm vào màn hình chính" trên điện thoại như một ứng dụng (PWA).

Xe mặc định: **74G-001.86** và **74G-001.91** (định mức 5.000 km), **74H-048.02** (định mức 3.000 km).
Đơn giá thuê, đơn giá km vượt và giá dầu được cài trong mục **Cài đặt**.

## Triển khai lên Vercel

1. Vào <https://vercel.com/new>, chọn **Import** repo GitHub này (Framework: Next.js, giữ mặc định).
2. Trong project trên Vercel → tab **Storage**:
   - **Create Database → Neon (Postgres)** → Connect vào project (tự thêm biến `DATABASE_URL`).
   - **Create → Blob** → Connect vào project (tự thêm `BLOB_READ_WRITE_TOKEN`) để lưu ảnh ODO.
3. **Settings → Environment Variables**, thêm:

   | Biến | Giá trị |
   |---|---|
   | `AUTH_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự (vd chạy `openssl rand -hex 32`) |
   | `ADMIN_PASSWORD` | mật khẩu tài khoản `admin` lần đầu (mặc định `admin123`) |
   | `ANTHROPIC_API_KEY` | API key Claude để đọc ODO chính xác (lấy ở <https://console.anthropic.com>). Không bắt buộc |
   | `OCR_MODEL` | (tùy chọn) model đọc ODO, mặc định `claude-opus-5-5` |

4. **Deployments → Redeploy**. Bảng dữ liệu được tự tạo ở lần truy cập đầu tiên.
5. Đăng nhập `admin` → **Tài khoản** đổi mật khẩu → **Cài đặt** nhập đơn giá thuê, giá dầu hợp đồng,
   giá dầu từng tháng, thông tin công ty → **Người dùng** tạo tài khoản cho tài xế và giao xe.

## Chạy trên máy

```bash
npm install
npm run dev     # http://localhost:3000  (đăng nhập admin / admin123)
```

Khi không có `DATABASE_URL` / `BLOB_READ_WRITE_TOKEN`, ứng dụng tự dùng PGlite và lưu ảnh trong thư mục `.data/` (chỉ để chạy thử).
Xem thêm các biến trong `.env.example`.

## Cấu trúc

- `app/(main)/` – các trang: chọn xe, ghi ODO (`xe/[id]`), báo cáo (`bao-cao`), cài đặt, người dùng, tài khoản
- `app/actions.ts` – server actions (đăng nhập, ghi ODO, sửa/xóa, cài đặt, phân quyền)
- `app/api/photo` – nhận ảnh, lưu Blob và đọc số ODO; `app/api/export` – xuất Excel
- `lib/billing.ts` – công thức tính km, km vượt, điều chỉnh giá dầu, VAT
- `lib/excel.ts` – dựng file Excel theo mẫu bảng kê
- `lib/ocr.ts` – đọc ODO bằng Claude Vision
