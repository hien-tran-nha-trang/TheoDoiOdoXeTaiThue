import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ODO Xe Tải Thuê",
  description: "Theo dõi km, chụp ảnh đồng hồ ODO và tính tiền thuê xe tải theo tháng",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "ODO Xe Tải", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1d35d7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
