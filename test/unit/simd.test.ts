/**
 * Unit tests for Advanced SIMD optimizations
 * 
 * Tests the following hardware utilization techniques:
 * 1. NEON vtbl - Hardware table lookup (16 lookups per instruction)
 * 2. ARM PMULL - Polynomial multiply for GF operations
 * 3. GCD Parallel Encoding - Multi-threaded parity computation
 * 4. Interleaved Processing - Better instruction-level parallelism
 */

import * as path from 'path';

// Load native module
const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('Advanced SIMD Operations', () => {
  beforeAll(() => {
    // Initialize all subsystems
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
  });

  describe('SIMD Availability', () => {
    it('should report SIMD availability as boolean', () => {
      const available = native.isSIMDAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should report multi-thread availability as boolean', () => {
      const available = native.isMultiThreadAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should return positive optimal thread count', () => {
      const threadCount = native.getOptimalThreadCount();
      expect(typeof threadCount).toBe('number');
      expect(threadCount).toBeGreaterThan(0);
    });

    it('should be available on Apple Silicon', () => {
      // On Apple Silicon macOS, SIMD should be available
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(native.isSIMDAvailable()).toBe(true);
        expect(native.isMultiThreadAvailable()).toBe(true);
      }
    });
  });

  describe('vtbl Multiply by Constant', () => {
    it('should multiply vector by constant correctly', () => {
      const size = 256;
      const a = new Uint8Array(size);
      for (let i = 0; i < size; i++) a[i] = i;
      
      const out = new Uint8Array(size);
      const constant = 0x53;
      
      native.gf_mulVecConstant_vtbl(a, constant, out);
      
      // Verify against scalar multiplication
      for (let i = 0; i < size; i++) {
        const expected = native.gf_mul8(a[i], constant);
        expect(out[i]).toBe(expected);
      }
    });

    it('should handle multiplication by 0', () => {
      const size = 100;
      const a = new Uint8Array(size);
      for (let i = 0; i < size; i++) a[i] = i + 1;
      
      const out = new Uint8Array(size);
      native.gf_mulVecConstant_vtbl(a, 0, out);
      
      // All results should be 0
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(0);
      }
    });

    it('should handle multiplication by 1 (identity)', () => {
      const size = 100;
      const a = new Uint8Array(size);
      for (let i = 0; i < size; i++) a[i] = (i * 7) & 0xFF;
      
      const out = new Uint8Array(size);
      native.gf_mulVecConstant_vtbl(a, 1, out);
      
      // Results should equal input
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(a[i]);
      }
    });

    it('should handle various data sizes', () => {
      const sizes = [1, 15, 16, 17, 63, 64, 65, 127, 128, 1000, 10000];
      const constant = 0x7B;
      
      for (const size of sizes) {
        const a = new Uint8Array(size);
        for (let i = 0; i < size; i++) a[i] = (i * 13) & 0xFF;
        
        const out = new Uint8Array(size);
        native.gf_mulVecConstant_vtbl(a, constant, out);
        
        // Verify first and last few elements
        for (let i = 0; i < Math.min(10, size); i++) {
          expect(out[i]).toBe(native.gf_mul8(a[i], constant));
        }
        for (let i = Math.max(0, size - 10); i < size; i++) {
          expect(out[i]).toBe(native.gf_mul8(a[i], constant));
        }
      }
    });

    it('should match NEON implementation', () => {
      const size = 1024;
      const a = new Uint8Array(size);
      for (let i = 0; i < size; i++) a[i] = (i * 17) & 0xFF;
      
      const outVtbl = new Uint8Array(size);
      const outNeon = new Uint8Array(size);
      const constant = 0xAB;
      
      native.gf_mulVecConstant_vtbl(a, constant, outVtbl);
      native.gf_mulVecConstant8_NEON(a, constant, outNeon);
      
      for (let i = 0; i < size; i++) {
        expect(outVtbl[i]).toBe(outNeon[i]);
      }
    });
  });

  describe('pmull Vector Multiply', () => {
    it('should multiply two vectors correctly', () => {
      const size = 256;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        a[i] = i;
        b[i] = (i * 7) & 0xFF;
      }
      
      const out = new Uint8Array(size);
      native.gf_mulVec_pmull(a, b, out);
      
      // Verify against scalar multiplication
      for (let i = 0; i < size; i++) {
        const expected = native.gf_mul8(a[i], b[i]);
        expect(out[i]).toBe(expected);
      }
    });

    it('should handle multiplication with zeros', () => {
      const size = 100;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        a[i] = i;
        b[i] = 0;
      }
      
      const out = new Uint8Array(size);
      native.gf_mulVec_pmull(a, b, out);
      
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(0);
      }
    });

    it('should handle multiplication with ones', () => {
      const size = 100;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        a[i] = (i * 11) & 0xFF;
        b[i] = 1;
      }
      
      const out = new Uint8Array(size);
      native.gf_mulVec_pmull(a, b, out);
      
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(a[i]);
      }
    });

    it('should handle various data sizes', () => {
      const sizes = [1, 7, 8, 9, 15, 16, 17, 100, 1000];
      
      for (const size of sizes) {
        const a = new Uint8Array(size);
        const b = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          a[i] = (i * 3) & 0xFF;
          b[i] = (i * 5) & 0xFF;
        }
        
        const out = new Uint8Array(size);
        native.gf_mulVec_pmull(a, b, out);
        
        // Verify first and last elements
        expect(out[0]).toBe(native.gf_mul8(a[0], b[0]));
        expect(out[size - 1]).toBe(native.gf_mul8(a[size - 1], b[size - 1]));
      }
    });
  });

  describe('Interleaved Multiply-Accumulate', () => {
    it('should accumulate correctly', () => {
      const size = 256;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = i;
      
      const accum = new Uint8Array(size);
      accum.fill(0);
      
      const constant = 0x53;
      native.gf_mulAccum_interleaved(data, constant, accum);
      
      // Verify: accum should now be data * constant
      for (let i = 0; i < size; i++) {
        const expected = native.gf_mul8(data[i], constant);
        expect(accum[i]).toBe(expected);
      }
    });

    it('should XOR with existing accumulator values', () => {
      const size = 100;
      const data = new Uint8Array(size);
      const accum = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = (i * 7) & 0xFF;
        accum[i] = (i * 3) & 0xFF;
      }
      
      const originalAccum = new Uint8Array(accum);
      const constant = 0x42;
      
      native.gf_mulAccum_interleaved(data, constant, accum);
      
      // Verify: accum = originalAccum XOR (data * constant)
      for (let i = 0; i < size; i++) {
        const product = native.gf_mul8(data[i], constant);
        const expected = originalAccum[i] ^ product;
        expect(accum[i]).toBe(expected);
      }
    });

    it('should handle constant = 0 (no change)', () => {
      const size = 100;
      const data = new Uint8Array(size);
      const accum = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = (i * 7) & 0xFF;
        accum[i] = (i * 3) & 0xFF;
      }
      
      const originalAccum = new Uint8Array(accum);
      native.gf_mulAccum_interleaved(data, 0, accum);
      
      // Accumulator should be unchanged
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(originalAccum[i]);
      }
    });

    it('should handle constant = 1 (just XOR)', () => {
      const size = 100;
      const data = new Uint8Array(size);
      const accum = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = (i * 7) & 0xFF;
        accum[i] = (i * 3) & 0xFF;
      }
      
      const originalAccum = new Uint8Array(accum);
      native.gf_mulAccum_interleaved(data, 1, accum);
      
      // accum = originalAccum XOR data
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(originalAccum[i] ^ data[i]);
      }
    });

    it('should match Accelerate implementation', () => {
      const size = 1024;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 17) & 0xFF;
      
      const accumInterleaved = new Uint8Array(size);
      const accumAccelerate = new Uint8Array(size);
      accumInterleaved.fill(0);
      accumAccelerate.fill(0);
      
      const constant = 0xCD;
      
      native.gf_mulAccum_interleaved(data, constant, accumInterleaved);
      native.gf_mulAccum_Accelerate(data, constant, accumAccelerate);
      
      for (let i = 0; i < size; i++) {
        expect(accumInterleaved[i]).toBe(accumAccelerate[i]);
      }
    });
  });

  describe('Parallel Encoding (GCD)', () => {
    it('should encode correctly for small configuration', () => {
      const k = 4;  // data shards
      const m = 2;  // parity shards
      const shardSize = 1024;
      
      // Create test data
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 7) & 0xFF;
      
      // Build encoding matrix
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      // Encode with parallel and single-threaded
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const paritySingle = native.encodeAccelerate(data, matrix, k, m, shardSize);
      
      // Results should match
      expect(parityParallel.length).toBe(paritySingle.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityParallel[i]).toBe(paritySingle[i]);
      }
    });

    it('should encode correctly for larger configuration', () => {
      const k = 10;
      const m = 4;
      const shardSize = 4096;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 13) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const paritySingle = native.encodeAccelerate(data, matrix, k, m, shardSize);
      
      expect(parityParallel.length).toBe(m * shardSize);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityParallel[i]).toBe(paritySingle[i]);
      }
    });

    it('should handle high parity shard count', () => {
      const k = 20;
      const m = 10;
      const shardSize = 2048;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 17) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const paritySingle = native.encodeAccelerate(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityParallel[i]).toBe(paritySingle[i]);
      }
    });

    it('should produce valid parity that can reconstruct data', () => {
      const k = 6;
      const m = 3;
      const shardSize = 512;
      
      // Create test data
      const dataSize = k * shardSize;
      const originalData = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) originalData[i] = (i * 11) & 0xFF;
      
      // Build matrix and encode
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parity = native.encodeParallel(originalData, matrix, k, m, shardSize);
      
      // Simulate losing some data shards and reconstruct
      // Create array of available shards (lose first 2 data shards)
      const availableShards: Uint8Array[] = [];
      const shardIndices: number[] = [];
      
      // Skip first 2 data shards, use remaining data shards
      for (let i = 2; i < k; i++) {
        const shard = new Uint8Array(shardSize);
        shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
        availableShards.push(shard);
        shardIndices.push(i);
      }
      
      // Add parity shards to fill the gap
      for (let i = 0; i < 2; i++) {
        const shard = new Uint8Array(shardSize);
        shard.set(parity.subarray(i * shardSize, (i + 1) * shardSize));
        availableShards.push(shard);
        shardIndices.push(k + i);
      }
      
      // Decode
      const decoded = native.decode(
        availableShards,
        new Int32Array(shardIndices),
        k, m, shardSize, matrix, 8
      );
      
      // Verify reconstruction
      for (let i = 0; i < dataSize; i++) {
        expect(decoded[i]).toBe(originalData[i]);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays gracefully', () => {
      const empty = new Uint8Array(0);
      const out = new Uint8Array(0);
      
      // These should not throw
      expect(() => native.gf_mulVecConstant_vtbl(empty, 0x53, out)).not.toThrow();
      expect(() => native.gf_mulVec_pmull(empty, empty, out)).not.toThrow();
      expect(() => native.gf_mulAccum_interleaved(empty, 0x53, out)).not.toThrow();
    });

    it('should handle single element arrays', () => {
      const a = new Uint8Array([0x42]);
      const b = new Uint8Array([0x53]);
      const out = new Uint8Array(1);
      
      native.gf_mulVecConstant_vtbl(a, 0x53, out);
      expect(out[0]).toBe(native.gf_mul8(0x42, 0x53));
      
      native.gf_mulVec_pmull(a, b, out);
      expect(out[0]).toBe(native.gf_mul8(0x42, 0x53));
    });

    it('should handle all-zeros input', () => {
      const size = 100;
      const zeros = new Uint8Array(size);
      const out = new Uint8Array(size);
      
      native.gf_mulVecConstant_vtbl(zeros, 0xFF, out);
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(0);
      }
    });

    it('should handle all-255 input', () => {
      const size = 100;
      const maxVals = new Uint8Array(size);
      maxVals.fill(255);
      const out = new Uint8Array(size);
      
      native.gf_mulVecConstant_vtbl(maxVals, 0x53, out);
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(native.gf_mul8(255, 0x53));
      }
    });
  });

  describe('Consistency Across Implementations', () => {
    it('should produce consistent results across all multiply implementations', () => {
      const size = 1000;
      const a = new Uint8Array(size);
      for (let i = 0; i < size; i++) a[i] = (i * 23) & 0xFF;
      
      const constant = 0x7F;
      
      const outVtbl = new Uint8Array(size);
      const outNeon = new Uint8Array(size);
      
      native.gf_mulVecConstant_vtbl(a, constant, outVtbl);
      native.gf_mulVecConstant8_NEON(a, constant, outNeon);
      
      // Verify vtbl matches NEON
      for (let i = 0; i < size; i++) {
        expect(outVtbl[i]).toBe(outNeon[i]);
      }
      
      // Also verify against scalar
      for (let i = 0; i < size; i++) {
        expect(outVtbl[i]).toBe(native.gf_mul8(a[i], constant));
      }
    });

    it('should produce consistent encoding results', () => {
      const k = 8;
      const m = 4;
      const shardSize = 2048;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 31) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      // Compare parallel and Accelerate encoding methods
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityAccelerate = native.encodeAccelerate(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityParallel[i]).toBe(parityAccelerate[i]);
      }
    });
  });
});
