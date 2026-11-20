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

## Phase 3 (Ticket-03, Test Contract v1.2)

Ticket-03 thay một số giả định trước: A10 (thưởng thời gian khi thắng, nay `per_second_left` = 0 và thưởng tính theo đèn ở bình minh), B6 (Bóng Mực `wander` đi tới điểm ngẫu nhiên, hết choáng về `chase`/`wander`) và B8 (vùng an toàn của mọi đèn sáng). Thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| C1 | "đi về đèn tắt gần nhất như trước" khi không có đèn yếu | `wander` đi tới đèn tắt gần nhất rồi đứng chờ trong 2 m; nếu mọi đèn đều sáng mạnh thì đi tới điểm ngẫu nhiên như Phase 2. |
| C2 | Hết choáng | Luôn về `wander` (ticket). Bước 8 cùng tick vẫn chuyển sang `chase` nếu Mây trong 12 m. |
| C3 | Scenario `lit: true` không ghi `ever_lit` | `ever_lit = true` (đèn đang sáng thì đã từng sáng). Đèn không sáng thì bỏ qua `fuel`, coi như 0. |
| C4 | Thứ tự trừ dầu ở bước 2 | Mọi đèn sáng hao 1 đơn vị (1/60), rồi từng Bóng Mực `drain` hút 5 đơn vị theo id tăng dần; sau đó đèn ≤ 0 tắt. |
| C5 | `fuel_drain` | Mỗi Bóng Mực đếm tick đang hút từ lúc vào `drain`; tick thứ 60, 120, … ghi sự kiện với dầu ngay sau lượt hút của nó (không âm). |
| C6 | Điểm mới không có khóa contract | `score.per_mote` = 5, `per_lantern` = 100, `per_stun` = 5, `per_flame_left` = 50, `per_second_left` = 0 (thưởng thời gian bỏ). +40 thắp lại, +15 trúng lúc `drain`, +50 mỗi đèn ở bình minh nằm ở `RULES` vì contract v1.2 không liệt kê khóa cho chúng. |
| C7 | Bóng Mực `drain` có gây sát thương không | Không; chỉ `wander`/`chase` gây hit như Phase 2. Khoảng cách 6 m chuyển sang `chase` đo XZ, tính cả đúng 6 m. |
| C8 | "Đèn đầy dầu (used = 0)" | Theo đúng công thức: vì bước 2 trừ dầu trước bước 5, đèn sáng lúc tương tác luôn < 100 nên nhận ít nhất 1 đom đóm (ceil). Chỉ đèn có `fuel` đúng 100 (không xảy ra trong chơi thường) mới bị bỏ qua. |
| C9 | Gió Lạc và dầu | Không đổi: Gió Lạc không hút dầu, vùng an toàn vẫn không chặn nó. |
| C10 | Màu thanh dầu khi yếu | Đỏ #FF5A5F + nhấp nháy 1 Hz (đèn và thanh cùng tắt nửa giây); ở chế độ mù màu, nhấp nháy và đèn tắt bị xẹp + rách vẫn phân biệt không cần màu. |

