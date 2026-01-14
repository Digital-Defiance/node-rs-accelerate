/**
 * Advanced SIMD optimizations for Galois Field operations
 * 
 * Creative hardware utilization techniques for maximum performance:
 * 
 * 1. ARM Crypto Extensions (PMULL/vmull_p8)
 *    - Polynomial multiplication is EXACTLY what GF(2^8) needs
 *    - vmull_p8 does carry-less multiply, we just need reduction
 * 
 * 2. NEON vtbl for hardware table lookups
 *    - vtbl can lookup 16 values in a single instruction
 *    - Split 256-entry tables into nibble-based lookups
 * 
 * 3. Grand Central Dispatch (GCD) for parallelism
 *    - Each parity shard is independent
 *    - dispatch_apply parallelizes across cores
 * 
 * 4. Interleaved processing for instruction-level parallelism
 *    - Process 4 independent streams to hide latency
 *    - Better utilization of execution units
 */

#include "gf_simd.h"
#include "gf_arithmetic.h"
#include <cstring>
#include <algorithm>
#include <vector>

#ifdef __ARM_NEON
#include <arm_neon.h>
#endif

#ifdef __APPLE__
#include <dispatch/dispatch.h>
#include <sys/sysctl.h>
#endif

namespace GF_SIMD {

// ============================================================================
// Lookup Tables
// ============================================================================

// Reduction table for polynomial multiplication
// After vmull_p8 gives 16-bit result, reduce mod primitive polynomial 0x11D
static uint8_t reduction_table[256];

// Nibble-based multiplication tables for vtbl
// For each constant c, we have:
//   mul_lo[c][nibble] = c * nibble (for nibble 0-15)
//   mul_hi[c][nibble] = c * (nibble << 4) (for nibble 0-15)
// Then: c * byte = mul_lo[c][byte & 0xF] ^ mul_hi[c][byte >> 4]
static uint8_t mul_lo_tables[256][16] __attribute__((aligned(16)));
static uint8_t mul_hi_tables[256][16] __attribute__((aligned(16)));

// Full multiplication tables (for non-vtbl path)
static uint8_t mul_tables[256][256];

static bool simd_initialized = false;
static int optimal_thread_count = 1;

// ============================================================================
// Initialization
// ============================================================================

void initSIMD() {
    if (simd_initialized) return;
    
    // Ensure base GF tables are initialized
    GF::initGF256();
    
    // Build reduction table for polynomial multiplication
    // vmull_p8 gives 16-bit result, we need to reduce mod 0x11D
    // reduction_table[hi_byte] = (hi_byte * 256) mod 0x11D
    for (int i = 0; i < 256; i++) {
        uint16_t val = i << 8;  // hi_byte * 256
        
        // Reduce: for each bit position 15 down to 8, if set, XOR with shifted polynomial
        for (int bit = 7; bit >= 0; bit--) {
            if (val & (1 << (bit + 8))) {
                val ^= (0x11D << bit);
            }
        }
        reduction_table[i] = val & 0xFF;
    }
    
    // Build nibble-based multiplication tables for vtbl
    for (int c = 0; c < 256; c++) {
        for (int nibble = 0; nibble < 16; nibble++) {
            mul_lo_tables[c][nibble] = GF::mul8(c, nibble);
            mul_hi_tables[c][nibble] = GF::mul8(c, nibble << 4);
        }
    }
    
    // Build full multiplication tables
    for (int c = 0; c < 256; c++) {
        if (c == 0) {
            memset(mul_tables[c], 0, 256);
        } else if (c == 1) {
            for (int i = 0; i < 256; i++) {
                mul_tables[c][i] = i;
            }
        } else {
            for (int i = 0; i < 256; i++) {
                mul_tables[c][i] = GF::mul8(c, i);
            }
        }
    }
    
    // Determine optimal thread count
#ifdef __APPLE__
    int ncpu;
    size_t len = sizeof(ncpu);
    if (sysctlbyname("hw.ncpu", &ncpu, &len, NULL, 0) == 0) {
        // Use performance cores only (typically half on Apple Silicon)
        optimal_thread_count = std::max(1, ncpu / 2);
    } else {
        optimal_thread_count = 4;  // Default for Apple Silicon
    }
#else
    optimal_thread_count = 4;
#endif
    
    simd_initialized = true;
}

bool isSIMDAvailable() {
#ifdef __ARM_NEON
    return true;
#else
    return false;
#endif
}

bool isMultiThreadAvailable() {
#ifdef __APPLE__
    return true;
#else
    return false;
#endif
}

int getOptimalThreadCount() {
    if (!simd_initialized) initSIMD();
    return optimal_thread_count;
}

// ============================================================================
// NEON vtbl-based multiplication
// ============================================================================

#ifdef __ARM_NEON

/**
 * Multiply vector by constant using NEON vtbl instruction
 * 
 * The trick: Split each byte into nibbles and use two 16-entry table lookups
 * c * byte = mul_lo[c][byte & 0xF] ^ mul_hi[c][byte >> 4]
 * 
 * vtbl can lookup 16 values simultaneously from a 16-byte table!
 */
void mulVecConstant_vtbl(const uint8_t* a, uint8_t constant, uint8_t* out, size_t len) {
    if (!simd_initialized) initSIMD();
    
    // Fast paths
    if (constant == 0) {
        memset(out, 0, len);
        return;
    }
    if (constant == 1) {
        if (a != out) memcpy(out, a, len);
        return;
    }
    
    // Load nibble tables for this constant into NEON registers
    uint8x16_t tbl_lo = vld1q_u8(mul_lo_tables[constant]);
    uint8x16_t tbl_hi = vld1q_u8(mul_hi_tables[constant]);
    
    // Mask for extracting low nibble
    uint8x16_t mask_0f = vdupq_n_u8(0x0F);
    
    size_t i = 0;
    
    // Process 64 bytes at a time (4 x 16-byte vectors)
    size_t vec64_len = len & ~63ULL;
    for (; i < vec64_len; i += 64) {
        // Prefetch next cache line
        __builtin_prefetch(&a[i + 64], 0, 3);
        
        // Load 4 vectors
        uint8x16_t v0 = vld1q_u8(&a[i]);
        uint8x16_t v1 = vld1q_u8(&a[i + 16]);
        uint8x16_t v2 = vld1q_u8(&a[i + 32]);
        uint8x16_t v3 = vld1q_u8(&a[i + 48]);
        
        // Extract low nibbles
        uint8x16_t lo0 = vandq_u8(v0, mask_0f);
        uint8x16_t lo1 = vandq_u8(v1, mask_0f);
        uint8x16_t lo2 = vandq_u8(v2, mask_0f);
        uint8x16_t lo3 = vandq_u8(v3, mask_0f);
        
        // Extract high nibbles (shift right by 4)
        uint8x16_t hi0 = vshrq_n_u8(v0, 4);
        uint8x16_t hi1 = vshrq_n_u8(v1, 4);
        uint8x16_t hi2 = vshrq_n_u8(v2, 4);
        uint8x16_t hi3 = vshrq_n_u8(v3, 4);
        
        // Table lookup for low nibbles
        uint8x16_t r_lo0 = vqtbl1q_u8(tbl_lo, lo0);
        uint8x16_t r_lo1 = vqtbl1q_u8(tbl_lo, lo1);
        uint8x16_t r_lo2 = vqtbl1q_u8(tbl_lo, lo2);
        uint8x16_t r_lo3 = vqtbl1q_u8(tbl_lo, lo3);
        
        // Table lookup for high nibbles
        uint8x16_t r_hi0 = vqtbl1q_u8(tbl_hi, hi0);
        uint8x16_t r_hi1 = vqtbl1q_u8(tbl_hi, hi1);
        uint8x16_t r_hi2 = vqtbl1q_u8(tbl_hi, hi2);
        uint8x16_t r_hi3 = vqtbl1q_u8(tbl_hi, hi3);
        
        // XOR results
        uint8x16_t r0 = veorq_u8(r_lo0, r_hi0);
        uint8x16_t r1 = veorq_u8(r_lo1, r_hi1);
        uint8x16_t r2 = veorq_u8(r_lo2, r_hi2);
        uint8x16_t r3 = veorq_u8(r_lo3, r_hi3);
        
        // Store results
        vst1q_u8(&out[i], r0);
        vst1q_u8(&out[i + 16], r1);
        vst1q_u8(&out[i + 32], r2);
        vst1q_u8(&out[i + 48], r3);
    }
    
    // Process remaining 16 bytes at a time
    for (; i + 16 <= len; i += 16) {
        uint8x16_t v = vld1q_u8(&a[i]);
        uint8x16_t lo = vandq_u8(v, mask_0f);
        uint8x16_t hi = vshrq_n_u8(v, 4);
        uint8x16_t r_lo = vqtbl1q_u8(tbl_lo, lo);
        uint8x16_t r_hi = vqtbl1q_u8(tbl_hi, hi);
        vst1q_u8(&out[i], veorq_u8(r_lo, r_hi));
    }
    
    // Handle remaining bytes with scalar
    const uint8_t* table = mul_tables[constant];
    for (; i < len; i++) {
        out[i] = table[a[i]];
    }
}

/**
 * Polynomial multiply using ARM crypto extensions (vmull_p8)
 * 
 * vmull_p8 performs carry-less (polynomial) multiplication:
 * - Input: two 8-byte vectors of poly8_t
 * - Output: 8-element vector of poly16_t (16-bit results)
 * 
 * For GF(2^8), we need to reduce the 16-bit result mod primitive polynomial
 */
void mulVec_pmull(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    if (!simd_initialized) initSIMD();
    
    size_t i = 0;
    
    // Process 8 elements at a time using vmull_p8
    size_t vec8_len = len & ~7ULL;
    for (; i < vec8_len; i += 8) {
        // Load as polynomial types
        poly8x8_t va = vld1_p8((const poly8_t*)&a[i]);
        poly8x8_t vb = vld1_p8((const poly8_t*)&b[i]);
        
        // Polynomial multiply (gives 16-bit results)
        poly16x8_t product = vmull_p8(va, vb);
        
        // Reinterpret as uint16 for extraction
        uint16x8_t prod_u16 = vreinterpretq_u16_p16(product);
        
        // Extract low and high bytes
        uint8x8_t lo = vmovn_u16(prod_u16);
        uint8x8_t hi = vshrn_n_u16(prod_u16, 8);
        
        // Apply reduction table to high bytes
        uint8_t hi_arr[8];
        vst1_u8(hi_arr, hi);
        
        uint8_t reduced_arr[8];
        for (int j = 0; j < 8; j++) {
            reduced_arr[j] = reduction_table[hi_arr[j]];
        }
        uint8x8_t reduced = vld1_u8(reduced_arr);
        
        // Final result: lo XOR reduced_hi
        uint8x8_t result = veor_u8(lo, reduced);
        vst1_u8(&out[i], result);
    }
    
    // Handle remaining elements with scalar
    for (; i < len; i++) {
        out[i] = GF::mul8(a[i], b[i]);
    }
}

/**
 * Interleaved multiply-accumulate for better instruction-level parallelism
 * 
 * Process 4 independent streams to:
 * - Hide memory latency
 * - Better utilize execution units
 * - Improve instruction-level parallelism
 */
void mulAccum_interleaved(const uint8_t* data, uint8_t constant,
                          uint8_t* accum, size_t len) {
    if (!simd_initialized) initSIMD();
    
    // Fast paths
    if (constant == 0) return;
    
    if (constant == 1) {
        // Just XOR
        size_t i = 0;
        size_t vec_len = len & ~63ULL;
        for (; i < vec_len; i += 64) {
            uint8x16_t a0 = vld1q_u8(&accum[i]);
            uint8x16_t a1 = vld1q_u8(&accum[i + 16]);
            uint8x16_t a2 = vld1q_u8(&accum[i + 32]);
            uint8x16_t a3 = vld1q_u8(&accum[i + 48]);
            
            uint8x16_t d0 = vld1q_u8(&data[i]);
            uint8x16_t d1 = vld1q_u8(&data[i + 16]);
            uint8x16_t d2 = vld1q_u8(&data[i + 32]);
            uint8x16_t d3 = vld1q_u8(&data[i + 48]);
            
            vst1q_u8(&accum[i], veorq_u8(a0, d0));
            vst1q_u8(&accum[i + 16], veorq_u8(a1, d1));
            vst1q_u8(&accum[i + 32], veorq_u8(a2, d2));
            vst1q_u8(&accum[i + 48], veorq_u8(a3, d3));
        }
        for (; i < len; i++) {
            accum[i] ^= data[i];
        }
        return;
    }
    
    // Load nibble tables
    uint8x16_t tbl_lo = vld1q_u8(mul_lo_tables[constant]);
    uint8x16_t tbl_hi = vld1q_u8(mul_hi_tables[constant]);
    uint8x16_t mask_0f = vdupq_n_u8(0x0F);
    
    size_t i = 0;
    
    // Process 64 bytes at a time with interleaved operations
    size_t vec64_len = len & ~63ULL;
    for (; i < vec64_len; i += 64) {
        // Prefetch
        __builtin_prefetch(&data[i + 64], 0, 3);
        __builtin_prefetch(&accum[i + 64], 0, 3);
        
        // Load data (4 vectors)
        uint8x16_t d0 = vld1q_u8(&data[i]);
        uint8x16_t d1 = vld1q_u8(&data[i + 16]);
        uint8x16_t d2 = vld1q_u8(&data[i + 32]);
        uint8x16_t d3 = vld1q_u8(&data[i + 48]);
        
        // Load accumulators (4 vectors)
        uint8x16_t a0 = vld1q_u8(&accum[i]);
        uint8x16_t a1 = vld1q_u8(&accum[i + 16]);
        uint8x16_t a2 = vld1q_u8(&accum[i + 32]);
        uint8x16_t a3 = vld1q_u8(&accum[i + 48]);
        
        // Extract nibbles (interleaved to hide latency)
        uint8x16_t lo0 = vandq_u8(d0, mask_0f);
        uint8x16_t hi0 = vshrq_n_u8(d0, 4);
        uint8x16_t lo1 = vandq_u8(d1, mask_0f);
        uint8x16_t hi1 = vshrq_n_u8(d1, 4);
        uint8x16_t lo2 = vandq_u8(d2, mask_0f);
        uint8x16_t hi2 = vshrq_n_u8(d2, 4);
        uint8x16_t lo3 = vandq_u8(d3, mask_0f);
        uint8x16_t hi3 = vshrq_n_u8(d3, 4);
        
        // Table lookups (interleaved)
        uint8x16_t r_lo0 = vqtbl1q_u8(tbl_lo, lo0);
        uint8x16_t r_hi0 = vqtbl1q_u8(tbl_hi, hi0);
        uint8x16_t r_lo1 = vqtbl1q_u8(tbl_lo, lo1);
        uint8x16_t r_hi1 = vqtbl1q_u8(tbl_hi, hi1);
        uint8x16_t r_lo2 = vqtbl1q_u8(tbl_lo, lo2);
        uint8x16_t r_hi2 = vqtbl1q_u8(tbl_hi, hi2);
        uint8x16_t r_lo3 = vqtbl1q_u8(tbl_lo, lo3);
        uint8x16_t r_hi3 = vqtbl1q_u8(tbl_hi, hi3);
        
        // Combine and accumulate (interleaved)
        uint8x16_t m0 = veorq_u8(r_lo0, r_hi0);
        uint8x16_t m1 = veorq_u8(r_lo1, r_hi1);
        uint8x16_t m2 = veorq_u8(r_lo2, r_hi2);
        uint8x16_t m3 = veorq_u8(r_lo3, r_hi3);
        
        // Final XOR with accumulator
        vst1q_u8(&accum[i], veorq_u8(a0, m0));
        vst1q_u8(&accum[i + 16], veorq_u8(a1, m1));
        vst1q_u8(&accum[i + 32], veorq_u8(a2, m2));
        vst1q_u8(&accum[i + 48], veorq_u8(a3, m3));
    }
    
    // Handle remaining bytes
    const uint8_t* table = mul_tables[constant];
    for (; i < len; i++) {
        accum[i] ^= table[data[i]];
    }
}

#else // No NEON

void mulVecConstant_vtbl(const uint8_t* a, uint8_t constant, uint8_t* out, size_t len) {
    if (!simd_initialized) initSIMD();
    const uint8_t* table = mul_tables[constant];
    for (size_t i = 0; i < len; i++) {
        out[i] = table[a[i]];
    }
}

void mulVec_pmull(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    GF::initGF256();
    for (size_t i = 0; i < len; i++) {
        out[i] = GF::mul8(a[i], b[i]);
    }
}

void mulAccum_interleaved(const uint8_t* data, uint8_t constant,
                          uint8_t* accum, size_t len) {
    if (!simd_initialized) initSIMD();
    const uint8_t* table = mul_tables[constant];
    for (size_t i = 0; i < len; i++) {
        accum[i] ^= table[data[i]];
    }
}

#endif // __ARM_NEON

// ============================================================================
// Multi-threaded encoding with Grand Central Dispatch
// ============================================================================

#ifdef __APPLE__

/**
 * Encode a single parity shard
 * This is the work unit for parallel encoding
 */
static void encodeSingleParity(const uint8_t* data, const uint8_t* coeffs,
                               uint8_t* parity, int dataShards, size_t shardSize) {
    // Initialize parity to zero
    memset(parity, 0, shardSize);
    
    // Accumulate: parity = sum(data[d] * coeffs[d]) for all d
    for (int d = 0; d < dataShards; d++) {
        uint8_t coeff = coeffs[d];
        if (coeff == 0) continue;
        
        const uint8_t* dataPtr = &data[d * shardSize];
        
        if (coeff == 1) {
            // Just XOR
#ifdef __ARM_NEON
            size_t i = 0;
            size_t vec_len = shardSize & ~63ULL;
            for (; i < vec_len; i += 64) {
                uint8x16_t p0 = vld1q_u8(&parity[i]);
                uint8x16_t p1 = vld1q_u8(&parity[i + 16]);
                uint8x16_t p2 = vld1q_u8(&parity[i + 32]);
                uint8x16_t p3 = vld1q_u8(&parity[i + 48]);
                
                uint8x16_t d0 = vld1q_u8(&dataPtr[i]);
                uint8x16_t d1 = vld1q_u8(&dataPtr[i + 16]);
                uint8x16_t d2 = vld1q_u8(&dataPtr[i + 32]);
                uint8x16_t d3 = vld1q_u8(&dataPtr[i + 48]);
                
                vst1q_u8(&parity[i], veorq_u8(p0, d0));
                vst1q_u8(&parity[i + 16], veorq_u8(p1, d1));
                vst1q_u8(&parity[i + 32], veorq_u8(p2, d2));
                vst1q_u8(&parity[i + 48], veorq_u8(p3, d3));
            }
            for (; i < shardSize; i++) {
                parity[i] ^= dataPtr[i];
            }
#else
            for (size_t i = 0; i < shardSize; i++) {
                parity[i] ^= dataPtr[i];
            }
#endif
        } else {
            // Multiply and accumulate using interleaved SIMD
            mulAccum_interleaved(dataPtr, coeff, parity, shardSize);
        }
    }
}

void encodeParallel(const uint8_t* data, const uint8_t* matrix,
                    uint8_t* parity, int dataShards, int parityShards,
                    size_t shardSize) {
    if (!simd_initialized) initSIMD();
    
    // For small shard counts or sizes, use single-threaded
    if (parityShards < 2 || shardSize < 4096) {
        for (int p = 0; p < parityShards; p++) {
            const uint8_t* coeffs = &matrix[(dataShards + p) * dataShards];
            uint8_t* parityPtr = &parity[p * shardSize];
            encodeSingleParity(data, coeffs, parityPtr, dataShards, shardSize);
        }
        return;
    }
    
    // Use GCD to parallelize parity shard computation
    dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0);
    
