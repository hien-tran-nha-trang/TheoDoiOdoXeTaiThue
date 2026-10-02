"use client";

import { useState } from "react";

/** Ô nhập số có định dạng phân cách hàng nghìn (35.000.000) */
export default function MoneyInput({
  name,
  defaultValue,
  suffix,
  placeholder,
  className = "",
}: {
  name: string;
  defaultValue?: number | null;
  suffix?: string;
  placeholder?: string;
  className?: string;
}) {
  const [v, setV] = useState(defaultValue ? String(defaultValue) : "");
  return (
    <div className={`flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500 ${className}`}>
      <input
        name={name}
        inputMode="numeric"
        className="w-full min-w-0 rounded-xl border-0 bg-transparent px-3.5 py-2.5 text-base font-semibold tabular-nums focus:outline-none sm:text-sm"
        value={v ? Number(v).toLocaleString("vi-VN") : ""}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 12))}
      />
      {suffix && <span className="pr-3 text-sm whitespace-nowrap text-slate-400">{suffix}</span>}
    </div>
  );
}
