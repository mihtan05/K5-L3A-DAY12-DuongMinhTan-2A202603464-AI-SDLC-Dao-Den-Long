# Bằng chứng Phase 1

Tạo lại: `npm run verify -- phase-1` và `npm run build && npm run smoke -- phase-1` ở tag `phase-1`.
Máy: Windows 11, Node 24; CI chạy lại trên ubuntu-latest mỗi lần push.

| Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` khớp số game dùng | `tests/contract.test.ts` | [unit-tests.txt](unit-tests.txt) | PASS |
| Mô hình tick, snapshot tick 0, `time_left_s`, dòng `end` | unit › tick model | unit-tests.txt | PASS |
| Đi lại theo `cam_yaw_deg`, chuẩn hóa vector | unit › movement | unit-tests.txt | PASS |
| Nhảy | unit + trình duyệt (y = 0.52 sau Space) | [smoke.txt](smoke.txt) | PASS |
| Nhặt đom đóm (tick 20 và 50 khi đi 6 m/s tới z = 3 và 6) | scenario | [walk-pickup.jsonl](walk-pickup.jsonl) | PASS |
| Nạp đèn, thắp đèn, thắng `all_lit`, điểm 100 + 299 + 150 = 549 | scenario | [win.jsonl](win.jsonl) | PASS |
| Tỏa sáng choáng A, B trong 6 m, bỏ qua FAR; hết choáng sau 3 s | scenario | [pulse.jsonl](pulse.jsonl) | PASS |
| Bóng Mực đuổi, chạm ở tick 52, rơi 3/1/1 đom đóm, thua `no_flames` | scenario | [hit-lose.jsonl](hit-lose.jsonl) | PASS |
| Bóng Mực không vào vùng 4 m quanh đèn đã thắp | scenario + unit | [safe-radius.jsonl](safe-radius.jsonl) | PASS |
| Hết giờ → thua `dawn` | scenario | [dawn.jsonl](dawn.jsonl) | PASS |
| Chạy mặc định có sinh ngẫu nhiên | scenario | [default-seed1.jsonl](default-seed1.jsonl) | PASS |
| Tính tất định (cùng seed/scenario/inputs → giống hệt) | verify chạy mỗi scenario 2 lần và so khớp | [verify-summary.txt](verify-summary.txt) | PASS |
| File inputs/scenario sai → mã thoát 2 | scenario `bad-inputs`, `bad-scenario` | verify-summary.txt | PASS |
| Chơi được trong trình duyệt, HUD, không lỗi console | `scripts/smoke.mjs` (Edge, Playwright) | [smoke.txt](smoke.txt), [01-start.png](01-start.png), [02-moved.png](02-moved.png) | PASS |
| Màn thắng hiện, chơi lại bằng R | smoke: dựng sẵn 4 đèn đã thắp (giống scenario `win`), bấm E thật → `won` + thông báo; bấm R → `playing` tick 20 | [smoke.txt](smoke.txt), [03-won.png](03-won.png) | PASS |
| Chơi trọn một đêm từ đầu tới thắng bằng tay | Chơi tay | — | **CHƯA CÓ BẰNG CHỨNG** (sẽ có trong video Phase 4) |

## Lỗi phát hiện nhờ kiểm chứng
- Smoke lần 1: bấm Space nhanh không nhảy, vì phím xuống/lên lọt giữa hai tick. Sửa: chốt phím đã nhấn tới tick kế tiếp (`tapped` trong `src/render/main.ts`). Smoke kiểm tra y > 0 sau Space.
- Smoke lần 1: lỗi 404 `favicon.ico`. Sửa: favicon rỗng trong `index.html`.
