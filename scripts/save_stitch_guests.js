const fs = require('fs');

const step7033 = JSON.parse(fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/.system_generated/steps/7033/output.txt', 'utf8'));
if (step7033.html) {
  fs.writeFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_guests_reference.html', step7033.html);
  console.log('Saved stitch_guests_reference.html');
}

const step7035 = JSON.parse(fs.readFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/.system_generated/steps/7035/output.txt', 'utf8'));
if (step7035.image) {
  fs.writeFileSync('C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_guests_reference.png', Buffer.from(step7035.image, 'base64'));
  console.log('Saved stitch_guests_reference.png');
}

