/* =========================================================================
 * quotes.js — Tạo, quản lý và in báo giá cho khách hàng
 * ========================================================================= */
const Quotes = (function () {
  "use strict";
  const { $, fmt, esc, dmy, today, modal, toast, confirmBox } = UI;
  const S = Store.state;
  let filter = "";
  let editing = null; // báo giá đang soạn (bản nháp trong bộ nhớ)

  /* ---------- Danh sách ---------- */
  function render() {
    showList();
    renderList();
  }

  function renderList() {
    const body = $("quotes-body");
    body.innerHTML = "";
    const f = filter.trim().toLowerCase();
    const rows = S.quotes
      .filter((q) => {
        const cust = Store.findCustomer(q.customerId);
        const name = cust ? cust.name + " " + cust.company : "";
        return !f || (q.code + " " + name).toLowerCase().includes(f);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty">Chưa có báo giá. Bấm “+ Báo giá mới” hoặc tạo từ tab Dự toán.</td></tr>`;
      return;
    }
    rows.forEach((q) => {
      const cust = Store.findCustomer(q.customerId);
      const total = totalOf(q).grand;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${esc(q.code)}</b></td>
        <td>${dmy(q.date)}</td>
        <td>${cust ? esc(cust.name) + (cust.company ? " · " + esc(cust.company) : "") : "<i>—</i>"}</td>
        <td class="col-num">${fmt(total)} đ</td>
        <td>${statusTag(q.status)}</td>
        <td class="col-act">
          <button class="btn-icon" data-open="${q.id}" title="Mở">✎</button>
          <button class="btn-del" data-del="${q.id}" title="Xóa">✕</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => open(b.getAttribute("data-open"))));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(b.getAttribute("data-del"))));
  }

  function statusTag(s) {
    const map = { draft: ["Nháp", "gray"], sent: ["Đã gửi", "blue"], accepted: ["Đã chốt", "green"], rejected: ["Từ chối", "red"] };
    const [label, color] = map[s] || map.draft;
    return `<span class="tag tag-${color}">${label}</span>`;
  }

  function totalTableHtml(t, q) {
    return `<table class="q-total-table">
      <tr><td>Cộng tiền hàng</td><td class="col-num">${fmt(t.sub)} đ</td></tr>
      ${q.discountPct ? `<tr><td>Chiết khấu (${q.discountPct}%)</td><td class="col-num">-${fmt(t.discount)} đ</td></tr>` : ""}
      <tr><td>Thuế VAT (${q.vatPct}%)</td><td class="col-num">${fmt(t.vat)} đ</td></tr>
      <tr class="grand"><td>TỔNG CỘNG THANH TOÁN</td><td class="col-num">${fmt(t.grand)} đ</td></tr>
    </table>`;
  }

  /* ---------- Tính tổng (bỏ qua dòng phân nhóm) ---------- */
  function totalOf(q) {
    const sub = (q.items || []).reduce((s, it) => s + (it.kind === "group" ? 0 : (it.qty || 0) * (it.price || 0)), 0);
    const discount = sub * ((q.discountPct || 0) / 100);
    const afterDisc = sub - discount;
    const vat = afterDisc * ((q.vatPct || 0) / 100);
    const grand = afterDisc + vat;
    return { sub, discount, afterDisc, vat, grand };
  }

  /* ---------- Tạo mới ---------- */
  function blank() {
    return {
      id: Store.uid("q-"), code: null, customerId: S.customers[0] ? S.customers[0].id : "",
      date: today(), validDays: 15, items: [], discountPct: 0, vatPct: 8,
      note: "Giá trên đã bao gồm bảo hành. Báo giá có hiệu lực trong thời hạn ghi trên.",
      preparedBy: "", preparedPhone: S.company.phone || "",
      status: "draft", createdAt: Date.now(),
    };
  }

  function newBlank() {
    editing = blank();
    editing.items.push({ code: "", name: "", qty: 1, price: 0, img: "", kind: "material" });
    openEditor();
  }

  function newFromEstimator(line) {
    editing = blank();
    editing.vatPct = line.vatPct || 8;
    editing.items.push({ code: line.productCode || "", name: line.productName, qty: line.qty, price: line.unitBeforeVat, img: "", kind: "material" });
    App.go("quotes");
    openEditor();
    toast("Đã tạo báo giá từ dự toán");
  }

  function open(id) {
    const q = Store.findQuote(id);
    if (!q) return;
    editing = Store.clone(q);
    App.go("quotes");
    openEditor();
  }

  /* ---------- Trình soạn / xem báo giá ---------- */
  function showList() {
    $("quotes-list-panel").hidden = false;
    $("quote-editor").hidden = true;
  }
  function openEditor() {
    $("quotes-list-panel").hidden = true;
    $("quote-editor").hidden = false;
    renderEditor();
  }

  function renderEditor() {
    const q = editing;
    const co = S.company;
    const t = totalOf(q);
    const custOpts = S.customers
      .map((c) => `<option value="${c.id}" ${c.id === q.customerId ? "selected" : ""}>${esc(c.name)}${c.company ? " · " + esc(c.company) : ""}</option>`)
      .join("");
    const cust = Store.findCustomer(q.customerId);

    $("qe-title").textContent = q.code ? "Báo giá " + q.code : "Báo giá mới";

    let stt = 0;
    let itemsRows = q.items.map((it, i) => {
      if (it.kind === "group") {
        return `<tr class="q-group">
          <td></td>
          <td colspan="5"><input class="cell-in q-group-in" data-qi="${i}" data-f="name" value="${esc(it.name)}" placeholder="Tên nhóm (VD: PIN XE MÁY ĐIỆN)"/></td>
          <td class="col-act no-print"><button class="btn-del" data-qdel="${i}">✕</button></td>
        </tr>`;
      }
      stt++;
      const img = it.img
        ? `<img class="q-line-img" src="${it.img}"/><button class="q-img-x no-print" data-qimgdel="${i}" title="Xóa ảnh">✕</button>`
        : `<label class="q-img-add no-print">＋ ảnh<input type="file" accept="image/*" data-qimg="${i}" hidden/></label>`;
      return `<tr>
        <td class="col-idx">${stt}</td>
        <td><input class="cell-in" data-qi="${i}" data-f="code" value="${esc(it.code || "")}" placeholder="Mã SP"/></td>
        <td><textarea class="cell-in q-spec" rows="2" data-qi="${i}" data-f="name" placeholder="Thông số kỹ thuật">${esc(it.name)}</textarea></td>
        <td class="q-imgcell">${img}</td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="any" data-qi="${i}" data-f="qty" value="${it.qty}"/></td>
        <td class="col-num"><input class="cell-in num" type="number" min="0" step="100" data-qi="${i}" data-f="price" value="${it.price}"/></td>
        <td class="col-num" data-linetotal="${i}">${fmt((it.qty || 0) * (it.price || 0))}</td>
        <td class="col-act no-print"><button class="btn-del" data-qdel="${i}">✕</button></td>
      </tr>`;
    }).join("");

    $("quote-doc").innerHTML = `
      <div class="q-brandhead">
        ${co.logo ? `<img class="q-logo" src="${co.logo}" alt="logo"/>` : ""}
        <div class="q-brandinfo">
          <div class="q-co-name">${esc(co.name)}</div>
          ${co.address ? `<div>ĐỊA CHỈ: ${esc(co.address)}</div>` : ""}
          <div>${[co.phone && "Tel: " + esc(co.phone), co.taxCode && "MST: " + esc(co.taxCode)].filter(Boolean).join(" · ")}</div>
          <div>${[co.website && "Website: " + esc(co.website), co.email && esc(co.email)].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div class="q-titleband">
        <h1>BẢNG BÁO GIÁ <span>/ QUOTATION</span></h1>
        <div class="q-code">Số: ${esc(q.code || "(chưa lưu)")} · Ngày ${dmy(q.date)}</div>
      </div>

      <div class="q-meta no-print">
        <label class="field"><span>Khách hàng</span>
          <select data-q="customerId">${custOpts || '<option value="">— chưa có khách hàng —</option>'}</select>
        </label>
        <label class="field"><span>Ngày báo giá</span><input type="date" data-q="date" value="${q.date}"/></label>
        <label class="field"><span>Hiệu lực (ngày)</span><input type="number" min="0" data-q="validDays" value="${q.validDays}"/></label>
        <label class="field"><span>Trạng thái</span>
          <select data-q="status">
            <option value="draft" ${q.status==="draft"?"selected":""}>Nháp</option>
            <option value="sent" ${q.status==="sent"?"selected":""}>Đã gửi</option>
            <option value="accepted" ${q.status==="accepted"?"selected":""}>Đã chốt</option>
            <option value="rejected" ${q.status==="rejected"?"selected":""}>Từ chối</option>
          </select>
        </label>
        <label class="field"><span>Người báo giá</span><input data-q="preparedBy" value="${esc(q.preparedBy || "")}" placeholder="Họ tên người lập"/></label>
        <label class="field"><span>SĐT người báo giá</span><input data-q="preparedPhone" value="${esc(q.preparedPhone || "")}" placeholder="Số điện thoại"/></label>
      </div>

      <div class="q-cust">
        <b>Kính gửi:</b> ${cust ? esc(cust.name) : "<i>(chọn khách hàng)</i>"}
        ${cust && cust.company ? " — " + esc(cust.company) : ""}<br>
        ${cust && cust.address ? esc(cust.address) + "<br>" : ""}
        ${cust ? [cust.phone && "ĐT: " + esc(cust.phone), cust.taxCode && "MST: " + esc(cust.taxCode)].filter(Boolean).join(" · ") : ""}
        <div class="q-date-line">Ngày: ${dmy(q.date)} · Hiệu lực: ${q.validDays} ngày</div>
      </div>

      <div class="table-scroll">
        <table class="bom q-items">
          <thead><tr>
            <th class="col-idx">STT</th><th>Mã sản phẩm</th><th>Thông số kỹ thuật</th><th class="q-imgcol">Hình ảnh</th>
            <th class="col-num">SL</th><th class="col-num">Đơn giá</th><th class="col-num">Thành tiền</th>
            <th class="col-act no-print"></th>
          </tr></thead>
          <tbody>${itemsRows || `<tr><td colspan="8" class="empty">Chưa có dòng nào</td></tr>`}</tbody>
        </table>
      </div>
      <div class="no-print" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap">
        <button class="btn btn-sm" id="qe-add-item">+ Thêm dòng</button>
        <button class="btn btn-sm btn-ghost" id="qe-add-group">+ Thêm nhóm</button>
        <button class="btn btn-sm btn-ghost" id="qe-add-from-pl">+ Từ bảng giá</button>
      </div>

      <div class="q-summary">
        <div class="q-controls no-print">
          <label class="field"><span>Chiết khấu (%)</span><input type="number" min="0" step="1" data-q="discountPct" value="${q.discountPct}"/></label>
          <label class="field"><span>VAT (%)</span><input type="number" min="0" step="1" data-q="vatPct" value="${q.vatPct}"/></label>
        </div>
        <div id="q-total-wrap">${totalTableHtml(t, q)}</div>
      </div>

      <div class="q-note">
        <label class="field no-print"><span>Ghi chú / điều khoản</span><textarea data-q="note" rows="2">${esc(q.note)}</textarea></label>
        <div class="only-print q-note-print">${esc(q.note)}</div>
      </div>
      ${co.bank ? `<div class="q-bank">Thông tin thanh toán: ${esc(co.bank)}</div>` : ""}
      <div class="q-sign">
        <div><b>KHÁCH HÀNG</b><br><small>(Ký, ghi rõ họ tên)</small></div>
        <div>
          <b>NGƯỜI BÁO GIÁ</b>
          ${q.preparedBy ? `<div class="q-prep-name">${esc(q.preparedBy)}</div>` : ""}
          ${q.preparedPhone ? `<div class="q-prep-phone">ĐT: ${esc(q.preparedPhone)}</div>` : ""}
          <small>(Ký, ghi rõ họ tên)</small>
        </div>
      </div>`;

    bindEditor();
  }

  function bindEditor() {
    // sửa các trường báo giá
    $("quote-doc").querySelectorAll("[data-q]").forEach((el) => {
      el.oninput = () => {
        const f = el.getAttribute("data-q");
        editing[f] = el.type === "number" ? parseFloat(el.value) || 0 : el.value;
        if (["customerId", "date", "validDays", "discountPct", "vatPct"].includes(f)) renderEditor();
      };
      if (el.tagName === "SELECT") el.onchange = () => { editing[el.getAttribute("data-q")] = el.value; renderEditor(); };
      else el.onchange = () => renderEditor(); // cập nhật bản in khi rời ô (người báo giá, ghi chú...)
    });
    // sửa dòng hàng: text (code/name) cập nhật êm; số (qty/price) tính lại khi rời ô
    $("quote-doc").querySelectorAll("[data-qi]").forEach((el) => {
      const i = +el.getAttribute("data-qi"), f = el.getAttribute("data-f");
      const isNum = f === "qty" || f === "price";
      el.oninput = () => { editing.items[i][f] = isNum ? parseFloat(el.value) || 0 : el.value; if (isNum) updateLineTotals(); };
    });
    // tải ảnh cho từng dòng
    $("quote-doc").querySelectorAll("[data-qimg]").forEach((el) => {
      el.onchange = (e) => {
        const i = +el.getAttribute("data-qimg"), file = e.target.files[0];
        if (!file) return;
        if (file.size > 600 * 1024) return toast("Ảnh nên < 600KB", "err");
        const r = new FileReader();
        r.onload = () => { editing.items[i].img = r.result; renderEditor(); };
        r.readAsDataURL(file);
      };
    });
    $("quote-doc").querySelectorAll("[data-qimgdel]").forEach((el) => {
      el.onclick = () => { editing.items[+el.getAttribute("data-qimgdel")].img = ""; renderEditor(); };
    });
    $("quote-doc").querySelectorAll("[data-qdel]").forEach((el) => {
      el.onclick = () => { editing.items.splice(+el.getAttribute("data-qdel"), 1); renderEditor(); };
    });
    const add = $("qe-add-item");
    if (add) add.onclick = () => { editing.items.push({ code: "", name: "", qty: 1, price: 0, img: "", kind: "material" }); renderEditor(); };
    const addGroup = $("qe-add-group");
    if (addGroup) addGroup.onclick = () => { editing.items.push({ name: "NHÓM SẢN PHẨM", kind: "group" }); renderEditor(); };
    const addPl = $("qe-add-from-pl");
    if (addPl) addPl.onclick = pickFromPriceList;
  }

  /* Cập nhật thành tiền từng dòng + tổng, không render lại toàn bộ (giữ con trỏ) */
  function updateLineTotals() {
    const t = totalOf(editing);
    editing.items.forEach((it, i) => {
      if (it.kind === "group") return;
      const td = $("quote-doc").querySelector(`[data-linetotal="${i}"]`);
      if (td) td.textContent = fmt((it.qty || 0) * (it.price || 0));
    });
    const wrap = document.getElementById("q-total-wrap");
    if (wrap) wrap.innerHTML = totalTableHtml(t, editing);
  }

  /* Thêm dòng từ bảng giá đầu vào */
  function pickFromPriceList() {
    const opts = S.items
      .slice()
      .sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code))
      .map((it) => `<option value="${it.id}">[${esc(categoryLabel(it.category))}] ${esc(it.code)} — ${esc(it.name)} · ${fmt(it.price)}đ</option>`)
      .join("");
    modal({
      title: "Chọn từ bảng giá",
      bodyHtml: `<label class="field"><span>Mặt hàng</span><select data-name="pick">${opts}</select></label>
                 <label class="field"><span>Số lượng</span><input data-name="qty" type="number" min="0" step="any" value="1"/></label>`,
      onSubmit: (v) => {
        const it = Store.findItem(v.pick);
        if (!it) return;
        editing.items.push({ code: it.code, name: it.name, qty: +v.qty || 1, price: it.price, img: "", kind: "material" });
        renderEditor();
      },
    });
  }

  /* ---------- Lưu / xóa ---------- */
  function saveEditing() {
    if (!editing.customerId) return toast("Chọn khách hàng trước khi lưu", "err");
    if (!editing.items.length || editing.items.every((i) => !i.name.trim()))
      return toast("Cần ít nhất 1 dòng hàng hóa", "err");
    if (!editing.code) editing.code = Store.nextQuoteCode();
    const idx = S.quotes.findIndex((q) => q.id === editing.id);
    if (idx >= 0) S.quotes[idx] = Store.clone(editing);
    else S.quotes.push(Store.clone(editing));
    Store.save();
    toast("Đã lưu báo giá " + editing.code);
    renderEditor();  // ở lại trình soạn để in ngay
    renderList();    // cập nhật danh sách ngầm
  }

  function del(id) {
    if (!confirmBox("Xóa báo giá này?")) return;
    S.quotes = S.quotes.filter((q) => q.id !== id);
    Store.save(); render();
  }

  /* ---------- Xuất CSV (mở được bằng Excel) ---------- */
  function exportCSV() {
    const q = editing;
    if (!q) return;
    const cust = Store.findCustomer(q.customerId);
    const t = totalOf(q);
    const co = S.company;
    const esc = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const rows = [];
    rows.push([co.name]);
    if (co.address) rows.push([co.address]);
    rows.push([[co.phone && "Tel: " + co.phone, co.website && "Website: " + co.website].filter(Boolean).join("  ")]);
    rows.push(["BÁO GIÁ / QUOTATION", q.code || "(chưa lưu)"]);
    rows.push(["Khách hàng", cust ? cust.name + (cust.company ? " - " + cust.company : "") : ""]);
    rows.push(["Ngày", dmy(q.date), "Hiệu lực (ngày)", q.validDays]);
    rows.push(["Người báo giá", q.preparedBy || "", "SĐT", q.preparedPhone || ""]);
    rows.push([]);
    rows.push(["STT", "Mã sản phẩm", "Thông số kỹ thuật", "SL", "Đơn giá", "Thành tiền"]);
    let stt = 0;
    q.items.forEach((it) => {
      if (it.kind === "group") { rows.push(["", (it.name || "").toUpperCase()]); return; }
      stt++;
      rows.push([stt, it.code || "", it.name, it.qty, it.price, (it.qty || 0) * (it.price || 0)]);
    });
    rows.push([]);
    rows.push(["", "", "", "", "Cộng tiền hàng", t.sub]);
    if (q.discountPct) rows.push(["", "", "", "", `Chiết khấu ${q.discountPct}%`, -t.discount]);
    rows.push(["", "", "", "", `VAT ${q.vatPct}%`, t.vat]);
    rows.push(["", "", "", "", "TỔNG CỘNG", t.grand]);

    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (q.code || "bao-gia") + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Đã xuất CSV (mở bằng Excel)");
  }

  function init() {
    $("quote-new").onclick = newBlank;
    $("quote-search").oninput = (e) => { filter = e.target.value; render(); };
    $("qe-back").onclick = () => { showList(); render(); };
    $("qe-save").onclick = saveEditing;
    $("qe-csv").onclick = exportCSV;
    $("qe-print").onclick = () => window.print();
  }

  return { init, render, newBlank, newFromEstimator };
})();
