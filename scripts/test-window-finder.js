const { focusWindow } = require('../src/injector/window-finder');

async function main() {
  console.log("=== Phase 1 Verification: Testing Window Targeting & Focus ===");
  console.log("Searching for process 'Antigravity IDE' or title 'Antigravity'...");

  const result = await focusWindow({
    targetTitle: 'Antigravity',
    processName: 'Antigravity IDE'
  });

  console.log("Result:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✅ Phase 1 SUCCESS! Window focused reliably. PID: ${result.pid}, HWND: ${result.hwnd}, Title: "${result.title}"`);
  } else {
    console.error(`❌ Phase 1 FAILED: ${result.error}`);
    process.exit(1);
  }
}

main();
