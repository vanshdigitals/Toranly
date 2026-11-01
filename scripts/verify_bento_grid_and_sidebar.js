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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_bento_sidebar');
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

    // Seed sample plan with functions, budget, checklist, guests, and vendors
    console.log('Seeding rich celebration plan in IndexedDB...');
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
          functions: [
            { id: 'fn-1', name: 'Mehendi & High Tea', date: '2026-12-17', startTime: '15:00', endTime: '18:00', position: 1 },
            { id: 'fn-2', name: 'Sangeet Night & Dance Showcase', date: '2026-12-17', startTime: '19:30', endTime: '23:30', position: 2 },
            { id: 'fn-3', name: 'Haldi Ceremony & Pool Brunch', date: '2026-12-18', startTime: '10:00', endTime: '12:30', position: 3 },
            { id: 'fn-4', name: 'Varmala & Pheras in Courtyard', date: '2026-12-18', startTime: '17:00', endTime: '21:00', position: 4 }
          ],
          budgetCategories: [
            { id: 'cat-venue', key: 'venue', label: 'Venue & Stays', allocatedPaise: 100000000, position: 1 },
            { id: 'cat-catering', key: 'catering', label: 'Catering & Dining', allocatedPaise: 75000000, position: 2 },
            { id: 'cat-decor', key: 'decor', label: 'Decor & Florals', allocatedPaise: 35000000, position: 3 },
            { id: 'cat-photo', key: 'photo', label: 'Photography & Film', allocatedPaise: 25000000, position: 4 },
            { id: 'cat-music', key: 'music', label: 'Entertainment & DJ', allocatedPaise: 15000000, position: 5 }
          ],
          expenses: [
            { id: 'exp-1', categoryId: 'cat-venue', description: 'Palace Courtyard Advance', amountPaise: 40000000, kind: 'paid', spentOn: '2026-08-15' },
            { id: 'exp-2', categoryId: 'cat-catering', description: 'Royal Rajputana Banquet Advance', amountPaise: 35000000, kind: 'paid', spentOn: '2026-09-01' }
          ],
          tasks: [
            { id: 'tsk-1', title: 'Confirm palace courtyard booking deposit', categoryId: 'cat-venue', dueDate: '2026-09-01', status: 'done', isMilestone: true, dependsOn: [], position: 1 },
            { id: 'tsk-2', title: 'Finalize royal marigold stage concept & florals', categoryId: 'cat-decor', dueDate: '2026-10-15', status: 'open', isMilestone: true, dependsOn: [], position: 2 },
            { id: 'tsk-3', title: 'Review live chaat & Jain sweet counter degustation menu', categoryId: 'cat-catering', dueDate: '2026-11-01', status: 'open', isMilestone: false, dependsOn: ['tsk-1'], position: 3 },
            { id: 'tsk-4', title: 'Coordinate acoustic sound & DJ license permits', categoryId: 'cat-music', dueDate: '2026-11-15', status: 'open', isMilestone: false, dependsOn: [], position: 4 }
          ],
          vendors: [
            { id: 'ven-1', categoryId: 'cat-venue', name: 'Jaipur Heritage Palace & Havelis', categoryKey: 'Venue & Stays', phone: '+91 98290 12345', email: 'events@palace.in', status: 'booked' },
            { id: 'ven-2', categoryId: 'cat-catering', name: 'Marwar Gourmet Catering Services', categoryKey: 'Catering', phone: '+91 98290 54321', email: 'taste@marwar.in', status: 'booked' },
            { id: 'ven-3', categoryId: 'cat-photo', name: 'Kala Shutter Cinematic Weddings', categoryKey: 'Photography', phone: '+91 98290 99887', email: 'hello@kalashutter.com', status: 'shortlisted' }
          ],
          guests: { total: 350, veg: 270, jain: 45, nonVeg: 35, eggetarian: 0, vegan: 0, allergyTags: [], accessibilityNeeds: [] },
          ideas: [
            { id: 'id-1', text: 'Marigold entrance' }
          ],
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

    // Navigate to Overview
    console.log('Navigating to /events/ev-ananya-rohan-wedding ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2500);

    // 1. Inspect Bento Grid Structure & Card Geometries
    console.log('Inspecting Bento Grid & Card Spacing...');
    const bentoInspection = await evaluate(ws, `
      (() => {
        const grid = document.querySelector('.overview-bento-grid');
        if (!grid) return { error: 'overview-bento-grid not found' };

        const gridComputed = window.getComputedStyle(grid);
        const cards = Array.from(grid.querySelectorAll('.overview-card-section')).map(card => {
          const s = window.getComputedStyle(card);
          const header = card.querySelector('.overview-card-header');
          const title = card.querySelector('.overview-card-title')?.textContent?.trim();
          const sub = card.querySelector('.overview-card-sub')?.textContent?.trim();
          const action = card.querySelector('.overview-action-link')?.textContent?.trim();

          const r = card.getBoundingClientRect();
          return {
            title,
            sub,
            action,
            classes: card.className,
            padding: s.padding,
            borderRadius: s.borderRadius,
            boxShadow: s.boxShadow,
            width: Math.round(r.width),
            height: Math.round(r.height),
            top: Math.round(r.top),
            left: Math.round(r.left)
          };
        });

        // Metrics in Budget Card
        const metricBoxes = Array.from(document.querySelectorAll('.overview-metric-box')).map(b => ({
          label: b.querySelector('.overview-metric-label')?.textContent?.trim(),
          val: b.querySelector('.overview-metric-value')?.textContent?.trim()
        }));

        // Progress in Budget Card
        const progressFill = document.querySelector('.overview-progress-bar-fill');
        const progressMeta = document.querySelector('.overview-progress-meta')?.textContent?.trim();

        // Checklist tasks count
        const taskRows = document.querySelectorAll('.overview-task-row').length;

        // Guests hero metric
        const guestValue = document.querySelector('.overview-guests-hero-value')?.textContent?.trim();
        const dietPills = Array.from(document.querySelectorAll('.overview-diet-pill')).map(p => p.textContent.trim());

        // Functions list count
        const fnItems = document.querySelectorAll('.overview-function-item').length;

        // Vendor rows count
        const vendorRows = document.querySelectorAll('.overview-vendor-row').length;

        return {
          gridGap: gridComputed.gap,
          gridColumns: gridComputed.gridTemplateColumns,
          totalCards: cards.length,
          cards,
          budgetMetrics: metricBoxes,
          progressFillWidth: progressFill ? progressFill.style.width : null,
          progressMeta,
          taskRows,
          guestValue,
          dietPills,
          fnItems,
          vendorRows
        };
      })()
    `);

    console.log('Bento Grid Inspection:\n', JSON.stringify(bentoInspection, null, 2));

    // Capture Full Desktop Overview screenshot
    await captureScreenshot(ws, 'overview_bento_desktop.png', {
      x: 0,
      y: 0,
      width: 1440,
      height: 980,
      scale: 2,
    });

    // 2. Test Smooth Sidebar Collapse & Transition Measurement
    console.log('Testing Smooth Sidebar Collapse Transition...');
    const initialSidebarWidth = await evaluate(ws, `
      document.querySelector('.planner-sidebar').getBoundingClientRect().width
    `);
    console.log('Initial expanded sidebar width:', initialSidebarWidth);

    // Click toggle button
    await evaluate(ws, `
      document.querySelector('.planner-sidebar-toggle-btn').click();
    `);

    // Sample widths during transition
    const transitionSamples = [];
    const startTime = Date.now();
    while (Date.now() - startTime < 400) {
      const w = await evaluate(ws, `document.querySelector('.planner-sidebar').getBoundingClientRect().width`);
      transitionSamples.push({ elapsedMs: Date.now() - startTime, width: Math.round(w) });
      await sleep(40);
    }

    const finalCollapsedWidth = await evaluate(ws, `
      document.querySelector('.planner-sidebar').getBoundingClientRect().width
    `);
    console.log('Collapsed width samples:', transitionSamples);
    console.log('Final collapsed width:', finalCollapsedWidth);

    // Verify main content expanded
    const contentAreaWidthCollapsed = await evaluate(ws, `
      Math.round(document.querySelector('.planner-content-area').getBoundingClientRect().width)
    `);
    console.log('Main content width with collapsed sidebar:', contentAreaWidthCollapsed);

    await captureScreenshot(ws, 'overview_sidebar_collapsed.png', {
      x: 0,
      y: 0,
      width: 1440,
      height: 980,
      scale: 2,
    });

    // Toggle back to expanded
    console.log('Testing Smooth Sidebar Expand Transition...');
    await evaluate(ws, `
      document.querySelector('.planner-sidebar-toggle-btn').click();
    `);

    await sleep(350);
    const finalExpandedWidth = await evaluate(ws, `
      document.querySelector('.planner-sidebar').getBoundingClientRect().width
    `);
    console.log('Restored expanded sidebar width:', finalExpandedWidth);

    // 3. Test Tablet View (768px)
    console.log('Testing Tablet View (768px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(800);

    const tabletGrid = await evaluate(ws, `
      (() => {
        const grid = document.querySelector('.overview-bento-grid');
        const overflowing = Array.from(document.querySelectorAll('*')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.right > window.innerWidth + 1;
        }).map(el => ({
          tag: el.tagName,
          class: el.className,
          right: Math.round(el.getBoundingClientRect().right),
          width: Math.round(el.getBoundingClientRect().width),
          text: el.children.length === 0 ? el.textContent.trim().slice(0, 30) : null
        }));
        return {
          gap: window.getComputedStyle(grid).gap,
          firstCardWidth: Math.round(grid.querySelector('.overview-card-section').getBoundingClientRect().width),
          hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          overflowing: overflowing.slice(0, 5)
        };
      })()
    `);
    console.log('Tablet Grid Properties:', tabletGrid);

    await captureScreenshot(ws, 'overview_bento_tablet.png', {
      x: 0,
      y: 0,
      width: 768,
      height: 1100,
      scale: 2,
    });

    // 4. Test Mobile View (390px)
    console.log('Testing Mobile View (390px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(800);

    const mobileGrid = await evaluate(ws, `
      (() => {
        const grid = document.querySelector('.overview-bento-grid');
        return {
          gap: window.getComputedStyle(grid).gap,
          cardPadding: window.getComputedStyle(grid.querySelector('.overview-card-section')).padding,
          hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
        };
      })()
    `);
    console.log('Mobile Grid Properties:', mobileGrid);

    await captureScreenshot(ws, 'overview_bento_mobile.png', {
      x: 0,
      y: 0,
      width: 390,
      height: 1200,
      scale: 3,
    });

    console.log('All Bento Grid & Sidebar Transition tests completed successfully!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
