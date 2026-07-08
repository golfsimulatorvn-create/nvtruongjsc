/* =========================================================================
 * pricelist.js — Quản lý bảng giá Cell & Vật tư
 * ========================================================================= */
const PriceList = (function () {
  "use strict";
  const { $, fmt, esc, modal, toast, confirmBox } = UI;
  const S = Store.state;

  function render() {
    renderCells();
    renderMats();
    renderHistory();
  }

  function renderHistory() {
    const body = $("history-body");
    if (!body) return;
    const list = S.priceHistory || [];
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty">Chưa có thay đổi giá nào được ghi nhận.</td></tr>`;
      return;
    }
    body.innerHTML = list
      .slice(0, 100)
      .map((h) => {
        const d = new Date(h.ts);
        const when = d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const up = h.new > h.old;
        const diff = h.new - h.old;
        const pct = h.old ? ((diff / h.old) * 100).toFixed(1) : "—";
        return `<tr>
          <td>${when}</td>
          <td><span class="tag tag-${h.kind === "Cell" ? "blue" : "gray"}">${esc(h.kind)}</span> ${esc(h.name)}</td>
          <td class="col-num">${fmt(h.old)} đ</td>
          <td class="col-num">${fmt(h.new)} đ</td>
          <td class="col-num" style="color:${up ? "#b91c1c" : "#15803d"}">${up ? "▲" : "▼"} ${fmt(Math.abs(diff))} đ (${pct}%)</td>
        </tr>`;
      })
      .join("");
  }

  function renderCells() {
    const body = $("cells-body");
    body.innerHTML = "";
    S.cells.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(c.name)}</td>
        <td>${esc(c.chem)}</td>
        <td class="col-num">${c.v}</td>
        <td class="col-num">${c.ah}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="100" value="${c.price}" data-id="${c.id}"/></td>
        <td class="col-act">
          <button class="btn-icon" data-edit="${c.id}" title="Sửa">✎</button>
          <button class="btn-del" data-delcell="${c.id}" title="Xóa">✕</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("input[data-id]").forEach((el) => {
      el.oninput = () => {
        const c = Store.findCell(el.getAttribute("data-id"));
        if (c) { c.price = parseFloat(el.value) || 0; Store.save(); }
      };
      el.onchange = () => {
        const c = Store.findCell(el.getAttribute("data-id"));
        if (c) { Store.logPrice("Cell", c.name, "Đơn giá", el.defaultValue, el.value); Store.save(); renderHistory(); }
      };
    });
    body.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => editCell(b.getAttribute("data-edit"))));
    body.querySelectorAll("[data-delcell]").forEach((b) => (b.onclick = () => delCell(b.getAttribute("data-delcell"))));
  }

  function renderMats() {
    const body = $("mats-body");
    body.innerHTML = "";
    S.materials.forEach((m, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(m.name)}</td>
        <td class="col-unit">${esc(m.unit)}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="500" value="${m.price}" data-mi="${i}" data-f="price"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" value="${m.qtyFixed || 0}" data-mi="${i}" data-f="qtyFixed"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" value="${m.qtyPerCell || 0}" data-mi="${i}" data-f="qtyPerCell"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" value="${m.qtyPerS || 0}" data-mi="${i}" data-f="qtyPerS"/></td>
        <td class="col-act"><button class="btn-del" data-delmat="${i}" title="Xóa">✕</button></td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("input[data-mi]").forEach((el) => {
      el.oninput = () => {
        const m = S.materials[parseInt(el.getAttribute("data-mi"), 10)];
        if (m) { m[el.getAttribute("data-f")] = parseFloat(el.value) || 0; Store.save(); }
      };
      el.onchange = () => {
        if (el.getAttribute("data-f") !== "price") return;
        const m = S.materials[parseInt(el.getAttribute("data-mi"), 10)];
        if (m) { Store.logPrice("Vật tư", m.name, "Đơn giá", el.defaultValue, el.value); Store.save(); renderHistory(); }
      };
    });
    body.querySelectorAll("[data-delmat]").forEach((b) => (b.onclick = () => delMat(parseInt(b.getAttribute("data-delmat"), 10))));
  }

  /* ---- Cell CRUD ---- */
  function cellForm(c) {
    c = c || { name: "", chem: "LiFePO4", v: 3.2, ah: 5, price: 0 };
    return `
      <label class="field"><span>Tên cell</span><input data-name="name" value="${esc(c.name)}"/></label>
      <div class="grid-2">
        <label class="field"><span>Hóa học</span><input data-name="chem" value="${esc(c.chem)}"/></label>
        <label class="field"><span>Điện áp danh định (V)</span><input data-name="v" type="number" step="0.1" value="${c.v}"/></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Dung lượng (Ah)</span><input data-name="ah" type="number" step="0.1" value="${c.ah}"/></label>
        <label class="field"><span>Đơn giá (đ)</span><input data-name="price" type="number" step="100" value="${c.price}"/></label>
      </div>`;
  }
  function addCell() {
    modal({
      title: "Thêm loại cell", bodyHtml: cellForm(),
      onSubmit: (v) => {
        if (!v.name.trim()) return toast("Nhập tên cell", "err"), false;
        S.cells.push({ id: Store.uid("cell-"), name: v.name.trim(), chem: v.chem.trim(),
          v: +v.v || 0, ah: +v.ah || 0, price: +v.price || 0 });
        Store.save(); render(); Estimator.init(); toast("Đã thêm cell");
      },
    });
  }
  function editCell(id) {
    const c = Store.findCell(id);
    if (!c) return;
    modal({
      title: "Sửa cell", bodyHtml: cellForm(c),
      onSubmit: (v) => {
        Object.assign(c, { name: v.name.trim(), chem: v.chem.trim(), v: +v.v || 0, ah: +v.ah || 0, price: +v.price || 0 });
        Store.save(); render(); Estimator.init(); toast("Đã lưu");
      },
    });
  }
  function delCell(id) {
    if (S.cells.length <= 1) return toast("Cần giữ ít nhất 1 cell", "err");
    if (!confirmBox("Xóa loại cell này?")) return;
    S.cells = S.cells.filter((c) => c.id !== id);
    Store.save(); render(); Estimator.init();
  }

  /* ---- Vật tư CRUD ---- */
  function matForm(m) {
    m = m || { name: "", unit: "cái", price: 0, qtyFixed: 1, qtyPerCell: 0, qtyPerS: 0 };
    return `
      <label class="field"><span>Tên vật tư</span><input data-name="name" value="${esc(m.name)}"/></label>
      <div class="grid-2">
        <label class="field"><span>Đơn vị tính</span><input data-name="unit" value="${esc(m.unit)}"/></label>
        <label class="field"><span>Đơn giá (đ)</span><input data-name="price" type="number" step="500" value="${m.price}"/></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>SL cố định/pack</span><input data-name="qtyFixed" type="number" step="any" value="${m.qtyFixed || 0}"/></label>
        <label class="field"><span>SL theo cell</span><input data-name="qtyPerCell" type="number" step="any" value="${m.qtyPerCell || 0}"/></label>
        <label class="field"><span>SL theo S</span><input data-name="qtyPerS" type="number" step="any" value="${m.qtyPerS || 0}"/></label>
      </div>`;
  }
  function addMat() {
    modal({
      title: "Thêm vật tư", bodyHtml: matForm(),
      onSubmit: (v) => {
        if (!v.name.trim()) return toast("Nhập tên vật tư", "err"), false;
        S.materials.push({ key: Store.uid("m-"), name: v.name.trim(), unit: v.unit.trim() || "cái",
          price: +v.price || 0, qtyFixed: +v.qtyFixed || 0, qtyPerCell: +v.qtyPerCell || 0, qtyPerS: +v.qtyPerS || 0 });
        Store.save(); render(); Estimator.render(); toast("Đã thêm vật tư");
      },
    });
  }
  function delMat(i) {
    if (!confirmBox("Xóa vật tư này?")) return;
    S.materials.splice(i, 1);
    Store.save(); render(); Estimator.render();
  }

  /* ================= NHẬP / XUẤT EXCEL ================= */
  const noAccent = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/[^a-z0-9]/g, "");

  function toNum(v) {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    let s = String(v).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(",", ".");
    return parseFloat(s) || 0;
  }

  // lấy giá trị 1 dòng theo danh sách từ khóa cột (không dấu)
  function pick(rowNorm, keys) {
    for (const k of keys) if (rowNorm[k] !== undefined && rowNorm[k] !== "") return rowNorm[k];
    return "";
  }
  function normRow(row) {
    const o = {};
    Object.keys(row).forEach((k) => (o[noAccent(k)] = row[k]));
    return o;
  }

  function exportExcel() {
    if (!window.XLSX) return toast("Thư viện Excel chưa tải xong", "err");
    const cellAoa = [["Tên cell", "Hóa học", "Điện áp (V)", "Dung lượng (Ah)", "Đơn giá"]];
    S.cells.forEach((c) => cellAoa.push([c.name, c.chem, c.v, c.ah, c.price]));
    const matAoa = [["Tên vật tư", "ĐVT", "Đơn giá", "SL cố định/pack", "SL theo cell", "SL theo S"]];
    S.materials.forEach((m) => matAoa.push([m.name, m.unit, m.price, m.qtyFixed || 0, m.qtyPerCell || 0, m.qtyPerS || 0]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cellAoa), "Cell");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matAoa), "VatTu");
    XLSX.writeFile(wb, "bang-gia-pin.xlsx");
    toast("Đã xuất bảng giá ra Excel");
  }

  function detectType(sheetName, rows) {
    const n = noAccent(sheetName);
    if (n.includes("cell")) return "cell";
    if (n.includes("vattu") || n.includes("material") || n.includes("phukien")) return "mat";
    const r = rows[0] ? normRow(rows[0]) : {};
    if (r.dungluongah !== undefined || r.dienapv !== undefined || r.dungluong !== undefined) return "cell";
    if (r.dvt !== undefined || r.slcodinhpack !== undefined || r.sltheocell !== undefined) return "mat";
    return null;
  }

  function parseWorkbook(wb) {
    const plan = { cellUpd: [], cellAdd: [], matUpd: [], matAdd: [] };
    wb.SheetNames.forEach((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
      if (!rows.length) return;
      const type = detectType(name, rows);
      if (!type) return;
      rows.forEach((raw) => {
        const r = normRow(raw);
        if (type === "cell") {
          const nm = String(pick(r, ["tencell", "ten", "cell", "name"])).trim();
          if (!nm) return;
          const price = toNum(pick(r, ["dongia", "gia", "price"]));
          const chem = String(pick(r, ["hoahoc", "chem", "chemistry"])).trim();
          const v = toNum(pick(r, ["dienapv", "dienap", "v", "voltage"]));
          const ah = toNum(pick(r, ["dungluongah", "dungluong", "ah", "capacity"]));
          const ex = S.cells.find((c) => noAccent(c.name) === noAccent(nm));
          if (ex) plan.cellUpd.push({ ex, nm, price, chem, v, ah });
          else plan.cellAdd.push({ nm, price, chem: chem || "LiFePO4", v: v || 3.2, ah });
        } else {
          const nm = String(pick(r, ["tenvattu", "ten", "vattu", "name"])).trim();
          if (!nm) return;
          const price = toNum(pick(r, ["dongia", "gia", "price"]));
          const unit = String(pick(r, ["dvt", "donvitinh", "unit"])).trim();
          const qf = toNum(pick(r, ["slcodinhpack", "codinh", "qtyfixed", "slcodinh"]));
          const qc = toNum(pick(r, ["sltheocell", "theocell", "qtypercell"]));
          const qs = toNum(pick(r, ["sltheos", "theos", "qtypers"]));
          const hasQ = ["slcodinhpack", "sltheocell", "sltheos", "codinh", "theocell", "theos"].some((k) => r[k] !== undefined && r[k] !== "");
          const ex = S.materials.find((m) => noAccent(m.name) === noAccent(nm));
          if (ex) plan.matUpd.push({ ex, nm, price, unit, qf, qc, qs, hasQ });
          else plan.matAdd.push({ nm, price, unit: unit || "cái", qf, qc, qs });
        }
      });
    });
    return plan;
  }

  function applyPlan(plan) {
    plan.cellUpd.forEach((p) => {
      if (p.price) { Store.logPrice("Cell", p.ex.name, "Đơn giá", p.ex.price, p.price); p.ex.price = p.price; }
      if (p.chem) p.ex.chem = p.chem;
      if (p.v) p.ex.v = p.v;
      if (p.ah) p.ex.ah = p.ah;
    });
    plan.cellAdd.forEach((p) =>
      S.cells.push({ id: Store.uid("cell-"), name: p.nm, chem: p.chem, v: p.v, ah: p.ah, price: p.price })
    );
    plan.matUpd.forEach((p) => {
      if (p.price) { Store.logPrice("Vật tư", p.ex.name, "Đơn giá", p.ex.price, p.price); p.ex.price = p.price; }
      if (p.unit) p.ex.unit = p.unit;
      if (p.hasQ) { p.ex.qtyFixed = p.qf; p.ex.qtyPerCell = p.qc; p.ex.qtyPerS = p.qs; }
    });
    plan.matAdd.forEach((p) =>
      S.materials.push({ key: Store.uid("m-"), name: p.nm, unit: p.unit, price: p.price, qtyFixed: p.qf, qtyPerCell: p.qc, qtyPerS: p.qs })
    );
    Store.save();
    render();
    if (window.Estimator) Estimator.init();
  }

  function importExcel(file) {
    if (!window.XLSX) return toast("Thư viện Excel chưa tải xong, thử lại", "err");
    const reader = new FileReader();
    reader.onload = (e) => {
      let wb;
      try { wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" }); }
      catch (err) { return toast("Không đọc được file. Kiểm tra định dạng .xlsx/.csv", "err"); }
      const plan = parseWorkbook(wb);
      const total = plan.cellUpd.length + plan.cellAdd.length + plan.matUpd.length + plan.matAdd.length;
      if (!total) return toast("Không tìm thấy dữ liệu hợp lệ (sheet Cell / VatTu)", "err");

      const sample = [...plan.cellUpd.slice(0, 3).map((p) => "• Cập nhật cell: " + p.nm),
        ...plan.cellAdd.slice(0, 3).map((p) => "• Thêm cell: " + p.nm),
        ...plan.matUpd.slice(0, 3).map((p) => "• Cập nhật vật tư: " + p.nm),
        ...plan.matAdd.slice(0, 3).map((p) => "• Thêm vật tư: " + p.nm)].join("<br>");

      modal({
        title: "Xác nhận nhập bảng giá",
        okText: "Áp dụng",
        bodyHtml: `
          <div class="import-summary">
            <div><b>Cell:</b> cập nhật <b>${plan.cellUpd.length}</b>, thêm mới <b>${plan.cellAdd.length}</b></div>
            <div><b>Vật tư:</b> cập nhật <b>${plan.matUpd.length}</b>, thêm mới <b>${plan.matAdd.length}</b></div>
          </div>
          <p class="hint" style="margin-top:10px">${sample}${total > 12 ? "<br>…" : ""}</p>
          <p class="hint">Thay đổi giá sẽ được ghi vào Lịch sử điều chỉnh giá.</p>`,
        onSubmit: () => { applyPlan(plan); toast(`Đã nhập: ${total} mục`); },
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function init() {
    $("pl-add-cell").onclick = addCell;
    $("pl-add-mat").onclick = addMat;
    $("pl-clear-history").onclick = () => {
      if (!(S.priceHistory || []).length) return;
      if (confirmBox("Xóa toàn bộ lịch sử điều chỉnh giá?")) { S.priceHistory = []; Store.save(); renderHistory(); }
    };
    $("pl-export-excel").onclick = exportExcel;
    $("pl-import-file").onchange = (e) => {
      const f = e.target.files[0];
      if (f) importExcel(f);
      e.target.value = ""; // cho phép chọn lại cùng file
    };
  }

  return { init, render };
})();
