import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import Database from './src/db/db.js';

const ROOT_DIR = path.resolve('..');
const DB_PATH = path.join(ROOT_DIR, 'backend/data/stellarpe.sqlite');
const TMP_FRAMES_DIR = '/tmp/stellarpe_live_frames';
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const VIDEO_DIR = path.join(DOCS_DIR, 'video');

if (!fs.existsSync(TMP_FRAMES_DIR)) fs.mkdirSync(TMP_FRAMES_DIR, { recursive: true });
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

function seedDatabase() {
  console.log('⚡ Seeding database for live recording...');
  const db = new Database(DB_PATH);
  const schema = fs.readFileSync(path.join(ROOT_DIR, 'backend/src/db/schema.sql'), 'utf8');
  db.exec(schema);

  const merchantWallet = 'GAAYOENQOYZAGPAMBOVDDIE7LFXRH6Z4QKFPX4X5RGADDVKV33P4QNEP';
  const merchantId = merchantWallet.slice(-12);

  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM feedback').run();
  db.prepare('DELETE FROM transactions').run();
  db.prepare('DELETE FROM withdrawals').run();
  db.prepare('DELETE FROM events').run();
  db.prepare('DELETE FROM merchants').run();
  db.pragma('foreign_keys = ON');

  db.prepare(`
    INSERT INTO merchants (id, name, wallet_address, created_at)
    VALUES (?, ?, ?, strftime('%s','now') - 86400 * 3)
  `).run(merchantId, 'Campus Canteen & Cafe', merchantWallet);

  const txs = [
    { payer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', stroops: 125000000, status: 'confirmed', hash: '1daba56bd7ed132521cf0b64d45b06128baefb8ebe8ce7105694241830906b8a', time: 1800 },
    { payer: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJM6EWWJAA', stroops: 80000000, status: 'confirmed', hash: '39d4532c0e0c931c01b703d88765f50fb04aeddbed696214bd836ea2ca466a3b', time: 3600 },
    { payer: 'GDQOE23CFSUMSVQK4Y5JHPPKTJ6XVMSO6RO3T46SO365AL2YJGDYW2EE', stroops: 250000000, status: 'settled', hash: 'c16778f7ad6a81381bbf23462ad17a787fff9fdf21680ddb553c0f0a35172be7', time: 43200 },
    { payer: 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTOMP4Q', stroops: 150000000, status: 'settled', hash: 'f78bec4279336dd0c645b9790a47a49051dc934898860ca7c285a4cf0238c3cd', time: 86400 }
  ];

  for (const t of txs) {
    db.prepare(`
      INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status, created_at)
      VALUES (?, ?, ?, 'USDC', ?, ?, strftime('%s','now') - ?)
    `).run(merchantId, t.payer, t.stroops, t.hash, t.status, t.time);
  }

  db.prepare(`
    INSERT INTO feedback (merchant_id, payer_address, rating, comment, created_at)
    VALUES (?, ?, 5, 'Super fast QR payment with digital dollars! No INR exchange delay.', strftime('%s','now') - 3600)
  `).run(merchantId, txs[0].payer);

  db.close();
}

async function injectRealisticCursor(page) {
  await page.evaluate(() => {
    document.getElementById('cursor-container')?.remove();
    const c = document.createElement('div');
    c.id = 'cursor-container';
    c.innerHTML = `
      <div id="live-mouse-cursor" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 24px;
        height: 24px;
        z-index: 99999999;
        pointer-events: none;
        transform: translate(250px, 250px);
        transition: transform 0.03s linear;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 2L20 10L12 13L9 21L4 2Z" fill="#7C6AFF" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div id="live-click-ripple" style="
        position: fixed;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid #00D9A8;
        background: rgba(0, 217, 168, 0.25);
        z-index: 99999998;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
        transition: transform 0.25s ease-out, opacity 0.25s ease-out;
      "></div>
    `;
    document.body.appendChild(c);
  });
}

class LiveRecorder {
  constructor(page, outputName, fps = 15) {
    this.page = page;
    this.outputName = outputName;
    this.fps = fps;
    this.frameIdx = 0;
    this.isRecording = false;
    this.capturePromise = null;
    this.segDir = path.join(TMP_FRAMES_DIR, outputName);
    if (fs.existsSync(this.segDir)) fs.rmSync(this.segDir, { recursive: true, force: true });
    fs.mkdirSync(this.segDir, { recursive: true });
  }

  start() {
    this.isRecording = true;
    this.frameIdx = 0;
    const intervalMs = Math.round(1000 / this.fps);

    this.capturePromise = (async () => {
      while (this.isRecording) {
        const start = Date.now();
        try {
          const framePath = path.join(this.segDir, `frame_${String(this.frameIdx++).padStart(5, '0')}.png`);
          await this.page.screenshot({ path: framePath, type: 'png' });
        } catch (e) {}
        const elapsed = Date.now() - start;
        const delay = Math.max(5, intervalMs - elapsed);
        await new Promise(r => setTimeout(r, delay));
      }
    })();
  }

  async stop() {
    this.isRecording = false;
    if (this.capturePromise) await this.capturePromise;
    await new Promise(r => setTimeout(r, 400));

    console.log(`🎬 Encoding ${this.outputName} (${this.frameIdx} frames captured)...`);
    const inputPattern = path.join(this.segDir, 'frame_%05d.png');
    const webpOut = path.join(DOCS_DIR, `${this.outputName}.webp`);
    const mp4Out = path.join(DOCS_DIR, `${this.outputName}.mp4`);
    const videoWebpOut = path.join(VIDEO_DIR, `${this.outputName}.webp`);
    const videoMp4Out = path.join(VIDEO_DIR, `${this.outputName}.mp4`);

    try {
      // 1. Looping Animated WebP
      execSync(`ffmpeg -y -start_number 0 -framerate ${this.fps} -i "${inputPattern}" -vf "scale=800:-2:flags=lanczos,fps=${this.fps}" -loop 0 -vcodec libwebp -lossless 0 -q:v 75 -preset default -an "${webpOut}"`, { stdio: 'ignore' });
      fs.copyFileSync(webpOut, videoWebpOut);

      // 2. High-definition MP4
      execSync(`ffmpeg -y -start_number 0 -framerate ${this.fps} -i "${inputPattern}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium "${mp4Out}"`, { stdio: 'ignore' });
      fs.copyFileSync(mp4Out, videoMp4Out);

      console.log(`✅ Saved: ${webpOut} & ${mp4Out}`);
    } catch (err) {
      console.error(`Error encoding ${this.outputName}:`, err.message);
    }
  }

  async moveMouseTo(x, y, durationMs = 400) {
    const steps = Math.max(6, Math.floor((durationMs / 1000) * this.fps));
    const startPos = await this.page.evaluate(() => {
      const cur = document.getElementById('live-mouse-cursor');
      if (!cur) return { x: 250, y: 250 };
      const transform = cur.style.transform;
      const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 250, y: 250 };
    });

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      const curX = startPos.x + (x - startPos.x) * ease;
      const curY = startPos.y + (y - startPos.y) * ease;

      await this.page.evaluate((cx, cy) => {
        const cur = document.getElementById('live-mouse-cursor');
        if (cur) cur.style.transform = `translate(${cx}px, ${cy}px)`;
      }, curX, curY);

      await new Promise(r => setTimeout(r, Math.round(durationMs / steps)));
    }
  }

  async clickTarget(textOrSelector, durationMs = 450) {
    const box = await this.page.evaluate((target) => {
      // 1. Search buttons & interactive elements
      const elements = Array.from(document.querySelectorAll('button, a, input, textarea, div[role="button"]'));
      for (const el of elements) {
        const text = el.innerText || el.textContent || el.placeholder || el.value || el.title || el.getAttribute('title') || '';
        if (text.toLowerCase().includes(target.toLowerCase())) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }

      // 2. Direct selector
      try {
        const direct = document.querySelector(target);
        if (direct) {
          const r = direct.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      } catch (e) {}
      return null;
    }, textOrSelector);

    if (!box) {
      console.warn(`Target not found: ${textOrSelector}`);
      return;
    }

    await this.moveMouseTo(box.x, box.y, durationMs);
    await new Promise(r => setTimeout(r, 60));

    // Show click animation & click target
    await this.page.evaluate((cx, cy, target) => {
      const rip = document.getElementById('live-click-ripple');
      if (rip) {
        rip.style.left = `${cx}px`;
        rip.style.top = `${cy}px`;
        rip.style.transform = 'translate(-50%, -50%) scale(1.4)';
        rip.style.opacity = '1';
        setTimeout(() => {
          rip.style.transform = 'translate(-50%, -50%) scale(2.2)';
          rip.style.opacity = '0';
        }, 220);
      }

      const elements = Array.from(document.querySelectorAll('button, a, input, textarea, div[role="button"]'));
      for (const el of elements) {
        const text = el.innerText || el.textContent || el.placeholder || el.value || el.title || el.getAttribute('title') || '';
        if (text.toLowerCase().includes(target.toLowerCase())) {
          el.click();
          return;
        }
      }
      const direct = document.querySelector(target);
      if (direct) direct.click();
    }, box.x, box.y, textOrSelector);

    await new Promise(r => setTimeout(r, 350));
  }
}

async function runAuthenticRecordings() {
  console.log('🚀 Starting Authentic Live Screen Recording Suite...');
  seedDatabase();

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900'
    ],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }
  });

  const page = await browser.newPage();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 1: full_demo_01_landing
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [1/6] Recording Segment 1: Landing & Onboarding...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await injectRealisticCursor(page);

  const rec1 = new LiveRecorder(page, 'full_demo_01_landing', 15);
  rec1.start();
  await new Promise(r => setTimeout(r, 800));

  // Hover over landing hero and steps
  await rec1.moveMouseTo(480, 320, 500);
  await new Promise(r => setTimeout(r, 400));
  await rec1.moveMouseTo(720, 460, 500);
  await new Promise(r => setTimeout(r, 400));

  // Click "Explore Demo Merchant"
  await rec1.clickTarget('Explore Demo Merchant', 550);
  await page.waitForSelector('.dashboard', { timeout: 6000 });
  await new Promise(r => setTimeout(r, 1200));

  // Inspect balance & stats
  await rec1.moveMouseTo(420, 240, 500);
  await new Promise(r => setTimeout(r, 500));
  await rec1.moveMouseTo(920, 240, 600);
  await new Promise(r => setTimeout(r, 800));
  await rec1.stop();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 2: full_demo_02_qr_generator
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [2/6] Recording Segment 2: Dynamic QR & Modes...');
  await injectRealisticCursor(page);

  const rec2 = new LiveRecorder(page, 'full_demo_02_qr_generator', 15);
  rec2.start();
  await new Promise(r => setTimeout(r, 600));

  // Move to amount input and type 25.00
  const inputPos = await page.evaluate(() => {
    const inp = document.querySelector('input.amount-input') || document.querySelector('input[type="number"]');
    if (!inp) return null;
    const r = inp.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  if (inputPos) {
    await rec2.moveMouseTo(inputPos.x, inputPos.y, 400);
    await page.focus('input.amount-input');
    await page.keyboard.type('25.00', { delay: 60 });
  }
  await new Promise(r => setTimeout(r, 400));

  // Click "Generate QR Code"
  await rec2.clickTarget('Generate QR Code', 500);
  await page.waitForSelector('.qr-display-section', { timeout: 4000 });
  await new Promise(r => setTimeout(r, 800));

  // Toggle to Lobstr / SEP-7 Mode
  await rec2.clickTarget('Lobstr', 500);
  await new Promise(r => setTimeout(r, 800));

  // Click Copy Memo
  await rec2.clickTarget('Copy Memo', 450);
  await new Promise(r => setTimeout(r, 600));

  // Toggle back to Freighter Mode
  await rec2.clickTarget('Freighter', 500);
  await new Promise(r => setTimeout(r, 800));

  // Click Download
  await rec2.clickTarget('Download', 450);
  await new Promise(r => setTimeout(r, 800));
  await rec2.stop();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 3: full_demo_03_instant_payment
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [3/6] Recording Segment 3: Customer Payment & Soroban Simulation...');
  const rec3 = new LiveRecorder(page, 'full_demo_03_instant_payment', 15);
  rec3.start();
  await new Promise(r => setTimeout(r, 600));

  // Click "Simulate Customer Pay"
  await rec3.clickTarget('Simulate Customer Pay', 600);
  await new Promise(r => setTimeout(r, 2600));

  // Scroll down to recent transactions
  await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 800));

  // Hover over the updated transaction item
  await rec3.moveMouseTo(480, 580, 500);
  await new Promise(r => setTimeout(r, 600));
  await rec3.moveMouseTo(820, 580, 500);
  await new Promise(r => setTimeout(r, 1000));
  await rec3.stop();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 4: full_demo_04_settlement
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [4/6] Recording Segment 4: Bank Settlement via SEP-38 & SEP-24...');
  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 500));

  const rec4 = new LiveRecorder(page, 'full_demo_04_settlement', 15);
  rec4.start();
  await new Promise(r => setTimeout(r, 600));

  // Click "Settle to Bank"
  await rec4.clickTarget('Settle to Bank', 600);
  await page.waitForSelector('.settle-modal', { timeout: 4000 });
  await new Promise(r => setTimeout(r, 1200));

  // Hover over FX rate quote inside modal
  await rec4.moveMouseTo(550, 420, 500);
  await new Promise(r => setTimeout(r, 600));

  // Click "Confirm & Settle"
  await rec4.clickTarget('Confirm & Settle', 500);

  // Watch 4-stage stepper progress (Soroban Lock -> Anchor Handshake -> Banking Clearance -> UTR)
  await new Promise(r => setTimeout(r, 7000));

  // Hover over Bank UTR receipt
  await rec4.moveMouseTo(550, 480, 500);
  await new Promise(r => setTimeout(r, 1200));

  // Click "Done & Return to Dashboard"
  await rec4.clickTarget('Done & Return', 500);
  await new Promise(r => setTimeout(r, 800));
  await rec4.stop();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 5: full_demo_05_feedback_analytics
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [5/6] Recording Segment 5: Customer Rating & Feedback...');
  // Scroll down to feedback section
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await page.waitForSelector('.feedback-form', { timeout: 4000 });
  await new Promise(r => setTimeout(r, 600));

  const rec5 = new LiveRecorder(page, 'full_demo_05_feedback_analytics', 15);
  rec5.start();
  await new Promise(r => setTimeout(r, 600));

  // Click 5th Star
  await rec5.clickTarget('Rate 5 star', 500);
  await new Promise(r => setTimeout(r, 400));

  // Type feedback comment
  const taPos = await page.evaluate(() => {
    const ta = document.querySelector('textarea.feedback-textarea');
    if (!ta) return null;
    const r = ta.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (taPos) {
    await rec5.moveMouseTo(taPos.x, taPos.y, 400);
    await page.focus('textarea.feedback-textarea');
    await page.keyboard.type('Super fast settlement to UPI via Stellar anchor!', { delay: 40 });
  }
  await new Promise(r => setTimeout(r, 500));

  // Click "Submit Feedback"
  await rec5.clickTarget('Submit Feedback', 500);
  await new Promise(r => setTimeout(r, 1500));

  // Scroll back to top analytics
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 1000));
  await rec5.stop();

  // ══════════════════════════════════════════════════════════════════════
  // SEGMENT 6: full_demo_06_mobile (375x812 Viewport)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n📹 [6/6] Recording Segment 6: Mobile Responsiveness (375px)...');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await injectRealisticCursor(page);

  const rec6 = new LiveRecorder(page, 'full_demo_06_mobile', 15);
  rec6.start();
  await new Promise(r => setTimeout(r, 800));

  // Mobile onboarding
  await rec6.clickTarget('Explore Demo Merchant', 500);
  await page.waitForSelector('.dashboard', { timeout: 6000 });
  await new Promise(r => setTimeout(r, 1000));

  // Scroll down mobile POS
  await page.evaluate(() => window.scrollBy({ top: 220, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 800));

  // Type mobile amount
  await page.focus('input.amount-input');
  await page.keyboard.type('10.00', { delay: 60 });
  await new Promise(r => setTimeout(r, 500));

  // Generate QR on mobile
  await rec6.clickTarget('Generate QR Code', 500);
  await page.waitForSelector('.qr-display-section', { timeout: 4000 });
  await new Promise(r => setTimeout(r, 1200));

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 1000));
  await rec6.stop();

  await browser.close();
  console.log('\n🎉 ALL 6 AUTHENTIC LIVE RECORDINGS COMPLETE & ENCODED AS ANIMATED WEBP + MP4!');
}

runAuthenticRecordings().catch(err => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
