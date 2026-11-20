# Đảo Đèn Lồng

> 🎬 Video demo: *(sẽ thêm ở Phase 4)*

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen.

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
| E | Nạp đom đóm vào Đèn Lồng Lớn gần nhất |
| F | Tỏa sáng: xua Bóng Mực (tốn 2 đom đóm) |
| Kéo chuột / ← → | Xoay camera |
| R | Chơi lại sau khi thắng / thua |

## Luật và cách tính điểm

- Đom đóm tự nhặt khi đi qua (mang tối đa 10). Đứng gần đèn, bấm **E** để nạp; mỗi đèn cần **5** đom đóm.
- Thắp đủ **5 đèn** trước khi trời sáng (**5 phút**) thì thắng. Hết **3 ngọn lửa** hoặc hết giờ thì thua.
- Bóng Mực đuổi theo; bị chạm mất 1 lửa, rơi một nửa số đom đóm đang mang, rồi được bất tử 2 giây.
- **Tỏa sáng (F)**: choáng 3 giây và đẩy lùi 4 m mọi Bóng Mực trong bán kính 6 m; hồi 1 giây.
- Bóng Mực không vào được vùng 4 m quanh đèn đã thắp.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng | +20 |
| Khi thắng: mỗi giây còn lại | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Chi tiết giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Headless (Test Contract v1.0) và kiểm thử

```bash
npx tsx src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
npm test                     # unit test (Vitest)
npm run verify -- phase-1    # unit test + mọi scenario chạy 2 lần (tất định) + lưu bằng chứng
npm run build && npm run smoke -- phase-1   # mở game trong trình duyệt, kiểm tra và chụp ảnh
```

Khai báo trong [game.contract.json](game.contract.json). Về các mục tuning:
- `fall_enabled: false`: mép đảo giữ người chơi lại, không bị rơi nên không có sự kiện `player_hit` với `by: "fall"`.
- Không có mục nào để `null`.

## Tài liệu
- Kế hoạch: [KE_HOACH.md](KE_HOACH.md) · Hướng dẫn agent: [AGENTS.md](AGENTS.md)
- Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md) · Thay đổi: [docs/notes/changes.md](docs/notes/changes.md) · Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Bằng chứng: [docs/proof/](docs/proof/phase-1/README.md)
- Đề bài lab: [docs/lab/](docs/lab/README.md)
- Nguồn asset: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE)

## Sáng tạo của tôi

- **Mây đội nón lá**, mặc áo bà ba, khăn hổ phách, cầm đèn lồng giấy. Đèn tay sáng dần theo số đom đóm đang mang.
- **Âm thanh tự tổng hợp** bằng Web Audio theo gam ngũ cung; nhặt đom đóm liên tiếp thì nốt lên cao dần.
- **Đảo sáng dần**: mỗi đèn thắp làm sương mỏng đi và trời sáng hơn.

Tất cả chỉ ở phần hiển thị (`src/render/`); headless không import chúng. Bằng chứng phần lõi vẫn đúng: `npm run verify` PASS ([docs/proof/phase-1/verify-summary.txt](docs/proof/phase-1/verify-summary.txt)).
