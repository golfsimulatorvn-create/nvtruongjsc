/* =========================================================================
 * data.js — Dữ liệu nền cho công cụ dự toán Pin
 *  - CELLS:     thư viện cell (đơn giá tham khảo, đ/cell)
 *  - MATERIALS: danh mục vật tư phụ (đơn giá tham khảo)
 *  - TEMPLATES: mẫu pack chuẩn (S/P + loại cell)
 * Đơn giá là GIÁ THAM KHẢO thị trường VN, người dùng chỉnh lại theo báo giá.
 * ========================================================================= */

/* ---- Thư viện cell ---- */
const CELLS = [
  { id: "lfp32700-6000", name: "LiFePO4 32700 · 6.0Ah", chem: "LiFePO4", v: 3.2, ah: 6.0, price: 68000 },
  { id: "lfp32650-5000", name: "LiFePO4 32650 · 5.0Ah", chem: "LiFePO4", v: 3.2, ah: 5.0, price: 55000 },
  { id: "lfp26650-3200", name: "LiFePO4 26650 · 3.2Ah", chem: "LiFePO4", v: 3.2, ah: 3.2, price: 38000 },
  { id: "liion21700-5000", name: "Li-ion 21700 · 5.0Ah", chem: "Li-ion", v: 3.6, ah: 5.0, price: 62000 },
  { id: "liion21700-4000", name: "Li-ion 21700 · 4.0Ah", chem: "Li-ion", v: 3.6, ah: 4.0, price: 48000 },
  { id: "liion18650-3000", name: "Li-ion 18650 · 3.0Ah", chem: "Li-ion", v: 3.6, ah: 3.0, price: 32000 },
  { id: "liion18650-2600", name: "Li-ion 18650 · 2.6Ah", chem: "Li-ion", v: 3.6, ah: 2.6, price: 26000 },
];

/* ---- Danh mục vật tư phụ (đơn giá mặc định) ----
 * qtyFixed  : số lượng cố định / pack
 * qtyPerCell: số lượng cộng thêm theo mỗi cell (N = S×P)
 * qtyPerS   : số lượng cộng thêm theo mỗi cấp nối tiếp (S) — ví dụ dây balance
 * qty cuối  = qtyFixed + qtyPerCell*N + qtyPerS*S  (làm tròn 2 số lẻ)
 */
const MATERIALS = [
  { key: "bms",      name: "Mạch bảo vệ BMS",              unit: "cái", price: 180000, qtyFixed: 1 },
  { key: "nickel",   name: "Kẽm hàn (nickel strip)",       unit: "m",   price: 25000,  qtyPerCell: 0.12 },
  { key: "wire",     name: "Dây điện silicone",            unit: "m",   price: 18000,  qtyFixed: 0.5, qtyPerS: 0.05 },
  { key: "holder",   name: "Đế giữ cell",                  unit: "cái", price: 1200,   qtyPerCell: 1 },
  { key: "fishpaper",name: "Giấy cách điện (fish paper)",  unit: "bộ",  price: 12000,  qtyFixed: 1 },
  { key: "case",     name: "Vỏ hộp / khung pack",          unit: "cái", price: 120000, qtyFixed: 1 },
  { key: "connector",name: "Giắc / đầu cos kết nối",       unit: "cái", price: 15000,  qtyFixed: 2 },
  { key: "charge",   name: "Cổng sạc / jack sạc",          unit: "cái", price: 20000,  qtyFixed: 1 },
  { key: "fuse",     name: "Cầu chì bảo vệ",               unit: "cái", price: 8000,   qtyFixed: 1 },
  { key: "display",  name: "Đồng hồ / công tắc hiển thị",  unit: "cái", price: 45000,  qtyFixed: 1 },
  { key: "shrink",   name: "Ống co nhiệt / băng keo",      unit: "bộ",  price: 15000,  qtyFixed: 1 },
  { key: "misc",     name: "Keo, phụ liệu lắp ráp",        unit: "bộ",  price: 10000,  qtyFixed: 1 },
];

/* ---- Mẫu pack chuẩn ---- */
const TEMPLATES = [
  { id: "lfp-12v",  name: "Pin LiFePO4 12V (4S) — dự phòng/năng lượng mặt trời", cell: "lfp32700-6000", s: 4,  p: 4 },
  { id: "lfp-24v",  name: "Pin LiFePO4 24V (8S) — thiết bị/UPS",                 cell: "lfp32700-6000", s: 8,  p: 3 },
  { id: "lfp-48v",  name: "Pin LiFePO4 48V (16S) — xe điện/golf cart",           cell: "lfp32700-6000", s: 16, p: 4 },
  { id: "li-36v",   name: "Pin Li-ion 36V (10S) — xe đạp điện",                  cell: "liion18650-3000", s: 10, p: 4 },
  { id: "li-48v",   name: "Pin Li-ion 48V (13S) — xe đạp/máy điện",              cell: "liion21700-5000", s: 13, p: 4 },
  { id: "li-60v",   name: "Pin Li-ion 60V (16S) — xe scooter",                   cell: "liion21700-5000", s: 16, p: 5 },
  { id: "custom",   name: "Tùy chỉnh (nhập S/P tự do)",                          cell: "lfp32700-6000", s: 4,  p: 2 },
];
