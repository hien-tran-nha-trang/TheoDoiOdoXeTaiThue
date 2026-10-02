import "server-only";
import ExcelJS from "exceljs";
import {
  fmtDate,
  fmtNum,
  fmtPct,
  sortTrips,
  tripKm,
  type FuelAdjustment,
  type FuelPrice,
  type PricingSettings,
  type Trip,
  type VehicleMonthSummary,
} from "./billing";
import type { CompanySettings } from "./repo";
import { photoSrc } from "./photo";

const thin = { style: "thin" as const, color: { argb: "FF808080" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const NUM = "#,##0";
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFDCE6F1" } };
const TOTAL_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } };

function dots(v: string | undefined, fallback = "….......") {
  return v && v.trim() ? v.trim() : fallback;
}

export async function buildMonthWorkbook(opts: {
  month: string;
  company: CompanySettings;
  pricing: PricingSettings;
  fuelPrice: FuelPrice | null;
  fuel: FuelAdjustment;
  summaries: VehicleMonthSummary[];
  trips: Trip[];
  origin: string;
}): Promise<Buffer> {
  const { month, company, pricing, fuelPrice, fuel, summaries, trips, origin } = opts;
  const [year, mon] = month.split("-");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Theo dõi ODO xe tải thuê";
  wb.created = new Date();

  // =================== Sheet 1: Bảng kê KM thực hiện ===================
  const ws = wb.addWorksheet("TH KM trong tháng", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  const groupCols = 6;
  const lastCol = 2 + summaries.length * groupCols;
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 12;
  for (let i = 0; i < summaries.length; i++) {
    const c = 3 + i * groupCols;
    [11, 11, 11, 10, 14, 16].forEach((w, k) => (ws.getColumn(c + k).width = w));
  }

  const font = { name: "Times New Roman", size: 12 };
  const put = (r: number, c: number, v: ExcelJS.CellValue, extra: Partial<ExcelJS.Style> = {}) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.font = { ...font, ...(extra.font ?? {}) };
    if (extra.alignment) cell.alignment = extra.alignment;
    if (extra.numFmt) cell.numFmt = extra.numFmt;
    if (extra.fill) cell.fill = extra.fill;
    if (extra.border) cell.border = extra.border;
    return cell;
  };
  const mergeText = (r: number, text: string, extra: Partial<ExcelJS.Style> = {}) => {
    ws.mergeCells(r, 1, r, lastCol);
    put(r, 1, text, { alignment: { wrapText: true, vertical: "middle" }, ...extra });
  };

  put(1, 1, (company.companyName || "CÔNG TY ….......").toUpperCase(), { font: { bold: true } });
  put(2, 1, `Địa chỉ: ${dots(company.companyAddress)}`);
  put(3, 1, `ĐT: ${dots(company.companyPhone)}`);
  mergeText(4, `BẢNG KÊ KM THỰC HIỆN THÁNG ${mon}/${year}`, {
    font: { bold: true, size: 15 },
    alignment: { horizontal: "center", vertical: "middle" },
  });
  ws.getRow(4).height = 26;
  let r = 6;
  mergeText(
    r,
    ` Căn cứ vào hợp đồng số: ${dots(company.contractNo)} ngày ${dots(company.contractDate)}${
      company.appendixText ? ` và ${company.appendixText}` : ""
    }`,
  );
  ws.getRow(r).height = 32;
  r++;
  for (const s of summaries) {
    mergeText(
      r++,
      `+ Xe BKS ${s.vehicle.plate} : Giá ${fmtNum(s.vehicle.basePrice)}đ tính cho ${fmtNum(s.quotaKm)}km, vượt ${fmtNum(
        s.quotaKm,
      )}km tính ${fmtNum(s.vehicle.excessPrice)}đ/km vượt`,
    );
  }
  if (fuelPrice && fuel.contractPrice) {
    const dateText = fuelPrice.priceDate ? fmtDate(fuelPrice.priceDate) : "cuối tháng trước";
    const changeWord = (fuel.diff ?? 0) >= 0 ? "tăng" : "giảm";
    mergeText(
      r,
      `Căn cứ giá dầu DO 0,05S-II thực tế ngày ${dateText} là ${fmtNum(fuelPrice.price)}đ ${changeWord} ${fmtPct(
        Math.abs(fuel.changePct ?? 0),
      )} so với giá hợp đồng, chênh lệch ${fmtNum(Math.abs(fuel.diff ?? 0))}đ (Giá dầu theo hợp đồng là: ${fmtNum(
        fuel.contractPrice,
      )}đ/lít)`,
    );
    ws.getRow(r).height = 32;
    r++;
    if (fuel.applied) {
      mergeText(
        r,
        `Căn cứ vào hợp đồng số: ${dots(company.contractNo)} nếu giá nhiên liệu biến động ${fmtNum(
          pricing.fuelThresholdPct,
        )}% với tỷ lệ: Đơn giá mới = Đơn giá hiện tại * (1 + ${String(pricing.fuelCoefficient).replace(
          ".",
          ",",
        )} * ((RON/DO) mới - (RON/DO) cũ)/(RON/DO) cũ). Giá điều chỉnh cụ thể như sau:`,
      );
      ws.getRow(r).height = 32;
      r++;
      for (const s of summaries) {
        mergeText(
          r++,
          `+ Xe BKS ${s.vehicle.plate} : Giá ${fmtNum(s.basePriceAdj)}đ tính cho ${fmtNum(s.quotaKm)}km, vượt ${fmtNum(
            s.quotaKm,
          )}km tính ${fmtNum(s.excessPriceAdj)}đ/km vượt`,
          { font: { bold: true } },
        );
      }
    } else {
      mergeText(r++, `(${fuel.reason} - giữ nguyên đơn giá hợp đồng)`, { font: { italic: true } });
    }
  }
  r++;

  // Tiêu đề bảng (3 dòng)
  const h1 = r,
    h2 = r + 1,
    h3 = r + 2;
  const hs: Partial<ExcelJS.Style> = {
    font: { bold: true },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    fill: HEADER_FILL,
    border,
  };
  ws.mergeCells(h1, 1, h3, 1);
  put(h1, 1, "STT", hs);
  ws.mergeCells(h1, 2, h3, 2);
  put(h1, 2, "NGÀY", hs);
  summaries.forEach((s, i) => {
    const c = 3 + i * groupCols;
    ws.mergeCells(h1, c, h1, c + groupCols - 1);
    put(h1, c, `XE BKS ${s.vehicle.plate}`, hs);
    ws.mergeCells(h2, c, h3, c);
    put(h2, c, "Đi", hs);
    ws.mergeCells(h2, c + 1, h3, c + 1);
    put(h2, c + 1, "Về", hs);
    ws.mergeCells(h2, c + 2, h3, c + 2);
    put(h2, c + 2, "KM thực hiện", hs);
    ws.mergeCells(h2, c + 3, h2, c + 4);
    put(h2, c + 3, "Số km vượt", hs);
    put(h3, c + 3, "Số km vượt", hs);
    put(h3, c + 4, "Thành tiền (chưa VAT)", hs);
    ws.mergeCells(h2, c + 5, h3, c + 5);
    put(h2, c + 5, "Tổng tiền (chưa VAT)", hs);
  });
  for (let c = 1; c <= lastCol; c++) {
    for (const row of [h1, h2, h3]) {
      const cell = ws.getCell(row, c);
      cell.border = border;
      cell.fill = HEADER_FILL;
    }
  }
  ws.getRow(h3).height = 30;
  r = h3 + 1;

  // Dữ liệu theo ngày
  const allDates = [...new Set(summaries.flatMap((s) => s.days.map((d) => d.date)))].sort();
  const firstData = r;
  const ds: Partial<ExcelJS.Style> = { border, alignment: { horizontal: "center", vertical: "middle" } };
  const ns: Partial<ExcelJS.Style> = { border, numFmt: NUM, alignment: { vertical: "middle" } };
  allDates.forEach((date, idx) => {
    put(r, 1, idx + 1, ds);
    put(r, 2, fmtDate(date), ds);
    summaries.forEach((s, i) => {
      const c = 3 + i * groupCols;
      const d = s.days.find((x) => x.date === date);
      if (!d) {
        for (let k = 0; k < groupCols; k++) put(r, c + k, null, ns);
        return;
      }
      put(r, c, d.odoStart, ns);
      put(r, c + 1, d.odoEnd, ns);
      put(r, c + 2, d.km, ns);
      put(r, c + 3, d.excessKm || null, ns);
      put(r, c + 4, d.excessAmount || null, ns);
      put(r, c + 5, d.excessAmount || null, ns);
    });
    r++;
  });
  if (allDates.length === 0) {
    ws.mergeCells(r, 1, r, lastCol);
    put(r, 1, "Chưa có dữ liệu km trong tháng", { ...ds, font: { italic: true } });
    r++;
  }
  const lastData = r - 1;

  // Dòng giá thuê tháng (cố định)
  ws.mergeCells(r, 1, r, 2);
  put(r, 1, "Giá thuê tháng", { ...ds, font: { bold: true } });
  summaries.forEach((s, i) => {
    const c = 3 + i * groupCols;
    ws.mergeCells(r, c, r, c + 4);
    put(r, c, `Giá thuê cố định cho ${fmtNum(s.quotaKm)} km${fuel.applied ? " (đã điều chỉnh giá dầu)" : ""}`, {
      ...ds,
      font: { italic: true },
    });
    put(r, c + 5, s.baseAmount, { ...ns, font: { bold: true } });
  });
  const baseRow = r;
  r++;

  // Dòng tổng
  ws.mergeCells(r, 1, r, 2);
  put(r, 1, "TỔNG (CHƯA VAT)", { ...ds, font: { bold: true }, fill: TOTAL_FILL });
  const col = (c: number) => ws.getColumn(c).letter;
  summaries.forEach((s, i) => {
    const c = 3 + i * groupCols;
    const tot: Partial<ExcelJS.Style> = { ...ns, font: { bold: true }, fill: TOTAL_FILL };
    put(r, c, null, tot);
    put(r, c + 1, null, tot);
    const sum = (k: number, result: number) =>
      allDates.length
        ? { formula: `SUM(${col(c + k)}${firstData}:${col(c + k)}${lastData})`, result }
        : result;
    put(r, c + 2, sum(2, s.totalKm), tot);
    put(r, c + 3, sum(3, s.excessKm), tot);
    put(r, c + 4, sum(4, s.excessAmount), tot);
    put(
      r,
      c + 5,
      allDates.length
        ? { formula: `SUM(${col(c + 5)}${firstData}:${col(c + 5)}${baseRow})`, result: s.totalAmount }
        : s.totalAmount,
      tot,
    );
  });
  r++;
  ws.mergeCells(r, 1, r, 2);
  put(r, 1, `VAT ${fmtNum(pricing.vatPct)}%`, ds);
  summaries.forEach((s, i) => {
    const c = 3 + i * groupCols;
    ws.mergeCells(r, c, r, c + 4);
    put(r, c, null, ds);
    put(r, c + 5, s.vatAmount, ns);
  });
  r++;
  ws.mergeCells(r, 1, r, 2);
  put(r, 1, "TỔNG SAU VAT", { ...ds, font: { bold: true } });
  summaries.forEach((s, i) => {
    const c = 3 + i * groupCols;
    ws.mergeCells(r, c, r, c + 4);
    put(r, c, null, ds);
    put(r, c + 5, s.totalWithVat, { ...ns, font: { bold: true } });
  });
  r++;
  const grand = summaries.reduce((a, s) => a + s.totalAmount, 0);
  const grandVat = summaries.reduce((a, s) => a + s.totalWithVat, 0);
  r++;
  mergeText(r++, `TỔNG TIỀN THANH TOÁN ${summaries.length} XE (CHƯA VAT): ${fmtNum(grand)} đ  —  SAU VAT: ${fmtNum(grandVat)} đ`, {
    font: { bold: true, size: 13 },
  });

  // Chữ ký
  r += 1;
  const half = Math.max(3, Math.floor(lastCol / 2));
  ws.mergeCells(r, half + 1, r, lastCol);
  put(r, half + 1, "…................., ngày ….... tháng ….... năm " + year, {
    alignment: { horizontal: "center" },
    font: { italic: true },
  });
  r++;
  ws.mergeCells(r, 1, r, half);
  put(r, 1, "ĐẠI DIỆN BÊN A", { alignment: { horizontal: "center" }, font: { bold: true } });
  ws.mergeCells(r, half + 1, r, lastCol);
  put(r, half + 1, "ĐẠI DIỆN BÊN B", { alignment: { horizontal: "center" }, font: { bold: true } });
  r++;
  ws.mergeCells(r, 1, r, half);
  put(r, 1, "(Ký tên)", { alignment: { horizontal: "center" }, font: { italic: true } });
  ws.mergeCells(r, half + 1, r, lastCol);
  put(r, half + 1, "(Ký tên, đóng dấu)", { alignment: { horizontal: "center" }, font: { italic: true } });
  r += 4;
  ws.mergeCells(r, 1, r, half);
  put(r, 1, company.signerA || "", { alignment: { horizontal: "center" }, font: { bold: true } });
  ws.mergeCells(r, half + 1, r, lastCol);
  put(r, half + 1, company.signerB || "", { alignment: { horizontal: "center" }, font: { bold: true } });

  // =================== Sheet 2: Chi tiết từng chuyến ===================
  const wd = wb.addWorksheet("Chi tiết chuyến", { views: [{ state: "frozen", ySplit: 1 }] });
  wd.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Ngày", key: "date", width: 12 },
    { header: "Biển số", key: "plate", width: 13 },
    { header: "Tài xế", key: "driver", width: 20 },
    { header: "Tuyến đường", key: "route", width: 32 },
    { header: "ODO đi", key: "start", width: 11 },
    { header: "ODO về", key: "end", width: 11 },
    { header: "Km", key: "km", width: 9 },
    { header: "Ảnh ODO đi", key: "p1", width: 13 },
    { header: "Ảnh ODO về", key: "p2", width: 13 },
    { header: "OCR đi", key: "o1", width: 10 },
    { header: "OCR về", key: "o2", width: 10 },
    { header: "Kiểm tra", key: "check", width: 26 },
    { header: "Ghi chú", key: "note", width: 30 },
  ];
  wd.getRow(1).eachCell((c) => {
    c.font = { bold: true };
    c.fill = HEADER_FILL;
    c.border = border;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  const plateOf = new Map(summaries.map((s) => [s.vehicle.id, s.vehicle.plate]));
  const abs = (ref: string | null) => {
    const u = photoSrc(ref);
    return u ? (u.startsWith("http") ? u : origin + u) : null;
  };
  sortTrips(trips).forEach((t, i) => {
    const checks: string[] = [];
    if (t.odoEnd == null) checks.push("Chưa ghi ODO về");
    if (t.ocrStart != null && t.ocrStart !== t.odoStart) checks.push(`Sửa tay ODO đi (OCR ${t.ocrStart})`);
    if (t.ocrEnd != null && t.odoEnd != null && t.ocrEnd !== t.odoEnd) checks.push(`Sửa tay ODO về (OCR ${t.ocrEnd})`);
    const p1 = abs(t.photoStart);
    const p2 = abs(t.photoEnd);
    const row = wd.addRow({
      stt: i + 1,
      date: fmtDate(t.tripDate),
      plate: plateOf.get(t.vehicleId) ?? "",
      driver: t.driverName,
      route: t.route,
      start: t.odoStart,
      end: t.odoEnd,
      km: t.odoEnd != null ? tripKm(t) : null,
      p1: p1 ? { text: "Xem ảnh", hyperlink: p1 } : "",
      p2: p2 ? { text: "Xem ảnh", hyperlink: p2 } : "",
      o1: t.ocrStart,
      o2: t.ocrEnd,
      check: checks.join("; "),
      note: t.note,
    });
    row.eachCell({ includeEmpty: true }, (c, n) => {
      c.border = border;
      if ([6, 7, 8, 11, 12].includes(n)) c.numFmt = NUM;
      if ((n === 9 || n === 10) && c.value) c.font = { color: { argb: "FF1F4E79" }, underline: true };
      if (n === 13 && c.value) c.font = { color: { argb: "FFC00000" } };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
