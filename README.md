# 🔋 Dự toán & Báo giá Pin — Battery Estimator & Quotation

Website tĩnh **quản lý bảng giá vật tư · khách hàng · báo giá** và **lập giá dự toán** cho các loại **Pin** (LiFePO4, Li-ion) từ **giá vật tư đầu vào**, kèm **BOM chuẩn** cho từng cấu hình pack. Chạy hoàn toàn trên trình duyệt, không cần backend — triển khai miễn phí bằng **GitHub Pages**. Dữ liệu lưu cục bộ (localStorage) và có thể **xuất/nhập file sao lưu**.

Ứng dụng gồm 5 tab: **Dự toán · Bảng giá · Khách hàng · Báo giá · Cấu hình**.

## ✨ Tính năng

**Dự toán & BOM**
- **Mẫu pack chuẩn** dựng sẵn: LiFePO4 12V/24V/48V, Li-ion 36V/48V/60V, hoặc tùy chỉnh S/P tự do.
- **BOM tự động scale** theo số cell (kẽm hàn, đế giữ cell, BMS, vỏ hộp, dây, giắc, cầu chì...).
- **Tính thông số pack**: cấu hình `S×P`, điện áp (V), dung lượng (Ah), năng lượng (kWh).
- **Bảng dự toán giá thành**: vật tư → hao hụt → nhân công → COGS → quản lý → lợi nhuận → VAT → **giá bán**.
- Một cú nhấp **“Tạo báo giá từ dự toán này”**.

**Quản lý bảng giá**
- **Thư viện cell** (LiFePO4 32700/32650/26650, Li-ion 21700/18650) và **vật tư phụ** — thêm/sửa/xóa, chỉnh giá & định mức, dùng chung cho dự toán và báo giá.

**Quản lý khách hàng**
- Danh bạ khách hàng (người liên hệ, công ty, SĐT, email, địa chỉ, MST), tìm kiếm nhanh, đếm số báo giá theo từng khách.

**Báo giá cho khách hàng**
- Tạo báo giá chuyên nghiệp có **số tự tăng** `BG-YYYY-NNN`, ngày & hiệu lực, **chiết khấu**, **VAT**, ghi chú, ô ký tên.
- Thêm dòng thủ công hoặc **lấy trực tiếp từ bảng giá**; theo dõi **trạng thái** (Nháp / Đã gửi / Đã chốt / Từ chối).
- Hiển thị thông tin công ty (từ tab **Cấu hình**), **in / xuất PDF** đúng chuẩn văn bản báo giá.

## 🚀 Triển khai GitHub Pages

1. Vào **Settings → Pages**.
2. Mục **Build and deployment → Source**, chọn **GitHub Actions**.
3. Push code lên nhánh mặc định — workflow `.github/workflows/deploy.yml` sẽ tự deploy.
4. Truy cập tại `https://<user>.github.io/<repo>/`.

> Hoặc đơn giản hơn: **Settings → Pages → Source: Deploy from a branch**, chọn nhánh + thư mục `/root`.

## 🖥️ Chạy thử cục bộ

```bash
# mở trực tiếp
open index.html
# hoặc chạy server tĩnh
python3 -m http.server 8080   # http://localhost:8080
```

## 📁 Cấu trúc

```
├── index.html          # Giao diện (SPA nhiều tab)
├── css/style.css       # Style + chế độ in
├── js/data.js          # Dữ liệu mặc định: cell, vật tư, mẫu pack
├── js/store.js         # Kho dữ liệu trung tâm (localStorage)
├── js/ui.js            # Tiện ích UI: modal, toast, format
├── js/estimator.js     # Dự toán & BOM
├── js/pricelist.js     # Quản lý bảng giá
├── js/customers.js     # Quản lý khách hàng
├── js/quotes.js        # Tạo & in báo giá
├── js/app.js           # Router + cấu hình + sao lưu
└── .github/workflows/  # Auto deploy GitHub Pages
```

## ✏️ Tùy biến dữ liệu

Mở `js/data.js` để sửa:
- `CELLS` — thêm/bớt loại cell và đơn giá.
- `MATERIALS` — danh mục vật tư phụ và công thức số lượng (`qtyFixed`, `qtyPerCell`, `qtyPerS`).
- `TEMPLATES` — thêm mẫu pack chuẩn của bạn.

> ⚠️ Đơn giá trong `data.js` là **tham khảo thị trường VN**, cần đối chiếu báo giá nhà cung cấp thực tế trước khi chốt.
