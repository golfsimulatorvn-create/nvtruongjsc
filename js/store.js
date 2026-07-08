/* =========================================================================
 * store.js — Kho dữ liệu trung tâm (localStorage)
 * Nguồn dữ liệu duy nhất cho: cấu hình công ty, bảng giá (cell + vật tư),
 * khách hàng, báo giá, và trạng thái công cụ dự toán.
 * ========================================================================= */
const Store = (function () {
  "use strict";
  const KEY = "battery-app-v2";

  const state = {
    company: {
      name: "GOLF SIMULATOR VN",
      address: "",
      phone: "",
      email: "golfsimulator.vn@gmail.com",
      taxCode: "",
      bank: "",
      logo: "", // data URL ảnh logo
    },
    priceHistory: [], // {ts,kind,name,field,old,new}
    cells: [],      // {id,name,chem,v,ah,price}
    materials: [],  // {key,name,unit,price,qtyFixed,qtyPerCell,qtyPerS}
    customers: [],  // {id,name,company,phone,email,address,taxCode,note,createdAt}
    quotes: [],     // {id,code,customerId,date,validDays,items[],discountPct,vatPct,note,status,createdAt}
    counters: {},   // { "2026": 3 }
    estimator: {    // trạng thái công cụ dự toán
      config: null, // {templateId,cellId,s,p}
      factors: { waste: 3, laborCell: 3000, laborFixed: 50000, overhead: 10, margin: 15, vat: 8, qty: 1 },
      qtyOverrides: {}, // key vật tư -> số lượng chỉnh tay
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

    if (saved) {
      Object.assign(state, saved);
    }
    // Seed bảng giá mặc định nếu trống
    if (!state.cells || !state.cells.length) state.cells = clone(CELLS);
    if (!state.materials || !state.materials.length) state.materials = clone(MATERIALS);
    if (!state.estimator) state.estimator = { factors: {}, qtyOverrides: {}, extra: [] };
    save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    listeners.forEach((fn) => fn());
  }

  function onChange(fn) {
    listeners.push(fn);
  }

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
    state.priceHistory.unshift({
      ts: Date.now(), kind, name, field,
      old: +oldVal || 0, new: +newVal || 0,
    });
    if (state.priceHistory.length > 300) state.priceHistory.length = 300;
  }

  /* ---- Helper tra cứu ---- */
  const findCustomer = (id) => state.customers.find((c) => c.id === id);
  const findQuote = (id) => state.quotes.find((q) => q.id === id);
  const findCell = (id) => state.cells.find((c) => c.id === id);

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    Object.assign(state, data);
    save();
  }

  function resetAll() {
    localStorage.removeItem(KEY);
    location.reload();
  }

  return {
    state, load, save, onChange, uid, clone, logPrice,
    nextQuoteCode, findCustomer, findQuote, findCell,
    exportJSON, importJSON, resetAll,
  };
})();
