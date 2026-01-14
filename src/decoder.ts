/**
 * Reed-Solomon decoder implementation
 */

import { DecoderConfig, ShardInfo, GaloisField, MatrixType } from './config';
import { validateConfig, verifyHash } from './utils';
import { InsufficientShardsError, NativeError, CorruptionError } from './errors';
import { Transform } from 'stream';
import { decompressDataSync } from './compression';

// Native bindings
const native = require('../build/Release/node_rs_accelerate.node');

/**
 * Reed-Solomon decoder for reconstructing data from shards
 * 
 * @remarks
 * The decoder reconstructs original data from any K shards out of K+M total shards.
 * It can recover from up to M missing or corrupted shards.
 * 
 * Features:
 * - Erasure decoding (known missing shards)
 * - Hardware acceleration via Apple's Accelerate framework (CPU SIMD)
 * - GPU acceleration via Metal Performance Shaders (for large operations)
 * - Optional decompression after decoding
 * - Optional SHA-256 hash validation
 * - Parity validation to detect corruption beyond repair
 * - Partial reconstruction of specific missing shards
 * - Streaming API for large files
 * 
 * @example
 * Basic decoding:
 * ```typescript
 * const decoder = new ReedSolomonDecoder({
 *   dataShards: 10,      // Must match encoder
 *   parityShards: 4,     // Must match encoder
 *   shardSize: 1024      // Must match encoder
 * });
 * 
 * // Provide any 10 shards (can be mix of data and parity)
 * const shards: ShardInfo[] = [
 *   { index: 0, data: shard0, isData: true },
 *   { index: 1, data: shard1, isData: true },
 *   // ... 8 more shards
 * ];
 * 
 * const decoded = decoder.decode(shards);
 * console.log(`Reconstructed ${decoded.length} bytes`);
 * ```
 * 
 * @example
 * With hash validation and parity checking:
 * ```typescript
 * const decoder = new ReedSolomonDecoder({
 *   dataShards: 10,
 *   parityShards: 4,
 *   shardSize: 1024,
 *   enableHashValidation: true
 * });
 * 
 * const shards: ShardInfo[] = [
 *   { index: 0, data: shard0, isData: true, hash: 'abc123...' },
 *   // ... more shards with hashes
 * ];
 * 
 * try {
 *   const decoded = decoder.decode(shards, true);  // With parity validation
 *   console.log('Data successfully reconstructed and validated');
 * } catch (e) {
 *   if (e instanceof CorruptionError) {
 *     console.error('Data corrupted beyond repair');
 *   }
 * }
 * ```
 * 
 * @public
 */
export class ReedSolomonDecoder {
  private config: DecoderConfig;
  private encodingMatrix: Uint8Array | null = null;

