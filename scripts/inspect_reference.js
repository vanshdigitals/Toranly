const fs = require("fs");
const html = fs.readFileSync("C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_schedule_reference.html", "utf8");

const vidaaiIdx = html.indexOf('Vidaai (14:00)');
if (vidaaiIdx !== -1) {
  console.log("=== AFTER VIDAAI (5000 chars) ===");
  console.log(html.slice(vidaaiIdx, vidaaiIdx + 5000));
}
