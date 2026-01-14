/**
 * Galois Field operations benchmarks
 * 
 * Benchmarks scalar vs vectorized operations
 * Benchmarks CPU vs GPU operations
 */

const { performance } = require('perf_hooks');

// Load native addon directly for GF operations
const addon = require('../build/Release/node_rs_accelerate.node');

/**
 * Format operations per second
 */
function formatOpsPerSecond(ops) {
  if (ops < 1000) return `${ops.toFixed(0)} ops/s`;
  if (ops < 1000000) return `${(ops / 1000).toFixed(2)} K ops/s`;
  if (ops < 1000000000) return `${(ops / 1000000).toFixed(2)} M ops/s`;
  return `${(ops / 1000000000).toFixed(2)} G ops/s`;
}

/**
 * Benchmark scalar GF(2^8) operations
 */
function benchmarkScalarGF8(iterations = 1000000) {
  console.log('Scalar GF(2^8) operations:');
  console.log('-'.repeat(60));
  
  // Initialize GF tables
  addon.initGF();
  
  // Generate random test data
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      a: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256)
    });
  }
  
  const results = {};
  
  // Benchmark addition (XOR)
  let start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    addon.gf_add8(a, b);
  }
  let end = performance.now();
  const addTime = end - start;
  const addOps = iterations / (addTime / 1000);
  results.add = { time: addTime, ops: addOps };
  console.log(`  Addition:       ${addTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(addOps)})`);
  
  // Benchmark multiplication
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    addon.gf_mul8(a, b);
  }
  end = performance.now();
  const mulTime = end - start;
  const mulOps = iterations / (mulTime / 1000);
  results.mul = { time: mulTime, ops: mulOps };
  console.log(`  Multiplication: ${mulTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(mulOps)})`);
  
  // Benchmark division
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    if (b !== 0) addon.gf_div8(a, b);
  }
  end = performance.now();
  const divTime = end - start;
  const divOps = iterations / (divTime / 1000);
  results.div = { time: divTime, ops: divOps };
  console.log(`  Division:       ${divTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(divOps)})`);
  
  // Benchmark inverse
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a } = testData[i % testData.length];
    if (a !== 0) addon.gf_inv8(a);
  }
  end = performance.now();
  const invTime = end - start;
  const invOps = iterations / (invTime / 1000);
  results.inv = { time: invTime, ops: invOps };
  console.log(`  Inverse:        ${invTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(invOps)})`);
  
  // Benchmark power
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a } = testData[i % testData.length];
    addon.gf_pow8(a, 3);
  }
  end = performance.now();
  const powTime = end - start;
  const powOps = iterations / (powTime / 1000);
  results.pow = { time: powTime, ops: powOps };
  console.log(`  Power:          ${powTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(powOps)})`);
  
  return results;
}

/**
 * Benchmark vectorized GF(2^8) operations
 */
function benchmarkVectorizedGF8() {
  console.log('\nVectorized GF(2^8) operations:');
  console.log('-'.repeat(60));
  
  // Initialize GF tables
  addon.initGF();
  
  // Test various vector sizes
  const sizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' },
    { size: 10 * 1024 * 1024, name: '10MB' }
  ];
  
  const results = [];
  
  for (const sizeSpec of sizes) {
    const size = sizeSpec.size;
    
    // Generate random vectors
    const a = new Uint8Array(size);
    const b = new Uint8Array(size);
    const out = new Uint8Array(size);
    
    for (let i = 0; i < size; i++) {
      a[i] = Math.floor(Math.random() * 256);
      b[i] = Math.floor(Math.random() * 256);
    }
    
    // Benchmark scalar vectorized multiplication
    let start = performance.now();
    addon.gf_mulVec8(a, b, out);
    let end = performance.now();
    const scalarTime = end - start;
    const scalarThroughput = size / (scalarTime / 1000);
    
    // Benchmark Accelerate-optimized multiplication
    start = performance.now();
    addon.gf_mulVec8Accelerated(a, b, out);
    end = performance.now();
    const accelerateTime = end - start;
    const accelerateThroughput = size / (accelerateTime / 1000);
    
    const speedup = scalarTime / accelerateTime;
    
    results.push({
      size: sizeSpec.name,
      scalar: { time: scalarTime, throughput: scalarThroughput },
      accelerate: { time: accelerateTime, throughput: accelerateThroughput },
      speedup
    });
    
    console.log(`  ${sizeSpec.name.padEnd(8)}: Scalar ${scalarTime.toFixed(2)}ms, Accelerate ${accelerateTime.toFixed(2)}ms (${speedup.toFixed(2)}x speedup)`);
  }
  
  return results;
}

/**
 * Benchmark scalar GF(2^16) operations
 */
