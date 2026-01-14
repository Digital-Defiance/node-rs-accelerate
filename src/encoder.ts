/**
 * Reed-Solomon encoder implementation
 */

import { EncoderConfig, EncodedData, GaloisField, MatrixType } from './config';
import { validateConfig, computeHash } from './utils';
import { NativeError } from './errors';
import { Transform } from 'stream';
import { compressDataSync } from './compression';

// Native bindings
const native = require('../build/Release/node_rs_accelerate.node');

/**
 * Reed-Solomon encoder for creating error-correcting codes
 * 
 * @remarks
 * The encoder implements systematic Reed-Solomon encoding, where the first K shards
 * contain the original data unchanged, and M additional parity shards provide redundancy.
 * Any K shards from the total K+M can reconstruct the original data.
 * 
 * Features:
 * - Hardware acceleration via Apple's Accelerate framework (CPU SIMD)
 * - GPU acceleration via Metal Performance Shaders (for large operations)
 * - Optional compression before encoding
 * - Optional SHA-256 hash validation
 * - Batch encoding for improved throughput
 * - Streaming API for large files
 * 
 * @example
 * Basic encoding:
 * ```typescript
 * const encoder = new ReedSolomonEncoder({
 *   dataShards: 10,      // K = 10
 *   parityShards: 4,     // M = 4
 *   shardSize: 1024      // 1KB per shard
 * });
 * 
 * const data = new Uint8Array(10 * 1024);  // 10KB of data
 * const encoded = encoder.encode(data);
 * 
 * // encoded.dataShards: 10 shards with original data
 * // encoded.parityShards: 4 shards with parity
 * // Any 10 of these 14 shards can reconstruct the original data
 * ```
 * 
 * @example
 * With compression and hash validation:
 * ```typescript
 * const encoder = new ReedSolomonEncoder({
 *   dataShards: 10,
 *   parityShards: 4,
 *   shardSize: 1024,
 *   compression: {
 *     enabled: true,
 *     level: 6,
 *     algorithm: 'gzip'
 *   },
 *   enableHashValidation: true
 * });
 * 
 * const encoded = encoder.encode(data);
 * console.log(`Compressed from ${encoded.originalSize} to ${encoded.compressedSize} bytes`);
 * console.log(`Data shard hashes:`, encoded.dataHashes);
 * ```
 * 
 * @public
 */
export class ReedSolomonEncoder {
  private config: EncoderConfig;
  private encodingMatrix: Uint8Array | null = null;

  /**
   * Creates a new Reed-Solomon encoder
   * 
   * @param config - Encoder configuration
   * @throws {@link ConfigurationError} if configuration is invalid
   * @throws {@link NativeError} if Galois Field initialization fails
   * 
   * @example
   * ```typescript
   * const encoder = new ReedSolomonEncoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024,
   *   field: GaloisField.GF256,
   *   matrixType: MatrixType.Vandermonde
   * });
   * ```
   */
  constructor(config: EncoderConfig) {
    // Set defaults
    this.config = {
      ...config,
      field: config.field || GaloisField.GF256,
      matrixType: config.matrixType || MatrixType.Vandermonde,
      useGPU: config.useGPU,
      gpuThreshold: config.gpuThreshold || 10 * 1024
    };

    validateConfig(this.config);
    
    // Initialize GF tables based on field
    try {
      if (this.config.field === GaloisField.GF65536) {
        native.initGF65536();
      } else {
        native.initGF();
      }
    } catch (e) {
      throw new NativeError(`Failed to initialize Galois Field: ${e}`);
    }
    
    // Pre-build encoding matrix
    this.buildEncodingMatrix();
  }

  /**
   * Build the encoding matrix based on configuration
   * @private
   */
  private buildEncodingMatrix(): void {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const totalShards = K + M;
    
    // Allocate matrix: (K+M) × K
    // For GF(2^16), we need twice the space (uint16 vs uint8)
    const bytesPerElement = this.config.field === GaloisField.GF65536 ? 2 : 1;
    this.encodingMatrix = new Uint8Array(totalShards * K * bytesPerElement);
    
    try {
      if (this.config.matrixType === MatrixType.Cauchy) {
        native.buildCauchyMatrix(this.encodingMatrix, totalShards, K, this.config.field);
      } else {
        native.buildVandermondeMatrix(this.encodingMatrix, totalShards, K, this.config.field);
      }
    } catch (e) {
      throw new NativeError(`Failed to build encoding matrix: ${e}`);
    }
  }

