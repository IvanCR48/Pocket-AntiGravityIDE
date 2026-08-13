const { getChatState } = require('../src/injector/check-chat-state');

async function test() {
  console.log('Testing sub-millisecond persistent C# worker speed...');
  
  // Warmup call
  await getChatState();

  const start = Date.now();
  const state = await getChatState();
  const duration = Date.now() - start;

  console.log('Result:', JSON.stringify(state));
  console.log(`Latency: ${duration} ms`);
  process.exit(0);
}

test();
