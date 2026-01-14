# Optimization Implementation Guide

## Quick Start: Implementing ARM NEON Optimizations

This guide shows how to implement the highest-impact performance optimizations for Apple Silicon.

## Phase 1: ARM NEON for XOR Operations (Easiest, High Impact)

### Step 1: Add NEON Headers

In `src/native/gf_arithmetic.cc`, add:

```cpp
#ifdef __ARM_NEON
#include <arm_neon.h>
#endif
```

### Step 2: Implement NEON XOR

Replace `addVec8Accelerated` with:

```cpp
void addVec8Accelerated(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
#ifdef __ARM_NEON
    size_t i = 0;
    
    // Process 16 bytes at a time using NEON
    size_t vec_len = len - (len % 16);
    for (; i < vec_len; i += 16) {
        uint8x16_t va = vld1q_u8(&a[i]);
        uint8x16_t vb = vld1q_u8(&b[i]);
        uint8x16_t result = veorq_u8(va, vb);
        vst1q_u8(&out[i], result);
    }
    
    // Handle remaining elements
    for (; i < len; i++) {
        out[i] = a[i] ^ b[i];
    }
#else
    addVec8(a, b, out, len);
#endif
}
```

**Expected Result:** 8-16x speedup for XOR operations

### Step 3: Update Compiler Flags

In `binding.gyp`, update `xcode_settings`:

```python
'xcode_settings': {
    'OTHER_CFLAGS': [
        '-std=c++17',
        '-ObjC++',
        '-O3',                      # Maximum optimization
        '-march=armv8.2-a+fp16',    # Target Apple Silicon
        '-ffast-math',              # Aggressive math optimizations
        '-funroll-loops',           # Unroll loops
    ],
    'OTHER_LDFLAGS': [
        '-framework Accelerate',
        '-framework Metal',
        '-framework Foundation'
    ]
}
```

### Step 4: Rebuild and Test

```bash
npm run clean
npm run build
node benchmarks/gf_operations.js
```

**Expected:** GF(2^8) XOR speedup from 1.3x to 8-12x

## Phase 2: NEON for GF Multiplication (Medium Difficulty, High Impact)

### Challenge: Lookup Tables in SIMD

GF multiplication requires lookup tables, which don't vectorize directly. However, we can:

1. **Vectorize zero checks** (eliminate branches)
2. **Vectorize table lookups** (using gather operations)
3. **Process multiple elements in parallel**

### Implementation Strategy

```cpp
void mulVec8NEON(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    if (!gf256_initialized) {
        initGF256();
    }
    
#ifdef __ARM_NEON
    size_t i = 0;
    
    // Process 8 elements at a time (compromise between vectorization and table lookups)
    for (; i + 8 <= len; i += 8) {
        // Load 8 elements
        uint8x8_t va = vld1_u8(&a[i]);
        uint8x8_t vb = vld1_u8(&b[i]);
        
        // Check for zeros
        uint8x8_t zero = vdup_n_u8(0);
        uint8x8_t mask_a = vceq_u8(va, zero);
        uint8x8_t mask_b = vceq_u8(vb, zero);
        uint8x8_t zero_mask = vorr_u8(mask_a, mask_b);
        
        // Process each element (still need scalar for table lookups)
        uint8_t result[8];
        for (int j = 0; j < 8; j++) {
            if (vget_lane_u8(zero_mask, j)) {
                result[j] = 0;
            } else {
                uint8_t val_a = vget_lane_u8(va, j);
                uint8_t val_b = vget_lane_u8(vb, j);
                uint16_t log_sum = (uint16_t)gf256_log[val_a] + (uint16_t)gf256_log[val_b];
                log_sum %= 255;
                result[j] = gf256_antilog[log_sum];
            }
        }
        
        // Store result
        vst1_u8(&out[i], vld1_u8(result));
    }
    
    // Handle remaining elements
    for (; i < len; i++) {
        out[i] = mul8(a[i], b[i]);
    }
#else
    mulVec8(a, b, out, len);
#endif
}
```

**Expected Result:** 2-4x speedup (limited by table lookups)