  /**
   * Encode data into Reed-Solomon shards
   * 
   * @remarks
   * Splits input data into K data shards and generates M parity shards using
   * Reed-Solomon encoding. The encoding is systematic, meaning the first K shards
   * contain the original data unchanged.
   * 
   * If compression is enabled, data is compressed before encoding. The compressed
   * size must fit within dataShards * shardSize bytes.
   * 
   * If hash validation is enabled, SHA-256 hashes are computed for all shards.
   * 
   * @param data - Input data to encode (must be dataShards * shardSize bytes, or less if compression enabled)
   * @returns Encoded data with K data shards and M parity shards
   * @throws {@link NativeError} if encoding fails or data size is invalid
   * 
   * @example
   * ```typescript
   * const encoder = new ReedSolomonEncoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * const data = new Uint8Array(10 * 1024);  // Exactly 10KB
   * const encoded = encoder.encode(data);
   * 
   * console.log(`Created ${encoded.dataShards.length} data shards`);
   * console.log(`Created ${encoded.parityShards.length} parity shards`);
   * ```
   * 
   * @public
   */
  encode(data: Uint8Array): EncodedData {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const shardSize = this.config.shardSize;
    
    // Track original size for compression metrics
    const originalSize = data.length;
    let dataToEncode = data;
    let compressed = false;
    let compressedSize = originalSize;
    
    // Apply compression if enabled
    if (this.config.compression?.enabled) {
      dataToEncode = compressDataSync(data, this.config.compression);
      compressed = true;
      compressedSize = dataToEncode.length;
    }
    
    // Validate input size
    const expectedSize = K * shardSize;
    if (dataToEncode.length > expectedSize) {
      throw new NativeError(
        `Input data size (${dataToEncode.length}) exceeds dataShards * shardSize (${expectedSize}). ` +
        `Consider increasing shardSize or dataShards.`
      );
    }
    
    // Only pad if compression is enabled OR if size matches exactly
    // Without compression, require exact size match
    if (!this.config.compression?.enabled && dataToEncode.length !== expectedSize) {
      throw new NativeError(
        `Input data size (${dataToEncode.length}) must equal dataShards * shardSize (${expectedSize})`
      );
    }
    
    // Pad data if necessary (only happens with compression enabled)
    if (dataToEncode.length < expectedSize) {
      const padded = new Uint8Array(expectedSize);
      padded.set(dataToEncode);
      dataToEncode = padded;
    }
    
    // Split data into K data shards
    const dataShards: Uint8Array[] = [];
    for (let i = 0; i < K; i++) {
      const start = i * shardSize;
      const end = start + shardSize;
      dataShards.push(dataToEncode.slice(start, end));
    }
    
    try {
      // Determine if we should use GPU
      const useGPU = this.config.useGPU !== undefined 
        ? this.config.useGPU 
        : native.shouldUseGPU(shardSize, K, M);
      
      // Call appropriate native encoding function
      const parityData = useGPU
        ? native.encodeGPU(
            dataToEncode,
            K,
            M,
            shardSize,
            this.encodingMatrix,
            this.config.field
          )
        : native.encode(
            dataToEncode,
            K,
            M,
            shardSize,
            this.encodingMatrix,
            this.config.field
          );
      
      // Split parity data into M parity shards
      const parityShards: Uint8Array[] = [];
      for (let i = 0; i < M; i++) {
        const start = i * shardSize;
        const end = start + shardSize;
        parityShards.push(parityData.slice(start, end));
      }
      
      const result: EncodedData = {
        dataShards,
        parityShards,
        config: this.getConfig()
      };
      
      // Add compression metadata if compression was used
      if (compressed) {
        result.compressed = true;
        result.originalSize = originalSize;
        result.compressedSize = compressedSize;
      }
      
      // Compute hashes if hash validation is enabled
      if (this.config.enableHashValidation) {
        result.dataHashes = dataShards.map(shard => computeHash(shard));
        result.parityHashes = parityShards.map(shard => computeHash(shard));
      }
      
      return result;
    } catch (e) {
      throw new NativeError(`Encoding failed: ${e}`);
    }
  }

