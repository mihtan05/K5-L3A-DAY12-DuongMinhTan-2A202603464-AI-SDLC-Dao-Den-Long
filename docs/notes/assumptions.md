# Giả định và tiêu chí nghiệm thu

## Phase 1 (PRD-0, Test Contract v1.0)

Contract là bắt buộc và chính xác; các mục dưới là chỗ PRD-0 mơ hồ, mình tự quyết định. Mọi con số nằm ở `src/core/tuning.ts` và khớp `game.contract.json` (có test).

### Giả định luật chơi
| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A1 | Máu | `flames` = 3 ngọn lửa. Về 0 → thua `no_flames`. |
| A2 | Nhặt đom đóm | Tự động khi trong `pickup_radius` (không cần bấm), theo thứ tự danh sách, tối đa `carry_capacity`. |
| A3 | Nạp đèn | Nhấn `interact` trong `interact_radius` của đèn **chưa thắp** gần nhất. Nạp `min(carried, lantern_cost − deposited)`. Đủ `lantern_cost` thì thắp. |
| A4 | Tỏa sáng | Tốn `pulse_cost` đom đóm đang mang. Không đủ hoặc đang hồi (`pulse_cooldown_s`) → không có gì xảy ra, không ghi event. Không có Bóng Mực trong tầm vẫn tốn và ghi `pulse` với `stunned_ids: []`. |
| A5 | Pulse trúng | Mọi Bóng Mực trong `pulse_radius` (kể cả đang choáng) bị choáng lại `pulse_stun_s` và đẩy ra xa người chơi `pulse_push_m`. `per_stun` tính cho mỗi con. |
| A6 | Bóng Mực "sợ đèn" | Không vào được `safe_radius` quanh đèn **đã thắp** (đèn tắt thì không bảo vệ). |
| A7 | Bị chạm | Bóng Mực trạng thái `chase` trong `shade_hit_radius` → mất 1 lửa, rơi `floor(carried × hit_drop_ratio)` đom đóm (mất hẳn), bất tử `invuln_s`. Mỗi tick tối đa một lần chạm. Bóng Mực choáng không gây sát thương. |
| A8 | Rơi khỏi đảo | `fall_enabled: false`: mép đảo (bán kính 30 m) giữ người chơi lại, không có event `fall`. |
| A9 | Hết giờ | Hết `night1_duration_s` (300 s) mà chưa thắp đủ → thua, `reason: "dawn"`. |
| A10 | Điểm thưởng | Chỉ khi **thắng**: `per_second_left × floor(time_left_s)` + `per_flame_left × flames`. Thua thì không có thưởng. |
| A11 | Sinh ngẫu nhiên | 30 đom đóm lúc đầu, cứ 2 s thêm 1 nếu ít hơn 30. 2 Bóng Mực lúc đầu trên vòng bán kính 27 m, cứ 40 s thêm 1 (tối đa 5), có event `shade_spawned`. Sinh lúc dựng màn không ghi event. |
| A12 | Vị trí đèn | L1…L5 trên vòng tròn bán kính 18 m, L1 tại (0, 0, 18), cách nhau 72°. |
| A13 | Thứ tự trong một bước | timer → di chuyển → nhảy → nhặt → nạp đèn → kiểm tra thắng → tỏa sáng → Bóng Mực di chuyển + vùng an toàn → bị chạm → sinh mới → hết giờ. Kết thúc thì dừng bước đó. |
| A14 | Scenario | `motes`/`shades` có mặt thì thay danh sách đầu; `random_*: false` tắt cả sinh lúc đầu lẫn sinh thêm. Bóng Mực trong scenario không có `id` nhận `S1, S2…` (bỏ qua id đã dùng). Đèn đặt `lit: true` giữ nguyên `deposited`. |
| A15 | Lỗi | File inputs/scenario không đọc được hoặc sai định dạng → mã 2. Tham số dòng lệnh sai (thiếu `--ticks`, `--night` ≠ 1) → mã 1. |
| A16 | Snapshot | Không thêm snapshot riêng khi game kết thúc giữa chu kỳ; dòng `end` luôn là dòng cuối. Có kèm mảng `motes` (khuyến nghị). |

### Tiêu chí nghiệm thu → kiểm chứng
| Yêu cầu | Kiểm chứng |
|---|---|
| Đi lại theo camera, chuẩn hóa vector | `tests/sim.test.ts` › movement (3 test) |
| Nhảy | unit test + `scripts/smoke.mjs` (y > 0 sau khi bấm Space trong trình duyệt) |
| Nhặt đom đóm | unit + scenario `walk-pickup` |
| Nạp đèn, thắp đèn, thắng | unit + scenario `win` |
| Bóng Mực đuổi, chạm mất lửa, thua | unit + scenario `hit-lose` |
| Tỏa sáng xua Bóng Mực | unit + scenario `pulse` |
| Bóng Mực sợ đèn | unit + scenario `safe-radius` |
| Hết giờ | unit + scenario `dawn` |
| Tính tất định | `npm run verify` chạy mỗi scenario 2 lần và so khớp; unit test seed 7 vs 7/8 |
| Mã thoát 2 khi file sai | scenario `bad-inputs`, `bad-scenario` + unit parsing |
| HUD, chơi được trong trình duyệt | `scripts/smoke.mjs` + ảnh `docs/proof/phase-1/*.png` |
