# Đảo Đèn Lồng

> 🎬 Video demo: *(sẽ thêm ở Phase 4)*

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp và **giữ cho Đèn Lồng Lớn còn dầu tới bình minh** trên **ba hòn đảo trong ba đêm**, né Bóng Mực và Gió Lạc trong sương đen.

## Cài đặt và chạy (Node 20+, macOS / Linux / Windows)

```bash
npm ci
npm run dev        # mở http://localhost:5173
```

Bản tĩnh: `npm run build` → thư mục `dist/` (mở bằng `npm run preview` hoặc bất kỳ web server tĩnh nào).

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | Nạp đom đóm vào Đèn Lồng Lớn gần nhất |
| F | Tỏa sáng: xua Bóng Mực, Gió Lạc (tốn 3 đom đóm) |
| Esc / P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| Kéo chuột / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |

## Luật và cách tính điểm (Ticket-03, contract v1.2)

- **3 Đêm:** Đảo Bến (5 đèn, 4:00), Đảo Cau (6 đèn, 4:30, hai đảo nối cầu tre và bục nhảy), Đảo Chuông (7 đèn, 5:00, ba tầng, dốc, bục nhảy, gió mạnh). Thua thì chơi lại Đêm đó; thắng Đêm 3 thì tới màn Bình Minh.
- **Mục tiêu: giữ đảo sáng tới bình minh.** Hết giờ mà còn lửa và số đèn **đang sáng** ≥ 60% (3/5, 4/6, 5/7) thì thắng. Thắp đủ đèn sớm không kết thúc Đêm.
- Đom đóm tự nhặt khi đi qua. Sức chứa 10, mỗi lần thắp thành công +2 (tối đa 20).
- Đứng trong 2 m của đèn, bấm **E**: đèn chưa sáng thì nạp (lần đầu cần **10**, thắp lại cần **5**); đèn đang sáng thì **châm dầu** (mỗi đom đóm +10 dầu).
- **Dầu đèn** 0–100, cháy 1/giây; hết dầu thì đèn tắt. Dưới 30 dầu, đèn nhấp nháy, mất vùng an toàn và Bóng Mực kéo tới **hút dầu** (5/giây mỗi con).
- **Bóng Mực** (4 m/s, Đêm 3: 4.5 m/s) phát hiện trong 12 m. Bị chạm: −1 lửa, rơi một nửa số đom đóm ra quanh Mây (nhặt lại được trong 8 s), bất tử 1.5 s.
- **Tỏa sáng (F):** choáng 2 s và đẩy lùi 4 m mọi Bóng Mực trong 5 m; hồi 3 s. Bóng Mực không vào được vùng 6 m quanh đèn còn ≥ 30 dầu.
- **Rơi khỏi đảo:** −1 lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- **Gió Lạc** (Đêm 2, 3): cướp 3 đom đóm khi Mây mang ≥ 5. Tỏa sáng trúng nó lúc đang chạy trốn thì nó thả lại đồ.
- **Bùa Gió:** 10 s chạy 7.2 m/s và lướt không hồi chiêu.
- **Cài đặt:** âm lượng, độ nhạy chuột, **Bảng màu dễ phân biệt** (viền Bóng Mực xanh #00B3FF, cảnh báo trắng kèm ⚠).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng Tỏa sáng | +5 (+15 nếu nó đang hút dầu) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + phần nguyên của dầu |
| Bình minh (chỉ khi thắng): mỗi ngọn lửa còn lại | +50 |

Tổng điểm = tổng điểm các Đêm đã thắng. Thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md). Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Headless (Test Contract v1.2) và kiểm thử

```bash
npx tsx src/headless/cli.ts --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
npm test                     # unit test (Vitest)
npm run verify -- phase-3    # unit test + mọi scenario chạy 2 lần (tất định) + kiểm tra kết quả mong đợi + lưu bằng chứng
npm run build && npm run smoke -- phase-3   # mở game trong trình duyệt, kiểm tra luồng 3 Đêm, HUD, tạm dừng, cài đặt, FPS và chụp ảnh
```

Khai báo trong [game.contract.json](game.contract.json) (số chuẩn Ticket-02, `fall_enabled: true`). Không có mục nào để `null`.

## Tài liệu
- Kế hoạch: [KE_HOACH.md](KE_HOACH.md) · Hướng dẫn agent: [AGENTS.md](AGENTS.md)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md) · Thay đổi: [docs/notes/changes.md](docs/notes/changes.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md)
- Đề bài lab: [docs/lab/](docs/lab/README.md) · Ticket: [02](docs/lab/TICKET-02.md), [03](docs/lab/TICKET-03.md)
- Nguồn asset: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE)

## Sáng tạo của tôi

- **Mây đội nón lá**, mặc áo bà ba, khăn hổ phách, cầm đèn lồng giấy. Đèn tay sáng dần theo số đom đóm đang mang.
- **Âm thanh tự tổng hợp** bằng Web Audio theo gam ngũ cung; nhặt đom đóm liên tiếp thì nốt lên cao dần.
- **Đảo sáng dần**: ánh sáng môi trường tăng theo số đèn đã thắp.
- **Lời Ông Đăng** cho từng Đêm, lá bay báo trước cơn gió, nhạc nền đêm tự tổng hợp.

Tất cả chỉ ở phần hiển thị (`src/render/`); headless không import chúng. Bằng chứng phần lõi vẫn đúng: `npm run verify` PASS ([docs/proof/phase-3/verify-summary.txt](docs/proof/phase-3/verify-summary.txt)).
