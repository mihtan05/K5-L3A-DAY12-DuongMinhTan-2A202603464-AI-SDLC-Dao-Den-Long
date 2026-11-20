# Spec Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)

Nguồn: [docs/lab/TICKET-02.md](../lab/TICKET-02.md). Số chuẩn nằm ở `src/core/tuning.ts`, bản đồ ở `src/core/maps.ts`.
Giả định cho chỗ ticket chưa nói rõ: mục B ở [docs/notes/assumptions.md](../notes/assumptions.md).

## Acceptance criteria — Phần 3 (tính năng mới)

Mỗi dòng kèm cách kiểm chứng: `S:` là scenario headless trong `tests/scenarios/`, `U:` là unit test trong `tests/`, `B:` là kiểm tra trong trình duyệt (`scripts/smoke.mjs`, ảnh ở `docs/proof/phase-2/`).

### Gió Lạc (Đêm 2, 3)
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| D1 | Khi `random_drifters` bật ở Đêm 2/3, Gió Lạc sinh tại sim_tick 1200, 2400, … nếu đang có < 2 con chưa `removed`; id D1, D2…; không sinh ở Đêm 1 | U `drifters spawn` |
| D2 | `idle` lượn 2 m/s; chuyển `chase` khi Mây mang ≥ 5 và cách ≤ 15 m (XZ); mất điều kiện thì về `idle` | S `drifter-steal`, U |
| D3 | Chạm XZ ≤ 1.2 m (khi `idle`/`chase`, Mây đang mang > 0) → cướp min(3, đang mang), sự kiện `drifter_steal {drifter_id, amount, carried}`, chuyển `flee` 240 tick rồi `removed`. Bất tử không ngăn cướp. Không mất Ngọn Lửa | S `drifter-steal` |
| D4 | Mỗi con cướp tối đa 1 lần | U |
| D5 | Tỏa Sáng trúng con `chase` → `flee`, `stolen = 0`, không cướp | U `pulse drifter` |
| D6 | Tỏa Sáng trúng con `flee` đang mang → `drifter_drop {drifter_id, amount}`, số đom đóm thả thành `dropped` (TTL 480) tại chỗ, 120 tick sau `removed` | S `drifter-drop` |
| D7 | Vùng an toàn không chặn Gió Lạc | U |

### Bùa Gió
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| C1 | Đêm 2 có C1 (35,0,0); Đêm 3 có C1 (30,0,25), C2 (−30,0,25); Đêm 1 không có | U |
| C2 | Nhặt như đom đóm (XZ ≤ 1, chênh cao ≤ 1.5) → `charm_picked {charm_id, charm_ticks: 600}`, `charm_s` = 10; bùa biến mất, `respawn_s` = 45, xuất hiện lại sau 2700 tick | S `charm` |
| C3 | Trong hiệu lực: chạy 7.2 m/s; Lướt không hồi chiêu nhưng phải nhấn lại; nhấn khi đang lướt bị bỏ qua | S `charm`, U |
| C4 | Nhặt lại khi còn hiệu lực → làm mới về 600 tick | U |

### Lướt (Phần 1, mới)
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| L1 | Nhấn `dash` → 12 tick ở 14 m/s theo hướng di chuyển (đứng yên: hướng mặt), sự kiện `dash {}`, hồi chiêu 90 tick tính từ lúc bắt đầu | S `dash` |
| L2 | Lướt trên không giữ nguyên độ cao | U |

### Rơi khỏi đảo, bục nhảy, gió, bản đồ 3 Đêm
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| F1 | Y < −10 → `player_hit {by:"fall", flames, dropped: 0, lost}`, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick; bỏ qua bất tử | S `fall` |
| F2 | Rơi khi còn 1 Ngọn Lửa → thua `no_flames` ngay tick đó | U |
| J1 | Đêm 2: chạm bục → bay ~1.4 s, đáp trong đảo kia | S `night2-pad` |
| J2 | Đêm 3: bục (0,3,13) → đáp lên tầng 2 (Y = 6) | S `night3-pad` |
| M1 | Đêm 3: vách tầng không đi lên được; dốc 30°/150° đưa lên tầng 1; tháp không leo được | U `terrain` |
| W1 | Đêm 3: gió mỗi 30 s, kéo 5 s, đẩy 2 m/s; snapshot `wind {active, dir_deg}` | S `wind` |

### Tạm dừng
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| P1 | Nhấn `pause` → sự kiện `paused`, bước dừng; `tick` vẫn tăng, `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `state: "paused"` | S `pause` |
| P2 | Nhấn lại → `resumed`, bước đó chạy bình thường | S `pause` |
| P3 | Trong game: Esc/P mở menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | B |

### Chuỗi 3 Đêm, cài đặt, âm thanh, HUD, màu, ánh sáng
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| N1 | Menu chính → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thua thì chơi lại Đêm đó; thắng Đêm 3 → màn Bình Minh với tổng điểm = tổng điểm các Đêm đã thắng | B |
| N2 | Headless `--night 1|2|3` dựng đúng bản đồ, đèn, thời lượng; sự kiện `night_start {night}` ở tick 0 | U, S `night2-default`, `night3-default` |
| G1 | Âm lượng và độ nhạy chuột lưu trong `localStorage`, còn sau khi tải lại trang | B |
| A1 | Có nhạc nền đêm và âm cho: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối | B (danh sách âm trong `src/render/audio.ts`) |
| H1 | HUD: Ngọn Lửa trên trái; đồng hồ mm:ss trên giữa (đỏ + nhấp nháy khi ≤ 30 s); đèn k/n + điểm trên phải; thanh 10 ô dưới giữa; hồi chiêu Lướt + Tỏa Sáng dưới phải; nhắc "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | B ảnh `hud-*.png` |
| K1 | Màu các thành phần trong bảng dùng đúng hex chuẩn (định nghĩa một chỗ: `src/render/palette.ts`) | U `palette` |
| K2 | Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn) | U `palette` |
| R1 | ≥ 30 FPS trung bình ở 1280×720 | B `fps.txt` |

## Phần 4 — Contract v1.1
| # | Tiêu chí | Kiểm chứng |
|---|---|---|
| T1 | `game.contract.json` v1.1 khớp `TUNING` (có 5 khóa mới) | U `contract` |
| T2 | Snapshot có `night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes[]{id,pos,kind,ttl_s}`, `drifters[]`, `charms[]` | U `snapshot shape` |
| T3 | Trạng thái Bóng Mực chỉ thuộc `spawning, wander, chase, recoil, stunned` | U |
| T4 | Một Đêm đầy đủ 21 600 tick chạy ≤ 30 s | U `perf` (đo thời gian) |
| T5 | Mọi scenario Phase 1 vẫn chạy (đã cập nhật theo số chuẩn) và tất định | `npm run verify` |
