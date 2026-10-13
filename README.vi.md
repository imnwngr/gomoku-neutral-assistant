# Neutral Nexus — Trợ lý phân tích Gomoku

**Ngôn ngữ:** [English](README.md) | Tiếng Việt

> **Phiên bản 0.2.0 · Tiện ích Chrome/Chromium · GPL-3.0-only**

Neutral Nexus là **tiện ích hỗ trợ phân tích thế cờ Gomoku ở chế độ chỉ đọc**, sử dụng bộ máy **Rapfi WebAssembly (WASM)** chạy cục bộ. Tiện ích phân tích các **bàn cờ 19 × 19 có ba ô Neutral (ô trung lập) cố định** được hỗ trợ, hiển thị điểm đánh giá, những nước đi tiềm năng theo thứ hạng và cung cấp giao diện tiếng Anh/tiếng Việt.

Tiện ích **không nhấp chuột lên bàn cờ, không gửi nước đi và không mở kết nối socket tới máy chủ trò chơi**. Mục đích của dự án là quan sát, phân tích và trực quan hóa thế cờ, **không tự động chơi thay người dùng**.

## Tính năng nổi bật

- **Phân tích cục bộ:** Rapfi chạy trong Web Worker, duy trì phiên bản WASM, mô hình và bảng băm (hash table) trong suốt phiên phân tích còn hoạt động.
- **Gợi ý nước đi theo thứ hạng:** Ngôi sao đánh dấu phương án tốt nhất; `2`, `3`… là các phương án thay thế. Đây là **những nước đi đầu tiên có thể lựa chọn**, không phải chuỗi nước đi liên tiếp.
- **Thông tin phân tích trực tiếp:** Độ sâu tìm kiếm, độ sâu chọn lọc, điểm đánh giá, số nút đã duyệt, tốc độ, thời gian và các biến thể MultiPV được xếp hạng.
- **Tùy chỉnh phân tích:** Các chế độ Fast, Slow, Analysis và Custom; điều chỉnh handicap, ba mô hình đi kèm, phạm vi nước ứng viên, bộ nhớ hash 32–256 MB và cách hiển thị đánh dấu.
- **Quản lý phiên:** Tạm dừng/tiếp tục, mở cửa sổ phân tích riêng, sao chép thế cờ và xem biểu đồ lịch sử chỉ dựa trên những thế cờ đã thực sự được phân tích.
- **Giao diện song ngữ:** Chuyển tức thì giữa tiếng Anh và tiếng Việt; lựa chọn ngôn ngữ được đồng bộ và ghi nhớ.
- **Hoạt động chỉ đọc:** Không tự động nhấp chuột, đi cờ hoặc gửi lệnh chơi đến website.

## Bàn cờ và website được hỗ trợ

**Hỗ trợ loại bàn cờ không đồng nghĩa với hỗ trợ mọi website.** Bộ máy phân tích và giao diện không phụ thuộc website, nhưng muốn đọc trạng thái bàn cờ thì phải có bộ chuyển đổi riêng (site adapter). Mỗi trang Gomoku có thể sử dụng cấu trúc HTML, tọa độ và sự kiện cập nhật khác nhau.

Bản tiện ích hiện tại **chỉ hoạt động trên các host và site adapter được khai báo trong `manifest.json`**. Muốn hỗ trợ trang mới, cần bổ sung adapter, quyền truy cập host và các bài kiểm thử hồi quy. Dự án **không** tuyên bố tự động tương thích với tất cả website Gomoku.

Thế cờ được diễn giải với ba ô Neutral và các hạn chế khai cuộc tương ứng. Nếu bắt đầu quan sát khi ván cờ đã diễn ra mà không lấy được đầy đủ lịch sử nước đi, tiện ích xuất **JSON ảnh chụp trạng thái (snapshot)** có nhãn rõ ràng, thay vì tự tạo lịch sử giả. Nếu quan sát từ đầu ván, chuỗi Position tuân theo quy ước của Gomoku Calculator (`n:g12,n14,j7|...`). Cột dùng A–S, hàng được đếm từ dưới lên; adapter chịu trách nhiệm chuyển đổi cách đánh số riêng của từng website.

## Cài đặt / cập nhật

