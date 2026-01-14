/**
 * @digitaldefiance/node-rs-accelerate
 * 
 * High-performance Reed-Solomon error correction library for Apple Silicon
 * 
 * @remarks
 * This library provides hardware-accelerated Reed-Solomon encoding and decoding
 * optimized for Apple Silicon (M1/M2/M3/M4) processors. It leverages:
 * - Apple's Accelerate framework for CPU SIMD operations
 * - Metal Performance Shaders for GPU acceleration
 * - Systematic Reed-Solomon codes for efficient encoding
 * 
 * Key features:
 * - Up to 50x faster than pure JavaScript implementations
 * - Support for GF(2^8) and GF(2^16) fields
 * - Optional compression before encoding
 * - Optional SHA-256 hash validation
 * - Streaming API for large files
 * - Batch operations for improved throughput
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { ReedSolomonEncoder, ReedSolomonDecoder, GaloisField } from '@digitaldefiance/node-rs-accelerate';
 * 
 * // Create encoder
 * const encoder = new ReedSolomonEncoder({
 *   dataShards: 10,      // K = 10
 *   parityShards: 4,     // M = 4
 *   shardSize: 1024,     // 1KB per shard
 *   field: GaloisField.GF256
 * });
 * 
 * // Encode data
 * const data = new Uint8Array(10 * 1024);
 * const encoded = encoder.encode(data);
 * 
 * // Create decoder
 * const decoder = new ReedSolomonDecoder({
 *   dataShards: 10,
 *   parityShards: 4,
 *   shardSize: 1024,
 *   field: GaloisField.GF256
 * });
 * 
 * // Decode from any 10 shards
 * const shards = [
 *   { index: 0, data: encoded.dataShards[0], isData: true },
 *   { index: 1, data: encoded.dataShards[1], isData: true },
 *   // ... 8 more shards
 * ];
 * const decoded = decoder.decode(shards);
 * ```
 * 
 * @packageDocumentation
 */

export { ReedSolomonEncoder } from './encoder';
export { ReedSolomonDecoder } from './decoder';
export { StreamingEncoder, StreamingDecoder } from './streaming';
export {
  GaloisField,
  MatrixType,
  EncoderConfig,
  DecoderConfig,
  EncodedData,
  ShardInfo,
  CompressionConfig
} from './config';
export {
  ReedSolomonError,
  ConfigurationError,
  InsufficientShardsError,
  CorruptionError,
  NativeError,
  MetalError
} from './errors';
export {
  validateConfig,
  estimateMemoryUsage,
  shouldUseGPU,
  isMetalAvailable,
  initMetal
} from './utils';
