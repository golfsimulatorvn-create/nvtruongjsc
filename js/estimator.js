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
    const cur = tpl.value;
    tpl.innerHTML = "";
    Store.state.templates.forEach((t) => tpl.add(new Option(t.name, t.id)));
    if (cur && [...tpl.options].some((o) => o.value === cur)) tpl.value = cur;
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
      $("bom-name").value = cfg.bomName || "";
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
    const t = Store.state.templates.find((x) => x.id === id) || Store.state.templates[0];
    if (!t) return;
    $("template").value = t.id;
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
    const bn = $("bom-name").value.trim();
    $("bom-title").textContent = `BOM${bn ? ": " + bn : ""}${pc ? " · " + pc : ""} · ${bom.s}S${bom.p}P`;
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

  /* ================= QUẢN LÝ MẪU PACK ================= */
  function optsFor(items, code) {
    return items.map((it) => `<option value="${it.code}" ${it.code === code ? "selected" : ""}>${esc(it.code)} — ${esc(it.name)}</option>`).join("");
  }

  function openTemplateManager() {
    const rows = Store.state.templates.map((t) => `
      <div class="tpl-row">
        <div><b>${esc(t.name)}</b><br><small>${t.s}S${t.p}P · ${esc(t.cellCode || "")}${t.bmsCode ? " · " + esc(t.bmsCode) : ""}${t.caseCode ? " · " + esc(t.caseCode) : ""}</small></div>
        <div class="tpl-acts">
          <button class="btn-icon" data-tedit="${t.id}" title="Sửa">✎</button>
          <button class="btn-del" data-tdel="${t.id}" title="Xóa">✕</button>
        </div>
      </div>`).join("");
    UI.modal({
      title: "Quản lý mẫu pack chuẩn", okText: "Đóng",
      bodyHtml: `<div class="tpl-list">${rows || '<p class="hint">Chưa có mẫu nào.</p>'}</div>
        <div class="tpl-tools">
          <button class="btn btn-sm" id="tpl-add" type="button">＋ Thêm mẫu mới</button>
          <button class="btn btn-sm btn-ghost" id="tpl-from-current" type="button">Lưu cấu hình hiện tại thành mẫu</button>
        </div>`,
      onSubmit: () => true,
    });
    document.querySelectorAll("[data-tedit]").forEach((b) => (b.onclick = () => templateForm(b.getAttribute("data-tedit"))));
    document.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = () => {
      if (Store.state.templates.length <= 1) return UI.toast("Cần giữ ít nhất 1 mẫu", "err");
      if (UI.confirmBox("Xóa mẫu này?")) {
        Store.state.templates = Store.state.templates.filter((x) => x.id !== b.getAttribute("data-tdel"));
        Store.save(); initSelects(); openTemplateManager();
      }
    }));
    $("tpl-add").onclick = () => templateForm(null);
    $("tpl-from-current").onclick = saveCurrentAsTemplate;
  }

  function templateForm(id) {
    const t = id ? Store.state.templates.find((x) => x.id === id)
      : { name: "", cellCode: (Store.cellItems()[0] || {}).code, s: 16, p: 4, bmsCode: "", caseCode: "" };
    const cellOpts = optsFor(Store.cellItems(), t.cellCode);
    const none = '<option value="">— không —</option>';
    const bmsOpts = none + optsFor(Store.itemsByCat("BMS"), t.bmsCode);
    const caseOpts = none + optsFor(Store.itemsByCat("CASE"), t.caseCode);
    UI.modal({
      title: id ? "Sửa mẫu pack" : "Thêm mẫu pack",
      bodyHtml: `
        <label class="field"><span>Tên mẫu *</span><input data-name="name" value="${esc(t.name)}" placeholder="VD: Pin xe nâng 48V 102Ah"/></label>
        <label class="field"><span>Loại cell</span><select data-name="cellCode">${cellOpts}</select></label>
        <div class="grid-2">
          <label class="field"><span>Loại BMS</span><select data-name="bmsCode">${bmsOpts}</select></label>
          <label class="field"><span>Loại Vỏ</span><select data-name="caseCode">${caseOpts}</select></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Số nối tiếp (S)</span><input data-name="s" type="number" min="1" value="${t.s}"/></label>
          <label class="field"><span>Số song song (P)</span><input data-name="p" type="number" min="1" value="${t.p}"/></label>
        </div>`,
      onSubmit: (v) => {
        if (!v.name.trim()) return UI.toast("Nhập tên mẫu", "err"), false;
        const rec = { name: v.name.trim(), cellCode: v.cellCode, bmsCode: v.bmsCode, caseCode: v.caseCode,
          s: Math.max(1, Math.round(+v.s || 1)), p: Math.max(1, Math.round(+v.p || 1)) };
        if (id) Object.assign(Store.state.templates.find((x) => x.id === id), rec);
        else Store.state.templates.push({ id: Store.uid("tpl-"), ...rec });
        Store.save(); initSelects(); UI.toast("Đã lưu mẫu");
        setTimeout(openTemplateManager, 0);
      },
    });
  }

  function saveCurrentAsTemplate() {
    const cell = Store.findItem($("cell").value), bms = Store.findItem($("bms").value), cs = Store.findItem($("case").value);
    const s = num($("series")), p = num($("parallel"));
    const suggest = [$("product-code").value.trim(), cell ? cell.name : ""].filter(Boolean).join(" · ");
    UI.modal({
      title: "Lưu cấu hình hiện tại thành mẫu",
      bodyHtml: `<label class="field"><span>Tên mẫu *</span><input data-name="name" value="${esc(suggest)}"/></label>
        <p class="hint">Lưu: ${Math.max(1, Math.round(s))}S${Math.max(1, Math.round(p))}P · ${esc(cell ? cell.code : "")}${bms ? " · " + esc(bms.code) : ""}${cs ? " · " + esc(cs.code) : ""}</p>`,
      onSubmit: (v) => {
        if (!v.name.trim()) return UI.toast("Nhập tên mẫu", "err"), false;
        Store.state.templates.push({ id: Store.uid("tpl-"), name: v.name.trim(),
          cellCode: cell ? cell.code : "", bmsCode: bms ? bms.code : "", caseCode: cs ? cs.code : "",
          s: Math.max(1, Math.round(s)), p: Math.max(1, Math.round(p)) });
        Store.save(); initSelects(); UI.toast("Đã lưu mẫu mới");
        setTimeout(openTemplateManager, 0);
      },
    });
  }

  /* ================= THÊM VẬT TƯ TỪ BẢNG GIÁ ================= */
  function addFromPriceList() {
    const opts = S.items.slice()
      .sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code))
      .map((it) => `<option value="${it.id}">[${esc(categoryLabel(it.category))}] ${esc(it.code)} — ${esc(it.name)} · ${fmt(it.price)}đ</option>`)
      .join("");
    UI.modal({
      title: "Thêm vật tư từ bảng giá",
      bodyHtml: `<label class="field"><span>Mặt hàng</span><select data-name="pick">${opts}</select></label>
        <label class="field"><span>Số lượng</span><input data-name="qty" type="number" min="0" step="any" value="1"/></label>
        <p class="hint">Đơn giá tự lấy từ bảng giá; có thể sửa lại trong bảng BOM.</p>`,
      onSubmit: (v) => {
        const it = Store.findItem(v.pick);
        if (!it) return;
        S.estimator.extra.push({ name: `${it.code} — ${it.name}`, unit: it.unit || "cái", qty: +v.qty || 1, price: it.price });
        render();
      },
    });
  }

  /* ================= LƯU / MỞ / XUẤT BOM ================= */
  function saveBom() {
    persist();
    const name = $("bom-name").value.trim() || $("product-code").value.trim() || "BOM không tên";
    const snapshot = Store.clone(S.estimator);
    const ex = S.boms.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (ex) {
      if (!UI.confirmBox(`Đã có BOM "${name}". Ghi đè?`)) return;
      ex.snapshot = snapshot; ex.savedAt = Date.now();
    } else {
      S.boms.push({ id: Store.uid("bom-"), name, snapshot, savedAt: Date.now() });
    }
    Store.save();
    UI.toast("Đã lưu BOM: " + name);
  }

  function openBomList() {
    const rows = S.boms.slice().sort((a, b) => b.savedAt - a.savedAt).map((b) => {
      const d = new Date(b.savedAt).toLocaleDateString("vi-VN");
      return `<div class="tpl-row">
        <div><b>${esc(b.name)}</b><br><small>Lưu ${d}</small></div>
        <div class="tpl-acts">
          <button class="btn btn-sm" data-bload="${b.id}" type="button">Mở</button>
          <button class="btn-del" data-bdel="${b.id}" type="button">✕</button>
        </div></div>`;
    }).join("");
    UI.modal({
      title: "BOM đã lưu", okText: "Đóng",
      bodyHtml: `<div class="tpl-list">${rows || '<p class="hint">Chưa có BOM nào được lưu.</p>'}</div>`,
      onSubmit: () => true,
    });
    document.querySelectorAll("[data-bload]").forEach((el) => (el.onclick = () => loadBom(el.getAttribute("data-bload"))));
    document.querySelectorAll("[data-bdel]").forEach((el) => (el.onclick = () => {
      if (UI.confirmBox("Xóa BOM này?")) { S.boms = S.boms.filter((x) => x.id !== el.getAttribute("data-bdel")); Store.save(); setTimeout(openBomList, 0); }
    }));
  }

  function loadBom(id) {
    const b = S.boms.find((x) => x.id === id);
    if (!b) return;
    S.estimator = Store.clone(b.snapshot);
    UI.closeModal();
    loadFactors();
    applyConfig();
    Store.save();
    UI.toast("Đã mở BOM: " + b.name);
  }

  function exportBomExcel() {
    if (!window.XLSX) return UI.toast("Thư viện Excel chưa sẵn sàng", "err");
    const bom = buildBom();
    let material = 0;
    const bn = $("bom-name").value.trim(), pc = $("product-code").value.trim();
    const aoa = [];
    aoa.push(["BOM", bn || pc || ""]);
    if (pc) aoa.push(["Mã sản phẩm", pc]);
    aoa.push(["Cấu hình", `${bom.s}S${bom.p}P`, "Tổng cell", bom.N]);
    aoa.push([]);
    aoa.push(["STT", "Hạng mục / Vật tư", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]);
    bom.rows.forEach((r, i) => { const t = r.qty * r.price; material += t; aoa.push([i + 1, r.name, r.unit, r.qty, r.price, t]); });
    const c = calc(material, bom);
    aoa.push(["", "", "", "", "Tổng vật tư", material]);
    aoa.push(["", "", "", "", "Hao hụt", c.wasteCost]);
    aoa.push(["", "", "", "", "Nhân công", c.labor]);
    aoa.push(["", "", "", "", "Giá thành SX (COGS)", c.cogs]);
    aoa.push(["", "", "", "", "Chi phí quản lý", c.overheadCost]);
    aoa.push(["", "", "", "", "Lợi nhuận", c.profit]);
    aoa.push(["", "", "", "", "Giá bán trước thuế", c.beforeVat]);
    aoa.push(["", "", "", "", "VAT", c.vatCost]);
    aoa.push(["", "", "", "", "ĐƠN GIÁ BÁN/PACK (đã VAT)", c.price]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "BOM");
    XLSX.writeFile(wb, (bn || pc || "bom").replace(/[^\w-]+/g, "_") + ".xlsx");
    UI.toast("Đã xuất BOM ra Excel");
  }

  function persist() {
    S.estimator.config = {
      bomName: $("bom-name").value,
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
    $("bom-name").addEventListener("input", () => { renderSpec(buildBom()); persist(); });
    ["cell-price", "series", "parallel"].forEach((id) => $(id).addEventListener("input", render));
    ["waste", "labor-cell", "labor-fixed", "overhead", "margin", "vat", "qty"].forEach((id) =>
      $(id).addEventListener("input", softTotals)
    );
    $("btn-add").addEventListener("click", addExtra);
    $("btn-add-from-pl").addEventListener("click", addFromPriceList);
    $("btn-save-bom").addEventListener("click", saveBom);
    $("btn-load-bom").addEventListener("click", openBomList);
    $("btn-export-bom").addEventListener("click", exportBomExcel);
    $("btn-print-est").addEventListener("click", () => window.print());
    $("btn-to-quote").addEventListener("click", () => Quotes.newFromEstimator(getQuote()));
    $("tpl-manage").addEventListener("click", openTemplateManager);
  }

  function init() {
    initSelects();
    loadFactors();
    bind();
    applyConfig();
  }

  return { init, render, refresh, getQuote };
})();
