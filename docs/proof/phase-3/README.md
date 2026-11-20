# Bằng chứng Phase 3 — Ticket-03 "Đèn cạn dầu" (Test Contract v1.2)

Tạo bằng:

```bash
npm run verify -- phase-3
npm run build && node scripts/smoke.mjs phase-3
```

Không có file nào ở đây được sửa tay; README này là bảng đối chiếu duy nhất được viết tay.

- `unit-tests.txt`: 81/81 test xanh. Trong đó `tests/fuel.test.ts` có 23 test cho Ticket-03.
- `verify-summary.txt`: mọi scenario chạy 2 lần, giống nhau byte-by-byte, và khớp khối `expect`. Kết quả: RESULT: PASS.
- `smoke.txt`: 26/26 kiểm tra chạy trên trình duyệt thật (Edge, Playwright). `fps.txt` ghi FPS và cấu hình máy.

Thiết kế ở [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích ở [CHANGELOG.md](../../../CHANGELOG.md). Giả định C1–C10 ở [assumptions.md](../../notes/assumptions.md).

## Yêu cầu → bằng chứng

| # | Yêu cầu (Ticket-03) | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1.1 | Dầu tối đa 100; vừa thắp hoặc thắp lại thì fuel = 100 | unit, scenario | `fuel.test` "relight costs 5…", `relight.jsonl` | PASS |
| 1.2 | Hao 1/giây, tính bằng số nguyên 1/60, chỉ làm tròn khi xuất | unit | `fuel.test` "a lit lantern burns 1 fuel per second" | PASS |
| 1.3 | Châm dầu: used = min(mang, ceil((100 − fuel)/10)); đèn đầy dầu không được chọn; +5 mỗi đom đóm | unit, scenario | `fuel.test` "refuel: used = …", "refuel limited by…", "picks the nearest lantern that can take light"; `refuel.jsonl` | PASS |
| 1.4 | fuel ≤ 0 thì đèn tắt, deposited 0, `lantern_out`, ever_lit giữ true | unit, scenario, smoke | `fuel.test` "fuel <= 0: lantern_out…", `fuel-out.jsonl`, smoke #11 | PASS |
| 1.5 | Ánh sáng môi trường giảm khi đèn tắt | code | `src/render/main.ts` dùng `ambientIntensity(lit, n)` theo số đèn đang sáng | PASS (chỉ đọc code, không đo) |
| 1.6 | Thắp lại cần 5; đèn chưa từng sáng vẫn cần 10 | unit, scenario | `fuel.test` "relight costs 5…", "a never-lit lantern still needs 10"; `relight.jsonl` | PASS |
| 1.7 | Thanh dầu trên đèn sáng; dưới 30 thì đèn và thanh nhấp nháy 1 Hz | ảnh | `05b-lit-fuel-bar.png`, `05c`/`05d` (hai pha nhấp nháy) | PASS. Tần số 1 Hz lấy từ code (`Math.floor(t*2)%2`), không đo bằng thời gian thực |
| 2.1 | fuel < 30 thì mất vùng an toàn; đúng 30 vẫn còn | unit | `fuel.test` "zone exists at exactly 30, not below" | PASS |
| 2.2 | Bóng Mực wander đi tới đèn yếu gần nhất, ≤ 2 m thì `drain`, hút 5/giây, cộng dồn, `fuel_drain` mỗi 60 tick | unit, scenario | `fuel.test` "a wandering shade walks to the weak lantern…", "drains stack…"; `drain.jsonl` | PASS |
| 2.3 | drain → chase (Mây trong 6 m), → stunned (Tỏa sáng), → wander (đèn tắt, fuel ≥ 30, cách > 2 m); hết choáng về wander | unit, scenario | `fuel.test` "drain -> chase…", "drain -> stunned…", "stun ends in wander", "drain -> wander when the lantern goes out"; `drain-pulse.jsonl` | PASS |
| 2.4 | Châm dầu lên ≥ 30 thì đẩy Bóng Mực ra mép vùng trong ≤ 30 tick, không gây sát thương | unit, scenario | `fuel.test` "refuel back to >= 30 pushes draining shades out…"; `refuel-expel.jsonl` | PASS |
| 3.1 | Đêm dài 240 / 270 / 300 s | unit, scenario | `sim.test` night durations, `night3-full-perf.jsonl` (kết thúc ở tick 18 000) | PASS |
| 3.2 | Thắng ở bình minh nếu đèn sáng ≥ ceil(0.6n) (3/5, 4/6, 5/7), `dawn_survived` | unit, scenario, smoke | `fuel.test` "night 1: 3/5 lit…", "thresholds…"; `dawn-win.jsonl`; smoke #20, #22, #24 | PASS |
| 3.3 | Thắp đủ đèn không kết thúc Đêm | unit, scenario | `sim.test` "lighting every lantern does not end the night"; `all-lit-no-early-win.jsonl` | PASS |
| 3.4 | Thua `dawn` khi dưới ngưỡng; `no_flames` luôn được xét trước, kể cả ở tick bình minh | unit, scenario | `fuel.test` "2/5 lit at dawn loses…", "losing the last flame on the dawn tick…"; `dawn-lose.jsonl`, `dawn-no-flames.jsonl` | PASS |
| 3.5 | Thứ tự tick: trừ dầu ở bước 2, đèn tắt ngay sau bước 2, xét thắng/thua cuối tick | unit | `fuel.test` "a lantern going out on the dawn tick does not count" | PASS |
| 4 | Sức chứa = 10 + 2 × successful_lights, tối đa 20; đèn đặt sẵn không tính; HUD hiện đang mang/sức chứa | unit, scenario, smoke | `fuel.test` "10 + 2 x successful_lights…", "lighting (and relighting) raises capacity…"; `capacity.jsonl`; smoke #8, #10 | PASS |
| 5 | Điểm: +5 mỗi đom đóm, +100 / +40, Tỏa sáng +5 (+15 nếu đang drain), thưởng bình minh 50 + floor(fuel) cho mỗi đèn và +50 cho mỗi lửa; bỏ thưởng thời gian | unit, scenario, smoke | `fuel.test` (thưởng bình minh, drain +15); `dawn-win.jsonl` (597), `relight.jsonl` (65), `drain-pulse.jsonl` (15); smoke #25 | PASS |
| 6.1 | Cài đặt "Bảng màu dễ phân biệt", được lưu | smoke | smoke #2, `02-settings.png` | PASS |
| 6.2 | Viền và mắt Bóng Mực đổi #7A3CFF → #00B3FF | unit, ảnh | `palette.test` (P_CB), `13-colorblind.png` | PASS |
| 6.3 | Cảnh báo UI đổi #FF5A5F → #FFFFFF kèm ⚠ | smoke | smoke #19 (`⚠ 00:25`, rgb(255,255,255)) | PASS |
| 6.4 | Đèn tắt xẹp 20% và có vết rách; đèn sắp hết dầu nhấp nháy | ảnh | `05e-lantern-out-torn.png`, `05c`/`05d` | PASS (kiểm bằng mắt) |
| 7 | Contract v1.2: 8 khóa tuning mới, thời lượng mới; snapshot có `fuel`/`ever_lit`/`relit_count`/`capacity`; scenario có trường mới; sự kiện mới | unit, scenario | `contract.test` (contract = TUNING, v1.2), `sim.test` snapshot v1.2, `fuel.test` parse; mọi `*.jsonl` | PASS |
| DoD | ADR về mô hình trạng thái đèn và luật thắng | tài liệu | `docs/adr/0001-lantern-fuel-and-dawn-win.md` | PASS |
| DoD | Test cũ được cập nhật hoặc xóa có lý do, không skip | tài liệu, grep | `CHANGELOG.md` (bảng test bị thay); trong `tests/` không có `.skip` | PASS |
| DoD | Changelog các breaking change | tài liệu | `CHANGELOG.md` BC1–BC12 | PASS |
| DoD | Test Phase 1–2 không bị thay vẫn đạt | unit, scenario | 24 scenario Phase 2 còn lại (scenario `win` đã xóa có lý do) vẫn PASS trong `verify-summary.txt` (tổng 35) | PASS (bộ test ẩn của lab thì không chạy được ở đây) |

## Giới hạn đã biết

- FPS chỉ đo ở Đêm 1, độ phân giải 1280×720: trung bình 120.1. Đêm 2 và Đêm 3 chỉ có ảnh chụp.
- Âm thanh mới (`refuel`, `lantern_out`) có trong code nhưng không được ghi âm làm bằng chứng.