function benchmarkScalarGF16(iterations = 1000000) {
  console.log('\nScalar GF(2^16) operations:');
  console.log('-'.repeat(60));
  
  // Initialize GF tables
  addon.initGF65536();
  
  // Generate random test data
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      a: Math.floor(Math.random() * 65536),
      b: Math.floor(Math.random() * 65536)
    });
  }
  
  const results = {};
  
  // Benchmark addition (XOR)
  let start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    addon.gf_add16(a, b);
  }
  let end = performance.now();
  const addTime = end - start;
  const addOps = iterations / (addTime / 1000);
  results.add = { time: addTime, ops: addOps };
  console.log(`  Addition:       ${addTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(addOps)})`);
  
  // Benchmark multiplication
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    addon.gf_mul16(a, b);
  }
  end = performance.now();
  const mulTime = end - start;
  const mulOps = iterations / (mulTime / 1000);
  results.mul = { time: mulTime, ops: mulOps };
  console.log(`  Multiplication: ${mulTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(mulOps)})`);
  
  // Benchmark division
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a, b } = testData[i % testData.length];
    if (b !== 0) addon.gf_div16(a, b);
  }
  end = performance.now();
  const divTime = end - start;
  const divOps = iterations / (divTime / 1000);
  results.div = { time: divTime, ops: divOps };
  console.log(`  Division:       ${divTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(divOps)})`);
  
  // Benchmark inverse
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a } = testData[i % testData.length];
    if (a !== 0) addon.gf_inv16(a);
  }
  end = performance.now();
  const invTime = end - start;
  const invOps = iterations / (invTime / 1000);
  results.inv = { time: invTime, ops: invOps };
  console.log(`  Inverse:        ${invTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(invOps)})`);
  
  // Benchmark power
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const { a } = testData[i % testData.length];
    addon.gf_pow16(a, 3);
  }
  end = performance.now();
  const powTime = end - start;
  const powOps = iterations / (powTime / 1000);
  results.pow = { time: powTime, ops: powOps };
  console.log(`  Power:          ${powTime.toFixed(2)}ms for ${iterations} ops (${formatOpsPerSecond(powOps)})`);
  
  return results;
}

/**
 * Benchmark vectorized GF(2^16) operations
 */
function benchmarkVectorizedGF16() {
  console.log('\nVectorized GF(2^16) operations:');
  console.log('-'.repeat(60));
  
  // Initialize GF tables
  addon.initGF65536();
  
  // Test various vector sizes
  const sizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' }
  ];
  
  const results = [];
  
  for (const sizeSpec of sizes) {
    const size = sizeSpec.size / 2; // uint16 is 2 bytes
    
    // Generate random vectors
    const a = new Uint16Array(size);
    const b = new Uint16Array(size);
    const out = new Uint16Array(size);
    
    for (let i = 0; i < size; i++) {
      a[i] = Math.floor(Math.random() * 65536);
      b[i] = Math.floor(Math.random() * 65536);
    }
    
    // Benchmark scalar vectorized multiplication
    let start = performance.now();
    addon.gf_mulVec16(a, b, out);
    let end = performance.now();
    const scalarTime = end - start;
    const scalarThroughput = (size * 2) / (scalarTime / 1000);
    
    // Benchmark Accelerate-optimized multiplication
    start = performance.now();
    addon.gf_mulVec16Accelerated(a, b, out);
    end = performance.now();
    const accelerateTime = end - start;
    const accelerateThroughput = (size * 2) / (accelerateTime / 1000);
    
    const speedup = scalarTime / accelerateTime;
    
    results.push({
      size: sizeSpec.name,
      scalar: { time: scalarTime, throughput: scalarThroughput },
      accelerate: { time: accelerateTime, throughput: accelerateThroughput },
      speedup
    });
    
    console.log(`  ${sizeSpec.name.padEnd(8)}: Scalar ${scalarTime.toFixed(2)}ms, Accelerate ${accelerateTime.toFixed(2)}ms (${speedup.toFixed(2)}x speedup)`);
  }
  
  return results;
}

/**
 * Run all GF operation benchmarks
 */
function runGFBenchmarks() {
  console.log('='.repeat(80));
  console.log('GALOIS FIELD OPERATIONS BENCHMARKS');
  console.log('='.repeat(80));
  console.log();
  
  const results = {
    scalarGF8: benchmarkScalarGF8(),
    vectorizedGF8: benchmarkVectorizedGF8(),
    scalarGF16: benchmarkScalarGF16(),
    vectorizedGF16: benchmarkVectorizedGF16()
  };
  
  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  
  // GF(2^8) scalar operations summary
  console.log('GF(2^8) scalar operations:');
  console.log(`  Fastest: Addition (${formatOpsPerSecond(results.scalarGF8.add.ops)})`);
  console.log(`  Slowest: ${results.scalarGF8.pow.ops < results.scalarGF8.div.ops ? 'Power' : 'Division'}`);
  
  // GF(2^8) vectorized speedup
  const avgSpeedupGF8 = results.vectorizedGF8.reduce((sum, r) => sum + r.speedup, 0) / results.vectorizedGF8.length;
  console.log();
  console.log(`GF(2^8) vectorized operations:`);
  console.log(`  Average Accelerate speedup: ${avgSpeedupGF8.toFixed(2)}x`);
  console.log(`  Best speedup: ${Math.max(...results.vectorizedGF8.map(r => r.speedup)).toFixed(2)}x`);
  
  // GF(2^16) scalar operations summary
  console.log();
  console.log('GF(2^16) scalar operations:');
  console.log(`  Fastest: Addition (${formatOpsPerSecond(results.scalarGF16.add.ops)})`);
  console.log(`  Slowest: ${results.scalarGF16.pow.ops < results.scalarGF16.div.ops ? 'Power' : 'Division'}`);
  
  // GF(2^16) vectorized speedup
  const avgSpeedupGF16 = results.vectorizedGF16.reduce((sum, r) => sum + r.speedup, 0) / results.vectorizedGF16.length;
  console.log();
  console.log(`GF(2^16) vectorized operations:`);
  console.log(`  Average Accelerate speedup: ${avgSpeedupGF16.toFixed(2)}x`);
  console.log(`  Best speedup: ${Math.max(...results.vectorizedGF16.map(r => r.speedup)).toFixed(2)}x`);
  
  return results;
}

// Run if called directly
if (require.main === module) {
  try {
    runGFBenchmarks();
  } catch (e) {
    console.error('Benchmark failed:', e);
    process.exit(1);
  }
}

module.exports = { 
  runGFBenchmarks,
  benchmarkScalarGF8,
  benchmarkVectorizedGF8,
  benchmarkScalarGF16,
  benchmarkVectorizedGF16
};
