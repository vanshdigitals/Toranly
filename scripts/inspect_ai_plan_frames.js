const fs = require('fs');
const html = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_ai_plan_review_reference.html', 'utf8');

const frameAIdx = html.indexOf('id="frame-a-container"');
const frameBIdx = html.indexOf('id="frame-b-container"');

console.log('--- FRAME A CONTENT ---');
console.log(html.substring(frameAIdx, frameBIdx));

console.log('--- FRAME B CONTENT START ---');
console.log(html.substring(frameBIdx, frameBIdx + 2500));

