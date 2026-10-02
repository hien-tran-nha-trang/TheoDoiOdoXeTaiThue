"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { ActionResult } from "@/app/actions";

export default function DeleteButton({
  action,
  confirmText,
  label = "Xóa",
}: {
  action: () => Promise<ActionResult>;
  confirmText: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-ghost px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          const r = await action();
          if (!r.ok && r.error) alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} {label}
    </button>
  );
}
