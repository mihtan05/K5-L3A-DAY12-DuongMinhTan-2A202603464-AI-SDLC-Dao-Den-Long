# Đảo Đèn Lồng

> 🎬 Video demo: *(sẽ thêm ở Phase 4)*

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

## Cài đặt và chạy (Node 20+)

```bash
npm ci
npm run dev        # mở http://localhost:5173
```

## Kiểm thử và headless

```bash
npm test                                   # unit test
npm run verify -- phase-1                  # test + scenario chạy 2 lần + lưu bằng chứng
npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl
```

## Điều khiển

*(Phase 1)*

## Tài liệu
- Kế hoạch: [KE_HOACH.md](KE_HOACH.md)
- Hướng dẫn agent: [AGENTS.md](AGENTS.md)
- Ghi chép: [docs/notes/](docs/notes/) · Bằng chứng: [docs/proof/](docs/proof/)
- Đề bài lab: [docs/lab/](docs/lab/README.md)
- Nguồn asset: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE)

## Sáng tạo của tôi

*(cập nhật dần)* Mây đội nón lá, áo bà ba, đèn lồng giấy; âm thanh tự tổng hợp theo gam ngũ cung. Chỉ có ở phần hiển thị, không ảnh hưởng output headless.
