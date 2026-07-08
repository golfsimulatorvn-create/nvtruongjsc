/* =========================================================================
 * estimator.js — Dự toán & BOM (danh sách vật tư sửa được)
 *  - BOM: cột Mã mặt hàng + Tên, mọi dòng sửa được, nhập từ Excel
 *  - Nhân công & quản lý tính theo số cell và loại cell (bảng định mức)
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

  function refresh() { initSelects(); syncCellPrice(); renderBom(); }

  function loadFactors() {
    const f = S.estimator.factors || {};
    $("waste").value = f.waste ?? 3;
    $("labor-cell").value = f.laborCell ?? 3000;
    $("mgmt-cell").value = f.mgmtCell ?? 2000;
    $("labor-fixed").value = f.laborFixed ?? 50000;
    $("margin").value = f.margin ?? 15;
    $("vat").value = f.vat ?? 8;
    $("qty").value = f.qty ?? 1;
  }

  const byCode = (code) => Store.findItemByCode(code);

  function applyConfig() {
    const cfg = S.estimator.config;
    if (cfg && cfg.cellId) {
      $("bom-name").value = cfg.bomName || "";
      $("product-code").value = cfg.productCode || "";
      $("template").value = cfg.templateId || "custom";
      selVal("cell", cfg.cellId); selVal("bms", cfg.bmsId); selVal("case", cfg.caseId);
      $("series").value = cfg.s; $("parallel").value = cfg.p;
    } else {
      applyTemplate("lfp-48v");
    }
    syncCellPrice();
    if (!S.estimator.lines || !S.estimator.lines.length) generateLines();
    renderBom();
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
    $("series").value = t.s; $("parallel").value = t.p;
    syncCellPrice();
    generateLines();
    renderBom();
  }

  function syncCellPrice() {
    const c = Store.findItem($("cell").value) || Store.cellItems()[0];
    if (c) $("cell-price").value = c.price;
  }

  function cfgSP() {
    const s = Math.max(1, Math.round(num($("series"))));
    const p = Math.max(1, Math.round(num($("parallel"))));
    return { s, p, N: s * p };
  }

  /* ---------- Dựng BOM từ cấu hình ---------- */
  function generateLines() {
    const { s, p, N } = cfgSP();
    const cell = Store.findItem($("cell").value) || Store.cellItems()[0];
    const bms = Store.findItem($("bms").value);
    const cs = Store.findItem($("case").value);
    const lines = [];
    if (cell) lines.push({ code: cell.code, name: cell.name, unit: cell.unit || "cell", qty: N, price: num($("cell-price")) || cell.price });
    if (bms) lines.push({ code: bms.code, name: bms.name, unit: bms.unit || "cái", qty: 1, price: bms.price });
    if (cs) lines.push({ code: cs.code, name: cs.name, unit: cs.unit || "cái", qty: 1, price: cs.price });
    Store.autoMaterials().forEach((m) => {
      let q = (m.qtyFixed || 0) + (m.qtyPerCell || 0) * N + (m.qtyPerS || 0) * s;
      q = Math.round(q * 100) / 100;
      lines.push({ code: m.code, name: m.name, unit: m.unit, qty: q, price: m.price });
    });
    S.estimator.lines = lines;
  }

  function regenerate() {
    if ((S.estimator.lines || []).length && !UI.confirmBox("Dựng lại BOM từ cấu hình sẽ thay thế danh sách vật tư hiện tại. Tiếp tục?")) return;
    generateLines();
    renderBom();
    UI.toast("Đã dựng lại BOM từ cấu hình");
  }

  /* ---------- Render BOM (danh sách sửa được) ---------- */
  function linesTotal() {
    return (S.estimator.lines || []).reduce((sum, l) => sum + (l.qty || 0) * (l.price || 0), 0);
  }

  function renderBom() {
    const lines = S.estimator.lines || (S.estimator.lines = []);
    const body = $("bom-body");
    body.innerHTML = "";
    let material = 0;
    lines.forEach((l, i) => {
      const total = (l.qty || 0) * (l.price || 0);
      material += total;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-idx">${i + 1}</td>
        <td><input class="cell-in" data-li="${i}" data-f="code" value="${esc(l.code || "")}" placeholder="Mã"/></td>
        <td><input class="cell-in" data-li="${i}" data-f="name" value="${esc(l.name || "")}" placeholder="Tên vật tư"/></td>
        <td class="col-unit"><input class="cell-in" style="text-align:center" data-li="${i}" data-f="unit" value="${esc(l.unit || "")}"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" data-li="${i}" data-f="qty" value="${l.qty}"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" data-li="${i}" data-f="price" value="${l.price}"/></td>
        <td class="col-num" data-total="${i}">${fmt(total)}</td>
        <td class="col-act no-print"><button class="btn-del" data-ldel="${i}">✕</button></td>`;
      body.appendChild(tr);
    });
    $("sum-material").textContent = fmt(material);
    bindLines();
    renderSpec();
    renderSummary();
    persist();
  }

  function bindLines() {
    $("bom-body").querySelectorAll("[data-li]").forEach((el) => {
      const i = +el.getAttribute("data-li"), f = el.getAttribute("data-f");
      const isNum = f === "qty" || f === "price";
      el.oninput = () => { S.estimator.lines[i][f] = isNum ? parseFloat(el.value) || 0 : el.value; if (isNum) softTotals(); };
      if (f === "code") el.onchange = () => autofillByCode(i);
    });
    $("bom-body").querySelectorAll("[data-ldel]").forEach((el) => {
      el.onclick = () => { S.estimator.lines.splice(+el.getAttribute("data-ldel"), 1); renderBom(); };
    });
  }

  // Khi nhập mã vật tư khớp bảng giá -> tự điền tên + đơn giá + ĐVT
  function autofillByCode(i) {
    const l = S.estimator.lines[i];
    const it = Store.findItemByCode(l.code);
    if (it) { l.name = it.name; l.price = it.price; l.unit = it.unit || l.unit; renderBom(); UI.toast("Đã lấy thông tin: " + it.code); }
    else softTotals();
  }

  function softTotals() {
    let material = 0;
    (S.estimator.lines || []).forEach((l, i) => {
      const total = (l.qty || 0) * (l.price || 0);
      material += total;
      const td = $("bom-body").querySelector(`[data-total="${i}"]`);
      if (td) td.textContent = fmt(total);
    });
    $("sum-material").textContent = fmt(material);
    renderSummary();
    persist();
  }

  function addLine() {
    S.estimator.lines.push({ code: "", name: "Vật tư mới", unit: "cái", qty: 1, price: 0 });
    renderBom();
  }

  function addFromPriceList() {
    const opts = S.items.slice().sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code))
      .map((it) => `<option value="${it.id}">[${esc(categoryLabel(it.category))}] ${esc(it.code)} — ${esc(it.name)} · ${fmt(it.price)}đ</option>`).join("");
    UI.modal({
      title: "Thêm vật tư từ bảng giá",
      bodyHtml: `<label class="field"><span>Mặt hàng</span><select data-name="pick">${opts}</select></label>
        <label class="field"><span>Số lượng</span><input data-name="qty" type="number" min="0" step="any" value="1"/></label>`,
      onSubmit: (v) => {
        const it = Store.findItem(v.pick);
        if (!it) return;
        S.estimator.lines.push({ code: it.code, name: it.name, unit: it.unit || "cái", qty: +v.qty || 1, price: it.price });
        renderBom();
      },
    });
  }

  /* ---------- Nhập BOM từ Excel ---------- */
  const noAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/[^a-z0-9]/g, "");
  function xlNum(v) {
    if (typeof v === "number") return v;
    let s = String(v == null ? "" : v).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(",", ".");
    return parseFloat(s) || 0;
  }
  function pick(r, keys) { for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k]; return ""; }

  function loadBomExcel(file) {
    if (!window.XLSX) return UI.toast("Thư viện Excel chưa sẵn sàng", "err");
    const reader = new FileReader();
    reader.onload = (e) => {
      let wb;
      try { wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" }); }
      catch (err) { return UI.toast("Không đọc được file (.xlsx/.csv)", "err"); }
      const newLines = [];
      wb.SheetNames.forEach((sn) => {
        XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" }).forEach((raw) => {
          const r = {}; Object.keys(raw).forEach((k) => (r[noAccent(k)] = raw[k]));
          const code = String(pick(r, ["mamathang", "mavattu", "masp", "ma", "code"])).trim();
          let name = String(pick(r, ["tenmathang", "tenvattu", "ten", "hangmuc", "name"])).trim();
          let unit = String(pick(r, ["dvt", "donvitinh", "unit"])).trim();
          let price = xlNum(pick(r, ["dongia", "gia", "price"]));
          const qty = xlNum(pick(r, ["soluong", "sl", "qty", "quantity"])) || (code || name ? 1 : 0);
          if (!code && !name) return;
          // có mã -> lấy tên/giá/ĐVT từ bảng giá nếu thiếu
          const it = code ? Store.findItemByCode(code) : null;
          if (it) { if (!name) name = it.name; if (!price) price = it.price; if (!unit) unit = it.unit; }
          newLines.push({ code, name, unit: unit || "cái", qty, price });
        });
      });
      if (!newLines.length) return UI.toast("Không tìm thấy dòng vật tư (cần cột Mã hoặc Tên)", "err");
      UI.modal({
        title: "Nhập BOM từ Excel", okText: "Thay thế BOM",
        bodyHtml: `<p class="hint">Đọc được <b>${newLines.length}</b> dòng. Dòng có <b>Mã</b> khớp bảng giá đã tự lấy Tên/Đơn giá.</p>
          <p class="hint">Chọn cách áp dụng:</p>`,
        onSubmit: () => { S.estimator.lines = newLines; renderBom(); UI.toast(`Đã nạp ${newLines.length} dòng (thay thế)`); },
      });
      // nút phụ: nối thêm
      const foot = document.querySelector("#modal .modal-foot");
      if (foot && !document.getElementById("bom-append")) {
        const btn = document.createElement("button");
        btn.className = "btn btn-ghost"; btn.id = "bom-append"; btn.textContent = "Nối thêm";
        btn.onclick = () => { S.estimator.lines = (S.estimator.lines || []).concat(newLines); renderBom(); UI.closeModal(); UI.toast(`Đã nối thêm ${newLines.length} dòng`); };
        foot.insertBefore(btn, foot.firstChild);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- Thông số & giá thành ---------- */
  function renderSpec() {
    const { s, p, N } = cfgSP();
    const cell = Store.findItem($("cell").value) || { v: 0, ah: 0 };
    const V = s * (cell.v || 0), Ah = p * (cell.ah || 0), Wh = V * Ah;
    $("spec-card").innerHTML = `
      <div class="spec"><span>Cấu hình</span><b>${s}S${p}P</b></div>
      <div class="spec"><span>Tổng cell</span><b>${N}</b></div>
      <div class="spec"><span>Điện áp</span><b>${V.toFixed(1)} V</b></div>
      <div class="spec"><span>Dung lượng</span><b>${Ah.toFixed(1)} Ah</b></div>
      <div class="spec"><span>Năng lượng</span><b>${(Wh / 1000).toFixed(2)} kWh</b></div>`;
    const pc = $("product-code").value.trim(), bn = $("bom-name").value.trim();
    $("bom-title").textContent = `BOM${bn ? ": " + bn : ""}${pc ? " · " + pc : ""} · ${s}S${p}P`;
  }

  // Nhân công & quản lý theo số cell và loại cell (định mức riêng của cell nếu có)
  function calc(material) {
    const { N } = cfgSP();
    const cell = Store.findItem($("cell").value) || {};
    const f = {
      waste: num($("waste")) / 100,
      laborCell: cell.laborPerCell != null ? cell.laborPerCell : num($("labor-cell")),
      mgmtCell: cell.mgmtPerCell != null ? cell.mgmtPerCell : num($("mgmt-cell")),
      laborFixed: num($("labor-fixed")), margin: num($("margin")) / 100, vat: num($("vat")) / 100,
      qty: Math.max(1, Math.round(num($("qty")))),
    };
    const wasteCost = material * f.waste;
    const labor = f.laborCell * N + f.laborFixed;
    const mgmt = f.mgmtCell * N;
    const cogs = material + wasteCost + labor + mgmt;
    const profit = cogs * f.margin;
    const beforeVat = cogs + profit;
    const vatCost = beforeVat * f.vat;
    const price = beforeVat + vatCost;
    return { f, N, material, wasteCost, labor, mgmt, cogs, profit, beforeVat, vatCost, price };
  }

  function renderSummary() {
    const material = linesTotal();
    const c = calc(material);
    const rows = [
      ["Chi phí vật tư", c.material],
      [`Hao hụt vật tư (${(c.f.waste * 100).toFixed(1)}%)`, c.wasteCost],
      [`Nhân công (${fmt(c.f.laborCell)}đ×${c.N} cell + ${fmt(c.f.laborFixed)})`, c.labor],
      [`Chi phí quản lý (${fmt(c.f.mgmtCell)}đ×${c.N} cell)`, c.mgmt],
      ["Giá thành sản xuất (COGS)", c.cogs, "sub"],
      [`Lợi nhuận (${(c.f.margin * 100).toFixed(0)}%)`, c.profit],
      ["Giá bán trước thuế", c.beforeVat, "sub"],
      [`Thuế VAT (${(c.f.vat * 100).toFixed(0)}%)`, c.vatCost],
      ["ĐƠN GIÁ BÁN / PACK (đã VAT)", c.price, "grand"],
    ];
    let html = '<table class="sum-table"><tbody>';
    rows.forEach(([l, v, cls]) => (html += `<tr class="${cls || ""}"><td>${l}</td><td class="col-num">${fmt(v)} đ</td></tr>`));
    html += "</tbody></table>";
    if (c.f.qty > 1) html += `<div class="order-total"><span>Tổng ${c.f.qty} pack (đã VAT)</span><b>${fmt(c.price * c.f.qty)} đ</b></div>`;
    $("summary").innerHTML = html;
  }

  function getQuote() {
    const material = linesTotal();
    const c = calc(material);
    const { s, p } = cfgSP();
    const cell = Store.findItem($("cell").value) || {};
    const pc = $("product-code").value.trim();
    const V = (s * (cell.v || 0)).toFixed(1), Ah = (p * (cell.ah || 0)).toFixed(1);
    const name = `${pc ? pc + " — " : ""}Pin ${cell.chem || ""} ${s}S${p}P · ${V}V ${Ah}Ah`.replace(/\s+/g, " ").trim();
    return { productCode: pc, productName: name, qty: c.f.qty, unitBeforeVat: Math.round(c.beforeVat), vatPct: num($("vat")) };
  }

  /* ================= ĐỊNH MỨC NHÂN CÔNG/QUẢN LÝ THEO LOẠI CELL ================= */
  function openCellRates() {
    const rows = Store.cellItems().map((c) => `
      <tr>
        <td><b>${esc(c.code)}</b><br><small>${esc(c.name)}</small></td>
        <td class="col-num"><input class="cell-in num" type="number" step="500" data-cr="${c.id}" data-f="laborPerCell" value="${c.laborPerCell != null ? c.laborPerCell : ""}" placeholder="mặc định"/></td>
        <td class="col-num"><input class="cell-in num" type="number" step="500" data-cr="${c.id}" data-f="mgmtPerCell" value="${c.mgmtPerCell != null ? c.mgmtPerCell : ""}" placeholder="mặc định"/></td>
      </tr>`).join("");
    UI.modal({
      title: "Định mức Nhân công / Quản lý theo loại cell", okText: "Đóng",
      bodyHtml: `<p class="hint">Đơn giá tính theo <b>mỗi cell</b>. Để trống = dùng mặc định chung ở bên trái (Nhân công ${fmt(num($("labor-cell")))}đ, Quản lý ${fmt(num($("mgmt-cell")))}đ).</p>
        <div class="table-scroll"><table class="grid-table"><thead><tr>
          <th>Loại cell</th><th class="col-num">Nhân công (đ/cell)</th><th class="col-num">Quản lý (đ/cell)</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`,
      onSubmit: () => true,
    });
    document.querySelectorAll("[data-cr]").forEach((el) => {
      el.onchange = () => {
        const c = Store.findItem(el.getAttribute("data-cr")); if (!c) return;
        const f = el.getAttribute("data-f");
        c[f] = el.value === "" ? undefined : parseFloat(el.value) || 0;
        Store.save(); renderSummary();
      };
    });
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
      if (UI.confirmBox("Xóa mẫu này?")) { Store.state.templates = Store.state.templates.filter((x) => x.id !== b.getAttribute("data-tdel")); Store.save(); initSelects(); openTemplateManager(); }
    }));
    $("tpl-add").onclick = () => templateForm(null);
    $("tpl-from-current").onclick = saveCurrentAsTemplate;
  }
  function templateForm(id) {
    const t = id ? Store.state.templates.find((x) => x.id === id)
      : { name: "", cellCode: (Store.cellItems()[0] || {}).code, s: 16, p: 4, bmsCode: "", caseCode: "" };
    const none = '<option value="">— không —</option>';
    UI.modal({
      title: id ? "Sửa mẫu pack" : "Thêm mẫu pack",
      bodyHtml: `
        <label class="field"><span>Tên mẫu *</span><input data-name="name" value="${esc(t.name)}" placeholder="VD: Pin xe nâng 48V 102Ah"/></label>
        <label class="field"><span>Loại cell</span><select data-name="cellCode">${optsFor(Store.cellItems(), t.cellCode)}</select></label>
        <div class="grid-2">
          <label class="field"><span>Loại BMS</span><select data-name="bmsCode">${none + optsFor(Store.itemsByCat("BMS"), t.bmsCode)}</select></label>
          <label class="field"><span>Loại Vỏ</span><select data-name="caseCode">${none + optsFor(Store.itemsByCat("CASE"), t.caseCode)}</select></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Số nối tiếp (S)</span><input data-name="s" type="number" min="1" value="${t.s}"/></label>
          <label class="field"><span>Số song song (P)</span><input data-name="p" type="number" min="1" value="${t.p}"/></label>
        </div>`,
      onSubmit: (v) => {
        if (!v.name.trim()) return UI.toast("Nhập tên mẫu", "err"), false;
        const rec = { name: v.name.trim(), cellCode: v.cellCode, bmsCode: v.bmsCode, caseCode: v.caseCode, s: Math.max(1, Math.round(+v.s || 1)), p: Math.max(1, Math.round(+v.p || 1)) };
        if (id) Object.assign(Store.state.templates.find((x) => x.id === id), rec);
        else Store.state.templates.push({ id: Store.uid("tpl-"), ...rec });
        Store.save(); initSelects(); UI.toast("Đã lưu mẫu");
        setTimeout(openTemplateManager, 0);
      },
    });
  }
  function saveCurrentAsTemplate() {
    const cell = Store.findItem($("cell").value), bms = Store.findItem($("bms").value), cs = Store.findItem($("case").value);
    const { s, p } = cfgSP();
    const suggest = [$("product-code").value.trim(), cell ? cell.name : ""].filter(Boolean).join(" · ");
    UI.modal({
      title: "Lưu cấu hình hiện tại thành mẫu",
      bodyHtml: `<label class="field"><span>Tên mẫu *</span><input data-name="name" value="${esc(suggest)}"/></label>`,
      onSubmit: (v) => {
        if (!v.name.trim()) return UI.toast("Nhập tên mẫu", "err"), false;
        Store.state.templates.push({ id: Store.uid("tpl-"), name: v.name.trim(), cellCode: cell ? cell.code : "", bmsCode: bms ? bms.code : "", caseCode: cs ? cs.code : "", s, p });
        Store.save(); initSelects(); UI.toast("Đã lưu mẫu mới");
        setTimeout(openTemplateManager, 0);
      },
    });
  }

  /* ================= LƯU / MỞ / XUẤT BOM ================= */
  function saveBom() {
    persist();
    const name = $("bom-name").value.trim() || $("product-code").value.trim() || "BOM không tên";
    const snapshot = Store.clone(S.estimator);
    const ex = S.boms.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (ex) { if (!UI.confirmBox(`Đã có BOM "${name}". Ghi đè?`)) return; ex.snapshot = snapshot; ex.savedAt = Date.now(); }
    else S.boms.push({ id: Store.uid("bom-"), name, snapshot, savedAt: Date.now() });
    Store.save(); UI.toast("Đã lưu BOM: " + name);
  }
  function openBomList() {
    const rows = S.boms.slice().sort((a, b) => b.savedAt - a.savedAt).map((b) => {
      const d = new Date(b.savedAt).toLocaleDateString("vi-VN");
      return `<div class="tpl-row"><div><b>${esc(b.name)}</b><br><small>Lưu ${d}</small></div>
        <div class="tpl-acts"><button class="btn btn-sm" data-bload="${b.id}" type="button">Mở</button><button class="btn-del" data-bdel="${b.id}" type="button">✕</button></div></div>`;
    }).join("");
    UI.modal({ title: "BOM đã lưu", okText: "Đóng",
      bodyHtml: `<div class="tpl-list">${rows || '<p class="hint">Chưa có BOM nào được lưu.</p>'}</div>`, onSubmit: () => true });
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
    const material = linesTotal();
    const c = calc(material);
    const bn = $("bom-name").value.trim(), pc = $("product-code").value.trim();
    const { s, p, N } = cfgSP();
    const aoa = [];
    aoa.push(["BOM", bn || pc || ""]);
    if (pc) aoa.push(["Mã sản phẩm", pc]);
    aoa.push(["Cấu hình", `${s}S${p}P`, "Tổng cell", N]);
    aoa.push([]);
    aoa.push(["STT", "Mã mặt hàng", "Tên mặt hàng", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]);
    (S.estimator.lines || []).forEach((l, i) => aoa.push([i + 1, l.code || "", l.name || "", l.unit || "", l.qty, l.price, (l.qty || 0) * (l.price || 0)]));
    aoa.push([]);
    aoa.push(["", "", "", "", "", "Tổng vật tư", c.material]);
    aoa.push(["", "", "", "", "", "Hao hụt", c.wasteCost]);
    aoa.push(["", "", "", "", "", "Nhân công", c.labor]);
    aoa.push(["", "", "", "", "", "Chi phí quản lý", c.mgmt]);
    aoa.push(["", "", "", "", "", "Giá thành SX (COGS)", c.cogs]);
    aoa.push(["", "", "", "", "", "Lợi nhuận", c.profit]);
    aoa.push(["", "", "", "", "", "Giá bán trước thuế", c.beforeVat]);
    aoa.push(["", "", "", "", "", "VAT", c.vatCost]);
    aoa.push(["", "", "", "", "", "ĐƠN GIÁ BÁN/PACK (đã VAT)", c.price]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "BOM");
    XLSX.writeFile(wb, (bn || pc || "bom").replace(/[^\w-]+/g, "_") + ".xlsx");
    UI.toast("Đã xuất BOM ra Excel");
  }

  function persist() {
    S.estimator.config = {
      bomName: $("bom-name").value, productCode: $("product-code").value, templateId: $("template").value,
      cellId: $("cell").value, bmsId: $("bms").value, caseId: $("case").value,
      s: num($("series")), p: num($("parallel")),
    };
    S.estimator.factors = {
      waste: num($("waste")), laborCell: num($("labor-cell")), mgmtCell: num($("mgmt-cell")),
      laborFixed: num($("labor-fixed")), margin: num($("margin")), vat: num($("vat")), qty: num($("qty")),
    };
    Store.save();
  }

  function bind() {
    $("template").addEventListener("change", (e) => applyTemplate(e.target.value));
    $("cell").addEventListener("change", () => { syncCellPrice(); renderSpec(); renderSummary(); persist(); });
    ["bms", "case"].forEach((id) => $(id).addEventListener("change", () => { renderSpec(); persist(); }));
    $("product-code").addEventListener("input", () => { renderSpec(); persist(); });
    $("bom-name").addEventListener("input", () => { renderSpec(); persist(); });
    ["cell-price", "series", "parallel"].forEach((id) => $(id).addEventListener("input", () => { renderSpec(); renderSummary(); persist(); }));
    ["waste", "labor-cell", "mgmt-cell", "labor-fixed", "margin", "vat", "qty"].forEach((id) => $(id).addEventListener("input", () => { renderSummary(); persist(); }));
    $("btn-add").addEventListener("click", addLine);
    $("btn-add-from-pl").addEventListener("click", addFromPriceList);
    $("btn-regen-bom").addEventListener("click", regenerate);
    $("bom-import-file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) loadBomExcel(f); e.target.value = ""; });
    $("btn-cell-rates").addEventListener("click", openCellRates);
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

  return { init, render: renderBom, refresh, getQuote };
})();
