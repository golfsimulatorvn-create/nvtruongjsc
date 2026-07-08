# 🔋 Dự toán & BOM Pin — Battery Cost Estimator

Website tĩnh giúp **lập giá dự toán** cho các loại **Pin** (LiFePO4, Li-ion) từ **giá vật tư đầu vào**, kèm **BOM chuẩn** cho từng cấu hình pack. Chạy hoàn toàn trên trình duyệt, không cần backend — triển khai miễn phí bằng **GitHub Pages**.

## ✨ Tính năng

- **Mẫu pack chuẩn** dựng sẵn: LiFePO4 12V/24V/48V, Li-ion 36V/48V/60V, hoặc tùy chỉnh S/P tự do.
- **Thư viện cell**: LiFePO4 32700/32650/26650, Li-ion 21700/18650 (điện áp, dung lượng, đơn giá tham khảo).
- **BOM tự động scale** theo số cell (kẽm hàn, đế giữ cell, BMS, vỏ hộp, dây, giắc, cầu chì...).
- **Tính thông số pack**: cấu hình `S×P`, điện áp (V), dung lượng (Ah), năng lượng (kWh).
- **Bảng dự toán giá thành** đầy đủ: vật tư → hao hụt → nhân công → COGS → quản lý → lợi nhuận → VAT → **giá bán**.
- **Chỉnh giá vật tư & số lượng** trực tiếp trên bảng, **thêm dòng vật tư** tùy ý.
- **Lưu tự động** đơn giá trong trình duyệt (localStorage).
- **In / xuất PDF** bảng dự toán chuyên nghiệp.

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
├── index.html          # Giao diện
├── css/style.css       # Style + print
├── js/data.js          # Thư viện cell, vật tư, mẫu pack (chỉnh tại đây)
├── js/app.js           # Logic tính BOM & dự toán
└── .github/workflows/  # Auto deploy GitHub Pages
```

## ✏️ Tùy biến dữ liệu

Mở `js/data.js` để sửa:
- `CELLS` — thêm/bớt loại cell và đơn giá.
- `MATERIALS` — danh mục vật tư phụ và công thức số lượng (`qtyFixed`, `qtyPerCell`, `qtyPerS`).
- `TEMPLATES` — thêm mẫu pack chuẩn của bạn.

> ⚠️ Đơn giá trong `data.js` là **tham khảo thị trường VN**, cần đối chiếu báo giá nhà cung cấp thực tế trước khi chốt.
