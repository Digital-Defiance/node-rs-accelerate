/**
 * Error classes for Reed-Solomon operations
 */

/**
 * Base error class for all Reed-Solomon errors
 * 
 * @remarks
 * All Reed-Solomon specific errors extend this class and include an error code
 * for programmatic error handling.
 * 
 * @public
 */
export class ReedSolomonError extends Error {
  /**
   * Creates a new ReedSolomonError
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReedSolomonError';
  }
}

/**
 * Error thrown when configuration parameters are invalid
 * 
 * @remarks
 * This error is thrown during encoder/decoder construction when:
 * - dataShards or parityShards are not positive
 * - shardSize is not positive
 * - Total shards exceed field size (256 for GF256, 65536 for GF65536)
 * 
 * @example
 * ```typescript
 * try {
 *   const encoder = new ReedSolomonEncoder({
 *     dataShards: 300,  // Too many for GF256!
 *     parityShards: 100,
 *     shardSize: 1024
 *   });
 * } catch (e) {
 *   if (e instanceof ConfigurationError) {
 *     console.error('Invalid config:', e.message);
 *   }
 * }
 * ```
 * 
 * @public
 */
export class ConfigurationError extends ReedSolomonError {
  /**
   * Creates a new ConfigurationError
   * @param message - Description of the configuration problem
   */
  constructor(message: string) {
    super(message, 'INVALID_CONFIG');
  }
}

/**
 * Error thrown when insufficient shards are provided for decoding
 * 
 * @remarks
 * Decoding requires at least K shards (any combination of data and parity).
 * This error is thrown when fewer than K shards are provided.
 * 
 * @example
 * ```typescript
 * try {
 *   const decoded = decoder.decode(shards);  // Only 5 shards, need 10
 * } catch (e) {
 *   if (e instanceof InsufficientShardsError) {
 *     console.error('Need more shards:', e.message);
 *   }
 * }
 * ```
 * 
 * @public
 */
export class InsufficientShardsError extends ReedSolomonError {
  /**
   * Creates a new InsufficientShardsError
   * @param required - Number of shards required (K)
   * @param available - Number of shards provided
   */
  constructor(required: number, available: number) {
    super(
      `Insufficient shards for decoding: need ${required}, have ${available}`,
      'INSUFFICIENT_SHARDS'
    );
  }
}

/**
 * Error thrown when data corruption is detected
 * 
 * @remarks
 * This error is thrown when:
 * - Hash validation fails (shard data doesn't match expected hash)
 * - Parity validation fails (reconstructed data doesn't match parity shards)
 * - Data is corrupted beyond the error correction capability
 * 
 * @example
 * ```typescript
 * try {
 *   const decoded = decoder.decode(shards, true);  // With parity validation
 * } catch (e) {
 *   if (e instanceof CorruptionError) {
 *     console.error('Data corrupted beyond repair:', e.message);
 *   }
 * }
 * ```
 * 
 * @public
 */
export class CorruptionError extends ReedSolomonError {
  /**
   * Creates a new CorruptionError
   * @param message - Description of the corruption detected
   */
  constructor(message: string) {
    super(message, 'DATA_CORRUPTION');
  }
}

/**
 * Error thrown when native code operations fail
 * 
 * @remarks
 * This error wraps errors from the native C++/Objective-C++ addon.
 * Common causes include:
 * - Memory allocation failures
 * - Invalid buffer operations
 * - Galois Field initialization failures
 * 
 * @public
 */
export class NativeError extends ReedSolomonError {
  /**
   * Creates a new NativeError
   * @param message - Description of the native error
   */
  constructor(message: string) {
    super(message, 'NATIVE_ERROR');
  }
}

/**
 * Error thrown when Metal GPU operations fail
 * 
 * @remarks
 * This error is thrown when GPU acceleration fails. The library will
 * typically fall back to CPU operations when Metal is unavailable.
 * Common causes include:
 * - Metal not available on the system
 * - GPU out of memory
 * - Metal initialization failures
 * 
 * @public
 */
export class MetalError extends ReedSolomonError {
  /**
   * Creates a new MetalError
   * @param message - Description of the Metal error
   */
  constructor(message: string) {
    super(message, 'METAL_ERROR');
  }
}
