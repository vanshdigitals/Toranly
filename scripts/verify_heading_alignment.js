const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9255;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const res = await sendCommand(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : null;
}

async function captureScreenshot(ws, filename, clip) {
  const params = { format: 'png' };
  if (clip) params.clip = clip;
  const res = await sendCommand(ws, 'Page.captureScreenshot', params);
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log('Saved screenshot:', filename, '(' + buf.length + ' bytes)');
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_heading_verify');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tmpDir}`,
    'about:blank',
  ]);

  await sleep(2000);

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await resp.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'Runtime.enable');

    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    console.log('Navigating to http://127.0.0.1:5173/events ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events' });
    await sleep(2000);

    // Seed sample plan
    console.log('Seeding celebration plan in IndexedDB...');
    await evaluate(ws, `
      (async () => {
        const weddingPlan = {
          id: 'ev-ananya-rohan-wedding',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          event: {
            type: 'wedding',
            title: "Ananya & Rohan's Wedding",
            eventDate: '2027-02-14',
            timezone: 'Asia/Kolkata',
            city: 'Jaipur',
            guestEstimate: 250,
            budgetTotalPaise: 180000000,
            currency: 'INR',
            preferences: {
              themeWords: ['marigold', 'courtyard', 'warm lights'],
              avoidColours: ['black'],
              customs: ['haldi', 'pheras'],
              notes: 'Immediate family arrives Jaipur by noon 11 Feb. Pheras mandap setup begins early morning 14 Feb.'
            }
          },
          functions: [
            { id: 'fn-1', name: 'Mehendi', date: '2027-02-12', startTime: '16:00', endTime: '21:00', position: 1 },
            { id: 'fn-2', name: 'Sangeet', date: '2027-02-13', startTime: '19:00', endTime: '23:30', position: 2 },
            { id: 'fn-3', name: 'Wedding', date: '2027-02-14', startTime: '10:00', endTime: '15:00', position: 3 },
            { id: 'fn-4', name: 'Reception', date: '2027-02-14', startTime: '19:30', endTime: '23:30', position: 4 }
          ],
          budgetCategories: [
            { id: 'cat-venue', key: 'venue', label: 'Venue & Stays', allocatedPaise: 80000000, position: 1 },
            { id: 'cat-catering', key: 'catering', label: 'Catering & Dining', allocatedPaise: 60000000, position: 2 },
            { id: 'cat-decor', key: 'decor', label: 'Decor & Florals', allocatedPaise: 40000000, position: 3 }
          ],
          expenses: [
            { id: 'exp-1', categoryId: 'cat-venue', description: 'Palace Courtyard Advance', amountPaise: 40000000, kind: 'paid', spentOn: '2026-08-15' }
          ],
          tasks: [
            { id: 'tsk-1', title: 'Book palace venue courtyard', categoryKey: 'venue', dueDate: '2026-11-01', status: 'done', isMilestone: true, dependsOn: [], position: 1 }
          ],
          vendors: [],
          guests: { total: 250, veg: 200, jain: 35, nonVeg: 15, eggetarian: 0, vegan: 0, allergyTags: [], accessibilityNeeds: [] },
          ideas: [],
          quotes: [],
          scheduleItems: [],
          notes: []
        };

        const req = indexedDB.open('toranly', 1);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('plans', 'readwrite');
            const store = tx.objectStore('plans');
            store.put(weddingPlan);
            tx.oncomplete = () => resolve('ok');
            tx.onerror = (e) => reject(e);
          };
          req.onerror = (e) => reject(e);
        });
      })()
    `);

    await evaluate(ws, `localStorage.setItem('toranly_planner_sidebar_collapsed', 'false');`);

    // --- 1. INSPECT SETTINGS HEADING ---
    console.log('Navigating to Settings tab...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/settings' });
    await sleep(2500);

    const settingsHeadingAudit = await evaluate(ws, `
      (() => {
        const breadcrumb = document.querySelector('.settings-breadcrumb');
        const header = document.querySelector('.settings-page-header');
        const title = document.querySelector('.settings-page-title');
        const desc = document.querySelector('.settings-page-desc');

        const titleComputed = title ? window.getComputedStyle(title) : null;
        const descComputed = desc ? window.getComputedStyle(desc) : null;
        const headerComputed = header ? window.getComputedStyle(header) : null;

        return {
          hasBreadcrumb: !!breadcrumb,
          headerExists: !!header,
          titleText: title ? title.textContent.trim() : null,
          descText: desc ? desc.textContent.trim() : null,
          titleFontFamily: titleComputed ? titleComputed.fontFamily : null,
          titleFontSize: titleComputed ? titleComputed.fontSize : null,
          titleFontWeight: titleComputed ? titleComputed.fontWeight : null,
          titleLineHeight: titleComputed ? titleComputed.lineHeight : null,
          titleLetterSpacing: titleComputed ? titleComputed.letterSpacing : null,
          titleColor: titleComputed ? titleComputed.color : null,
          titleMarginTop: titleComputed ? titleComputed.marginTop : null,
          titleMarginBottom: titleComputed ? titleComputed.marginBottom : null,
          descFontSize: descComputed ? descComputed.fontSize : null,
          descFontWeight: descComputed ? descComputed.fontWeight : null,
          descColor: descComputed ? descComputed.color : null,
          descMarginTop: descComputed ? descComputed.marginTop : null,
          headerMarginBottom: headerComputed ? headerComputed.marginBottom : null,
        };
      })()
    `);
    console.log('Settings Heading Audit:', settingsHeadingAudit);
    await captureScreenshot(ws, 'settings_heading_aligned_desktop.png');

    // --- 2. INSPECT BUDGET HEADING ---
    console.log('Navigating to Budget tab...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget' });
    await sleep(2000);

    const budgetHeadingAudit = await evaluate(ws, `
      (() => {
        const title = document.querySelector('.budget-title');
        const desc = document.querySelector('.budget-description');
        const header = document.querySelector('.budget-page-header');

        const titleComputed = title ? window.getComputedStyle(title) : null;
        const descComputed = desc ? window.getComputedStyle(desc) : null;
        const headerComputed = header ? window.getComputedStyle(header) : null;

        return {
          titleText: title ? title.textContent.trim() : null,
          titleFontFamily: titleComputed ? titleComputed.fontFamily : null,
          titleFontSize: titleComputed ? titleComputed.fontSize : null,
          titleFontWeight: titleComputed ? titleComputed.fontWeight : null,
          titleLineHeight: titleComputed ? titleComputed.lineHeight : null,
          titleLetterSpacing: titleComputed ? titleComputed.letterSpacing : null,
          titleColor: titleComputed ? titleComputed.color : null,
          titleMarginTop: titleComputed ? titleComputed.marginTop : null,
          titleMarginBottom: titleComputed ? titleComputed.marginBottom : null,
          descFontSize: descComputed ? descComputed.fontSize : null,
          descFontWeight: descComputed ? descComputed.fontWeight : null,
          descColor: descComputed ? descComputed.color : null,
          descMarginTop: descComputed ? descComputed.marginTop : null,
          headerMarginBottom: headerComputed ? headerComputed.marginBottom : null,
        };
      })()
    `);
    console.log('Budget Heading Audit:', budgetHeadingAudit);
    await captureScreenshot(ws, 'budget_heading_comparison_desktop.png');

    // --- 3. TABLET & MOBILE SETTINGS VIEWPORT ---
    console.log('Testing Tablet Viewport (834px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 834,
      height: 1112,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/settings' });
    await sleep(1500);
    await captureScreenshot(ws, 'settings_heading_tablet.png');

    console.log('Testing Mobile Viewport (390px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(1000);
    await captureScreenshot(ws, 'settings_heading_mobile.png');

    console.log('--- ALL HEADING VERIFICATION CHECKS COMPLETE ---');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});

