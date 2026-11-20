# Thay đổi yêu cầu và quyết định thiết kế

| Phase | Thay đổi | Lý do | Test / tài liệu bị ảnh hưởng |
|---|---|---|---|
| 0 | Chọn Three.js + Node headless | Máy làm bài Windows, máy chấm macOS/Linux; web tĩnh + Node chạy ở cả hai | — |
| 0 | Tài liệu lab chuyển vào `docs/lab/` | README gốc dành cho game | — |
| 0 | Nhân vật và âm thanh tự dựng bằng code thay vì tải asset | Không phụ thuộc license, nhẹ repo, đủ cho Phase 1 | — |
| 2 | Toàn bộ tuning thay bằng số chuẩn Ticket-02, contract v1.1 (thêm 5 khóa) | Ticket-02 Phần 1 bắt buộc | `tests/contract.test.ts`, mọi test số liệu trong `tests/sim.test.ts` viết lại theo số chuẩn |
| 2 | Điểm `per_mote` tính khi **nạp** vào đèn, không còn khi nhặt | Ticket-02 "Điểm (chuẩn hóa)" | Giả định A10 cũ; test "picks a mote" giờ kiểm tra điểm 0 |
| 2 | Vị trí đèn Đêm 1 theo bản đồ chuẩn (L1 tại (0,0,25)), đảo bán kính 40 m, có rơi khỏi đảo | Ticket-02 Phần 2 | Giả định A8, A12 bị thay; scenario `win`, `safe-radius` dời vị trí người chơi/Bóng Mực theo đèn mới |
| 2 | Bóng Mực không còn sinh lúc đầu; 2 con ở tick 300 rồi theo chu kỳ từng Đêm; có trạng thái `spawning/wander/recoil` | Ticket-02 Phần 1, contract v1.1 | Giả định A11; test spawn viết lại |
| 2 | Thứ tự bước trong tick theo bảng bắt buộc: xét thắng/thua chuyển xuống cuối bước | Ticket-02 "Thứ tự xử lý" | Giả định A13 bị thay |
| 2 | Tách bản đồ ra `src/core/maps.ts` với hàm `ground(x, z)`; va chạm vách theo bước lên tối đa 0.3 m | Đêm 3 có tầng, dốc, tháp; một hàm độ cao dùng chung cho Mây, Bóng Mực và render | — |
| 2 | Tích phân nhảy dùng parabol chính xác mỗi tick thay cho Euler bán ẩn | Euler cho đỉnh 1.167 m thay vì 7²/(2·20) = 1.225 m; bay 0.7 s đúng 42 tick | test "jump" |
| 2 | `verify.mjs` kiểm tra khối `expect` trong mỗi case | Scenario trước chỉ chứng minh tất định, chưa chứng minh đúng luật | mọi `*.case.json` |
| 2 | Render: menu, giới thiệu Đêm, kết quả, Bình Minh, tạm dừng, cài đặt (localStorage), HUD đầy đủ, bảng màu chuẩn ở `palette.ts`; bỏ phím R | Ticket-02 Phần 3 | `scripts/smoke.mjs` viết lại |
