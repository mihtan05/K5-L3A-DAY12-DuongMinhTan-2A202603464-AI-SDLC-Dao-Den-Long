# Bằng chứng Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Test Contract v1.3)

Tạo bằng:

```bash
npm run verify -- phase-4
npm run build && node scripts/smoke.mjs phase-4
npm run soak -- --seed 7 --nights 10 --out soak.json
npm run bench -- --seed 42 --duration 30 --out bench.json
```

`bench.json` và `soak.json` ở thư mục gốc là kết quả của **một lần chạy**, được chép nguyên vào thư mục này. Không có file nào ở đây được sửa tay; README này là bảng đối chiếu duy nhất được viết tay.

- `unit-tests.txt`: 95/95 test xanh. Riêng Ticket-04 có `tests/release.test.ts` và `tests/leaderboard.test.ts`.
- `verify-summary.txt`: 35 scenario đều chạy 2 lần, giống nhau byte-by-byte, và khớp khối `expect`. Kết quả: RESULT: PASS. Đầu ra headless không đổi so với Phase 3.
- `smoke.txt`: 41/41 kiểm tra trên Edge thật qua Playwright, chạy với server game thật (`scripts/server.mjs`) và một file bảng xếp hạng tạm.
- `leaderboard-export.json`: file do lệnh xuất tạo ra trong lúc chạy smoke.

## Máy đo (máy làm bài, không phải máy chấm)

| | |
|---|---|
| CPU | AMD Ryzen 5 5600H, 12 luồng |
| GPU | AMD Radeon (iGPU), ANGLE Direct3D11 |
| RAM | 15.4 GB |
| OS | Windows 11, build 10.0.26200 |
| Trình duyệt | Microsoft Edge 157, khung vẽ 1280×720, vsync tắt |
| Node | 24.15 |

## Kết quả bench và soak

| Chỉ số | Kết quả | Ngưỡng | |
|---|---|---|---|
| `avg_fps` | **145.7** | ≥ 60 | đạt |
| `p1_low_fps` | **53** | ≥ 30 | đạt (xem ghi chú dao động bên dưới) |
| `frame_ms_p95` | 9.6 | — | |
| `frames` | 4371 trong 30 s | — | |
| `load_ms` | **1162** | ≤ 10000 | đạt |
| `peak_mem_mb` | `null` | — | bản web không đọc được RSS của tiến trình trình duyệt (giả định D7); `js_heap_peak_mb` có trong file |
| `vsync_off` | true | — | FPS vượt tần số quét 120 Hz nên vsync thật sự tắt |
| Soak `crashes` | **0** / 10 Đêm | = 0 | đạt |
| Soak RSS | 59.9 → 68.3 MB (**×1.14**) | ≤ ×1.2 | đạt |
| Soak JS heap sau GC | 7.0 → 7.8 MB | — | heap gần như phẳng, nên không rò bộ nhớ |

**Dao động của `p1_low_fps` trên máy này** (ghi trung thực các lần chạy 30 s trong lúc chỉnh):
- Trước khi thêm cờ chống trình duyệt hạ ưu tiên cửa sổ: 32, 60.2, 27.4. Có một lần **dưới ngưỡng**.
- Sau khi thêm cờ: 65.1, 51.6, 59.7, 34.3.
- Lần cuối, sau khi HUD chỉ ghi DOM khi giá trị đổi: **53**. Đây là lần được commit.

Đo đạc tạm thời cho thấy mỗi khung game chỉ tốn khoảng 0.1 ms cho mô phỏng, 0.8 ms cập nhật cảnh và 5.4 ms vẽ. Các khung chậm còn lại chủ yếu đến từ máy (ứng dụng khác, chế độ nguồn của laptop). Ticket cũng ghi rõ: số tự đo chỉ để tham khảo, máy chấm mới là số tính điểm.