## Phase 4 (Ticket-04, Test Contract v1.3)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| D1 | "Cửa sổ 1280×720" với bản web | Khung vẽ (viewport của trang) đúng 1280×720. Cửa sổ trình duyệt bên ngoài to hơn một chút vì có viền. Tắt vsync bằng cờ Chromium `--disable-gpu-vsync --disable-frame-rate-limit`. Bằng chứng tắt được: FPS đo vượt tần số quét 120 Hz của màn hình. |
| D2 | "Rải đều trên đảo (seed 42)" | Lấy điểm ngẫu nhiên đều trong hình vuông [−45, 45]² bằng `makeRng(seed)`, chỉ giữ điểm có `ground()` hữu hạn, tức là phân bố đều theo diện tích đảo. Bóng Mực đặt ở mặt đất + 1 m, đom đóm ở mặt đất. Không có Gió Lạc và tắt gió. |
| D3 | Cách đo khung hình | `dt` là hiệu timestamp giữa hai lần `requestAnimationFrame` liên tiếp. Chỉ tính khung kết thúc trong khoảng (3 s, 3 s + duration], đếm từ khung đầu tiên của cảnh bench. p95 lấy theo phương pháp nearest-rank: phần tử thứ ⌈0.95·N⌉ sau khi sắp xếp. |
| D4 | `load_ms` "từ lúc tiến trình bắt đầu" | Tính từ lúc tiến trình `node scripts/bench.mjs` bắt đầu (`performance.timeOrigin`) tới timestamp khung đầu tiên của cảnh bench. Bước `vite build` trong `npm run bench` chạy ở tiến trình trước đó nên không tính vào. |
| D5 | Soak: "Đêm thứ i dùng seed 7 + i" | i đếm từ 1, nên seed là 8…17. Đêm thứ i là Đêm `((i − 1) mod 3) + 1`. Input dùng một luồng rng riêng (`makeRng((seed + i) ^ 0x5eed)`): hướng đi là vector đơn vị có góc ngẫu nhiên đều; 4 xác suất được tung độc lập mỗi tick. Không bấm tạm dừng. Mỗi Đêm chạy tới khi `game_over` (bình minh hoặc hết lửa). |
| D6 | `mem_start_mb` / `mem_end_mb` | `mem_start_mb` là RSS ngay sau `createGame` của Đêm 1, trước tick đầu tiên. `mem_end_mb` là RSS sau khi bỏ tham chiếu tới Đêm cuối. Cả hai đều đo sau khi gọi `gc()` (chạy với `--expose-gc`). |
| D7 | `peak_mem_mb` của bản web | Ghi `null` vì trang web không đọc được RSS của các tiến trình trình duyệt. Có thêm `js_heap_peak_mb` (Chromium `performance.memory`) để tham khảo. |
| D8 | Tên trên bảng xếp hạng | Chuẩn hóa NFC, cắt khoảng trắng hai đầu. Hợp lệ khi có 3–12 ký tự Unicode thuộc nhóm chữ, dấu, số hoặc `_` (nên nhận cả tiếng Việt có dấu). Không cho khoảng trắng hay ký hiệu. |
| D9 | "Lưu trên đĩa cục bộ" | Server game (`npm start`, `npm run dev`, bản Release) ghi file `data/leaderboard.json`, đổi tên file tạm để không bao giờ để lại file ghi dở. Nếu game chạy trên một web server tĩnh khác, bảng lưu vào `localStorage` của trình duyệt (vẫn nằm trên đĩa, nhưng chỉ dùng được với trình duyệt đó). |
| D10 | Điểm lưu sau khi thua | `score` là tổng điểm các Đêm đã thắng trong lượt chơi này (Đêm thua tính 0), `nights_won` là số Đêm đã thắng. `seed` là seed của lượt chơi, Đêm n dùng `seed + n − 1`. `achieved_at` do server ghi theo giờ máy, kèm offset (ví dụ `+07:00`). |
| D11 | Bằng điểm | Ai có `achieved_at` sớm hơn đứng trên. Cùng thời điểm (cùng giây) thì mục đã có trên bảng đứng trên. |
| D12 | Đổi phím | Mỗi hành động có đúng một phím. Gán một phím đang dùng cho hành động khác thì bị từ chối và game báo rõ hành động kia. Mặc định: W/S/A/D, Space, Shift trái, E, F, Esc. Phím ← → xoay camera, trừ khi chúng đã được gán cho một hành động. |
| D13 | Phụ đề / chỉ báo | Bật mặc định và tắt được trong Cài đặt. Mũi tên Bóng Mực chỉ hiện 3.5 s sau khi nó xuất hiện và chỉ khi nó nằm ngoài màn hình. Thêm phụ đề "Đèn Lx đã tắt". |
| D14 | Giảm chuyển động | Trước Phase 4 game chưa có rung camera hay chớp màn hình. Phase 4 thêm cả hai (khi bị đánh: rung + chớp đỏ; khi tỏa sáng: chớp vàng nhẹ) và tùy chọn tắt chúng. Giá trị mặc định theo `prefers-reduced-motion` của hệ điều hành. |
| D15 | Cảnh bench và phần sáng tạo | Cảnh bench không có thực thể sáng tạo nào khác ngoài các prefab chuẩn. HUD vẫn hiện như lúc chơi. Nhạc nền tắt vì cảnh không có input. Để chịu được 200 Bóng Mực, mesh "thở" của Bóng Mực được dùng chung và chỉ biến dạng một lần mỗi khung; chỉ phần hiển thị thay đổi. |
| D16 | Chọn đảo (sau v1.0.0) | Chơi luyện tập một Đêm bất kỳ. Không sang Đêm kế và không lưu bảng xếp hạng, vì điểm xếp hạng là tổng một lượt chơi từ Đêm 1. |
