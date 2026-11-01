const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9245;

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

async function captureScreenshot(ws, filename) {
  const res = await sendCommand(ws, 'Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
}

async function setViewport(ws, width, height, isMobile = false) {
  await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: isMobile,
  });
  await sleep(300);
}

async function run() {
  console.log('--- Launching Chrome for Ideas Workspace Verification ---');
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=C:\\Users\\vansh\\Documents\\Toranly\\.tmp_chrome_profile',
    'http://127.0.0.1:5173/events/plan-ananya-rohan/ideas',
  ]);

  try {
    await sleep(2500);
    const resp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await resp.json();
    const wsUrl = targets[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'DOM.enable');

    // 1. Initial Desktop View (Empty state if no ideas)
    await setViewport(ws, 1440, 960);
    await sleep(1000);

    const initialStats = await evaluate(ws, `(() => {
      const title = document.querySelector('.ideas-page-title')?.innerText;
      const desc = document.querySelector('.ideas-page-desc')?.innerText;
      const emptyTitle = document.querySelector('.ideas-empty-title')?.innerText;
      const ideaCards = document.querySelectorAll('.idea-card-item').length;
      return { title, desc, emptyTitle, ideaCards };
    })()`);
    console.log('Initial Page State:', initialStats);

    await captureScreenshot(ws, 'ideas_workspace_initial_empty.png');

    // 2. Populate test celebration ideas in IndexedDB to verify full board matching Stitch
    console.log('--- Populating test celebration ideas & dietary breakdown ---');
    await evaluate(ws, `(async () => {
      const sampleIdeas = [
        {
          id: 'idea-1',
          kind: 'theme',
          title: 'Marigold courtyard',
          body: 'Strings of marigold and mango leaves over the entrance, warm fairy lights and brass lamps.',
          dietTags: [],
          estimateMinPaise: 4500000,
          estimateMaxPaise: 7000000,
          source: 'ai',
          confirmed: false
        },
        {
          id: 'idea-2',
          kind: 'decor',
          title: 'Brass and jasmine table settings',
          body: 'Brass plates and fresh jasmine on every table for the reception.',
          dietTags: [],
          estimateMinPaise: 2000000,
          estimateMaxPaise: 3500000,
          source: 'ai',
          confirmed: false
        },
        {
          id: 'idea-3',
          kind: 'decor',
          title: 'Family photo wall',
          body: 'Old wedding photos of both families near the entrance.',
          dietTags: [],
          source: 'user',
          personalized: true,
          personalNote: 'Framed black & white ancestral wedding portraits.'
        },
        {
          id: 'idea-4',
          kind: 'menu',
          title: 'Paneer tikka',
          body: 'Tandoor roasted cottage cheese skewers with spiced capsicum and mint dip.',
          dietTags: ['Veg', 'Jain'],
          source: 'ai',
          confirmed: false
        },
        {
          id: 'idea-5',
          kind: 'menu',
          title: 'Dal makhani',
          body: 'Slow-cooked black lentils simmered overnight with cream and fresh churned white butter.',
          dietTags: ['Veg'],
          source: 'ai',
          confirmed: false
        },
        {
          id: 'idea-6',
          kind: 'menu',
          title: 'Chicken seekh kebab',
          body: 'Minced spiced chicken skewers grilled over charcoal, served with roomali roti.',
          dietTags: ['Non-veg'],
          source: 'ai',
          confirmed: false
        },
        {
          id: 'idea-7',
          kind: 'menu',
          title: 'Live chai counter at the mehendi',
          body: 'Kulhad masala chai and filter coffee brewed fresh with traditional biscuits.',
          dietTags: ['Veg'],
          source: 'user',
          personalized: true,
          personalNote: 'Special ginger-cardamom chai blend.'
        },
        {
          id: 'idea-8',
          kind: 'saving',
          title: 'Reuse sangeet stage decor for the reception',
          body: 'Same look in both sets of photos.',
          dietTags: [],
          estimateMinPaise: 2000000,
          estimateMaxPaise: 3500000,
          source: 'ai',
          confirmed: false
        }
      ];

      const guestData = {
        expectedTotal: 250,
        veg: 140,
        nonVeg: 70,
        jain: 30,
        eggetarian: 10,
        vegan: 0,
        allergyTags: [],
        accessibilityNeeds: []
      };

      const req = indexedDB.open('toranly', 1);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('plans', 'readwrite');
          const store = tx.objectStore('plans');
          const getReq = store.get('plan-ananya-rohan');
          getReq.onsuccess = () => {
            const plan = getReq.result;
            plan.ideas = sampleIdeas;
            plan.guests = guestData;
            store.put(plan);
            tx.oncomplete = () => resolve(true);
          };
          getReq.onerror = reject;
        };
        req.onerror = reject;
      });
    })()`);

    // Reload page to re-read plan
    await sendCommand(ws, 'Page.reload');
    await sleep(2000);

    // 3. Verify Board with All Ideas
    const boardStats = await evaluate(ws, `(() => {
      const cards = document.querySelectorAll('.idea-card-item');
      const pills = Array.from(document.querySelectorAll('.ideas-filter-pill')).map(p => p.innerText.trim());
      const dietNotice = document.querySelector('.ideas-diet-notice-text')?.innerText.trim();
      const warningBadge = document.querySelector('.ideas-diet-warning-badge')?.innerText.trim();
      const countDisplay = document.querySelector('.ideas-count-display')?.innerText.trim();
      const groups = Array.from(document.querySelectorAll('.idea-group-title')).map(g => g.innerText.trim());

      return {
        cardCount: cards.length,
        pills,
        dietNotice,
        warningBadge,
        countDisplay,
        groups
      };
    })()`);
    console.log('Board State with 8 ideas:', boardStats);

    await captureScreenshot(ws, 'ideas_workspace_desktop_board.png');

    // 4. Test Category Filter Navigation (Switch to Menu)
    console.log('--- Testing Category Filter: Menu ---');
    await evaluate(ws, `(() => {
      const menuPill = Array.from(document.querySelectorAll('.ideas-filter-pill')).find(p => p.innerText.includes('Menu'));
      if (menuPill) menuPill.click();
    })()`);
    await sleep(500);

    const filteredStats = await evaluate(ws, `(() => {
      const cards = document.querySelectorAll('.idea-card-item').length;
      const countDisplay = document.querySelector('.ideas-count-display')?.innerText.trim();
      const activePill = document.querySelector('.ideas-filter-pill.is-active')?.innerText.trim();
      return { cards, countDisplay, activePill };
    })()`);
    console.log('Filtered State (Menu):', filteredStats);
    await captureScreenshot(ws, 'ideas_workspace_filtered_menu.png');

    // Switch back to All
    await evaluate(ws, `(() => {
      const allPill = Array.from(document.querySelectorAll('.ideas-filter-pill')).find(p => p.innerText.includes('All'));
      if (allPill) allPill.click();
    })()`);
    await sleep(400);

    // 5. Test Add Idea Modal
    console.log('--- Testing Add Idea Modal ---');
    await evaluate(ws, `(() => {
      const addBtn = document.querySelector('.ideas-btn-primary');
      if (addBtn) addBtn.click();
    })()`);
    await sleep(500);
    await captureScreenshot(ws, 'ideas_workspace_add_modal.png');

    // Close Add Modal
    await evaluate(ws, `(() => {
      const closeBtn = document.querySelector('.ideas-modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 6. Test Card Kebab Action Menu
    console.log('--- Testing Kebab Action Menu ---');
    await evaluate(ws, `(() => {
      const firstKebab = document.querySelector('.idea-kebab-btn');
      if (firstKebab) firstKebab.click();
    })()`);
    await sleep(400);
    await captureScreenshot(ws, 'ideas_workspace_kebab_menu_open.png');

    // 7. Test Delete Confirmation Dialog
    console.log('--- Testing Delete Confirmation Dialog ---');
    await evaluate(ws, `(() => {
      const delItem = Array.from(document.querySelectorAll('.idea-menu-item')).find(b => b.innerText.includes('Delete'));
      if (delItem) delItem.click();
    })()`);
    await sleep(500);
    await captureScreenshot(ws, 'ideas_workspace_delete_dialog.png');

    // Cancel delete
    await evaluate(ws, `(() => {
      const cancelBtn = document.querySelector('.ideas-modal-btn-cancel');
      if (cancelBtn) cancelBtn.click();
    })()`);
    await sleep(400);

    // 8. Test AI Suggestions Modal (Get More Ideas)
    console.log('--- Testing Get More Ideas (AI Modal) ---');
    await evaluate(ws, `(() => {
      const aiBtn = document.querySelector('.ideas-btn-secondary');
      if (aiBtn) aiBtn.click();
    })()`);
    await sleep(600);
    await captureScreenshot(ws, 'ideas_workspace_ai_modal.png');

    // Close AI modal
    await evaluate(ws, `(() => {
      const closeBtn = document.querySelector('.ideas-modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 9. Tablet View (768 x 1024)
    console.log('--- Capturing Tablet View ---');
    await setViewport(ws, 768, 1024);
    await sleep(600);
    await captureScreenshot(ws, 'ideas_workspace_tablet.png');

    // 10. Mobile View (375 x 812)
    console.log('--- Capturing Mobile View ---');
    await setViewport(ws, 375, 812, true);
    await sleep(600);
    await captureScreenshot(ws, 'ideas_workspace_mobile.png');

    console.log('--- All visual verification steps completed successfully! ---');
    ws.close();
  } finally {
    proc.kill();
  }
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});

