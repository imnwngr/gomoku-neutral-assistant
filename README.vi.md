<div align="center">
  <img src=".github/assets/neutral-nexus-banner.svg" alt="Neutral Nexus — Trợ lý phân tích Gomoku chỉ đọc sử dụng Rapfi WASM" />

  <h3>Quan sát thế cờ. Khám phá phương án. Chủ động quyết định.</h3>
  <p>Trợ lý phân tích cục bộ, chỉ đọc dành cho <strong>bàn Gomoku 19 × 19 có 3 ô Neutral</strong> được hỗ trợ.</p>

  <p>
    <img src="https://img.shields.io/badge/phi%C3%AAn%20b%E1%BA%A3n-v0.2.0-8B5CF6?style=flat-square" alt="Phiên bản 0.2.0" />
    <img src="https://img.shields.io/badge/engine-Rapfi%20WASM-00B7C7?style=flat-square" alt="Rapfi WASM" />
    <img src="https://img.shields.io/badge/tr%C3%ACnh%20duy%E1%BB%87t-Chrome%20%7C%20Chromium-2563EB?style=flat-square" alt="Chrome và Chromium" />
    <img src="https://img.shields.io/badge/ch%E1%BA%BF%20%C4%91%E1%BB%99-ch%E1%BB%89%20%C4%91%E1%BB%8Dc-16A34A?style=flat-square" alt="Chế độ chỉ đọc" />
    <img src="https://img.shields.io/badge/gi%E1%BA%A5y%20ph%C3%A9p-GPL--3.0--only-6B7280?style=flat-square" alt="GPL-3.0-only" />
  </p>

  <p><a href="README.md">English</a> · <strong>Tiếng Việt</strong></p>
  <p>
    <a href="#bat-dau">Cài đặt</a> ·
    <a href="#tinh-nang">Tính năng</a> ·
    <a href="#tuong-thich">Tương thích</a> ·
    <a href="#che-do">Chế độ phân tích</a> ·
    <a href="#phat-trien">Phát triển</a>
  </p>
</div>

---

> [!IMPORTANT]
> **Trợ lý phân tích, không phải bot tự chơi.** Neutral Nexus chỉ đọc thế cờ và hiển thị các nước đi ứng viên. Tiện ích **không nhấp chuột lên bàn cờ, không gửi nước đi và không mở socket tới máy chủ trò chơi**. Các gợi ý là **những nước đầu tiên thay thế nhau**, không phải chuỗi nước đi được tự động thực hiện.

<a id="tinh-nang"></a>
## ✨ Tính năng nổi bật

| | |
| :--- | :--- |
| 🧠 **Rapfi chạy cục bộ**<br>Rapfi WASM hoạt động trong Web Worker. Mô hình và bảng băm được duy trì trong phiên phân tích đang chạy. | ⭐ **Gợi ý nước đi theo thứ hạng**<br>Ngôi sao là phương án tốt nhất; `2`, `3`, … là các nước đi đầu tiên có thể lựa chọn khác. |
| 📊 **Thông số phân tích trực tiếp**<br>Điểm đánh giá, độ sâu thường/chọn lọc, số nút, tốc độ, thời gian và các dòng MultiPV theo thứ hạng. | 🎛️ **Cấu hình linh hoạt**<br>Fast / Slow / Analysis / Custom, handicap, 3 mô hình tích hợp, phạm vi ứng viên, bộ nhớ hash 32–256 MB và kiểu đánh dấu. |
| 🪟 **Quản lý phiên tiện lợi**<br>Tạm dừng/tiếp tục, cửa sổ phân tích riêng, sao chép thế cờ và biểu đồ lịch sử từ các thế cờ đã thực sự phân tích. | 🌐 **Giao diện Anh–Việt**<br>Đổi ngôn ngữ tức thì; lựa chọn được đồng bộ và ghi nhớ. |

<div align="center">
  <sub>Bàn cờ 19 × 19 &nbsp; • &nbsp; 3 ô Neutral cố định &nbsp; • &nbsp; Phân tích cục bộ &nbsp; • &nbsp; Không tự động chơi</sub>
</div>

<a id="bat-dau"></a>
## 🚀 Cài đặt nhanh

**Không cần Node.js để sử dụng tiện ích.**

