const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9276;

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

    const res = await evalFn(`(async () => {
      const req = indexedDB.open('toranly', 1);
      return new Promise((resolve) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('plans', 'readonly');
          const store = tx.objectStore('plans');
          const getReq = store.get('plan-ananya-rohan');
          getReq.onsuccess = () => {
            const p = getReq.result;
            resolve({
              hasPlan: !!p,
              budgetCategories: p.budgetCategories?.length,
              tasks: p.tasks?.length,
              status: p.status,
              createdAt: p.createdAt
            });
          };
        };
      });
    })()`);
    console.log("Plan in indexeddb:", res);

    ws.close();
  } finally {
    proc.kill();
  }
}

run();

