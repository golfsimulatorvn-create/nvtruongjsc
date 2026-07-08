/* =========================================================================
 * estimator.js — Công cụ dự toán & BOM (dữ liệu từ bảng giá đầu vào)
 * Thêm: Mã sản phẩm, chọn loại BMS, chọn loại Vỏ.
 * ========================================================================= */
const Estimator = (function () {
  "use strict";
  const { $, fmt, esc } = UI;
  const S = Store.state;

  function num(el) { return parseFloat(el.value) || 0; }
  function fillSelect(sel, items, current) {
    sel.innerHTML = "";
    items.forEach((it) => sel.add(new Option(`${it.code} — ${it.name}`, it.id)));
    if (current && items.some((i) => i.id === current)) sel.value = current;
  }

  function initSelects() {
    const tpl = $("template");
    if (!tpl.options.length) TEMPLATES.forEach((t) => tpl.add(new Option(t.name, t.id)));
    fillSelect($("cell"), Store.cellItems(), $("cell").value);
    fillSelect($("bms"), Store.itemsByCat("BMS"), $("bms").value);
    fillSelect($("case"), Store.itemsByCat("CASE"), $("case").value);
  }

  // Cập nhật lại dropdown + BOM khi bảng giá đổi (không gắn lại sự kiện)
  function refresh() {
    initSelects();
    syncCellPrice();
    render();
  }

  function loadFactors() {
    const f = S.estimator.factors || {};
    $("waste").value = f.waste ?? 3;
    $("labor-cell").value = f.laborCell ?? 3000;
    $("labor-fixed").value = f.laborFixed ?? 50000;
    $("overhead").value = f.overhead ?? 10;
    $("margin").value = f.margin ?? 15;
    $("vat").value = f.vat ?? 8;
    $("qty").value = f.qty ?? 1;
  }

  function byCode(code) { return Store.findItemByCode(code); }

  function applyConfig() {
    const cfg = S.estimator.config;
    if (cfg && cfg.cellId) {
      $("product-code").value = cfg.productCode || "";
      $("template").value = cfg.templateId || "custom";
      selVal("cell", cfg.cellId);
      selVal("bms", cfg.bmsId);
      selVal("case", cfg.caseId);
      $("series").value = cfg.s;
      $("parallel").value = cfg.p;
    } else {
      applyTemplate("lfp-48v");
    }
    syncCellPrice();
    render();
  }

  function selVal(id, val) {
    const sel = $(id);
    if (val && [...sel.options].some((o) => o.value === val)) sel.value = val;
  }

  function applyTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    $("template").value = id;
    const cell = byCode(t.cellCode), bms = byCode(t.bmsCode), cs = byCode(t.caseCode);
    if (cell) $("cell").value = cell.id;
    if (bms) $("bms").value = bms.id;
    if (cs) $("case").value = cs.id;
    $("series").value = t.s;
    $("parallel").value = t.p;
    syncCellPrice();
    render();
  }

  function syncCellPrice() {
    const c = Store.findItem($("cell").value) || Store.cellItems()[0];
    if (c) $("cell-price").value = c.price;
  }

  function buildBom() {
    const s = Math.max(1, Math.round(num($("series"))));
    const p = Math.max(1, Math.round(num($("parallel"))));
    const N = s * p;
    const cell = Store.findItem($("cell").value) || Store.cellItems()[0];
    const bms = Store.findItem($("bms").value);
    const cs = Store.findItem($("case").value);
    const cellPrice = num($("cell-price"));
    const ov = S.estimator.qtyOverrides;
    const rows = [];

    if (cell) rows.push({ key: "cell", name: `Cell ${cell.name}`, unit: cell.unit || "cell", qty: N, price: cellPrice, locked: true });
    if (bms) rows.push({ key: bms.id, itemId: bms.id, name: `BMS: ${bms.name}`, unit: bms.unit || "cái", qty: ov[bms.id] != null ? ov[bms.id] : 1, price: bms.price });
    if (cs) rows.push({ key: cs.id, itemId: cs.id, name: `Vỏ: ${cs.name}`, unit: cs.unit || "cái", qty: ov[cs.id] != null ? ov[cs.id] : 1, price: cs.price });

    Store.autoMaterials().forEach((m) => {
      let q = (m.qtyFixed || 0) + (m.qtyPerCell || 0) * N + (m.qtyPerS || 0) * s;
      q = Math.round(q * 100) / 100;
      rows.push({ key: m.id, itemId: m.id, name: m.name, unit: m.unit, qty: ov[m.id] != null ? ov[m.id] : q, price: m.price });
    });

    (S.estimator.extra || []).forEach((e, i) =>
      rows.push({ key: "extra:" + i, name: e.name, unit: e.unit, qty: e.qty, price: e.price, extra: true })
    );

    return { s, p, N, cell, bms, cs, rows };
  }

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
        <td>${r.extra ? `<input class="cell-in cell-name" data-key="${r.key}" data-field="name" value="${esc(r.name)}"/>` : esc(r.name)}</td>
        <td class="col-unit">${r.extra ? `<input class="cell-in" style="text-align:center" data-key="${r.key}" data-field="unit" value="${esc(r.unit)}"/>` : esc(r.unit)}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" data-key="${r.key}" data-field="qty" value="${r.qty}"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" data-key="${r.key}" data-field="price" value="${r.price}"/></td>
        <td class="col-num" data-total>${fmt(total)}</td>
        <td class="col-act no-print">${r.extra ? `<button class="btn-del" data-del="${r.key}">✕</button>` : ""}</td>`;
      body.appendChild(tr);
    });
    $("sum-material").textContent = fmt(material);
    bindInputs();
    renderSpec(bom);
    renderSummary(material, bom);
    persist();
  }

  function bindInputs() {
    document.querySelectorAll("#bom-body .cell-in").forEach((el) => (el.oninput = onEdit));
    document.querySelectorAll("#bom-body [data-del]").forEach((el) => {
      el.onclick = () => {
        S.estimator.extra.splice(parseInt(el.getAttribute("data-del").split(":")[1], 10), 1);
        render();
      };
    });
  }

  function onEdit(e) {
    const el = e.target;
    const key = el.getAttribute("data-key");
    const field = el.getAttribute("data-field");
    const val = field === "name" || field === "unit" ? el.value : parseFloat(el.value) || 0;

    if (key === "cell") {
      if (field === "price") {
        $("cell-price").value = el.value;
        const c = Store.findItem($("cell").value);
        if (c) c.price = val;
      }
      softTotals();
      return;
    }
    if (key.startsWith("extra:")) {
      const i = parseInt(key.split(":")[1], 10);
      if (S.estimator.extra[i]) S.estimator.extra[i][field] = val;
      softTotals();
      return;
    }
    // dòng vật tư từ danh mục (key = item id)
    const item = Store.findItem(key);
    if (field === "price" && item) item.price = val;
    if (field === "qty") S.estimator.qtyOverrides[key] = val;
    softTotals();
  }

  function softTotals() {
    const bom = buildBom();
    const body = $("bom-body");
    let material = 0;
    bom.rows.forEach((r, idx) => {
      const total = r.qty * r.price;
      material += total;
      const td = body.rows[idx] && body.rows[idx].querySelector("[data-total]");
      if (td) td.textContent = fmt(total);
    });
    $("sum-material").textContent = fmt(material);
    renderSummary(material, bom);
    persist();
  }

  function renderSpec(bom) {
    const c = bom.cell || { v: 0, ah: 0 };
    const V = bom.s * (c.v || 0), Ah = bom.p * (c.ah || 0), Wh = V * Ah;
    $("spec-card").innerHTML = `
      <div class="spec"><span>Cấu hình</span><b>${bom.s}S${bom.p}P</b></div>
      <div class="spec"><span>Tổng cell</span><b>${bom.N}</b></div>
      <div class="spec"><span>Điện áp</span><b>${V.toFixed(1)} V</b></div>
      <div class="spec"><span>Dung lượng</span><b>${Ah.toFixed(1)} Ah</b></div>
      <div class="spec"><span>Năng lượng</span><b>${(Wh / 1000).toFixed(2)} kWh</b></div>`;
    const pc = $("product-code").value.trim();
    $("bom-title").textContent = `Định mức vật tư (BOM)${pc ? " — " + pc : ""} · ${bom.s}S${bom.p}P`;
  }

  function calc(material, bom) {
    const f = {
      waste: num($("waste")) / 100, laborCell: num($("labor-cell")), laborFixed: num($("labor-fixed")),
      overhead: num($("overhead")) / 100, margin: num($("margin")) / 100, vat: num($("vat")) / 100,
      qty: Math.max(1, Math.round(num($("qty")))),
    };
    const wasteCost = material * f.waste;
    const labor = f.laborCell * bom.N + f.laborFixed;
    const cogs = material + wasteCost + labor;
    const overheadCost = cogs * f.overhead;
    const beforeMargin = cogs + overheadCost;
    const profit = beforeMargin * f.margin;
    const beforeVat = beforeMargin + profit;
    const vatCost = beforeVat * f.vat;
    const price = beforeVat + vatCost;
    return { f, material, wasteCost, labor, cogs, overheadCost, profit, beforeVat, vatCost, price };
  }

  function renderSummary(material, bom) {
    const c = calc(material, bom);
    const rows = [
      ["Chi phí vật tư", c.material],
      [`Hao hụt vật tư (${(c.f.waste * 100).toFixed(1)}%)`, c.wasteCost],
      ["Nhân công", c.labor],
      ["Giá thành sản xuất (COGS)", c.cogs, "sub"],
      [`Chi phí quản lý (${(c.f.overhead * 100).toFixed(0)}%)`, c.overheadCost],
      [`Lợi nhuận (${(c.f.margin * 100).toFixed(0)}%)`, c.profit],
      ["Giá bán trước thuế", c.beforeVat, "sub"],
      [`Thuế VAT (${(c.f.vat * 100).toFixed(0)}%)`, c.vatCost],
      ["ĐƠN GIÁ BÁN / PACK (đã VAT)", c.price, "grand"],
    ];
    let html = '<table class="sum-table"><tbody>';
    rows.forEach(([l, v, cls]) => (html += `<tr class="${cls || ""}"><td>${l}</td><td class="col-num">${fmt(v)} đ</td></tr>`));
    html += "</tbody></table>";
    if (c.f.qty > 1)
      html += `<div class="order-total"><span>Tổng ${c.f.qty} pack (đã VAT)</span><b>${fmt(c.price * c.f.qty)} đ</b></div>`;
    $("summary").innerHTML = html;
  }

  function getQuote() {
    const bom = buildBom();
    let material = 0;
    bom.rows.forEach((r) => (material += r.qty * r.price));
    const c = calc(material, bom);
    const pc = $("product-code").value.trim();
    const chem = bom.cell ? bom.cell.chem || "" : "";
    const V = bom.cell ? (bom.s * (bom.cell.v || 0)).toFixed(1) : "0";
    const Ah = bom.cell ? (bom.p * (bom.cell.ah || 0)).toFixed(1) : "0";
    const name = `${pc ? pc + " — " : ""}Pin ${chem} ${bom.s}S${bom.p}P · ${V}V ${Ah}Ah`;
    return { productCode: pc, productName: name.trim(), qty: c.f.qty, unitBeforeVat: Math.round(c.beforeVat), vatPct: num($("vat")) };
  }

  function addExtra() {
    S.estimator.extra.push({ name: "Vật tư mới", unit: "cái", qty: 1, price: 0 });
    render();
  }

  function persist() {
    S.estimator.config = {
      productCode: $("product-code").value,
      templateId: $("template").value,
      cellId: $("cell").value, bmsId: $("bms").value, caseId: $("case").value,
      s: num($("series")), p: num($("parallel")),
    };
    S.estimator.factors = {
      waste: num($("waste")), laborCell: num($("labor-cell")), laborFixed: num($("labor-fixed")),
      overhead: num($("overhead")), margin: num($("margin")), vat: num($("vat")), qty: num($("qty")),
    };
    Store.save();
  }

  function bind() {
    $("template").addEventListener("change", (e) => applyTemplate(e.target.value));
    $("cell").addEventListener("change", () => { syncCellPrice(); render(); });
    ["bms", "case"].forEach((id) => $(id).addEventListener("change", render));
    $("product-code").addEventListener("input", () => { renderSpec(buildBom()); persist(); });
    ["cell-price", "series", "parallel"].forEach((id) => $(id).addEventListener("input", render));
    ["waste", "labor-cell", "labor-fixed", "overhead", "margin", "vat", "qty"].forEach((id) =>
      $(id).addEventListener("input", softTotals)
    );
    $("btn-add").addEventListener("click", addExtra);
    $("btn-print-est").addEventListener("click", () => window.print());
    $("btn-to-quote").addEventListener("click", () => Quotes.newFromEstimator(getQuote()));
  }

  function init() {
    initSelects();
    loadFactors();
    bind();
    applyConfig();
  }

  return { init, render, refresh, getQuote };
})();
