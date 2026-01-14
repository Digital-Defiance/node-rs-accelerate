/**
 * Encoding benchmarks
 * 
 * Benchmarks various (K, M) configurations and data sizes
 * Measures CPU vs GPU performance
 */

const { ReedSolomonEncoder, GaloisField } = require('../dist/index');
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
 * Run a single encoding benchmark
 */
function benchmarkEncode(config, dataSize, iterations = 10, useGPU = undefined) {
  const encoder = new ReedSolomonEncoder({
    ...config,
    useGPU
  });
  
  // Generate random data
  const data = new Uint8Array(dataSize);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  
  // Warmup
  encoder.encode(data);
  
  // Benchmark
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    encoder.encode(data);
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
 * Run encoding benchmarks for various configurations
 */
function runEncodingBenchmarks() {
  console.log('='.repeat(80));
  console.log('ENCODING BENCHMARKS');
  console.log('='.repeat(80));
  console.log();
  
  // Test configurations: (K, M)
  const configs = [
    { dataShards: 10, parityShards: 4, name: '(10,4)' },
    { dataShards: 20, parityShards: 10, name: '(20,10)' },
    { dataShards: 50, parityShards: 20, name: '(50,20)' },
    { dataShards: 100, parityShards: 50, name: '(100,50)' },
    { dataShards: 255, parityShards: 128, name: '(255,128)' }
  ];
  
  // Test data sizes
  const dataSizes = [
    { size: 1024, name: '1KB' },
    { size: 10 * 1024, name: '10KB' },
    { size: 100 * 1024, name: '100KB' },
    { size: 1024 * 1024, name: '1MB' },
    { size: 10 * 1024 * 1024, name: '10MB' }
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
      
      // Skip very large combinations to keep benchmark time reasonable
      if (configSpec.dataShards >= 100 && dataSpec.size >= 10 * 1024 * 1024) {
        console.log(`  ${dataSpec.name.padEnd(8)} - SKIPPED (too large)`);
        continue;
      }
      
      try {
        // CPU benchmark
        const cpuResult = benchmarkEncode(config, actualDataSize, 10, false);
        
        // GPU benchmark (only for larger data)
        let gpuResult = null;
        if (actualDataSize >= 100 * 1024) {
          try {
            gpuResult = benchmarkEncode(config, actualDataSize, 10, true);
          } catch (e) {
            // GPU might not be available
            gpuResult = null;
          }
        }
        
        const result = {
          config: configSpec.name,
          dataSize: dataSpec.name,
          actualSize: actualDataSize,
          cpu: cpuResult,
          gpu: gpuResult
        };
        
        results.push(result);
        
        // Print results
        console.log(`  ${dataSpec.name.padEnd(8)} (${formatBytes(actualDataSize).padEnd(10)}):`);
        console.log(`    CPU: ${cpuResult.avgTime.toFixed(2)}ms avg, ${formatThroughput(cpuResult.throughput)}`);
        if (gpuResult) {
          const speedup = cpuResult.avgTime / gpuResult.avgTime;
          console.log(`    GPU: ${gpuResult.avgTime.toFixed(2)}ms avg, ${formatThroughput(gpuResult.throughput)} (${speedup.toFixed(2)}x speedup)`);
        }
      } catch (e) {
        console.log(`  ${dataSpec.name.padEnd(8)} - ERROR: ${e.message}`);
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
  console.log(`  Configuration: ${bestCPU.config}, Data size: ${bestCPU.dataSize}`);
  
  // Find best GPU throughput
  const gpuResults = results.filter(r => r.gpu !== null);
  if (gpuResults.length > 0) {
    const bestGPU = gpuResults.reduce((best, r) => 
      r.gpu.throughput > best.gpu.throughput ? r : best
    );
    console.log();
    console.log(`Best GPU throughput: ${formatThroughput(bestGPU.gpu.throughput)}`);
    console.log(`  Configuration: ${bestGPU.config}, Data size: ${bestGPU.dataSize}`);
    
    // Calculate average speedup
    const speedups = gpuResults.map(r => r.cpu.avgTime / r.gpu.avgTime);
    const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;
    console.log();
    console.log(`Average GPU speedup: ${avgSpeedup.toFixed(2)}x`);
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  try {
    runEncodingBenchmarks();
  } catch (e) {
    console.error('Benchmark failed:', e);
    process.exit(1);
  }
}

module.exports = { runEncodingBenchmarks, benchmarkEncode };
