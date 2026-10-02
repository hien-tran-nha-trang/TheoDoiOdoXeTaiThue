"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import type { ActionResult } from "@/app/actions";

export default function ActionForm({
  action,
  children,
  submitLabel = "Lưu",
  className = "",
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      router.refresh();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {state?.error && <span className="text-sm font-medium text-rose-600">{state.error}</span>}
        {state?.ok && state.message && !pending && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="size-4" /> {state.message}
          </span>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