### Alternative: Precomputed Multiplication Tables

For better performance, precompute multiplication tables:

```cpp
// Precompute multiplication table for a specific value
void mulVecConstantNEON(const uint8_t* a, uint8_t constant, uint8_t* out, size_t len) {
    // Fast paths
    if (constant == 0) {
        memset(out, 0, len);
        return;
    }
    if (constant == 1) {
        memcpy(out, a, len);
        return;
    }
    
    // Precompute multiplication table
    uint8_t mul_table[256];
    for (int i = 0; i < 256; i++) {
        mul_table[i] = mul8(i, constant);
    }
    
#ifdef __ARM_NEON
    size_t i = 0;
    
    // Process 16 elements at a time
    for (; i + 16 <= len; i += 16) {
        uint8x16_t va = vld1q_u8(&a[i]);
        
        // Use table lookup instruction (vtbl)
        // This is the key: NEON has hardware table lookup!
        uint8x16_t result = vqtbl1q_u8(vld1q_u8(mul_table), va);
        
        vst1q_u8(&out[i], result);
    }
    
    // Handle remaining elements
    for (; i < len; i++) {
        out[i] = mul_table[a[i]];
    }
#else
    for (size_t i = 0; i < len; i++) {
        out[i] = mul_table[a[i]];
    }
#endif
}
```

**Expected Result:** 8-12x speedup for constant multiplication

## Phase 3: Metal GPU Optimization (Medium Difficulty, Medium Impact)

### Threadgroup Memory for Lookup Tables

Update `src/native/gf_shaders.metal`:

```metal
kernel void gf256_mul_kernel_optimized(
    device const uint8_t* a [[buffer(0)]],
    device const uint8_t* b [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    device const uint8_t* log_table [[buffer(3)]],
    device const uint8_t* antilog_table [[buffer(4)]],
    uint id [[thread_position_in_grid]],
    uint tid [[thread_position_in_threadgroup]])
{
    // Shared memory for lookup tables
    threadgroup uint8_t local_log[256];
    threadgroup uint8_t local_antilog[256];
    
    // Cooperatively load tables (each thread loads one element)
    if (tid < 256) {
        local_log[tid] = log_table[tid];
        local_antilog[tid] = antilog_table[tid];
    }
    
    // Wait for all threads to finish loading
    threadgroup_barrier(mem_flags::mem_threadgroup);
    
    // Now use local tables (much faster)
    uint8_t val_a = a[id];
    uint8_t val_b = b[id];
    
    if (val_a == 0 || val_b == 0) {
        result[id] = 0;
    } else {
        uint8_t log_a = local_log[val_a];
        uint8_t log_b = local_log[val_b];
        uint16_t log_sum = (uint16_t)log_a + (uint16_t)log_b;
        
        if (log_sum >= 255) {
            log_sum -= 255;
        }
        
        result[id] = local_antilog[log_sum];
    }
}
```

**Expected Result:** 2-3x speedup for GPU operations

### Optimal Thread Group Size

```cpp
// In metal_bridge.mm, set optimal thread group size
MTLSize threadgroupSize = MTLSizeMake(256, 1, 1);  // 256 threads per group
MTLSize gridSize = MTLSizeMake((length + 255) / 256, 1, 1);

[encoder dispatchThreadgroups:gridSize threadsPerThreadgroup:threadgroupSize];
```

## Phase 4: Matrix Operations (High Difficulty, Highest Impact)

### Use vDSP for Matrix-Vector Multiply

This is where most encoding/decoding time is spent:

```cpp
#include <Accelerate/Accelerate.h>

void matVecMulGF_Accelerated(const uint8_t* matrix, const uint8_t* vec,
                              uint8_t* out, int rows, int cols) {
    // For GF arithmetic, we can't use vDSP directly
    // But we can optimize the inner loop
    
    for (int row = 0; row < rows; row++) {
        uint8_t sum = 0;
        
        // Vectorize the inner product
        #pragma clang loop vectorize(enable) interleave(enable)
        for (int col = 0; col < cols; col++) {
            uint8_t m = matrix[row * cols + col];
            uint8_t v = vec[col];
            
            if (m != 0 && v != 0) {
                sum ^= mul8(m, v);
            }
        }
        
        out[row] = sum;
    }
}
```

