const fs = require('fs');
const html = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_ai_plan_review_reference.html', 'utf8');

const menuIdx = html.indexOf('id="menu-heading"');
console.log(html.substring(menuIdx - 100, menuIdx + 2000));

