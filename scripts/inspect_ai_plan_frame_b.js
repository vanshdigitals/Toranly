const fs = require('fs');
const html = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_ai_plan_review_reference.html', 'utf8');

const frameBIdx = html.indexOf('id="frame-b-container"');
const endIdx = html.indexOf('</main>');

console.log(html.substring(frameBIdx + 2500, endIdx));

