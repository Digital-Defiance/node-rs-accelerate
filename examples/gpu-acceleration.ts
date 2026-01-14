/**
 * GPU Acceleration Example
 * 
 * This example demonstrates how to use Metal GPU acceleration for
 * Reed-Solomon encoding and decoding on Apple Silicon.
 * 
 * Run with: npx ts-node examples/gpu-acceleration.ts
 */

import {
  ReedSolomonEncoder,
  ReedSolomonDecoder,
  ShardInfo,
  isMetalAvailable,
  initMetal,
  shouldUseGPU,
  estimateMemoryUsage
} from '../src';

// Configuration for GPU-friendly workload
const K = 20;  // Data shards
const M = 10;  // Parity shards
const SHARD_SIZE = 256 * 1024;  // 256KB per shard (larger = better GPU utilization)

async function main() {
  console.log('=== Reed-Solomon GPU Acceleration Example ===\n');
  
  // Check GPU availability
  console.log('--- GPU Status ---');
  const metalAvailable = isMetalAvailable();
  console.log(`Metal available: ${metalAvailable}`);
  
  if (metalAvailable) {
    const initialized = initMetal();
    console.log(`Metal initialized: ${initialized}`);
  } else {
    console.log('Note: GPU acceleration not available, will use CPU optimizations');
  }
  
  // Configuration
  console.log('\n--- Configuration ---');
  console.log(`Data shards (K): ${K}`);
  console.log(`Parity shards (M): ${M}`);
  console.log(`Shard size: ${SHARD_SIZE / 1024} KB`);
  console.log(`Total data size: ${(K * SHARD_SIZE) / (1024 * 1024)} MB`);
  
  const config = {
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE
  };
  
  // Check if GPU would be used
  const wouldUseGPU = shouldUseGPU(config);
  console.log(`Would use GPU (auto): ${wouldUseGPU}`);
  
  // Estimate memory usage
  const memoryEstimate = estimateMemoryUsage(config);
  console.log(`Estimated memory: ${(memoryEstimate / (1024 * 1024)).toFixed(2)} MB`);
  
  // Create test data
  const dataSize = K * SHARD_SIZE;
  const originalData = new Uint8Array(dataSize);
  for (let i = 0; i < dataSize; i++) {
    originalData[i] = i % 256;
  }
  console.log(`\nCreated ${dataSize / (1024 * 1024)} MB of test data`);
  
  // --- CPU Encoding ---
  console.log('\n--- CPU Encoding (Accelerate + NEON) ---');
  const cpuEncoder = new ReedSolomonEncoder({
    ...config,
    useGPU: false  // Force CPU
  });
  
  const cpuStartEncode = performance.now();
  const cpuEncoded = cpuEncoder.encode(originalData);
  const cpuEncodeTime = performance.now() - cpuStartEncode;
  
  console.log(`CPU encoding time: ${cpuEncodeTime.toFixed(2)}ms`);
  console.log(`CPU throughput: ${(dataSize / cpuEncodeTime / 1000).toFixed(2)} MB/s`);
  
  // --- GPU Encoding ---
  if (metalAvailable) {
    console.log('\n--- GPU Encoding (Metal) ---');
    const gpuEncoder = new ReedSolomonEncoder({
      ...config,
      useGPU: true  // Force GPU
    });
    
    // Warm up GPU
    gpuEncoder.encode(originalData);
    
    const gpuStartEncode = performance.now();
    const gpuEncoded = gpuEncoder.encode(originalData);
    const gpuEncodeTime = performance.now() - gpuStartEncode;
    
    console.log(`GPU encoding time: ${gpuEncodeTime.toFixed(2)}ms`);
    console.log(`GPU throughput: ${(dataSize / gpuEncodeTime / 1000).toFixed(2)} MB/s`);
    
    // Compare
    const speedup = cpuEncodeTime / gpuEncodeTime;
    console.log(`\nGPU vs CPU speedup: ${speedup.toFixed(2)}x`);
    
    if (speedup < 1) {
      console.log('Note: CPU is faster for this configuration.');
      console.log('GPU benefits more from larger shard sizes or batch operations.');
    }
    
    // Verify GPU encoding produces same results
    let encodingMatch = true;
    for (let i = 0; i < cpuEncoded.parityShards.length; i++) {
      for (let j = 0; j < cpuEncoded.parityShards[i].length; j++) {
        if (cpuEncoded.parityShards[i][j] !== gpuEncoded.parityShards[i][j]) {
          encodingMatch = false;
          break;
        }
      }
    }
    console.log(`CPU/GPU encoding match: ${encodingMatch ? 'PASSED ✓' : 'FAILED ✗'}`);
  }
  
  // --- Batch Encoding (GPU Optimized) ---
  if (metalAvailable) {
    console.log('\n--- Batch Encoding (GPU Optimized) ---');
    
    const batchSize = 5;
    const blocks = Array(batchSize).fill(null).map(() => {
      const block = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) {
        block[i] = Math.floor(Math.random() * 256);
      }
      return block;
    });
    
    console.log(`Batch size: ${batchSize} blocks`);
    console.log(`Total data: ${(batchSize * dataSize) / (1024 * 1024)} MB`);
    
    const batchEncoder = new ReedSolomonEncoder({
      ...config,
      useGPU: true
    });
    
    // Warm up
    batchEncoder.batchEncode(blocks.slice(0, 1));
    
    const batchStart = performance.now();
    const batchEncoded = batchEncoder.batchEncode(blocks);
    const batchTime = performance.now() - batchStart;
    
    console.log(`Batch encoding time: ${batchTime.toFixed(2)}ms`);
    console.log(`Batch throughput: ${(batchSize * dataSize / batchTime / 1000).toFixed(2)} MB/s`);
    console.log(`Per-block time: ${(batchTime / batchSize).toFixed(2)}ms`);
    
    // Compare to individual encoding
    const individualStart = performance.now();
    for (const block of blocks) {
      batchEncoder.encode(block);
    }
    const individualTime = performance.now() - individualStart;
    
    console.log(`\nIndividual encoding time: ${individualTime.toFixed(2)}ms`);
    console.log(`Batch speedup: ${(individualTime / batchTime).toFixed(2)}x`);
  }
  
  // --- Decoding Comparison ---
  console.log('\n--- Decoding Comparison ---');
  
  // Prepare shards with some loss
  const lostIndices = [3, 7, 12, 18];  // Lose 4 shards
  const availableShards: ShardInfo[] = [];
  
  for (let i = 0; i < K; i++) {
    if (!lostIndices.includes(i)) {
      availableShards.push({
        index: i,
        data: cpuEncoded.dataShards[i],
        isData: true
      });
    }
  }
  
  for (let i = 0; i < M; i++) {
    if (!lostIndices.includes(K + i)) {
      availableShards.push({
        index: K + i,
        data: cpuEncoded.parityShards[i],
        isData: false
      });
    }
  }
  
  console.log(`Lost shards: ${lostIndices.join(', ')}`);
  console.log(`Available shards: ${availableShards.length}`);
  
  // CPU Decoding
  const cpuDecoder = new ReedSolomonDecoder({
    ...config,
    useGPU: false
  });
  
  const cpuStartDecode = performance.now();
  const cpuDecoded = cpuDecoder.decode(availableShards);
  const cpuDecodeTime = performance.now() - cpuStartDecode;
  
  console.log(`\nCPU decoding time: ${cpuDecodeTime.toFixed(2)}ms`);
  console.log(`CPU decode throughput: ${(dataSize / cpuDecodeTime / 1000).toFixed(2)} MB/s`);
  
  // Verify CPU decoding
  let cpuDecodeMatch = true;
  for (let i = 0; i < originalData.length; i++) {
    if (cpuDecoded[i] !== originalData[i]) {
      cpuDecodeMatch = false;
      break;
    }
  }
  console.log(`CPU decode verification: ${cpuDecodeMatch ? 'PASSED ✓' : 'FAILED ✗'}`);
  
  // GPU Decoding
  if (metalAvailable) {
    const gpuDecoder = new ReedSolomonDecoder({
      ...config,
      useGPU: true
    });
    
    // Warm up
    gpuDecoder.decode(availableShards);
    
    const gpuStartDecode = performance.now();
    const gpuDecoded = gpuDecoder.decode(availableShards);
    const gpuDecodeTime = performance.now() - gpuStartDecode;
    
    console.log(`\nGPU decoding time: ${gpuDecodeTime.toFixed(2)}ms`);
    console.log(`GPU decode throughput: ${(dataSize / gpuDecodeTime / 1000).toFixed(2)} MB/s`);
    
    // Verify GPU decoding
    let gpuDecodeMatch = true;
    for (let i = 0; i < originalData.length; i++) {
      if (gpuDecoded[i] !== originalData[i]) {
        gpuDecodeMatch = false;
        break;
      }
    }
    console.log(`GPU decode verification: ${gpuDecodeMatch ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    const decodeSpeedup = cpuDecodeTime / gpuDecodeTime;
    console.log(`\nGPU vs CPU decode speedup: ${decodeSpeedup.toFixed(2)}x`);
  }
  
  // --- Recommendations ---
  console.log('\n--- Recommendations ---');
  console.log('GPU acceleration is most beneficial when:');
  console.log('  • Shard size >= 100KB');
  console.log('  • Processing multiple blocks (batch encoding)');
  console.log('  • High throughput is more important than latency');
  console.log('\nCPU (Accelerate + NEON) is often faster for:');
  console.log('  • Small shard sizes (< 10KB)');
  console.log('  • Single block encoding');
  console.log('  • Low-latency requirements');
  console.log('\nThe library auto-detects the best backend by default.');
  
  console.log('\n=== GPU acceleration example completed ===');
}

main().catch(console.error);
