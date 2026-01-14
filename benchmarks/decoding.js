/**
 * Decoding benchmarks
 * 
 * Benchmarks various erasure patterns
 * Measures reconstruction performance
 */

const { ReedSolomonEncoder, ReedSolomonDecoder, GaloisField } = require('../dist/index');
const { performance } = require('perf_hooks');

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
 * Format throughput to human-readable string
 */
function formatThroughput(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Generate erasure pattern
 * @param {number} totalShards - Total number of shards (K+M)
 * @param {number} availableShards - Number of shards to keep
 * @param {string} pattern - 'random', 'sequential', 'burst'
 */
function generateErasurePattern(totalShards, availableShards, pattern = 'random') {
  const indices = Array.from({ length: totalShards }, (_, i) => i);
  
  if (pattern === 'sequential') {
    // Keep first availableShards
    return indices.slice(0, availableShards);
  } else if (pattern === 'burst') {
    // Lose a burst in the middle
    const lostCount = totalShards - availableShards;
    const burstStart = Math.floor((totalShards - lostCount) / 2);
    return indices.filter((_, i) => i < burstStart || i >= burstStart + lostCount);
  } else {
    // Random erasure
    const shuffled = indices.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, availableShards).sort((a, b) => a - b);
  }
}

/**
 * Run a single decoding benchmark
 */
function benchmarkDecode(config, dataSize, erasurePattern, iterations = 10, useGPU = undefined) {
  const encoder = new ReedSolomonEncoder({
    ...config,
    useGPU
  });
  
  const decoder = new ReedSolomonDecoder({
    ...config,
    useGPU
  });
  
  // Generate random data
  const data = new Uint8Array(dataSize);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  
  // Encode
  const encoded = encoder.encode(data);
  
  // Create all shards array
  const allShards = [];
  for (let i = 0; i < config.dataShards; i++) {
    allShards.push({
      index: i,
      data: encoded.dataShards[i],
      isData: true
    });
  }
  for (let i = 0; i < config.parityShards; i++) {
    allShards.push({
      index: config.dataShards + i,
      data: encoded.parityShards[i],
      isData: false
    });
  }
  
  // Apply erasure pattern
  const availableShards = erasurePattern.map(idx => allShards[idx]);
  
  // Warmup
  decoder.decode(availableShards);
  
  // Benchmark
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    decoder.decode(availableShards);
    const end = performance.now();
    times.push(end - start);
  }
  
  // Calculate statistics
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = (dataSize / (avgTime / 1000));
  
  return {
    avgTime,
    minTime,
    maxTime,
    throughput,
    times
  };
}

/**
 * Run decoding benchmarks for various configurations
 */
