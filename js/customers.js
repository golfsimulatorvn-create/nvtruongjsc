/* =========================================================================
 * customers.js — Quản lý khách hàng (CRUD + tìm kiếm)
 * ========================================================================= */
const Customers = (function () {
  "use strict";
  const { $, esc, modal, toast, confirmBox } = UI;
  const S = Store.state;
  let filter = "";

  function list() {
    const f = filter.trim().toLowerCase();
    return S.customers.filter((c) =>
      !f || [c.name, c.company, c.phone, c.email].some((x) => (x || "").toLowerCase().includes(f))
    );
  }

  function render() {
    const body = $("cust-body");
    body.innerHTML = "";
    const rows = list();
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty">Chưa có khách hàng. Bấm “+ Thêm khách hàng”.</td></tr>`;
      return;
    }
    rows.forEach((c) => {
      const count = S.quotes.filter((q) => q.customerId === c.id).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${esc(c.name)}</b>${c.taxCode ? `<br><small>MST: ${esc(c.taxCode)}</small>` : ""}</td>
        <td>${esc(c.company)}</td>
        <td>${esc(c.phone)}</td>
        <td>${esc(c.email)}</td>
        <td class="col-num">${count}</td>
        <td class="col-act">
          <button class="btn-icon" data-edit="${c.id}" title="Sửa">✎</button>
          <button class="btn-del" data-del="${c.id}" title="Xóa">✕</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(b.getAttribute("data-edit"))));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(b.getAttribute("data-del"))));
  }

  function form(c) {
    c = c || {};
    return `
      <div class="grid-2">
        <label class="field"><span>Tên người liên hệ *</span><input data-name="name" value="${esc(c.name)}"/></label>
        <label class="field"><span>Công ty</span><input data-name="company" value="${esc(c.company)}"/></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Điện thoại</span><input data-name="phone" value="${esc(c.phone)}"/></label>
        <label class="field"><span>Email</span><input data-name="email" value="${esc(c.email)}"/></label>
      </div>
      <label class="field"><span>Địa chỉ</span><input data-name="address" value="${esc(c.address)}"/></label>
      <div class="grid-2">
        <label class="field"><span>Mã số thuế</span><input data-name="taxCode" value="${esc(c.taxCode)}"/></label>
        <label class="field"><span>Ghi chú</span><input data-name="note" value="${esc(c.note)}"/></label>
      </div>`;
  }

  function add() {
    modal({
      title: "Thêm khách hàng", bodyHtml: form(),
      onSubmit: (v) => {
        if (!v.name.trim()) return toast("Nhập tên khách hàng", "err"), false;
        S.customers.push({ id: Store.uid("kh-"), ...clean(v), createdAt: Date.now() });
        Store.save(); render(); toast("Đã thêm khách hàng");
      },
    });
  }

  function edit(id) {
    const c = Store.findCustomer(id);
    if (!c) return;
    modal({
      title: "Sửa khách hàng", bodyHtml: form(c),
      onSubmit: (v) => {
        if (!v.name.trim()) return toast("Nhập tên khách hàng", "err"), false;
        Object.assign(c, clean(v));
        Store.save(); render(); toast("Đã lưu");
      },
    });
  }

  function del(id) {
    const count = S.quotes.filter((q) => q.customerId === id).length;
    const msg = count ? `Khách hàng này có ${count} báo giá. Vẫn xóa?` : "Xóa khách hàng này?";
    if (!confirmBox(msg)) return;
    S.customers = S.customers.filter((c) => c.id !== id);
    Store.save(); render();
  }

  function clean(v) {
    return {
      name: v.name.trim(), company: (v.company || "").trim(), phone: (v.phone || "").trim(),
      email: (v.email || "").trim(), address: (v.address || "").trim(),
      taxCode: (v.taxCode || "").trim(), note: (v.note || "").trim(),
    };
  }

  function init() {
    $("cust-add").onclick = add;
    $("cust-search").oninput = (e) => { filter = e.target.value; render(); };
  }

  return { init, render };
})();