**Better Approach:** Use constant multiplication optimization:

```cpp
void matVecMulGF_Optimized(const uint8_t* matrix, const uint8_t* vec,
                            uint8_t* out, int rows, int cols) {
    // Process column by column
    memset(out, 0, rows);
    
    for (int col = 0; col < cols; col++) {
        if (vec[col] == 0) continue;
        
        // Multiply entire column by vec[col] and accumulate
        uint8_t constant = vec[col];
        
        // Use optimized constant multiplication
        uint8_t temp[rows];
        mulVecConstantNEON(&matrix[col], constant, temp, rows);
        
        // XOR accumulate using NEON
        addVec8Accelerated(out, temp, out, rows);
    }
}
```

**Expected Result:** 10-20x speedup for large matrices

## Testing Your Optimizations

### 1. Run Benchmarks

```bash
# Before optimization
node benchmarks/gf_operations.js > before.txt

# After optimization
npm run clean
npm run build
node benchmarks/gf_operations.js > after.txt

# Compare
diff before.txt after.txt
```

### 2. Verify Correctness

```bash
# Run property tests to ensure correctness
npm run test:properties
```

### 3. Profile with Instruments

```bash
# Build with debug symbols
node-gyp rebuild --debug

# Profile with Xcode Instruments
# Look for:
# - CPU usage
# - Cache misses
# - Memory bandwidth
# - SIMD utilization
```

## Common Pitfalls

### 1. Alignment Issues

NEON requires 16-byte alignment for best performance:

```cpp
// Check alignment
if ((uintptr_t)a % 16 != 0) {
    // Handle unaligned data
}
```

### 2. Small Array Overhead

SIMD has overhead. For small arrays, scalar is faster:

```cpp
if (len < 64) {
    // Use scalar implementation
    return mulVec8(a, b, out, len);
}
```

### 3. Branch Misprediction

Avoid branches in inner loops:

```cpp
// Bad: branch in loop
for (int i = 0; i < len; i++) {
    if (a[i] == 0) {
        out[i] = 0;
    } else {
        out[i] = mul8(a[i], b[i]);
    }
}

// Good: branchless with mask
for (int i = 0; i < len; i++) {
    uint8_t mask = (a[i] != 0) ? 0xFF : 0x00;
    out[i] = mul8(a[i], b[i]) & mask;
}
```

## Expected Performance Gains

| Optimization | Difficulty | Time | Speedup | Priority |
|--------------|-----------|------|---------|----------|
| NEON XOR | Easy | 2 hours | 8-16x | ⭐⭐⭐⭐⭐ |
| Compiler flags | Easy | 30 min | 1.2-1.5x | ⭐⭐⭐⭐⭐ |
| Constant mul | Easy | 3 hours | 8-12x | ⭐⭐⭐⭐ |
| NEON GF mul | Medium | 1 day | 2-4x | ⭐⭐⭐ |
| Metal threadgroup | Medium | 1 day | 2-3x | ⭐⭐⭐ |
| Matrix ops | Hard | 3 days | 10-20x | ⭐⭐⭐⭐⭐ |

## Next Steps

1. **Start with Phase 1** (NEON XOR + compiler flags)
   - Easiest to implement
   - Immediate visible results
   - Low risk

2. **Benchmark matrix operations**
   - Identify the real bottleneck
   - May be more important than GF operations

3. **Implement Phase 2** based on profiling
   - Focus on the hot path
   - Measure before and after

4. **Consider Phase 3** for GPU-heavy workloads
   - Only if GPU is actually being used
   - May not be worth it for typical use cases

## Resources

- [ARM NEON Intrinsics Reference](https://developer.arm.com/architectures/instruction-sets/intrinsics/)
- [Apple Accelerate Framework](https://developer.apple.com/documentation/accelerate)
- [Metal Shading Language Specification](https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf)
- [Optimizing for Apple Silicon](https://developer.apple.com/documentation/apple-silicon)
