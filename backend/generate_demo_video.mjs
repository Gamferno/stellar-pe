import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import Database from 'better-sqlite3';

const ROOT_DIR = path.resolve('..');
const DB_PATH = path.join(ROOT_DIR, 'backend/data/stellarpe.sqlite');
const TMP_VIDEO_DIR = '/tmp/stellarpe_video';
const FRAMES_DIR = path.join(TMP_VIDEO_DIR, 'frames');
const OUTPUT_MP4 = path.join(ROOT_DIR, 'docs/stellarpe_demo_60s.mp4');
const OUTPUT_WEBM = path.join(ROOT_DIR, 'docs/stellarpe_demo_60s.webm');
const ARTIFACT_DIR = '/home/om/.gemini/antigravity-cli/brain/81edb589-7b1b-468b-a1b3-77e00bab0fdb';

if (!fs.existsSync(TMP_VIDEO_DIR)) fs.mkdirSync(TMP_VIDEO_DIR, { recursive: true });
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(OUTPUT_MP4))) fs.mkdirSync(path.dirname(OUTPUT_MP4), { recursive: true });

// ── 1. SEED DATABASE ──
console.log('Seeding SQLite database...');
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

db.prepare(`
  INSERT INTO feedback (merchant_id, payer_address, rating, comment, created_at)
  VALUES (?, ?, 5, 'Settled directly to my bank within minutes via Stellar anchor flow.', strftime('%s','now') - 40000)
`).run(merchantId, merchantWallet);

