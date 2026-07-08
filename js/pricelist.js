/* =========================================================================
 * pricelist.js — Bảng giá đầu vào (danh mục vật tư có phân loại)
 * ========================================================================= */
const PriceList = (function () {
  "use strict";
  const { $, fmt, esc, modal, toast, confirmBox } = UI;
  const S = Store.state;
  let filterCat = "ALL";
  let search = "";

  const catColor = (key) => (CATEGORIES.find((c) => c.key === key) || { color: "gray" }).color;

  /* ---------- Render ---------- */
  function render() {
    renderFilter();
    renderItems();
    renderHistory();
  }

  function renderFilter() {
    const box = $("pl-cat-filter");
    if (!box) return;
    const counts = { ALL: S.items.length };
    CATEGORIES.forEach((c) => (counts[c.key] = S.items.filter((x) => x.category === c.key).length));
    const btn = (key, label) =>
      `<button class="chip ${filterCat === key ? "is-active" : ""}" data-cat="${key}">${label} <b>${counts[key] || 0}</b></button>`;
    box.innerHTML = btn("ALL", "Tất cả") + CATEGORIES.map((c) => btn(c.key, c.label)).join("");
    box.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { filterCat = b.getAttribute("data-cat"); render(); }));
  }

  function list() {
    const q = search.trim().toLowerCase();
    return S.items
      .filter((it) => filterCat === "ALL" || it.category === filterCat)
      .filter((it) => !q || [it.code, it.name, it.brand, it.mfrCode].some((x) => (x || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code));
  }

  function renderItems() {
    const body = $("items-body");
    body.innerHTML = "";
    const rows = list();
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="10" class="empty">Không có mặt hàng phù hợp.</td></tr>`;
      return;
    }
    rows.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="tag tag-${catColor(it.category)}">${esc(categoryLabel(it.category))}</span></td>
        <td><b>${esc(it.code)}</b></td>
        <td>${esc(it.name)}</td>
        <td>${esc(it.mfrCode)}</td>
        <td>${esc(it.brand)}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="100" value="${it.price}" data-id="${it.id}"/></td>
        <td>${esc(it.leadTime)}</td>
        <td class="col-num">${it.minStock || 0}</td>
        <td class="cfg-cell">${cfgSummary(it)} <button class="btn-icon" data-cfg="${it.id}" title="Cài đặt định mức BOM">⚙</button></td>
        <td class="col-act">
          <button class="btn-icon" data-edit="${it.id}" title="Sửa">✎</button>
          <button class="btn-del" data-del="${it.id}" title="Xóa">✕</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("[data-cfg]").forEach((b) => (b.onclick = () => configModal(b.getAttribute("data-cfg"))));
    body.querySelectorAll("input[data-id]").forEach((el) => {
      el.oninput = () => { const it = Store.findItem(el.getAttribute("data-id")); if (it) { it.price = parseFloat(el.value) || 0; Store.save(); } };
      el.onchange = () => {
        const it = Store.findItem(el.getAttribute("data-id"));
        if (it) { Store.logPrice(categoryLabel(it.category), it.code + " · " + it.name, "Đơn giá", el.defaultValue, el.value); Store.save(); renderHistory(); syncEstimator(); }
      };
    });
    body.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(b.getAttribute("data-edit"))));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(b.getAttribute("data-del"))));
  }

  function syncEstimator() { if (window.Estimator && Estimator.refresh) Estimator.refresh(); }

  /* ---------- Lịch sử giá ---------- */
  function renderHistory() {
    const body = $("history-body");
    if (!body) return;
    const hist = S.priceHistory || [];
    if (!hist.length) { body.innerHTML = `<tr><td colspan="5" class="empty">Chưa có thay đổi giá nào.</td></tr>`; return; }
    body.innerHTML = hist.slice(0, 100).map((h) => {
      const d = new Date(h.ts);
      const when = d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      const up = h.new > h.old, diff = h.new - h.old, pct = h.old ? ((diff / h.old) * 100).toFixed(1) : "—";
      return `<tr><td>${when}</td><td>${esc(h.name)}</td><td class="col-num">${fmt(h.old)} đ</td><td class="col-num">${fmt(h.new)} đ</td>
        <td class="col-num" style="color:${up ? "#b91c1c" : "#15803d"}">${up ? "▲" : "▼"} ${fmt(Math.abs(diff))} đ (${pct}%)</td></tr>`;
    }).join("");
  }

  /* ---------- Cài đặt định mức BOM (nút ⚙) ---------- */
  function cfgSummary(it) {
    if (it.category === "CELL") return `<small>${it.v || 0}V · ${it.ah || 0}Ah</small>`;
    if (it.category === "BMS" || it.category === "CASE") return `<small class="muted">chọn ở Dự toán</small>`;
    const inBom = (it.qtyFixed || 0) || (it.qtyPerCell || 0) || (it.qtyPerS || 0);
    return inBom ? `<span class="tag tag-green">trong BOM</span>` : `<small class="muted">chưa dùng</small>`;
  }

  function configModal(id) {
    const it = Store.findItem(id);
    if (!it) return;
    let bodyHtml, hideOk = false;
    if (it.category === "CELL") {
      bodyHtml = `<p class="hint">Thông số cell để tính điện áp & dung lượng pack trong dự toán.</p>
        <div class="grid-3">
          <label class="field"><span>Điện áp (V)</span><input data-name="v" type="number" step="0.1" value="${it.v || 0}"/></label>
          <label class="field"><span>Dung lượng (Ah)</span><input data-name="ah" type="number" step="0.1" value="${it.ah || 0}"/></label>
          <label class="field"><span>Hóa học</span><input data-name="chem" value="${esc(it.chem)}"/></label>
        </div>`;
    } else if (it.category === "BMS" || it.category === "CASE") {
      bodyHtml = `<p class="hint"><b>${esc(categoryLabel(it.category))}</b> được <b>chọn trực tiếp trong tab Dự toán</b> (số lượng mặc định 1/pack), không cần cài định mức tự động ở đây.</p>`;
      hideOk = true;
    } else {
      bodyHtml = `<p class="hint">Định mức để <b>tự tính số lượng trong BOM</b>:<br><b>SL = Cố định + (Theo cell × tổng cell) + (Theo S × số nối tiếp)</b>. Đặt 0 hết nếu không đưa vào BOM.</p>
        <div class="grid-3">
          <label class="field"><span>Cố định / pack</span><input data-name="qtyFixed" type="number" step="any" value="${it.qtyFixed || 0}"/></label>
          <label class="field"><span>Theo cell</span><input data-name="qtyPerCell" type="number" step="any" value="${it.qtyPerCell || 0}"/></label>
          <label class="field"><span>Theo S</span><input data-name="qtyPerS" type="number" step="any" value="${it.qtyPerS || 0}"/></label>
        </div>`;
    }
    modal({
      title: `Cài đặt định mức — ${it.code}`, bodyHtml, hideOk,
      onSubmit: (v) => {
        if (it.category === "CELL") { it.v = +v.v || 0; it.ah = +v.ah || 0; it.chem = (v.chem || "").trim(); }
        else if (it.category !== "BMS" && it.category !== "CASE") { it.qtyFixed = +v.qtyFixed || 0; it.qtyPerCell = +v.qtyPerCell || 0; it.qtyPerS = +v.qtyPerS || 0; }
        Store.save(); render(); syncEstimator(); toast("Đã lưu cài đặt");
      },
    });
  }

  /* ---------- CRUD ---------- */
  function form(it) {
    it = it || { category: "PHU", unit: "cái" };
    const catOpts = CATEGORIES.map((c) => `<option value="${c.key}" ${it.category === c.key ? "selected" : ""}>${c.label}</option>`).join("");
    return `
      <div class="grid-2">
        <label class="field"><span>Mã mặt hàng *</span><input data-name="code" id="mf-code" value="${esc(it.code)}" placeholder="VD: BMS-16S-400A"/></label>
        <label class="field"><span>Phân loại</span><select data-name="category" id="mf-cat">${catOpts}</select></label>
      </div>
      <label class="field"><span>Tên mặt hàng [Thông số]</span><input data-name="name" value="${esc(it.name)}"/></label>
      <div class="grid-2">
        <label class="field"><span>Mã nhà sản xuất</span><input data-name="mfrCode" value="${esc(it.mfrCode)}"/></label>
        <label class="field"><span>Hãng sản xuất</span><input data-name="brand" value="${esc(it.brand)}"/></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>ĐVT</span><input data-name="unit" value="${esc(it.unit || "cái")}"/></label>
        <label class="field"><span>Đơn giá (đ)</span><input data-name="price" type="number" step="100" value="${it.price || 0}"/></label>
        <label class="field"><span>Tồn tối thiểu</span><input data-name="minStock" type="number" step="1" value="${it.minStock || 0}"/></label>
      </div>
      <label class="field"><span>Thời gian đặt hàng</span><input data-name="leadTime" value="${esc(it.leadTime)}" placeholder="VD: 15 ngày"/></label>
      <details class="adv"><summary>Thông số nâng cao (cho dự toán)</summary>
        <p class="hint">• Cell: điện áp/dung lượng để tính V·Ah. • Vật tư phụ: định mức tự tính (SL = Cố định + Theo cell×tổng cell + Theo S×số nối tiếp).</p>
        <div class="grid-3">
          <label class="field"><span>Điện áp cell (V)</span><input data-name="v" type="number" step="0.1" value="${it.v || 0}"/></label>
          <label class="field"><span>Dung lượng (Ah)</span><input data-name="ah" type="number" step="0.1" value="${it.ah || 0}"/></label>
          <label class="field"><span>Hóa học</span><input data-name="chem" value="${esc(it.chem)}"/></label>
        </div>
        <div class="grid-3">
          <label class="field"><span>Định mức cố định</span><input data-name="qtyFixed" type="number" step="any" value="${it.qtyFixed || 0}"/></label>
          <label class="field"><span>Định mức theo cell</span><input data-name="qtyPerCell" type="number" step="any" value="${it.qtyPerCell || 0}"/></label>
          <label class="field"><span>Định mức theo S</span><input data-name="qtyPerS" type="number" step="any" value="${it.qtyPerS || 0}"/></label>
        </div>
      </details>`;
  }

  function wireCatSuggest() {
    const code = $("mf-code"), cat = $("mf-cat");
    if (code && cat) code.oninput = () => { cat.value = categoryOf(code.value); };
  }

  function clean(v) {
    return {
      code: (v.code || "").trim(), category: v.category || categoryOf(v.code), name: (v.name || "").trim(),
      mfrCode: (v.mfrCode || "").trim(), brand: (v.brand || "").trim(), unit: (v.unit || "cái").trim(),
      price: +v.price || 0, minStock: +v.minStock || 0, leadTime: (v.leadTime || "").trim(),
      v: +v.v || 0, ah: +v.ah || 0, chem: (v.chem || "").trim(),
      qtyFixed: +v.qtyFixed || 0, qtyPerCell: +v.qtyPerCell || 0, qtyPerS: +v.qtyPerS || 0,
    };
  }

  function add() {
    modal({ title: "Thêm mặt hàng", bodyHtml: form(),
      onSubmit: (v) => {
        if (!v.code.trim()) return toast("Nhập mã mặt hàng", "err"), false;
        S.items.push({ id: Store.uid("it-"), ...clean(v) });
        Store.save(); render(); syncEstimator(); toast("Đã thêm mặt hàng");
      } });
    wireCatSuggest();
  }
  function edit(id) {
    const it = Store.findItem(id);
    if (!it) return;
    modal({ title: "Sửa mặt hàng", bodyHtml: form(it),
      onSubmit: (v) => {
        if (!v.code.trim()) return toast("Nhập mã mặt hàng", "err"), false;
        if (+v.price !== +it.price) Store.logPrice(categoryLabel(it.category), it.code + " · " + it.name, "Đơn giá", it.price, +v.price);
        Object.assign(it, clean(v));
        Store.save(); render(); syncEstimator(); toast("Đã lưu");
      } });
    wireCatSuggest();
  }
  function del(id) {
    const it = Store.findItem(id);
    if (!it) return;
    if (!confirmBox(`Xóa mặt hàng "${it.code}"?`)) return;
    S.items = S.items.filter((x) => x.id !== id);
    Store.save(); render(); syncEstimator();
  }

  /* ================= NHẬP / XUẤT EXCEL ================= */
  const HEADERS = ["Phân loại", "Mã mặt hàng", "Tên mặt hàng [Thông số]", "Mã nhà sản xuất", "Hãng Sản xuất", "Đơn giá", "Thời gian đặt hàng", "Tồn kho tối thiểu"];
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
    S.items.slice().sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code))
      .forEach((it) => aoa.push([categoryLabel(it.category), it.code, it.name, it.mfrCode, it.brand, it.price, it.leadTime, it.minStock || 0]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "BangGia");
    XLSX.writeFile(wb, "bang-gia-dau-vao.xlsx");
    toast("Đã xuất bảng giá ra Excel");
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
          const code = String(pick(r, ["mamathang", "macode", "ma", "code"])).trim();
          if (!code) return;
          const rec = {
            code,
            name: String(pick(r, ["tenmathangthongso", "tenmathang", "ten", "name"])).trim(),
            mfrCode: String(pick(r, ["manhasanxuat", "mansx", "mfrcode"])).trim(),
            brand: String(pick(r, ["hangsanxuat", "hangsx", "brand", "hang"])).trim(),
            price: toNum(pick(r, ["dongia", "gia", "price"])),
            leadTime: String(pick(r, ["thoigiandathang", "tgdathang", "leadtime"])).trim(),
            minStock: toNum(pick(r, ["tonkhotoithieu", "tontoithieu", "minstock", "tonkho"])),
          };
          const ex = Store.findItemByCode(code);
          if (ex) upd.push({ ex, rec }); else add.push(rec);
        });
      });
      const total = upd.length + add.length;
      if (!total) return toast("Không tìm thấy dữ liệu (cần cột 'Mã mặt hàng')", "err");
      modal({
        title: "Xác nhận nhập bảng giá", okText: "Áp dụng",
        bodyHtml: `<div class="import-summary"><div>Cập nhật: <b>${upd.length}</b> mặt hàng</div><div>Thêm mới: <b>${add.length}</b> mặt hàng</div></div>
          <p class="hint" style="margin-top:8px">${[...upd.slice(0, 4).map((x) => "• Cập nhật: " + x.rec.code), ...add.slice(0, 4).map((x) => "• Thêm: " + x.code)].join("<br>")}${total > 8 ? "<br>…" : ""}</p>`,
        onSubmit: () => {
          upd.forEach(({ ex, rec }) => {
            if (rec.price && +rec.price !== +ex.price) Store.logPrice(categoryLabel(ex.category), ex.code + " · " + ex.name, "Đơn giá", ex.price, rec.price);
            ex.name = rec.name || ex.name; ex.mfrCode = rec.mfrCode; ex.brand = rec.brand;
            if (rec.price) ex.price = rec.price; ex.leadTime = rec.leadTime; ex.minStock = rec.minStock;
          });
          add.forEach((rec) => S.items.push({ id: Store.uid("it-"), category: categoryOf(rec.code), unit: "cái", v: 0, ah: 0, chem: "", qtyFixed: 0, qtyPerCell: 0, qtyPerS: 0, ...rec }));
          Store.save(); render(); syncEstimator(); toast(`Đã nhập ${total} mặt hàng`);
        },
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function init() {
    $("pl-add-item").onclick = add;
    $("pl-search").oninput = (e) => { search = e.target.value; renderItems(); };
    $("pl-export-excel").onclick = exportExcel;
    $("pl-import-file").onchange = (e) => { const f = e.target.files[0]; if (f) importExcel(f); e.target.value = ""; };
    $("pl-clear-history").onclick = () => {
      if (!(S.priceHistory || []).length) return;
      if (confirmBox("Xóa toàn bộ lịch sử điều chỉnh giá?")) { S.priceHistory = []; Store.save(); renderHistory(); }
    };
  }

  return { init, render };
})();
