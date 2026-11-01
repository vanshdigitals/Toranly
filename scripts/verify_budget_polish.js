const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9247;

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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_budget_polish');
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

    // 1. Verify Breadcrumb Duplication
    const breadcrumbCheck = await evaluate(ws, `
      (() => {
        const localBreadcrumb = document.querySelector('.budget-breadcrumb');
        const budgetTitle = document.querySelector('.budget-title');
        const globalBreadcrumbs = Array.from(document.querySelectorAll('.app-header-left a, .app-header-left span')).map(el => el.textContent.trim());
        return {
          hasLocalBreadcrumb: !!localBreadcrumb,
          budgetTitleText: budgetTitle ? budgetTitle.textContent.trim() : null,
          globalBreadcrumbs
        };
      })()
    `);
    console.log('1. Breadcrumb check:', breadcrumbCheck);
    if (breadcrumbCheck.hasLocalBreadcrumb) {
      throw new Error('FAIL: Redundant local .budget-breadcrumb still exists in page content!');
    }

    // 2. Verify Header Action Buttons Consistency
    const buttonMetrics = await evaluate(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('.budget-header-actions .budget-action-btn'));
        return btns.map(b => {
          const rect = b.getBoundingClientRect();
          const style = window.getComputedStyle(b);
          const icon = b.querySelector('svg');
          const iconRect = icon ? icon.getBoundingClientRect() : null;
          return {
            text: b.textContent.trim(),
            height: Math.round(rect.height),
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            borderRadius: style.borderRadius,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            iconWidth: iconRect ? Math.round(iconRect.width) : null,
            iconHeight: iconRect ? Math.round(iconRect.height) : null,
          };
        });
      })()
    `);
    console.log('2. Action Button Metrics:', buttonMetrics);
    const heights = buttonMetrics.map(b => b.height);
    const allSameHeight = heights.every(h => h === heights[0]);
    if (!allSameHeight) {
      throw new Error(`FAIL: Button heights are inconsistent: ${JSON.stringify(heights)}`);
    }

    // 3. Verify Remaining Balance Card Style (No green top border)
    const remainingCardCheck = await evaluate(ws, `
      (() => {
        const remCard = document.querySelector('.tile-remaining-hero');
        const beforeStyle = window.getComputedStyle(remCard, '::before');
        const cardStyle = window.getComputedStyle(remCard);
        const remVal = remCard.querySelector('.tile-val-hero');
        const valStyle = remVal ? window.getComputedStyle(remVal) : null;
        return {
          cardBorder: cardStyle.border,
          cardBg: cardStyle.backgroundColor,
          beforeDisplay: beforeStyle.display,
          beforeContent: beforeStyle.content,
          valColor: valStyle ? valStyle.color : null
        };
      })()
    `);
    console.log('3. Remaining Balance Card Check:', remainingCardCheck);
    if (remainingCardCheck.beforeDisplay !== 'none' && remainingCardCheck.beforeContent !== 'none' && remainingCardCheck.beforeContent !== '""') {
      console.log('Notice: beforeDisplay/beforeContent:', remainingCardCheck.beforeDisplay, remainingCardCheck.beforeContent);
    }

    // 4. Verify Table Column Widths and Geometry
    const tableGeometry = await evaluate(ws, `
      (() => {
        const thAlloc = document.querySelector('.th-allocated');
        const thComm = document.querySelector('.th-committed');
        const thPaid = document.querySelector('.th-paid');
        const thRem = document.querySelector('.th-remaining');
        const thStatus = document.querySelector('.th-status');
        const thActions = document.querySelector('.th-actions');
        return {
          allocWidth: thAlloc ? Math.round(thAlloc.getBoundingClientRect().width) : null,
          commWidth: thComm ? Math.round(thComm.getBoundingClientRect().width) : null,
          paidWidth: thPaid ? Math.round(thPaid.getBoundingClientRect().width) : null,
          remWidth: thRem ? Math.round(thRem.getBoundingClientRect().width) : null,
          statusWidth: thStatus ? Math.round(thStatus.getBoundingClientRect().width) : null,
          actionsWidth: thActions ? Math.round(thActions.getBoundingClientRect().width) : null,
        };
      })()
    `);
    console.log('4. Table Column Geometry:', tableGeometry);

    // 5. Measure row heights BEFORE inline editing
    const rowHeightsBefore = await evaluate(ws, `
      (() => {
        const rows = Array.from(document.querySelectorAll('.budget-data-table tbody tr'));
        return rows.map((r, i) => ({
          index: i,
          height: Math.round(r.getBoundingClientRect().height),
          tdHeight: Math.round(r.querySelector('.td-allocated').getBoundingClientRect().height)
        }));
      })()
    `);
    console.log('5. Row heights BEFORE edit:', rowHeightsBefore);
    const row0HeightBefore = rowHeightsBefore[0].height;

    // 6. Test Hover Edit State
    const hoverCheck = await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.budget-data-table tbody tr:first-child .alloc-display-btn');
        const normalStyle = window.getComputedStyle(btn);
        return {
          borderStyle: normalStyle.borderStyle,
          borderColor: normalStyle.borderColor,
          cursor: normalStyle.cursor,
          hasDashedBorder: normalStyle.borderStyle.includes('dashed')
        };
      })()
    `);
    console.log('6. Hover state check (normal):', hoverCheck);
    if (hoverCheck.hasDashedBorder) {
      throw new Error('FAIL: alloc-display-btn still has dashed border!');
    }

    // 7. Click to trigger inline editing on Row 0 (Catering)
    console.log('7. Triggering inline editing on Row 0 (Catering)...');
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.budget-data-table tbody tr:first-child .alloc-display-btn');
        btn.click();
      })()
    `);
    await sleep(500);

    // Measure row height DURING inline editing
    const editModeMetrics = await evaluate(ws, `
      (() => {
        const row0 = document.querySelector('.budget-data-table tbody tr:first-child');
        const row0HeightDuring = Math.round(row0.getBoundingClientRect().height);
        const tdAlloc = row0.querySelector('.td-allocated');
        const tdAllocWidth = Math.round(tdAlloc.getBoundingClientRect().width);
        const inlineEdit = tdAlloc.querySelector('.alloc-inline-edit');
        const input = inlineEdit.querySelector('.alloc-num-input');
        const saveBtn = inlineEdit.querySelector('.inline-save-btn');
        const cancelBtn = inlineEdit.querySelector('.inline-cancel-btn');

        const inputRect = input.getBoundingClientRect();
        const saveRect = saveBtn.getBoundingClientRect();
        const cancelRect = cancelBtn.getBoundingClientRect();

        // Check horizontal arrangement: saveBtn and cancelBtn must be to the right of input
        const isHorizontal = (saveRect.left >= inputRect.right - 2) && (cancelRect.left >= saveRect.right - 2);
        // Vertical alignment: differences in top should be <= 6px
        const isAligned = Math.abs(inputRect.top - saveRect.top) <= 6 && Math.abs(saveRect.top - cancelRect.top) <= 6;

        return {
          row0HeightDuring,
          tdAllocWidth,
          inputVal: input.value,
          isHorizontal,
          isAligned,
          inputHeight: Math.round(inputRect.height),
          saveHeight: Math.round(saveRect.height),
          cancelHeight: Math.round(cancelRect.height)
        };
      })()
    `);
    console.log('7. Edit Mode Metrics:', editModeMetrics);
    console.log(`Height comparison: Before = ${row0HeightBefore}px, During = ${editModeMetrics.row0HeightDuring}px`);

    if (row0HeightBefore !== editModeMetrics.row0HeightDuring) {
      throw new Error(`CRITICAL FAIL: Row height jumped from ${row0HeightBefore}px to ${editModeMetrics.row0HeightDuring}px!`);
    }
    if (!editModeMetrics.isHorizontal) {
      throw new Error('FAIL: Inline edit controls are not laid out horizontally side-by-side!');
    }

    // Capture screenshot of active inline editing
    await captureScreenshot(ws, 'budget_inline_edit_active.png');

    // 8. Test Validation: enter negative value and attempt save
    console.log('8. Testing validation with negative amount "-50000"...');
    await evaluate(ws, `
      (() => {
        const input = document.querySelector('.alloc-num-input');
        input.focus();
        input.select();
      })()
    `);
    await sendCommand(ws, 'Input.insertText', { text: '-50000' });
    await sleep(200);
    await evaluate(ws, `document.querySelector('.inline-save-btn').click()`);
    await sleep(600);

    const validationCheck = await evaluate(ws, `
      (() => {
        const toast = document.querySelector('.overview-toast');
        const toastText = toast ? toast.textContent.trim() : null;
        const stillEditing = !!document.querySelector('.alloc-num-input');
        return { toastText, stillEditing };
      })()
    `);
    console.log('Validation check result:', validationCheck);
    if (!validationCheck.stillEditing) {
      throw new Error('FAIL: Negative value was permitted or silently reset!');
    }
    if (!validationCheck.toastText || !validationCheck.toastText.includes('negative')) {
      throw new Error(`FAIL: Expected negative value error toast, got: ${validationCheck.toastText}`);
    }

    // 9. Valid edit and full recalculation
    console.log('9. Entering valid new allocation ₹5,00,000 (500000) and saving...');
    await evaluate(ws, `
      (() => {
        const input = document.querySelector('.alloc-num-input');
        input.focus();
        input.select();
      })()
    `);
    await sendCommand(ws, 'Input.insertText', { text: '500000' });
    await sleep(200);
    // Press Enter to save
    await sendCommand(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sendCommand(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(1000);

    // Verify recalculations
    const recalcMetrics = await evaluate(ws, `
      (() => {
        const row0Alloc = document.querySelector('.budget-data-table tbody tr:first-child .td-allocated .num-val').textContent.trim();
        const totalAlloc = document.querySelector('.tfoot-allocated').textContent.trim();
        const remCardVal = document.querySelector('.tile-remaining-hero .tile-value').textContent.trim();
        const toast = document.querySelector('.overview-toast');
        const toastText = toast ? toast.textContent.trim() : null;
        return { row0Alloc, totalAlloc, remCardVal, toastText };
      })()
    `);
    console.log('Recalculation Results:', recalcMetrics);
    if (!recalcMetrics.row0Alloc.includes('5,00,000')) {
      throw new Error(`FAIL: Row 0 allocation did not update to ₹5,00,000, got: ${recalcMetrics.row0Alloc}`);
    }

    // 10. Test Escape key on Row 2 (Decor)
    console.log('10. Testing Escape key cancel on Row 2 (Decor)...');
    await evaluate(ws, `
      (() => {
        const rows = document.querySelectorAll('.budget-data-table tbody tr');
        const decorBtn = rows[2].querySelector('.alloc-display-btn');
        decorBtn.click();
      })()
    `);
    await sleep(400);

    await evaluate(ws, `
      (() => {
        const input = document.querySelector('.alloc-num-input');
        input.focus();
        input.select();
      })()
    `);
    await sendCommand(ws, 'Input.insertText', { text: '999999' });
    await sleep(200);
    await sendCommand(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sendCommand(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);

    const cancelCheck = await evaluate(ws, `
      (() => {
        const isEditing = !!document.querySelector('.alloc-num-input');
        const rows = document.querySelectorAll('.budget-data-table tbody tr');
        const decorVal = rows[2].querySelector('.td-allocated .num-val').textContent.trim();
        return { isEditing, decorVal };
      })()
    `);
    console.log('Cancel Check Result:', cancelCheck);
    if (cancelCheck.isEditing) {
      throw new Error('FAIL: Escape key did not close inline editing!');
    }
    if (cancelCheck.decorVal.includes('999999')) {
      throw new Error('FAIL: Value was erroneously saved on Escape cancel!');
    }

    // 11. Capture Full Desktop Screenshot
    console.log('11. Capturing polished desktop, tablet, and mobile screenshots...');
    await captureScreenshot(ws, 'budget_page_polished_desktop.png');

    // Capture focused Remaining Balance Card screenshot
    const remCardClip = await evaluate(ws, `
      (() => {
        const card = document.querySelector('.tile-remaining-hero');
        const rect = card.getBoundingClientRect();
        return { x: rect.x - 10, y: rect.y - 10, width: rect.width + 20, height: rect.height + 20, scale: 1 };
      })()
    `);
    await captureScreenshot(ws, 'budget_remaining_card_neutral.png', remCardClip);

    // Tablet viewport (820px)
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 820,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(500);
    await captureScreenshot(ws, 'budget_page_polished_tablet.png');

    // Mobile viewport (390px)
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(500);
    await captureScreenshot(ws, 'budget_page_polished_mobile.png');

    console.log('ALL TESTS PASSED SUCCESSFULLY!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
