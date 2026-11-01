const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9227;

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

  await sleep(2000);

  const resp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await resp.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));

  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'Runtime.enable');

  // Set desktop viewport 1280x800
  await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 2, // High resolution for clear edge inspection
    mobile: false,
  });

  // 1. Landing Page
  await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await sleep(1500);

  // Check scrollbar computed styles
  const scrollbarCheck = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        const root = document.documentElement;
        const style = window.getComputedStyle(root);
        return {
          scrollbarWidth: style.scrollbarWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          canScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('Landing scrollbar check:', scrollbarCheck.result.value);

  // Scroll down slightly so thumb is visible
  await sendCommand(ws, 'Runtime.evaluate', { expression: 'window.scrollTo(0, 300);' });
  await sleep(500);

  // Full screenshot
  const shotLanding = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const landingFile = path.join(ARTIFACT_DIR, 'toranly_scrollbar_landing.png');
  fs.writeFileSync(landingFile, Buffer.from(shotLanding.data, 'base64'));
  console.log(`Saved screenshot: ${landingFile}`);

  // Macro screenshot of top-right edge (verifying top edge has NO arrow button)
  const shotTopEdge = await sendCommand(ws, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 1240,
      y: 0,
      width: 40,
      height: 250,
      scale: 1,
    },
  });
  const topEdgeFile = path.join(ARTIFACT_DIR, 'toranly_scrollbar_top_edge_macro.png');
  fs.writeFileSync(topEdgeFile, Buffer.from(shotTopEdge.data, 'base64'));
  console.log(`Saved screenshot: ${topEdgeFile}`);

  // Macro screenshot of bottom-right edge (verifying bottom edge has NO arrow button)
  const shotBottomEdge = await sendCommand(ws, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 1240,
      y: 550,
      width: 40,
      height: 250,
      scale: 1,
    },
  });
  const bottomEdgeFile = path.join(ARTIFACT_DIR, 'toranly_scrollbar_bottom_edge_macro.png');
  fs.writeFileSync(bottomEdgeFile, Buffer.from(shotBottomEdge.data, 'base64'));
  console.log(`Saved screenshot: ${bottomEdgeFile}`);

  // Seed sample plan
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
            themeWords: ['Royal Heritage', 'Sunset Terracotta'],
            dietFocus: ['Vegetarian'],
            customs: ['Sangeet Night'],
            avoidColours: ['Black'],
            notes: 'Palace celebration.'
          }
        },
        functions: [
          { id: 'fn-1', name: 'Mehendi', date: '2027-02-13', position: 1 },
          { id: 'fn-2', name: 'Sangeet', date: '2027-02-14', position: 2 },
          { id: 'fn-3', name: 'Wedding Ceremony', date: '2027-02-15', position: 3 }
        ],
        budgetCategories: [
          { id: 'cat-1', key: 'venue', label: 'Venue & Stays', allocatedPaise: 70000000, position: 1 },
          { id: 'cat-2', key: 'catering', label: 'Catering', allocatedPaise: 75000000, position: 2 }
        ],
        expenses: [],
        tasks: [
          { id: 'task-1', title: 'Lock in main venue', categoryKey: 'venue', dueDate: '2026-10-28', status: 'done', isMilestone: true, position: 1 }
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
      return 'Plan seeded';
    })()
  `;
  await sendCommand(ws, 'Runtime.evaluate', { expression: seedScript, awaitPromise: true });

  // 2. Settings Page
  await sendCommand(ws, 'Page.navigate', {
    url: 'http://127.0.0.1:5173/events/plan-ananya-rohan/settings',
  });
  await sleep(1500);

  // Scroll down slightly
  await sendCommand(ws, 'Runtime.evaluate', { expression: 'window.scrollTo(0, 250);' });
  await sleep(500);

  const shotSettings = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const settingsFile = path.join(ARTIFACT_DIR, 'toranly_scrollbar_settings.png');
  fs.writeFileSync(settingsFile, Buffer.from(shotSettings.data, 'base64'));
  console.log(`Saved screenshot: ${settingsFile}`);

  // Test native smooth scrolling programmatic trigger
  const scrollTest = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        const startY = window.scrollY;
        window.scrollTo({ top: 500, behavior: 'smooth' });
        return { startY, maxScroll: document.documentElement.scrollHeight - window.innerHeight };
      })()
    `,
    returnByValue: true,
  });
  console.log('Scroll action test:', scrollTest.result.value);

  ws.close();
  chromeProc.kill();
  console.log('All scrollbar verification completed successfully!');
}

run().catch((err) => {
  console.error('Error verifying scrollbar:', err);
  process.exit(1);
});
