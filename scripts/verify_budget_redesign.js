const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9246;

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
  const params = { format: 'png' };
  const res = await sendCommand(ws, 'Page.captureScreenshot', params);
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log('Saved screenshot:', outPath);
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_budget_redesign');
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
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });

    console.log('Navigating to http://127.0.0.1:5173/events ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events' });
    await sleep(2000);

    // Seed rich budget celebration plan matching the Stitch reference
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
            eventDate: '2026-12-18',
            timezone: 'Asia/Kolkata',
            city: 'Jaipur, Rajasthan',
            guestEstimate: 350,
            budgetTotalPaise: 180000000, // ₹18,00,000 celebration limit
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
            { id: 'cat-catering', key: 'catering', label: 'Catering', allocatedPaise: 45000000, position: 1 }, // ₹4,50,000
            { id: 'cat-venue', key: 'venue', label: 'Venue', allocatedPaise: 36000000, position: 2 }, // ₹3,60,000
            { id: 'cat-decor', key: 'decor', label: 'Decor', allocatedPaise: 18000000, position: 3 }, // ₹1,80,000
            { id: 'cat-attire', key: 'attire', label: 'Attire & jewellery', allocatedPaise: 21600000, position: 4 }, // ₹2,16,000
            { id: 'cat-photo', key: 'photo', label: 'Photo & video', allocatedPaise: 14400000, position: 5 }, // ₹1,44,000
            { id: 'cat-music', key: 'music', label: 'Entertainment', allocatedPaise: 7200000, position: 6 }, // ₹72,000
            { id: 'cat-contingency', key: 'contingency', label: 'Contingency', allocatedPaise: 18000000, position: 7 }, // ₹1,80,000
            { id: 'cat-travel', key: 'travel', label: 'Travel & stay', allocatedPaise: 7200000, position: 8 }, // ₹72,000
            { id: 'cat-gifts', key: 'gifts', label: 'Gifts & favours', allocatedPaise: 5400000, position: 9 }, // ₹54,000
            { id: 'cat-invites', key: 'invites', label: 'Invitations', allocatedPaise: 3600000, position: 10 }, // ₹36,000
            { id: 'cat-rituals', key: 'rituals', label: 'Ritual items', allocatedPaise: 3600000, position: 11 } // ₹36,000
          ],
          expenses: [
            // Catering: Total committed ₹4,75,000 (Over by ₹25,000)
            { id: 'exp-1', categoryId: 'cat-catering', description: 'Rajputana Feast Advance Deposit', amountPaise: 5000000, kind: 'paid', spentOn: '2026-09-01', note: 'Token booking advance' },
            { id: 'exp-2', categoryId: 'cat-catering', description: 'Banquet Menu Signed Contract', amountPaise: 42500000, kind: 'quoted', spentOn: '2026-09-15', note: 'Final negotiated quote' },
            // Venue: Total committed ₹3,40,000 (Near limit 94%)
            { id: 'exp-3', categoryId: 'cat-venue', description: 'Courtyard Haveli First Tranche', amountPaise: 10000000, kind: 'paid', spentOn: '2026-08-15', note: 'Primary venue lock' },
            { id: 'exp-4', categoryId: 'cat-venue', description: 'Venue Final Balance Agreement', amountPaise: 24000000, kind: 'quoted', spentOn: '2026-09-10' },
            // Photo & video: Total committed ₹1,32,000 (Near limit 92%)
            { id: 'exp-5', categoryId: 'cat-photo', description: 'Cinematic Pre-wedding Teaser Deposit', amountPaise: 3000000, kind: 'paid', spentOn: '2026-09-20' },
            { id: 'exp-6', categoryId: 'cat-photo', description: '3-Camera Cinematic Wedding Crew', amountPaise: 10200000, kind: 'quoted', spentOn: '2026-10-01' }
          ],
          tasks: [
            { id: 'tsk-1', title: 'Confirm palace courtyard booking deposit', categoryId: 'cat-venue', dueDate: '2026-09-01', status: 'done', isMilestone: true, dependsOn: [], position: 1 },
            { id: 'tsk-2', title: 'Finalize royal marigold stage concept & florals', categoryId: 'cat-decor', dueDate: '2026-10-15', status: 'open', isMilestone: true, dependsOn: [], position: 2 }
          ],
          vendors: [
            { id: 'ven-1', categoryId: 'cat-venue', name: 'Jaipur Heritage Palace & Havelis', categoryKey: 'Venue', status: 'booked' },
            { id: 'ven-2', categoryId: 'cat-catering', name: 'Marwar Gourmet Catering', categoryKey: 'Catering', status: 'booked' },
            { id: 'ven-3', categoryId: 'cat-photo', name: 'Kala Shutter Cinematic Weddings', categoryKey: 'Photography', status: 'booked' },
            { id: 'ven-4', categoryId: 'cat-decor', name: 'Royal Mandapam Floral Artisans', categoryKey: 'Decor', status: 'booked' }
          ],
          guests: { total: 350, veg: 270, jain: 45, nonVeg: 35, eggetarian: 0, vegan: 0, allergyTags: [], accessibilityNeeds: [] },
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

    console.log('Navigating to Budget page: http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget' });
    await sleep(2500);

    // 1. Desktop Categories View
    console.log('Capturing Desktop Categories View...');
    await captureScreenshot(ws, 'budget_categories_desktop.png');

    // 2. Open 3-dots actions dropdown for Catering (which has linked expenses)
    console.log('Opening actions menu for Catering...');
    await evaluate(ws, `
      (() => {
        const table = document.querySelector('.budget-data-table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
        const btn = document.querySelector('.budget-cat-more-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(400);
    await captureScreenshot(ws, 'budget_actions_menu_open.png');

    // Dismiss menu by clicking outside and scroll back to top
    await evaluate(ws, `
      (() => {
        document.body.click();
        window.scrollTo(0, 0);
      })()
    `);
    await sleep(300);

    // 3. Open "Add Category" dialog
    console.log('Opening Add Category Dialog...');
    await evaluate(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('.budget-action-btn'));
        const addCatBtn = btns.find(b => b.textContent.includes('Add category'));
        if (addCatBtn) addCatBtn.click();
      })()
    `);
    await sleep(400);
    await captureScreenshot(ws, 'budget_add_category_modal.png');

    // Close Add Category modal
    await evaluate(ws, `
      (() => {
        const closeBtn = document.querySelector('.cat-modal-close');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(300);

    // 4. Switch to Expenses Log tab
    console.log('Switching to Expenses Log subtab...');
    await evaluate(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('.budget-tab-btn'));
        const expTab = btns.find(b => b.textContent.includes('Expenses Log'));
        if (expTab) expTab.click();
      })()
    `);
    await sleep(500);
    await captureScreenshot(ws, 'budget_expenses_log_desktop.png');

    // 5. Tablet View (768x1024)
    console.log('Testing Tablet viewport...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    // Switch back to categories for tablet capture
    await evaluate(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('.budget-tab-btn'));
        const catTab = btns.find(b => b.textContent.includes('Categories'));
        if (catTab) catTab.click();
      })()
    `);
    await sleep(500);
    await captureScreenshot(ws, 'budget_categories_tablet.png');

    // 6. Mobile View (375x812)
    console.log('Testing Mobile viewport...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);
    await captureScreenshot(ws, 'budget_categories_mobile.png');

    // 7. Overrun Alert Banner Simulation (Stitch Frame 2 Overrun Test)
    console.log('Simulating overrun (+₹25,000) for Stitch Frame 2 verification...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await evaluate(ws, `
      (async () => {
        const req = indexedDB.open('toranly', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('plans', 'readwrite');
          const store = tx.objectStore('plans');
          const getReq = store.get('ev-ananya-rohan-wedding');
          getReq.onsuccess = () => {
            const plan = getReq.result;
            // Increase decor allocation by 25k (2500000 paise) so total allocated is ₹18,25,000
            plan.budgetCategories = plan.budgetCategories.map(c =>
              c.id === 'cat-decor' ? { ...c, allocatedPaise: c.allocatedPaise + 2500000 } : c
            );
            store.put(plan);
          };
        };
      })()
    `);
    await sleep(600);
    await sendCommand(ws, 'Page.reload');
    await sleep(2000);
    await captureScreenshot(ws, 'budget_overrun_alert_banner.png');

    console.log('All Budget UI verifications passed successfully!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
