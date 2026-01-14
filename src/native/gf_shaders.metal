/**
 * Metal compute shaders for Galois Field operations
 */

#include <metal_stdlib>
using namespace metal;

/**
 * GF(2^8) multiplication kernel using lookup tables
 * 
 * Performs element-wise GF(2^8) multiplication on two arrays
 * using logarithm and antilogarithm lookup tables.
 * 
 * Formula: a * b = antilog[(log[a] + log[b]) mod 255]
 * Special case: 0 * x = 0
 */
kernel void gf256_mul_kernel(
    device const uint8_t* a [[buffer(0)]],
    device const uint8_t* b [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    device const uint8_t* log_table [[buffer(3)]],
    device const uint8_t* antilog_table [[buffer(4)]],
    uint id [[thread_position_in_grid]])
{
    uint8_t val_a = a[id];
    uint8_t val_b = b[id];
    
    // Handle zero case
    if (val_a == 0 || val_b == 0) {
        result[id] = 0;
    } else {
        // Lookup-based GF multiplication
        uint8_t log_a = log_table[val_a];
        uint8_t log_b = log_table[val_b];
        uint16_t log_sum = (uint16_t)log_a + (uint16_t)log_b;
        
        // Modulo 255 for GF(2^8)
        if (log_sum >= 255) {
            log_sum -= 255;
        }
        
        result[id] = antilog_table[log_sum];
    }
}

/**
 * GF(2^8) addition kernel
 * 
 * Performs element-wise GF(2^8) addition (XOR) on two arrays.
 * In GF(2^8), addition is simply XOR.
 */
kernel void gf256_add_kernel(
    device const uint8_t* a [[buffer(0)]],
    device const uint8_t* b [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    uint id [[thread_position_in_grid]])
{
    result[id] = a[id] ^ b[id];
}

/**
 * GF(2^16) multiplication kernel using lookup tables
 * 
 * Performs element-wise GF(2^16) multiplication on two arrays
 * using logarithm and antilogarithm lookup tables.
 * 
 * Formula: a * b = antilog[(log[a] + log[b]) mod 65535]
 * Special case: 0 * x = 0
 */
kernel void gf65536_mul_kernel(
    device const uint16_t* a [[buffer(0)]],
    device const uint16_t* b [[buffer(1)]],
    device uint16_t* result [[buffer(2)]],
    device const uint16_t* log_table [[buffer(3)]],
    device const uint16_t* antilog_table [[buffer(4)]],
    uint id [[thread_position_in_grid]])
{
    uint16_t val_a = a[id];
    uint16_t val_b = b[id];
    
    // Handle zero case
    if (val_a == 0 || val_b == 0) {
        result[id] = 0;
    } else {
        // Lookup-based GF multiplication
        uint16_t log_a = log_table[val_a];
        uint16_t log_b = log_table[val_b];
        uint32_t log_sum = (uint32_t)log_a + (uint32_t)log_b;
        
        // Modulo 65535 for GF(2^16)
        if (log_sum >= 65535) {
            log_sum -= 65535;
        }
        
        result[id] = antilog_table[log_sum];
    }
}

/**
 * GF(2^16) addition kernel
 * 
 * Performs element-wise GF(2^16) addition (XOR) on two arrays.
 * In GF(2^16), addition is simply XOR.
 */
kernel void gf65536_add_kernel(
    device const uint16_t* a [[buffer(0)]],
    device const uint16_t* b [[buffer(1)]],
    device uint16_t* result [[buffer(2)]],
    uint id [[thread_position_in_grid]])
{
    result[id] = a[id] ^ b[id];
}
