/**
 * M4 Max Extreme Optimizations for Galois Field Operations
 * 
 * This file implements M4 Max-specific hardware exploitation:
 * 
 * 1. Wide NEON Table Lookup
 *    - 128-bit NEON vectors via vqtbl/veor intrinsics
 *    - Matrix work is expressed as blocked NEON table lookups, not as
 *      coprocessor matrix ops
 *    - NOTE: this module contains no SME (Scalable Matrix Extension) code.
 *      isSMEAvailable() reports whether the CPU has SME; nothing here uses it.
 * 
 * 2. 16 P-Core Saturation
 *    - Full utilization of all performance cores
 *    - Real-time QoS priority
 *    - NUMA-aware memory allocation
 * 
 * 3. 4-Way Unrolled Accumulation
 *    - Independent accumulator chains
 *    - Maximum instruction-level parallelism
 *    - Eliminates dependency stalls
 * 
 * 4. RAX1 (Rotate and XOR)
 *    - SHA3 extension for 4-way XOR
 *    - Combined with veor3 for maximum throughput
 * 
 * 5. Memory Bandwidth Optimization
 *    - 546 GB/s unified memory targeting
 *    - Cache line aligned operations
 *    - Huge page support for TLB efficiency
 */

#ifndef GF_M4MAX_H
#define GF_M4MAX_H

#include <cstdint>
#include <cstddef>

namespace GF_M4Max {

/**
 * Initialize M4 Max optimizations
 */
void initM4Max();

/**
 * Check whether the host CPU is expected to have SME (Scalable Matrix
 * Extension), which on Apple Silicon means M4 or later.
 *
 * Contract: this is a *hardware capability predicate only*. macOS does not
 * expose an SME feature flag through the usual ARM feature macros or sysctl
 * keys, so the check is a CPU brand-string match on "M4" and relies on the
 * fact that every M4 variant ships SME.
 *
 * It does NOT indicate that any code path in this library uses SME - none
 * does. All kernels here are NEON. Treat a true result as "the machine is an
 * M4-class chip", nothing more.
 */
bool isSMEAvailable();

/**
 * Check if we're running on M4 Max specifically
 */
bool isM4Max();

/**
 * Get the number of performance cores available
 */
int getPerformanceCoreCount();

/**
 * Get the number of efficiency cores available
 */
int getEfficiencyCoreCount();

/**
 * Get measured memory bandwidth in GB/s
 */
double getMeasuredMemoryBandwidth();

/**
 * 4-Way Unrolled Multiply-Accumulate
 * 
 * Uses 4 independent accumulator chains to maximize ILP.
 * Each chain processes 16 bytes, total 64 bytes per iteration.
 * Eliminates dependency stalls between iterations.
 * 
 * @param data Input data array
 * @param coeff GF coefficient
 * @param accum Accumulator (modified in place)
 * @param len Length of arrays
 */
void mulAccum4Way(const uint8_t* data, uint8_t coeff, uint8_t* accum, size_t len);

/**
 * 8-Way Unrolled Multiply-Accumulate
 * 
 * Even more aggressive unrolling for maximum throughput.
 * Uses all 32 NEON registers effectively.
 * 
 * @param data Input data array
 * @param coeff GF coefficient
 * @param accum Accumulator (modified in place)
 * @param len Length of arrays
 */
void mulAccum8Way(const uint8_t* data, uint8_t coeff, uint8_t* accum, size_t len);

/**
 * 4-Way XOR using RAX1 + veor3
 * 
 * Computes: out = a ^ b ^ c ^ d using optimal instruction mix
 * 
 * @param a First operand
 * @param b Second operand
 * @param c Third operand
 * @param d Fourth operand
 * @param out Output array
 * @param len Length of arrays
 */
void xor4Vec(const uint8_t* a, const uint8_t* b, const uint8_t* c,
             const uint8_t* d, uint8_t* out, size_t len);

/**
 * Quad Multiply-Accumulate with 4-way XOR
 * 
 * Computes: accum ^= (d1*c1) ^ (d2*c2) ^ (d3*c3) ^ (d4*c4)
 * Processes 4 data shards simultaneously for maximum throughput.
 * 
 * @param data1-4 Data arrays
 * @param coeff1-4 Coefficients
 * @param accum Accumulator (modified in place)
 * @param len Length of arrays
 */
void mulAccum4_xor4(const uint8_t* data1, uint8_t coeff1,
                    const uint8_t* data2, uint8_t coeff2,
                    const uint8_t* data3, uint8_t coeff3,
                    const uint8_t* data4, uint8_t coeff4,
                    uint8_t* accum, size_t len);

/**
 * Full 16-Core Parallel Encoding
 * 
 * Saturates all 16 performance cores on M4 Max.
 * Uses real-time QoS for maximum priority.
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encode16Core(const uint8_t* data, const uint8_t* matrix,
                  uint8_t* parity, int dataShards, int parityShards,
                  size_t shardSize);

/**
 * Huge Page Encoding
 * 
 * Uses 16MB huge pages to reduce TLB misses.
 * Critical for multi-GB encoding operations.
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encodeHugePage(const uint8_t* data, const uint8_t* matrix,
                    uint8_t* parity, int dataShards, int parityShards,
                    size_t shardSize);

/**
 * Cache-Line Aligned Encoding
 * 
 * Ensures all operations are 128-byte aligned for optimal
 * cache line utilization on M4.
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encodeCacheAligned(const uint8_t* data, const uint8_t* matrix,
                        uint8_t* parity, int dataShards, int parityShards,
                        size_t shardSize);

/**
 * Bandwidth-Optimized Encoding
 * 
 * Targets maximum memory bandwidth utilization (546 GB/s on M4 Max).
 * Uses streaming loads/stores and optimal prefetch distances.
 * 
 * @param data Input data shards
 * @param matrix Encoding matrix
 * @param parity Output parity shards
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @param shardSize Size of each shard
 */
void encodeBandwidthOptimized(const uint8_t* data, const uint8_t* matrix,
                              uint8_t* parity, int dataShards, int parityShards,
                              size_t shardSize);

/**
 * Get optimal encoding function for given parameters
 * 
 * Analyzes hardware capabilities and workload to select best strategy.
 * 
 * @param shardSize Size of each shard
 * @param dataShards Number of data shards
 * @param parityShards Number of parity shards
 * @return Strategy identifier
 */
int getOptimalM4Strategy(size_t shardSize, int dataShards, int parityShards);

/**
 * Benchmark memory bandwidth
 * 
 * Measures actual achievable memory bandwidth for calibration.
 * 
 * @return Measured bandwidth in GB/s
 */
double benchmarkMemoryBandwidth();

/**
 * Set thread affinity to performance cores only
 * 
 * Ensures encoding runs on P-cores, not E-cores.
 */
void pinToPerformanceCores();

/**
 * Set real-time QoS class for current thread
 * 
 * Maximizes scheduling priority for encoding operations.
 */
void setRealtimeQoS();

} // namespace GF_M4Max

#endif // GF_M4MAX_H
