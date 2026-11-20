# Kế hoạch hoàn thành lab: Đảo Đèn Lồng

> Bài cá nhân, 4 giờ, 4 phase. Yêu cầu gốc: [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW), [CHECKPOINTS.md](docs/lab/CHECKPOINTS.md), [RUBRIC.md](docs/lab/RUBRIC.md).
> Kế hoạch này viết khi mới phát hành Phase 1. Phase 2 đến 4 chỉ có khung chung, sẽ cập nhật khi ticket ra.

---

## 0. Nguyên tắc ưu tiên

1. **Headless đúng Test Contract là trên hết** (test ẩn 30 điểm, chạy lại ở mọi phase sau). Thứ tự: đúng contract > chơi được > đẹp.
2. **Đồ họa vượt yêu cầu không được cộng điểm.** Sáng tạo tối đa 4 điểm (hạng mục F), chỉ được tính khi không làm đổi output headless.
3. **Asset chuẩn bị trước buổi lab.** Trong 4 giờ lab, phần hình ảnh và âm thanh chỉ chen vào thời gian dư.
4. **Không có bằng chứng thì chưa xong.** Mỗi yêu cầu có scenario, output và kết quả.
5. **Hết giờ phase thì tag và đi tiếp.** Chỗ chưa đạt ghi trung thực.

---

## 1. Công nghệ và kiến trúc

**Lựa chọn:** TypeScript + Three.js (Vite) cho bản chơi, Node (`tsx`) cho headless, Vitest cho test.

**Lý do:** máy làm bài là Windows, máy chấm là macOS/Linux. Web tĩnh và Node chạy được ở cả hai nơi. Release v1.0.0 chỉ cần thư mục `dist/`.

```
src/core/      logic thuần, tất định: sim.ts (step 1/60s), rng.ts (seeded), types.ts, tuning.ts
src/headless/  cli.ts: đọc args, inputs, scenario; ghi JSONL; mã thoát 0 / 2
src/render/    Three.js: vẽ state, HUD, input bàn phím, VFX, audio (headless không bao giờ import)
public/assets/ model, texture, âm thanh (chỉ render dùng)
tests/         unit test + tests/scenarios/*.json
docs/notes/    assumptions.md, changes.md, ai-log.md, retro.md
docs/proof/    phase-1/ … phase-4/
```

**Quy tắc vàng:**
- `core` không import `render`, không dùng `Math.random()`/`Date.now()`.
- Tuning chỉ nằm ở `tuning.ts`. Có test kiểm tra `game.contract.json` khớp với nó.

---

## 2. Harness AI (hạng mục B và C)

| Thành phần | Mục đích |
|---|---|
| `AGENTS.md` (khoảng 30 dòng) | Lệnh build/test/headless, quy tắc vàng, "không sửa tay output". Cập nhật khi agent sai lặp lại. |
| Skill `.claude/skills/verify/` | `npm run verify`: vitest, chạy mọi scenario hai lần, `diff` kiểm tra tất định, chép output vào `docs/proof/phase-N/` |
| Hook `Stop` (`.claude/settings.json`) | Chạy `npm test`. Nếu đỏ thì chặn agent kết thúc |
| GitHub Actions | `npm ci && npm run verify` mỗi lần push |
| Playwright MCP (`.mcp.json`) | Agent mở game, chụp ảnh HUD/màn thắng-thua làm bằng chứng, đọc lỗi console |
| Subagent reviewer | Review diff trước khi tag (người đánh giá khác người viết) |

**Tiết kiệm token:**
- Mỗi lần giao một việc nhỏ, kèm scenario làm tiêu chí xong.
- Dán nguyên văn đoạn contract liên quan vào lời nhắc.
- Ghi ước tính token cuối mỗi phase vào `ai-log.md`.

---

## 3. Thiết kế hình ảnh và âm thanh

### 3.1 Giới hạn khi tham khảo Sky: Children of the Light

- ✅ **Được học theo phong cách chung:** dáng chibi, áo choàng, màu pastel, ánh sáng ấm, cảm giác nhẹ nhàng.
- ❌ **Không được:**
  - dùng model, texture hay âm thanh của Sky;
  - dựng lại y hệt áo choàng cánh + mặt nạ;
  - commit ảnh concept art của Sky vào repo (RULES.md mục 8).
- **Thiết kế thuần Việt cho Mây:** đội **nón lá**, áo bà ba nâu đất, khăn quàng màu hổ phách, tay cầm đèn lồng giấy.

### 3.2 Thành phần

