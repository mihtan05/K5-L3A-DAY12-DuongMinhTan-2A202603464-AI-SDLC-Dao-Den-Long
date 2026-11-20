# Changelog

## [Phase 3] — Ticket-03 "Đèn cạn dầu", Test Contract v1.2

Thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md) · Ticket: [docs/lab/TICKET-03.md](docs/lab/TICKET-03.md)

### ⚠ Breaking changes
| # | Thay đổi | Trước (v1.1) | Sau (v1.2) |
|---|---|---|---|
| BC1 | `contract_version` | `"1.1"` | `"1.2"` + 8 khóa tuning mới (`fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`) |
| BC2 | Thời lượng Đêm 1/2/3 | 300 / 330 / 360 s | 240 / 270 / 300 s |
| BC3 | Luật thắng | Thắng ngay khi mọi đèn sáng, `reason: "all_lit"` | Chỉ xét ở bình minh: còn lửa và đèn đang sáng ≥ ceil(0.6 × n) → `dawn_survived`; `all_lit` bỏ hẳn |
| BC4 | Đèn đã sáng | Sáng mãi, không nhận thêm đom đóm | Có `fuel` 0–100, hao 1/s, tắt khi hết (`lantern_out`, `deposited = 0`), châm dầu được (`refuel`), thắp lại tốn 5 |
| BC5 | Vùng an toàn | Mọi đèn sáng | Chỉ đèn sáng có `fuel ≥ 30` |
| BC6 | Bóng Mực | 5 trạng thái; hết choáng về `chase`/`wander` theo khoảng cách; `wander` đi tới điểm ngẫu nhiên | Thêm `drain`; hết choáng luôn về `wander`; `wander` đi tới đèn yếu gần nhất → đèn tắt gần nhất → (không có) điểm ngẫu nhiên |
| BC7 | Điểm | +10/đom đóm nạp, +100/đèn, +5/Bóng Mực, thưởng thắng 2 × giây còn lại + 50 × lửa | +5/đom đóm nạp (cả châm dầu), +100 thắp lần đầu, +40 thắp lại, +5/Bóng Mực (+15 nếu đang `drain`), thưởng bình minh Σ(50 + floor(fuel)) đèn sáng + 50 × lửa; `score.per_mote` 10 → 5, `score.per_second_left` 2 → 0 |
| BC8 | Sức chứa | Cố định 10 | 10 + 2 × `successful_lights`, tối đa 20 |
| BC9 | Snapshot | — | Đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`; Bóng Mực có thể ở `drain` |
| BC10 | Sự kiện | `lantern_lit {lantern_id}` | `lantern_lit {lantern_id, relight}`; mới: `refuel`, `lantern_out`, `fuel_drain`; `game_over.reason` thêm `dawn_survived`, bỏ `all_lit` |
| BC11 | Scenario | — | Đèn thêm `fuel`, `ever_lit` (`lit: true` không có `fuel` → 100); `player.successful_lights`; `shades[].target_lantern_id` |
| BC12 | Render | Màn kết thúc khi thắp đủ đèn | Chỉ kết thúc ở bình minh hoặc hết lửa; HUD "Đèn sáng k/n · cần m", "đang mang/sức chứa", nhắc châm dầu; thanh dầu + nhấp nháy 1 Hz; cài đặt "Bảng màu dễ phân biệt" |

### Test và scenario bị thay (cập nhật hoặc xóa, có lý do)
| Test / scenario | Xử lý | Lý do |
|---|---|---|
| `sim.test` › "wins when all lanterns are lit … bonus = 2 x floor(s left)" | **Thay** bằng "lighting every lantern does not end the night" | BC3 (bỏ thắng sớm), BC7 (bỏ thưởng thời gian) |
| `sim.test` › "win on the exact dawn tick still wins" | **Viết lại**: thắp ở tick bình minh vẫn được tính vào số đèn sáng | BC3 |
| `sim.test` › "snapshot has every v1.1 field" | **Cập nhật** thành v1.2 (thêm `capacity`, trường đèn) | BC9 |
| `sim.test` › tick model, pause, night durations | **Cập nhật** 300/330/360 → 240/270/300 | BC2 |
| `sim.test` › "lantern remembers partial deposits" | **Cập nhật** `lantern_lit` có `relight: false` | BC10 |
| `sim.test` › "a full night (21 600 ticks)" | **Cập nhật**: Đêm 3 giờ dừng ở tick 18 000 (vẫn ≤ 21 600) | BC2 |
| scenario `win` (thắng `all_lit`, điểm 948) | **Xóa**, thay bằng `all-lit-no-early-win` + `dawn-win` | BC3, BC7 |
| scenario `night3-full-perf` | **Cập nhật** `expect.end.ticks` 21600 → 18000 | BC2 |

Không có test nào bị `skip`. Test mới: `tests/fuel.test.ts` (23 test) và 11 scenario (`fuel-out`, `refuel`, `relight`, `capacity`, `drain`, `drain-pulse`, `refuel-expel`, `dawn-win`, `dawn-lose`, `dawn-no-flames`, `all-lit-no-early-win`).

## [Phase 2] — Ticket-02 "Ba hòn đảo", Test Contract v1.1
Xem [docs/notes/changes.md](docs/notes/changes.md) (các dòng Phase 2) và [docs/spec/phase-2.md](docs/spec/phase-2.md).

## [Phase 1] — PRD-0, Test Contract v1.0
Bản đầu tiên.
