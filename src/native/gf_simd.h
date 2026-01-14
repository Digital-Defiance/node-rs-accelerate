/**
 * Advanced SIMD optimizations for Galois Field operations
 * 
 * This file implements creative hardware utilization techniques:
 * 
 * 1. ARM Crypto Extensions (PMULL) for carry-less multiplication
 *    - vmull_p8 performs polynomial multiplication, exactly what GF needs
 *    - Combined with reduction table for complete GF multiply
 * 
 * 2. NEON vtbl for hardware-accelerated table lookups
 *    - Process 16 lookups simultaneously
 *    - Split tables into nibble-based lookups for 16-entry tables
 * 
 * 3. Grand Central Dispatch for multi-threaded encoding
 *    - Parallelize parity shard computation
 *    - Each parity shard is independent
 * 
 * 4. Interleaved processing for better instruction-level parallelism
 *    - Process multiple data streams simultaneously
 *    - Hide memory latency with computation
 */

#ifndef GF_SIMD_H
#define GF_SIMD_H

#include <cstdint>
#include <cstddef>

namespace GF_SIMD {

/**
 * Initialize SIMD-optimized tables and structures
 */
void initSIMD();

/**
 * Check if advanced SIMD features are available
 */
bool isSIMDAvailable();

/**
 * Check if multi-threading is available
 */
bool isMultiThreadAvailable();

/**
 * Get optimal thread count for encoding
 */
int getOptimalThreadCount();

/**
 * NEON vtbl-based GF multiplication
 * Uses hardware table lookup for 16 elements at once
 * 
 * @param a First operand array
 * @param constant Constant to multiply by
 * @param out Output array
 * @param len Length of arrays
 */
void mulVecConstant_vtbl(const uint8_t* a, uint8_t constant, uint8_t* out, size_t len);

/**
 * Polynomial multiply using ARM crypto extensions
 * Uses vmull_p8 for carry-less multiplication
 * 
 * @param a First operand array
 * @param b Second operand array
 * @param out Output array
 * @param len Length of arrays
 */
void mulVec_pmull(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);

/**
 * Multi-threaded Reed-Solomon encoding using GCD
 * Parallelizes parity shard computation
 * 
 * @param data Input data shards (dataShards * shardSize bytes)
 * @param matrix Encoding matrix ((dataShards + parityShards) * dataShards bytes)
 * @param parity Output parity shards (parityShards * shardSize bytes)
 * @param dataShards Number of data shards (K)
 * @param parityShards Number of parity shards (M)
 * @param shardSize Size of each shard in bytes
 */
void encodeParallel(const uint8_t* data, const uint8_t* matrix,
                    uint8_t* parity, int dataShards, int parityShards,
                    size_t shardSize);

/**
 * Interleaved multiply-accumulate for better ILP
 * Processes 4 streams simultaneously
 * 
 * @param data Input data array
 * @param constant Multiplication constant
 * @param accum Accumulator array (modified in place)
 * @param len Length of arrays
 */
void mulAccum_interleaved(const uint8_t* data, uint8_t constant,
                          uint8_t* accum, size_t len);

/**
 * Batch encoding for multiple blocks
 * Optimized for encoding many small blocks
 * 
 * @param data Array of data block pointers
 * @param matrix Encoding matrix
 * @param parity Array of parity block pointers
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 * @param numBlocks Number of blocks to encode
 */
void encodeBatch(const uint8_t** data, const uint8_t* matrix,
                 uint8_t** parity, int dataShards, int parityShards,
                 size_t shardSize, int numBlocks);

} // namespace GF_SIMD

#endif // GF_SIMD_H