| Thành phần | Cách làm | Cảm giác |
|---|---|---|
| Mây | Model người CC0 có rig (Quaternius): idle/run/jump. Gắn nón lá vào xương đầu và khăn choàng. Dự phòng: capsule + đầu cầu | Chibi, nhỏ |
| Nón lá | `ConeGeometry(0.35, 0.18, 24)`, màu lá khô, quai dưới cằm | Biểu tượng chính |
| Đèn tay | Khối giấy phát sáng hổ phách, sáng hơn khi mang nhiều đom đóm | Ấm |
| Đèn Lồng Lớn ×5 | Cột + lồng. Chưa thắp thì xám; thắp thì bừng sáng, có bloom | Mục tiêu rõ |
| Đom đóm | Sprite cộng sáng + chấm sáng, bay nhấp nhô theo sin | Lấp lánh |
| Bóng Mực | Cầu đen tím, đỉnh biến dạng nhẹ, viền khói, hai mắt tròn: dễ thương và buồn, không đáng sợ | Nguy hiểm, không ghê |
| Map | Đảo tròn, cỏ, bờ đá, cây và đá CC0 (instancing để giữ FPS) | Đêm cổ tích |
| Thời tiết | `FogExp2` tím đen làm sương đen, mưa phùn bằng hạt, cây lay theo gió | Bầu không khí |

### 3.3 Animation và VFX (không bạo lực, không máu me)

- **Thu đom đóm:** đom đóm xoáy bay vào đèn tay, đèn chớp sáng, kèm tiếng chuông nhỏ.
- **Deposit:** dòng hạt sáng bay theo đường cong vào Đèn Lồng Lớn. Khi đủ thì đèn bừng sáng, tỏa sóng sáng nhẹ.
- **Chiêu tỏa sáng:**
  - Mây giơ đèn lên, vòng sáng hổ phách lan đúng `pulse_radius`, có bụi sáng.
  - Shade bị chạm thì co lại, nhạt màu, trôi lùi và tan thành khói (stunned).
  - Không nổ, không máu.
- **Bị đánh:** Mây chao người, viền màn hình chớp tím nhẹ, một ngọn lửa rơi ra thành tia sáng.

### 3.4 Âm thanh "nhẹ nhàng, ấm áp"

Ưu tiên **tự tổng hợp bằng Web Audio**: sine/triangle, envelope dài, reverb nhẹ, gam ngũ cung. Âm tự tạo thì không lo license.

| Sự kiện | Âm thanh | Nguồn |
|---|---|---|
| Nền | Gió nhẹ, côn trùng, pad trầm ấm | Freesound CC0 + pad tự tổng hợp |
| `mote_picked` | Nốt celesta, nhặt liên tiếp thì lên cao dần | Web Audio |
| `deposit` | Arpeggio 3 nốt đi lên | Web Audio |
| `lantern_lit` | Hợp âm chuông + whoosh ấm | Web Audio + Kenney |
| `pulse` | Hợp âm sáng ngân vang ("tiếng gọi") | Web Audio |
| `player_hit` | Tiếng "bụp" trầm mềm | Kenney |
| `game_over` | Giai điệu ngắn (piano/harp); khi thua thì êm, không bi kịch | Web Audio |

### 3.5 Nguồn asset (chỉ CC0 / CC-BY / MIT)

| Loại | Nguồn | License |
|---|---|---|
| Nhân vật rig + animation | Quaternius | CC0 |
| Cây, đá, cỏ | Quaternius, Kenney Nature Kit, KayKit | CC0 |
| Model lẻ | Poly Pizza | CC0 hoặc CC-BY: xem từng model |
| Texture | ambientCG, Poly Haven | CC0 |
| Âm thanh | Kenney audio, Freesound, OpenGameArt | Lọc CC0/CC-BY, xem từng file |

- **Tránh:**
  - Mixamo (điều khoản Adobe, không phải CC);
  - Pixabay (license riêng, không thuộc danh sách của RULES);
  - mọi asset rip từ game khác.
- **Tải asset nào thì ghi ngay một dòng** vào `CREDITS.md`: tên, tác giả, link, license.
- Tên các pack ở trên cần xác nhận lại license trên trang gốc khi tải.

---

## 4. Lộ trình

### Giai đoạn 0: Trước buổi lab

| Bước | Việc | Kết quả |
|---|---|---|
| 0.1 | Chuyển tài liệu lab vào `docs/lab/`; dựng Vite + TS + Three.js + Vitest + tsx | `npm run dev`, `npm test` chạy được |
| 0.2 | AGENTS.md, hook Stop, CI, `.mcp.json` (Playwright), thư mục notes/proof | Harness sẵn sàng |
| 0.3 | Tải nhân vật Quaternius, test idle/run/jump trong Three.js | `public/assets/may/` |
| 0.4 | Tải nature pack, bỏ file không dùng | `public/assets/nature/` |
| 0.5 | `src/render/audio.ts`: 5 âm tổng hợp + 1–2 file nền CC0 | `playSfx('pickup')`… |
| 0.6 | Prefab nón lá + shader Bóng Mực, xem thử bằng scene demo | Hai prefab sẵn |
| 0.7 | `CREDITS.md`, `LICENSE` (MIT); tạo repo public đúng tên, push | Repo clone sạch chạy được |

### Phase 1: PRD-0 (0h → 1h) · tag `phase-1`

