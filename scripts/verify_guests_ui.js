const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9295;
const PROFILE_DIR = path.join('C:\\Users\\vansh\\Documents\\Toranly', `.tmp_chrome_profile_${Date.now()}`);

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
  await sleep(400);
}

async function run() {
  console.log('--- Launching Chrome for Guests UI Verification ---');
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${PROFILE_DIR}`,
    'http://127.0.0.1:5173/events/plan-ananya-rohan/guests',
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

    // 1. Seed celebration plan with guests and menu ideas
    console.log('--- Seeding celebration plan with guests and menu ideas ---');
    await evaluate(ws, `(async () => {
      const req = indexedDB.open('toranly', 1);
      return new Promise((resolve) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('plans', 'readwrite');
          const store = tx.objectStore('plans');
          const getReq = store.get('plan-ananya-rohan');
          getReq.onsuccess = () => {
            const plan = getReq.result || {};
            plan.schemaVersion = 1;
            plan.id = 'plan-ananya-rohan';
            plan.status = 'active';
            plan.createdAt = plan.createdAt || new Date().toISOString();
            plan.updatedAt = new Date().toISOString();
            plan.event = plan.event || {};
            plan.event.type = 'wedding';
            plan.event.title = "Ananya & Rohan's Wedding";
            plan.event.eventDate = '2027-02-14';
            plan.event.city = 'Udaipur';
            plan.event.guestEstimate = 250;
            plan.event.timezone = 'Asia/Kolkata';
            plan.event.currency = 'INR';
            plan.event.preferences = plan.event.preferences || { customs: [], avoidColours: [], notes: '' };
            plan.functions = plan.functions || [];
            plan.budgetCategories = plan.budgetCategories || [];
            plan.expenses = plan.expenses || [];
            plan.tasks = plan.tasks || [];
            plan.scheduleItems = plan.scheduleItems || [];

            plan.vendors = [
              {
                id: 'v-caterer-1',
                name: 'Saffron Table Caterers',
                categoryKey: 'catering',
                status: 'shortlisted'
              }
            ];
            plan.quotes = [
              {
                id: 'q-caterer-1',
                vendorId: 'v-caterer-1',
                amountPaise: 190000,
                unit: 'per_plate',
                inclusions: ['Live chaat counter', '3-course banquet dinner', 'Halwai sweet station']
              }
            ];
            plan.guests = {
              total: 250,
              veg: 150,
              nonVeg: 70,
              jain: 20,
              eggetarian: 10,
              vegan: 0,
              allergyTags: ['Peanut', 'Lactose intolerant', 'Shellfish & seafood'],
              accessibilityNeeds: ['ramps']
            };
            plan.ideas = [
              {
                id: 'idea-menu-1',
                kind: 'menu',
                title: 'Paneer tikka & Dal makhani royal banquet',
                dietTags: ['veg'],
                source: 'user'
              },
              {
                id: 'idea-menu-2',
                kind: 'menu',
                title: 'Subz Awadhi biryani with burani raita',
                dietTags: ['veg'],
                source: 'user'
              },
              {
                id: 'idea-menu-3',
                kind: 'menu',
                title: 'Chicken seekh kebab & Mutton rogan josh',
                dietTags: ['non-veg', 'nonveg'],
                source: 'user'
              }
            ];

            store.put(plan);
            tx.oncomplete = () => {
              db.close();
              resolve(true);
            };
          };
        };
      });
    })()`);

    // Reload page to pick up seeded state
    console.log('--- Reloading to render seeded Guests page ---');
    await sendCommand(ws, 'Page.reload');
    await sleep(2000);

    // Wait for guests-tab-container
    await evaluate(ws, `(async () => {
      for (let i = 0; i < 30; i++) {
        if (document.querySelector('.guests-tab-container')) return true;
        await new Promise(r => setTimeout(r, 200));
      }
      return false;
    })()`);

    // Verify Page Title and Subtitle
    const pageHeader = await evaluate(ws, `(() => {
      const title = document.querySelector('.guests-title')?.textContent?.trim();
      const desc = document.querySelector('.guests-desc')?.textContent?.trim();
      const exportBtn = document.querySelector('.guests-secondary-btn')?.textContent?.trim();
      const saveBtn = document.querySelector('.guests-primary-btn')?.textContent?.trim();
      return { title, desc, exportBtn, saveBtn };
    })()`);
    console.log('Page Header Verification:', pageHeader);

    // Verify Headcount Baseline Card
    const headcountBaseline = await evaluate(ws, `(() => {
      const title = document.querySelector('#headcount-heading')?.textContent?.trim();
      const pill = document.querySelector('.guests-pill')?.textContent?.trim();
      const inputVal = document.querySelector('#total-guests-input')?.value;
      const caterer = document.querySelector('.guests-caterer-calc')?.textContent?.trim();
      return { title, pill, inputVal, caterer };
    })()`);
    console.log('Headcount Baseline Card:', headcountBaseline);

    // Verify 5 Dietary Cards & Status Strip
    const dietSummary = await evaluate(ws, `(() => {
      const cards = Array.from(document.querySelectorAll('.diet-card')).map(card => {
        const name = card.querySelector('.diet-card-name')?.textContent?.trim();
        const count = card.querySelector('.diet-step-val')?.textContent?.trim();
        const pct = card.querySelector('.diet-pct-label')?.textContent?.trim();
        return { name, count, pct };
      });
      const stripText = document.querySelector('.diet-status-strip-text')?.textContent?.trim();
      const stripBadge = document.querySelector('.diet-status-strip-badge')?.textContent?.trim();
      return { cards, stripText, stripBadge };
    })()`);
    console.log('Dietary Summary:', dietSummary);

    // Verify Menu Coverage Panel
    const coveragePanel = await evaluate(ws, `(() => {
      const title = document.querySelector('#ai-coverage-heading')?.textContent?.trim();
      const covered = document.querySelector('.guests-coverage-covered')?.textContent?.trim();
      const warning = document.querySelector('.guests-coverage-warning')?.textContent?.trim();
      return { title, covered, warning };
    })()`);
    console.log('Menu Coverage Panel:', coveragePanel);

    // Capture Screenshot 1: Desktop Balanced View
    await captureScreenshot(ws, 'guests_desktop_balanced.png');

    // 2. Interactive Testing: Change Non-Veg from 70 to 75 (+5)
    console.log('--- Testing Stepper Interaction: Incrementing Non-Veg ---');
    await evaluate(ws, `(() => {
      const nonVegCard = Array.from(document.querySelectorAll('.diet-card')).find(c => 
        c.querySelector('.diet-card-name')?.textContent?.trim() === 'Non-Veg'
      );
      if (nonVegCard) {
        const plusBtn = nonVegCard.querySelectorAll('.diet-step-btn')[1];
        plusBtn?.click();
      }
    })()`);
    await sleep(400);

    const overAllocatedState = await evaluate(ws, `(() => {
      const pill = document.querySelector('.guests-pill')?.textContent?.trim();
      const stripText = document.querySelector('.diet-status-strip-text')?.textContent?.trim();
      const stripBadge = document.querySelector('.diet-status-strip-badge')?.textContent?.trim();
      const saveStatus = document.querySelector('.guests-save-status')?.textContent?.trim();
      return { pill, stripText, stripBadge, saveStatus };
    })()`);
    console.log('Over-allocated State (+5 extra):', overAllocatedState);

    // Capture Screenshot 2: Desktop Over-allocated State
    await captureScreenshot(ws, 'guests_desktop_overallocated.png');

    // 3. Interactive Testing: Check accessibility option & Save
    console.log('--- Testing Custom Checkbox Toggle & Save Details ---');
    await evaluate(ws, `(() => {
      const seatingOption = Array.from(document.querySelectorAll('.accessibility-option-card')).find(c =>
        c.querySelector('.accessibility-title')?.textContent?.includes('Seating support')
      );
      if (seatingOption) {
        const checkboxInput = seatingOption.querySelector('.toranly-custom-checkbox-input');
        checkboxInput?.click();
      }
    })()`);
    await sleep(300);

    // Click "Save guest details"
    console.log('--- Clicking Save Guest Details ---');
    await evaluate(ws, `(() => {
      const saveBtn = document.querySelector('.guests-primary-btn');
      saveBtn?.click();
    })()`);
    await sleep(600);

    // Capture Screenshot 3: Desktop Saved State
    await captureScreenshot(ws, 'guests_desktop_saved_state.png');

    // 4. Tablet Viewport
    console.log('--- Capturing Tablet View (1024x768) ---');
    await setViewport(ws, 1024, 768);
    await sleep(500);
    await captureScreenshot(ws, 'guests_tablet_view.png');

    // 5. Mobile Viewport
    console.log('--- Capturing Mobile View (390x844) ---');
    await setViewport(ws, 390, 844, true);
    await sleep(500);
    await captureScreenshot(ws, 'guests_mobile_view.png');

    console.log('--- All Guests UI Verifications Completed Successfully ---');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    proc.kill();
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch {}
  }
}

run();
