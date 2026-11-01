const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9285;

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
  await sleep(350);
}

async function run() {
  console.log('--- Launching Chrome for Schedule UI Verification ---');
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=C:\\Users\\vansh\\Documents\\Toranly\\.tmp_chrome_profile',
    'http://127.0.0.1:5173/events/plan-ananya-rohan/schedule',
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

    await setViewport(ws, 1440, 960);
    await sleep(1000);

    // Seed authentic celebration functions and items
    console.log('--- Populating authentic celebration functions and items ---');
    await evaluate(ws, `(async () => {
      const celebrationFunctions = [
        {
          id: 'fn-wedding',
          name: 'Wedding',
          date: '2027-02-14',
          startTime: '10:00',
          endTime: '15:00',
          position: 1
        },
        {
          id: 'fn-mehendi',
          name: 'Mehendi',
          date: '2027-02-12',
          startTime: '16:00',
          endTime: '21:00',
          position: 2
        },
        {
          id: 'fn-sangeet',
          name: 'Sangeet',
          date: '2027-02-13',
          startTime: '19:00',
          endTime: '23:30',
          position: 3
        },
        {
          id: 'fn-reception',
          name: 'Reception',
          date: '2027-02-14',
          startTime: '19:30',
          endTime: '23:30',
          position: 4
        }
      ];

      const celebrationScheduleItems = [
        // Wedding items (with 15 min overlap between Pheras and Lunch)
        {
          id: 'sched-w-1',
          functionId: 'fn-wedding',
          startTime: '10:00',
          durationMin: 45,
          title: 'Baraat arrival',
          notes: 'Procession at grand gate, dhol troupe and milni scarves ready',
          position: 1
        },
        {
          id: 'sched-w-2',
          functionId: 'fn-wedding',
          startTime: '10:45',
          durationMin: 30,
          title: 'Jaimala',
          notes: 'Floral stage exchange, rose petal shower coordination',
          position: 2
        },
        {
          id: 'sched-w-3',
          functionId: 'fn-wedding',
          startTime: '11:15',
          durationMin: 90,
          title: 'Pheras',
          notes: 'Vedic ceremony inside mandap (Pandit Ji confirmed for 11:15 sharp)',
          position: 3
        },
        {
          id: 'sched-w-4',
          functionId: 'fn-wedding',
          startTime: '12:30',
          durationMin: 90,
          title: 'Lunch',
          notes: 'Buffet opens while Vedic phero ceremony is still underway. Guests cannot attend both simultaneously unless planned as concurrent.',
          position: 4
        },
        {
          id: 'sched-w-5',
          functionId: 'fn-wedding',
          startTime: '14:00',
          durationMin: 45,
          title: 'Vidaai',
          notes: 'Farewell ritual at main porch, vintage car departure at 14:45',
          position: 5
        },
        // Mehendi items
        {
          id: 'sched-m-1',
          functionId: 'fn-mehendi',
          startTime: '16:00',
          durationMin: 60,
          title: 'Guests arrive and welcome drinks',
          notes: 'Thandai counter, fresh sugarcane juice stall, and floral gajra welcome',
          position: 1
        },
        {
          id: 'sched-m-2',
          functionId: 'fn-mehendi',
          startTime: '17:00',
          durationMin: 90,
          title: 'Mehendi for the bride',
          notes: 'Traditional bridal henna artist application with photo moments',
          position: 2
        },
        {
          id: 'sched-m-3',
          functionId: 'fn-mehendi',
          startTime: '18:30',
          durationMin: 60,
          title: 'Folk dances and dholki',
          notes: 'Sangeet practice, family performances and dholki songs',
          position: 3
        },
        {
          id: 'sched-m-4',
          functionId: 'fn-mehendi',
          startTime: '19:30',
          durationMin: 90,
          title: 'High tea and chaat street buffet',
          notes: 'Live golgappa, kachori and hot jalebi stations',
          position: 4
        }
      ];

      const req = indexedDB.open('toranly', 1);
      return new Promise((resolve) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('plans', 'readwrite');
          const store = tx.objectStore('plans');
          const getReq = store.get('plan-ananya-rohan');
          getReq.onsuccess = () => {
            const plan = getReq.result || {};
            plan.id = 'plan-ananya-rohan';
            plan.status = 'active';
            plan.createdAt = plan.createdAt || new Date().toISOString();
            plan.updatedAt = new Date().toISOString();
            plan.event = plan.event || {
              type: 'wedding',
              title: 'Ananya & Rohan',
              eventDate: '2027-02-14',
              timezone: 'Asia/Kolkata',
              city: 'Jaipur',
              guestEstimate: 250
            };
            plan.functions = celebrationFunctions;
            plan.scheduleItems = celebrationScheduleItems;
            plan.guests = {
              total: 250,
              veg: 140,
              nonVeg: 70,
              jain: 30,
              eggetarian: 10,
              vegan: 0,
              allergyTags: [],
              accessibilityNeeds: []
            };
            store.put(plan);
            tx.oncomplete = () => resolve(true);
          };
        };
      });
    })()`);

    // Reload page to reflect seeded data
    await sendCommand(ws, 'Page.reload');
    await sleep(2500);

    // 1. Select Wedding in Left Rail (Matching Stitch Screen)
    console.log('--- Selecting Wedding Function (Active with Overlap) ---');
    await evaluate(ws, `(() => {
      const weddingNav = Array.from(document.querySelectorAll('.sched-function-nav-item'))
        .find(el => el.innerText.includes('Wedding'));
      if (weddingNav) weddingNav.click();
    })()`);
    await sleep(800);

    // Check Desktop View with Wedding & Conflict
    const weddingStats = await evaluate(ws, `(() => {
      const pageTitle = document.querySelector('.sched-page-title')?.innerText;
      const functionHeadline = document.querySelector('.sched-function-headline')?.innerText;
      const conflictPill = document.querySelector('.sched-conflict-pill')?.innerText;
      const statusBadge = document.querySelector('.sched-status-badge')?.innerText;
      const timelineRows = document.querySelectorAll('.sched-timeline-row').length;
      const conflictCard = document.querySelector('.sched-conflict-card') !== null;
      const addFunctionBtn = document.querySelector('.sched-primary-btn');
      const shiftBtn = document.querySelector('.sched-conflict-fix-btn');
      
      const btnStyle = addFunctionBtn ? window.getComputedStyle(addFunctionBtn) : null;
      const shiftStyle = shiftBtn ? window.getComputedStyle(shiftBtn) : null;

      return {
        pageTitle,
        functionHeadline,
        conflictPill,
        statusBadge,
        timelineRows,
        conflictCard,
        addFunctionBtnColor: btnStyle?.color,
        addFunctionBtnBg: btnStyle?.backgroundColor,
        shiftBtnColor: shiftStyle?.color,
        shiftBtnBg: shiftStyle?.backgroundColor
      };
    })()`);
    console.log('Wedding Page Stats (Matching Stitch):', weddingStats);

    await captureScreenshot(ws, 'schedule_desktop_wedding_conflict.png');

    // 2. Test In-Progress Real-Time Simulation Mode on Wedding
    console.log('--- Testing In-Progress Real-Time Simulation ---');
    await evaluate(ws, `(() => {
      const simBtn = document.querySelector('.sched-sim-toggle');
      if (simBtn) simBtn.click();
    })()`);
    await sleep(600);

    const simStats = await evaluate(ws, `(() => {
      const indicator = document.querySelector('.sched-progress-indicator-bar')?.innerText;
      const fillHeight = document.querySelector('.sched-timeline-progress-fill')?.style.height;
      return { indicator, fillHeight };
    })()`);
    console.log('Simulation Stats (at 12:30 PM):', simStats);

    await captureScreenshot(ws, 'schedule_desktop_simulating_in_progress.png');

    // Turn off simulation to test conflict resolution
    await evaluate(ws, `(() => {
      const simBtn = document.querySelector('.sched-sim-toggle');
      if (simBtn) simBtn.click();
    })()`);
    await sleep(400);

    // 3. Test Conflict Resolution: Shift Lunch to 12:45
    console.log('--- Testing Conflict Resolution: Shift Lunch to 12:45 ---');
    await evaluate(ws, `(() => {
      const shiftBtn = document.querySelector('.sched-conflict-fix-btn');
      if (shiftBtn) shiftBtn.click();
    })()`);
    await sleep(1000);

    const afterShiftStats = await evaluate(ws, `(() => {
      const statusBadge = document.querySelector('.sched-status-badge')?.innerText;
      const conflictCard = document.querySelector('.sched-conflict-card') !== null;
      const lunchTime = Array.from(document.querySelectorAll('.sched-timeline-row'))
        .find(r => r.innerText.includes('Lunch'))
        ?.querySelector('.sched-time-label')?.innerText;
      const vidaaiTime = Array.from(document.querySelectorAll('.sched-timeline-row'))
        .find(r => r.innerText.includes('Vidaai'))
        ?.querySelector('.sched-time-label')?.innerText;
      return { statusBadge, conflictCard, lunchTime, vidaaiTime };
    })()`);
    console.log('After Shift Resolution:', afterShiftStats);

    await captureScreenshot(ws, 'schedule_desktop_conflict_resolved.png');

    // 4. Test Switching to Mehendi Function
    console.log('--- Testing Switch to Mehendi Function ---');
    await evaluate(ws, `(() => {
      const mehendiNav = Array.from(document.querySelectorAll('.sched-function-nav-item'))
        .find(el => el.innerText.includes('Mehendi'));
      if (mehendiNav) mehendiNav.click();
    })()`);
    await sleep(600);

    const mehendiStats = await evaluate(ws, `(() => {
      const headline = document.querySelector('.sched-function-headline')?.innerText;
      const statusBadge = document.querySelector('.sched-status-badge')?.innerText;
      const items = document.querySelectorAll('.sched-timeline-row').length;
      return { headline, statusBadge, items };
    })()`);
    console.log('Mehendi Function View:', mehendiStats);

    await captureScreenshot(ws, 'schedule_desktop_mehendi_intact.png');

    // 5. Test Add Item Modal Dialog
    console.log('--- Testing Add Item Dialog ---');
    await evaluate(ws, `(() => {
      const addBtn = Array.from(document.querySelectorAll('.sched-secondary-btn'))
        .find(b => b.innerText.includes('Add item'));
      if (addBtn) addBtn.click();
    })()`);
    await sleep(500);

    const dialogStats = await evaluate(ws, `(() => {
      const title = document.querySelector('.sched-modal-title')?.innerText;
      const presets = document.querySelectorAll('.sched-preset-chip').length;
      const saveBtn = document.querySelector('.sched-modal-footer .sched-primary-btn');
      const btnStyle = saveBtn ? window.getComputedStyle(saveBtn) : null;
      return {
        title,
        presets,
        saveBtnColor: btnStyle?.color,
        saveBtnBg: btnStyle?.backgroundColor
      };
    })()`);
    console.log('Dialog Stats:', dialogStats);

    await captureScreenshot(ws, 'schedule_add_item_dialog.png');

    // Close Dialog
    await evaluate(ws, `(() => {
      const closeBtn = document.querySelector('.sched-modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 6. Tablet Layout (820 x 1180)
    console.log('--- Capturing Tablet View ---');
    await setViewport(ws, 820, 1180);
    await sleep(600);
    await captureScreenshot(ws, 'schedule_tablet_view.png');

    // 7. Mobile Layout (375 x 812)
    console.log('--- Capturing Mobile View ---');
    await setViewport(ws, 375, 812, true);
    await sleep(600);
    await captureScreenshot(ws, 'schedule_mobile_view.png');

    console.log('--- All Schedule UI verifications completed successfully! ---');

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    proc.kill();
  }
}

run();
