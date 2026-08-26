import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer-core';
import Database from 'better-sqlite3';

const ROOT_DIR = path.resolve('..');
const DB_PATH = path.join(ROOT_DIR, 'backend/data/stellarpe.sqlite');
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// 1. Seed Database
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

// Insert confirmed & settled transactions
const txs = [
  { payer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', stroops: 125000000, status: 'confirmed', hash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef', time: 1800 },
  { payer: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJM6EWWJAA', stroops: 80000000, status: 'confirmed', hash: 'b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef12', time: 3600 },
  { payer: 'GDQOE23CFSUMSVQK4Y5JHPPKTJ6XVMSO6RO3T46SO365AL2YJGDYW2EE', stroops: 250000000, status: 'settled', hash: 'c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234', time: 43200 },
  { payer: 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTOMP4Q', stroops: 150000000, status: 'settled', hash: 'd4e5f678901234567890abcdef1234567890abcdef1234567890abcdef123456', time: 86400 }
];

for (const t of txs) {
  db.prepare(`
    INSERT INTO transactions (merchant_id, payer_address, amount_stroops, asset, stellar_tx_hash, status, created_at)
    VALUES (?, ?, ?, 'USDC', ?, ?, strftime('%s','now') - ?)
  `).run(merchantId, t.payer, t.stroops, t.hash, t.status, t.time);
}

// Insert feedback
db.prepare(`
  INSERT INTO feedback (merchant_id, payer_address, rating, comment, created_at)
  VALUES (?, ?, 5, 'Super fast QR payment with digital dollars! No INR exchange delay.', strftime('%s','now') - 3600)
`).run(merchantId, txs[0].payer);

db.prepare(`
  INSERT INTO feedback (merchant_id, payer_address, rating, comment, created_at)
  VALUES (?, ?, 5, 'Settled directly to my bank within minutes via Stellar anchor flow.', strftime('%s','now') - 40000)
`).run(merchantId, merchantWallet);

// Insert events
db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('qr_generated', ?, '{"amount":"12.50"}')`).run(merchantId);
db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('payment_confirmed', ?, '{"amount":125000000}')`).run(merchantId);
db.prepare(`INSERT INTO events (event_name, merchant_id, metadata) VALUES ('settlement_confirmed', ?, '{"amount":400000000}')`).run(merchantId);

db.close();
console.log('Database seeded successfully.');

// 2. Start Servers
console.log('Starting backend and frontend servers...');
const backendProc = spawn('node', ['src/server.js'], { cwd: path.join(ROOT_DIR, 'backend'), env: { ...process.env, PORT: '3001' } });
const frontendProc = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { cwd: path.join(ROOT_DIR, 'frontend') });

await new Promise(resolve => setTimeout(resolve, 3500));

async function main() {
  console.log('Launching headless Chromium...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--hide-scrollbars']
  });

  // 1. Desktop Onboarding
  console.log('Capturing: 01_onboarding_desktop.png');
  let page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_onboarding_desktop.png') });

  // 2. Desktop Dashboard (Full Page)
  console.log('Capturing: 02_merchant_dashboard_desktop.png');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const demoBtn = buttons.find(b => b.textContent.includes('Explore Demo Merchant'));
    if (demoBtn) demoBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_merchant_dashboard_desktop.png'), fullPage: true });

  // 3. Desktop QR Generation
  console.log('Capturing: 03_qr_generator_desktop.png');
  await page.focus('.amount-input');
  await page.type('.amount-input', '15.00');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const genBtn = buttons.find(b => b.textContent.includes('Generate QR Code'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_qr_generator_desktop.png'), fullPage: true });

  // 4. Desktop Settle Preview & Interactive Modal
  console.log('Capturing: 04_settle_flow_desktop.png');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const settleBtn = buttons.find(b => b.textContent.includes('Settle to Bank'));
    if (settleBtn) settleBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_settle_flow_desktop.png'), fullPage: true });

  // 5. Desktop Feedback Card (scrolled to feedback section)
  console.log('Capturing: 05_feedback_modal_desktop.png');
  await page.evaluate(() => {
    const feedbackCard = document.querySelector('.feedback-form');
    if (feedbackCard) feedbackCard.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_feedback_modal_desktop.png') });

  // 6. Mobile Onboarding
  console.log('Capturing: 06_mobile_onboarding.png');
  let mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, '06_mobile_onboarding.png') });

  // 7. Mobile Dashboard
  console.log('Capturing: 07_mobile_dashboard.png');
  await mobilePage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const demoBtn = buttons.find(b => b.textContent.includes('Explore Demo Merchant'));
    if (demoBtn) demoBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, '07_mobile_dashboard.png'), fullPage: true });

  // 8. Mobile QR Payment Screen
  console.log('Capturing: 08_mobile_qr_payment.png');
  await mobilePage.focus('.amount-input');
  await mobilePage.type('.amount-input', '12.50');
  await mobilePage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const genBtn = buttons.find(b => b.textContent.includes('Generate QR Code'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, '08_mobile_qr_payment.png'), fullPage: true });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

try {
  await main();
} catch (e) {
  console.error('Screenshot error:', e);
} finally {
  backendProc.kill();
  frontendProc.kill();
  process.exit(0);
}
