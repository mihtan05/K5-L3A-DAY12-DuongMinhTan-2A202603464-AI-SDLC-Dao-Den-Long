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

## Phase 2 (Ticket-02, Test Contract v1.1)

Ticket-02 thay toàn bộ tuning Phase 1 bằng số chuẩn, nên các giả định A1–A16 bị thay thế ở những chỗ ticket đã nói rõ (điểm cộng khi **nạp** chứ không phải khi nhặt, `lantern_cost` 10, `safe_radius` 6, có rơi khỏi đảo, vị trí đèn mới…). Bảng dưới chỉ ghi chỗ ticket còn mơ hồ. Tiêu chí nghiệm thu: [docs/spec/phase-2.md](../spec/phase-2.md).

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Tăng tốc/dừng "≤ 0.1 s" | Vận tốc ngang đổi ngay trong 1 tick (0 s ≤ 0.1 s). Giữ đúng 6 m/s trong test Phase 1. |
| B2 | Va chạm địa hình | Bước lên tối đa 0.3 m mỗi tick (đủ cho dốc), cao hơn là vách: chặn, thử trượt theo từng trục X/Z. Dưới chân thấp hơn 0.3 m thì rơi. Ngoài đảo là biển mây (không có mặt đất). |
| B3 | Lướt và vận tốc dọc | Trong 12 tick lướt không áp trọng lực và giữ `vy` (giữ nguyên độ cao). Lướt khi đang bay từ bục: ngang theo hướng lướt, hết lướt thì vận tốc phóng tiếp tục tới khi chạm đất. |
| B4 | Hồi chiêu khi có Bùa | Lướt vẫn đặt hồi chiêu 90 tick nhưng Bùa bỏ qua nó; `dash_cd_s` vẫn báo số thật. |
| B5 | Xuất phát Đêm 2, 3 | Ticket chỉ nói Đêm 1. Đêm 2: (0,0,0) mặt +Z. Đêm 3: (0,0,−25) mặt +Z, vì (0,0,0) nằm trong tháp chuông. |
| B6 | Trạng thái Bóng Mực | `spawning` 60 tick (không đi, không đánh). Sau đó `wander` (2 m/s tới một điểm sinh đom đóm ngẫu nhiên) ↔ `chase` (≤ 12 m vào, > 18 m ra). Bóng Mực đi trên mặt đất, không lên vách, không ra biển; tâm cao hơn mặt đất 1 m. Bóng trong scenario không ghi `state`: `chase` nếu cách ≤ 12 m, ngược lại `wander`. |
| B7 | Ai gây hit | Bóng ở `wander` hoặc `chase`, không đang bị đẩy ra khỏi vùng an toàn. Chênh cao đo giữa tâm Bóng và chân Mây. |
| B8 | Đẩy ra khỏi vùng an toàn | Mỗi tick (bước 6) bóng nào ở trong vùng 6 m của đèn đã sáng mà chưa bị đẩy thì bắt đầu bị đẩy: đi đều ra mép trong đúng 30 tick, không đi theo trạng thái, không gây sát thương. |
| B9 | Trần 30 đom đóm, "điểm trống" | Chỉ tính đom đóm `random`. Điểm trống = không có đom đóm `random` nào cách điểm đó < 0.5 m. Đom đóm `dropped` không tính. |
| B10 | Đom đóm rơi ra ngoài đảo | Vị trí ở vành 1.5–2.5 m (góc, bán kính ngẫu nhiên); Y = mặt đất tại đó, nếu là biển thì lấy Y của Mây. |
| B11 | "Điểm sương" của Gió Lạc | Dùng các điểm sinh Bóng Mực của Đêm đó. Gió Lạc bay, bỏ qua địa hình, Y = mặt đất tại điểm sinh + 1.5. `idle` lượn 2 m/s tới điểm sinh đom đóm ngẫu nhiên. |
| B12 | Gió Lạc chạm khi nào | Ở `idle` hoặc `chase`, chưa cướp lần nào, Mây đang mang > 0 và không đang chờ hồi sinh. |
| B13 | Gió Lạc `removed` | Giữ trong mảng `drifters` với `state: "removed"` (không di chuyển, không tính vào giới hạn 2). |
| B14 | Gió | Báo trước từ sim_tick 1800k − 120, hướng chọn lúc đó (rng). Thổi trong [1800k, 1800k + 300), k ≥ 1. `wind_enabled` mặc định bật ở Đêm 3, tắt ở Đêm 1, 2. `dir_deg` là hướng cơn gió gần nhất (0 nếu chưa có). |
| B15 | `night_start` | Ghi một dòng event `tick: 0` ngay sau snapshot tick 0. |
| B16 | Tạm dừng | Bước vừa nhấn `resumed` chạy đầy đủ. Dòng `end` dùng cùng `state` với snapshot (có thể là `paused`). |
| B17 | `invuln` trong snapshot | Boolean (đang bất tử hay không). Các trường `_s` là giây, làm tròn 3 số. |
| B18 | `ttl_s` của đom đóm `random` | `null`. |
| B19 | Thứ tự "id tăng dần" | So phần chữ, rồi phần số ở cuối (S2 < S10). |
| B20 | Tầm nạp đèn, vùng an toàn | Đo theo XZ như contract v1.0. Tỏa Sáng đo 3D như ticket. |
| B21 | Scenario `charms[]` | `{id, pos?, available?, respawn_ticks?}`; thiếu `pos` thì lấy vị trí bùa cùng id của Đêm, không có thì (0,0,0). `drifters[]`: `{id?, pos, state?, stolen?, state_ticks_left?}`. |
