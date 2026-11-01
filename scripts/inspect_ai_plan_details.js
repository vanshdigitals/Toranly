const fs = require('fs');
const html = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_ai_plan_review_reference.html', 'utf8');

// Toolbar snippet
const tbIdx = html.indexOf('aria-label="Plan controls"');
console.log('--- TOOLBAR SNIPPET ---');
console.log(html.substring(tbIdx, tbIdx + 2000));

// Frame A snippet (Generating state)
const frameAIdx = html.indexOf('id="frame-a"');
if (frameAIdx !== -1) {
  console.log('--- FRAME A (GENERATING) SNIPPET ---');
  console.log(html.substring(frameAIdx, frameAIdx + 2000));
}

// Frame B snippet (Review state)
const frameBIdx = html.indexOf('id="frame-b"');
if (frameBIdx !== -1) {
  console.log('--- FRAME B (REVIEW) SNIPPET ---');
  console.log(html.substring(frameBIdx, frameBIdx + 2000));
}

// Bottom bar snippet
const barIdx = html.indexOf('id="sticky-action-bar"');
if (barIdx !== -1) {
  console.log('--- STICKY BOTTOM BAR SNIPPET ---');
  console.log(html.substring(barIdx - 50, barIdx + 2000));
} else {
  const fixedIdx = html.indexOf('fixed bottom-0');
  console.log('--- FIXED BOTTOM SNIPPET ---');
  console.log(html.substring(fixedIdx - 50, fixedIdx + 2000));
}

