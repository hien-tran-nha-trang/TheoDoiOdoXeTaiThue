export default function PlateBadge({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "px-4 py-1.5 text-2xl"
      : size === "sm"
        ? "px-2 py-0.5 text-xs"
        : "px-3 py-1 text-lg";
  return (
    <span
      className={`inline-block rounded-md border-2 border-slate-800 bg-gradient-to-b from-amber-300 to-amber-400 font-mono font-extrabold tracking-wider text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,.6)] ${cls}`}
    >
      {plate}
    </span>
  );
}
