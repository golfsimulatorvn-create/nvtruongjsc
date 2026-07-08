/* =========================================================================
 * products.js — Kho sản phẩm (bảng giá bán của công ty)
 * ========================================================================= */
const Products = (function () {
  "use strict";
  const { $, fmt, esc, modal, toast, confirmBox } = UI;
  const S = Store.state;
  let filterGroup = "ALL";
  let search = "";

  const groups = () => [...new Set(S.products.map((p) => p.group || "Khác"))].sort();

  function render() {
    renderFilter();
    renderList();
  }

  function renderFilter() {
    const box = $("pr-group-filter");
    if (!box) return;
    const gs = groups();
    const counts = { ALL: S.products.length };
    gs.forEach((g) => (counts[g] = S.products.filter((p) => (p.group || "Khác") === g).length));
    const btn = (key, label) => `<button class="chip ${filterGroup === key ? "is-active" : ""}" data-g="${esc(key)}">${esc(label)} <b>${counts[key] || 0}</b></button>`;
    box.innerHTML = btn("ALL", "Tất cả") + gs.map((g) => btn(g, g)).join("");
    box.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { filterGroup = b.getAttribute("data-g"); render(); }));
  }

  function list() {
    const q = search.trim().toLowerCase();
    return S.products
      .filter((p) => filterGroup === "ALL" || (p.group || "Khác") === filterGroup)
      .filter((p) => !q || [p.code, p.name, p.group].some((x) => (x || "").toLowerCase().includes(q)))
      .sort((a, b) => ((a.group || "") + a.code).localeCompare((b.group || "") + b.code));
  }

  function renderList() {
    const body = $("products-body");
    body.innerHTML = "";
    const rows = list();
    if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="empty">Không có sản phẩm phù hợp.</td></tr>`; return; }
    rows.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="tag tag-blue">${esc(p.group || "Khác")}</span></td>
        <td><b>${esc(p.code)}</b></td>
        <td class="pr-spec">${esc(p.name)}</td>
        <td class="col-unit">${esc(p.unit || "bộ")}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="1000" value="${p.price}" data-id="${p.id}"/></td>
        <td class="col-act">
          <button class="btn-icon" data-edit="${p.id}" title="Sửa">✎</button>
          <button class="btn-del" data-del="${p.id}" title="Xóa">✕</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("input[data-id]").forEach((el) => {
      el.oninput = () => { const p = Store.findProduct(el.getAttribute("data-id")); if (p) { p.price = parseFloat(el.value) || 0; Store.save(); } };
      el.onchange = () => { const p = Store.findProduct(el.getAttribute("data-id")); if (p) { Store.logPrice("Sản phẩm", p.code, "Giá bán", el.defaultValue, el.value); Store.save(); } };
    });
    body.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(b.getAttribute("data-edit"))));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(b.getAttribute("data-del"))));
  }

  /* ---------- CRUD ---------- */
  function form(p) {
    p = p || { group: "Khác", unit: "bộ" };
    const gs = groups();
    const dl = gs.map((g) => `<option value="${esc(g)}">`).join("");
    return `
      <div class="grid-2">
        <label class="field"><span>Mã sản phẩm *</span><input data-name="code" value="${esc(p.code)}" placeholder="VD: HHXM4815"/></label>
        <label class="field"><span>Nhóm</span><input data-name="group" list="pr-groups" value="${esc(p.group)}"/><datalist id="pr-groups">${dl}</datalist></label>
      </div>
      <label class="field"><span>Thông số kỹ thuật</span><textarea data-name="name" rows="4">${esc(p.name)}</textarea></label>
      <div class="grid-2">
        <label class="field"><span>Đơn vị tính</span><input data-name="unit" value="${esc(p.unit || "bộ")}"/></label>
        <label class="field"><span>Giá bán (đ)</span><input data-name="price" type="number" step="1000" value="${p.price || 0}"/></label>
      </div>`;
  }

  function clean(v) {
    return { code: (v.code || "").trim(), group: (v.group || "Khác").trim() || "Khác",
      name: (v.name || "").trim(), unit: (v.unit || "bộ").trim(), price: +v.price || 0 };
  }

  function add() {
    modal({ title: "Thêm sản phẩm", bodyHtml: form(),
      onSubmit: (v) => {
        if (!v.code.trim()) return toast("Nhập mã sản phẩm", "err"), false;
        S.products.push({ id: Store.uid("sp-"), ...clean(v) });
        Store.save(); render(); toast("Đã thêm sản phẩm");
      } });
  }
  function edit(id) {
    const p = Store.findProduct(id);
    if (!p) return;
    modal({ title: "Sửa sản phẩm", bodyHtml: form(p),
      onSubmit: (v) => {
        if (!v.code.trim()) return toast("Nhập mã sản phẩm", "err"), false;
        if (+v.price !== +p.price) Store.logPrice("Sản phẩm", p.code, "Giá bán", p.price, +v.price);
        Object.assign(p, clean(v));
        Store.save(); render(); toast("Đã lưu");
      } });
  }
  function del(id) {
    const p = Store.findProduct(id);
    if (!p) return;
    if (!confirmBox(`Xóa sản phẩm "${p.code}"?`)) return;
    S.products = S.products.filter((x) => x.id !== id);
    Store.save(); render();
  }

  /* ---------- Excel ---------- */
  const HEADERS = ["Mã sản phẩm", "Nhóm", "Thông số kỹ thuật", "ĐVT", "Giá bán"];
  const noAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/[^a-z0-9]/g, "");
  function toNum(v) {
    if (typeof v === "number") return v;
    let s = String(v == null ? "" : v).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(",", ".");
    return parseFloat(s) || 0;
  }
  function pick(r, keys) { for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k]; return ""; }

  function exportExcel() {
    if (!window.XLSX) return toast("Thư viện Excel chưa sẵn sàng", "err");
    const aoa = [HEADERS];
    S.products.slice().sort((a, b) => ((a.group || "") + a.code).localeCompare((b.group || "") + b.code))
      .forEach((p) => aoa.push([p.code, p.group || "", p.name, p.unit || "bộ", p.price]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "SanPham");
    XLSX.writeFile(wb, "kho-san-pham.xlsx");
    toast("Đã xuất kho sản phẩm ra Excel");
  }

  function importExcel(file) {
    if (!window.XLSX) return toast("Thư viện Excel chưa sẵn sàng", "err");
    const reader = new FileReader();
    reader.onload = (e) => {
      let wb;
      try { wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" }); }
      catch (err) { return toast("Không đọc được file (.xlsx/.csv)", "err"); }
      const upd = [], add = [];
      wb.SheetNames.forEach((sn) => {
        XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" }).forEach((raw) => {
          const r = {}; Object.keys(raw).forEach((k) => (r[noAccent(k)] = raw[k]));
          const code = String(pick(r, ["masanpham", "masp", "ma", "code"])).trim();
          if (!code) return;
          const rec = {
            code, group: String(pick(r, ["nhom", "group", "loai"])).trim(),
            name: String(pick(r, ["thongsokythuat", "thongso", "ten", "name"])).trim(),
            unit: String(pick(r, ["dvt", "donvitinh", "unit"])).trim(),
            price: toNum(pick(r, ["giaban", "gia", "dongia", "price"])),
          };
          const ex = S.products.find((p) => p.code.toLowerCase() === code.toLowerCase());
          if (ex) upd.push({ ex, rec }); else add.push(rec);
        });
      });
      const total = upd.length + add.length;
      if (!total) return toast("Không tìm thấy dữ liệu (cần cột 'Mã sản phẩm')", "err");
      modal({
        title: "Xác nhận nhập kho sản phẩm", okText: "Áp dụng",
        bodyHtml: `<div class="import-summary"><div>Cập nhật: <b>${upd.length}</b> sản phẩm</div><div>Thêm mới: <b>${add.length}</b> sản phẩm</div></div>`,
        onSubmit: () => {
          upd.forEach(({ ex, rec }) => {
            if (rec.price && +rec.price !== +ex.price) Store.logPrice("Sản phẩm", ex.code, "Giá bán", ex.price, rec.price);
            if (rec.name) ex.name = rec.name; if (rec.group) ex.group = rec.group; if (rec.unit) ex.unit = rec.unit; if (rec.price) ex.price = rec.price;
          });
          add.forEach((rec) => S.products.push({ id: Store.uid("sp-"), code: rec.code, group: rec.group || "Khác", name: rec.name, unit: rec.unit || "bộ", price: rec.price }));
          Store.save(); render(); toast(`Đã nhập ${total} sản phẩm`);
        },
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function init() {
    $("pr-add").onclick = add;
    $("pr-search").oninput = (e) => { search = e.target.value; renderList(); };
    $("pr-export-excel").onclick = exportExcel;
    $("pr-import-file").onchange = (e) => { const f = e.target.files[0]; if (f) importExcel(f); e.target.value = ""; };
  }

  return { init, render };
})();
