/**
 * Advanced SIMD Benchmark
 * 
 * Tests the performance of creative hardware utilization techniques:
 * 1. NEON vtbl - Hardware table lookup (16 lookups per instruction)
 * 2. ARM PMULL - Polynomial multiply for GF operations
 * 3. GCD Parallel Encoding - Multi-threaded parity computation
 * 4. Interleaved Processing - Better instruction-level parallelism
 */

const path = require('path');

// Load native module
let native;
try {
  native = require(path.join(__dirname, '..', 'build', 'Release', 'node_rs_accelerate.node'));
} catch (e) {
  console.error('Failed to load native module:', e.message);
  console.error('Run "npm run build" first');
  process.exit(1);
}

// Initialize all subsystems
native.initGF();
native.initNEON();
native.initAccelerate();
native.initSIMD();

console.log('='.repeat(70));
console.log('Advanced SIMD Benchmark');
console.log('='.repeat(70));
console.log();
console.log('Hardware Features:');
console.log(`  NEON Available: ${native.isNEONAvailable()}`);
console.log(`  Accelerate Available: ${native.isAccelerateAvailable()}`);
console.log(`  SIMD Available: ${native.isSIMDAvailable()}`);
console.log(`  Multi-Thread Available: ${native.isMultiThreadAvailable()}`);
console.log(`  Optimal Thread Count: ${native.getOptimalThreadCount()}`);
console.log();

// Benchmark helper
function benchmark(name, fn, iterations = 1000) {
  // Warmup
  for (let i = 0; i < 10; i++) fn();
  
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  
  const totalNs = Number(end - start);
  const avgNs = totalNs / iterations;
  const avgMs = avgNs / 1e6;
  
  return { name, avgNs, avgMs, iterations };
}

function formatThroughput(bytes, avgNs) {
  const bytesPerSec = (bytes / avgNs) * 1e9;
  if (bytesPerSec >= 1e9) {
    return `${(bytesPerSec / 1e9).toFixed(2)} GB/s`;
  } else if (bytesPerSec >= 1e6) {
    return `${(bytesPerSec / 1e6).toFixed(2)} MB/s`;
  } else {
    return `${(bytesPerSec / 1e3).toFixed(2)} KB/s`;
  }
}

// ============================================================================
// Benchmark 1: vtbl vs standard table lookup
// ============================================================================
console.log('-'.repeat(70));
console.log('Benchmark 1: Multiply by Constant (vtbl vs standard)');
console.log('-'.repeat(70));

const sizes = [1024, 10240, 65536, 1048576];
const constant = 0x53;

for (const size of sizes) {
  const a = new Uint8Array(size);
  for (let i = 0; i < size; i++) a[i] = i & 0xFF;
  
  const out1 = new Uint8Array(size);
  const out2 = new Uint8Array(size);
  
  // Standard NEON
  const neonResult = benchmark(`NEON ${size}B`, () => {
    native.gf_mulVecConstant8_NEON(a, constant, out1);
  }, size < 100000 ? 10000 : 1000);
  
  // vtbl-based
  const vtblResult = benchmark(`vtbl ${size}B`, () => {
    native.gf_mulVecConstant_vtbl(a, constant, out2);
  }, size < 100000 ? 10000 : 1000);
  
  // Verify correctness
  let correct = true;
  for (let i = 0; i < size; i++) {
    if (out1[i] !== out2[i]) {
      correct = false;
      break;
    }
  }
  
  const neonThroughput = formatThroughput(size, neonResult.avgNs);
  const vtblThroughput = formatThroughput(size, vtblResult.avgNs);
  const speedup = neonResult.avgNs / vtblResult.avgNs;
  
  console.log(`  ${(size/1024).toFixed(0).padStart(5)}KB: NEON ${neonThroughput.padStart(12)} | vtbl ${vtblThroughput.padStart(12)} | ${speedup.toFixed(2)}x ${correct ? '✓' : '✗'}`);
}

// ============================================================================
// Benchmark 2: pmull vs standard multiply
// ============================================================================
console.log();
console.log('-'.repeat(70));
console.log('Benchmark 2: Vector Multiply (pmull vs standard)');
console.log('-'.repeat(70));

for (const size of sizes) {
  const a = new Uint8Array(size);
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    a[i] = i & 0xFF;
    b[i] = (i * 7) & 0xFF;
  }
  
  const out1 = new Uint8Array(size);
  const out2 = new Uint8Array(size);
  
  // Standard NEON (has a bug for indices >= 8)
  const neonResult = benchmark(`NEON ${size}B`, () => {
    native.gf_mulVec8_NEON(a, b, out1);
  }, size < 100000 ? 5000 : 500);
  
  // pmull-based (correct implementation)
  const pmullResult = benchmark(`pmull ${size}B`, () => {
    native.gf_mulVec_pmull(a, b, out2);
  }, size < 100000 ? 5000 : 500);
  
  // Verify correctness against scalar
  let pmullCorrect = true;
  for (let i = 0; i < Math.min(size, 100); i++) {
    const expected = native.gf_mul8(a[i], b[i]);
    if (out2[i] !== expected) {
      pmullCorrect = false;
      break;
    }
  }
  
  const neonThroughput = formatThroughput(size, neonResult.avgNs);
  const pmullThroughput = formatThroughput(size, pmullResult.avgNs);
  const speedup = neonResult.avgNs / pmullResult.avgNs;
  
  console.log(`  ${(size/1024).toFixed(0).padStart(5)}KB: NEON ${neonThroughput.padStart(12)} | pmull ${pmullThroughput.padStart(12)} | ${speedup.toFixed(2)}x ${pmullCorrect ? '✓' : '✗'}`);
}