| Phút | Việc |
|---|---|
| 0–10 | Đọc PRD-0 hai lần. Ghi giả định và chọn mọi tuning vào `assumptions.md`. Giá trị `null`/`false` giải thích trong README |
| 10–15 | Bảng tiêu chí nghiệm thu: yêu cầu → scenario → kết quả mong đợi |
| 15–40 | **Core + headless:** tick model, input xoay theo yaw, scenario, nhặt đom đóm, deposit, thắp đèn, shade đuổi/đánh, pulse/stun, thắng/thua, điểm, JSONL (snapshot/event/end, làm tròn 3 số), mã thoát 2 khi file hỏng |
| 40–52 | **V1 hình ảnh:** đảo, 5 Đèn Lồng Lớn, Mây + nón lá, đom đóm, shade, fog, HUD, replay |
| 52–57 | 6–8 scenario, chạy hai lần + `diff` (tất định), ảnh Playwright, lưu `docs/proof/phase-1/` |
| 57–60 | Đánh giá ngắn + token vào notes; `git tag phase-1 && git push origin phase-1` |

### Phase 2: Ticket-02 (1h → 2h) · tag `phase-2`

1. Đọc ticket, so với `assumptions.md`, ghi chỗ đã làm rõ hoặc thay đổi.
2. Viết scenario mới trước (lúc này phải fail), rồi mới code.
3. Chạy lại toàn bộ scenario Phase 1.
4. Nếu dư khoảng 15 phút, **V2**: cây, đá, cỏ instanced; nối animation run/jump/idle với vận tốc thật; đèn tay sáng theo số đom đóm mang.
5. Rà harness (agent có sai lặp lại không thì thêm luật vào AGENTS.md hoặc hook), proof, đánh giá, tag.

### Phase 3: Ticket-03 (2h → 2h30) · tag `phase-3`

- **Không làm đồ họa.**
- Liệt kê luật, test và giả định bị thay thế. Ghi lý do đổi hướng vào `changes.md`.
- Test cũ bị luật mới làm sai thì sửa hoặc bỏ, kèm lý do. Không tắt âm thầm.
- Chạy lại mọi kiểm chứng còn hiệu lực, rồi tag.

### Phase 4: Ticket-04 + phát hành (2h30 → 4h) · tag `phase-4` + Release `v1.0.0`

| Phút | Việc |
|---|---|
| 0–45 | Ticket-04 + đo hiệu năng theo yêu cầu, lưu kèm cấu hình máy |
| 45–60 | **V3 VFX:** vòng sáng pulse, đom đóm xoáy khi nhặt, hạt sáng bay khi deposit, đèn bừng sáng, shade tan khói |
| 60–65 | **V4 Âm thanh:** nối `playSfx` vào các event có sẵn |
| 65–70 | **V5 Thời tiết:** mưa, gió. Đo lại FPS; nếu tụt thì tắt bằng cờ |
| 70–80 | README (≤3 lệnh, điều khiển, headless, mục "Sáng tạo của tôi" kèm ảnh/GIF), clone sạch thử lại, build, `gh release create v1.0.0` |
| 80–90 | Video demo <5 phút (chơi + `npm run verify` + đo hiệu năng + lướt harness và git log), retro, nộp link |

**Điều kiện dừng:** đến phút 45 của Phase 4 mà ticket chưa xong thì bỏ V3–V5, chỉ giữ V1–V2.

---

## 5. Checklist trước khi nộp

- [ ] Repo public, đúng tên, clone sạch chạy được trong ≤3 lệnh
- [ ] `game.contract.json` + headless đúng contract; tag `phase-1` … `phase-4`; Release `v1.0.0` có bản chạy được
- [ ] Bằng chứng mỗi phase khớp tag; chỗ chưa đạt ghi trung thực
- [ ] Giả định, `changes.md`, `ai-log.md` (token mỗi phase), `retro.md`
- [ ] Harness còn trong repo và lịch sử git
- [ ] `CREDITS.md` đủ mọi asset/âm thanh/công cụ AI; có `LICENSE`; không có ảnh hay asset của Sky
- [ ] Video `.mp4` <5 phút, link ở đầu README, mở được khi chưa đăng nhập
- [ ] Không có `.env`, API key, token

## 6. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Phase 1 dày (khoảng 20 tuning + đủ logic) mà chỉ có khoảng 35 phút để code | Làm headless trước; thiếu giờ thì cắt render, không cắt contract |
| Đồ họa chen vào giờ lab | Asset chuẩn bị ở Giai đoạn 0; V3–V5 chỉ làm ở Phase 4 |
| Bloom, mưa, đèn điểm làm tụt FPS | Low-poly, instancing, ít PointLight, mọi hiệu ứng có cờ tắt |
| Vướng bản quyền khi tham khảo Sky | Chỉ học phong cách; thiết kế Việt hóa; ghi CREDITS ngay lúc tải |
| WebGL đen khi Playwright chạy headless | Chạy headed hoặc bật GPU phần mềm khi chụp proof |
