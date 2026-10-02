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

## Triển khai lên Vercel (1 nút bấm)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhien-tran-nha-trang%2FTheoDoiOdoXeTaiThue&project-name=odo-xe-tai-thue&repository-name=odo-xe-tai-thue&env=ADMIN_PASSWORD%2CANTHROPIC_API_KEY&envDescription=ADMIN_PASSWORD%3A%20m%E1%BA%ADt%20kh%E1%BA%A9u%20%C4%91%C4%83ng%20nh%E1%BA%ADp%20t%C3%A0i%20kho%E1%BA%A3n%20admin.%20ANTHROPIC_API_KEY%3A%20key%20Claude%20%C4%91%E1%BB%83%20%C4%91%E1%BB%8Dc%20s%E1%BB%91%20ODO%20t%E1%BB%AB%20%E1%BA%A3nh%20%28n%E1%BA%BFu%20ch%C6%B0a%20c%C3%B3%2C%20nh%E1%BA%ADp%20t%E1%BA%A1m%3A%20none%29&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&stores=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22blob%22%7D%5D)

1. Bấm nút **Deploy** ở trên → đăng nhập Vercel bằng tài khoản GitHub.
2. Vercel sẽ tạo bản sao repo, rồi hỏi tạo **Neon (Postgres)** và **Blob** → bấm đồng ý/Create (chọn vùng Singapore nếu được hỏi).
3. Nhập biến môi trường:
   - `ADMIN_PASSWORD`: mật khẩu cho tài khoản `admin`.
   - `ANTHROPIC_API_KEY`: key Claude để đọc ODO chính xác (<https://console.anthropic.com/settings/keys>). Chưa có thì nhập `none`
     (ứng dụng tự đọc số trên điện thoại), sau này vào **Settings → Environment Variables** sửa lại rồi Redeploy.
4. Bấm **Deploy**, chờ khoảng 2 phút → mở đường link `https://....vercel.app`.
5. Đăng nhập `admin` + mật khẩu vừa đặt → **Cài đặt** nhập đơn giá thuê, giá dầu hợp đồng, giá dầu từng tháng,
   thông tin công ty → **Người dùng** tạo tài khoản cho tài xế và giao xe.

Không cần đặt `AUTH_SECRET` (tự sinh từ chuỗi kết nối CSDL); có thể đặt thêm nếu muốn.

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
