# Performance Guide

This guide covers optimization strategies, CPU vs GPU decision criteria, and memory usage patterns for @digitaldefiance/node-rs-accelerate.

## Table of Contents

- [Performance Overview](#performance-overview)
- [CPU vs GPU Decision Criteria](#cpu-vs-gpu-decision-criteria)
- [Optimization Guidelines](#optimization-guidelines)
- [Memory Usage Patterns](#memory-usage-patterns)
- [Configuration Tuning](#configuration-tuning)
- [Benchmarking Your Workload](#benchmarking-your-workload)

---

## Performance Overview

### Achieved Throughput

| Configuration | Shard Size | Throughput | Speedup vs JS |
|--------------|------------|------------|---------------|
| (10,4) | 64KB | 17.4 GB/s | 97x |
| (10,4) | 1MB | 30.3 GB/s | 167x |
| (20,10) | 64KB | 15.5 GB/s | 218x |
| (50,20) | 64KB | 12.9 GB/s | 358x |

### Key Performance Factors

1. **Shard Size**: Larger shards = better throughput (up to memory bandwidth limits)
2. **Configuration (K, M)**: More shards = more computation per byte
3. **Hardware Backend**: CPU SIMD vs GPU compute
4. **Memory Access Patterns**: Cache-friendly access is critical

---

## CPU vs GPU Decision Criteria

### When CPU is Faster

The CPU (Accelerate + NEON) typically outperforms GPU for:

- **Small shard sizes** (< 10KB)
- **Single block encoding**
- **Low-latency requirements**
- **Small configurations** (K+M < 50)

**Why?** GPU has overhead for:
- Data transfer to/from GPU memory
- Kernel launch latency
- Synchronization

### When GPU is Faster

GPU (Metal) excels at:

- **Large shard sizes** (> 100KB)
- **Batch encoding** (multiple blocks)
- **High throughput requirements**
- **Large configurations** (K+M > 100)

**Why?** GPU benefits from:
- Massive parallelism (thousands of threads)
- High memory bandwidth
- Amortized overhead across large operations

### Auto-Detection

The library auto-detects the best backend:

```typescript
// Let the library decide
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024
});

// Check what would be used
import { shouldUseGPU } from '@digitaldefiance/node-rs-accelerate';
console.log('Would use GPU:', shouldUseGPU(config));
```

### Manual Override

Force a specific backend when you know your workload:

```typescript
// Force CPU (for latency-sensitive operations)
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  useGPU: false
});

// Force GPU (for batch operations)
const encoder = new ReedSolomonEncoder({
  dataShards: 100,
  parityShards: 50,
  shardSize: 1024 * 1024,
  useGPU: true
});
```

### GPU Threshold

Customize the auto-detection threshold:

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 50 * 1024,
  gpuThreshold: 100 * 1024  // Use GPU only for shards >= 100KB
});
```

---

## Optimization Guidelines

### 1. Choose Appropriate Shard Size

**Recommendation:** 64KB - 1MB per shard

| Shard Size | Characteristics |
|------------|-----------------|
| < 1KB | High overhead, poor throughput |
| 1KB - 10KB | CPU-optimal, low latency |
| 10KB - 100KB | Good balance |
| 100KB - 1MB | High throughput, GPU-friendly |
| > 1MB | Memory-bound, diminishing returns |

```typescript
// For high throughput
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 256 * 1024  // 256KB
});

// For low latency
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 4 * 1024  // 4KB
});
```

### 2. Use Batch Encoding for Multiple Blocks

When encoding multiple blocks, use `batchEncode()`:

```typescript
// Inefficient: individual encoding
for (const block of blocks) {
  results.push(encoder.encode(block));
}

// Efficient: batch encoding
const results = encoder.batchEncode(blocks);
```

**Speedup:** 2-5x for batch sizes > 5

### 3. Reuse Encoder/Decoder Instances

Creating encoder/decoder instances has overhead (matrix construction, GF table initialization). Reuse them:

```typescript
// Bad: create new encoder for each operation
function encodeData(data: Uint8Array) {
  const encoder = new ReedSolomonEncoder(config);  // Overhead!
  return encoder.encode(data);
}

// Good: reuse encoder
const encoder = new ReedSolomonEncoder(config);
function encodeData(data: Uint8Array) {
  return encoder.encode(data);
}
```

### 4. Use Streaming for Large Files

For files larger than available memory, use streaming:

```typescript
import { pipeline } from 'stream/promises';

await pipeline(
  createReadStream('large-file.dat'),
  encoder.encodeStream(),
  // Process encoded chunks
);
```

**Benefits:**
- Constant memory usage regardless of file size
- Automatic backpressure handling
- Can process files larger than RAM

### 5. Disable Unnecessary Features

Disable features you don't need:

```typescript
// Minimal configuration (fastest)
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024
  // No compression, no hash validation
});

// With features (slower but more robust)
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024,
  compression: { enabled: true, level: 6 },  // Adds latency
  enableHashValidation: true  // Adds ~10% overhead
});
```

### 6. Choose the Right Matrix Type

| Matrix Type | Characteristics |
|-------------|-----------------|
| Vandermonde | Simpler, slightly faster construction |
| Cauchy | Better numerical properties, avoids edge cases |

For most use cases, Vandermonde (default) is fine. Use Cauchy for:
- Very large configurations (K+M > 200)
- Interoperability with systems using Cauchy matrices

---

## Memory Usage Patterns

### Memory Estimation

```typescript
import { estimateMemoryUsage } from '@digitaldefiance/node-rs-accelerate';

