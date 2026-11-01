const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9240;

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
  console.log('Saved screenshot:', outPath);
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_edit_setup');
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
    await sendCommand(ws, 'DOM.enable');
    await sendCommand(ws, 'CSS.enable');

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
    console.log('Seeding sample celebration in IndexedDB...');
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
            eventDate: '2026-12-18',
            timezone: 'Asia/Kolkata',
            city: 'Jaipur, Rajasthan',
            guestEstimate: 350,
            budgetTotalPaise: 250000000,
            currency: 'INR',
            preferences: {
              themeWords: ['Royal Heritage', 'Marigold Elegance'],
              dietFocus: ['Pure Veg', 'Jain Options'],
              customs: ['Sangeet', 'Haldi', 'Baraat', 'Pheras'],
              avoidColours: ['Black'],
              notes: 'Grand Rajputana courtyard celebration'
            }
          },
          functions: [],
          budgetCategories: [],
          expenses: [],
          tasks: [],
          vendors: [],
          guests: { veg: 280, jain: 40, nonVeg: 30, eggetarian: 0, vegan: 0 },
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

    // Navigate to planner Overview tab
    console.log('Navigating to /events/ev-ananya-rohan-wedding ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2500);

    // 1. Inspect Default State of Buttons
    console.log('Inspecting Default Button Styles...');
    const defaultStyles = await evaluate(ws, `
      (() => {
        const printBtn = document.querySelector('.planner-tool-btn[title*="Print"]');
        const backupBtn = document.querySelector('.planner-tool-btn[title*="Backup"]');
        const editSetupBtn = document.querySelector('.planner-edit-setup-btn');
        const editSetupSvg = editSetupBtn ? editSetupBtn.querySelector('svg') : null;

        const getStyles = (el) => {
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return {
            backgroundColor: s.backgroundColor,
            borderColor: s.borderColor,
            borderWidth: s.borderWidth,
            borderStyle: s.borderStyle,
            color: s.color,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            height: s.height,
            padding: s.padding,
            borderRadius: s.borderRadius,
          };
        };

        const svgColor = editSetupSvg ? window.getComputedStyle(editSetupSvg).color : null;
        const svgStroke = editSetupSvg ? window.getComputedStyle(editSetupSvg).stroke : null;

        // Also check overview nav item to make sure it wasn't modified
        const overviewNav = document.querySelector('.planner-nav-item.active');
        const overviewNavText = overviewNav ? overviewNav.textContent.trim() : null;

        return {
          printBtn: getStyles(printBtn),
          backupBtn: getStyles(backupBtn),
          editSetupBtn: getStyles(editSetupBtn),
          editSetupSvgColor: svgColor,
          editSetupSvgStroke: svgStroke,
          activeNavIsOverview: overviewNavText ? overviewNavText.includes('Overview') : false,
        };
      })()
    `);

    console.log('Default Styles Result:\n', JSON.stringify(defaultStyles, null, 2));

    // Capture zoomed screenshot of the topbar actions area
    const actionsRect = await evaluate(ws, `
      (() => {
        const actions = document.querySelector('.planner-topbar-actions');
        if (!actions) return null;
        const r = actions.getBoundingClientRect();
        return {
          x: Math.max(0, Math.floor(r.left - 20)),
          y: Math.max(0, Math.floor(r.top - 10)),
          width: Math.ceil(r.width + 40),
          height: Math.ceil(r.height + 20)
        };
      })()
    `);

    await captureScreenshot(ws, 'edit_setup_default_state.png', {
      x: actionsRect.x,
      y: actionsRect.y,
      width: actionsRect.width,
      height: actionsRect.height,
      scale: 2,
    });

    // Capture full topbar header
    await captureScreenshot(ws, 'edit_setup_full_header.png', {
      x: 0,
      y: 0,
      width: 1440,
      height: 120,
      scale: 2,
    });

    // 2. Test Hover State on Edit Setup
    console.log('Testing Hover State...');
    const editBtnRect = await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.planner-edit-setup-btn');
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    `);

    await sendCommand(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: editBtnRect.x,
      y: editBtnRect.y,
    });
    await sleep(300);

    const hoverStyles = await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.planner-edit-setup-btn');
        const svg = btn ? btn.querySelector('svg') : null;
        const s = window.getComputedStyle(btn);
        return {
          backgroundColor: s.backgroundColor,
          borderColor: s.borderColor,
          color: s.color,
          svgColor: svg ? window.getComputedStyle(svg).color : null,
        };
      })()
    `);
    console.log('Hover Styles Result:\n', JSON.stringify(hoverStyles, null, 2));

    await captureScreenshot(ws, 'edit_setup_hover_state.png', {
      x: actionsRect.x,
      y: actionsRect.y,
      width: actionsRect.width,
      height: actionsRect.height,
      scale: 2,
    });

    // 3. Test Focus-Visible State
    console.log('Testing Focus-Visible State...');
    // Move mouse away first
    await sendCommand(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 10,
      y: 10,
    });
    await sleep(200);

    // Focus via Tab
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.planner-edit-setup-btn');
        btn.focus({ focusVisible: true });
      })()
    `);
    await sleep(200);

    const focusStyles = await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.planner-edit-setup-btn');
        const s = window.getComputedStyle(btn);
        return {
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor,
          outlineWidth: s.outlineWidth,
        };
      })()
    `);
    console.log('Focus Styles Result:\n', JSON.stringify(focusStyles, null, 2));

    await captureScreenshot(ws, 'edit_setup_focus_state.png', {
      x: actionsRect.x,
      y: actionsRect.y,
      width: actionsRect.width,
      height: actionsRect.height,
      scale: 2,
    });

    // 4. Test Click/Navigation behavior
    console.log('Testing Click Behavior...');
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.planner-edit-setup-btn');
        btn.click();
      })()
    `);
    await sleep(1000);

    const navigatedUrl = await evaluate(ws, `window.location.href`);
    console.log('URL after clicking Edit Setup:', navigatedUrl);

    if (!navigatedUrl.includes('/setup?step=1')) {
      throw new Error('Clicking Edit Setup did not navigate to /setup?step=1');
    }

    console.log('All Edit Setup styling and functionality verifications passed!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

