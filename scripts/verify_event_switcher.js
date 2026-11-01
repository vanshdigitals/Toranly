const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9230;

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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_profile_switcher');
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

    // Seed two distinct sample plans: Wedding and Birthday
    console.log('Seeding two distinct celebrations in IndexedDB...');
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
            { id: 'fn-2', name: 'Sangeet Night', date: '2026-12-17', startTime: '19:30', endTime: '23:30', position: 2 },
            { id: 'fn-3', name: 'Haldi Ceremony', date: '2026-12-18', startTime: '10:00', endTime: '12:30', position: 3 },
            { id: 'fn-4', name: 'Varmala & Pheras', date: '2026-12-18', startTime: '17:00', endTime: '21:00', position: 4 }
          ],
          budgetCategories: [
            { id: 'cat-venue', key: 'venue', label: 'Venue & Stays', allocatedPaise: 100000000, position: 1 },
            { id: 'cat-catering', key: 'catering', label: 'Catering & Dining', allocatedPaise: 75000000, position: 2 },
            { id: 'cat-decor', key: 'decor', label: 'Decor & Florals', allocatedPaise: 35000000, position: 3 },
            { id: 'cat-photo', key: 'photo', label: 'Photography & Film', allocatedPaise: 25000000, position: 4 },
            { id: 'cat-music', key: 'music', label: 'Entertainment & DJ', allocatedPaise: 15000000, position: 5 }
          ],
          expenses: [
            { id: 'exp-1', categoryId: 'cat-venue', description: 'Palace Courtyard Advance', amountPaise: 40000000, paidPaise: 40000000, position: 1 }
          ],
          tasks: [
            { id: 'tsk-1', title: 'Confirm palace courtyard booking', categoryId: 'cat-venue', dueDate: '2026-09-01', status: 'done', priority: 'high', dependsOn: [], position: 1 },
            { id: 'tsk-2', title: 'Finalize royal marigold stage concept', categoryId: 'cat-decor', dueDate: '2026-10-15', status: 'open', priority: 'high', dependsOn: [], position: 2 }
          ],
          vendors: [
            { id: 'ven-1', categoryId: 'cat-venue', companyName: 'Jaipur Heritage Palace', contactName: 'Digvijay Singh', phone: '+91 98290 12345', email: 'events@palace.in', status: 'booked', position: 1 }
          ],
          guests: { veg: 280, jain: 40, nonVeg: 30, eggetarian: 0, vegan: 0 },
          ideas: [],
          quotes: [],
          scheduleItems: [],
          notes: []
        };

        const birthdayPlan = {
          id: 'ev-kabir-30th-birthday',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          event: {
            type: 'birthday',
            title: "Kabir's 30th Milestone Birthday",
            eventDate: '2026-11-12',
            timezone: 'Asia/Kolkata',
            city: 'Bengaluru, Karnataka',
            guestEstimate: 80,
            budgetTotalPaise: 45000000,
            currency: 'INR',
            preferences: {
              themeWords: ['Midnight Rooftop', 'Electronic Lounge'],
              dietFocus: ['Gourmet Finger Food', 'Cocktail Bar'],
              customs: ['Cake Cutting', 'Toast & Speeches'],
              avoidColours: ['Beige'],
              notes: 'Rooftop cocktail celebration with live acoustic & DJ'
            }
          },
          functions: [
            { id: 'fn-b1', name: 'Sundowner & Cocktails', date: '2026-11-12', startTime: '18:00', endTime: '20:30', position: 1 },
            { id: 'fn-b2', name: 'Cake Cutting & DJ Set', date: '2026-11-12', startTime: '20:30', endTime: '00:30', position: 2 }
          ],
          budgetCategories: [
            { id: 'cat-b-venue', key: 'venue', label: 'Rooftop Lounge Rental', allocatedPaise: 20000000, position: 1 },
            { id: 'cat-b-food', key: 'catering', label: 'Food & Mixology', allocatedPaise: 15000000, position: 2 },
            { id: 'cat-b-dj', key: 'music', label: 'DJ & Sound System', allocatedPaise: 10000000, position: 3 }
          ],
          expenses: [
            { id: 'exp-b1', categoryId: 'cat-b-venue', description: 'Rooftop Deck Deposit', amountPaise: 10000000, paidPaise: 10000000, position: 1 }
          ],
          tasks: [
            { id: 'tsk-b1', title: 'Book rooftop lounge terrace', categoryId: 'cat-b-venue', dueDate: '2026-10-01', status: 'done', priority: 'high', dependsOn: [], position: 1 },
            { id: 'tsk-b2', title: 'Curate 30-track celebration playlist', categoryId: 'cat-b-dj', dueDate: '2026-10-30', status: 'open', priority: 'medium', dependsOn: [], position: 2 }
          ],
          vendors: [
            { id: 'ven-b1', categoryId: 'cat-b-venue', companyName: 'Skyline Terrace Lounge', contactName: 'Rahul Mehta', phone: '+91 99800 54321', email: 'terrace@skyline.in', status: 'booked', position: 1 }
          ],
          guests: { veg: 45, jain: 5, nonVeg: 30, eggetarian: 0, vegan: 0 },
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
            store.put(birthdayPlan);
            tx.oncomplete = () => resolve(['ev-ananya-rohan-wedding', 'ev-kabir-30th-birthday']);
          };
          req.onerror = reject;
        });
      })()
    `);
    console.log('Both plans saved successfully!');

    // Navigate to Event 1
    console.log('Navigating to Wedding plan (/events/ev-ananya-rohan-wedding)...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2000);

    // 1. Verify Header Switcher and clean sidebar
    const headerSwitcherInfo = await evaluate(ws, `
      (() => {
        const switcherBtn = document.querySelector('.planner-header-switcher-btn');
        const switcherTitle = document.querySelector('.planner-switcher-title');
        const sidebarHeader = document.querySelector('.planner-sidebar-header');
        const sidebarPlanSelector = document.querySelector('.planner-plan-selector-btn');
        const sidebarNav = document.querySelector('.planner-sidebar-nav');
        const navFirstItem = sidebarNav ? sidebarNav.firstElementChild?.textContent : null;

        return {
          hasHeaderSwitcher: !!switcherBtn,
          currentTitleInSwitcher: switcherTitle ? switcherTitle.textContent : null,
          hasSidebarHeader: !!sidebarHeader,
          hasSidebarPlanSelector: !!sidebarPlanSelector,
          sidebarStartsDirectlyWithNav: !sidebarHeader && !!sidebarNav,
          navFirstItemText: navFirstItem
        };
      })()
    `);

    console.log('Header Switcher Inspection:', JSON.stringify(headerSwitcherInfo, null, 2));

    // Capture Desktop View with Event 1 loaded
    await captureScreenshot(ws, 'header_switcher_desktop_event1.png');

    // 2. Open Event Switcher Dropdown
    console.log('Opening Event Switcher dropdown in header...');
    await evaluate(ws, `document.querySelector('.planner-header-switcher-btn').click()`);
    await sleep(400);

    const dropdownInspection = await evaluate(ws, `
      (() => {
        const popover = document.querySelector('.planner-header-switcher-popover');
        const items = Array.from(document.querySelectorAll('.planner-switcher-popover-item')).map(item => ({
          title: item.querySelector('.planner-switcher-item-title')?.textContent,
          meta: item.querySelector('.planner-switcher-item-meta')?.textContent,
          isActive: item.classList.contains('active')
        }));
        const actions = Array.from(document.querySelectorAll('.planner-switcher-popover-action')).map(a => a.textContent?.trim());

        return {
          hasPopover: !!popover,
          itemCount: items.length,
          items,
          actions
        };
      })()
    `);

    console.log('Dropdown Inspection:', JSON.stringify(dropdownInspection, null, 2));

    // Capture Screenshot of Open Dropdown
    await captureScreenshot(ws, 'header_switcher_dropdown_open.png');

    // 3. Switch to Event 2 ("Kabir's 30th Milestone Birthday")
    console.log('Clicking on Event 2 to switch celebrations...');
    await evaluate(ws, `
      (() => {
        const items = Array.from(document.querySelectorAll('.planner-switcher-popover-item'));
        const kabirItem = items.find(el => el.textContent.includes('Kabir'));
        if (kabirItem) kabirItem.click();
      })()
    `);
    await sleep(2000);

    const afterSwitchInfo = await evaluate(ws, `
      (() => {
        const currentUrl = location.href;
        const switcherTitle = document.querySelector('.planner-switcher-title')?.textContent;
        const heading = document.querySelector('.overview-title')?.textContent;

        return {
          currentUrl,
          switcherTitle,
          heading
        };
      })()
    `);

    console.log('After Switch State:', JSON.stringify(afterSwitchInfo, null, 2));
    await captureScreenshot(ws, 'header_switcher_switched_to_event2.png');

    // 4. Tablet Viewport Test (768x1024)
    console.log('Testing Tablet Viewport (768x1024)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(500);
    await captureScreenshot(ws, 'header_switcher_tablet_view.png');

    // 5. Mobile Viewport Test (390x844)
    console.log('Testing Mobile Viewport (390x844)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(500);
    await captureScreenshot(ws, 'header_switcher_mobile_view.png');

    // Open dropdown on mobile
    console.log('Opening header switcher dropdown on mobile...');
    await evaluate(ws, `document.querySelector('.planner-header-switcher-btn').click()`);
    await sleep(400);
    await captureScreenshot(ws, 'header_switcher_mobile_dropdown_open.png');

    console.log('All event switcher verification tasks completed successfully!');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Error during switcher verification:', err);
  process.exit(1);
});

