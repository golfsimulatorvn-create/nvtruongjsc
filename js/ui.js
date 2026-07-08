/* =========================================================================
 * ui.js — Tiện ích UI dùng chung: format, modal, toast, escape
 * ========================================================================= */
const UI = (function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (sel, root) => (root || document).querySelector(sel);

  const fmt = (n) => Math.round(n || 0).toLocaleString("vi-VN");
  const fmt2 = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString("vi-VN");
  const today = () => new Date().toISOString().slice(0, 10);
  const dmy = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  /* ---- Toast ---- */
  let toastT;
  function toast(msg, kind) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      t.className = "toast";
      t.hidden = true;
    }, 2400);
  }

  /* ---- Modal ---- */
  let onOk = null;
  function modal({ title, bodyHtml, okText, onSubmit, hideOk }) {
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = bodyHtml;
    $("modal-ok").textContent = okText || "Lưu";
    $("modal-ok").style.display = hideOk ? "none" : "";
    onOk = onSubmit;
    $("modal").hidden = false;
    const first = el("input,select,textarea", $("modal-body"));
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() {
    $("modal").hidden = true;
    onOk = null;
  }
  function modalValues() {
    const out = {};
    $("modal-body")
      .querySelectorAll("[data-name]")
      .forEach((i) => (out[i.getAttribute("data-name")] = i.value));
    return out;
  }

  function initModal() {
    $("modal-close").onclick = closeModal;
    $("modal-cancel").onclick = closeModal;
    $("modal-ok").onclick = () => {
      if (onOk) {
        const ok = onOk(modalValues());
        if (ok !== false) closeModal();
      } else closeModal();
    };
    $("modal").addEventListener("click", (e) => {
      if (e.target === $("modal")) closeModal();
    });
  }

  function confirmBox(msg) {
    return window.confirm(msg);
  }

  return { $, el, fmt, fmt2, today, dmy, esc, toast, modal, closeModal, modalValues, initModal, confirmBox };
})();
