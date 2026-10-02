"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    try {
      setUsername(localStorage.getItem("odo:lastUser") ?? "");
    } catch {}
  }, []);

  return (
    <form
      action={action}
      onSubmit={() => {
        try {
          localStorage.setItem("odo:lastUser", username);
        } catch {}
      }}
      className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/30"
    >
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="username">
        Tên đăng nhập
      </label>
      <input
        id="username"
        name="username"
        className="input mb-4 py-3 text-lg"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <label className="label" htmlFor="password">
        Mật khẩu
      </label>
      <div className="relative mb-5">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          className="input py-3 pr-12 text-lg"
          autoComplete="current-password"
          autoFocus={!!username}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400"
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {state?.error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{state.error}</p>
      )}
      <button className="btn-primary w-full py-3.5 text-base" disabled={pending}>
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : <LogIn className="size-5" />}
        Đăng nhập
      </button>
    </form>
  );
}
