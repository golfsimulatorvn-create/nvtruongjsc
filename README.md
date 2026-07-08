# 🔋 Dự toán & Báo giá Pin — Battery Estimator & Quotation

Website tĩnh **quản lý bảng giá vật tư · khách hàng · báo giá** và **lập giá dự toán** cho các loại **Pin** (LiFePO4, Li-ion) từ **giá vật tư đầu vào**, kèm **BOM chuẩn** cho từng cấu hình pack. Chạy hoàn toàn trên trình duyệt, không cần backend — triển khai miễn phí bằng **GitHub Pages**. Dữ liệu lưu cục bộ (localStorage) và có thể **xuất/nhập file sao lưu**.

Ứng dụng gồm 5 tab: **Dự toán · Bảng giá · Khách hàng · Báo giá · Cấu hình**.

## ✨ Tính năng

**Dự toán & BOM**
- **Mã sản phẩm** + **mẫu pack chuẩn** (LiFePO4 12/24/48V, Li-ion 36/48/60V, pin xe nâng 102Ah, hoặc tùy chỉnh S/P).
- **Chọn loại Cell / BMS / Vỏ** trực tiếp từ danh mục bảng giá (dropdown tự cập nhật theo phân loại).
- **BOM tự động scale** theo số cell (kẽm hàn, đế giữ cell, dây, giắc, cầu chì...).
- **Tính thông số pack**: cấu hình `S×P`, điện áp (V), dung lượng (Ah), năng lượng (kWh).
- **Bảng dự toán giá thành**: vật tư → hao hụt → nhân công → COGS → quản lý → lợi nhuận → VAT → **giá bán**.
- Một cú nhấp **“Tạo báo giá từ dự toán này”**.

**Bảng giá đầu vào**
- Danh mục vật tư đầy đủ trường: **Mã mặt hàng · Tên [Thông số] · Mã NSX · Hãng SX · Đơn giá · Thời gian đặt hàng · Tồn kho tối thiểu**.
- **Phân loại tự động theo tiền tố mã**: `CELL/CE-` → Cell, `BMS` → BMS, `CASE` → Vỏ, `PCB` → PCB, còn lại → Vật tư phụ (đổi tay được). Lọc nhanh theo phân loại + tìm kiếm.
- **Nhập / xuất Excel**: xuất `.xlsx` đúng định dạng cột làm mẫu, chỉnh rồi nhập lại — khớp theo **Mã mặt hàng** (có sẵn thì cập nhật, chưa có thì thêm mới). Hỗ trợ `.xlsx / .xls / .csv`, đọc offline bằng thư viện SheetJS đóng gói sẵn.

**Quản lý khách hàng**
- Danh bạ khách hàng (người liên hệ, công ty, SĐT, email, địa chỉ, MST), tìm kiếm nhanh, đếm số báo giá theo từng khách.

**Báo giá cho khách hàng**
- Tạo báo giá chuyên nghiệp có **số tự tăng** `BG-YYYY-NNN`, ngày & hiệu lực, **chiết khấu**, **VAT**, ghi chú, ô ký tên.
- Thêm dòng thủ công hoặc **lấy trực tiếp từ bảng giá**; theo dõi **trạng thái** (Nháp / Đã gửi / Đã chốt / Từ chối).
- Hiển thị **logo + thông tin công ty** (từ tab **Cấu hình**), **in / xuất PDF** và **xuất Excel/CSV**.

**Tiện ích khác**
- **Lịch sử điều chỉnh giá**: tự ghi lại mỗi lần đổi đơn giá cell/vật tư (giá cũ → giá mới, % thay đổi).
- **Logo công ty**: tải lên trong tab Cấu hình, hiển thị trên đầu báo giá.
- **Sao lưu**: xuất/nhập toàn bộ dữ liệu ra file JSON.

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
