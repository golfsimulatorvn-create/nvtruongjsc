/* =========================================================================
 * app.js — Router chuyển tab + cấu hình công ty + sao lưu dữ liệu
 * ========================================================================= */
const App = (function () {
  "use strict";
  const { $, toast, confirmBox } = UI;
  const S = Store.state;

  const RENDER = {
    estimator: () => Estimator.render(),
    pricelist: () => PriceList.render(),
    customers: () => Customers.render(),
    quotes: () => Quotes.render(),
    settings: () => {},
  };

  function go(view) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-" + view));
    if (RENDER[view]) RENDER[view]();
    window.scrollTo(0, 0);
    location.hash = view;
  }

  /* ---- Cấu hình công ty ---- */
  function bindSettings() {
    const map = { "co-name": "name", "co-tax": "taxCode", "co-addr": "address", "co-phone": "phone", "co-email": "email", "co-web": "website", "co-bank": "bank" };
    Object.entries(map).forEach(([id, key]) => {
      $(id).value = S.company[key] || "";
      $(id).oninput = () => { S.company[key] = $(id).value; Store.save(); };
    });

    // Logo công ty
    function renderLogo() {
      const box = $("co-logo-preview");
      if (S.company.logo) box.innerHTML = `<img src="${S.company.logo}" alt="logo"/>`;
      else box.textContent = "Chưa có logo";
    }
    renderLogo();
    $("co-logo-file").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 400 * 1024) return toast("Logo nên < 400KB", "err");
      const reader = new FileReader();
      reader.onload = () => { S.company.logo = reader.result; Store.save(); renderLogo(); toast("Đã cập nhật logo"); };
      reader.readAsDataURL(file);
    };
    $("co-logo-clear").onclick = () => { S.company.logo = ""; Store.save(); renderLogo(); };

    $("data-export").onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bao-gia-pin-backup-" + UI.today() + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Đã xuất file sao lưu");
    };
    $("data-import-file").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importJSON(reader.result);
          toast("Đã nhập dữ liệu");
          setTimeout(() => location.reload(), 600);
        } catch (err) { toast("File không hợp lệ", "err"); }
      };
      reader.readAsText(file);
    };
    $("data-reset").onclick = () => {
      if (confirmBox("Xóa TOÀN BỘ dữ liệu (bảng giá, khách hàng, báo giá) và đặt lại mặc định?")) Store.resetAll();
    };
  }

  function init() {
    Store.load();
    UI.initModal();
    Estimator.init();
    PriceList.init();
    Customers.init();
    Quotes.init();
    bindSettings();

    document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => go(t.dataset.view)));
    const start = (location.hash || "").replace("#", "");
    go(RENDER[start] ? start : "estimator");
  }

  document.addEventListener("DOMContentLoaded", init);
  return { go, init };
})();
