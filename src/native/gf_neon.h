/**
 * ARM NEON optimized Galois Field operations
 * 
 * Uses creative NEON instructions for massive speedups:
 * - vmull_p8: Polynomial multiplication (carry-less multiply)
 * - vtbl: Hardware table lookup (16 elements at once)
 * - veor: Vectorized XOR (16 bytes at once)
 * - vclz: Count leading zeros for fast operations
 */

#ifndef GF_NEON_H
#define GF_NEON_H

#include <cstdint>
#include <cstddef>

#ifdef __ARM_NEON
#include <arm_neon.h>
#endif

namespace GF_NEON {
    // Initialize NEON-optimized lookup tables
    void initNEON();
    
    // Check if NEON is available
    bool isNEONAvailable();
    
    // NEON-optimized vectorized operations
    void mulVec8_NEON(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
    void addVec8_NEON(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
    
    // Multiply vector by constant (very fast with precomputed table)
    void mulVecConstant8_NEON(const uint8_t* a, uint8_t constant, uint8_t* out, size_t len);
    
    // Matrix-vector multiply optimized for NEON
    void matVecMul8_NEON(const uint8_t* matrix, const uint8_t* vec, 
                         uint8_t* out, int rows, int cols);
    
    // Polynomial multiplication using NEON pmull instruction
    // This is the key innovation - using crypto instructions for GF arithmetic!
    void polyMul8_NEON(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
    
    // Batch operations for encoding (process multiple shards at once)
    void batchMulAdd8_NEON(const uint8_t* data, const uint8_t* coeffs,
                           uint8_t* accum, int numCoeffs, size_t shardSize);
}

#endif // GF_NEON_H
