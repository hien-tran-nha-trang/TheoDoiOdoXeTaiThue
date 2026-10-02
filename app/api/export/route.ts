import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { currentMonthVN, isValidMonth } from "@/lib/billing";
import { loadMonthReport } from "@/lib/report";
import { buildMonthWorkbook } from "@/lib/excel";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(user, "report.export")) return NextResponse.json({ error: "Không có quyền xuất Excel" }, { status: 403 });
  const url = new URL(req.url);
  const m = url.searchParams.get("month");
  const month = isValidMonth(m) ? m : currentMonthVN();
  const data = await loadMonthReport(month, user);
  const buf = await buildMonthWorkbook({ month, ...data, origin: url.origin });
  const [y, mm] = month.split("-");
  const filename = `Bang-ke-km-thang-${mm}-${y}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
