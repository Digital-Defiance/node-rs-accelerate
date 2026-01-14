/**
 * Example: Memory Leak Detection
 * 
 * This example demonstrates how to use the memory leak detection tools
 * and best practices for memory management.
 */

import { ReedSolomonEncoder } from '../src/encoder';
import { ReedSolomonDecoder } from '../src/decoder';

// Enable garbage collection if --expose-gc flag is used
declare global {
  var gc: (() => void) | undefined;
}

/**
 * Example 1: Proper memory management - no leaks
 */
function exampleProperUsage() {
  console.log('Example 1: Proper memory management');
  console.log('====================================\n');

  const iterations = 1000;
  const K = 5;
  const M = 3;
  const shardSize = 256;

  // Measure initial memory
  if (global.gc) global.gc();
  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    // Create encoder (will be garbage collected)
    const encoder = new ReedSolomonEncoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    // Create data
    const data = new Uint8Array(K * shardSize);
    data.fill(i % 256);

    // Encode
    const encoded = encoder.encode(data);

    // Create decoder (will be garbage collected)
    const decoder = new ReedSolomonDecoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    // Decode
    const shards = encoded.dataShards.map((data, idx) => ({
      index: idx,
      data,
      isData: true
    }));

    decoder.decode(shards);

    // Periodic GC to prevent accumulation
    if (i % 100 === 0 && global.gc) {
      global.gc();
    }
  }

  // Measure final memory
  if (global.gc) global.gc();
  const finalMemory = process.memoryUsage().heapUsed;

  const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);
  console.log(`Completed ${iterations} encode/decode cycles`);
  console.log(`Memory growth: ${memoryGrowth.toFixed(2)} MB`);
  console.log(`Expected: < 10 MB for proper memory management\n`);
}

/**
 * Example 2: Memory leak pattern - holding references
 * (This is what NOT to do)
 */
function exampleMemoryLeak() {
  console.log('Example 2: Memory leak pattern (what NOT to do)');
  console.log('================================================\n');

  const iterations = 100;
  const K = 5;
  const M = 3;
  const shardSize = 256;

  // BAD: Holding references prevents garbage collection
  const encoders: ReedSolomonEncoder[] = [];
  const results: any[] = [];

  // Measure initial memory
  if (global.gc) global.gc();
  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    const encoder = new ReedSolomonEncoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    const data = new Uint8Array(K * shardSize);
    const encoded = encoder.encode(data);

    // BAD: Storing references prevents cleanup
    encoders.push(encoder);
    results.push(encoded);
  }

  // Measure final memory
  if (global.gc) global.gc();
  const finalMemory = process.memoryUsage().heapUsed;

  const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);
  console.log(`Completed ${iterations} encode operations`);
  console.log(`Memory growth: ${memoryGrowth.toFixed(2)} MB`);
  console.log(`This is expected to be higher due to retained references`);
  console.log(`Stored ${encoders.length} encoders and ${results.length} results\n`);

  // Clean up
  encoders.length = 0;
  results.length = 0;
}

/**
 * Example 3: Monitoring memory usage in real-time
 */
function exampleMemoryMonitoring() {
  console.log('Example 3: Real-time memory monitoring');
  console.log('======================================\n');

  const K = 5;
  const M = 3;
  const shardSize = 256;
  const iterations = 500;
  const reportInterval = 100;

  console.log('Iteration | Heap Used (MB) | External (MB) | Total (MB)');
  console.log('----------|----------------|---------------|------------');

  for (let i = 0; i < iterations; i++) {
    const encoder = new ReedSolomonEncoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    const data = new Uint8Array(K * shardSize);
    const encoded = encoder.encode(data);

    const decoder = new ReedSolomonDecoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    const shards = encoded.dataShards.map((data, idx) => ({
      index: idx,
      data,
      isData: true
    }));

    decoder.decode(shards);

    // Report memory usage periodically
    if (i % reportInterval === 0) {
      const mem = process.memoryUsage();
      console.log(
        `${i.toString().padStart(9)} | ` +
        `${(mem.heapUsed / 1024 / 1024).toFixed(2).padStart(14)} | ` +
        `${(mem.external / 1024 / 1024).toFixed(2).padStart(13)} | ` +
        `${((mem.heapUsed + mem.external) / 1024 / 1024).toFixed(2).padStart(10)}`
      );

      if (global.gc) global.gc();
    }
  }

  console.log('\nMemory should remain relatively stable across iterations\n');
}

/**
 * Example 4: Detecting leaks with heap snapshots
 */
function exampleHeapSnapshots() {
  console.log('Example 4: Heap snapshot comparison');
  console.log('====================================\n');

  const v8 = require('v8');
  const fs = require('fs');

  // Take initial snapshot
  if (global.gc) global.gc();
  const snapshot1 = v8.writeHeapSnapshot('./heap-before.heapsnapshot');
  console.log(`Initial snapshot: ${snapshot1}`);

  // Perform operations
  const K = 5;
  const M = 3;
  const shardSize = 256;

  for (let i = 0; i < 100; i++) {
    const encoder = new ReedSolomonEncoder({
      dataShards: K,
      parityShards: M,
      shardSize
    });

    const data = new Uint8Array(K * shardSize);
    encoder.encode(data);
  }

  // Take final snapshot
  if (global.gc) global.gc();
  const snapshot2 = v8.writeHeapSnapshot('./heap-after.heapsnapshot');
  console.log(`Final snapshot: ${snapshot2}`);

  console.log('\nCompare snapshots in Chrome DevTools:');
  console.log('1. Open Chrome DevTools');
  console.log('2. Go to Memory tab');
  console.log('3. Load both snapshots');
  console.log('4. Compare to find retained objects\n');
}

/**
 * Main function
 */
function main() {
  console.log('Memory Leak Detection Examples');
  console.log('==============================\n');

  if (!global.gc) {
    console.log('⚠️  Warning: Run with --expose-gc flag for accurate results');
    console.log('   Example: node --expose-gc examples/memory-leak-detection.js\n');
  }

  // Run examples
  exampleProperUsage();
  exampleMemoryLeak();
  exampleMemoryMonitoring();
  
  // Uncomment to generate heap snapshots
  // exampleHeapSnapshots();

  console.log('Examples complete!');
  console.log('\nTo run memory leak detection tests:');
  console.log('  npm run test:memory          # Full test suite with ASan');
  console.log('  npm run test:memory:verbose  # Detailed ASan output');
  console.log('  npm run test:memory:heap     # Heap profiling');
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  exampleProperUsage,
  exampleMemoryLeak,
  exampleMemoryMonitoring,
  exampleHeapSnapshots
};