1. Sao lưu thư mục mã nguồn hoặc tạo nhánh trước khi cập nhật (ví dụ: `git switch -c feature/analysis-v020`).
2. Đặt các tệp mã nguồn tiện ích tại thư mục gốc của repository, nơi có `manifest.json`. Nếu cập nhật từ ZIP mã nguồn, **không xóa hoặc ghi đè thư mục `.git`**. ZIP chạy tiện ích chỉ dùng để cài đặt, không nhằm thay thế thư mục Git đang làm việc.
3. Mở `chrome://extensions`, bật **Developer mode (Chế độ dành cho nhà phát triển)** rồi chọn **Load unpacked (Tải tiện ích đã giải nén)** và trỏ tới thư mục gốc; hoặc chọn **Reload (Tải lại)** nếu đã cài. Nếu trước đó cài từ thư mục `dist`, hãy tải bản mới từ thư mục gốc vì `dist` cũ không tự được cập nhật.
4. Tải lại trang Gomoku được hỗ trợ để các content script được chèn lại.
5. Nhấp vào biểu tượng tiện ích. Dùng nút mũi tên góc trên bên phải để mở cửa sổ phân tích riêng, có thể giữ cạnh bàn cờ.

**Không cần Node.js để sử dụng tiện ích.** Node.js chỉ cần cho phát triển, kiểm thử và đóng gói.

## Các chế độ và cơ chế phân tích

| Chế độ | Giới hạn mỗi thế cờ | Ngân sách tính toán của tiện ích mỗi phiên ván cờ |
| --- | --- | --- |
| **Fast** | Tối đa 7 giây | 3 phút |
| **Slow** | Tối đa 40 giây | 15 phút |
| **Analysis** | Không có giới hạn tổng thời gian; dừng theo các điều kiện bên dưới | Không có ngân sách tổng cố định |
| **Custom** | Tùy chỉnh thời gian, độ sâu và/hoặc số nút | Phụ thuộc cấu hình |

Đây là **ngân sách thời gian tính toán của tiện ích**, không phải đồng hồ thi đấu của người chơi. Tăng số dòng MultiPV sẽ phân chia công việc tìm kiếm cho nhiều phương án hơn. Handicap `0` tương ứng với sức mạnh đầy đủ.

Chỉ thế cờ được yêu cầu gần nhất mới được phân tích chủ động. Khi chuyển sang bàn cờ khác, phiên trước sẽ tạm dừng; kết quả cũ không được vẽ đè lên bàn hiện tại. Phiên phân tích được lưu trong offscreen document nên có thể tồn tại khi đóng popup hoặc service worker bị tạm ngưng. **Khởi động lại trình duyệt hoặc tiện ích sẽ làm mất phiên trong bộ nhớ và bảng hash của engine.**

### Giới hạn của bộ máy phân tích

Tệp Rapfi đi kèm sử dụng **SIMD đơn luồng** và tìm kiếm đồng bộ bên trong Web Worker. Lệnh `postMessage('YXSTOP')` thông thường **không thể ngắt tức thời một lượt tìm kiếm đang chiếm luồng**. Phiên bản này không cung cấp tìm kiếm đa luồng hoặc cơ chế *pondering* đồng thời thực sự.

Để tái sử dụng worker, mô hình và bảng chuyển vị trong khi vẫn xử lý được các thế cờ mới, quá trình phân tích được chia thành những **lượt tính toán mục tiêu 750 ms**. Giữa các lượt, worker dùng `TAKEBACK` để hoàn tác nước đi tốt nhất giả định mà Rapfi đã áp dụng nội bộ, rồi tiếp tục từ độ sâu cuối cùng được báo cáo bằng `INFO START_DEPTH`. Phân tích có thể dừng khi tìm thấy mate được báo cáo, không còn nước hợp lệ, đạt độ sâu 100, người dùng tạm dừng hoặc thế cờ bị thay thế. Do giới hạn thời gian gốc chỉ mang tính xấp xỉ, **việc dừng có thể mất hơn 750 ms**.

Các lượt này là **những lần tìm kiếm khởi chạy lại có dùng chung bảng chuyển vị**, không phải một ngăn xếp tìm kiếm C++ được giữ nguyên. Có chi phí khởi chạy lại và **chưa có benchmark** xác nhận sức mạnh tương đương Rapfi bản gốc hay bản đa luồng. Khi thế cờ thay đổi, worker gửi một `YXBOARD` đã lưu đệm; nó không dựng lại toàn bộ bàn cờ ở từng lượt. Muốn hỗ trợ giao thức đi/hoàn tác tăng dần thực sự ở phía engine thì cần bản biên dịch engine khác.

## Những thay đổi trong v0.2.0

