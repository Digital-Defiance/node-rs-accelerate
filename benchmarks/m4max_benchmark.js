/**
 * M4 Max Extreme Optimization Benchmarks
 * 
 * Benchmarks for M4 Max-specific hardware optimizations:
 * - 4-Way and 8-Way Unrolled Multiply-Accumulate
 * - 4-Way XOR using veor3 + standard XOR
 * - Quad Multiply-Accumulate with 4-way XOR
 * - 16-Core Parallel Encoding
 * - Cache-Aligned Encoding
 * - Bandwidth-Optimized Encoding
 * - Huge Page Encoding
 */

const { performance } = require('perf_hooks');

let native;
try {
  native = require('../build/Release/node_rs_accelerate.node');
} catch (e) {
  console.error('Native module not found. Run npm run build first.');
  console.error(e.message);
  process.exit(1);
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatThroughput(bytes, ms) {
  const gbps = (bytes / (1024 * 1024 * 1024)) / (ms / 1000);
  return gbps.toFixed(2) + ' GB/s';
}

function formatSpeedup(baseline, optimized) {
  return (baseline / optimized).toFixed(2) + 'x';
}

function generateRandomData(size) {
  const data = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

function generateMatrix(dataShards, parityShards) {
  const totalShards = dataShards + parityShards;
  const matrix = Buffer.alloc(totalShards * dataShards);
  
  // Identity matrix for data shards
  for (let i = 0; i < dataShards; i++) {
    matrix[i * dataShards + i] = 1;
  }
  
  // Vandermonde-style matrix for parity shards
  for (let p = 0; p < parityShards; p++) {
    for (let d = 0; d < dataShards; d++) {
      // Simple coefficient generation (not cryptographically secure)
      matrix[(dataShards + p) * dataShards + d] = ((p + 1) * (d + 1) + p + d + 1) % 255 + 1;
    }
  }
  
  return matrix;
}

// ============================================================================
// Hardware Detection Benchmarks
// ============================================================================

function benchmarkHardwareDetection() {
  console.log('\n=== Hardware Detection ===\n');
  
  // Initialize M4 Max optimizations
  if (native.initM4Max) {
    native.initM4Max();
  }
  
  // Check SME availability
  if (native.isSMEAvailable) {
    console.log(`SME Available: ${native.isSMEAvailable()}`);
  }
  
  // Check M4 Max detection
  if (native.isM4Max) {
    console.log(`M4 Max Detected: ${native.isM4Max()}`);
  }
  
  // Get core counts
  if (native.getPerformanceCoreCount) {
    console.log(`Performance Cores: ${native.getPerformanceCoreCount()}`);
  }
  
  if (native.getEfficiencyCoreCount) {
    console.log(`Efficiency Cores: ${native.getEfficiencyCoreCount()}`);
  }
  
  // Benchmark memory bandwidth
  if (native.benchmarkMemoryBandwidth) {
    console.log('\nBenchmarking memory bandwidth...');
    const bandwidth = native.benchmarkMemoryBandwidth();
    console.log(`Measured Memory Bandwidth: ${bandwidth.toFixed(2)} GB/s`);
  }
}

// ============================================================================
// Multiply-Accumulate Benchmarks
// ============================================================================

function benchmarkMulAccum() {
  console.log('\n=== Multiply-Accumulate Benchmarks ===\n');
  
  const sizes = [
    64 * 1024,        // 64 KB
    256 * 1024,       // 256 KB
    1024 * 1024,      // 1 MB
    4 * 1024 * 1024,  // 4 MB
    16 * 1024 * 1024, // 16 MB
  ];
  
  const iterations = 100;
  
  for (const size of sizes) {
    const data = generateRandomData(size);
    const accum = Buffer.alloc(size);
    const coeff = 0x53; // Random non-zero coefficient
    
    console.log(`\nData size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    
    // Benchmark 4-Way Unrolled
    if (native.gf_mulAccum4Way) {
      accum.fill(0);
      const start4 = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_mulAccum4Way(data, coeff, accum);
      }
      const end4 = performance.now();
      const time4 = (end4 - start4) / iterations;
      console.log(`  4-Way Unrolled: ${time4.toFixed(3)} ms (${formatThroughput(size, time4)})`);
    }
    
    // Benchmark 8-Way Unrolled
    if (native.gf_mulAccum8Way) {
      accum.fill(0);
      const start8 = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_mulAccum8Way(data, coeff, accum);
      }
      const end8 = performance.now();
      const time8 = (end8 - start8) / iterations;
      console.log(`  8-Way Unrolled: ${time8.toFixed(3)} ms (${formatThroughput(size, time8)})`);
    }
    
    // Compare with standard SIMD mulAccum if available
    if (native.gf_mulAccumSIMD) {
      accum.fill(0);
      const startStd = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_mulAccumSIMD(data, coeff, accum);
      }
      const endStd = performance.now();
      const timeStd = (endStd - startStd) / iterations;
      console.log(`  Standard SIMD:  ${timeStd.toFixed(3)} ms (${formatThroughput(size, timeStd)})`);
    }
  }
}

// ============================================================================
// 4-Way XOR Benchmarks
// ============================================================================

function benchmarkXor4() {
  console.log('\n=== 4-Way XOR Benchmarks ===\n');
  
  const sizes = [
    64 * 1024,        // 64 KB
    256 * 1024,       // 256 KB
    1024 * 1024,      // 1 MB
    4 * 1024 * 1024,  // 4 MB
  ];
  
  const iterations = 100;
  
  for (const size of sizes) {
    const a = generateRandomData(size);
    const b = generateRandomData(size);
    const c = generateRandomData(size);
    const d = generateRandomData(size);
    const out = Buffer.alloc(size);
    
    console.log(`\nData size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    
    // Benchmark 4-Way XOR (veor3 + XOR)
    if (native.gf_xor4Vec) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_xor4Vec(a, b, c, d, out);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  4-Way XOR (veor3): ${time.toFixed(3)} ms (${formatThroughput(size * 4, time)})`);
    }
    
    // Benchmark standard 3 XORs
    const startStd = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < size; j++) {
        out[j] = a[j] ^ b[j] ^ c[j] ^ d[j];
      }
    }
    const endStd = performance.now();
    const timeStd = (endStd - startStd) / iterations;
    console.log(`  Standard 3 XORs:   ${timeStd.toFixed(3)} ms (${formatThroughput(size * 4, timeStd)})`);
  }
}

// ============================================================================
// Quad Multiply-Accumulate Benchmarks
// ============================================================================

function benchmarkQuadMulAccum() {
  console.log('\n=== Quad Multiply-Accumulate Benchmarks ===\n');
  
  const sizes = [
    64 * 1024,        // 64 KB
    256 * 1024,       // 256 KB
    1024 * 1024,      // 1 MB
    4 * 1024 * 1024,  // 4 MB
  ];
  
  const iterations = 50;
  
  for (const size of sizes) {
    const data1 = generateRandomData(size);
    const data2 = generateRandomData(size);
    const data3 = generateRandomData(size);
    const data4 = generateRandomData(size);
    const accum = Buffer.alloc(size);
    const coeffs = [0x53, 0x7A, 0xB2, 0xE1];
    
    console.log(`\nData size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    
    // Benchmark Quad MulAccum with 4-way XOR
    if (native.gf_mulAccum4_xor4) {
      accum.fill(0);
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_mulAccum4_xor4(
          data1, coeffs[0],
          data2, coeffs[1],
          data3, coeffs[2],
          data4, coeffs[3],
          accum
        );
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  Quad MulAccum (veor3): ${time.toFixed(3)} ms (${formatThroughput(size * 4, time)})`);
    }
    
    // Benchmark 4 separate mulAccum calls
    if (native.gf_mulAccum4Way) {
      accum.fill(0);
      const startSep = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.gf_mulAccum4Way(data1, coeffs[0], accum);
        native.gf_mulAccum4Way(data2, coeffs[1], accum);
        native.gf_mulAccum4Way(data3, coeffs[2], accum);
        native.gf_mulAccum4Way(data4, coeffs[3], accum);
      }
      const endSep = performance.now();
      const timeSep = (endSep - startSep) / iterations;
      console.log(`  4x Separate MulAccum:  ${timeSep.toFixed(3)} ms (${formatThroughput(size * 4, timeSep)})`);
    }
  }
}

// ============================================================================
// Encoding Strategy Benchmarks
// ============================================================================

function benchmarkEncodingStrategies() {
  console.log('\n=== Encoding Strategy Benchmarks ===\n');
  
  const configs = [
    { dataShards: 10, parityShards: 4, shardSize: 64 * 1024 },
    { dataShards: 10, parityShards: 4, shardSize: 256 * 1024 },
    { dataShards: 10, parityShards: 4, shardSize: 1024 * 1024 },
    { dataShards: 20, parityShards: 10, shardSize: 256 * 1024 },
    { dataShards: 20, parityShards: 10, shardSize: 1024 * 1024 },
    { dataShards: 50, parityShards: 20, shardSize: 256 * 1024 },
  ];
  
  const iterations = 20;
  
  for (const config of configs) {
    const { dataShards, parityShards, shardSize } = config;
    const totalDataSize = dataShards * shardSize;
    const data = generateRandomData(totalDataSize);
    const matrix = generateMatrix(dataShards, parityShards);
    
    console.log(`\nConfig: ${dataShards}+${parityShards}, shard=${(shardSize/1024).toFixed(0)}KB, total=${(totalDataSize/1024/1024).toFixed(2)}MB`);
    
    // Get optimal strategy
    if (native.getOptimalM4Strategy) {
      const strategy = native.getOptimalM4Strategy(shardSize, dataShards, parityShards);
      const strategyNames = ['16-Core', 'Cache-Aligned', 'Bandwidth-Optimized', 'Huge Page'];
      console.log(`  Recommended Strategy: ${strategyNames[strategy] || 'Unknown'}`);
    }
    
    // Benchmark 16-Core Encoding
    if (native.encode16Core) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encode16Core(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  16-Core:            ${time.toFixed(3)} ms (${formatThroughput(totalDataSize, time)})`);
    }
    
    // Benchmark Cache-Aligned Encoding
    if (native.encodeCacheAligned) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeCacheAligned(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  Cache-Aligned:      ${time.toFixed(3)} ms (${formatThroughput(totalDataSize, time)})`);
    }
    
    // Benchmark Bandwidth-Optimized Encoding
    if (native.encodeBandwidthOptimized) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeBandwidthOptimized(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  Bandwidth-Optimized: ${time.toFixed(3)} ms (${formatThroughput(totalDataSize, time)})`);
    }
    
    // Benchmark Huge Page Encoding (only for large shards)
    if (native.encodeHugePage && shardSize >= 1024 * 1024) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeHugePage(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  Huge Page:          ${time.toFixed(3)} ms (${formatThroughput(totalDataSize, time)})`);
    }
    
    // Compare with standard parallel encoding
    if (native.encodeParallel) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeParallel(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      console.log(`  Standard Parallel:  ${time.toFixed(3)} ms (${formatThroughput(totalDataSize, time)})`);
    }
  }
}

// ============================================================================
// Large File Encoding Benchmark
// ============================================================================

function benchmarkLargeFileEncoding() {
  console.log('\n=== Large File Encoding Benchmark ===\n');
  
  const fileSizes = [
    10 * 1024 * 1024,   // 10 MB
    50 * 1024 * 1024,   // 50 MB
    100 * 1024 * 1024,  // 100 MB
  ];
  
  const dataShards = 10;
  const parityShards = 4;
  const iterations = 5;
  
  for (const fileSize of fileSizes) {
    const shardSize = Math.ceil(fileSize / dataShards);
    const totalDataSize = dataShards * shardSize;
    
    console.log(`\nFile size: ${(fileSize / 1024 / 1024).toFixed(0)} MB (${dataShards}+${parityShards} shards)`);
    
    const data = generateRandomData(totalDataSize);
    const matrix = generateMatrix(dataShards, parityShards);
    
    // Benchmark best M4 Max strategy
    if (native.encodeBandwidthOptimized) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeBandwidthOptimized(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      const throughput = (totalDataSize / (1024 * 1024 * 1024)) / (time / 1000);
      console.log(`  M4 Max Optimized: ${time.toFixed(1)} ms (${throughput.toFixed(2)} GB/s)`);
    }
    
    // Compare with standard encoding
    if (native.encodeParallel) {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        native.encodeParallel(data, matrix, dataShards, parityShards, shardSize);
      }
      const end = performance.now();
      const time = (end - start) / iterations;
      const throughput = (totalDataSize / (1024 * 1024 * 1024)) / (time / 1000);
      console.log(`  Standard Parallel: ${time.toFixed(1)} ms (${throughput.toFixed(2)} GB/s)`);
    }
  }
}

// ============================================================================
// Summary Report
// ============================================================================

function generateSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('M4 MAX OPTIMIZATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nOptimizations Implemented:');
  console.log('  ✓ 4-Way Unrolled Multiply-Accumulate (256 bytes/iteration)');
  console.log('  ✓ 8-Way Unrolled Multiply-Accumulate (512 bytes/iteration)');
  console.log('  ✓ 4-Way XOR using veor3 + standard XOR');
  console.log('  ✓ Quad Multiply-Accumulate (4 data shards simultaneously)');
  console.log('  ✓ 16-Core Parallel Encoding (QOS_CLASS_USER_INTERACTIVE)');
  console.log('  ✓ Cache-Aligned Encoding (128-byte M4 cache lines)');
  console.log('  ✓ Bandwidth-Optimized Encoding (32KB chunks)');
  console.log('  ✓ Huge Page Encoding (2MB pages for multi-GB operations)');
  
  console.log('\nHardware Features Used:');
  console.log('  • ARM NEON SIMD (vld1q_u8, vst1q_u8, veorq_u8, vqtbl1q_u8)');
  console.log('  • ARM v8.2+ SHA3 extensions (veor3q_u8 for 3-way XOR)');
  console.log('  • Grand Central Dispatch (dispatch_apply)');
  console.log('  • QoS scheduling (QOS_CLASS_USER_INTERACTIVE)');
  console.log('  • Precomputed 64KB multiplication tables (L1 cache)');
  console.log('  • 128-byte cache line alignment');
  
  console.log('\nStrategy Selection:');
  console.log('  • Shard >= 2MB:  Huge Page encoding');
  console.log('  • Shard >= 256KB + 20+ data shards: Bandwidth-Optimized');
  console.log('  • Shard aligned to 128 bytes: Cache-Aligned');
  console.log('  • Default: 16-Core Parallel');
  
  console.log('\n' + '='.repeat(60));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('M4 Max Extreme Optimization Benchmarks');
  console.log('======================================\n');
  
  try {
    benchmarkHardwareDetection();
    benchmarkMulAccum();
    benchmarkXor4();
    benchmarkQuadMulAccum();
    benchmarkEncodingStrategies();
    benchmarkLargeFileEncoding();
    generateSummary();
  } catch (error) {
    console.error('Benchmark error:', error.message);
    console.error(error.stack);
  }
}

main();