  /**
   * Batch encode multiple data blocks using GPU acceleration
   * 
   * @remarks
   * Encodes multiple data blocks in a single GPU operation, amortizing
   * GPU initialization and data transfer overhead across all blocks.
   * This is significantly more efficient than encoding blocks individually
   * when using GPU acceleration.
   * 
   * All blocks must have the same size constraints as single encode operations.
   * 
   * @param dataBlocks - Array of input data blocks to encode
   * @returns Array of encoded data, one for each input block
   * @throws {@link NativeError} if batch encoding fails or any block has invalid size
   * 
   * @example
   * ```typescript
   * const encoder = new ReedSolomonEncoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * const blocks = [
   *   new Uint8Array(10 * 1024),
   *   new Uint8Array(10 * 1024),
   *   new Uint8Array(10 * 1024)
   * ];
   * 
   * const encoded = encoder.batchEncode(blocks);
   * console.log(`Encoded ${encoded.length} blocks`);
   * ```
   * 
   * @public
   */
  batchEncode(dataBlocks: Uint8Array[]): EncodedData[] {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const shardSize = this.config.shardSize;
    const expectedSize = K * shardSize;
    
    if (dataBlocks.length === 0) {
      throw new NativeError('Batch size must be greater than 0');
    }
    
    // Apply compression and track metadata
    const originalSizes: number[] = [];
    const compressedSizes: number[] = [];
    const processedBlocks: Uint8Array[] = [];
    
    for (let i = 0; i < dataBlocks.length; i++) {
      const originalSize = dataBlocks[i].length;
      originalSizes.push(originalSize);
      
      let dataToEncode = dataBlocks[i];
      
      // Apply compression if enabled
      if (this.config.compression?.enabled) {
        dataToEncode = compressDataSync(dataBlocks[i], this.config.compression);
        compressedSizes.push(dataToEncode.length);
      } else {
        compressedSizes.push(originalSize);
      }
      
      // Validate size
      if (dataToEncode.length > expectedSize) {
        throw new NativeError(
          `Data block ${i} size (${dataToEncode.length}) exceeds dataShards * shardSize (${expectedSize})`
        );
      }
      
      // Only pad if compression is enabled OR if size matches exactly
      // Without compression, require exact size match
      if (!this.config.compression?.enabled && dataToEncode.length !== expectedSize) {
        throw new NativeError(
          `Data block ${i} size (${dataToEncode.length}) must equal dataShards * shardSize (${expectedSize})`
        );
      }
      
      // Pad if necessary (only happens with compression enabled)
      if (dataToEncode.length < expectedSize) {
        const padded = new Uint8Array(expectedSize);
        padded.set(dataToEncode);
        dataToEncode = padded;
      }
      
      processedBlocks.push(dataToEncode);
    }
    
    try {
      // Call native batch encoding function (always uses GPU for batching)
      const parityBlocks = native.batchEncodeGPU(
        processedBlocks,
        K,
        M,
        shardSize,
        this.encodingMatrix,
        this.config.field
      );
      
      // Convert results to EncodedData format
      const results: EncodedData[] = [];
      for (let b = 0; b < processedBlocks.length; b++) {
        // Split data into K data shards
        const dataShards: Uint8Array[] = [];
        for (let i = 0; i < K; i++) {
          const start = i * shardSize;
          const end = start + shardSize;
          dataShards.push(processedBlocks[b].slice(start, end));
        }
        
        // Split parity data into M parity shards
        const parityShards: Uint8Array[] = [];
        for (let i = 0; i < M; i++) {
          const start = i * shardSize;
          const end = start + shardSize;
          parityShards.push(parityBlocks[b].slice(start, end));
        }
        
        const result: EncodedData = {
          dataShards,
          parityShards,
          config: this.getConfig()
        };
        
        // Add compression metadata if compression was used
        if (this.config.compression?.enabled) {
          result.compressed = true;
          result.originalSize = originalSizes[b];
          result.compressedSize = compressedSizes[b];
        }
        
        // Compute hashes if hash validation is enabled
        if (this.config.enableHashValidation) {
          result.dataHashes = dataShards.map(shard => computeHash(shard));
          result.parityHashes = parityShards.map(shard => computeHash(shard));
        }
        
        results.push(result);
      }
      
      return results;
    } catch (e) {
      throw new NativeError(`Batch encoding failed: ${e}`);
    }
  }

  /**
   * Create a streaming encoder Transform stream
   * 
   * @remarks
   * Returns a Node.js Transform stream that can be used in stream pipelines
   * to encode data incrementally. This is useful for encoding large files
   * without loading everything into memory.
   * 
   * The stream maintains state across chunks and handles backpressure automatically.
   * 
   * @returns Transform stream for encoding
   * 
   * @example
   * ```typescript
   * import { createReadStream, createWriteStream } from 'fs';
   * 
   * const encoder = new ReedSolomonEncoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * createReadStream('input.dat')
   *   .pipe(encoder.encodeStream())
   *   .pipe(createWriteStream('output.dat'));
   * ```
   * 
   * @public
   */
  encodeStream(): Transform {
    const { StreamingEncoder } = require('./streaming');
    return new StreamingEncoder(this.config);
  }

  /**
   * Get the current encoder configuration
   * 
   * @remarks
   * Returns a copy of the configuration to prevent external modification.
   * 
   * @returns Current encoder configuration
   * 
   * @example
   * ```typescript
   * const config = encoder.getConfig();
   * console.log(`Using ${config.dataShards} data shards`);
   * console.log(`Using ${config.parityShards} parity shards`);
   * ```
   * 
   * @public
   */
  getConfig(): EncoderConfig {
    return { ...this.config };
  }
}
