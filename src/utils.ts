/**
 * Utility functions for Reed-Solomon operations
 */

import { EncoderConfig, DecoderConfig, GaloisField } from './config';
import { ConfigurationError } from './errors';

// Import native addon
const addon = require('../build/Release/node_rs_accelerate.node');

/**
 * Check if Metal GPU acceleration is available on this system
 * 
 * @remarks
 * Metal is only available on macOS 11.0 (Big Sur) and later with Apple Silicon or AMD GPUs.
 * This function checks runtime availability without throwing errors.
 * 
 * @returns true if Metal is available and can be used for GPU acceleration
 * 
 * @example
 * ```typescript
 * if (isMetalAvailable()) {
 *   console.log('GPU acceleration available');
 * } else {
 *   console.log('Will use CPU-only operations');
 * }
 * ```
 * 
 * @public
 */
export function isMetalAvailable(): boolean {
  try {
    return addon.isMetalAvailable();
  } catch (error) {
    return false;
  }
}

/**
 * Initialize Metal GPU acceleration
 * 
 * @remarks
 * This function attempts to initialize Metal for GPU operations.
 * It's called automatically when needed, but can be called explicitly
 * to check for initialization errors early.
 * 
 * @returns true if Metal was successfully initialized
 * 
 * @example
 * ```typescript
 * if (!initMetal()) {
 *   console.warn('GPU initialization failed, using CPU fallback');
 * }
 * ```
 * 
 * @public
 */
export function initMetal(): boolean {
  try {
    return addon.initMetal();
  } catch (error) {
    return false;
  }
}

/**
 * Validate encoder or decoder configuration
 * 
 * @remarks
 * Validates that configuration parameters are within acceptable ranges:
 * - dataShards and parityShards must be positive
 * - shardSize must be positive
 * - Total shards (K+M) must not exceed field size
 * 
 * @param config - Configuration to validate
 * @throws {@link ConfigurationError} if configuration is invalid
 * 
 * @example
 * ```typescript
 * const config: EncoderConfig = {
 *   dataShards: 10,
 *   parityShards: 4,
 *   shardSize: 1024
 * };
 * 
 * try {
 *   validateConfig(config);
 *   console.log('Configuration is valid');
 * } catch (e) {
 *   console.error('Invalid configuration:', e.message);
 * }
 * ```
 * 
 * @public
 */
export function validateConfig(config: EncoderConfig | DecoderConfig): void {
  if (config.dataShards <= 0) {
    throw new ConfigurationError('dataShards must be positive');
  }
  
  if (config.parityShards <= 0) {
    throw new ConfigurationError('parityShards must be positive');
  }
  
  if (config.shardSize <= 0) {
    throw new ConfigurationError('shardSize must be positive');
  }
  
  const field = config.field || GaloisField.GF256;
  const maxShards = field === GaloisField.GF256 ? 256 : 65536;
  
  if (config.dataShards + config.parityShards > maxShards) {
    throw new ConfigurationError(
      `Total shards (${config.dataShards + config.parityShards}) exceeds field size (${maxShards})`
    );
  }
}

/**
 * Estimate memory usage for an encoding operation
 * 
 * @remarks
 * Provides an estimate of peak memory usage including:
 * - Memory for all shards (data + parity)
 * - Memory for encoding matrix
 * - Overhead for lookup tables and buffers (~1MB)
 * 
 * This is useful for capacity planning and avoiding out-of-memory errors.
 * 
 * @param config - Encoder configuration
 * @returns Estimated memory usage in bytes
 * 
 * @example
 * ```typescript
 * const config: EncoderConfig = {
 *   dataShards: 100,
 *   parityShards: 50,
 *   shardSize: 1024 * 1024  // 1MB per shard
 * };
 * 
 * const memoryBytes = estimateMemoryUsage(config);
 * console.log(`Estimated memory: ${memoryBytes / (1024 * 1024)} MB`);
 * ```
 * 
 * @public
 */
export function estimateMemoryUsage(config: EncoderConfig): number {
  const totalShards = config.dataShards + config.parityShards;
  const shardMemory = totalShards * config.shardSize;
  const matrixMemory = totalShards * config.dataShards;
  const overhead = 1024 * 1024; // 1MB overhead for tables and buffers
  
  return shardMemory + matrixMemory + overhead;
}

/**
 * Determine if GPU acceleration should be used for the given configuration
 * 
 * @remarks
 * Makes an automatic decision based on:
 * - Explicit useGPU setting in config (if provided)
 * - Shard size compared to GPU threshold (default 10KB)
 * - Metal availability
 * 
 * GPU acceleration is beneficial for large shard sizes but has overhead
 * for small operations due to data transfer costs.
 * 
 * @param config - Encoder configuration
 * @returns true if GPU should be used, false for CPU-only
 * 
 * @example
 * ```typescript
 * const config: EncoderConfig = {
 *   dataShards: 10,
 *   parityShards: 4,
 *   shardSize: 100 * 1024  // 100KB - likely benefits from GPU
 * };
 * 
 * if (shouldUseGPU(config)) {
 *   console.log('Will use GPU acceleration');
 * } else {
 *   console.log('Will use CPU operations');
 * }
 * ```
 * 
 * @public
 */
export function shouldUseGPU(config: EncoderConfig): boolean {
  if (config.useGPU !== undefined) {
    return config.useGPU;
  }
  
  const threshold = config.gpuThreshold || 10 * 1024; // 10KB default
  return config.shardSize >= threshold;
}

/**
 * Compute SHA-256 hash of data
 * 
 * @remarks
 * Used internally for hash validation when enableHashValidation is true.
 * Computes a cryptographic hash that can detect data corruption.
 * 
 * @param data - Data to hash
 * @returns Hex string representation of SHA-256 hash
 * 
 * @internal
 */
export function computeHash(data: Uint8Array): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Verify hash of data matches expected value
 * 
 * @remarks
 * Used internally for hash validation when enableHashValidation is true.
 * Compares computed hash against expected hash to detect corruption.
 * 
 * @param data - Data to verify
 * @param expectedHash - Expected SHA-256 hash (hex string)
 * @returns true if hash matches, false if corrupted
 * 
 * @internal
 */
export function verifyHash(data: Uint8Array, expectedHash: string): boolean {
  const actualHash = computeHash(data);
  return actualHash === expectedHash;
}
