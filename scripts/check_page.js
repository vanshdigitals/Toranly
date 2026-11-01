const { spawn } = require('child_process');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9226;

async function check() {
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=C:\\Users\\vansh\\Documents\\Toranly\\.tmp_chrome_profile',
    'http://127.0.0.1:5173/events/plan-ananya-rohan',
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const resp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await resp.json();
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);

  await new Promise((resolve) => (ws.onopen = resolve));
  const result = await new Promise((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(e.data));
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression:
            'JSON.stringify({ url: window.location.href, text: document.body.innerText.substring(0, 600) })',
          returnByValue: true,
        },
      })
    );
  });

  console.log('RENDERED BODY TEXT:\n', JSON.parse(result.result.result.value).text);
  ws.close();
  proc.kill();
}

check().catch(console.error);