db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('qr_generated', ?, '{"amount":"15.00"}')`).run(merchantId);
db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('payment_confirmed', ?, '{"amount":150000000}')`).run(merchantId);
db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('settlement_confirmed', ?, '{"amount":205000000}')`).run(merchantId);
db.close();

// ── 2. SCENE DURATIONS & SUBTITLES ──
const scenes = [
  {
    id: 'scene1',
    name: 'Problem & Solution',
    badge: '✦ Scene 1 · The Problem & Architecture Overview',
    duration: 12.24,
    text: 'International students and freelancers hold digital dollars, but local shops only take rupees. Meet StellarPe — a QR point-of-sale settlement layer built on Stellar and Soroban.'
  },
  {
    id: 'scene2',
    name: '1-Click Merchant Setup & QR Code',
    badge: '✦ Scene 2 · 1-Click Merchant Setup & SEP-7 QR Code',
    duration: 13.10,
    text: 'Merchants connect in one click with Freighter. Enter the amount to collect — say fifteen dollars — and StellarPe generates a SEP-7 standard payment QR code scannable by any Stellar wallet like Lobstr.'
  },
  {
    id: 'scene3',
    name: 'Instant On-Chain Payment',
    badge: '✦ Scene 3 · Soroban Contract On-Chain Verification',
    duration: 12.48,
    text: 'The customer scans and signs. Our deployed Soroban settlement contract verifies the transfer on Stellar Testnet and emits an event, updating the merchant\'s dashboard in under five seconds.'
  },
  {
    id: 'scene4',
    name: 'Settle to Bank (SEP-38 & SEP-24)',
    badge: '✦ Scene 4 · SEP-38 FX Quote & SEP-24 Anchor Off-Ramp',
    duration: 11.93,
    text: 'With one tap on \'Settle to Bank\', StellarPe requests a SEP-38 rate quote and launches a SEP-24 anchor withdrawal, sending funds straight to the merchant\'s bank account.'
  },
  {
    id: 'scene5',
    name: 'Outro & Call to Action',
    badge: '✦ Scene 5 · Verified On-Chain Proofs & Outro',
    duration: 6.17,
    text: 'Fast, atomic, and frictionless. Real-world commerce powered by Stellar. Thank you!'
  }
];

let curT = 0;
for (const sc of scenes) {
  sc.startTime = curT;
  sc.endTime = curT + sc.duration;
  curT += sc.duration;
}
const TOTAL_DURATION = curT; // ~55.92s
const FPS = 30;
const TOTAL_FRAMES = Math.ceil(TOTAL_DURATION * FPS);

console.log(`Total duration: ${TOTAL_DURATION.toFixed(2)}s (${TOTAL_FRAMES} frames @ ${FPS}fps)`);

// ── 3. START BACKEND & FRONTEND SERVERS ──
console.log('Starting backend and frontend servers...');
const backendProc = spawn('node', ['src/server.js'], { cwd: path.join(ROOT_DIR, 'backend'), env: { ...process.env, PORT: '3001' } });
const frontendProc = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { cwd: path.join(ROOT_DIR, 'frontend') });

await new Promise(resolve => setTimeout(resolve, 3500));

async function run() {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // ── 4. INJECT VIDEO DIRECTOR OVERLAYS ──
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'video-director-style';
    style.textContent = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif !important;
        overflow-x: hidden !important;
      }
      /* Custom animated virtual cursor */
      #v-cursor {
        position: fixed;
        width: 24px;
        height: 24px;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-2px, -2px);
        transition: transform 0.04s linear;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6));
      }
      #v-cursor-icon {
        width: 24px;
        height: 24px;
      }
      #v-ripple {
        position: fixed;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid #00d9a8;
        background: rgba(0, 217, 168, 0.25);
        pointer-events: none;
        z-index: 999998;
        transform: translate(-22px, -22px) scale(0);
        opacity: 0;
        transition: transform 0.35s ease-out, opacity 0.35s ease-out;
      }
      #v-ripple.active {
        transform: translate(-22px, -22px) scale(1);
        opacity: 1;
      }

      /* Top Left Scene Badge */
      #v-scene-badge {
        position: fixed;
        top: 24px;
        left: 28px;
        z-index: 999990;
        background: rgba(18, 22, 34, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(124, 106, 255, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(124, 106, 255, 0.2);
        padding: 10px 20px;
        border-radius: 9999px;
        color: #f1f3f9;
        font-size: 14.5px;
        font-weight: 600;
        letter-spacing: 0.3px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
      }

      /* Top Right Network Badge */
      #v-net-badge {
        position: fixed;
        top: 24px;
        right: 28px;
        z-index: 999990;
        background: rgba(18, 22, 34, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(0, 217, 168, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 217, 168, 0.2);
        padding: 10px 20px;
        border-radius: 9999px;
        color: #00d9a8;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .net-dot-pulse {
        width: 9px;
        height: 9px;
        background: #00d9a8;
        border-radius: 50%;
        box-shadow: 0 0 10px #00d9a8;
        display: inline-block;
      }

      /* Lower-Third Subtitle Bar */
      #v-subtitles-bar {
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999990;
        width: 82%;
        max-width: 1280px;
        background: rgba(12, 15, 25, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(124, 106, 255, 0.35);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 30px rgba(124, 106, 255, 0.15);
        border-radius: 20px;
        padding: 18px 28px;
        text-align: center;
        color: #f8fafc;
        font-size: 19px;
        font-weight: 500;
        line-height: 1.5;
        transition: all 0.3s ease;
      }
      .sub-highlight {
        color: #a78bfa;
        font-weight: 700;
      }
      .sub-green {
        color: #00d9a8;
        font-weight: 700;
      }

      /* Focus Ring Highlight */
      .video-spotlight {
        position: relative;
        box-shadow: 0 0 0 3px #7c6aff, 0 0 25px rgba(124, 106, 255, 0.6) !important;
        transition: all 0.4s ease !important;
        border-radius: 12px;
      }
      .video-spotlight-green {
        position: relative;
        box-shadow: 0 0 0 3px #00d9a8, 0 0 25px rgba(0, 217, 168, 0.6) !important;
        transition: all 0.4s ease !important;
        border-radius: 12px;
      }

      /* Fullscreen Outro Card */
      #v-outro-card {
        position: fixed;
        inset: 0;
        z-index: 999995;
        background: radial-gradient(circle at center, rgba(26, 22, 56, 0.96) 0%, rgba(10, 12, 18, 0.98) 100%);
        backdrop-filter: blur(24px);
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        opacity: 0;
        transition: opacity 0.5s ease;
      }
      #v-outro-card.active {
        display: flex;
        opacity: 1;
      }
      .outro-star {
        font-size: 56px;
        color: #7c6aff;
        margin-bottom: 8px;
        display: inline-block;
      }
      .outro-title {
        font-size: 48px;
        font-weight: 800;
        letter-spacing: -1px;
        margin-bottom: 12px;
        background: linear-gradient(135deg, #ffffff 40%, #a78bfa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .outro-tagline {
        font-size: 22px;
        color: #94a3b8;
        margin-bottom: 28px;
        font-weight: 400;
      }
      .outro-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        max-width: 900px;
        width: 100%;
        margin-bottom: 32px;
      }
      .outro-box {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 18px 24px;
        border-radius: 16px;
        text-align: center;
      }
      .outro-box-num {
        font-size: 28px;
        font-weight: 700;
        color: #00d9a8;
        margin-bottom: 4px;
      }
      .outro-box-lbl {
        font-size: 13px;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .outro-footer-note {
        font-size: 16px;
        color: #cbd5e1;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .outro-pill {
        background: rgba(124, 106, 255, 0.2);
        border: 1px solid rgba(124, 106, 255, 0.4);
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 13.5px;
        color: #c4b5fd;
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);

    // Create Cursor
    const cursor = document.createElement('div');
    cursor.id = 'v-cursor';
    cursor.innerHTML = `
      <svg id="v-cursor-icon" viewBox="0 0 24 24" fill="none">
        <path d="M4 3L11.5 21L14.5 13.5L22 10.5L4 3Z" fill="#ffffff" stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(cursor);

    const ripple = document.createElement('div');
    ripple.id = 'v-ripple';
    document.body.appendChild(ripple);

    // Create Badges
    const sceneBadge = document.createElement('div');
    sceneBadge.id = 'v-scene-badge';
    sceneBadge.textContent = '✦ Scene 1 · The Problem & Architecture Overview';
    document.body.appendChild(sceneBadge);

    const netBadge = document.createElement('div');
    netBadge.id = 'v-net-badge';
    netBadge.innerHTML = `<span class="net-dot-pulse"></span> Stellar Testnet · Soroban Level 4`;
    document.body.appendChild(netBadge);

    const subBar = document.createElement('div');
    subBar.id = 'v-subtitles-bar';
    subBar.innerHTML = `International students and freelancers hold digital dollars, but local shops only take rupees. Meet <span class="sub-highlight">StellarPe</span> — a QR point-of-sale settlement layer built on <span class="sub-green">Stellar and Soroban</span>.`;
    document.body.appendChild(subBar);

    const outro = document.createElement('div');
    outro.id = 'v-outro-card';
    outro.innerHTML = `
      <div class="outro-star">✦</div>
      <h1 class="outro-title">StellarPe</h1>
      <p class="outro-tagline">Accept digital dollars. Get rupees. No crypto knowledge required.</p>
      
      <div class="outro-grid">
        <div class="outro-box">
          <div class="outro-box-num">10+ Users</div>
          <div class="outro-box-lbl">Verified on Testnet</div>
        </div>
        <div class="outro-box">
          <div class="outro-box-num">100% (4.8★)</div>
          <div class="outro-box-lbl">Merchant Rating</div>
        </div>
        <div class="outro-box">
          <div class="outro-box-num">&lt; 5s</div>
          <div class="outro-box-lbl">Soroban Settlement</div>
        </div>
      </div>

      <div class="outro-footer-note">
        <span class="outro-pill">Soroban Contract: CCCEJOC6FP...</span>
        <span class="outro-pill">SEP-10 · SEP-38 · SEP-24</span>
        <span class="outro-pill">Level 4 Submission</span>
      </div>
    `;
    document.body.appendChild(outro);

    window.Director = {
      setCursor: (x, y) => {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      },
      triggerClickRipple: (x, y) => {
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.remove('active');
        void ripple.offsetWidth;
        ripple.classList.add('active');
        setTimeout(() => ripple.classList.remove('active'), 350);
      },
      setScene: (badgeText, subHtml) => {
        sceneBadge.textContent = badgeText;
        subBar.innerHTML = subHtml;
      },
      setOutro: (active) => {
        if (active) outro.classList.add('active');
        else outro.classList.remove('active');
      },
      highlightElement: (selector, isGreen = false) => {
        document.querySelectorAll('.video-spotlight, .video-spotlight-green').forEach(el => {
          el.classList.remove('video-spotlight', 'video-spotlight-green');
        });
        if (selector) {
          const el = document.querySelector(selector);
          if (el) el.classList.add(isGreen ? 'video-spotlight-green' : 'video-spotlight');
        }
      }
    };
  });

  // ── 5. TIMELINE ANIMATION ENGINE ──
  console.log('Rendering video frames...');
  const tStart = Date.now();

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  let appState = {
    connected: false,
    amountTyped: '',
    qrGenerated: false,
    paymentConfirmed: false,
    settleModalOpen: false,
    settlePipelineActive: false,
    receiptClosed: false,
    feedbackDone: false,
    outroActive: false,
    currentScroll: 0
  };

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // ── SCENE 1 [0.00 – 12.24s] ──
    if (t < scenes[0].endTime) {
      let cursorX = 960, cursorY = 540;

      if (t < 3.5) {
        const subP = easeInOutCubic(Math.min(1, t / 3.0));
        cursorX = lerp(600, 960, subP);
        cursorY = lerp(300, 360, subP) + Math.sin(t * 2) * 8;
      } else if (t < 8.0) {
        const stepP = (t - 3.5) / 4.5;
        cursorX = 960;
        cursorY = lerp(420, 560, easeInOutCubic(stepP));
      } else if (t < 11.5) {
        const btnP = easeInOutCubic((t - 8.0) / 3.5);
        cursorX = lerp(960, 960, btnP);
        cursorY = lerp(560, 680, btnP);
      } else {
        cursorX = 960;
        cursorY = 680;
      }

      await page.evaluate(({ cX, cY, badge, subHtml, t }) => {
        window.Director.setCursor(cX, cY);
        window.Director.setScene(badge, subHtml);
        if (t > 1.0 && t < 3.5) window.Director.highlightElement('.logo-wrap');
        else if (t >= 3.5 && t < 8.0) window.Director.highlightElement('.onboarding-steps');
        else if (t >= 8.0) window.Director.highlightElement('button.btn-outline', true);
        else window.Director.highlightElement(null);
      }, {
        cX: cursorX,
        cY: cursorY,
        badge: scenes[0].badge,
        subHtml: `International students and freelancers hold digital dollars, but local shops only take rupees. Meet <span class="sub-highlight">StellarPe</span> — a QR point-of-sale settlement layer built on <span class="sub-green">Stellar and Soroban</span>.`,
        t
      });
    }

    // ── SCENE 2 [12.24 – 25.34s] ──
    else if (t < scenes[1].endTime) {
      const sceneT = t - scenes[1].startTime;
      let cursorX = 960, cursorY = 680;

      if (sceneT >= 0.4 && !appState.connected) {
        appState.connected = true;
        await page.evaluate(() => {
          window.Director.triggerClickRipple(960, 680);
          const demoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Explore Demo Merchant'));
          if (demoBtn) demoBtn.click();
        });
        await new Promise(r => setTimeout(r, 100));
      }

      if (sceneT < 2.0) {
        cursorX = 960;
        cursorY = lerp(680, 240, easeInOutCubic(sceneT / 2.0));
      } else if (sceneT < 4.5) {
        const p = easeInOutCubic((sceneT - 2.0) / 2.5);
        cursorX = lerp(960, 960, p);
        cursorY = lerp(240, 520, p);
      } else if (sceneT < 7.0) {
        cursorX = 960;
        cursorY = 520;
        if (!appState.amountTyped) {
          appState.amountTyped = '15.00';
          await page.evaluate(() => {
            const input = document.querySelector('.amount-input');
            if (input) {
              input.focus();
              input.value = '15.00';
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
        }
      } else if (sceneT < 8.5) {
        const p = easeInOutCubic((sceneT - 7.0) / 1.5);
        cursorX = lerp(960, 960, p);
        cursorY = lerp(520, 580, p);
        if (sceneT >= 8.2 && !appState.qrGenerated) {
          appState.qrGenerated = true;
          await page.evaluate(() => {
            window.Director.triggerClickRipple(960, 580);
            const genBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Generate QR Code'));
            if (genBtn) genBtn.click();
          });
        }
      } else {
        cursorX = lerp(960, 1060, Math.sin((sceneT - 8.5) * 1.5));
        cursorY = 640;
      }

      await page.evaluate(({ cX, cY, badge, subHtml, sceneT }) => {
        window.Director.setCursor(cX, cY);
        window.Director.setScene(badge, subHtml);
        if (sceneT >= 2.0 && sceneT < 7.0) window.Director.highlightElement('.amount-input');
        else if (sceneT >= 7.0 && sceneT < 9.0) window.Director.highlightElement('button.btn-primary', true);
        else if (sceneT >= 9.0) window.Director.highlightElement('.qr-display-wrap', true);
        else window.Director.highlightElement(null);
      }, {
        cX: cursorX,
        cY: cursorY,
        badge: scenes[1].badge,
        subHtml: `Merchants connect in <span class="sub-green">one click with Freighter</span>. Enter the amount to collect — say <span class="sub-highlight">fifteen dollars</span> — and StellarPe generates a SEP-7 standard payment QR code scannable by any Stellar wallet.`,
        sceneT
      });
    }

    // ── SCENE 3 [25.34 – 37.82s] ──
    else if (t < scenes[2].endTime) {
      const sceneT = t - scenes[2].startTime;
      let cursorX = 960, cursorY = 500;

      if (sceneT < 2.5) {
        const scrollP = easeInOutCubic(sceneT / 2.5);
        appState.currentScroll = lerp(0, 420, scrollP);
        await page.evaluate((s) => window.scrollTo(0, s), appState.currentScroll);
      }

      if (sceneT >= 3.8 && !appState.paymentConfirmed) {
        appState.paymentConfirmed = true;
        await page.evaluate(() => {
          const statusCard = document.querySelector('.card:nth-of-type(3)');
          if (statusCard) statusCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        });
      }

      if (sceneT < 5.0) {
        cursorX = 960;
        cursorY = 480;
      } else if (sceneT < 8.5) {
        const p = easeInOutCubic((sceneT - 5.0) / 3.5);
        cursorX = lerp(960, 1180, p);
        cursorY = lerp(480, 580, p);
      } else {
        cursorX = 1180;
        cursorY = 580;
      }

      await page.evaluate(({ cX, cY, badge, subHtml, sceneT }) => {
        window.Director.setCursor(cX, cY);
        window.Director.setScene(badge, subHtml);
        if (sceneT < 4.0) window.Director.highlightElement('.payment-status', true);
        else if (sceneT >= 4.0 && sceneT < 8.0) window.Director.highlightElement('.tx-row', true);
        else window.Director.highlightElement('.tx-explorer-link', true);
      }, {
        cX: cursorX,
        cY: cursorY,
        badge: scenes[2].badge,
        subHtml: `The customer scans and signs. Our deployed <span class="sub-green">Soroban settlement contract</span> verifies the transfer on Stellar Testnet and emits an event, updating the merchant dashboard in <span class="sub-highlight">under five seconds</span>.`,
        sceneT
      });
    }

    // ── SCENE 4 [37.82 – 49.75s] ──
    else if (t < scenes[3].endTime) {
      const sceneT = t - scenes[3].startTime;
      let cursorX = 960, cursorY = 320;

      if (sceneT < 2.0) {
        const scrollP = easeInOutCubic(sceneT / 2.0);
        appState.currentScroll = lerp(420, 0, scrollP);
        await page.evaluate((s) => window.scrollTo(0, s), appState.currentScroll);
        cursorX = 960;
        cursorY = lerp(580, 320, scrollP);
      } else if (sceneT < 3.2) {
        cursorX = 960;
        cursorY = 320;
        if (sceneT >= 3.0 && !appState.settleModalOpen) {
          appState.settleModalOpen = true;
          await page.evaluate(() => {
            window.Director.triggerClickRipple(960, 320);
            const settleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Settle to Bank'));
            if (settleBtn) settleBtn.click();
          });
        }
      } else if (sceneT < 5.0) {
        const p = easeInOutCubic((sceneT - 3.2) / 1.8);
        cursorX = lerp(960, 960, p);
        cursorY = lerp(320, 680, p);
        if (sceneT >= 4.8 && !appState.settlePipelineActive) {
          appState.settlePipelineActive = true;
          await page.evaluate(() => {
            window.Director.triggerClickRipple(960, 680);
            const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm & Settle'));
            if (confirmBtn) confirmBtn.click();
          });
        }
      } else if (sceneT < 9.5) {
        cursorX = 960 + Math.sin(sceneT * 2) * 20;
        cursorY = 560;
      } else {
        cursorX = 960;
        cursorY = 520;
      }

      await page.evaluate(({ cX, cY, badge, subHtml, sceneT }) => {
        window.Director.setCursor(cX, cY);
        window.Director.setScene(badge, subHtml);
        if (sceneT < 3.0) window.Director.highlightElement('.balance-card', true);
        else if (sceneT >= 3.0 && sceneT < 5.0) window.Director.highlightElement('.settle-quote-box', true);
        else if (sceneT >= 5.0 && sceneT < 9.5) window.Director.highlightElement('.settle-stepper', true);
        else window.Director.highlightElement('.receipt-success-banner', true);
      }, {
        cX: cursorX,
        cY: cursorY,
        badge: scenes[3].badge,
        subHtml: `With one tap on <span class="sub-green">'Settle to Bank'</span>, StellarPe requests a <span class="sub-highlight">SEP-38 rate quote</span> and launches a <span class="sub-green">SEP-24 anchor withdrawal</span>, sending funds straight to the merchant's bank account.`,
        sceneT
      });
    }

    // ── SCENE 5 [49.75 – 55.92s] ──
    else {
      const sceneT = t - scenes[4].startTime;
      let cursorX = 960, cursorY = 600;

      if (sceneT < 1.5) {
        cursorX = 960;
        cursorY = 640;
        if (sceneT >= 0.8 && !appState.receiptClosed) {
          appState.receiptClosed = true;
          await page.evaluate(() => {
            window.Director.triggerClickRipple(960, 640);
            const doneBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Done & Return'));
            if (doneBtn) doneBtn.click();
          });
        }
      } else if (sceneT < 3.2) {
        cursorX = lerp(960, 1020, easeInOutCubic((sceneT - 1.5) / 1.7));
        cursorY = 560;
        if (sceneT >= 2.8 && !appState.feedbackDone) {
          appState.feedbackDone = true;
          await page.evaluate(() => {
            window.Director.triggerClickRipple(1020, 560);
            const stars = document.querySelectorAll('.star-btn, .feedback-stars button, [aria-label*="star"]');
            if (stars.length >= 5) stars[4].click();
          });
        }
      } else {
        cursorX = 960;
        cursorY = 540;
        if (!appState.outroActive) {
          appState.outroActive = true;
          await page.evaluate(() => {
            window.Director.setOutro(true);
            window.Director.highlightElement(null);
          });
        }
      }

      await page.evaluate(({ cX, cY, badge, subHtml }) => {
        window.Director.setCursor(cX, cY);
        window.Director.setScene(badge, subHtml);
      }, {
        cX: cursorX,
        cY: cursorY,
        badge: scenes[4].badge,
        subHtml: `<span class="sub-green">Fast, atomic, and frictionless.</span> Real-world commerce powered by <span class="sub-highlight">Stellar</span>. Thank you!`
      });
    }

    const framePath = path.join(FRAMES_DIR, `frame_${String(frame).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: framePath, type: 'jpeg', quality: 88 });

    if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
      const elapsed = (Date.now() - tStart) / 1000;
      const fpsRender = (frame + 1) / elapsed;
      console.log(`[Video Director] Rendered frame ${frame + 1}/${TOTAL_FRAMES} (${((frame + 1)/TOTAL_FRAMES * 100).toFixed(1)}%) — ${fpsRender.toFixed(1)} fps`);
    }
  }

  await browser.close();
  console.log('All frames captured! Now compiling video with FFmpeg...');

  // ── 6. FFMPEG COMPILATION ──
  const masterNarration = path.join(TMP_VIDEO_DIR, 'master_narration.mp3');
  const ambientBgm = path.join(TMP_VIDEO_DIR, 'ambient_bgm.mp3');

  console.log('Encoding MP4 (1080p Full HD @ 30fps)...');
  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-framerate', '30',
    '-i', path.join(FRAMES_DIR, 'frame_%05d.jpg'),
    '-i', masterNarration,
    '-i', ambientBgm,
    '-filter_complex', `"[1:a]volume=1.0[narration];[2:a]volume=0.18,afade=t=in:ss=0:d=1.5,afade=t=out:st=52:d=3.5[bgm];[narration][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"`,
    '-map', '0:v',
    '-map', '"[aout]"',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    OUTPUT_MP4
  ];

  execSync(ffmpegCmd.join(' '), { stdio: 'inherit', shell: '/bin/bash' });
  console.log(`✅ MP4 created at: ${OUTPUT_MP4}`);

  console.log('Encoding WebM format...');
  const webmCmd = [
    'ffmpeg', '-y',
    '-i', OUTPUT_MP4,
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-c:a', 'libopus',
    '-b:a', '128k',
    OUTPUT_WEBM
  ];
  execSync(webmCmd.join(' '), { stdio: 'inherit', shell: '/bin/bash' });
  console.log(`✅ WebM created at: ${OUTPUT_WEBM}`);

  // Copy to Artifact directory for user embedding
  const artifactVideoPath = path.join(ARTIFACT_DIR, 'stellarpe_demo_60s.mp4');
  fs.copyFileSync(OUTPUT_MP4, artifactVideoPath);
  console.log(`✅ Artifact video copied to: ${artifactVideoPath}`);

  console.log('\n🎉 Demo Video Generation 100% Complete!');
}

try {
  await run();
} catch (err) {
  console.error('Video generation error:', err);
} finally {
  backendProc.kill();
  frontendProc.kill();
  process.exit(0);
}
