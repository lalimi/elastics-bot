// Рендер аватарки бота (assets/avatar.mp4, 640×640) і привітальної анімації (public/bot/welcome.mp4, 800×450)
// зі scripts/media/media.html: CSS-анімації зупиняються, кадри знімаються по черзі, ffmpeg збирає MP4.
// Потрібні Playwright з Chromium і ffmpeg з libx264. Запуск: npm run media
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FPS = 30, SECONDS = 4;
const JOBS = [
  { kind: 'avatar', w: 640, h: 640, out: path.join(ROOT, 'assets/avatar.mp4') },
  { kind: 'welcome', w: 800, h: 450, out: path.join(ROOT, 'public/bot/welcome.mp4') }
];

const browser = await chromium.launch();
for (const job of JOBS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-media-'));
  const page = await browser.newPage({ viewport: { width: job.w, height: job.h } });
  await page.goto('file://' + path.join(ROOT, 'scripts/media/media.html') + '?kind=' + job.kind);
  await page.evaluate(() => window.ready);
  const frames = FPS * SECONDS;
  for (let i = 0; i < frames; i++) {
    await page.evaluate(ms => document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; }), i * 1000 / FPS);
    await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '20', '-movflags', '+faststart', '-an', job.out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${path.relative(ROOT, job.out)}: ${(fs.statSync(job.out).size / 1024).toFixed(0)} KB`);
}
await browser.close();
