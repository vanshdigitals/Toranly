const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9251;

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
  const params = { format: 'png', captureBeyondViewport: true };
  if (clip) params.clip = clip;
  const res = await sendCommand(ws, 'Page.captureScreenshot', params);
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log('Saved screenshot:', filename, '(' + buf.length + ' bytes)');
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_settings_stitch');
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
      height: 1200,
      deviceScaleFactor: 2,
      mobile: false,
    });

    console.log('Navigating to http://127.0.0.1:5173/events ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events' });
    await sleep(2000);

    // Seed sample plan matching the Stitch reference
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
            budgetTotalPaise: 180000000, // ₹18,00,000 (18 lakh)
            currency: 'INR',
            preferences: {
              themeWords: ['marigold', 'courtyard', 'warm lights'],
              avoidColours: ['black'],
              customs: ['haldi', 'pheras'],
              dietFocus: ['Pure Veg', 'Jain Options'],
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
          expenses: [],
          tasks: [
            { id: 'tsk-1', title: 'Book palace venue courtyard', categoryKey: 'venue', dueDate: '2026-11-01', status: 'done', isMilestone: true, dependsOn: [], position: 1 },
            { id: 'tsk-2', title: 'Confirm royal marigold stage concept', categoryKey: 'decor', dueDate: '2026-12-15', status: 'open', isMilestone: true, dependsOn: [], position: 2 }
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

    // Ensure expanded sidebar state for standard desktop test
    await evaluate(ws, `localStorage.setItem('toranly_planner_sidebar_collapsed', 'false');`);

    console.log('Navigating to Settings tab...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/settings' });
    await sleep(2500);

    // --- 1. INSPECT DESKTOP SETTINGS VIEW ---
    console.log('=== TEST 1: Inspect Desktop Settings Layout ===');
    const settingsAudit = await evaluate(ws, `
      (() => {
        const breadcrumb = document.querySelector('.settings-breadcrumb');
        const pageTitle = document.querySelector('.settings-page-title');
        const cards = document.querySelectorAll('.settings-card');
        
        // Card 1: Event details
        const activeBadge = document.querySelector('.settings-active-plan-badge');
        const nameInput = document.querySelector('#settings-name-input');
        const cityInput = document.querySelector('#settings-city-input');
        const guestsInput = document.querySelector('#settings-guests-input');
        const budgetInput = document.querySelector('#settings-budget-input');
        const budgetPill = document.querySelector('.settings-budget-preview-pill');
        const themeChips = document.querySelectorAll('.settings-chip.theme-chip');
        const avoidChips = document.querySelectorAll('.settings-chip.avoid-chip');
        const customChips = document.querySelectorAll('.settings-chip.custom-chip');
        const notesCounter = document.querySelector('.settings-char-counter');
        const saveBtn = document.querySelector('.settings-primary-btn');

        // Card 2: Date & Timing
        const dateMain = document.querySelector('.settings-date-main');
        const countdownPill = document.querySelector('.settings-countdown-pill');
        const changeDateBtn = document.querySelector('.settings-date-row .settings-secondary-btn');

        // Card 3: Functions Table
        const fnTable = document.querySelector('.settings-functions-table');
        const fnRows = document.querySelectorAll('.settings-functions-table tbody tr');
        const mainBadge = document.querySelector('.settings-main-badge');
        const addFnBtn = document.querySelector('.settings-card-header .settings-secondary-btn');

        // Card 4: Export CSVs
        const exportActions = document.querySelector('.settings-export-actions');
        const exportBtns = exportActions ? exportActions.querySelectorAll('.settings-secondary-btn') : [];

        // Card 5: Danger Zone
        const dangerCard = document.querySelector('.settings-danger-card');
        const dangerTitle = document.querySelector('.settings-danger-title');
        const deleteBtn = document.querySelector('.settings-danger-btn');

        // Shell check
        const shellHeader = document.querySelector('.planner-topbar');
        const shellSidebar = document.querySelector('.planner-sidebar');

        return {
          breadcrumbText: breadcrumb ? breadcrumb.textContent.trim().replace(/\\s+/g, ' ') : null,
          pageTitle: pageTitle ? pageTitle.textContent.trim() : null,
          cardCount: cards.length,
          hasActiveBadge: !!activeBadge,
          activeBadgeText: activeBadge ? activeBadge.textContent.trim() : null,
          nameValue: nameInput ? nameInput.value : null,
          cityValue: cityInput ? cityInput.value : null,
          guestsValue: guestsInput ? guestsInput.value : null,
          budgetValue: budgetInput ? budgetInput.value : null,
          budgetPillText: budgetPill ? budgetPill.textContent.trim() : null,
          themeChipsCount: themeChips.length,
          avoidChipsCount: avoidChips.length,
          customChipsCount: customChips.length,
          notesCounterText: notesCounter ? notesCounter.textContent.trim() : null,
          hasSaveBtn: !!saveBtn,
          dateMainText: dateMain ? dateMain.textContent.trim() : null,
          countdownText: countdownPill ? countdownPill.textContent.trim() : null,
          hasChangeDateBtn: !!changeDateBtn,
          hasFnTable: !!fnTable,
          fnRowCount: fnRows.length,
          hasMainBadge: !!mainBadge,
          hasAddFnBtn: !!addFnBtn,
          exportBtnCount: exportBtns.length,
          hasDangerCard: !!dangerCard,
          dangerTitleText: dangerTitle ? dangerTitle.textContent.trim() : null,
          hasDeleteBtn: !!deleteBtn,
          shellHeaderIntact: !!shellHeader,
          shellSidebarIntact: !!shellSidebar
        };
      })()
    `);
    console.log('Settings Audit:', settingsAudit);
    await captureScreenshot(ws, 'settings_stitch_redesign_desktop.png');

    // --- 2. TEST DATE CHANGE MODAL ---
    console.log('=== TEST 2: Open Date Change Modal ===');
    await evaluate(ws, `
      document.querySelector('.settings-date-row .settings-secondary-btn').click();
    `);
    await sleep(400);
    const dateModalOpen = await evaluate(ws, `!!document.querySelector('.date-change-dialog')`);
    console.log('Date Change Dialog Open:', dateModalOpen);
    await captureScreenshot(ws, 'settings_stitch_date_modal.png');

    // Close date modal
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.date-change-close') || document.querySelector('.date-change-actions button');
        if (btn) btn.click();
      })()
    `);
    await sleep(400);

    // --- 3. TEST DELETE CONFIRMATION MODAL ---
    console.log('=== TEST 3: Open Delete Confirmation Modal ===');
    await evaluate(ws, `
      document.querySelector('.settings-danger-btn').click();
    `);
    await sleep(400);
    const deleteModalOpen = await evaluate(ws, `!!document.querySelector('.delete-dialog')`);
    console.log('Delete Dialog Open:', deleteModalOpen);
    await captureScreenshot(ws, 'settings_stitch_delete_modal.png');

    // Close delete modal
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.delete-close-btn') || document.querySelector('.delete-actions button');
        if (btn) btn.click();
      })()
    `);
    await sleep(400);

    // --- 4. TABLET VIEWPORT (834px) ---
    console.log('=== TEST 4: Tablet Viewport (834px) ===');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 834,
      height: 1112,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(500);
    await captureScreenshot(ws, 'settings_stitch_redesign_tablet.png');

    // --- 5. MOBILE VIEWPORT (390px) ---
    console.log('=== TEST 5: Mobile Viewport (390px) ===');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(500);

    const mobileAudit = await evaluate(ws, `
      (() => {
        const bodyWidth = document.body.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const cards = document.querySelectorAll('.settings-card');
        return {
          bodyWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > bodyWidth + 2,
          cardsCount: cards.length
        };
      })()
    `);
    console.log('Mobile Audit:', mobileAudit);
    await captureScreenshot(ws, 'settings_stitch_redesign_mobile.png');

    console.log('--- ALL EVENT SETTINGS VERIFICATION CHECKS COMPLETE ---');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
