/* =========================================================================
 * data.js — Dữ liệu nền
 *  - CATEGORIES : phân loại vật tư chính (gợi ý theo tiền tố Mã mặt hàng)
 *  - ITEMS      : bảng giá đầu vào mặc định
 *  - TEMPLATES  : mẫu pack chuẩn (tham chiếu cell theo mã)
 * Đơn giá là GIÁ THAM KHẢO, người dùng chỉnh lại theo báo giá thực tế.
 * ========================================================================= */

/* ---- Phân loại chính (gợi ý theo tiền tố Mã mặt hàng) ---- */
const CATEGORIES = [
  { key: "CELL", label: "Cell", color: "green" },
  { key: "BMS", label: "BMS", color: "blue" },
  { key: "CASE", label: "Vỏ (Case)", color: "amber" },
  { key: "PCB", label: "PCB", color: "purple" },
  { key: "PHU", label: "Vật tư phụ", color: "gray" },
];

// Gợi ý phân loại từ mã: CELL/CE- -> Cell, BMS -> BMS, CASE -> Vỏ, PCB -> PCB, còn lại -> phụ
function categoryOf(code) {
  const c = String(code || "").trim().toUpperCase();
  if (c.startsWith("CELL") || c.startsWith("CE-")) return "CELL";
  if (c.startsWith("BMS")) return "BMS";
  if (c.startsWith("CASE")) return "CASE";
  if (c.startsWith("PCB")) return "PCB";
  return "PHU";
}
const categoryLabel = (key) => (CATEGORIES.find((c) => c.key === key) || { label: key }).label;

/* ---- Bảng giá đầu vào mặc định ----
 * Trường chung: code · name([Thông số]) · mfrCode · brand · price · leadTime · minStock · unit
 * Riêng CELL: v(điện áp) · ah(dung lượng) · chem(hóa học)
 * Định mức BOM (PHU/PCB): qtyFixed + qtyPerCell*(S×P) + qtyPerS*S
 * (BMS & Vỏ chọn qua dropdown trong tab Dự toán, số lượng mặc định 1)
 */
