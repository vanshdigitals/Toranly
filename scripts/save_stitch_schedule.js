const fs = require("fs");
const path = require("path");

const step6620 = JSON.parse(fs.readFileSync("C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/.system_generated/steps/6620/output.txt", "utf8"));
if (step6620.html) {
  fs.writeFileSync("C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_schedule_reference.html", step6620.html);
  console.log("Saved stitch_schedule_reference.html");
}

const step6622 = JSON.parse(fs.readFileSync("C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/.system_generated/steps/6622/output.txt", "utf8"));
if (step6622.image) {
  fs.writeFileSync("C:/Users/vansh/.gemini/antigravity/brain/1f8f0946-b364-42c3-a5a9-4fc905cd0f58/stitch_schedule_reference.png", Buffer.from(step6622.image, "base64"));
  console.log("Saved stitch_schedule_reference.png");
}

