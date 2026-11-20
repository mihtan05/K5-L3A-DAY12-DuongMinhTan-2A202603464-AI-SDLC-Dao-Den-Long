# Bằng chứng Phase 2 (Ticket-02, Test Contract v1.1)

Tạo lại ở tag `phase-2`: `npm run verify -- phase-2` và `npm run build && npm run smoke -- phase-2`.
Kết quả lần này: [verify-summary.txt](verify-summary.txt) (unit 57/57 + 25 scenario, mỗi cái chạy 2 lần, có kiểm tra `expect`) và [smoke.txt](smoke.txt).
Máy đo FPS: xem [fps.txt](fps.txt) (Ryzen 5 5600H, Radeon iGPU, Edge, Windows 11).
Mã tiêu chí (D1, C2, …) lấy từ [docs/spec/phase-2.md](../../spec/phase-2.md).

## Phần 1, 4: số chuẩn và contract v1.1
| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| T1 `game.contract.json` v1.1 = `TUNING` (5 khóa mới) | `tests/contract.test.ts` | [unit-tests.txt](unit-tests.txt) | PASS |
| T2 Snapshot v1.1 đủ trường | unit › snapshot has every v1.1 field | unit-tests.txt, mọi `*.jsonl` | PASS |
| T3 Tên trạng thái Bóng Mực | unit › shade states only use the v1.1 names (3 Đêm × 4000 tick) | unit-tests.txt | PASS |
| T4 Một Đêm 21 600 tick ≤ 30 s | unit (đo thời gian) + scenario `night3-full-perf` | unit-tests.txt, [night3-full-perf.jsonl](night3-full-perf.jsonl) | PASS |
| T5 Hồi quy Phase 1 với số chuẩn | 9 scenario Phase 1 (2 file dời vị trí theo đèn mới, xem changes.md) | verify-summary.txt | PASS (test ẩn của giảng viên chưa chạy được ở đây) |
| Thứ tự tick, nhảy 7 m/s / −20, lướt, nhặt, nạp, vùng an toàn, đẩy ra 30 tick, Tỏa Sáng 3D, choáng 120, đẩy lùi 15 tick, chạm + recoil, rơi đom đóm TTL 480, lịch sinh, thắng đúng tick hết giờ | `tests/sim.test.ts` (57 test) + scenario `dash`, `safe-zone-expel`, `pulse`, `hit-lose`, `shade-schedule`, `win`, `dawn` | unit-tests.txt, các `.jsonl` cùng tên | PASS |
| Điểm chuẩn hóa (win Đêm 1 = 10×10 + 100 + 2×299 + 50×3 = 948) | scenario `win` (`expect.end.score`) | [win.jsonl](win.jsonl) | PASS |

## Phần 2: bản đồ
| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Đêm 1: đảo 40 m, rơi ra biển | scenario `fall` | [fall.jsonl](fall.jsonl) | PASS |
| J1 Đêm 2 bục nhảy → đáp đảo B sau ~1.4 s | scenario `night2-pad` (đáp ở (51.6, 0, 6.6)) + unit | [night2-pad.jsonl](night2-pad.jsonl) | PASS |
| Đêm 2 cầu tre giữ, cạnh cầu là biển | unit › bridge | unit-tests.txt | PASS |
| J2 Đêm 3 bục → tầng 2 (Y = 6) | scenario `night3-pad` | [night3-pad.jsonl](night3-pad.jsonl) | PASS |
| M1 Vách tầng, dốc 30°/150°, tháp | scenario `night3-ramp` (lên Y = 3) + unit › terrain | [night3-ramp.jsonl](night3-ramp.jsonl) | PASS |
| W1 Gió mỗi 30 s, 5 s, 2 m/s | scenario `wind` (đẩy đúng 10 m) + unit | [wind.jsonl](wind.jsonl) | PASS |
| N2 `--night 1/2/3`, số đèn, thời lượng, `night_start` | unit + `night2-default`, `night3-default` | các `.jsonl` | PASS |
| Hình 3 đảo | ảnh trong game | [11-play-night2.png](11-play-night2.png), [11-play-night3.png](11-play-night3.png) | PASS |

