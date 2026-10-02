import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type OcrResult = {
  value: number | null;
  confidence: "high" | "medium" | "low";
  note: string;
  engine: "claude";
};

export function isServerOcrEnabled(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean", description: "Có đọc được tổng số km (ODO) trong ảnh hay không" },
    odometer_km: {
      type: ["integer", "null"],
      description: "Tổng số km ODO, chỉ phần nguyên (bỏ chữ số thập phân/ô số lẻ màu khác nếu có)",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    note: { type: "string", description: "Ghi chú ngắn bằng tiếng Việt (vd: ảnh mờ, lóa, chỉ thấy TRIP...)" },
  },
  required: ["found", "odometer_km", "confidence", "note"],
  additionalProperties: false,
} as const;

const PROMPT = `Bạn là chuyên gia đọc đồng hồ công-tơ-mét (odometer) trên xe tải.
Nhiệm vụ: đọc TỔNG SỐ KM ĐÃ ĐI (ODO / TOTAL) hiển thị trong ảnh.
Quy tắc:
- Chỉ lấy số ODO tổng. KHÔNG lấy TRIP A/TRIP B, tốc độ, vòng tua, giờ, nhiệt độ, mức nhiên liệu, quãng đường còn lại (range).
- Đồng hồ cơ có ô cuối màu khác (số lẻ 1/10 km) thì bỏ ô đó, chỉ lấy phần nguyên.
- Đồng hồ điện tử (LCD) thường có chữ "ODO" hoặc "km" cạnh số; đọc kỹ các chữ số 7 đoạn (dễ nhầm 1/7, 5/6, 8/0, 3/8).
- Ảnh có thể bị xoay, lóa, nghiêng - hãy cố gắng đọc.
- Nếu không chắc một chữ số, vẫn đưa ra số khả dĩ nhất và để confidence = "low", ghi chú lý do.
- Nếu ảnh không có đồng hồ ODO, đặt found = false, odometer_km = null.`;

export async function readOdometer(
  image: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  hint?: { lastOdo?: number | null },
): Promise<OcrResult> {
  const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  const hintText =
    hint?.lastOdo != null
      ? `\nThông tin tham khảo: lần ghi gần nhất của xe này là ${hint.lastOdo} km (số mới thường bằng hoặc lớn hơn). Chỉ dùng để phân biệt chữ số khó đọc - luôn đọc đúng số hiển thị trong ảnh.`
      : "";

  const response = await client.beta.messages.create({
    model: process.env.OCR_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
          { type: "text", text: PROMPT + hintText },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return { value: null, confidence: "low", note: "Không đọc được ảnh này, vui lòng nhập tay.", engine: "claude" };
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    return { value: null, confidence: "low", note: "Không đọc được số km, vui lòng nhập tay.", engine: "claude" };
  }
  try {
    const parsed = JSON.parse(text.text) as {
      found: boolean;
      odometer_km: number | null;
      confidence: "high" | "medium" | "low";
      note: string;
    };
    const value =
      parsed.found && typeof parsed.odometer_km === "number" && parsed.odometer_km >= 0 && parsed.odometer_km < 10_000_000
        ? Math.round(parsed.odometer_km)
        : null;
    return { value, confidence: parsed.confidence, note: parsed.note || "", engine: "claude" };
  } catch {
    return { value: null, confidence: "low", note: "Không đọc được số km, vui lòng nhập tay.", engine: "claude" };
  }
}
