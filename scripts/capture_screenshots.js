const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9222;

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

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_profile');
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

  console.log('Spawned Chrome process, waiting for port...');
  await sleep(2000);

  // Fetch WebSocket target
  const resp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await resp.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  console.log('Target found:', pageTarget.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  console.log('WebSocket connected to Chrome');

  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'Runtime.enable');

  // Navigate to root to initialize IndexedDB domain
  await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await sleep(1500);

  // Seed sample plan into IndexedDB
  const seedScript = `
    (async () => {
      const dbRequest = indexedDB.open('toranly', 1);
      dbRequest.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('snapshots')) {
          const s = db.createObjectStore('snapshots', { keyPath: 'id' });
          s.createIndex('planId', 'planId');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      const db = await new Promise((res, rej) => {
        dbRequest.onsuccess = () => res(dbRequest.result);
        dbRequest.onerror = rej;
      });

      const samplePlan = {
        id: 'plan-ananya-rohan',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        event: {
          type: 'wedding',
          title: 'Ananya & Rohan Wedding',
          eventDate: '2027-02-15',
          timezone: 'Asia/Kolkata',
          city: 'Udaipur',
          guestEstimate: 250,
          budgetTotalPaise: 250000000,
          currency: 'INR',
          preferences: {
            themeWords: ['Royal Heritage', 'Sunset Terracotta', 'Peacock Teal'],
            dietFocus: ['Vegetarian', 'Jain'],
            customs: ['Sangeet Night', 'Pheras at Sunset', 'Toran Ceremony'],
            avoidColours: ['Black', 'Navy'],
            notes: 'Palace courtyard celebration with traditional Rajasthani folk music and live dessert station.'
          }
        },
        functions: [
          { id: 'fn-1', name: 'Mehendi & High Tea', date: '2027-02-13', startTime: '15:00', endTime: '18:30', position: 1 },
          { id: 'fn-2', name: 'Sangeet & Cocktail', date: '2027-02-14', startTime: '19:00', endTime: '23:30', position: 2 },
          { id: 'fn-3', name: 'Wedding Ceremony (Pheras)', date: '2027-02-15', startTime: '16:00', endTime: '20:00', position: 3 },
          { id: 'fn-4', name: 'Grand Reception', date: '2027-02-16', startTime: '19:30', endTime: '23:00', position: 4 }
        ],
        budgetCategories: [
          { id: 'cat-1', key: 'venue', label: 'Venue & Stays', allocatedPaise: 70000000, position: 1 },
          { id: 'cat-2', key: 'catering', label: 'Catering & Dining', allocatedPaise: 75000000, position: 2 },
          { id: 'cat-3', key: 'decor', label: 'Decor & Mandap', allocatedPaise: 35000000, position: 3 },
          { id: 'cat-4', key: 'attire', label: 'Attire & Jewellery', allocatedPaise: 25000000, position: 4 },
          { id: 'cat-5', key: 'photo', label: 'Photography & Film', allocatedPaise: 20000000, position: 5 },
          { id: 'cat-6', key: 'entertainment', label: 'Music & Sangeet', allocatedPaise: 10000000, position: 6 },
          { id: 'cat-7', key: 'invitations', label: 'Invitations & Favours', allocatedPaise: 7500000, position: 7 },
          { id: 'cat-8', key: 'contingency', label: 'Contingency Fund', allocatedPaise: 7500000, position: 8 }
        ],
        expenses: [
          { id: 'exp-1', categoryId: 'cat-1', title: 'Palace Lawn Advance', amountPaise: 30000000, status: 'paid', paidAt: new Date().toISOString() },
          { id: 'exp-2', categoryId: 'cat-2', title: 'Catering Deposit (50%)', amountPaise: 35000000, status: 'paid', paidAt: new Date().toISOString() }
        ],
        tasks: [
          { id: 'task-1', title: 'Lock in main venue & dates', categoryKey: 'venue', dueDate: '2026-10-28', status: 'done', isMilestone: true, position: 1 },
          { id: 'task-2', title: 'Book photography team with deposit', categoryKey: 'photo', dueDate: '2026-11-22', status: 'open', isMilestone: true, position: 2 },
          { id: 'task-3', title: 'Finalise caterer tasting and menu items', categoryKey: 'catering', dueDate: '2026-12-07', status: 'open', isMilestone: true, position: 3 },
          { id: 'task-4', title: 'Send invitations with RSVP links', categoryKey: 'invitations', dueDate: '2026-12-17', status: 'open', isMilestone: true, position: 4 }
        ],
        vendors: [],
        guests: [],
        scheduleItems: [],
        ideas: []
      };

      const tx = db.transaction(['plans'], 'readwrite');
      tx.objectStore('plans').put(samplePlan);
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
      });
      return 'Plan seeded successfully';
    })()
  `;

  const seedResult = await sendCommand(ws, 'Runtime.evaluate', {
    expression: seedScript,
    awaitPromise: true,
  });
  console.log('Seed result:', seedResult);

  // Viewport configurations to test
  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900, isMobile: false },
    { name: 'tablet_768', width: 768, height: 1024, isMobile: false },
    { name: 'mobile_390', width: 390, height: 844, isMobile: true },
  ];

  for (const vp of viewports) {
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });

    // 1. Overview Page
    await sendCommand(ws, 'Page.navigate', {
      url: 'http://127.0.0.1:5173/events/plan-ananya-rohan',
    });
    await sleep(1500);

    const shotOverview = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    const ovFile = path.join(ARTIFACT_DIR, `planner_shell_overview_${vp.name}.png`);
    fs.writeFileSync(ovFile, Buffer.from(shotOverview.data, 'base64'));
    console.log(`Saved screenshot: ${ovFile}`);

    // 2. Settings Page
    await sendCommand(ws, 'Page.navigate', {
      url: 'http://127.0.0.1:5173/events/plan-ananya-rohan/settings',
    });
    await sleep(1500);

    const shotSettings = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    const stFile = path.join(ARTIFACT_DIR, `planner_settings_${vp.name}.png`);
    fs.writeFileSync(stFile, Buffer.from(shotSettings.data, 'base64'));
    console.log(`Saved screenshot: ${stFile}`);
  }

  // Also capture mobile bottom sheet open state
  await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `
      const moreBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('More'));
      if (moreBtn) moreBtn.click();
    `,
  });
  await sleep(600);
  const shotMoreSheet = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const sheetFile = path.join(ARTIFACT_DIR, `planner_mobile_more_sheet_390.png`);
  fs.writeFileSync(sheetFile, Buffer.from(shotMoreSheet.data, 'base64'));
  console.log(`Saved screenshot: ${sheetFile}`);

  ws.close();
  chromeProc.kill();
  console.log('Screenshots completed successfully!');
}

run().catch((err) => {
  console.error('Error running CDP test:', err);
  process.exit(1);
});

