# @digitaldefiance/node-rs-accelerate

High-performance Reed-Solomon error correction library optimized for Apple Silicon (M1/M2/M3/M4).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-macOS%20ARM64-blue)](https://www.apple.com/mac/)

## Overview

Reed-Solomon codes are a family of error-correcting codes that enable data recovery from corruption or loss. They are widely used in:

- **Distributed storage systems** (RAID, cloud storage)
- **Communications** (satellite, deep space)
- **QR codes and barcodes**
- **Blockchain and cryptocurrency** (data availability)

This library provides systematic Reed-Solomon encoding and erasure decoding with hardware acceleration through:

- **Apple Accelerate framework** for CPU SIMD operations
- **Metal Performance Shaders** for GPU acceleration
- **ARM NEON** with advanced instructions (vtbl, veor3)
- **Grand Central Dispatch** for parallel processing

## Features

- **Blazing fast**: Up to 30 GB/s encoding throughput on Apple Silicon
- **Hardware accelerated**: Leverages Accelerate, Metal, and NEON
- **Systematic encoding**: Original data appears unchanged in output
- **Flexible field sizes**: GF(2^8) for up to 256 shards, GF(2^16) for up to 65536 shards
- **Multiple matrix types**: Vandermonde and Cauchy matrix constructions
- **Streaming API**: Process large files without loading into memory
- **Optional compression**: gzip, deflate, or brotli before encoding
- **Hash validation**: SHA-256 integrity checking
- **Full TypeScript support**: Complete type definitions and JSDoc

## Requirements

- **Node.js** >= 16.0.0
- **macOS** >= 11.0 (Big Sur)
- **Apple Silicon** (M1/M2/M3/M4) processor
- **Xcode Command Line Tools** (for native compilation)

## Installation

```bash
# Using yarn
yarn add @digitaldefiance/node-rs-accelerate

# Using npm
npm install @digitaldefiance/node-rs-accelerate
```

The native addon will be compiled automatically during installation.

### Verifying Installation

```typescript
import { isMetalAvailable, initMetal } from '@digitaldefiance/node-rs-accelerate';

console.log('Metal GPU available:', isMetalAvailable());
console.log('Metal initialized:', initMetal());
```

## Quick Start

### Basic Encoding and Decoding

```typescript
import { 
  ReedSolomonEncoder, 
  ReedSolomonDecoder,
  ShardInfo 
} from '@digitaldefiance/node-rs-accelerate';

// Create encoder: 10 data shards + 4 parity shards
// Can recover from up to 4 lost shards
const encoder = new ReedSolomonEncoder({
  dataShards: 10,      // K = 10
  parityShards: 4,     // M = 4
  shardSize: 1024      // 1KB per shard
});

// Encode 10KB of data (10 shards × 1KB)
const data = new Uint8Array(10 * 1024);
// Fill with your data...
const encoded = encoder.encode(data);

console.log(`Data shards: ${encoded.dataShards.length}`);    // 10
console.log(`Parity shards: ${encoded.parityShards.length}`); // 4

// Create decoder with matching configuration
const decoder = new ReedSolomonDecoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024
});

// Simulate losing 4 shards (indices 3, 5, 7, 9)
const availableShards: ShardInfo[] = [
  { index: 0, data: encoded.dataShards[0], isData: true },
  { index: 1, data: encoded.dataShards[1], isData: true },
  { index: 2, data: encoded.dataShards[2], isData: true },
  // index 3 lost
  { index: 4, data: encoded.dataShards[4], isData: true },
  // index 5 lost
  { index: 6, data: encoded.dataShards[6], isData: true },
  // index 7 lost
  { index: 8, data: encoded.dataShards[8], isData: true },
  // index 9 lost
  { index: 10, data: encoded.parityShards[0], isData: false },
  { index: 11, data: encoded.parityShards[1], isData: false },
];

// Decode from any 10 shards
const decoded = decoder.decode(availableShards);
console.log('Data recovered successfully!');
```

### With Compression

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  compression: {
    enabled: true,
    level: 6,           // 0-9, higher = better compression
    algorithm: 'gzip'   // 'gzip', 'deflate', or 'brotli'
  }
});

const encoded = encoder.encode(data);
console.log(`Original: ${encoded.originalSize} bytes`);
console.log(`Compressed: ${encoded.compressedSize} bytes`);
```

### With Hash Validation

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  enableHashValidation: true
});

const encoded = encoder.encode(data);
console.log('Data hashes:', encoded.dataHashes);
console.log('Parity hashes:', encoded.parityHashes);

// Include hashes when decoding for validation
const shards: ShardInfo[] = encoded.dataShards.map((data, i) => ({
  index: i,
  data,
  isData: true,
  hash: encoded.dataHashes![i]
}));

const decoder = new ReedSolomonDecoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  enableHashValidation: true
});

// Will throw CorruptionError if hash doesn't match
const decoded = decoder.decode(shards);
```

### Streaming Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 64 * 1024  // 64KB per shard
});

