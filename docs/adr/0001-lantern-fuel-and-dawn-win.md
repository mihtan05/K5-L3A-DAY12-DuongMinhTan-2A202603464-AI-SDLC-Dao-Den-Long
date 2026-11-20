# ADR 0001 — Đèn có nhiên liệu, thắng ở bình minh (Phase 3, Ticket-03)

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-20
- Nguồn: [docs/lab/TICKET-03.md](../lab/TICKET-03.md)

## Bối cảnh
Đến Phase 2, đèn là trạng thái một chiều: `chưa sáng → sáng` (cố định), và game kết thúc ngay khi mọi đèn sáng (`all_lit`). Người chơi giỏi thắng sau 2 phút, cuối Đêm không còn căng thẳng. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh": đèn tiêu dầu, có thể tắt và thắp lại, Bóng Mực hút dầu đèn yếu.

## Quyết định

### 1. Mô hình trạng thái đèn
```
          nạp đủ cost (10 lần đầu, 5 nếu ever_lit)
  ┌──────────┐  ───────────────────────────────▶  ┌───────────────────────┐
  │   TẮT    │                                    │ SÁNG, fuel ≥ 30       │ ← có vùng an toàn 6 m
  │ fuel = 0 │  ◀───────── fuel ≤ 0 ──────────┐   └──────────┬────────────┘
  └──────────┘      (lantern_out,             │      hao 1/s │ ▲ châm dầu ≥ 30
                     deposited = 0)           │              ▼ │ (đẩy Bóng Mực ra)
                                              │   ┌───────────────────────┐
                                              └── │ SÁNG YẾU, fuel < 30   │ ← mất vùng an toàn,
                                                  └───────────────────────┘   Bóng Mực tới hút 5/s
```
- Đèn giữ thêm 3 trường: `fuel` (lưu **số nguyên đơn vị 1/60**: tối đa 6000, hao 1/tick, mỗi Bóng Mực hút 5/tick; chỉ đổi ra số thực 1 chữ số khi xuất snapshot), `everLit`, `relitCount`.
- "Sáng yếu" không phải trạng thái lưu riêng mà là điều kiện suy ra `lit && fuel < 30`. Một hàm `zoneActive(l) = l.lit && fuel ≥ 1800` dùng chung cho chặn, đẩy ra (bước 6) và chọn mục tiêu Bóng Mực, để luật "đúng 30 vẫn còn vùng" chỉ nằm ở một chỗ.
- Bước 6 dùng một luật chung cho cả hai tình huống "đèn vừa thắp" và "đèn được châm lên ≥ 30": Bóng Mực nào đang ở trong vùng của đèn có vùng an toàn mà chưa bị đẩy thì bắt đầu bị đẩy 30 tick. Nhờ vậy không cần phát hiện riêng sự kiện châm dầu.
- Tương tác chỉ xét đèn "nhận được": tắt (còn thiếu dầu thắp), hoặc sáng mà `used > 0`. Thứ tự chọn giữ như cũ (gần nhất, bằng thì id nhỏ).

### 2. Luật thắng
- Bỏ kiểm tra `all_lit` ở bước 11. Bước 11 (sau mọi cập nhật, kể cả tick bình minh): `flames ≤ 0` → thua `no_flames`; hết giờ → đếm đèn đang sáng, `≥ ceil(0.6 × n)` → thắng `dawn_survived`, ngược lại thua `dawn`.
- Điểm bình minh chỉ cộng khi thắng: mỗi đèn sáng `50 + floor(fuel)`, mỗi lửa `50`. Thưởng thời gian bỏ (`per_second_left: 0` trong contract).

### 3. Bóng Mực
- Thêm trạng thái `drain`. `wander` mỗi tick chọn mục tiêu: đèn sáng yếu gần nhất → nếu không có, đèn tắt gần nhất → nếu không có (mọi đèn đều sáng mạnh), điểm ngẫu nhiên như Phase 2.
- Hết choáng → `wander` (trước đây về `chase`/`wander` theo khoảng cách); bước 8 cùng tick vẫn có thể chuyển sang `chase` nếu Mây trong 12 m.

## Hệ quả
- Dòng thời gian một Đêm luôn dài đúng thời lượng trừ khi thua `no_flames`; test và scenario "thắng sớm" của Phase 1–2 bị thay (xem [CHANGELOG.md](../../CHANGELOG.md)).
- Lưu dầu bằng số nguyên làm phép so sánh `fuel < 30`, `fuel ≤ 0` chính xác tuyệt đối, headless tất định trên mọi máy.
- Sức chứa phụ thuộc `successful_lights` nên nhặt đom đóm giờ đọc `capacity(player)` thay vì hằng `carry_capacity`.
- Render đọc cùng `zoneActive`/ngưỡng để vẽ thanh dầu và nhấp nháy, không tự tính lại luật.

## Phương án đã cân nhắc
- **Lưu fuel bằng số thực** (giảm 1/60 mỗi tick): đơn giản hơn nhưng sau hàng nghìn tick sai số làm `fuel < 30` lệch 1 tick. Ticket khuyến nghị đơn vị nguyên. Bỏ.
- **Trạng thái đèn liệt kê `off | lit | weak`**: tường minh hơn nhưng "weak" phải đồng bộ mỗi tick với fuel. Bỏ, dùng điều kiện suy ra.
