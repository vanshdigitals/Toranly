const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9228;

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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_profile_dash');
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

    // Set desktop viewport 1440x900
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    console.log('Navigating to http://127.0.0.1:5173/events ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events' });
    await sleep(2500);

    // Always ensure the sample plan is saved with full valid fields in IndexedDB
    console.log('Ensuring sample plan in database...');
    const targetEventId = await evaluate(ws, `
      (async () => {
        const samplePlan = {
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
            { id: 'tsk-2', title: 'Finalize royal marigold stage concept', categoryId: 'cat-decor', dueDate: '2026-10-15', status: 'open', priority: 'high', dependsOn: [], position: 2 },
            { id: 'tsk-3', title: 'Taste Rajasthani thali menu', categoryId: 'cat-catering', dueDate: '2026-10-25', status: 'open', priority: 'medium', dependsOn: [], position: 3 }
          ],
          vendors: [
            { id: 'ven-1', categoryId: 'cat-venue', companyName: 'Jaipur Heritage Palace', contactName: 'Digvijay Singh', phone: '+91 98290 12345', email: 'events@palace.in', status: 'booked', position: 1 }
          ],
          guests: {
            veg: 280,
            jain: 40,
            nonVeg: 30,
            eggetarian: 0,
            vegan: 0
          },
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
            tx.objectStore('plans').put(samplePlan);
            tx.oncomplete = () => resolve(samplePlan.id);
          };
          req.onerror = reject;
        });
      })()
    `);
    console.log('Sample plan ensured with ID:', targetEventId);

    // Navigate to the planner workspace
    console.log(`Navigating to http://127.0.0.1:5173/events/${targetEventId} ...`);
    await sendCommand(ws, 'Page.navigate', { url: `http://127.0.0.1:5173/events/${targetEventId}` });
    await sleep(2000);

    // 1. Verify Header & Sidebar separation and properties
    const shellVerification = await evaluate(ws, `
      (() => {
        const topbar = document.querySelector('.planner-topbar');
        const sidebar = document.querySelector('.planner-sidebar');
        const logo = document.querySelector('.planner-header-logo-img');
        const toggleBtn = document.querySelector('.planner-sidebar-toggle-btn');
        const profileBtn = document.querySelector('.planner-profile-btn');
        const heading = document.querySelector('.overview-title');
        const oldBrandLink = document.querySelector('.planner-brand-link');

        const topbarStyle = topbar ? window.getComputedStyle(topbar) : null;
        const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
        const headingStyle = heading ? window.getComputedStyle(heading) : null;

        return {
          hasTopbar: !!topbar,
          topbarPosition: topbarStyle ? topbarStyle.position : null,
          topbarHeight: topbar ? topbar.offsetHeight : 0,
          topbarBorderBottom: topbarStyle ? topbarStyle.borderBottom : null,

          hasSidebar: !!sidebar,
          sidebarPosition: sidebarStyle ? sidebarStyle.position : null,
          sidebarWidth: sidebar ? sidebar.offsetWidth : 0,
          sidebarBorderRight: sidebarStyle ? sidebarStyle.borderRight : null,

          hasLogo: !!logo,
          logoSrc: logo ? logo.getAttribute('src') : null,
          logoWidth: logo ? logo.offsetWidth : 0,
          logoHeight: logo ? logo.offsetHeight : 0,

          hasToggleBtn: !!toggleBtn,
          toggleAriaLabel: toggleBtn ? toggleBtn.getAttribute('aria-label') : null,

          hasProfileBtn: !!profileBtn,
          hasOldBrandLinkInSidebar: !!oldBrandLink,

          hasHeading: !!heading,
          headingText: heading ? heading.textContent : null,
          headingOutlineStyle: headingStyle ? headingStyle.outlineStyle : null,
          headingOutlineWidth: headingStyle ? headingStyle.outlineWidth : null,
          headingOutlineColor: headingStyle ? headingStyle.outlineColor : null,
          headingTabIndex: heading ? heading.getAttribute('tabindex') : null,
        };
      })()
    `);

    console.log('Shell Verification Details:', JSON.stringify(shellVerification, null, 2));

    // Capture Desktop Expanded View
    await captureScreenshot(ws, 'dashboard_desktop_expanded.png');

    // 2. Test Sidebar Toggle: Collapse to Rail (72px)
    console.log('Clicking sidebar toggle to collapse...');
    await evaluate(ws, `document.querySelector('.planner-sidebar-toggle-btn').click()`);
    await sleep(400);

    const collapsedDetails = await evaluate(ws, `
      (() => {
        const sidebar = document.querySelector('.planner-sidebar');
        return {
          isCollapsed: sidebar.classList.contains('collapsed'),
          width: sidebar.offsetWidth
        };
      })()
    `);
    console.log('Collapsed state:', collapsedDetails);
    await captureScreenshot(ws, 'dashboard_desktop_collapsed_rail.png');

    // Toggle Back to Expanded
    console.log('Clicking sidebar toggle to expand back...');
    await evaluate(ws, `document.querySelector('.planner-sidebar-toggle-btn').click()`);
    await sleep(400);

    // 3. Test Profile Menu
    console.log('Clicking profile button...');
    await evaluate(ws, `document.querySelector('.planner-profile-btn').click()`);
    await sleep(300);

    const profileMenuDetails = await evaluate(ws, `
      (() => {
        const dropdown = document.querySelector('.planner-profile-dropdown');
        const name = dropdown ? dropdown.querySelector('.planner-profile-popover-name').textContent : null;
        return {
          hasDropdown: !!dropdown,
          name
        };
      })()
    `);
    console.log('Profile dropdown details:', profileMenuDetails);
    await captureScreenshot(ws, 'dashboard_profile_dropdown.png');

    // Close profile dropdown
    await evaluate(ws, `document.querySelector('.planner-profile-btn').click()`);
    await sleep(200);

    // 4. Capture Heading Macro (inspect outline absence)
    const headingRect = await evaluate(ws, `
      (() => {
        const h = document.querySelector('.overview-title');
        if (!h) return null;
        const r = h.getBoundingClientRect();
        return { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 20), width: r.width + 40, height: r.height + 40 };
      })()
    `);
    if (headingRect) {
      await captureScreenshot(ws, 'dashboard_heading_no_outline.png', {
        x: headingRect.x,
        y: headingRect.y,
        width: headingRect.width,
        height: headingRect.height,
        scale: 2,
      });
    }

    // 5. Tablet Viewport (768x1024)
    console.log('Testing tablet viewport 768x1024...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(500);
    await captureScreenshot(ws, 'dashboard_tablet_view.png');

    // 6. Mobile Viewport (390x844)
    console.log('Testing mobile viewport 390x844...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(500);
    await captureScreenshot(ws, 'dashboard_mobile_view.png');

    // Click mobile toggle to open slide-in drawer
    console.log('Opening mobile slide-in drawer...');
    await evaluate(ws, `document.querySelector('.planner-sidebar-toggle-btn').click()`);
    await sleep(400);

    const mobileDrawerDetails = await evaluate(ws, `
      (() => {
        const sidebar = document.querySelector('.planner-sidebar');
        const backdrop = document.querySelector('.planner-sidebar-backdrop');
        return {
          isOpen: sidebar.classList.contains('mobile-open'),
          hasBackdrop: !!backdrop
        };
      })()
    `);
    console.log('Mobile drawer details:', mobileDrawerDetails);
    await captureScreenshot(ws, 'dashboard_mobile_drawer_open.png');

    console.log('All verification tasks completed successfully!');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
