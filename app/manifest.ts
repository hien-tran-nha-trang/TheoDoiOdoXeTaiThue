import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Theo dõi ODO xe tải thuê",
    short_name: "ODO Xe Tải",
    description: "Ghi km đi/về bằng ảnh đồng hồ ODO, tính tiền thuê xe theo tháng",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5fa",
    theme_color: "#1d35d7",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
