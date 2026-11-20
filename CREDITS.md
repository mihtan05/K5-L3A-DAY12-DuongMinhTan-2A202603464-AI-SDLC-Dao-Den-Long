# CREDITS

Mọi asset, âm thanh và công cụ AI tạo nội dung. Thêm một dòng **ngay khi** đưa asset vào repo.

| Asset | Tác giả / Công cụ | Nguồn | License | Dùng ở |
|---|---|---|---|---|
| Mây (nón lá, áo bà ba, đèn tay), Bóng Mực, Đèn Lồng Lớn, đom đóm, đảo | Tự dựng bằng code (Three.js primitives), viết cùng Claude Code | `src/render/prefabs.ts` | MIT (theo repo) | Render |
| Toàn bộ hiệu ứng âm thanh | Tự tổng hợp bằng Web Audio, viết cùng Claude Code | `src/render/audio.ts` | MIT (theo repo) | Render |

## Công cụ AI
- Claude Code (Anthropic): hỗ trợ viết code, test, tài liệu, kế hoạch. Không có hình ảnh, âm thanh hay model 3D nào do AI tạo dưới dạng file: mọi hình khối và âm thanh là code (Three.js primitives, Web Audio) viết cùng Claude Code, nằm trong `src/render/`.

## Thư viện
- three.js — MIT — https://threejs.org
- Vite, Vitest, tsx, TypeScript — MIT
- Playwright — Apache-2.0 — chỉ dùng cho kiểm thử trình duyệt (`scripts/smoke.mjs`) và bench (`scripts/bench.mjs`)

## Ghi chú
Phong cách nhẹ nhàng, ấm áp lấy cảm hứng chung từ các game phiêu lưu cổ tích. Không dùng model, texture, âm thanh hay hình ảnh nào của game có sẵn.
