const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\vansh\\.gemini\\antigravity\\brain\\1f8f0946-b364-42c3-a5a9-4fc905cd0f58';
const PORT = 9265;

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
  const tmpDir = path.join(__dirname, '..', '.tmp_chrome_vendors_redesign');
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

    // ==========================================
    // 1. GLOBAL HEADING HIERARCHY VERIFICATION
    // ==========================================
    console.log('--- 1. Testing Global Heading Hierarchy Tokens ---');

    // Seed base plan
    const basePlan = {
      schemaVersion: 1,
      id: 'ev-ananya-rohan-wedding',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-28T12:00:00.000Z',
      wizardStep: 4,
      status: 'active',
      event: {
        type: 'wedding',
        title: "Ananya & Rohan's Wedding",
        eventDate: '2026-12-18',
        timezone: 'Asia/Kolkata',
        city: 'Udaipur, Rajasthan',
        guestEstimate: 350,
        budgetTotalPaise: 150000000, // 15 Lakhs
        currency: 'INR',
        preferences: {
          themeWords: ['Royal', 'Regal', 'Heritage'],
          dietFocus: ['Pure Veg', 'Jain Options'],
          customs: ['Marwari Traditions'],
          avoidColours: ['Black'],
          notes: 'Celebrating with family and friends across 3 days',
        },
      },
      budgetCategories: [
        { id: 'cat-venue', key: 'venue', label: 'Venue & Staging', allocatedPaise: 45000000, position: 1 },
        { id: 'cat-catering', key: 'catering', label: 'Catering & Dining', allocatedPaise: 40000000, position: 2 },
        { id: 'cat-photo', key: 'photography', label: 'Photography & Film', allocatedPaise: 20000000, position: 3 },
        { id: 'cat-decor', key: 'decor', label: 'Decor & Florals', allocatedPaise: 25000000, position: 4 },
        { id: 'cat-music', key: 'music', label: 'Music & Entertainment', allocatedPaise: 10000000, position: 5 },
        { id: 'cat-general', key: 'general', label: 'Other Services', allocatedPaise: 10000000, position: 6 },
      ],
      expenses: [],
      tasks: [],
      vendors: [],
      quotes: [],
      guests: { total: 350, veg: 300, nonVeg: 0, jain: 50, eggetarian: 0, vegan: 0, allergyTags: [], accessibilityNeeds: [] },
      scheduleItems: [],
      ideas: [],
    };

    await evaluate(ws, `
      (async () => {
        const req = indexedDB.open('toranly', 1);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('plans', 'readwrite');
            tx.objectStore('plans').put(${JSON.stringify(basePlan)});
            tx.oncomplete = () => resolve('Base plan seeded');
            tx.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      })()
    `);

    // Check Overview Heading
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding' });
    await sleep(2500);

    const overviewHeadingStyles = await evaluate(ws, `
      (() => {
        const el = document.querySelector('.overview-title');
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          text: el.innerText.trim(),
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
        };
      })()
    `);
    console.log('Overview Title Styles:', overviewHeadingStyles);

    // Check Budget Heading
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/budget' });
    await sleep(2000);

    const budgetHeadingStyles = await evaluate(ws, `
      (() => {
        const el = document.querySelector('.budget-title');
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          text: el.innerText.trim(),
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight,
        };
      })()
    `);
    console.log('Budget Title Styles:', budgetHeadingStyles);

    // Check Settings Heading
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/settings' });
    await sleep(2000);

    const settingsHeadingStyles = await evaluate(ws, `
      (() => {
        const el = document.querySelector('.settings-title');
        const sec = document.querySelector('.settings-section-title');
        return {
          title: el ? { text: el.innerText.trim(), fontSize: window.getComputedStyle(el).fontSize, fontFamily: window.getComputedStyle(el).fontFamily } : null,
          sectionTitle: sec ? { text: sec.innerText.trim(), fontSize: window.getComputedStyle(sec).fontSize } : null,
        };
      })()
    `);
    console.log('Settings Title Styles:', settingsHeadingStyles);

    // ==========================================
    // 2. SCENARIO 1: VENDORS EMPTY STATE
    // ==========================================
    console.log('--- 2. Testing Scenario 1: Vendors Empty State ---');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/events/ev-ananya-rohan-wedding/vendors' });
    await sleep(1500);

    const emptyStateCheck = await evaluate(ws, `
      (() => {
        const pageTitle = document.querySelector('.tab-pane-title');
        const pageSubtitle = document.querySelector('.tab-pane-subtitle');
        const metricsGrid = document.querySelector('.vendors-metrics-grid');
        const emptyCard = document.querySelector('.vendors-empty-card');
        const emptyTitle = document.querySelector('.empty-title');
        const emptyIconWrap = document.querySelector('.empty-icon-wrap');
        const chips = Array.from(document.querySelectorAll('.empty-cat-chip')).map(c => c.innerText.trim());

        return {
          pageTitleText: pageTitle ? pageTitle.innerText.trim() : null,
          pageTitleFontSize: pageTitle ? window.getComputedStyle(pageTitle).fontSize : null,
          pageTitleFontFamily: pageTitle ? window.getComputedStyle(pageTitle).fontFamily : null,
          pageSubtitleText: pageSubtitle ? pageSubtitle.innerText.trim() : null,
          hasMetricsGrid: !!metricsGrid,
          hasEmptyCard: !!emptyCard,
          emptyTitleText: emptyTitle ? emptyTitle.innerText.trim() : null,
          iconBadgeSize: emptyIconWrap ? {
            w: emptyIconWrap.offsetWidth,
            h: emptyIconWrap.offsetHeight,
            borderRadius: window.getComputedStyle(emptyIconWrap).borderRadius,
          } : null,
          categoryChips: chips,
        };
      })()
    `);
    console.log('Vendors Empty State Check:', emptyStateCheck);

    // Desktop screenshot of empty state
    await captureScreenshot(ws, 'vendors_empty_desktop.png');

    // Mobile screenshot of empty state
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(800);
    await captureScreenshot(ws, 'vendors_empty_mobile.png');

    // Restore desktop width for modal test
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sleep(800);

    // Test clicking a category chip (e.g., Photography & Film)
    console.log('Testing click on Photography quick-start chip...');
    await evaluate(ws, `
      (() => {
        const chips = Array.from(document.querySelectorAll('.empty-cat-chip'));
        const photoChip = chips.find(c => c.innerText.includes('Photography'));
        if (photoChip) photoChip.click();
      })()
    `);
    await sleep(600);

    const dialogState = await evaluate(ws, `
      (() => {
        const dialog = document.querySelector('.vendor-modal-dialog');
        const title = document.querySelector('.vendor-modal-title');
        const catSelect = document.querySelector('#vendor-cat-select');
        return {
          isOpen: !!dialog,
          titleText: title ? title.innerText.trim() : null,
          selectedCategory: catSelect ? catSelect.value : null,
        };
      })()
    `);
    console.log('Add Vendor Dialog opened from category chip:', dialogState);

    await captureScreenshot(ws, 'vendors_add_from_chip_dialog.png');

    // Close dialog
    await evaluate(ws, `
      (() => {
        const closeBtn = document.querySelector('.vendor-modal-close-btn');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(500);

    // ==========================================
    // 3. SCENARIO 2: WITH VENDORS & QUOTES
    // ==========================================
    console.log('--- 3. Testing Scenario 2: With Vendors and Normalized Quotes ---');

    const richPlan = {
      ...basePlan,
      vendors: [
        {
          id: 'v-heritage-palace',
          categoryKey: 'venue',
          name: 'Fateh Garh Heritage Palace',
          phone: '+91 98290 12345',
          email: 'weddings@fatehgarh.com',
          status: 'booked',
          notes: 'Courtyard & Banquet reserved for 3 days. Includes bridal suites.',
        },
        {
          id: 'v-royal-caterers',
          categoryKey: 'catering',
          name: 'Royal Mewar Hospitality & Catering',
          phone: '+91 94141 56789',
          email: 'contact@royalmewar.in',
          status: 'booked',
          notes: 'Pure vegetarian regional Rajasthani & Continental menu with live chaat counters.',
        },
        {
          id: 'v-candid-lens',
          categoryKey: 'photography',
          name: 'The Candid Lens Studios',
          phone: '+91 99887 76655',
          email: 'hello@candidlens.com',
          status: 'shortlisted',
          notes: 'Team of 6 cinematographers & candid photographers. Drone coverage included.',
        },
        {
          id: 'v-marigold-florals',
          categoryKey: 'decor',
          name: 'Marigold & Mogra Floral Concepts',
          phone: '+91 97112 33445',
          email: 'design@marigoldconcepts.com',
          status: 'shortlisted',
          notes: 'Royal marigold mandap and fairy light canopy over lakeside lawn.',
        },
        {
          id: 'v-beat-drop-dj',
          categoryKey: 'music',
          name: 'DJ Akash & Desert Symphony Band',
          phone: '+91 98765 43210',
          email: 'bookings@akashbeats.com',
          status: 'dropped',
          notes: 'Quoted too high for 2 nights sound system setup.',
        },
      ],
      quotes: [
        {
          id: 'q-venue-1',
          vendorId: 'v-heritage-palace',
          amountPaise: 42000000, // 4,20,000 INR
          unit: 'total',
          inclusions: ['Courtyard', 'Banquet Hall', 'Power Backup', 'Bridal Suite (3 Nights)'],
          validUntil: '2026-11-30',
        },
        {
          id: 'q-catering-1',
          vendorId: 'v-royal-caterers',
          amountPaise: 240000, // 2,400 INR per plate
          unit: 'per_plate',
          inclusions: ['Welcome Drinks', 'Live Stations', '6-course Buffet', 'Dessert Island'],
          validUntil: '2026-11-15',
        },
        {
          id: 'q-photo-1',
          vendorId: 'v-candid-lens',
          amountPaise: 18500000, // 1,85,000 INR
          unit: 'total',
          inclusions: ['4K Cinematic Film', '2 Pre-wedding Shoots', 'Traditional Album (100 pgs)'],
          validUntil: '2026-11-20',
        },
        {
          id: 'q-decor-1',
          vendorId: 'v-marigold-florals',
          amountPaise: 22000000, // 2,20,000 INR
          unit: 'total',
          inclusions: ['Mandap Florals', 'Pathway Lanterns', 'Photobooth', 'Stage Backdrop'],
          validUntil: '2026-11-25',
        },
      ],
    };

    await evaluate(ws, `
      (async () => {
        const req = indexedDB.open('toranly', 1);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('plans', 'readwrite');
            tx.objectStore('plans').put(${JSON.stringify(richPlan)});
            tx.oncomplete = () => resolve('Rich plan seeded');
            tx.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      })()
    `);

    // Reload page
    await sendCommand(ws, 'Page.reload');
    await sleep(2000);

    // Verify Metrics Grid
    const metricsResult = await evaluate(ws, `
      (() => {
        const cards = Array.from(document.querySelectorAll('.vendor-metric-card'));
        return cards.map(c => ({
          label: c.querySelector('.vendor-metric-label')?.innerText.trim(),
          val: c.querySelector('.vendor-metric-val')?.innerText.trim(),
        }));
      })()
    `);
    console.log('Vendor Summary Metrics Grid:', metricsResult);

    // Test Search Filter
    console.log('Testing Search Filter (query: "Candid")...');
    await evaluate(ws, `
      (() => {
        const input = document.querySelector('.vendors-search-input');
        if (input) {
          input.value = 'Candid';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    const searchCount = await evaluate(ws, `
      (() => {
        const rows = document.querySelectorAll('.vendors-table-view tbody tr');
        return rows.length;
      })()
    `);
    console.log('Filtered rows after searching "Candid":', searchCount);

    // Clear Search
    await evaluate(ws, `
      (() => {
        const clearBtn = document.querySelector('.search-clear-btn');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await sleep(500);

    // Test Category Filter
    console.log('Testing Category Filter (category: "photography")...');
    await evaluate(ws, `
      (() => {
        const select = document.querySelector('.vendors-toolbar-left select:nth-of-type(1)');
        if (select) {
          select.value = 'photography';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    const catFilterCount = await evaluate(ws, `
      (() => {
        const rows = document.querySelectorAll('.vendors-table-view tbody tr');
        return rows.length;
      })()
    `);
    console.log('Filtered rows after category filter "photography":', catFilterCount);

    // Reset Category Filter
    await evaluate(ws, `
      (() => {
        const select = document.querySelector('.vendors-toolbar-left select:nth-of-type(1)');
        if (select) {
          select.value = 'all';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    // Check table width & overflow on Desktop (1440px)
    const desktopOverflow = await evaluate(ws, `
      (() => {
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        const tableCard = document.querySelector('.vendors-table-card');
        return {
          scrollW,
          clientW,
          hasWindowHScroll: scrollW > clientW,
          tableCardWidth: tableCard ? tableCard.offsetWidth : null,
        };
      })()
    `);
    console.log('Desktop 1440px Overflow Check:', desktopOverflow);

    // Capture Desktop Directory
    await captureScreenshot(ws, 'vendors_directory_desktop.png');

    // Test Quotes Comparison Section
    console.log('Verifying Quotes Comparison Section...');
    const quotesCheck = await evaluate(ws, `
      (() => {
        const section = document.querySelector('#quotes-comparison-section');
        const heading = document.querySelector('.quotes-heading');
        const subheading = document.querySelector('.quotes-subheading');
        const rows = Array.from(document.querySelectorAll('.quotes-table-view tbody tr'));
        const cheapestBadges = Array.from(document.querySelectorAll('.cheapest-badge')).map(b => b.innerText.trim());

        return {
          hasSection: !!section,
          headingText: heading ? heading.innerText.trim() : null,
          headingFontSize: heading ? window.getComputedStyle(heading).fontSize : null,
          subheadingText: subheading ? subheading.innerText.trim() : null,
          quotesCount: rows.length,
          cheapestBadges,
        };
      })()
    `);
    console.log('Quotes Comparison Section Check:', quotesCheck);

    // Scroll to quotes comparison section and capture screenshot
    await evaluate(ws, `
      (() => {
        const sec = document.querySelector('#quotes-comparison-section');
        if (sec) sec.scrollIntoView();
      })()
    `);
    await sleep(600);
    await captureScreenshot(ws, 'vendors_quotes_comparison_desktop.png');

    // Test Tablet View (820px)
    console.log('--- 4. Testing Tablet View (820px) ---');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 820,
      height: 1180,
      deviceScaleFactor: 2,
      mobile: false,
    });
    // Scroll back to top
    await evaluate(ws, `window.scrollTo(0, 0);`);
    await sleep(800);

    const tabletOverflow = await evaluate(ws, `
      (() => {
        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          hasWindowHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);
    console.log('Tablet 820px Overflow Check:', tabletOverflow);
    await captureScreenshot(ws, 'vendors_directory_tablet.png');

    // Test Mobile View (390px)
    console.log('--- 5. Testing Mobile View (390px) ---');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await evaluate(ws, `window.scrollTo(0, 0);`);
    await sleep(800);

    const mobileCheck = await evaluate(ws, `
      (() => {
        const vendorCards = document.querySelectorAll('.vendor-mobile-card');
        const quoteCards = document.querySelectorAll('.quote-mobile-card');
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;

        return {
          vendorCardsCount: vendorCards.length,
          quoteCardsCount: quoteCards.length,
          scrollW,
          clientW,
          hasWindowHScroll: scrollW > clientW,
        };
      })()
    `);
    console.log('Mobile 390px View Check:', mobileCheck);
    await captureScreenshot(ws, 'vendors_directory_mobile.png');

    // Test Add Vendor Dialog flow
    console.log('--- 6. Testing Add Vendor Flow ---');
    // Switch to desktop for clear form screenshot
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await evaluate(ws, `window.scrollTo(0, 0);`);
    await sleep(500);

    // Click "Add vendor" primary button
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('.vendors-header-actions .budget-action-primary');
        if (btn) btn.click();
      })()
    `);
    await sleep(600);

    // Fill form
    await evaluate(ws, `
      (() => {
        const setVal = (el, val) => {
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype :
                        el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype :
                        window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const nameInput = document.querySelector('#vendor-name-input');
        const catSelect = document.querySelector('#vendor-cat-select');
        const phoneInput = document.querySelector('#vendor-phone-input');
        const notesInput = document.querySelector('#vendor-notes-input');
        const quoteCheckbox = document.querySelector('#include-quote-toggle');

        if (nameInput) setVal(nameInput, 'Jaipur Heritage Florals');
        if (catSelect) setVal(catSelect, 'decor');
        if (phoneInput) setVal(phoneInput, '+91 91234 56789');
        if (notesInput) setVal(notesInput, 'Recommended by royal event planner. Specializes in exotic fresh orchids.');
        if (quoteCheckbox && !quoteCheckbox.checked) {
          quoteCheckbox.click();
        }
      })()
    `);
    await sleep(400);

    // Set quote values
    await evaluate(ws, `
      (() => {
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const amountInput = document.querySelector('#quote-rupees-input');
        const inclusionsInput = document.querySelector('#quote-inclusions-input');
        if (amountInput) setVal(amountInput, '85000');
        if (inclusionsInput) setVal(inclusionsInput, 'Entrance toran, Stage floral arches, Dining table centerpieces');
      })()
    `);
    await sleep(400);

    await captureScreenshot(ws, 'vendors_add_modal_filled.png');

    // Submit form by clicking submit button
    console.log('Submitting Add Vendor Form...');
    await evaluate(ws, `
      (() => {
        const submitBtn = document.querySelector('.vendor-modal-actions button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);
    await sleep(1500);

    // Verify vendor added and updated in DB
    const postAddCheck = await evaluate(ws, `
      (() => {
        const rows = Array.from(document.querySelectorAll('.vendors-table-view tbody tr'));
        const totalMetric = document.querySelector('.vendor-metric-card:nth-of-type(1) .vendor-metric-val')?.innerText.trim();
        const quotesMetric = document.querySelector('.vendor-metric-card:nth-of-type(4) .vendor-metric-val')?.innerText.trim();
        const newlyAdded = rows.some(r => r.innerText.includes('Jaipur Heritage Florals'));

        return {
          totalRows: rows.length,
          totalMetric,
          quotesMetric,
          newlyAddedFound: newlyAdded,
        };
      })()
    `);
    console.log('Post-Add Verification Check:', postAddCheck);

    console.log('All verification checks completed successfully!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    chromeProc.kill();
  }
}

run();