  /**
   * Creates a new Reed-Solomon decoder
   * 
   * @remarks
   * The decoder configuration must match the encoder configuration used to create the shards.
   * Mismatched configurations will result in incorrect decoding or errors.
   * 
   * @param config - Decoder configuration (must match encoder)
   * @throws {@link ConfigurationError} if configuration is invalid
   * @throws {@link NativeError} if Galois Field initialization fails
   * 
   * @example
   * ```typescript
   * const decoder = new ReedSolomonDecoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024,
   *   field: GaloisField.GF256,
   *   matrixType: MatrixType.Vandermonde
   * });
   * ```
   */
  constructor(config: DecoderConfig) {
    // Set defaults
    this.config = {
      ...config,
      field: config.field || GaloisField.GF256,
      matrixType: config.matrixType || MatrixType.Vandermonde,
      useGPU: config.useGPU
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
    
    // Build encoding matrix (needed for decoding)
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
   * Decode data from available shards
   * 
   * @remarks
   * Reconstructs the original data from any K shards out of K+M total.
   * The shards can be any combination of data and parity shards.
   * 
   * If hash validation is enabled and hashes are provided in ShardInfo,
   * each shard is validated before decoding.
   * 
   * If validateParityShards is true, the reconstructed data is re-encoded
   * and compared against available parity shards to detect corruption.
   * 
   * If compression was used during encoding, the data is automatically
   * decompressed after decoding.
   * 
   * @param shards - Available shards with indices (must have at least K shards)
   * @param validateParityShards - If true, validate reconstructed data against available parity shards
   * @returns Reconstructed original data
   * @throws {@link InsufficientShardsError} if fewer than K shards provided
   * @throws {@link NativeError} if decoding fails or shard sizes/indices are invalid
   * @throws {@link CorruptionError} if hash validation or parity validation fails
   * 
   * @example
   * ```typescript
   * const decoder = new ReedSolomonDecoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * // Provide any 10 shards
   * const shards: ShardInfo[] = [
   *   { index: 0, data: shard0, isData: true },
   *   { index: 2, data: shard2, isData: true },
   *   { index: 10, data: shard10, isData: false },  // Parity shard
   *   // ... 7 more shards
   * ];
   * 
   * const decoded = decoder.decode(shards);
   * ```
   * 
   * @example
   * With parity validation:
   * ```typescript
   * try {
   *   const decoded = decoder.decode(shards, true);
   *   console.log('Data validated successfully');
   * } catch (e) {
   *   if (e instanceof CorruptionError) {
   *     console.error('Corruption detected:', e.message);
   *   }
   * }
   * ```
   * 
   * @public
   */
  decode(shards: ShardInfo[], validateParityShards: boolean = false): Uint8Array {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const shardSize = this.config.shardSize;
    
    // Validate we have enough shards
    if (shards.length < K) {
      throw new InsufficientShardsError(K, shards.length);
    }
    
    // Validate shard sizes
    for (const shard of shards) {
      if (shard.data.length !== shardSize) {
        throw new NativeError(
          `Shard ${shard.index} has incorrect size (${shard.data.length}, expected ${shardSize})`
        );
      }
    }
    
    // Validate shard indices
    for (const shard of shards) {
      if (shard.index < 0 || shard.index >= K + M) {
        throw new NativeError(
          `Invalid shard index ${shard.index} (must be 0 to ${K + M - 1})`
        );
      }
    }
    
    // Validate hashes if hash validation is enabled and hashes are provided
    if (this.config.enableHashValidation) {
      for (const shard of shards) {
        if (shard.hash) {
          const isValid = verifyHash(shard.data, shard.hash);
          if (!isValid) {
            throw new CorruptionError(
              `Hash validation failed for shard ${shard.index}. ` +
              `Shard data does not match expected hash.`
            );
          }
        }
      }
    }
    
    // Take first K shards
    const selectedShards = shards.slice(0, K);
    
    // Prepare arrays for native call
    const shardDataArray = selectedShards.map(s => s.data);
    const shardIndicesArray = new Int32Array(selectedShards.map(s => s.index));
    
    try {
      // Determine if we should use GPU
      const useGPU = this.config.useGPU !== undefined 
        ? this.config.useGPU 
        : native.shouldUseGPUForDecoding(K, M);
      
      // Call appropriate native decoding function
      let decodedData = useGPU
        ? native.decodeGPU(
            shardDataArray,
            shardIndicesArray,
            K,
            M,
            shardSize,
            this.encodingMatrix,
            this.config.field
          )
        : native.decode(
            shardDataArray,
            shardIndicesArray,
            K,
            M,
            shardSize,
            this.encodingMatrix,
            this.config.field
          );
      
      // Apply decompression if enabled
      if (this.config.compression?.enabled) {
        try {
          decodedData = decompressDataSync(decodedData, this.config.compression);
        } catch (e) {
          throw new NativeError(`Decompression failed: ${e}`);
        }
      }
      
      // Validate parity if requested
      if (validateParityShards) {
        // Find available parity shards (not used in decoding)
        const usedIndices = new Set(selectedShards.map(s => s.index));
        const availableParityShards = shards.filter(
          s => !usedIndices.has(s.index) && s.index >= K
        );
        
        // Re-encode to get the data before decompression for validation
        let dataToValidate = decodedData;
        if (this.config.compression?.enabled) {
          // Need to re-compress for validation
          const { compressDataSync } = require('./compression');
          dataToValidate = compressDataSync(decodedData, this.config.compression);
          
          // Pad to expected size
          const expectedSize = K * shardSize;
          if (dataToValidate.length < expectedSize) {
            const padded = new Uint8Array(expectedSize);
            padded.set(dataToValidate);
            dataToValidate = padded;
          }
        }
        
        const isValid = this.validateParity(dataToValidate, availableParityShards);
        if (!isValid) {
          throw new CorruptionError(
            'Parity validation failed: reconstructed data does not match available parity shards. ' +
            'Data may be corrupted beyond repair.'
          );
        }
      }
      
      return decodedData;
    } catch (e) {
      if (e instanceof NativeError || e instanceof CorruptionError) {
        throw e;
      }
      throw new NativeError(`Decoding failed: ${e}`);
    }
  }

  /**
   * Reconstruct specific missing shards
   * 
   * @remarks
   * Instead of reconstructing all original data, this method reconstructs only
   * the specified missing shards. This is more efficient when you only need
   * to recover a few specific shards rather than all data.
   * 
   * Requires at least K shards to be available (any combination of data and parity).
   * 
   * @param shards - Available shards (must have at least K shards)
   * @param missingIndices - Indices of shards to reconstruct
   * @returns Array of reconstructed shards, one for each missing index
   * @throws {@link InsufficientShardsError} if fewer than K shards provided
   * @throws {@link NativeError} if reconstruction fails or indices are invalid
   * @throws {@link CorruptionError} if hash validation fails
   * 
   * @example
   * ```typescript
   * const decoder = new ReedSolomonDecoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * // Have shards 0-9, missing shards 10 and 11
   * const shards: ShardInfo[] = [
   *   { index: 0, data: shard0, isData: true },
   *   { index: 1, data: shard1, isData: true },
   *   // ... shards 2-9
   * ];
   * 
   * // Reconstruct only the missing parity shards
   * const reconstructed = decoder.reconstruct(shards, [10, 11]);
   * console.log(`Reconstructed ${reconstructed.length} shards`);
   * ```
   * 
   * @public
   */
  reconstruct(shards: ShardInfo[], missingIndices: number[]): Uint8Array[] {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const shardSize = this.config.shardSize;
    
    // Validate we have enough shards
    if (shards.length < K) {
      throw new InsufficientShardsError(K, shards.length);
    }
    
    // Validate shard sizes
    for (const shard of shards) {
      if (shard.data.length !== shardSize) {
        throw new NativeError(
          `Shard ${shard.index} has incorrect size (${shard.data.length}, expected ${shardSize})`
        );
      }
    }
    
    // Validate shard indices
    for (const shard of shards) {
      if (shard.index < 0 || shard.index >= K + M) {
        throw new NativeError(
          `Invalid shard index ${shard.index} (must be 0 to ${K + M - 1})`
        );
      }
    }
    
    // Validate hashes if hash validation is enabled and hashes are provided
    if (this.config.enableHashValidation) {
      for (const shard of shards) {
        if (shard.hash) {
          const isValid = verifyHash(shard.data, shard.hash);
          if (!isValid) {
            throw new CorruptionError(
              `Hash validation failed for shard ${shard.index}. ` +
              `Shard data does not match expected hash.`
            );
          }
        }
      }
    }
    
    // Validate missing indices
    for (const index of missingIndices) {
      if (index < 0 || index >= K + M) {
        throw new NativeError(
          `Invalid missing index ${index} (must be 0 to ${K + M - 1})`
        );
      }
    }
    
    // Take first K shards
    const selectedShards = shards.slice(0, K);
    
    // Prepare arrays for native call
    const shardDataArray = selectedShards.map(s => s.data);
    const shardIndicesArray = new Int32Array(selectedShards.map(s => s.index));
    const missingIndicesArray = new Int32Array(missingIndices);
    
    try {
      // Call native reconstruction function
      const reconstructedData = native.reconstruct(
        shardDataArray,
        shardIndicesArray,
        missingIndicesArray,
        K,
        M,
        shardSize,
        this.encodingMatrix,
        this.config.field
      );
      
      // Split reconstructed data into individual shards
      const reconstructedShards: Uint8Array[] = [];
      for (let i = 0; i < missingIndices.length; i++) {
        const start = i * shardSize;
        const end = start + shardSize;
        reconstructedShards.push(reconstructedData.slice(start, end));
      }
      
      return reconstructedShards;
    } catch (e) {
      throw new NativeError(`Reconstruction failed: ${e}`);
    }
  }

  /**
   * Validate reconstructed data against available parity shards
   * 
   * @remarks
   * Re-encodes the reconstructed data and compares the computed parity shards
   * against the available parity shards. This detects corruption beyond the
   * error correction capability.
   * 
   * This is an internal method used by decode() when validateParityShards is true.
   * 
   * @param reconstructedData - The reconstructed data to validate
   * @param availableParityShards - Available parity shards for validation
   * @returns true if validation passes, false if corruption detected
   * 
   * @internal
   */
  validateParity(reconstructedData: Uint8Array, availableParityShards: ShardInfo[]): boolean {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const shardSize = this.config.shardSize;
    
    // If no parity shards available, cannot validate
    if (availableParityShards.length === 0) {
      return true; // No validation possible, assume valid
    }
    
    // Validate input size
    const expectedSize = K * shardSize;
    if (reconstructedData.length !== expectedSize) {
      return false;
    }
    
    try {
      // Re-encode the reconstructed data to compute expected parity
      const parityData = native.encode(
        reconstructedData,
        K,
        M,
        shardSize,
        this.encodingMatrix,
        this.config.field
      );
      
      // Split parity data into M parity shards
      const expectedParityShards: Uint8Array[] = [];
      for (let i = 0; i < M; i++) {
        const start = i * shardSize;
        const end = start + shardSize;
        expectedParityShards.push(parityData.slice(start, end));
      }
      
      // Compare each available parity shard with expected
      for (const parityShard of availableParityShards) {
        const parityIndex = parityShard.index - K; // Parity shards start at index K
        
        if (parityIndex < 0 || parityIndex >= M) {
          continue; // Skip invalid indices
        }
        
        const expected = expectedParityShards[parityIndex];
        const actual = parityShard.data;
        
        // Compare byte by byte
        if (expected.length !== actual.length) {
          return false;
        }
        
        for (let i = 0; i < expected.length; i++) {
          if (expected[i] !== actual[i]) {
            return false; // Corruption detected
          }
        }
      }
      
      return true; // All parity checks passed
    } catch (e) {
      // If encoding fails, consider validation failed
      return false;
    }
  }

  /**
   * Check if provided shards are sufficient for decoding
   * 
   * @remarks
   * Validates that:
   * - At least K shards are provided
   * - All shard indices are in valid range [0, K+M-1]
   * - No duplicate indices
   * 
   * This is a quick check that doesn't attempt actual decoding.
   * 
   * @param shardIndices - Indices of available shards
   * @returns true if decoding is possible with these shards
   * 
   * @example
   * ```typescript
   * const decoder = new ReedSolomonDecoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * const availableIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
   * if (decoder.canDecode(availableIndices)) {
   *   console.log('Sufficient shards for decoding');
   * } else {
   *   console.log('Need more shards');
   * }
   * ```
   * 
   * @public
   */
  canDecode(shardIndices: number[]): boolean {
    const K = this.config.dataShards;
    const M = this.config.parityShards;
    const totalShards = K + M;
    
    // Need at least K shards
    if (shardIndices.length < K) {
      return false;
    }
    
    // Validate all indices are in valid range
    for (const index of shardIndices) {
      if (index < 0 || index >= totalShards) {
        return false; // Invalid index
      }
    }
    
    // Check for duplicate indices
    const uniqueIndices = new Set(shardIndices);
    if (uniqueIndices.size < K) {
      return false; // Not enough unique shards
    }
    
    // If we have at least K unique valid indices, decoding is possible
    return true;
  }

  /**
   * Create a streaming decoder Transform stream
   * 
   * @remarks
   * Returns a Node.js Transform stream that can be used in stream pipelines
   * to decode data incrementally. This is useful for decoding large files
   * without loading everything into memory.
   * 
   * The stream maintains state across chunks and handles backpressure automatically.
   * 
   * @returns Transform stream for decoding
   * 
   * @example
   * ```typescript
   * import { createReadStream, createWriteStream } from 'fs';
   * 
   * const decoder = new ReedSolomonDecoder({
   *   dataShards: 10,
   *   parityShards: 4,
   *   shardSize: 1024
   * });
   * 
   * createReadStream('encoded.dat')
   *   .pipe(decoder.decodeStream())
   *   .pipe(createWriteStream('decoded.dat'));
   * ```
   * 
   * @public
   */
  decodeStream(): Transform {
    const { StreamingDecoder } = require('./streaming');
    return new StreamingDecoder(this.config);
  }
}
