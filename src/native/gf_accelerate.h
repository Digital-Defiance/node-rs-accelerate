/**
 * Cache- and NEON-optimized Galois Field operations
 * 
 * Despite the "Accelerate" name, this module does not call into Apple's
 * Accelerate framework. vDSP has no XOR primitive and no uint8 GF
 * multiplication, so every kernel here is hand-written NEON (veorq_u8 /
 * vst1q_u8) over precomputed lookup tables. See the note at
 * gf_arithmetic.cc:mulVec8Accelerated for the same reasoning.
 *
 * The name is kept for API compatibility: "Accelerated" here means
 * "table-driven + NEON + cache-blocked", not "vDSP".
 * 
 * Key optimizations:
 * 1. Cache-optimized matrix operations using tiled/blocked algorithms
 * 2. Precomputed multiplication tables for constant multipliers
 * 3. NEON SIMD for parallel GF operations
 * 4. Memory prefetching for large data operations
 */

#ifndef GF_ACCELERATE_H
#define GF_ACCELERATE_H

#include <cstdint>
#include <cstddef>

namespace GF_Accelerate {
    // Initialize Accelerate-optimized tables
    void initAccelerate();
    
    // Check if Accelerate optimizations are available
    bool isAccelerateAvailable();
    
    /**
     * Ultra-fast matrix-vector multiply for Reed-Solomon encoding
     * 
     * This is THE critical operation for encoding performance.
     * Uses a combination of:
     * - Precomputed multiplication tables (256 entries per vector element)
     * - Cache-blocked algorithm for large matrices
     * - NEON SIMD for parallel XOR accumulation
     * 
     * @param matrix Encoding matrix (rows × cols) in row-major order
     * @param vec Input vector (cols elements)
     * @param out Output vector (rows elements)
     * @param rows Number of rows (typically K+M for encoding)
     * @param cols Number of columns (typically K for encoding)
     */
    void matVecMulGF_Accelerate(const uint8_t* matrix, const uint8_t* vec,
                                 uint8_t* out, int rows, int cols);
    
    /**
     * Batch matrix-vector multiply for encoding multiple shards
     * 
     * Encodes multiple data blocks in parallel, maximizing cache utilization.
     * 
     * @param matrix Encoding matrix (rows × cols)
     * @param data Input data (numBlocks × cols × shardSize)
     * @param out Output data (numBlocks × rows × shardSize)
     * @param rows Number of rows in matrix
     * @param cols Number of columns in matrix
     * @param shardSize Size of each shard in bytes
     * @param numBlocks Number of data blocks to encode
     */
    void batchMatVecMulGF_Accelerate(const uint8_t* matrix, const uint8_t* data,
                                      uint8_t* out, int rows, int cols,
                                      size_t shardSize, int numBlocks);
    
    /**
     * Optimized encoding using precomputed tables
     * 
     * For each parity shard, computes:
     *   parity[i] = sum(data[j] * matrix[parityRow][j]) for all j
     * 
     * Uses precomputed multiplication tables for each matrix coefficient.
     * 
     * @param data Input data shards (dataShards × shardSize)
     * @param matrix Encoding matrix ((dataShards + parityShards) × dataShards)
     * @param parity Output parity shards (parityShards × shardSize)
     * @param dataShards Number of data shards (K)
     * @param parityShards Number of parity shards (M)
     * @param shardSize Size of each shard in bytes
     */
    void encodeAccelerate(const uint8_t* data, const uint8_t* matrix,
                          uint8_t* parity, int dataShards, int parityShards,
                          size_t shardSize);
    
    /**
     * Memory-bandwidth-limited XOR
     * 
     * Implemented with NEON (veorq_u8) over cache-friendly chunks; vDSP has no
     * XOR primitive.
     */
    void xorAccelerate(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
    
    /**
     * Multiply-accumulate: accum ^= data * constant
     * 
     * The core operation for encoding. Uses precomputed table for the constant.
     */
    void mulAccumAccelerate(const uint8_t* data, uint8_t constant,
                            uint8_t* accum, size_t len);
}

#endif // GF_ACCELERATE_H
