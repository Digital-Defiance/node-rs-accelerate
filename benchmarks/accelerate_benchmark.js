/**
 * Accelerate Framework optimization benchmarks
 * 
 * Compares scalar, NEON, and Accelerate-optimized implementations
 * for Reed-Solomon encoding operations.
 */

const { performance } = require('perf_hooks');

// Load native addon
const addon = require('../build/Release/node_rs_accelerate.node');

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format throughput
 */
function formatThroughput(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Run a benchmark and return statistics
 */
function benchmark(name, fn, iterations = 10) {
  // Warmup
  fn();
  
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { name, avg, min, max, times };
}

/**
 * Compare matrix-vector multiply implementations
 */
function benchmarkMatVecMul() {
  console.log('\n=== Matrix-Vector Multiply Benchmarks ===\n');
  console.log('(This is THE critical operation for Reed-Solomon encoding/decoding)\n');
  
  const configs = [
    { rows: 14, cols: 10, name: '(10,4) - 14x10' },
    { rows: 30, cols: 20, name: '(20,10) - 30x20' },
    { rows: 70, cols: 50, name: '(50,20) - 70x50' },
    { rows: 150, cols: 100, name: '(100,50) - 150x100' },
    { rows: 383, cols: 255, name: '(255,128) - 383x255' }
  ];
  
  // Initialize
  addon.initGF();
  if (addon.isNEONAvailable()) {
    addon.initNEON();
  }
  if (addon.isAccelerateAvailable()) {
    addon.initAccelerate();
  }
  
  console.log(`NEON: ${addon.isNEONAvailable() ? 'Available ✓' : 'Not available ✗'}`);
  console.log(`Accelerate: ${addon.isAccelerateAvailable() ? 'Available ✓' : 'Not available ✗'}`);
  console.log();
  
  for (const config of configs) {
    const { rows, cols, name } = config;
    
    // Generate random matrix and vector
    const matrix = new Uint8Array(rows * cols);
    const vec = new Uint8Array(cols);
    const out = new Uint8Array(rows);
    
    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < vec.length; i++) {
      vec[i] = Math.floor(Math.random() * 256);
    }
    
    console.log(`Config: ${name}`);
    
    // Scalar
    const scalar = benchmark('Scalar', () => {
      addon.matVecMulGF(matrix, vec, out, rows, cols, 8);
    });
    
    // NEON
    let neonResult = null;
    if (addon.isNEONAvailable()) {
      neonResult = benchmark('NEON', () => {
        addon.gf_matVecMul8_NEON(matrix, vec, out, rows, cols);
      });
    }
    
    // Accelerate
    let accelResult = null;
    if (addon.isAccelerateAvailable()) {
      accelResult = benchmark('Accelerate', () => {
        addon.gf_matVecMul_Accelerate(matrix, vec, out, rows, cols);
      });
    }
    
    console.log(`  Scalar:     ${scalar.avg.toFixed(4)}ms`);
    if (neonResult) {
      console.log(`  NEON:       ${neonResult.avg.toFixed(4)}ms - ${(scalar.avg / neonResult.avg).toFixed(2)}x`);
    }
    if (accelResult) {
      console.log(`  Accelerate: ${accelResult.avg.toFixed(4)}ms - ${(scalar.avg / accelResult.avg).toFixed(2)}x`);
    }
    console.log();
  }
}

/**
 * Compare XOR implementations
 */
