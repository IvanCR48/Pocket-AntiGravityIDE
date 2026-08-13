const { injectText } = require('../src/injector/clipboard-injector');

async function main() {
  const promptText = process.argv[2] || "Hello from Pocket Antigravity CLI! (Z-Order Topmost Test)";
  const method = process.argv[3] || "keybd_event";
  const focusShortcut = process.argv[4] || "Ctrl+L";

  console.log("=== Phase 2 Verification: Z-Order Topmost Force Bring to Front ===");
  console.log(`Prompt to inject: "${promptText}"`);
  console.log(`Using method: "${method}"`);
  console.log(`Using focus shortcut: "${focusShortcut}"`);

  const result = await injectText({
    text: promptText,
    targetTitle: 'Antigravity',
    processName: 'Antigravity IDE',
    focusDelayMs: 600,
    pasteDelayMs: 300,
    submitEnter: true,
    focusShortcut: focusShortcut,
    method: method
  });

  console.log("\nResult:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n✅ Injection complete into HWND: ${result.hwnd} (PID ${result.pid}).`);
  } else {
    console.error(`\n❌ Injection FAILED: ${result.error}`);
    process.exit(1);
  }
}

main();