// Stream encode a large file
await pipeline(
  createReadStream('large-file.dat'),
  encoder.encodeStream(),
  // Handle encoded chunks...
);
```

## API Overview

### Classes

| Class | Description |
|-------|-------------|
| `ReedSolomonEncoder` | Encodes data into K data shards + M parity shards |
| `ReedSolomonDecoder` | Decodes data from any K shards |
| `StreamingEncoder` | Transform stream for encoding |
| `StreamingDecoder` | Transform stream for decoding |

### Configuration Types

| Type | Description |
|------|-------------|
| `EncoderConfig` | Configuration for encoder |
| `DecoderConfig` | Configuration for decoder |
| `EncodedData` | Result of encoding operation |
| `ShardInfo` | Information about a single shard |
| `CompressionConfig` | Compression settings |

### Enums

| Enum | Values | Description |
|------|--------|-------------|
| `GaloisField` | `GF256`, `GF65536` | Field size (max shards) |
| `MatrixType` | `Vandermonde`, `Cauchy` | Matrix construction |
| `PrimitivePolynomialGF256` | `DEFAULT`, `ANSI`, `CCSDS`, etc. | GF(2^8) polynomial |
| `PrimitivePolynomialGF65536` | `DEFAULT`, `ALT1`, `ALT2`, `ALT3` | GF(2^16) polynomial |

### Error Classes

| Error | Code | Description |
|-------|------|-------------|
| `ConfigurationError` | `INVALID_CONFIG` | Invalid configuration parameters |
| `InsufficientShardsError` | `INSUFFICIENT_SHARDS` | Not enough shards for decoding |
| `CorruptionError` | `DATA_CORRUPTION` | Data corruption detected |
| `NativeError` | `NATIVE_ERROR` | Native code operation failed |
| `MetalError` | `METAL_ERROR` | GPU operation failed |

### Utility Functions

| Function | Description |
|----------|-------------|
| `validateConfig(config)` | Validate encoder/decoder configuration |
| `estimateMemoryUsage(config)` | Estimate memory usage in bytes |
| `shouldUseGPU(config)` | Check if GPU should be used |
| `isMetalAvailable()` | Check if Metal GPU is available |
| `initMetal()` | Initialize Metal GPU |

## Performance

### Encoding Throughput

| Configuration | Throughput | Speedup vs JS |
|--------------|------------|---------------|
| (10,4) 64KB shards | 17.4 GB/s | 97x |
| (10,4) 1MB shards | 30.3 GB/s | 167x |
| (20,10) 64KB shards | 15.5 GB/s | 218x |
| (50,20) 64KB shards | 12.9 GB/s | 358x |

### Key Optimizations

- **vtbl table lookup**: 10x speedup for GF multiplication
- **Interleaved processing**: 6-7x speedup for multiply-accumulate
- **GCD parallel encoding**: 13-50x speedup depending on configuration
- **Cache-optimized access**: Minimizes cache misses

### When to Use GPU

GPU acceleration is automatically enabled when beneficial. Manual control:

```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024 * 1024,  // 1MB
  useGPU: true,            // Force GPU
  gpuThreshold: 10 * 1024  // Use GPU when shardSize >= 10KB
});
```

**Recommendation**: Let the library auto-detect. CPU with SIMD optimizations often outperforms GPU for typical configurations due to data transfer overhead.

## Common Configurations

| Use Case | K | M | Overhead | Fault Tolerance |
|----------|---|---|----------|-----------------|
| Basic redundancy | 10 | 4 | 40% | 4 shards |
| High availability | 10 | 10 | 100% | 10 shards |
| Storage efficient | 20 | 4 | 20% | 4 shards |
| Maximum protection | 100 | 50 | 50% | 50 shards |

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/digitaldefiance/node-rs-accelerate.git
cd node-rs-accelerate

# Install dependencies
yarn install

# Build native addon and TypeScript
yarn build
```

### Running Tests

```bash
# All tests
yarn test

# Property-based tests
yarn test:properties

# Integration tests
yarn test:integration

# Memory leak tests
yarn test:memory
```

### Running Benchmarks

```bash
# Full benchmark suite
yarn benchmark

# Individual benchmarks
node benchmarks/encoding.js
node benchmarks/decoding.js
node benchmarks/gf_operations.js
node benchmarks/simd_benchmark.js
```

## Documentation

- [API Reference](docs/API.md) - Complete API documentation
- [Performance Guide](docs/PERFORMANCE_ANALYSIS.md) - Performance characteristics and optimization tips
- [Optimization Guide](docs/OPTIMIZATION_GUIDE.md) - Implementation details for ARM NEON optimizations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please see the [implementation plan](.kiro/specs/node-rs-accelerate/tasks.md) for areas that need work.

## Acknowledgments

- Apple's Accelerate framework for high-performance numerical computing
- Metal Performance Shaders for GPU acceleration
- The Reed-Solomon algorithm by Irving S. Reed and Gustave Solomon (1960)
