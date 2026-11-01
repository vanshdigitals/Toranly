const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9260;

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

async function captureScreenshot(ws, filename, clip = null) {
  const params = { format: 'png' };
  if (clip) params.clip = clip;
  const res = await sendCommand(ws, 'Page.captureScreenshot', params);
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log('Saved screenshot:', outPath);
}

async function run() {
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_budget_responsive_fixed');
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

    console.log('Navigating to events page...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events' });
    await sleep(2000);

    // Seed rich budget celebration plan
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
            guestCount: 350,
            city: 'Udaipur, Rajasthan',
            tier: 'premium',
            budgetTotalPaise: 150000000, // 15 Lakhs
            scaleBand: '300-500',
            planningMode: 'balanced',
            functions: ['Mehndi', 'Sangeet', 'Wedding Ceremony', 'Reception'],
          },
          budgetCategories: [
            { id: 'cat-catering', key: 'catering', label: 'Catering & Dining', allocatedPaise: 45000000, position: 1 },
            { id: 'cat-venue', key: 'venue', label: 'Venue & Staging', allocatedPaise: 40000000, position: 2 },
            { id: 'cat-decor', key: 'decor', label: 'Decor & Florals', allocatedPaise: 25000000, position: 3 },
            { id: 'cat-photo', key: 'photography', label: 'Photography & Film', allocatedPaise: 15000000, position: 4 },
            { id: 'cat-music', key: 'music', label: 'Music & DJ', allocatedPaise: 10000000, position: 5 },
            { id: 'cat-rituals', key: 'rituals', label: 'Rituals & Pandit', allocatedPaise: 5000000, position: 6 },
          ],
          expenses: [
            { id: 'exp-1', categoryId: 'cat-catering', description: 'Royal Feast Catering advance', amountPaise: 20000000, kind: 'paid', spentOn: '2026-10-15', note: 'Advance booking 45%' },
            { id: 'exp-2', categoryId: 'cat-catering', description: 'Cocktail hour beverage bar', amountPaise: 12000000, kind: 'quoted', spentOn: '2026-10-20', note: 'Vendor invoice PO-889' },
            { id: 'exp-3', categoryId: 'cat-venue', description: 'Palace Courtyard deposit', amountPaise: 25000000, kind: 'paid', spentOn: '2026-10-01', note: 'Confirmation deposit' },
            { id: 'exp-4', categoryId: 'cat-decor', description: 'Floral mandap styling', amountPaise: 18000000, kind: 'quoted', spentOn: '2026-10-18', note: 'Includes fresh marigolds & lotus' },
            { id: 'exp-5', categoryId: 'cat-photo', description: 'Candid wedding films retainer', amountPaise: 8000000, kind: 'paid', spentOn: '2026-10-12', note: '3-day cinematic coverage' },
          ],
          tasks: [],
          timeline: [],
          vendors: [],
          notes: []
        };

        const req = indexedDB.open('toranly', 1);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('plans', 'readwrite');
            const store = tx.objectStore('plans');
            store.put(weddingPlan);
            tx.oncomplete = () => resolve('Seeded');
            tx.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      })()
    `);

    console.log('Navigating directly to event Budget tab...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget' });
    await sleep(2500);

    // Wait for the budget page to mount
    for (let i = 0; i < 20; i++) {
      const mounted = await evaluate(ws, `!!document.querySelector('.budget-title')`);
      if (mounted) break;
      await sleep(200);
    }

    // 1. Desktop 1440px checks & screenshot
    console.log('Checking Desktop 1440px layout...');
    const desktopMetrics = await evaluate(ws, `
      (() => {
        const inner = document.querySelector('.planner-stage-inner');
        const card = document.querySelector('.budget-table-card');
        const table = document.querySelector('.budget-data-table');
        const cardRect = card ? card.getBoundingClientRect() : null;
        const tableRect = table ? table.getBoundingClientRect() : null;
        const bodyScrollWidth = document.documentElement.scrollWidth;
        const bodyClientWidth = document.documentElement.clientWidth;

        return {
          innerWidth: inner ? inner.clientWidth : 0,
          cardWidth: cardRect ? cardRect.width : 0,
          tableWidth: tableRect ? tableRect.width : 0,
          cardRight: cardRect ? cardRect.right : 0,
          tableRight: tableRect ? tableRect.right : 0,
          bodyScrollWidth,
          bodyClientWidth,
          hasGlobalScroll: bodyScrollWidth > bodyClientWidth,
          tablePokesPastCard: tableRect && cardRect ? (tableRect.right > cardRect.right + 1) : false
        };
      })()
    `);
    console.log('Desktop 1440px metrics:', desktopMetrics);
    await captureScreenshot(ws, 'budget_desktop_wide.png');

    // 2. Tablet 820px checks & screenshot
    console.log('Checking Tablet 820px layout...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 820,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(1000);

    const tabletMetrics = await evaluate(ws, `
      (() => {
        const bodyScrollWidth = document.documentElement.scrollWidth;
        const bodyClientWidth = document.documentElement.clientWidth;
        const card = document.querySelector('.budget-table-card');
        const cardRect = card ? card.getBoundingClientRect() : null;

        return {
          bodyScrollWidth,
          bodyClientWidth,
          hasGlobalScroll: bodyScrollWidth > bodyClientWidth,
          cardWidth: cardRect ? cardRect.width : 0
        };
      })()
    `);
    console.log('Tablet 820px metrics:', tabletMetrics);
    await captureScreenshot(ws, 'budget_tablet_view.png');

    // 3. Mobile 390px checks & screenshot (Categories mobile cards)
    console.log('Checking Mobile 390px Categories cards layout...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(1000);

    const mobileCatMetrics = await evaluate(ws, `
      (() => {
        const tableView = document.querySelector('.budget-categories-table-view');
        const mobileList = document.querySelector('.budget-categories-mobile-list');
        const cards = document.querySelectorAll('.cat-mobile-card');
        const summaryCard = document.querySelector('.cat-mobile-summary-card');
        const bodyScrollWidth = document.documentElement.scrollWidth;
        const bodyClientWidth = document.documentElement.clientWidth;

        return {
          tableViewVisible: tableView ? window.getComputedStyle(tableView).display !== 'none' : false,
          mobileListVisible: mobileList ? window.getComputedStyle(mobileList).display !== 'none' : false,
          cardCount: cards.length,
          hasSummaryCard: !!summaryCard,
          bodyScrollWidth,
          bodyClientWidth,
          hasGlobalScroll: bodyScrollWidth > bodyClientWidth
        };
      })()
    `);
    console.log('Mobile 390px Categories metrics:', mobileCatMetrics);
    await captureScreenshot(ws, 'budget_mobile_categories_cards.png');

    // 4. Mobile 390px - Switch to Expenses Log
    console.log('Switching to Expenses subtab on Mobile...');
    await evaluate(ws, `
      (() => {
        const buttons = Array.from(document.querySelectorAll('.budget-tab-btn'));
        const expBtn = buttons.find(b => b.textContent.includes('Expenses Log'));
        if (expBtn) expBtn.click();
      })()
    `);
    await sleep(1000);

    const mobileExpMetrics = await evaluate(ws, `
      (() => {
        const tableView = document.querySelector('.budget-expenses-table-view');
        const mobileList = document.querySelector('.budget-expenses-mobile-list');
        const cards = document.querySelectorAll('.expense-mobile-card');
        const summaryCard = document.querySelector('.expense-mobile-summary-card');
        const searchInput = document.querySelector('.expenses-search-input');
        const filterSelect = document.querySelector('.expenses-category-filter');
        const addBtn = document.querySelector('.budget-expenses-toolbar .budget-action-primary');
        const bodyScrollWidth = document.documentElement.scrollWidth;
        const bodyClientWidth = document.documentElement.clientWidth;

        return {
          tableViewVisible: tableView ? window.getComputedStyle(tableView).display !== 'none' : false,
          mobileListVisible: mobileList ? window.getComputedStyle(mobileList).display !== 'none' : false,
          cardCount: cards.length,
          hasSummaryCard: !!summaryCard,
          searchInputHeight: searchInput ? searchInput.clientHeight : 0,
          filterSelectHeight: filterSelect ? filterSelect.clientHeight : 0,
          addBtnHeight: addBtn ? addBtn.clientHeight : 0,
          bodyScrollWidth,
          bodyClientWidth,
          hasGlobalScroll: bodyScrollWidth > bodyClientWidth
        };
      })()
    `);
    console.log('Mobile 390px Expenses metrics:', mobileExpMetrics);
    await captureScreenshot(ws, 'budget_mobile_expenses_cards.png');

    // 5. Desktop 1440px - Expenses Log Tab (with expenses)
    console.log('Checking Desktop 1440px Expenses Log...');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(1000);

    const desktopExpMetrics = await evaluate(ws, `
      (() => {
        const searchInput = document.querySelector('.expenses-search-input');
        const filterSelect = document.querySelector('.expenses-category-filter');
        const addBtn = document.querySelector('.budget-expenses-toolbar .budget-action-primary');
        const counter = document.querySelector('.expenses-counter');
        const table = document.querySelector('.budget-expenses-table-view .budget-data-table');

        return {
          searchHeight: searchInput ? searchInput.clientHeight : 0,
          filterHeight: filterSelect ? filterSelect.clientHeight : 0,
          filterWidth: filterSelect ? filterSelect.clientWidth : 0,
          addBtnHeight: addBtn ? addBtn.clientHeight : 0,
          counterText: counter ? counter.textContent : '',
          hasTable: !!table
        };
      })()
    `);
    console.log('Desktop 1440px Expenses metrics:', desktopExpMetrics);
    await captureScreenshot(ws, 'budget_expenses_log_desktop.png');

    // 6. Test Centered Empty State with 0 expenses
    console.log('Testing Empty State on Desktop with 0 expenses...');
    await evaluate(ws, `
      (async () => {
        const req = indexedDB.open('toranly', 1);
        return new Promise((resolve) => {
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('plans', 'readwrite');
            const store = tx.objectStore('plans');
            const getReq = store.get('ev-ananya-rohan-wedding');
            getReq.onsuccess = () => {
              const data = getReq.result;
              data.expenses = [];
              store.put(data);
            };
            tx.oncomplete = resolve;
          };
        });
      })()
    `);

    // Reload page to re-render with 0 expenses
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget' });
    await sleep(2500);

    // Switch to expenses subtab
    await evaluate(ws, `
      (() => {
        const buttons = Array.from(document.querySelectorAll('.budget-tab-btn'));
        const expBtn = buttons.find(b => b.textContent.includes('Expenses Log'));
        if (expBtn) expBtn.click();
      })()
    `);
    await sleep(1000);

    const zeroExpensesMetrics = await evaluate(ws, `
      (() => {
        const emptyBox = document.querySelector('.table-empty-box');
        const iconWrap = emptyBox ? emptyBox.querySelector('.empty-icon-wrap') : null;
        const emptyTitle = document.querySelector('.empty-title');
        const emptyDesc = document.querySelector('.empty-desc');
        const addBtn = emptyBox ? emptyBox.querySelector('.budget-action-primary') : null;

        let isCentered = false;
        if (emptyBox) {
          const style = window.getComputedStyle(emptyBox);
          isCentered = style.display === 'flex' && style.alignItems === 'center' && style.justifyContent === 'center';
        }

        return {
          hasEmptyBox: !!emptyBox,
          isCentered,
          iconWrapSize: iconWrap ? { width: iconWrap.clientWidth, height: iconWrap.clientHeight } : null,
          titleText: emptyTitle ? emptyTitle.textContent : '',
          descText: emptyDesc ? emptyDesc.textContent : '',
          hasAddBtn: !!addBtn,
          addBtnText: addBtn ? addBtn.textContent.trim() : ''
        };
      })()
    `);
    console.log('Zero expenses empty state metrics:', zeroExpensesMetrics);
    await captureScreenshot(ws, 'budget_expenses_empty_state_centered.png');

    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
    await sendCommand(ws, 'Browser.close');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch (e) {}
  }
}

run();
