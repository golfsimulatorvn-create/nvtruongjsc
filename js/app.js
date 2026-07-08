/* =========================================================================
 * app.js — Logic công cụ dự toán & BOM Pin
 * ========================================================================= */
(function () {
  "use strict";

  const STORE_KEY = "battery-estimator-v1";
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n || 0).toLocaleString("vi-VN");
  const num = (el) => parseFloat(el.value) || 0;

  /* Trạng thái đơn giá vật tư (có thể chỉnh + lưu localStorage) */
  const state = {
    prices: {},        // key vật tư -> đơn giá
    qty: {},           // key vật tư -> số lượng đã chỉnh tay (nếu có)
    extra: [],         // dòng vật tư người dùng thêm {name, unit, qty, price}
    cellPrices: {},    // id cell -> đơn giá
  };

  /* ---------- Khởi tạo dropdown ---------- */
  function initSelects() {
    const tpl = $("template");
    TEMPLATES.forEach((t) => tpl.add(new Option(t.name, t.id)));

    const cell = $("cell");
    CELLS.forEach((c) => cell.add(new Option(c.name, c.id)));
  }

  /* ---------- Áp mẫu pack ---------- */
  function applyTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    $("cell").value = t.cell;
    $("series").value = t.s;
    $("parallel").value = t.p;
    syncCellPrice();
    render();
  }

  function syncCellPrice() {
    const c = CELLS.find((x) => x.id === $("cell").value);
    if (!c) return;
    $("cell-price").value = state.cellPrices[c.id] ?? c.price;
  }

  /* ---------- Tính BOM ---------- */
  function buildBom() {
    const S = Math.max(1, Math.round(num($("series"))));
    const P = Math.max(1, Math.round(num($("parallel"))));
    const N = S * P;
    const cell = CELLS.find((x) => x.id === $("cell").value) || CELLS[0];
    const cellPrice = num($("cell-price"));

    const rows = [];

    // Dòng cell luôn đứng đầu
    rows.push({
      key: "cell",
      name: `Cell ${cell.name}`,
      unit: "cell",
      qty: N,
      price: cellPrice,
      locked: true,
    });

    // Vật tư phụ
    MATERIALS.forEach((m) => {
      let q =
        (m.qtyFixed || 0) +
        (m.qtyPerCell || 0) * N +
        (m.qtyPerS || 0) * S;
      q = Math.round(q * 100) / 100;
      const key = "mat:" + m.key;
      rows.push({
        key,
        name: m.name,
        unit: m.unit,
        qty: state.qty[key] != null ? state.qty[key] : q,
        price: state.prices[key] != null ? state.prices[key] : m.price,
      });
    });

    // Vật tư người dùng thêm
    state.extra.forEach((e, i) => {
      rows.push({
        key: "extra:" + i,
        name: e.name,
        unit: e.unit,
        qty: e.qty,
        price: e.price,
        extra: true,
      });
    });

    return { S, P, N, cell, rows };
  }

  /* ---------- Render BOM ---------- */
  function render() {
    const bom = buildBom();
    const body = $("bom-body");
    body.innerHTML = "";
    let material = 0;

    bom.rows.forEach((r, idx) => {
      const total = r.qty * r.price;
      material += total;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-idx">${idx + 1}</td>
        <td>${cellEdit(r, "name", r.name, r.locked)}</td>
        <td class="col-unit">${r.unit}</td>
        <td class="col-num">${inputCell(r.key, "qty", r.qty)}</td>
        <td class="col-num">${inputCell(r.key, "price", r.price)}</td>
        <td class="col-num">${fmt(total)}</td>
        <td class="col-act no-print">${r.extra ? delBtn(r.key) : ""}</td>`;
      body.appendChild(tr);
    });

    $("sum-material").textContent = fmt(material);
    bindTableInputs();
    renderSpec(bom);
    renderSummary(material, bom);
    save();
  }

  function cellEdit(r, field, val, locked) {
    if (!r.extra) return escapeHtml(val);
    return `<input class="cell-in cell-name" data-key="${r.key}" data-field="name" value="${escapeAttr(
      val
    )}" />`;
  }

  function inputCell(key, field, val) {
    return `<input class="cell-in num" type="number" min="0" step="any" data-key="${key}" data-field="${field}" value="${val}" />`;
  }

  function delBtn(key) {
    return `<button class="btn-del" data-del="${key}" title="Xóa dòng">✕</button>`;
  }

  function bindTableInputs() {
    document.querySelectorAll(".cell-in").forEach((el) => {
      el.addEventListener("input", onCellEdit);
    });
    document.querySelectorAll("[data-del]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.getAttribute("data-del").split(":")[1], 10);
        state.extra.splice(i, 1);
        render();
      });
    });
  }

  function onCellEdit(e) {
    const el = e.target;
    const key = el.getAttribute("data-key");
    const field = el.getAttribute("data-field");

    if (key === "cell") {
      if (field === "price") $("cell-price").value = el.value;
      render();
      return;
    }
    if (key.startsWith("extra:")) {
      const i = parseInt(key.split(":")[1], 10);
      if (!state.extra[i]) return;
      state.extra[i][field] = field === "name" ? el.value : parseFloat(el.value) || 0;
      // cập nhật tức thời phần thành tiền mà không mất focus
      updateTotalsSoft();
      return;
    }
    // vật tư chuẩn
    const v = parseFloat(el.value) || 0;
    if (field === "price") state.prices[key] = v;
    if (field === "qty") state.qty[key] = v;
    updateTotalsSoft();
  }

  /* Cập nhật lại tổng tiền mà không render lại toàn bộ (giữ con trỏ) */
  function updateTotalsSoft() {
    const bom = buildBom();
    const body = $("bom-body");
    let material = 0;
    bom.rows.forEach((r, idx) => {
      const total = r.qty * r.price;
      material += total;
      const cellTd = body.rows[idx] && body.rows[idx].cells[5];
      if (cellTd) cellTd.textContent = fmt(total);
    });
    $("sum-material").textContent = fmt(material);
    renderSummary(material, bom);
    save();
  }

  /* ---------- Thông số kỹ thuật pack ---------- */
  function renderSpec(bom) {
    const V = bom.S * bom.cell.v;
    const Ah = bom.P * bom.cell.ah;
    const Wh = V * Ah;
    $("spec-card").innerHTML = `
      <div class="spec"><span>Cấu hình</span><b>${bom.S}S${bom.P}P</b></div>
      <div class="spec"><span>Tổng cell</span><b>${bom.N}</b></div>
      <div class="spec"><span>Điện áp</span><b>${V.toFixed(1)} V</b></div>
      <div class="spec"><span>Dung lượng</span><b>${Ah.toFixed(1)} Ah</b></div>
      <div class="spec"><span>Năng lượng</span><b>${(Wh / 1000).toFixed(2)} kWh</b></div>`;

    $("bom-title").textContent = `3. Định mức vật tư (BOM) — ${bom.S}S${bom.P}P · ${V.toFixed(1)}V ${Ah.toFixed(1)}Ah`;
  }

  /* ---------- Bảng dự toán giá thành ---------- */
  function renderSummary(material, bom) {
    const waste = num($("waste")) / 100;
    const laborCell = num($("labor-cell"));
    const laborFixed = num($("labor-fixed"));
    const overhead = num($("overhead")) / 100;
    const margin = num($("margin")) / 100;
    const vat = num($("vat")) / 100;
    const qty = Math.max(1, Math.round(num($("qty"))));

    const wasteCost = material * waste;
    const labor = laborCell * bom.N + laborFixed;
    const cogs = material + wasteCost + labor;
    const overheadCost = cogs * overhead;
    const beforeMargin = cogs + overheadCost;
    const profit = beforeMargin * margin;
    const beforeVat = beforeMargin + profit;
    const vatCost = beforeVat * vat;
    const price = beforeVat + vatCost;

    const rows = [
      ["Chi phí vật tư", material],
      [`Hao hụt vật tư (${(waste * 100).toFixed(1)}%)`, wasteCost],
      ["Nhân công", labor],
      ["Giá thành sản xuất (COGS)", cogs, "sub"],
      [`Chi phí quản lý (${(overhead * 100).toFixed(0)}%)`, overheadCost],
      [`Lợi nhuận (${(margin * 100).toFixed(0)}%)`, profit],
      ["Giá bán trước thuế", beforeVat, "sub"],
      [`Thuế VAT (${(vat * 100).toFixed(0)}%)`, vatCost],
      ["ĐƠN GIÁ BÁN / PACK (đã VAT)", price, "grand"],
    ];

    let html = '<table class="sum-table"><tbody>';
    rows.forEach(([label, val, cls]) => {
      html += `<tr class="${cls || ""}"><td>${label}</td><td class="col-num">${fmt(
        val
      )} đ</td></tr>`;
    });
    html += "</tbody></table>";

    if (qty > 1) {
      html += `<div class="order-total">
        <span>Tổng ${qty} pack (đã VAT)</span>
        <b>${fmt(price * qty)} đ</b>
      </div>`;
    }
    $("summary").innerHTML = html;
    updatePrintMeta(bom, price);
  }

  function updatePrintMeta(bom, price) {
    const V = (bom.S * bom.cell.v).toFixed(1);
    const Ah = (bom.P * bom.cell.ah).toFixed(1);
    const d = new Date().toLocaleDateString("vi-VN");
    $("print-meta").textContent = `Cấu hình ${bom.S}S${bom.P}P · ${V}V ${Ah}Ah · Đơn giá: ${fmt(
      price
    )} đ/pack · Ngày lập: ${d}`;
  }

  /* ---------- Thêm dòng vật tư ---------- */
  function addExtra() {
    state.extra.push({ name: "Vật tư mới", unit: "cái", qty: 1, price: 0 });
    render();
  }

  /* ---------- Lưu / nạp localStorage ---------- */
  function save() {
    // Lưu đơn giá cell hiện tại
    const cid = $("cell").value;
    state.cellPrices[cid] = num($("cell-price"));
    const data = {
      prices: state.prices,
      qty: state.qty,
      extra: state.extra,
      cellPrices: state.cellPrices,
      factors: {
        waste: $("waste").value,
        laborCell: $("labor-cell").value,
        laborFixed: $("labor-fixed").value,
        overhead: $("overhead").value,
        margin: $("margin").value,
        vat: $("vat").value,
      },
    };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      state.prices = d.prices || {};
      state.qty = d.qty || {};
      state.extra = d.extra || [];
      state.cellPrices = d.cellPrices || {};
      if (d.factors) {
        $("waste").value = d.factors.waste;
        $("labor-cell").value = d.factors.laborCell;
        $("labor-fixed").value = d.factors.laborFixed;
        $("overhead").value = d.factors.overhead;
        $("margin").value = d.factors.margin;
        $("vat").value = d.factors.vat;
      }
    } catch (e) {}
  }

  function reset() {
    if (!confirm("Đặt lại toàn bộ đơn giá vật tư & hệ số về mặc định?")) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  }

  /* ---------- Tiện ích ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  /* ---------- Sự kiện ---------- */
  function bind() {
    $("template").addEventListener("change", (e) => applyTemplate(e.target.value));
    $("cell").addEventListener("change", () => {
      syncCellPrice();
      render();
    });
    ["cell-price", "series", "parallel"].forEach((id) =>
      $(id).addEventListener("input", render)
    );
    ["waste", "labor-cell", "labor-fixed", "overhead", "margin", "vat", "qty"].forEach((id) =>
      $(id).addEventListener("input", () => updateTotalsSoft())
    );
    $("btn-add").addEventListener("click", addExtra);
    $("btn-print").addEventListener("click", () => window.print());
    $("btn-reset").addEventListener("click", reset);
  }

  /* ---------- Chạy ---------- */
  function init() {
    initSelects();
    load();
    bind();
    $("template").value = "lfp-48v";
    applyTemplate("lfp-48v");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
