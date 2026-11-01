const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9249;

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
  console.log('Saved screenshot:', filename);
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_sidebar_refinement');
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

    // Reset collapsed state in localStorage so we test expanded first
    await evaluate(ws, `localStorage.setItem('toranly_planner_sidebar_collapsed', 'false');`);

    console.log('Navigating to workspace...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2500);

    // --- TEST 1: Expanded Desktop Sidebar ---
    console.log('=== TEST 1: Expanded Desktop Sidebar ===');
    const expandedMetrics = await evaluate(ws, `
      (() => {
        const toggleBtn = document.querySelector('.planner-sidebar-toggle-btn');
        const sidebar = document.querySelector('.planner-sidebar');
        const firstIcon = document.querySelector('.planner-nav-item .planner-nav-icon-box');
        const activeItem = document.querySelector('.planner-nav-item.active');
        const activeIndicator = document.querySelector('.planner-active-indicator');
        const footer = document.querySelector('.planner-sidebar-footer');
        const accountItem = document.querySelector('.planner-account-item');
        const myPlansLink = document.querySelector('.planner-sidebar-footer .planner-footer-link');
        const oldStatus = document.querySelector('.planner-sidebar-status');
        const headerSaveStatus = document.querySelector('.planner-header-save-status');

        const toggleRect = toggleBtn ? toggleBtn.getBoundingClientRect() : null;
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const firstIconRect = firstIcon ? firstIcon.getBoundingClientRect() : null;
        const activeComputed = activeItem ? window.getComputedStyle(activeItem) : null;

        return {
          sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
          toggleX: toggleRect ? Math.round(toggleRect.left) : null,
          toggleWidth: toggleRect ? Math.round(toggleRect.width) : null,
          toggleCenterX: toggleRect ? Math.round(toggleRect.left + toggleRect.width / 2) : null,
          firstIconX: firstIconRect ? Math.round(firstIconRect.left) : null,
          firstIconWidth: firstIconRect ? Math.round(firstIconRect.width) : null,
          firstIconCenterX: firstIconRect ? Math.round(firstIconRect.left + firstIconRect.width / 2) : null,
          hasActiveIndicator: !!activeIndicator,
          activeBg: activeComputed ? activeComputed.backgroundColor : null,
          activeColor: activeComputed ? activeComputed.color : null,
          hasAccountItem: !!accountItem,
          accountItemText: accountItem ? accountItem.textContent.trim() : null,
          hasMyPlansInFooter: !!myPlansLink,
          hasOldStatusInFooter: !!oldStatus,
          hasHeaderSaveStatus: !!headerSaveStatus,
          headerSaveStatusText: headerSaveStatus ? headerSaveStatus.textContent.trim() : null
        };
      })()
    `);
    console.log('Expanded Metrics:', expandedMetrics);
    await captureScreenshot(ws, 'sidebar_expanded_desktop.png');

    // --- TEST 2: Collapsing Animation & Collapsed Alignment ---
    console.log('=== TEST 2: Collapsing Sidebar ===');
    await evaluate(ws, `
      document.querySelector('.planner-sidebar-toggle-btn').click();
    `);
    // Wait for the 250ms transition to finish completely
    await sleep(400);

    const collapsedMetrics = await evaluate(ws, `
      (() => {
        const toggleBtn = document.querySelector('.planner-sidebar-toggle-btn');
        const sidebar = document.querySelector('.planner-sidebar');
        const firstIcon = document.querySelector('.planner-nav-item .planner-nav-icon-box');
        const activeItem = document.querySelector('.planner-nav-item.active');
        const activeIndicator = document.querySelector('.planner-active-indicator');
        const accountItem = document.querySelector('.planner-account-item');
        const navLabel = document.querySelector('.planner-nav-label');
        const labelStyle = navLabel ? window.getComputedStyle(navLabel) : null;

        const toggleRect = toggleBtn ? toggleBtn.getBoundingClientRect() : null;
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const firstIconRect = firstIcon ? firstIcon.getBoundingClientRect() : null;
        const activeRect = activeItem ? activeItem.getBoundingClientRect() : null;
        const activeComputed = activeItem ? window.getComputedStyle(activeItem) : null;

        return {
          isCollapsedClass: sidebar ? sidebar.classList.contains('collapsed') : false,
          sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
          toggleCenterX: toggleRect ? Math.round(toggleRect.left + toggleRect.width / 2) : null,
          firstIconCenterX: firstIconRect ? Math.round(firstIconRect.left + firstIconRect.width / 2) : null,
          activeItemWidth: activeRect ? Math.round(activeRect.width) : null,
          activeItemHeight: activeRect ? Math.round(activeRect.height) : null,
          activeItemBorderRadius: activeComputed ? activeComputed.borderRadius : null,
          hasActiveIndicator: !!activeIndicator,
          labelOpacity: labelStyle ? labelStyle.opacity : null,
          hasAccountItem: !!accountItem
        };
      })()
    `);
    console.log('Collapsed Metrics:', collapsedMetrics);
    await captureScreenshot(ws, 'sidebar_collapsed_desktop.png');

    // --- TEST 3: Tablet Viewport (834px) ---
    console.log('=== TEST 3: Tablet Viewport (834px) ===');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 834,
      height: 1112,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(500);

    const tabletMetrics = await evaluate(ws, `
      (() => {
        const toggleBtn = document.querySelector('.planner-sidebar-toggle-btn');
        const sidebar = document.querySelector('.planner-sidebar');
        const firstIcon = document.querySelector('.planner-nav-item .planner-nav-icon-box');
        const headerSaveStatus = document.querySelector('.planner-header-save-status');

        const toggleRect = toggleBtn ? toggleBtn.getBoundingClientRect() : null;
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const firstIconRect = firstIcon ? firstIcon.getBoundingClientRect() : null;

        return {
          sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
          toggleCenterX: toggleRect ? Math.round(toggleRect.left + toggleRect.width / 2) : null,
          firstIconCenterX: firstIconRect ? Math.round(firstIconRect.left + firstIconRect.width / 2) : null,
          hasHeaderSaveStatus: !!headerSaveStatus,
          saveStatusText: headerSaveStatus ? headerSaveStatus.textContent.trim() : null
        };
      })()
    `);
    console.log('Tablet Metrics:', tabletMetrics);
    await captureScreenshot(ws, 'sidebar_tablet_view.png');

    console.log('--- ALL SIDEBAR VERIFICATION CHECKS COMPLETE ---');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