**Soak:** cả 10 Đêm đều `lost`. Input ngẫu nhiên làm Mây hết lửa rất nhanh (rơi khỏi đảo, chạm Bóng Mực), nên 10 Đêm chỉ chạy trong khoảng 0.6 s. Đây đúng là hành vi ticket mô tả ("chạy tới khi kết thúc"). Để kiểm tra rò bộ nhớ kỹ hơn, mình đã chạy thêm (không lưu file):
- 100 Đêm: RSS 60 → 80 MB.
- 200 Đêm: RSS tăng rồi đứng ở khoảng 93 MB, trong khi JS heap đứng ở 7.1–7.8 MB.

Như vậy RSS tăng do allocator và JIT khởi động, không do rò bộ nhớ.

## Yêu cầu → bằng chứng

| # | Yêu cầu (Ticket-04) | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1.1 | Lệnh `<bench_cmd> --seed 42 --duration 30 --out bench.json`, tự thoát với mã 0 | chạy thật | `bench.json`, `game.contract.json` (`bench_cmd`) | PASS |
| 1.2 | Cửa sổ 1280×720, tắt vsync | chạy thật | `bench.json` (`viewport`, `vsync_off`, cờ trong `renderer`) | PASS (khung vẽ 1280×720, giả định D1) |
| 1.3 | Đêm 1, đúng 200 Bóng Mực `wander` rải đều theo seed, đúng 100 đom đóm, L1–L3 sáng với fuel 100 | unit | `release.test` "night 1: exactly 200…", "spread uses the seed…" | PASS |
| 1.4 | Trong bench tắt sinh thêm thực thể, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng Mực vẫn đi theo luật wander | unit | `release.test` "no spawns, damage, pickup, fuel burn or end of night; shades still move" | PASS |
| 1.5 | Không có input; Mây đứng ở (0,0,0); camera bay vòng bán kính 30, cao 15, xuất phát ở (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng | unit + code | `release.test` "starts at (30,15,0), goes counter-clockwise…"; `readInput()` trả `IDLE` khi bench | PASS |
| 1.6 | Khởi động 3 s rồi đo đúng `--duration`; công thức `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms` | unit + chạy thật | `release.test` "avg_fps = 1000 N / sum dt…"; `bench.json` | PASS (giả định D3, D4) |
| 1.7 | `peak_mem_mb` | — | `bench.json` | `null` kèm giải thích (bản web, như ticket cho phép) |
| 1.8 | Ngưỡng avg ≥ 60, p1 ≥ 30, load ≤ 10000 | chạy thật | `bench.json` | PASS trên máy này; có một lần p1 = 27.4 trước khi sửa (xem trên). Máy chấm chưa đo |
| 2.1 | Soak 10 Đêm xoay vòng 1→2→3 trong một tiến trình, Đêm thứ i dùng seed 7 + i, input ngẫu nhiên theo xác suất | unit + chạy thật | `release.test` "input: …~5% jump…", "night i uses seed + i and rotates…", "is deterministic…"; `soak.json` | PASS (giả định D5) |
| 2.2 | crashes = 0 và mem_end ≤ 1.2 × mem_start | chạy thật | `soak.json` | PASS (×1.14) |
| 3.1 | Nhập tên sau màn Bình Minh hoặc sau khi thua | smoke | smoke "saved after a loss…", Dawn → `Rong_3dem`; `17-save-score.png` | PASS |
| 3.2 | Tên 3–12 ký tự `[A-Za-z0-9_]`; tiếng Việt có dấu (điểm cộng) | unit + smoke | `leaderboard.test` "name: 3-12…"; smoke "name shorter than 3 is refused", tên `Mây_Smoke` | PASS, có hỗ trợ tiếng Việt |
| 3.3 | Mỗi mục có `name, score, nights_won, achieved_at` (ISO 8601 có múi giờ), `seed` | unit + smoke | `leaderboard.test` "entries need every field…", "isoLocal…"; `leaderboard-export.json` | PASS |
| 3.4 | Top 10; score giảm dần; bằng điểm thì ai đạt trước đứng trên | unit | `leaderboard.test` "sorts by score…", "equal score and time…" | PASS |
| 3.5 | Lưu trên đĩa, còn sau khi tắt và mở lại | smoke | smoke "leaderboard from the main menu after reload…" (server ghi `LEADERBOARD_FILE`) | PASS (giả định D9) |
| 3.6 | Màn hình Bảng xếp hạng từ menu chính | smoke | `18-leaderboard.png` | PASS |
| 3.7 | `<run_cmd> --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự | smoke | smoke "export: …", `leaderboard-export.json` | PASS |
| 4.1 | Đổi phím cho cả 9 hành động, báo trùng phím, nút "Khôi phục mặc định", được lưu | smoke | smoke "rebinding: a key used by another action is refused…", "rebinding screen lists…", "rebinding saved between sessions", "jump with the rebound key J"; `14-keys.png` | PASS |
| 4.2 | Phụ đề và chỉ báo: Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, 10 s cuối, đèn < 30 dầu | smoke | smoke "caption + edge arrow when a shade appears", "captions: lantern fuel < 30 and last 10 s", "caption: wind coming"; `15-captions.png` | PASS |
| 4.3 | Giảm chuyển động tắt rung camera và chớp màn hình | smoke | smoke "hit: camera shake and screen flash", "reduced motion: no camera shake, no flash" | PASS (hai hiệu ứng này mới thêm ở Phase 4, giả định D14) |
| 4.4 | Chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1.25 | smoke | smoke "menus: every text >= 18 px", "HUD: every text >= 18 px", "large text: every text >= 22.5 px"; `16-large-text.png` | PASS |
| 5.1 | Clone sạch → tối đa 3 lệnh → chơi được | — | README: `git clone`, `npm ci`, `npm start` | Chưa thử trên máy sạch khác; trên máy này `npm start` build và chạy được |
| 5.2 | README có mô tả, ảnh, yêu cầu hệ thống, cài đặt, điều khiển, test, headless, bench, soak | tài liệu | `README.md` | PASS |
| 5.3 | CHANGELOG có mục cho cả 4 phase; CREDITS; LICENSE | tài liệu | `CHANGELOG.md`, `CREDITS.md`, `LICENSE` | PASS |
| 5.4 | GitHub Release v1.0.0 có bản chạy được | — | — | **CHƯA LÀM**: cần bạn đồng ý push và tạo Release |
| 6 | Contract v1.3, có `bench_cmd` và `soak_cmd`, giữ mọi yêu cầu v1.0–v1.2 | unit + verify | `contract.test`; 35 scenario cũ vẫn PASS | PASS |
| 7.1 | Retro 1–2 trang | tài liệu | `docs/notes/retro.md` | Bản nháp; **các ô token/chi phí chưa điền** |
| 7.2 | Video demo `.mp4` dưới 5 phút | — | — | **CHƯA LÀM** |
| DoD | Tag `phase-4` | — | — | **CHƯA LÀM** (chờ bạn đồng ý) |
| DoD | `bench.json` và `soak.json` tự chạy, đã commit | — | `bench.json`, `soak.json` ở thư mục gốc | PASS |
| DoD | Test Phase 1–3 còn hiệu lực vẫn đạt | unit + verify | `unit-tests.txt`, `verify-summary.txt` | PASS (không chạy được bộ test ẩn của lab) |

## Giới hạn đã biết
- Cảnh bench không chạy được bằng CLI headless, nên luật bench chỉ có unit test (`release.test`), không có scenario `expect` như AGENTS.md yêu cầu với luật gameplay.
- FPS khi chơi thường chỉ đo ở Đêm 1 (`fps.txt`: 120.1, bị giới hạn bởi vsync của smoke).
- Âm thanh không được ghi lại làm bằng chứng.
