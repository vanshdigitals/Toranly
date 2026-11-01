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
  await sleep(300);
}

async function run() {
  console.log('--- Launching Chrome for AI Plan Review Verification ---');
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=C:\\Users\\vansh\\Documents\\Toranly\\.tmp_chrome_profile',
    'http://127.0.0.1:5173/events/plan-ananya-rohan/plan',
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

    // 1. Initial Desktop Review View (Frame B)
    await setViewport(ws, 1440, 960);
    await sleep(1200);

    const initialReviewStats = await evaluate(ws, `(() => {
      const pageTitle = document.querySelector('.ai-plan-page-title')?.innerText.trim();
      const demoBadge = document.querySelector('.ai-plan-demo-badge')?.innerText.trim();
      const sections = Array.from(document.querySelectorAll('.ai-plan-section-title')).map(s => s.innerText.trim());
      const recItems = document.querySelectorAll('.ai-plan-recommendation-item').length;
      const selectedCount = document.querySelector('.ai-plan-selection-count')?.innerText.trim();
      const notice = document.querySelector('.ai-plan-notice-text')?.innerText.trim();
      const assumptions = document.querySelector('.ai-plan-assumptions-body')?.innerText.trim();

      return {
        pageTitle,
        demoBadge,
        sections,
        recItems,
        selectedCount,
        notice,
        hasAssumptions: !!assumptions
      };
    })()`);
    console.log('Review State (Frame B):', initialReviewStats);

    await captureScreenshot(ws, 'ai_plan_review_desktop_default.png');

    // 2. Test Accept Interaction: Accept "Book mehendi artist"
    console.log('--- Testing Accept Interaction on Task 1 ---');
    await evaluate(ws, `(() => {
      const firstAcceptBtn = document.querySelector('.ai-plan-btn-accept');
      if (firstAcceptBtn) firstAcceptBtn.click();
    })()`);
    await sleep(400);

    const afterAcceptStats = await evaluate(ws, `(() => {
      const selectedCount = document.querySelector('.ai-plan-selection-count')?.innerText.trim();
      const acceptedBadges = document.querySelectorAll('.ai-plan-status-badge.is-accepted').length;
      return { selectedCount, acceptedBadges };
    })()`);
    console.log('After accepting Book mehendi artist:', afterAcceptStats);

    // 3. Test Reject Interaction on Decor item
    console.log('--- Testing Reject Interaction on Decor 2 ---');
    await evaluate(ws, `(() => {
      const decorSection = Array.from(document.querySelectorAll('.ai-plan-section')).find(s => s.innerText.includes('Theme and decor'));
      const rejectBtns = decorSection?.querySelectorAll('.ai-plan-btn-reject');
      if (rejectBtns && rejectBtns.length > 0) {
        rejectBtns[rejectBtns.length - 1].click();
      }
    })()`);
    await sleep(400);

    // 4. Test Undo on previously rejected item
    console.log('--- Testing Undo on rejected Generator task ---');
    await evaluate(ws, `(() => {
      const undoBtn = document.querySelector('.ai-plan-btn-undo');
      if (undoBtn) undoBtn.click();
    })()`);
    await sleep(400);

    await captureScreenshot(ws, 'ai_plan_review_interactive_actions.png');

    // 5. Test Filter Dropdown (Filter to Menu)
    console.log('--- Testing Category Filter Dropdown (Menu) ---');
    await evaluate(ws, `(() => {
      // Trigger select option for menu
      const selectBtn = document.querySelector('#suggest-category-select button, #suggest-category-select [role="combobox"]');
      if (selectBtn) {
        selectBtn.click();
      }
    })()`);
    await sleep(300);

    await evaluate(ws, `(() => {
      const menuOption = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.innerText.includes('Menu'));
      if (menuOption) menuOption.click();
    })()`);
    await sleep(400);

    const filteredMenuStats = await evaluate(ws, `(() => {
      const visibleSections = Array.from(document.querySelectorAll('.ai-plan-section-title')).map(s => s.innerText.trim());
      const recItems = document.querySelectorAll('.ai-plan-recommendation-item').length;
      return { visibleSections, recItems };
    })()`);
    console.log('Filtered State (Menu):', filteredMenuStats);

    await captureScreenshot(ws, 'ai_plan_review_filtered_menu.png');

    // Switch back to Full plan
    await evaluate(ws, `(() => {
      const selectBtn = document.querySelector('#suggest-category-select button, #suggest-category-select [role="combobox"]');
      if (selectBtn) selectBtn.click();
    })()`);
    await sleep(300);
    await evaluate(ws, `(() => {
      const fullOption = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.innerText.includes('Full plan'));
      if (fullOption) fullOption.click();
    })()`);
    await sleep(400);

    // 6. Test Revise with Feedback Modal
    console.log('--- Testing Revise with Feedback Modal ---');
    await evaluate(ws, `(() => {
      const feedbackBtn = document.querySelector('.ai-plan-feedback-btn');
      if (feedbackBtn) feedbackBtn.click();
    })()`);
    await sleep(500);

    await captureScreenshot(ws, 'ai_plan_review_feedback_modal.png');

    // Close feedback modal
    await evaluate(ws, `(() => {
      const closeBtn = document.querySelector('.ai-plan-modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 7. Test Apply Selected (Demo Action)
    console.log('--- Testing Apply Selected Action ---');
    await evaluate(ws, `(() => {
      const applyBtn = document.querySelector('.ai-plan-apply-btn');
      if (applyBtn) applyBtn.click();
    })()`);
    await sleep(400);

    // 8. Test View Mode Controller: Generating State (Frame A)
    console.log('--- Testing Frame A (Generating State Simulation) ---');
    await evaluate(ws, `(() => {
      const genToggle = document.querySelector('.ai-plan-mode-btn:nth-child(3)');
      if (genToggle) genToggle.click();
    })()`);
    await sleep(600);

    const frameAStats = await evaluate(ws, `(() => {
      const cardTitle = document.querySelector('.ai-plan-generating-title')?.innerText.trim();
      const badge = document.querySelector('.ai-plan-processing-badge')?.innerText.trim();
      const steps = Array.from(document.querySelectorAll('.ai-plan-step-title')).map(s => s.innerText.trim());
      return { cardTitle, badge, steps };
    })()`);
    console.log('Frame A (Generating Simulation) State:', frameAStats);

    await captureScreenshot(ws, 'ai_plan_review_generating_frame_a.png');

    // Return to Review (Frame B)
    await evaluate(ws, `(() => {
      const skipBtn = document.querySelector('.ai-plan-skip-btn');
      if (skipBtn) skipBtn.click();
    })()`);
    await sleep(400);

    // 9. Tablet View (768 x 1024)
    console.log('--- Capturing Tablet View ---');
    await setViewport(ws, 768, 1024);
    await sleep(600);
    await captureScreenshot(ws, 'ai_plan_review_tablet.png');

    // 10. Mobile View (375 x 812)
    console.log('--- Capturing Mobile View ---');
    await setViewport(ws, 375, 812, true);
    await sleep(600);
    await captureScreenshot(ws, 'ai_plan_review_mobile.png');

    console.log('--- All AI Plan Review verifications completed successfully! ---');
    ws.close();
  } finally {
    proc.kill();
  }
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});

