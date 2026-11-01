const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9274;

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

    ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        console.log('[CONSOLE]', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
      }
      if (d.method === 'Runtime.exceptionThrown') {
        console.log('[EXCEPTION]', JSON.stringify(d.params.exceptionDetails));
      }
    };

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
      if (weddingNav) weddingNav.click();
    })()`);
    await sleep(500);

    // Click Shift button
    await evalFn(`(() => {
      const btn = document.querySelector('.sched-conflict-fix-btn');
      if (btn) btn.click();
    })()`);

    await sleep(1500);
    ws.close();
  } finally {
    proc.kill();
  }
}

run();