// ============================================================================
// Benchmark 3: Multiply-Accumulate (interleaved vs standard)
// ============================================================================
console.log();
console.log('-'.repeat(70));
console.log('Benchmark 3: Multiply-Accumulate (interleaved vs standard)');
console.log('-'.repeat(70));

for (const size of sizes) {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) data[i] = i & 0xFF;
  
  const accum1 = new Uint8Array(size);
  const accum2 = new Uint8Array(size);
  
  // Standard Accelerate
  const accelResult = benchmark(`Accelerate ${size}B`, () => {
    accum1.fill(0);
    native.gf_mulAccum_Accelerate(data, constant, accum1);
  }, size < 100000 ? 10000 : 1000);
  
  // Interleaved
  const interleavedResult = benchmark(`Interleaved ${size}B`, () => {
    accum2.fill(0);
    native.gf_mulAccum_interleaved(data, constant, accum2);
  }, size < 100000 ? 10000 : 1000);
  
  // Verify correctness
  let correct = true;
  for (let i = 0; i < size; i++) {
    if (accum1[i] !== accum2[i]) {
      correct = false;
      break;
    }
  }
  
  const accelThroughput = formatThroughput(size, accelResult.avgNs);
  const interleavedThroughput = formatThroughput(size, interleavedResult.avgNs);
  const speedup = accelResult.avgNs / interleavedResult.avgNs;
  
  console.log(`  ${(size/1024).toFixed(0).padStart(5)}KB: Accel ${accelThroughput.padStart(12)} | Interleaved ${interleavedThroughput.padStart(12)} | ${speedup.toFixed(2)}x ${correct ? '✓' : '✗'}`);
}

// ============================================================================
// Benchmark 4: Parallel Encoding (GCD vs single-threaded)
// ============================================================================
console.log();
console.log('-'.repeat(70));
console.log('Benchmark 4: Encoding (Parallel GCD vs Single-threaded)');
console.log('-'.repeat(70));

const configs = [
  { k: 10, m: 4, shardSize: 65536 },
  { k: 10, m: 4, shardSize: 1048576 },
  { k: 20, m: 10, shardSize: 65536 },
  { k: 50, m: 20, shardSize: 65536 },
];

for (const { k, m, shardSize } of configs) {
  // Create test data
  const dataSize = k * shardSize;
  const data = new Uint8Array(dataSize);
  for (let i = 0; i < dataSize; i++) data[i] = i & 0xFF;
  
  // Build encoding matrix
  const totalShards = k + m;
  const matrixSize = totalShards * k;
  const matrixBuffer = new Uint8Array(matrixSize);
  native.buildCauchyMatrix(matrixBuffer, totalShards, k, 8);
  
  // Single-threaded (Accelerate)
  const singleResult = benchmark(`Single (${k},${m}) ${shardSize/1024}KB`, () => {
    native.encodeAccelerate(data, matrixBuffer, k, m, shardSize);
  }, shardSize > 100000 ? 100 : 500);
  
  // Parallel (GCD)
  const parallelResult = benchmark(`Parallel (${k},${m}) ${shardSize/1024}KB`, () => {
    native.encodeParallel(data, matrixBuffer, k, m, shardSize);
  }, shardSize > 100000 ? 100 : 500);
  
  // Verify correctness
  const parity1 = native.encodeAccelerate(data, matrixBuffer, k, m, shardSize);
  const parity2 = native.encodeParallel(data, matrixBuffer, k, m, shardSize);
  
  let correct = true;
  for (let i = 0; i < parity1.length; i++) {
    if (parity1[i] !== parity2[i]) {
      correct = false;
      break;
    }
  }
  
  const singleThroughput = formatThroughput(dataSize, singleResult.avgNs);
  const parallelThroughput = formatThroughput(dataSize, parallelResult.avgNs);
  const speedup = singleResult.avgNs / parallelResult.avgNs;
  
  console.log(`  (${k},${m}) ${(shardSize/1024).toFixed(0).padStart(5)}KB: Single ${singleThroughput.padStart(12)} | Parallel ${parallelThroughput.padStart(12)} | ${speedup.toFixed(2)}x ${correct ? '✓' : '✗'}`);
}

// ============================================================================
// Summary
// ============================================================================
console.log();
console.log('='.repeat(70));
console.log('Summary');
console.log('='.repeat(70));
console.log();
console.log('Optimization Techniques:');
console.log('  1. vtbl: Hardware table lookup - 16 lookups per instruction');
console.log('  2. pmull: Polynomial multiply - native GF multiplication');
console.log('  3. Interleaved: Better ILP - process 4 streams simultaneously');
console.log('  4. GCD Parallel: Multi-threaded - parallelize parity computation');
console.log();
console.log('Key Insights:');
console.log('  - vtbl is most effective for multiply-by-constant operations');
console.log('  - pmull provides native polynomial multiply but needs reduction');
console.log('  - Interleaved processing hides memory latency');
console.log('  - GCD parallelism scales with parity shard count');
console.log();
