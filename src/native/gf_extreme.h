/**
 * Extreme Hardware Optimizations for Galois Field Operations
 * 
 * This file implements unconventional hardware exploitation techniques:
 * 
 * 1. CRC32 Instruction Abuse
 *    - ARM CRC32 does polynomial arithmetic - exactly what GF needs!
 *    - crc32cb performs carry-less multiply with reduction
 *    - We can adapt this for GF(2^8) with custom reduction
 * 
 * 2. Three-Way XOR (veor3q_u8)
 *    - ARM v8.2+ has three-operand XOR
 *    - Reduces instruction count by 33% for accumulation chains
 * 
 * 3. Bit Clear And XOR (vbcaxq_u8)
 *    - Conditional XOR based on mask
 *    - Useful for sparse matrix operations
 * 
 * 4. Software Pipelining with Prefetch
 *    - Overlap memory operations with computation
 *    - Achieve near-theoretical memory bandwidth
 * 
 * 5. Non-Temporal Stores
 *    - Bypass cache for large sequential writes
 *    - Prevents cache pollution
 * 
 * 6. Huge Page Support
 *    - Reduce TLB misses for large buffers
 *    - Critical for multi-MB encoding operations
 */

#ifndef GF_EXTREME_H
#define GF_EXTREME_H

#include <cstdint>
#include <cstddef>

namespace GF_Extreme {

/**
 * Initialize extreme optimization tables and structures
 */
void initExtreme();

/**
 * Check if CRC32 instructions are available
 */
bool isCRC32Available();

/**
 * Check if three-way XOR (veor3) is available (ARM v8.2+)
 */
bool isVeor3Available();

/**
 * GF multiply using CRC32 instruction abuse
 * 
 * The CRC32 instruction performs polynomial multiplication with reduction.
 * We adapt it for GF(2^8) by using a custom polynomial.
 * 
 * @param a First operand array
 * @param b Second operand array  
 * @param out Output array
 * @param len Length of arrays
 */
void mulVec_crc32(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);

/**
 * Three-way XOR accumulation using veor3q_u8
 * 
 * Computes: out = a ^ b ^ c in a single instruction
 * 33% fewer instructions than two separate XORs
 * 
 * @param a First operand
 * @param b Second operand
 * @param c Third operand
 * @param out Output array
 * @param len Length of arrays
 */
void xor3Vec(const uint8_t* a, const uint8_t* b, const uint8_t* c,
             uint8_t* out, size_t len);

/**
 * Multi-accumulate with three-way XOR
 * 
 * Computes: accum ^= (data1 * coeff1) ^ (data2 * coeff2)
 * Uses veor3 to combine two multiply-accumulates efficiently
 * 
 * @param data1 First data array
 * @param coeff1 First coefficient
 * @param data2 Second data array
 * @param coeff2 Second coefficient
 * @param accum Accumulator (modified in place)
 * @param len Length of arrays
 */
void mulAccum2_veor3(const uint8_t* data1, uint8_t coeff1,
                     const uint8_t* data2, uint8_t coeff2,
                     uint8_t* accum, size_t len);

/**
 * Software-pipelined encoding with prefetch
 * 
 * Overlaps memory operations with computation:
 * - Prefetch next iteration's data
 * - Compute current iteration
 * - Store previous iteration's results
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encodePipelined(const uint8_t* data, const uint8_t* matrix,
                     uint8_t* parity, int dataShards, int parityShards,
                     size_t shardSize);

/**
 * Encoding with non-temporal stores
 * 
 * Uses streaming stores to bypass cache for large outputs.
 * Prevents cache pollution when encoding large files.
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encodeNonTemporal(const uint8_t* data, const uint8_t* matrix,
                       uint8_t* parity, int dataShards, int parityShards,
                       size_t shardSize);

/**
 * Batch multiply-accumulate for multiple coefficients
 * 
 * Processes multiple data shards simultaneously to maximize ILP.
 * Uses register blocking to keep intermediate results in registers.
 * 
 * @param data Array of data shard pointers
 * @param coeffs Array of coefficients
 * @param numShards Number of shards to process
 * @param accum Accumulator (modified in place)
 * @param len Length of each shard
 */
void mulAccumBatch(const uint8_t** data, const uint8_t* coeffs,
                   int numShards, uint8_t* accum, size_t len);

/**
 * Dot product optimized for sparse matrices
 * 
 * Uses vbcax (bit clear and XOR) for conditional accumulation.
 * Efficient when many matrix coefficients are 0 or 1.
 * 
 * @param data Input data
 * @param coeffs Coefficient array
 * @param numCoeffs Number of coefficients
 * @param out Output (single element per call)
 * @param stride Stride between data elements
 */
void sparseDotProduct(const uint8_t* data, const uint8_t* coeffs,
                      int numCoeffs, uint8_t* out, size_t stride);

/**
 * Get optimal encoding strategy based on parameters
 * 
 * Returns the best encoding function to use based on:
 * - Shard size
 * - Number of data/parity shards
 * - Available hardware features
 * 
 * @param shardSize Size of each shard
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @return Strategy identifier (0=parallel, 1=pipelined, 2=non-temporal)
 */
int getOptimalStrategy(size_t shardSize, int dataShards, int parityShards);

} // namespace GF_Extreme

#endif // GF_EXTREME_H
