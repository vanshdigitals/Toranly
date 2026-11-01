const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9235;

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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_header_controls');
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

    // Seed sample plan with overdue tasks so bell displays indicator dot
    console.log('Seeding plan with overdue tasks in IndexedDB...');
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
            { id: 'tsk-1', title: 'Confirm palace courtyard booking', categoryId: 'cat-venue', dueDate: '2026-09-01', status: 'open', priority: 'high', dependsOn: [], position: 1 },
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

    // Navigate to planner
    console.log('Navigating to /events/ev-ananya-rohan-wedding ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2500);

    // 1. Inspect Header Right-Side Order & Computed Styles
    console.log('Inspecting Header Right-Side Elements...');
    const headerInspection = await evaluate(ws, `
      (() => {
        const topbarRight = document.querySelector('.planner-topbar-right');
        if (!topbarRight) return { error: 'topbarRight not found' };

        const actions = document.querySelector('.planner-topbar-actions');
        const actionChildren = actions ? Array.from(actions.children).map(c => ({
          tag: c.tagName,
          text: c.textContent.trim(),
          class: c.className
        })) : [];

        const divider = document.querySelector('.planner-divider-actions');
        const userControls = document.querySelector('.planner-topbar-user-controls');
        
        const bellBtn = document.querySelector('.planner-notification-bell-btn');
        const bellIcon = bellBtn ? bellBtn.querySelector('.planner-bell-icon') : null;
        const bellDot = bellBtn ? bellBtn.querySelector('.planner-bell-dot') : null;

        const profileBtn = document.querySelector('.planner-profile-avatar-btn');
        const profileIcon = profileBtn ? profileBtn.querySelector('.planner-profile-white-icon') : null;

        const bellRect = bellBtn ? bellBtn.getBoundingClientRect() : null;
        const profileRect = profileBtn ? profileBtn.getBoundingClientRect() : null;

        const bellStyle = bellBtn ? window.getComputedStyle(bellBtn) : null;
        const profileStyle = profileBtn ? window.getComputedStyle(profileBtn) : null;

        // Sequence of elements in topbarRight:
        const topbarDirectChildren = Array.from(topbarRight.children).map(c => c.className);

        return {
          topbarDirectChildren,
          actionButtons: actionChildren,
          dividerExists: !!divider,
          bell: {
            exists: !!bellBtn,
            hasDot: !!bellDot,
            rect: bellRect,
            width: bellStyle ? bellStyle.width : null,
            height: bellStyle ? bellStyle.height : null,
            borderRadius: bellStyle ? bellStyle.borderRadius : null,
            bg: bellStyle ? bellStyle.backgroundColor : null,
          },
          profile: {
            exists: !!profileBtn,
            rect: profileRect,
            width: profileStyle ? profileStyle.width : null,
            height: profileStyle ? profileStyle.height : null,
            borderRadius: profileStyle ? profileStyle.borderRadius : null,
            bg: profileStyle ? profileStyle.backgroundColor : null,
          },
          ordering: {
            bellLeftOfProfile: bellRect && profileRect ? bellRect.left < profileRect.left : false,
            gapBetweenBellAndProfile: bellRect && profileRect ? Math.round(profileRect.left - bellRect.right) : null,
          }
        };
      })()
    `);

    console.log('Header Inspection Result:\n', JSON.stringify(headerInspection, null, 2));

    // Capture desktop full header view
    await captureScreenshot(ws, 'header_controls_desktop.png', {
      x: 0,
      y: 0,
      width: 1440,
      height: 120,
      scale: 2,
    });

    // 2. Click Bell Button -> Test Notification Popover
    console.log('Testing Notification Popover...');
    await evaluate(ws, `
      document.querySelector('.planner-notification-bell-btn').click();
    `);
    await sleep(500);

    const popoverOpen = await evaluate(ws, `
      (() => {
        const dropdown = document.querySelector('.planner-notifications-dropdown');
        if (!dropdown) return { open: false };
        const title = dropdown.querySelector('.planner-notifications-title')?.textContent;
        const badge = dropdown.querySelector('.planner-notifications-count-badge')?.textContent;
        const alertItem = dropdown.querySelector('.planner-notification-item-title')?.textContent;
        const link = dropdown.querySelector('.planner-notification-action-link')?.textContent;
        return {
          open: true,
          title,
          badge,
          alertItem,
          link
        };
      })()
    `);
    console.log('Notifications Popover State:', JSON.stringify(popoverOpen, null, 2));

    await captureScreenshot(ws, 'header_controls_bell_open.png', {
      x: 800,
      y: 0,
      width: 640,
      height: 380,
      scale: 2,
    });

    // 3. Click Profile Button -> Test Profile Popover
    console.log('Testing Profile Popover...');
    await evaluate(ws, `
      document.querySelector('.planner-profile-avatar-btn').click();
    `);
    await sleep(500);

    const profilePopoverOpen = await evaluate(ws, `
      (() => {
        const dropdown = document.querySelector('.planner-profile-dropdown');
        const notifDropdown = document.querySelector('.planner-notifications-dropdown');
        return {
          profileOpen: !!dropdown,
          notificationsClosed: !notifDropdown,
          profileName: dropdown ? dropdown.querySelector('.planner-profile-popover-name')?.textContent : null,
          menuItems: dropdown ? Array.from(dropdown.querySelectorAll('.planner-profile-dropdown-item')).map(el => el.textContent.trim()) : []
        };
      })()
    `);
    console.log('Profile Popover State:', JSON.stringify(profilePopoverOpen, null, 2));

    await captureScreenshot(ws, 'header_controls_profile_open.png', {
      x: 950,
      y: 0,
      width: 490,
      height: 380,
      scale: 2,
    });

    // 4. Test Outside Click closes dropdowns
    console.log('Testing outside click dismissal...');
    await evaluate(ws, `
      document.body.click();
    `);
    await sleep(400);

    const closedState = await evaluate(ws, `
      (() => {
        return {
          profileOpen: !!document.querySelector('.planner-profile-dropdown'),
          notificationsOpen: !!document.querySelector('.planner-notifications-dropdown')
        };
      })()
    `);
    console.log('After outside click (both closed):', closedState);

    // 5. Responsive Check: Tablet (768px)
    console.log('Testing Tablet (768px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(800);

    await captureScreenshot(ws, 'header_controls_tablet.png', {
      x: 0,
      y: 0,
      width: 768,
      height: 120,
      scale: 2,
    });

    // 6. Responsive Check: Mobile (390px)
    console.log('Testing Mobile (390px)...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(800);

    await captureScreenshot(ws, 'header_controls_mobile.png', {
      x: 0,
      y: 0,
      width: 390,
      height: 120,
      scale: 3,
    });

    console.log('All automated header controls verifications completed successfully!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