## Phần 3: tính năng mới
| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| D1 Gió Lạc sinh 1200/2400, tối đa 2, không có ở Đêm 1 | scenario `drifter-spawn` + unit | [drifter-spawn.jsonl](drifter-spawn.jsonl) | PASS |
| D2–D4 idle → chase, cướp 3, flee 240 tick → removed, 1 lần, không mất lửa | scenario `drifter-steal` + unit | [drifter-steal.jsonl](drifter-steal.jsonl) | PASS |
| D5 Tỏa Sáng trúng con đang chase → flee không cướp | unit | unit-tests.txt | PASS |
| D6 Tỏa Sáng trúng con flee có đồ → `drifter_drop`, 3 đom đóm rơi, removed sau 120 tick | scenario `drifter-drop` + unit | [drifter-drop.jsonl](drifter-drop.jsonl) | PASS |
| D7 Vùng an toàn không chặn Gió Lạc | unit | unit-tests.txt | PASS |
| C1–C4 Bùa Gió: vị trí, 600 tick, 7.2 m/s, lướt không hồi chiêu, hiện lại sau 2700 | scenario `charm` + unit | [charm.jsonl](charm.jsonl) | PASS |
| L1–L2 Lướt | scenario `dash` + unit | [dash.jsonl](dash.jsonl) | PASS |
| F1–F2 Rơi khỏi đảo | scenario `fall` + unit | fall.jsonl | PASS |
| P1–P2 Tạm dừng trong headless | scenario `pause` (sim_tick 40 ở tick 60) + unit | [pause.jsonl](pause.jsonl) | PASS |
| P3 Esc mở menu 4 mục, logic đứng yên | smoke | [07-pause.png](07-pause.png), smoke.txt | PASS |
| N1 Menu → giới thiệu (Ông Đăng) → chơi → kết quả → Đêm kế; thua → chơi lại; Bình Minh với tổng điểm | smoke (thắng 3 Đêm: 948 + 1008 + 1068 = 3024) | [01-menu.png](01-menu.png), [03-intro-night1.png](03-intro-night1.png), [08-lose.png](08-lose.png), [09-win-night1.png](09-win-night1.png), [10-intro-night2.png](10-intro-night2.png), [12-dawn.png](12-dawn.png) | PASS (thắng dựng sẵn giống scenario `win`, phím E bấm thật) |
| G1 Cài đặt âm lượng, độ nhạy chuột lưu qua lần tải lại | smoke (đặt 0.3 / 1.8, tải lại trang, đọc lại) | [02-settings.png](02-settings.png), smoke.txt | PASS |
| H1 HUD đầy đủ | smoke: 3 lửa, mm:ss, k/n + điểm, 10 ô, 2 ô hồi chiêu, nhắc "E — Nạp ánh sáng (0/10)", mũi tên, đồng hồ đỏ `rgb(255, 90, 95)` khi ≤ 30 s | [04-play-night1.png](04-play-night1.png), [05-hud-prompt.png](05-hud-prompt.png), [06-hud-danger-clock.png](06-hud-danger-clock.png) | PASS |
| K1 Bảng màu chuẩn | `tests/palette.test.ts` (đúng từng mã hex) | unit-tests.txt | PASS |
| K2 Ánh sáng môi trường 0.15 + 0.55 × tỉ lệ | `tests/palette.test.ts` + dùng trong `main.ts` | unit-tests.txt | PASS |
| A1 Nhạc nền + 10 loại âm | Kiểm tra code: `src/render/audio.ts` có `startMusic` và các âm `pickup, lit, pulse, hit, jump, dash, win, lose, shade, tick`; `main.ts` gọi theo sự kiện | — | **PASS một phần**: chưa có bằng chứng nghe (không thu âm); sẽ có trong video Phase 4 |
| Báo gió trước 2 s bằng lá bay + âm thanh | Kiểm tra code (`makeLeaves`, `playSfx('wind')` khi `wind.warn`) | — | **PASS một phần**: chưa có ảnh/âm chụp đúng lúc báo gió |
| R1 ≥ 30 FPS trung bình ở 1280×720 | smoke đo 5 s khi đi trên Đêm 1 | [fps.txt](fps.txt): 117.5 | PASS (chỉ đo Đêm 1) |
| Không lỗi console | smoke | smoke.txt | PASS |

## Lỗi phát hiện nhờ kiểm chứng
- Đỉnh nhảy 1.167 m (Euler bán ẩn) thay vì 1.225 m: unit test bắt được, đổi sang parabol chính xác.
- Gió Lạc biến mất sớm 1 tick sau khi thả đồ: bộ đếm flee chuyển sang bước 2 (giảm bộ đếm) cho đúng 120 / 240 tick.
- Scenario Bùa Gió ban đầu cho Mây đi khỏi cầu và rơi: `expect.events.player_hit = 0` bắt được, sửa input.