1. [Tải mã nguồn dưới dạng ZIP](https://github.com/imnwngr/gomoku-neutral-assistant/archive/refs/heads/main.zip) hoặc clone repository; giải nén nếu cần.
2. Mở `chrome://extensions` trên Chrome hoặc trình duyệt Chromium tương thích.
3. Bật **Developer mode (Chế độ dành cho nhà phát triển)** → **Load unpacked (Tải tiện ích đã giải nén)** → chọn thư mục có `manifest.json`.
4. Tải lại **website Gomoku được hỗ trợ** để content script được kích hoạt, rồi mở tiện ích từ thanh công cụ.
5. Nhấn mũi tên góc trên bên phải của popup để mở cửa sổ phân tích riêng cạnh bàn cờ.

> [!TIP]
> Đã cài từ trước? Nhấn **Reload (Tải lại)** trên thẻ tiện ích, rồi tải lại tab Gomoku. Nếu trước đây cài từ `dist`, hãy chọn lại thư mục gốc mới; thư mục `dist` cũ không tự cập nhật.

<details>
<summary><strong>Cập nhật trên thư mục Git hiện có</strong></summary>

Hãy sao lưu mã nguồn hoặc tạo nhánh trước khi thay thế tệp (ví dụ: `git switch -c feature/analysis-v020`). ZIP chạy tiện ích dùng để cài trên trình duyệt, **không** phải để ghi đè repository Git. Khi chép tệp từ ZIP mã nguồn, không xóa hoặc thay thế thư mục `.git`.

</details>

<a id="tuong-thich"></a>
## 🧩 Tương thích bàn cờ và website

**Hỗ trợ loại bàn cờ ≠ hỗ trợ mọi website.** Engine và giao diện không phụ thuộc trang web, nhưng việc đọc trạng thái bàn cờ cần **site adapter** tương ứng. Bản tiện ích đi kèm **chỉ hỗ trợ các host và adapter khai báo trong `manifest.json`**. Muốn hỗ trợ trang khác phải bổ sung adapter, quyền host và kiểm thử hồi quy.

- **Loại bàn:** 19 × 19, với 3 ô Neutral cố định cùng các ràng buộc khai cuộc thích hợp.
- **Xuất Position:** Nếu quan sát được đầy đủ lịch sử, dữ liệu theo quy ước [Gomoku Calculator](https://github.com/imnwngr/gomoku-calculator), ví dụ `n:g12,n14,j7|...`.
- **Vào giữa ván:** Nếu thiếu lịch sử nước đi, tiện ích xuất **JSON snapshot** có nhãn rõ ràng, không tự tạo một ván cờ giả.
- **Tọa độ:** Cột **A–S**, hàng đếm từ dưới lên; adapter chuyển đổi cách đánh số riêng của từng trang.

<a id="che-do"></a>
## ⚡ Chế độ phân tích

| Chế độ | Giới hạn mỗi thế cờ | Ngân sách tính toán mỗi phiên ván cờ |
| :--- | :--- | :--- |
| 🟢 **Fast** | Tối đa **7 giây** | **3 phút** |
| 🟡 **Slow** | Tối đa **40 giây** | **15 phút** |
| 🔵 **Analysis** | Không giới hạn tổng thời gian cố định; dừng theo điều kiện phiên/engine | Không có ngân sách tổng cố định |
| 🟣 **Custom** | Tùy chỉnh thời gian, độ sâu và/hoặc số nút | Phụ thuộc cấu hình |

Đây là **ngân sách tính toán của tiện ích**, không phải đồng hồ thi đấu. Càng nhiều MultiPV, tài nguyên tìm kiếm càng được chia cho nhiều phương án. Handicap `0` tương ứng sức mạnh đầy đủ.

Chỉ **thế cờ được yêu cầu gần nhất** được phân tích chủ động. Khi chuyển sang bàn khác, phiên cũ tạm dừng và kết quả cũ không phủ lên bàn hiện tại. Phiên trong offscreen document có thể tồn tại khi đóng popup hoặc service worker tạm ngưng, nhưng **khởi động lại trình duyệt/tiện ích sẽ xóa phiên trong bộ nhớ và bảng hash của engine**.

<details>
<summary><strong>🔬 Cơ chế và giới hạn của engine</strong></summary>

Rapfi tích hợp dùng **SIMD đơn luồng** và thực hiện tìm kiếm đồng bộ trong Web Worker. Lệnh `postMessage('YXSTOP')` thông thường **không thể ngắt tức thời** một lượt tìm kiếm đang chặn worker. Phiên bản này không hỗ trợ tìm kiếm đa luồng hay *pondering* đồng thời thực sự.

Phân tích được chia thành các **lượt tính toán mục tiêu 750 ms** để tái sử dụng worker, mô hình WASM và bảng chuyển vị, đồng thời phản hồi được khi thế cờ đổi. Giữa các lượt, worker dùng `TAKEBACK` để hoàn tác nước đi tốt nhất giả định đã áp dụng nội bộ và tiếp tục từ độ sâu cuối cùng được báo cáo thông qua `INFO START_DEPTH`. Phân tích có thể dừng khi báo cáo mate, không còn nước hợp lệ, đạt độ sâu 100, người dùng tạm dừng hoặc có thế cờ mới. Vì giới hạn thời gian gốc chỉ xấp xỉ, **việc dừng có thể mất hơn 750 ms**.

Đây là **các lượt tìm kiếm khởi chạy lại**, không phải ngăn xếp lời gọi C++ được giữ nguyên. Việc khởi chạy lại có chi phí; **chưa có benchmark** chứng minh sức mạnh tương đương Rapfi gốc hoặc bản đa luồng. Khi thế cờ đổi, worker gửi một `YXBOARD` được lưu đệm; không dựng lại bàn cờ ở mỗi lượt. Giao thức engine đi/hoàn tác tăng dần đúng nghĩa đòi hỏi bản biên dịch khác.

</details>

## 🆕 Điểm mới trong v0.2.0

- **Sửa tuần tự hóa nước đi:** Khắc phục lỗi v0.1 nhóm toàn bộ X trước O, có thể khiến Rapfi phân tích nhầm bên đến lượt ở một số thế cờ lượt lẻ. v0.2 xen kẽ màu đúng, ánh xạ SELF/OPPONENT theo người đến lượt và giữ lịch sử quan sát.
- **Giảm tính toán dư thừa:** Duy trì WASM/mô hình, chỉ gửi `START` khi mở/đặt lại ván, chỉ cập nhật cài đặt nếu thay đổi, lưu đệm ô DOM và không phân tích lại thế cờ không đổi. Một số trang vẽ lại bàn vẫn đòi hỏi kiểm tra lại toàn bàn.
- **Hiển thị hữu ích hơn:** Tiến độ, đầy đủ MultiPV xếp hạng, dấu nước tốt nhất/phương án thay thế, lịch sử đánh giá và sao chép Position.
- **Sử dụng thuận tiện hơn:** Ưu tiên thế cờ mới nhất, tạm dừng/tiếp tục, phiên offscreen duy trì, cửa sổ riêng, giao diện Analyze / Settings nền tối và chuyển đổi Anh–Việt đồng bộ.
- **Cài đặt tinh gọn:** Loại bỏ công tắc chế độ thi đấu và công tắc ẩn/hiện thứ hạng.

<a id="phat-trien"></a>
## 🛠️ Phát triển và kiểm thử

```bash
npm test
npm run test:engine
npm run check
npm run package
node tools/package.cjs --source
```

<details>
<summary><strong>Kiểm thử tích hợp Chromium (không bắt buộc)</strong></summary>

```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Bài kiểm thử mở tiện ích đã giải nén trên **bàn cờ mô phỏng cục bộ**, không truy cập hay chơi trên máy chủ trò chơi thật.

</details>

**Lưu ý khi phát triển:** Dự án không cần gói npm trong môi trường chạy thực tế. Quá trình đóng gói dùng PowerShell trên Windows và `zip` trên Linux/macOS, không ghi đè ZIP cùng phiên bản. Các tệp v0.1 gốc vẫn được giữ nguyên. Theo tài liệu v0.2.0, kiểm thử unit và WASM thật đã được thực hiện; kiểm thử Chromium và QA giao diện chưa chạy được tại môi trường tạo bản phát hành ban đầu vì không tải được trình duyệt. **Nên kiểm thử trình duyệt và kiểm tra giao diện tại máy của bạn trước khi coi bản phát hành đủ điều kiện triển khai.**

<details>
<summary><strong>📁 Cấu trúc dự án</strong></summary>

| Đường dẫn | Vai trò |
| :--- | :--- |
| `shared/core.js` | Chuẩn hóa thế cờ, lịch sử quan sát, tuần tự hóa Gomocup, quy tắc khai cuộc, đọc MultiPV |
| `content/` | Site adapter, quan sát DOM có lưu đệm, chỉ dấu không tương tác |
| `background/service-worker.js` | Điều phối thông điệp và vòng đời offscreen document |
| `offscreen/offscreen.js` | Phiên theo tab, thế cờ gần nhất, tiến độ, lịch sử đánh giá |
| `engine/rapfi.worker.js` | WASM duy trì, tái sử dụng bàn/cấu hình, tìm kiếm theo lượt, hoàn tác nội bộ |
| `popup/` | Giao diện Analyze / Settings và cửa sổ riêng |
| `tests/` | Kiểm thử unit, lập lịch, WASM thật và hồi quy worker |

</details>

## 📜 Giấy phép và lời cảm ơn

Phát hành theo giấy phép **[GPL-3.0-only](LICENSE)**. Khi phân phối lại, hãy giữ `LICENSE` và `third_party/rapfi/`.

- **[Rapfi](https://github.com/imnwngr/rapfi)** — engine phân tích nền tảng.
- **[Gomoku Calculator](https://github.com/imnwngr/gomoku-calculator)** — quy ước biểu diễn Position.

Tài nguyên engine tích hợp xuất phát từ **một bản Rapfi tùy chỉnh đã được đóng gói trước đó**. Không nên giả định mã nguồn upstream HEAD có thể tái tạo chính xác các tệp nhị phân này nếu chưa xác minh commit xây dựng gốc. ZIP mã nguồn của tiện ích **không chứa toàn bộ mã C++ của engine**.

---

<div align="center">
  <strong>Quan sát · Đánh giá · Thấu hiểu</strong><br />
  <sub>Neutral Nexus hỗ trợ phân tích thế cờ, không tự động chơi thay người dùng.</sub>
  <br /><br />
  <a href="#bat-dau">↑ Quay lại phần cài đặt</a> · <a href="README.md">Read in English</a>
</div>
