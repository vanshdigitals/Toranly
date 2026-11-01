const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9278;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
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
    const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    const evalFn = async (expr) => {
      const id = Math.floor(Math.random() * 100000);
      return new Promise((res, rej) => {
        const h = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === id) {
            ws.removeEventListener('message', h);
            if (d.error) rej(d.error);
            else res(d.result?.result?.value);
          }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
      });
    };

    // Select Wedding
    await evalFn(`(() => {
      const weddingNav = Array.from(document.querySelectorAll('.sched-function-nav-item'))
        .find(el => el.innerText.includes('Wedding'));
      if (weddingNav) {
        weddingNav.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    })()`);
    await sleep(600);

    const clickRes = await evalFn(`(() => {
      const btn = document.querySelector('.sched-conflict-fix-btn');
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return "DISPATCHED";
      }
      return "NOT_FOUND";
    })()`);
    console.log("Click result:", clickRes);

    await sleep(1000);

    const afterStats = await evalFn(`(() => {
      const badge = document.querySelector('.sched-status-badge')?.innerText;
      const conflictCard = document.querySelector('.sched-conflict-card') !== null;
      const items = Array.from(document.querySelectorAll('.sched-timeline-row')).map(r => ({
        time: r.querySelector('.sched-time-label')?.innerText,
        title: r.querySelector('.sched-item-title')?.innerText
      }));
      return { badge, conflictCard, items };
    })()`);
    console.log("After stats:", JSON.stringify(afterStats, null, 2));

    ws.close();
  } finally {
    proc.kill();
  }
}

run();