function benchmarkXOR() {
  console.log('\n=== XOR (GF Addition) Benchmarks ===\n');
  
  const sizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' },
    { size: 10 * 1024 * 1024, name: '10MB' }
  ];
  
  // Initialize
  addon.initGF();
  if (addon.isNEONAvailable()) {
    addon.initNEON();
  }
  if (addon.isAccelerateAvailable()) {
    addon.initAccelerate();
  }
  
  for (const sizeSpec of sizes) {
    const size = sizeSpec.size;
    
    // Generate random data
    const a = new Uint8Array(size);
    const b = new Uint8Array(size);
    const out = new Uint8Array(size);
    
    for (let i = 0; i < size; i++) {
      a[i] = Math.floor(Math.random() * 256);
      b[i] = Math.floor(Math.random() * 256);
    }
    
    console.log(`Size: ${sizeSpec.name}`);
    
    // Scalar
    const scalar = benchmark('Scalar', () => {
      addon.gf_addVec8(a, b, out);
    });
    const scalarThroughput = size / (scalar.avg / 1000);
    
    // NEON
    let neonResult = null;
    let neonThroughput = 0;
    if (addon.isNEONAvailable()) {
      neonResult = benchmark('NEON', () => {
        addon.gf_addVec8_NEON(a, b, out);
      });
      neonThroughput = size / (neonResult.avg / 1000);
    }
    
    // Accelerate
    let accelResult = null;
    let accelThroughput = 0;
    if (addon.isAccelerateAvailable()) {
      accelResult = benchmark('Accelerate', () => {
        addon.gf_xor_Accelerate(a, b, out);
      });
      accelThroughput = size / (accelResult.avg / 1000);
    }
    
    console.log(`  Scalar:     ${scalar.avg.toFixed(3)}ms (${formatThroughput(scalarThroughput)})`);
    if (neonResult) {
      console.log(`  NEON:       ${neonResult.avg.toFixed(3)}ms (${formatThroughput(neonThroughput)}) - ${(scalar.avg / neonResult.avg).toFixed(2)}x`);
    }
    if (accelResult) {
      console.log(`  Accelerate: ${accelResult.avg.toFixed(3)}ms (${formatThroughput(accelThroughput)}) - ${(scalar.avg / accelResult.avg).toFixed(2)}x`);
    }
    console.log();
  }
}

/**
 * Compare multiply-accumulate implementations
 */
function benchmarkMulAccum() {
  console.log('\n=== Multiply-Accumulate Benchmarks ===\n');
  console.log('(Core operation for encoding: accum ^= data * constant)\n');
  
  const sizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' },
    { size: 10 * 1024 * 1024, name: '10MB' }
  ];
  
  // Initialize
  addon.initGF();
  if (addon.isNEONAvailable()) {
    addon.initNEON();
  }
  if (addon.isAccelerateAvailable()) {
    addon.initAccelerate();
  }
  
  const constant = 42;
  
  for (const sizeSpec of sizes) {
    const size = sizeSpec.size;
    
    // Generate random data
    const data = new Uint8Array(size);
    const accum = new Uint8Array(size);
    const constArr = new Uint8Array(size);
    
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
      constArr[i] = constant;
    }
    
    console.log(`Size: ${sizeSpec.name}`);
    
    // Scalar (using mulVec + addVec)
    const scalar = benchmark('Scalar', () => {
      const temp = new Uint8Array(size);
      addon.gf_mulVec8(data, constArr, temp);
      addon.gf_addVec8(accum, temp, accum);
    });
    const scalarThroughput = size / (scalar.avg / 1000);
    
    // Accelerate mulAccum
    let accelResult = null;
    let accelThroughput = 0;
    if (addon.isAccelerateAvailable()) {
      // Reset accum
      accum.fill(0);
      accelResult = benchmark('Accelerate', () => {
        addon.gf_mulAccum_Accelerate(data, constant, accum);
      });
      accelThroughput = size / (accelResult.avg / 1000);
    }
    
    console.log(`  Scalar:     ${scalar.avg.toFixed(3)}ms (${formatThroughput(scalarThroughput)})`);
    if (accelResult) {
      console.log(`  Accelerate: ${accelResult.avg.toFixed(3)}ms (${formatThroughput(accelThroughput)}) - ${(scalar.avg / accelResult.avg).toFixed(2)}x`);
    }
    console.log();
  }
}

/**
 * Compare full encoding implementations
 */