const ITEMS = [
  // ===== CELL =====
  { code: "CELL-LFP32700-6000", name: "Cell LiFePO4 32700 [3.2V, 6.0Ah]", unit: "cell", price: 68000, chem: "LiFePO4", v: 3.2, ah: 6.0 },
  { code: "CELL-LFP32650-5000", name: "Cell LiFePO4 32650 [3.2V, 5.0Ah]", unit: "cell", price: 55000, chem: "LiFePO4", v: 3.2, ah: 5.0 },
  { code: "CELL-LFP26650-3200", name: "Cell LiFePO4 26650 [3.2V, 3.2Ah]", unit: "cell", price: 38000, chem: "LiFePO4", v: 3.2, ah: 3.2 },
  { code: "CELL-LI21700-5000", name: "Cell Li-ion 21700 [3.6V, 5.0Ah]", unit: "cell", price: 62000, chem: "Li-ion", v: 3.6, ah: 5.0 },
  { code: "CELL-LI18650-3000", name: "Cell Li-ion 18650 [3.6V, 3.0Ah]", unit: "cell", price: 32000, chem: "Li-ion", v: 3.6, ah: 3.0 },
  { code: "CE-PR-P-102AH-NMT-A", name: "Cell Pin Lithium 102AH-A [3.2V, 102Ah, 0.5C]", unit: "cell", price: 440940, chem: "LiFePO4", v: 3.2, ah: 102 },

  // ===== BMS (chọn trong Dự toán) =====
  { code: "BMS-STD", name: "Mạch bảo vệ BMS (tiêu chuẩn)", unit: "cái", price: 180000 },
  { code: "BMS-16ZNJ6-16S-400A", name: "BMS [16ZNJ6-16S-400A, 100V, 400A, Type A, Ant]", unit: "cái", price: 1522852 },
  { code: "BMS-24ZHE6-24S-400A", name: "BMS [24ZHE6-24S-400A, 100V, 400A, Type A, Ant]", unit: "cái", price: 1522852 },
  { code: "BMS-8S24V200A", name: "BMS 8S 24V 200A", unit: "cái", price: 1912000 },

  // ===== CASE / Vỏ (chọn trong Dự toán) =====
  { code: "CASE-STD", name: "Vỏ hộp / khung pack (tiêu chuẩn)", unit: "cái", price: 120000 },
  { code: "CASE-HHXN24204A", name: "Vỏ dùng cho xe nâng 24204", unit: "cái", price: 685000 },

  // ===== PCB =====
  { code: "PCB-STD", name: "Bo mạch PCB kết nối cell", unit: "cái", price: 60000, qtyFixed: 0 },

  // ===== Vật tư phụ (PHU) — có định mức tự tính theo BOM =====
  { code: "PK-NICKEL", name: "Kẽm hàn (nickel strip)", unit: "m", price: 25000, qtyPerCell: 0.12 },
  { code: "PK-WIRE", name: "Dây điện silicone", unit: "m", price: 18000, qtyFixed: 0.5, qtyPerS: 0.05 },
  { code: "PK-HOLDER", name: "Đế giữ cell", unit: "cái", price: 1200, qtyPerCell: 1 },
  { code: "PK-FISHPAPER", name: "Giấy cách điện (fish paper)", unit: "bộ", price: 12000, qtyFixed: 1 },
  { code: "PK-CONNECTOR", name: "Giắc / đầu cos kết nối", unit: "cái", price: 15000, qtyFixed: 2 },
  { code: "PK-CHARGE", name: "Cổng sạc / jack sạc", unit: "cái", price: 20000, qtyFixed: 1 },
  { code: "PK-FUSE", name: "Cầu chì bảo vệ", unit: "cái", price: 8000, qtyFixed: 1 },
  { code: "PK-DISPLAY", name: "Đồng hồ / công tắc hiển thị", unit: "cái", price: 45000, qtyFixed: 1 },
  { code: "PK-SHRINK", name: "Ống co nhiệt / băng keo", unit: "bộ", price: 15000, qtyFixed: 1 },
  { code: "PK-MISC", name: "Keo, phụ liệu lắp ráp", unit: "bộ", price: 10000, qtyFixed: 1 },
];

/* ---- Mẫu pack chuẩn (tham chiếu cell + BMS + Vỏ theo mã) ---- */
const TEMPLATES = [
  { id: "lfp-12v", name: "Pin LiFePO4 12V (4S)", cellCode: "CELL-LFP32700-6000", s: 4, p: 4, bmsCode: "BMS-STD", caseCode: "CASE-STD" },
  { id: "lfp-24v", name: "Pin LiFePO4 24V (8S)", cellCode: "CELL-LFP32700-6000", s: 8, p: 3, bmsCode: "BMS-STD", caseCode: "CASE-STD" },
  { id: "lfp-48v", name: "Pin LiFePO4 48V (16S)", cellCode: "CELL-LFP32700-6000", s: 16, p: 4, bmsCode: "BMS-16ZNJ6-16S-400A", caseCode: "CASE-STD" },
  { id: "li-36v", name: "Pin Li-ion 36V (10S)", cellCode: "CELL-LI18650-3000", s: 10, p: 4, bmsCode: "BMS-STD", caseCode: "CASE-STD" },
  { id: "li-48v", name: "Pin Li-ion 48V (13S)", cellCode: "CELL-LI21700-5000", s: 13, p: 4, bmsCode: "BMS-STD", caseCode: "CASE-STD" },
  { id: "xenang-102", name: "Pin xe nâng 24204 (16S, 102Ah)", cellCode: "CE-PR-P-102AH-NMT-A", s: 16, p: 1, bmsCode: "BMS-16ZNJ6-16S-400A", caseCode: "CASE-HHXN24204A" },
  { id: "custom", name: "Tùy chỉnh (nhập S/P tự do)", cellCode: "CELL-LFP32700-6000", s: 4, p: 2, bmsCode: "BMS-STD", caseCode: "CASE-STD" },
];