function runDecodingBenchmarks() {
  console.log('='.repeat(80));
  console.log('DECODING BENCHMARKS');
  console.log('='.repeat(80));
  console.log();
  
  // Test configurations: (K, M)
  const configs = [
    { dataShards: 10, parityShards: 4, name: '(10,4)' },
    { dataShards: 20, parityShards: 10, name: '(20,10)' },
    { dataShards: 50, parityShards: 20, name: '(50,20)' },
    { dataShards: 100, parityShards: 50, name: '(100,50)' }
  ];
  
  // Test data sizes
  const dataSizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' }
  ];
  
  // Erasure patterns
  const erasurePatterns = [
    { name: 'No erasures', type: 'none' },
    { name: 'Random erasures', type: 'random' },
    { name: 'Sequential erasures', type: 'sequential' },
    { name: 'Burst erasures', type: 'burst' }
  ];
  
  const results = [];
  
  for (const configSpec of configs) {
    console.log(`\nConfiguration: ${configSpec.name} (K=${configSpec.dataShards}, M=${configSpec.parityShards})`);
    console.log('-'.repeat(80));
    
    for (const dataSpec of dataSizes) {
      const shardSize = Math.ceil(dataSpec.size / configSpec.dataShards);
      const actualDataSize = configSpec.dataShards * shardSize;
      
      const config = {
        dataShards: configSpec.dataShards,
        parityShards: configSpec.parityShards,
        shardSize,
        field: GaloisField.GF256
      };
      
      // Skip very large combinations
      if (configSpec.dataShards >= 100 && dataSpec.size >= 1024 * 1024) {
        console.log(`  ${dataSpec.name.padEnd(8)} - SKIPPED (too large)`);
        continue;
      }
      
      console.log(`  ${dataSpec.name.padEnd(8)} (${formatBytes(actualDataSize).padEnd(10)}):`);
      
      for (const patternSpec of erasurePatterns) {
        try {
          // Generate erasure pattern
          let erasurePattern;
          if (patternSpec.type === 'none') {
            // Use all data shards (no erasures)
            erasurePattern = Array.from({ length: configSpec.dataShards }, (_, i) => i);
          } else {
            // Use exactly K shards (maximum erasures)
            erasurePattern = generateErasurePattern(
              configSpec.dataShards + configSpec.parityShards,
              configSpec.dataShards,
              patternSpec.type
            );
          }
          
          // CPU benchmark
          const cpuResult = benchmarkDecode(config, actualDataSize, erasurePattern, 10, false);
          
          // GPU benchmark (only for larger data)
          let gpuResult = null;
          if (actualDataSize >= 100 * 1024) {
            try {
              gpuResult = benchmarkDecode(config, actualDataSize, erasurePattern, 10, true);
            } catch (e) {
              gpuResult = null;
            }
          }
          
          const result = {
            config: configSpec.name,
            dataSize: dataSpec.name,
            actualSize: actualDataSize,
            pattern: patternSpec.name,
            cpu: cpuResult,
            gpu: gpuResult
          };
          
          results.push(result);
          
          // Print results
          console.log(`    ${patternSpec.name.padEnd(20)}: CPU ${cpuResult.avgTime.toFixed(2)}ms, ${formatThroughput(cpuResult.throughput)}`);
          if (gpuResult) {
            const speedup = cpuResult.avgTime / gpuResult.avgTime;
            console.log(`    ${' '.repeat(20)}  GPU ${gpuResult.avgTime.toFixed(2)}ms, ${formatThroughput(gpuResult.throughput)} (${speedup.toFixed(2)}x)`);
          }
        } catch (e) {
          console.log(`    ${patternSpec.name.padEnd(20)}: ERROR - ${e.message}`);
        }
      }
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  
  // Find best CPU throughput
  const bestCPU = results.reduce((best, r) => 
    r.cpu.throughput > best.cpu.throughput ? r : best
  );
  console.log(`Best CPU throughput: ${formatThroughput(bestCPU.cpu.throughput)}`);
  console.log(`  Configuration: ${bestCPU.config}, Data size: ${bestCPU.dataSize}, Pattern: ${bestCPU.pattern}`);
  
  // Find best GPU throughput
  const gpuResults = results.filter(r => r.gpu !== null);
  if (gpuResults.length > 0) {
    const bestGPU = gpuResults.reduce((best, r) => 
      r.gpu.throughput > best.gpu.throughput ? r : best
    );
    console.log();
    console.log(`Best GPU throughput: ${formatThroughput(bestGPU.gpu.throughput)}`);
    console.log(`  Configuration: ${bestGPU.config}, Data size: ${bestGPU.dataSize}, Pattern: ${bestGPU.pattern}`);
    
    // Calculate average speedup
    const speedups = gpuResults.map(r => r.cpu.avgTime / r.gpu.avgTime);
    const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;
    console.log();
    console.log(`Average GPU speedup: ${avgSpeedup.toFixed(2)}x`);
  }
  
  // Analyze impact of erasure patterns
  console.log();
  console.log('Erasure pattern impact (relative to no erasures):');
  const patterns = ['Random erasures', 'Sequential erasures', 'Burst erasures'];
  for (const pattern of patterns) {
    const patternResults = results.filter(r => r.pattern === pattern);
    const noErasureResults = results.filter(r => 
      r.pattern === 'No erasures' && 
      patternResults.some(p => p.config === r.config && p.dataSize === r.dataSize)
    );
    
    if (patternResults.length > 0 && noErasureResults.length > 0) {
      const avgSlowdown = patternResults.reduce((sum, r) => {
        const baseline = noErasureResults.find(b => 
          b.config === r.config && b.dataSize === r.dataSize
        );
        if (baseline) {
          return sum + (r.cpu.avgTime / baseline.cpu.avgTime);
        }
        return sum;
      }, 0) / patternResults.length;
      
      console.log(`  ${pattern.padEnd(25)}: ${avgSlowdown.toFixed(2)}x slower`);
    }
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  try {
    runDecodingBenchmarks();
  } catch (e) {
    console.error('Benchmark failed:', e);
    process.exit(1);
  }
}

module.exports = { runDecodingBenchmarks, benchmarkDecode, generateErasurePattern };