    dispatch_apply(parityShards, queue, ^(size_t p) {
        const uint8_t* coeffs = &matrix[(dataShards + p) * dataShards];
        uint8_t* parityPtr = &parity[p * shardSize];
        encodeSingleParity(data, coeffs, parityPtr, dataShards, shardSize);
    });
}

void encodeBatch(const uint8_t** data, const uint8_t* matrix,
                 uint8_t** parity, int dataShards, int parityShards,
                 size_t shardSize, int numBlocks) {
    if (!simd_initialized) initSIMD();
    
    // For small batches, process sequentially
    if (numBlocks < 4) {
        for (int block = 0; block < numBlocks; block++) {
            encodeParallel(data[block], matrix, parity[block],
                          dataShards, parityShards, shardSize);
        }
        return;
    }
    
    // Parallelize across blocks
    dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0);
    
    dispatch_apply(numBlocks, queue, ^(size_t block) {
        // For each block, encode all parity shards
        for (int p = 0; p < parityShards; p++) {
            const uint8_t* coeffs = &matrix[(dataShards + p) * dataShards];
            uint8_t* parityPtr = &parity[block][p * shardSize];
            encodeSingleParity(data[block], coeffs, parityPtr, dataShards, shardSize);
        }
    });
}

#else // Non-Apple platforms

void encodeParallel(const uint8_t* data, const uint8_t* matrix,
                    uint8_t* parity, int dataShards, int parityShards,
                    size_t shardSize) {
    if (!simd_initialized) initSIMD();
    
    for (int p = 0; p < parityShards; p++) {
        const uint8_t* coeffs = &matrix[(dataShards + p) * dataShards];
        uint8_t* parityPtr = &parity[p * shardSize];
        
        memset(parityPtr, 0, shardSize);
        
        for (int d = 0; d < dataShards; d++) {
            uint8_t coeff = coeffs[d];
            if (coeff == 0) continue;
            
            const uint8_t* dataPtr = &data[d * shardSize];
            const uint8_t* table = mul_tables[coeff];
            
            for (size_t i = 0; i < shardSize; i++) {
                parityPtr[i] ^= table[dataPtr[i]];
            }
        }
    }
}

void encodeBatch(const uint8_t** data, const uint8_t* matrix,
                 uint8_t** parity, int dataShards, int parityShards,
                 size_t shardSize, int numBlocks) {
    for (int block = 0; block < numBlocks; block++) {
        encodeParallel(data[block], matrix, parity[block],
                      dataShards, parityShards, shardSize);
    }
}

#endif // __APPLE__

} // namespace GF_SIMD
