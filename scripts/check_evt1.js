const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9262;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:5173/events/evt-1/schedule'
  ]);

  await sleep(2000);

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  const res = await new Promise((resolve, reject) => {
    const id = 1;
    ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) resolve(data.result);
    });
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          new Promise((resolve) => {
            const req = indexedDB.open('toranly-db', 1);
            req.onsuccess = (e) => {
              const db = e.target.result;
              const tx = db.transaction('plans', 'readonly');
              const store = tx.objectStore('plans');
              const getReq = store.get('evt-1');
              getReq.onsuccess = () => resolve(getReq.result);
              getReq.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
          })
        `,
        awaitPromise: true,
        returnByValue: true
      }
    }));
  });

  console.log("Plan result for evt-1:", JSON.stringify(res.result ? res.result.value : null, null, 2));

  ws.close();
  chrome.kill();
}

run().catch(console.error);

