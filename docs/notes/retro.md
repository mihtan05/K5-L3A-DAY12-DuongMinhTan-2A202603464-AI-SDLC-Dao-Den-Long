# Retro — Đảo Đèn Lồng (Lab Day 12)

> Bản nháp do Claude Code soạn từ nhật ký AI, commit và bằng chứng của 4 phase. Hai mục bạn cần tự điền hoặc sửa:
> - các ô **token/chi phí** (lấy từ `/cost` hoặc trang usage);
> - mục **"Nếu làm lại"**, nếu bạn thấy khác.

## 1. Đánh giá 4 phase

| Phase | Yêu cầu | Kết quả kiểm chứng | Chưa đạt / giới hạn |
|---|---|---|---|
| 1 (PRD-0, v1.0) | Một đảo, nhặt đom đóm, thắp đèn, Bóng Mực, headless JSONL | 25 unit test, 9 scenario, smoke trên trình duyệt ([proof](../proof/phase-1/README.md)) | — |
| 2 (Ticket-02, v1.1) | 3 Đêm, số chuẩn, thứ tự tick, lướt, rơi, bục nhảy, gió, Gió Lạc, Bùa Gió, tạm dừng, menu | 57 unit test, 25 scenario có `expect`, smoke 3 Đêm, FPS ([proof](../proof/phase-2/README.md)) | FPS chỉ đo Đêm 1 |
| 3 (Ticket-03, v1.2) | Dầu đèn, tắt / châm / thắp lại, trạng thái `drain`, thắng ở bình minh, sức chứa, điểm mới, chế độ mù màu | 81 unit test, 35 scenario, 26 kiểm tra smoke, ADR 0001, CHANGELOG ([proof](../proof/phase-3/README.md)) | Tần số nhấp nháy 1 Hz và việc ánh sáng giảm khi đèn tắt mới chỉ kiểm bằng đọc code và ảnh chụp |
| 4 (Ticket-04, v1.3) | Bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói, Release | 95 unit test, smoke có thêm 15 kiểm tra, bench và soak trên máy tôi ([proof](../proof/phase-4/README.md)) | `peak_mem_mb` = null (bản web); video demo và Release cần tự làm |

## 2. Điều hiệu quả khi làm với AI
- **Chép nguyên văn ticket vào repo** (`docs/lab/TICKET-0N.md`) trước khi code. Khi phân vân, AI trích lại ticket thay vì đoán. Chỗ nào mơ hồ thì ghi thành giả định có mã số (A, B, C, D).
- **Headless tất định và khối `expect`.** Mỗi luật mới có một scenario mà kết quả mong đợi được tính tay theo luật. `npm run verify` chạy mỗi scenario 2 lần và so từng byte, nên AI không thể "sửa test cho khớp code" mà không bị lộ.
- **Smoke bằng Playwright trên trình duyệt thật.** Script đặt trạng thái như một scenario rồi bấm phím thật. Nó bắt được những lỗi unit test không thấy: bỏ lỡ phím bấm nhanh, thanh dầu bị nền che, chữ nhỏ hơn 18 px.
- **Mỗi thay đổi một commit nhỏ.** Dễ quay lại và dễ đối chiếu bằng chứng với từng tag.

## 3. Điều không hiệu quả
- **Sửa file bằng `sed`, `node -e` hoặc heredoc dài trong shell** làm hỏng ký tự `\n`, `\d` và dấu nháy nhiều lần (Phase 2, 3, 4). Dùng công cụ Edit hoặc một script vá trong scratchpad thì ổn định hơn.
- **Lab board cần đăng nhập** nên AI không đọc được ticket; phải dán ticket thẳng vào chat.
- **Context dài** (Phase 3–4) làm phiên bị tóm tắt giữa chừng. Ghi kế hoạch và trạng thái vào file (AGENTS.md, CHANGELOG, bảng proof) giúp phiên sau tiếp tục được.

## 4. Những lần AI sai và cách phát hiện
| Lần sai | Phát hiện nhờ | Sửa |
|---|---|---|
| Đỉnh nhảy thấp hơn số chuẩn (dùng Euler bán ẩn) | Unit test so với số trong ticket | Đổi sang parabol chính xác |
| Kỳ vọng test lệch 1 tick (thời gian choáng, hồi chiêu lướt) | Test đỏ; lập luận lại theo luật | Sửa test theo luật, không sửa code cho khớp |
| Render bỏ lỡ phím bấm nhanh | Smoke trên trình duyệt | Chốt lại phím đã bấm trong tick |
| Thanh dầu bị nền che, vết rách giấy không thấy | Xem ảnh chụp smoke | `renderOrder`, đổi màu |
| Bench 1% low chỉ 30 FPS | Chạy bench thật | Dùng chung mesh Bóng Mực |
| Plugin Vite làm Vitest không khởi động | `npm test` đỏ | Import lúc chạy, tắt khi chạy test |
| Hook `Stop` báo đỏ khi test xanh | Đọc output của hook | `cd "$CLAUDE_PROJECT_DIR"`, in 20 dòng cuối |

## 5. Harness giúp nhiều nhất
1. **AGENTS.md**: các luật cứng (core không dùng `Math.random`/`Date.now`, số chỉ nằm trong `TUNING`, giữ thứ tự tick, không sửa tay bằng chứng, không `skip` test). Mỗi phase AI đọc lại và tuân theo.
2. **Skill `verify`**: một lệnh chạy unit test, mọi scenario 2 lần, so kết quả mong đợi và lưu bằng chứng. Đây là "định nghĩa xong" cho mỗi phase.
3. **Hook `Stop`**: chạy test trước khi AI được nói "xong".

## 6. Token và chi phí
| Phase | Token / chi phí ước tính |
|---|---|
| 0–1 | *(điền)* |
| 2 | *(điền)* |
| 3 | *(điền)* |
| 4 | *(điền)* |
| **Tổng** | *(điền)* |

Cách tiết kiệm:
- đọc tài liệu lab một lần rồi lưu thành file trong repo;
- dán ticket vào chat thay vì để AI dò lab board;
- viết spec và giả định một lần trước khi code;
- kiểm nhanh từng luật bằng headless thay vì mở trình duyệt;
- dùng lại `createGame` + scenario cho cảnh bench thay vì viết cảnh mới.

## 7. Nếu làm lại
- Viết smoke trình duyệt và bench ngay từ Phase 1, để thấy sớm vấn đề hiệu năng khi có nhiều thực thể.
- Giữ một cách tính seed và một cách chạy game (`npm start`) từ đầu, thay vì đổi `run_cmd` ở Phase 4.
- Gắn tag và push ngay khi mỗi phase PASS, không dồn tới cuối.