- **Sửa tuần tự hóa thế cờ Gomocup:** v0.1 nhóm toàn bộ quân X trước quân O. Rapfi đọc dữ liệu như một chuỗi nước đi theo thứ tự và chèn nước PASS giữa các quân cùng màu, vì vậy một số thế cờ có số lượt lẻ có thể bị phân tích nhầm bên đến lượt. v0.2 xen kẽ màu chính xác, ánh xạ SELF/OPPONENT theo bên đang tới lượt và giữ lại lịch sử quan sát được.
- **Cải thiện hiệu năng:** Giữ WASM engine/mô hình giữa các lần phân tích; chỉ gửi `START` khi bắt đầu hoặc đặt lại ván; chỉ đổi cấu hình mô hình/hash/phạm vi khi cần; lưu đệm các ô DOM; không tìm kiếm lại khi thế cờ không thay đổi. Một số website vẽ lại toàn bộ bàn cờ nên vẫn có thể cần kiểm tra lại đủ 361 ô.
- **Cải thiện hiển thị:** Tiến độ trực tiếp, đầy đủ các biến thể MultiPV xếp hạng, đánh dấu nước đi tốt nhất/phương án thay thế, lịch sử điểm đánh giá và sao chép thế cờ.
- **Quy trình thuận tiện hơn:** Chỉ ưu tiên thế cờ mới nhất, duy trì phiên phân tích, tạm dừng/tiếp tục và mở cửa sổ riêng.
- **Giao diện được làm mới:** Hai trang Analyze / Settings theo phong cách tối, hiệu ứng kính mờ và điểm nhấn neon; độ rộng popup cố định, dễ đọc; đồng bộ ngôn ngữ Anh–Việt.
- **Tinh giản cài đặt:** Loại bỏ công tắc chế độ thi đấu và công tắc ẩn/hiện thứ hạng.

## Phát triển và kiểm thử

```bash
npm test
npm run test:engine
npm run check
npm run package
node tools/package.cjs --source
```

Kiểm thử tích hợp Chromium (tùy chọn):

```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Bài kiểm thử trình duyệt chạy tiện ích đã giải nén với **bàn cờ mô phỏng cục bộ**; không truy cập hay chơi trên máy chủ trò chơi thật.

Dự án không có gói npm phụ thuộc trong môi trường chạy thực tế. Quá trình đóng gói dùng PowerShell trên Windows và `zip` trên Linux/macOS, đồng thời từ chối ghi đè ZIP cùng số phiên bản. Các tệp v0.1 cũ được giữ nguyên. Theo tài liệu phát hành v0.2.0, các bài kiểm thử unit và WASM thật đã được chạy; kiểm thử tích hợp Chromium và kiểm tra trực quan chưa chạy được tại môi trường tạo bản phát hành ban đầu vì không tải được trình duyệt. **Hãy chạy kiểm thử và kiểm tra giao diện trên máy của bạn trước khi coi bản phát hành đủ điều kiện triển khai chính thức.**

## Cấu trúc dự án

| Đường dẫn | Chức năng |
| --- | --- |
| `shared/core.js` | Chuẩn hóa thế cờ, lịch sử quan sát, tuần tự hóa Gomocup, quy tắc khai cuộc, phân tích MultiPV |
| `content/` | Adapter website, quan sát DOM có lưu đệm, dấu chỉ nước đi không tương tác |
| `background/service-worker.js` | Điều phối thông điệp và vòng đời offscreen document |
| `offscreen/offscreen.js` | Phiên theo tab, phân tích thế cờ mới nhất, tiến độ và lịch sử đánh giá |
| `engine/rapfi.worker.js` | Rapfi WASM duy trì liên tục, tái sử dụng bàn cờ/cấu hình, tìm kiếm theo lượt, hoàn tác nội bộ |
| `popup/` | Giao diện Analyze / Settings và cửa sổ phân tích riêng |
| `tests/` | Kiểm thử unit, lập lịch, WASM thật và hồi quy worker |

## Giấy phép và dự án liên quan

Dự án được phân phối theo **GPL-3.0-only**. Khi phân phối lại, cần giữ `LICENSE` và `third_party/rapfi/`.

- Mã nguồn Rapfi: <https://github.com/imnwngr/rapfi>
- Gomoku Calculator: <https://github.com/imnwngr/gomoku-calculator>

Các tài nguyên engine đi kèm bắt nguồn từ một **bản biên dịch Rapfi đã được tùy chỉnh** và đóng gói trước đó. Không nên mặc định mã nguồn upstream mới nhất có thể tạo lại chính xác các tệp nhị phân này khi chưa kiểm tra commit xây dựng gốc. ZIP mã nguồn tiện ích **không bao gồm toàn bộ mã C++ của engine**.
