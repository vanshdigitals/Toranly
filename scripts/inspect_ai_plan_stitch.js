const fs = require('fs');
const html = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_ai_plan_review_reference.html', 'utf8');
console.log('HTML length:', html.length);

// Let's see main container and header
const mainIdx = html.indexOf('<main');
console.log('--- MAIN HEADER SNIPPET ---');
console.log(html.substring(mainIdx, mainIdx + 2000));

