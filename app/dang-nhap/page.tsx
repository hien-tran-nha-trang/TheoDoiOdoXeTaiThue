import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Đăng nhập - ODO Xe Tải Thuê" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-brand-950 px-5 py-10">
      <div className="pointer-events-none absolute -top-40 -left-32 size-[28rem] rounded-full bg-brand-600/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-40 size-[26rem] rounded-full bg-amber-400/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mb-4 size-16 rounded-2xl shadow-lg shadow-black/30" />
          <h1 className="text-2xl font-bold text-white">ODO Xe Tải Thuê</h1>
          <p className="mt-1 text-sm text-brand-200">Ghi km đi / về bằng ảnh đồng hồ ODO</p>
        </div>
        <LoginForm next={next ?? ""} />
        <p className="mt-6 text-center text-xs text-brand-300/70">
          Quên mật khẩu? Liên hệ quản trị viên để được cấp lại.
        </p>
      </div>
    </main>
  );
}
