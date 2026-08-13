const path = require('path');
const { injectMedia } = require('../src/injector/media-injector');

async function main() {
  const imagePath = process.argv[2] || path.join(__dirname, '../test-assets/sample.png');
  const textPrompt = process.argv[3] || "Testing Phase 3 Image Injection from Pocket Antigravity CLI!";

  console.log("=== Phase 3 Verification: Testing Image & File Injection ===");
  console.log(`Image Path: "${imagePath}"`);
  console.log(`Text Prompt: "${textPrompt}"`);

  const result = await injectMedia({
    imagePath: imagePath,
    text: textPrompt,
    targetTitle: 'Antigravity',
    processName: 'Antigravity IDE',
    focusDelayMs: 600,
    pasteDelayMs: 300,
    submitEnter: true
  });

  console.log("\nResult:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n✅ Phase 3 Image Injection completed for HWND: ${result.hwnd} (PID ${result.pid}).`);
  } else {
    console.error(`\n❌ Phase 3 Image Injection FAILED: ${result.error}`);
    process.exit(1);
  }
}

main();
