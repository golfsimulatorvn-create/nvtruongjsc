/* =========================================================================
 * store.js — Kho dữ liệu trung tâm (localStorage)
 * Nguồn dữ liệu duy nhất cho: cấu hình công ty, bảng giá đầu vào,
 * khách hàng, báo giá, và trạng thái công cụ dự toán.
 * ========================================================================= */
const Store = (function () {
  "use strict";
  const KEY = "battery-app-v2";

  const state = {
    company: {
      name: "CÔNG TY TNHH NĂNG LƯỢNG XANH HOA HUY",
      address: "Lô CN03, Khu công nghiệp Thái Hà, Xã Bắc Lý, Tỉnh Ninh Bình, Việt Nam",
      phone: "0914.585.177",
      email: "golfsimulator.vn@gmail.com",
      taxCode: "0700899375",
      website: "hoahuy.com",
      bank: "",
      logo: "assets/logo.png", // đường dẫn logo mặc định (có thể tải ảnh khác trong tab Cấu hình)
    },
    priceHistory: [], // {ts,kind,name,field,old,new}
    items: [],        // bảng giá đầu vào (xem data.js để biết schema)
    templates: [],    // mẫu pack chuẩn: {id,name,cellCode,bmsCode,caseCode,s,p}
    boms: [],         // BOM đã lưu: {id,name,snapshot(estimator),savedAt}
    customers: [],    // {id,name,company,phone,email,address,taxCode,note,createdAt}
    quotes: [],       // {id,code,customerId,date,validDays,items[],discountPct,vatPct,note,status,createdAt}
    counters: {},     // { "2026": 3 }
    estimator: {      // trạng thái công cụ dự toán
      config: null,   // {productCode,templateId,cellId,bmsId,caseId,s,p}
      factors: { waste: 3, laborCell: 3000, laborFixed: 50000, overhead: 10, margin: 15, vat: 8, qty: 1 },
      qtyOverrides: {}, // id vật tư -> số lượng chỉnh tay
      extra: [],        // dòng vật tư thêm
    },
  };

  const listeners = [];

  function uid(prefix) {
    return (prefix || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {}
    if (saved) Object.assign(state, saved);

    // Seed / chuẩn hóa bảng giá đầu vào
    if (!state.items || !state.items.length) {
      if ((state.cells && state.cells.length) || (state.materials && state.materials.length)) {
        state.items = migrateLegacy(state.cells || [], state.materials || []);
      } else {
        state.items = seedItems();
      }
    }
    state.items.forEach((it) => {
      if (!it.id) it.id = uid("it-");
      if (!it.category) it.category = categoryOf(it.code); // giữ phân loại đã sửa tay
      if (!it.unit) it.unit = it.category === "CELL" ? "cell" : "cái";
    });

    // Seed / chuẩn hóa mẫu pack chuẩn
    if (!state.templates || !state.templates.length) state.templates = TEMPLATES.map((t) => ({ ...t }));
    state.templates.forEach((t) => { if (!t.id) t.id = uid("tpl-"); });
    if (!state.boms) state.boms = [];

    delete state.cells;
    delete state.materials;
    if (!state.estimator) state.estimator = { config: null, factors: {}, qtyOverrides: {}, extra: [] };
    save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    listeners.forEach((fn) => fn());
  }

  /* ---- Seed bảng giá mặc định từ ITEMS ---- */
  function seedItems() {
    return ITEMS.map((x) => ({
      id: uid("it-"),
      code: x.code, name: x.name, mfrCode: x.mfrCode || "", brand: x.brand || "",
      price: x.price || 0, leadTime: x.leadTime || "", minStock: x.minStock || 0,
      unit: x.unit || "cái", category: x.category || categoryOf(x.code),
      chem: x.chem || "", v: x.v || 0, ah: x.ah || 0,
      qtyFixed: x.qtyFixed || 0, qtyPerCell: x.qtyPerCell || 0, qtyPerS: x.qtyPerS || 0,
    }));
  }

  /* ---- Chuyển dữ liệu cũ (cells + materials) sang items ---- */
  function migrateLegacy(cells, materials) {
    const out = [];
    cells.forEach((c) => {
      const code = c.code || ("CELL-" + String(c.id || uid("")).toUpperCase());
      out.push({ id: uid("it-"), code, name: c.name || code, mfrCode: "", brand: "",
        price: c.price || 0, leadTime: "", minStock: 0, unit: "cell", category: "CELL",
        chem: c.chem || "", v: c.v || 0, ah: c.ah || 0, qtyFixed: 0, qtyPerCell: 0, qtyPerS: 0 });
    });
    const mapCode = { bms: "BMS-STD", case: "CASE-STD" };
    materials.forEach((m) => {
      const code = mapCode[m.key] || ("PK-" + String(m.key || m.name || uid("")).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
      out.push({ id: uid("it-"), code, name: m.name || code, mfrCode: "", brand: "",
        price: m.price || 0, leadTime: "", minStock: 0, unit: m.unit || "cái", category: categoryOf(code),
        chem: "", v: 0, ah: 0, qtyFixed: m.qtyFixed || 0, qtyPerCell: m.qtyPerCell || 0, qtyPerS: m.qtyPerS || 0 });
    });
    return out;
  }

  function onChange(fn) { listeners.push(fn); }

  /* ---- Số báo giá tự tăng: BG-YYYY-NNN ---- */
  function nextQuoteCode() {
    const y = new Date().getFullYear();
    state.counters[y] = (state.counters[y] || 0) + 1;
    return "BG-" + y + "-" + String(state.counters[y]).padStart(3, "0");
  }

  /* ---- Ghi lịch sử điều chỉnh giá ---- */
  function logPrice(kind, name, field, oldVal, newVal) {
    if (+oldVal === +newVal) return;
    if (!state.priceHistory) state.priceHistory = [];
    state.priceHistory.unshift({ ts: Date.now(), kind, name, field, old: +oldVal || 0, new: +newVal || 0 });
    if (state.priceHistory.length > 300) state.priceHistory.length = 300;
  }

  /* ---- Helper tra cứu ---- */
  const findCustomer = (id) => state.customers.find((c) => c.id === id);
  const findQuote = (id) => state.quotes.find((q) => q.id === id);
  const findItem = (id) => state.items.find((x) => x.id === id);
  const findItemByCode = (code) => state.items.find((x) => String(x.code).toLowerCase() === String(code || "").toLowerCase());
  const itemsByCat = (cat) => state.items.filter((x) => x.category === cat);
  const cellItems = () => itemsByCat("CELL");
  // vật tư phụ có định mức BOM (tự tính trong dự toán); BMS & Vỏ chọn riêng qua dropdown
  const autoMaterials = () =>
    state.items.filter((x) => (x.category === "PHU" || x.category === "PCB") && ((x.qtyFixed || 0) || (x.qtyPerCell || 0) || (x.qtyPerS || 0)));

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) { Object.assign(state, JSON.parse(text)); save(); }
  function resetAll() { localStorage.removeItem(KEY); location.reload(); }

  return {
    state, load, save, onChange, uid, clone, logPrice,
    nextQuoteCode, findCustomer, findQuote,
    findItem, findItemByCode, itemsByCat, cellItems, autoMaterials,
    exportJSON, importJSON, resetAll,
  };
})();