function benchmarkEncoding() {
  console.log('\n=== Full Encoding Benchmarks ===\n');
  console.log('(Complete Reed-Solomon encoding with various configurations)\n');
  
  const configs = [
    { k: 10, m: 4, shardSize: 1024, name: '(10,4) 1KB shards' },
    { k: 10, m: 4, shardSize: 64 * 1024, name: '(10,4) 64KB shards' },
    { k: 10, m: 4, shardSize: 1024 * 1024, name: '(10,4) 1MB shards' },
    { k: 20, m: 10, shardSize: 64 * 1024, name: '(20,10) 64KB shards' },
    { k: 50, m: 20, shardSize: 64 * 1024, name: '(50,20) 64KB shards' },
  ];
  
  // Initialize
  addon.initGF();
  if (addon.isNEONAvailable()) {
    addon.initNEON();
  }
  if (addon.isAccelerateAvailable()) {
    addon.initAccelerate();
  }
  
  for (const config of configs) {
    const { k, m, shardSize, name } = config;
    const totalShards = k + m;
    const dataSize = k * shardSize;
    
    // Generate random data
    const data = new Uint8Array(dataSize);
    for (let i = 0; i < dataSize; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    
    // Build encoding matrix
    const matrix = new Uint8Array(totalShards * k);
    addon.buildCauchyMatrix(matrix, totalShards, k, 8);
    
    console.log(`Config: ${name} (${formatBytes(dataSize)} total data)`);
    
    // Standard encode
    const standard = benchmark('Standard', () => {
      addon.encode(data, k, m, shardSize, matrix, 8);
    });
    const standardThroughput = dataSize / (standard.avg / 1000);
    
    // Accelerate encode
    let accelResult = null;
    let accelThroughput = 0;
    if (addon.isAccelerateAvailable()) {
      accelResult = benchmark('Accelerate', () => {
        addon.encodeAccelerate(data, matrix, k, m, shardSize);
      });
      accelThroughput = dataSize / (accelResult.avg / 1000);
    }
    
    // GPU encode (if available and beneficial)
    let gpuResult = null;
    let gpuThroughput = 0;
    if (addon.isMetalAvailable() && addon.shouldUseGPU(shardSize, k, m)) {
      try {
        addon.initMetal();
        gpuResult = benchmark('GPU', () => {
          addon.encodeGPU(data, k, m, shardSize, matrix, 8);
        });
        gpuThroughput = dataSize / (gpuResult.avg / 1000);
      } catch (e) {
        // GPU not available or failed
      }
    }
    
    console.log(`  Standard:   ${standard.avg.toFixed(3)}ms (${formatThroughput(standardThroughput)})`);
    if (accelResult) {
      console.log(`  Accelerate: ${accelResult.avg.toFixed(3)}ms (${formatThroughput(accelThroughput)}) - ${(standard.avg / accelResult.avg).toFixed(2)}x`);
    }
    if (gpuResult) {
      console.log(`  GPU:        ${gpuResult.avg.toFixed(3)}ms (${formatThroughput(gpuThroughput)}) - ${(standard.avg / gpuResult.avg).toFixed(2)}x`);
    }
    console.log();
  }
}

/**
 * Main benchmark runner
 */
function main() {
  console.log('='.repeat(70));
  console.log('ACCELERATE FRAMEWORK OPTIMIZATION BENCHMARKS');
  console.log('='.repeat(70));
  console.log();
  console.log('Platform:', process.platform, process.arch);
  console.log('Node.js:', process.version);
  console.log();
  
  try {
    benchmarkMatVecMul();
    benchmarkXOR();
    benchmarkMulAccum();
    benchmarkEncoding();
    
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log();
    console.log('Accelerate optimizations provide significant speedups by:');
    console.log('- Precomputing 256-entry multiplication tables (64KB total)');
    console.log('- Cache-optimized access patterns (process in 4KB blocks)');
    console.log('- NEON SIMD for XOR accumulation (64 bytes per iteration)');
    console.log('- Memory prefetching for large data operations');
    console.log();
    console.log('Key insight: Reed-Solomon encoding is table lookups + XORs,');
    console.log('both of which are extremely fast operations when optimized!');
    
  } catch (e) {
    console.error('Benchmark failed:', e);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, benchmarkMatVecMul, benchmarkXOR, benchmarkMulAccum, benchmarkEncoding };