const config = {
  dataShards: 100,
  parityShards: 50,
  shardSize: 1024 * 1024  // 1MB
};

const bytes = estimateMemoryUsage(config);
console.log(`Estimated memory: ${bytes / (1024 * 1024)} MB`);
// Output: Estimated memory: ~151 MB
```

### Memory Components

| Component | Size | Notes |
|-----------|------|-------|
| Data shards | K × shardSize | Input data |
| Parity shards | M × shardSize | Generated parity |
| Encoding matrix | (K+M) × K bytes | Cached |
| GF lookup tables | ~1MB | Shared across instances |
| Working buffers | ~shardSize | Temporary |

### Memory Optimization Strategies

#### 1. Process in Chunks

For very large files, process in chunks:

```typescript
const CHUNK_SIZE = 100 * 1024 * 1024;  // 100MB chunks

async function encodeFile(filePath: string) {
  const fileSize = fs.statSync(filePath).size;
  const fd = fs.openSync(filePath, 'r');
  
  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    const chunk = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize - offset));
    fs.readSync(fd, chunk, 0, chunk.length, offset);
    
    const encoded = encoder.encode(new Uint8Array(chunk));
    // Process encoded chunk...
  }
  
  fs.closeSync(fd);
}
```

#### 2. Use Streaming API

The streaming API maintains constant memory:

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024
});

// Memory usage: ~(K+M) × shardSize regardless of file size
const stream = encoder.encodeStream();
```

#### 3. Release References

For long-running processes, release references when done:

```typescript
let encoded = encoder.encode(data);
// Process encoded data...

// Release memory
encoded = null;
```

### Memory Limits

| Configuration | Max Practical Size | Notes |
|--------------|-------------------|-------|
| (10, 4) | ~10GB per block | Limited by Node.js heap |
| (100, 50) | ~1GB per block | Matrix operations scale |
| (255, 128) | ~100MB per block | GF(2^8) maximum |

---

## Configuration Tuning

### For Maximum Throughput

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024 * 1024,  // Large shards
  useGPU: true,            // GPU for large operations
  matrixType: MatrixType.Vandermonde
});

// Use batch encoding
const results = encoder.batchEncode(blocks);
```

### For Minimum Latency

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 4 * 1024,  // Small shards
  useGPU: false,        // CPU is faster for small operations
  matrixType: MatrixType.Vandermonde
});
```

### For Maximum Fault Tolerance

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 10,     // 100% overhead, can lose 10 shards
  shardSize: 64 * 1024,
  enableHashValidation: true
});
```

### For Storage Efficiency

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 20,
  parityShards: 4,      // 20% overhead
  shardSize: 64 * 1024,
  compression: {
    enabled: true,
    level: 9,           // Maximum compression
    algorithm: 'brotli' // Best compression ratio
  }
});
```

---

## Benchmarking Your Workload

### Running Built-in Benchmarks

```bash
# Full benchmark suite
yarn benchmark

# Individual benchmarks
node benchmarks/encoding.js
node benchmarks/decoding.js
node benchmarks/gf_operations.js
node benchmarks/simd_benchmark.js
```

### Custom Benchmarking

```typescript
import { ReedSolomonEncoder } from '@digitaldefiance/node-rs-accelerate';

const config = {
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024
};

const encoder = new ReedSolomonEncoder(config);
const data = new Uint8Array(config.dataShards * config.shardSize);

// Warm up
encoder.encode(data);

// Benchmark
const iterations = 100;
const start = performance.now();

for (let i = 0; i < iterations; i++) {
  encoder.encode(data);
}

const elapsed = performance.now() - start;
const throughput = (data.length * iterations) / elapsed / 1000;

console.log(`Throughput: ${throughput.toFixed(2)} MB/s`);
console.log(`Latency: ${(elapsed / iterations).toFixed(2)} ms`);
```

### Profiling Tips

1. **Use Node.js profiler:**
   ```bash
   node --prof benchmarks/encoding.js
   node --prof-process isolate-*.log > profile.txt
   ```

2. **Use Instruments (macOS):**
   - Profile CPU usage
   - Check for cache misses
   - Monitor memory allocation

3. **Compare configurations:**
   ```typescript
   const configs = [
     { dataShards: 10, parityShards: 4, shardSize: 1024 },
     { dataShards: 10, parityShards: 4, shardSize: 64 * 1024 },
     { dataShards: 10, parityShards: 4, shardSize: 1024 * 1024 },
   ];
   
   for (const config of configs) {
     // Benchmark each configuration
   }
   ```

---

## Summary

| Goal | Recommendation |
|------|----------------|
| Maximum throughput | Large shards (256KB-1MB), batch encoding, GPU |
| Minimum latency | Small shards (4KB), CPU, no compression |
| Memory efficiency | Streaming API, process in chunks |
| Fault tolerance | Higher M, hash validation |
| Storage efficiency | Higher K, compression enabled |

The library is designed to auto-optimize for most workloads. Start with defaults and tune based on your specific requirements.
