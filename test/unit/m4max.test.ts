/**
 * Unit tests for M4 Max Extreme Optimizations
 * 
 * Tests the following M4 Max-specific techniques:
 * 1. 4-Way Unrolled Multiply-Accumulate - Maximum ILP
 * 2. 8-Way Unrolled Multiply-Accumulate - Even more ILP
 * 3. 4-Way XOR - Combined veor3 + XOR
 * 4. Quad Multiply-Accumulate - Process 4 shards at once
 * 5. 16-Core Parallel Encoding - Full P-core saturation
 * 6. Cache-Aligned Encoding - 128-byte alignment
 * 7. Bandwidth-Optimized Encoding - 546 GB/s targeting
 * 8. Huge Page Encoding - 2MB page optimization
 */

import * as path from 'path';

const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('M4 Max Extreme Optimizations', () => {
  beforeAll(() => {
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
    native.initExtreme();
    native.initM4Max();
  });

  describe('Hardware Detection', () => {
    it('should report SME availability as boolean', () => {
      const available = native.isSMEAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should report M4 Max detection as boolean', () => {
      const isM4Max = native.isM4Max();
      expect(typeof isM4Max).toBe('boolean');
    });

    it('should return positive performance core count', () => {
      const count = native.getPerformanceCoreCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('should return non-negative efficiency core count', () => {
      const count = native.getEfficiencyCoreCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return valid optimal M4 strategy', () => {
      const strategy = native.getOptimalM4Strategy(65536, 10, 4);
      expect(typeof strategy).toBe('number');
      expect(strategy).toBeGreaterThanOrEqual(0);
      expect(strategy).toBeLessThanOrEqual(3);
    });
  });

  describe('4-Way Unrolled Multiply-Accumulate', () => {
    it('should produce same results as standard mulAccum', () => {
      const size = 1024;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 7) & 0xFF;
      
      const coeff = 0x53;
      
      // Standard method
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data, coeff, expected);
      
      // 4-way method
      const actual = new Uint8Array(size);
      native.gf_mulAccum4Way(data, coeff, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });

    it('should handle various sizes', () => {
      const sizes = [64, 128, 256, 512, 1024, 2048, 4096];
      
      for (const size of sizes) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) data[i] = (i * 11) & 0xFF;
        
        const coeff = 0x7B;
        
        const expected = new Uint8Array(size);
        native.gf_mulAccum_interleaved(data, coeff, expected);
        
        const actual = new Uint8Array(size);
        native.gf_mulAccum4Way(data, coeff, actual);
        
        for (let i = 0; i < size; i++) {
          expect(actual[i]).toBe(expected[i]);
        }
      }
    });

    it('should handle zero coefficient', () => {
      const size = 512;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 3) & 0xFF;
      
      const accum = new Uint8Array(size);
      accum.fill(42);
      const original = new Uint8Array(accum);
      
      native.gf_mulAccum4Way(data, 0, accum);
      
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(original[i]);
      }
    });

    it('should handle coefficient = 1', () => {
      const size = 512;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 5) & 0xFF;
      
      const accum = new Uint8Array(size);
      native.gf_mulAccum4Way(data, 1, accum);
      
      // Should be just XOR with data
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(data[i]);
      }
    });
  });

  describe('8-Way Unrolled Multiply-Accumulate', () => {
    it('should produce same results as standard mulAccum', () => {
      const size = 2048;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 13) & 0xFF;
      
      const coeff = 0xAB;
      
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data, coeff, expected);
      
      const actual = new Uint8Array(size);
      native.gf_mulAccum8Way(data, coeff, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });

    it('should handle large sizes efficiently', () => {
      const size = 65536;  // 64KB
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) data[i] = (i * 17) & 0xFF;
      
      const coeff = 0xCD;
      
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data, coeff, expected);
      
      const actual = new Uint8Array(size);
      native.gf_mulAccum8Way(data, coeff, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });
  });

  describe('4-Way XOR', () => {
    it('should compute a ^ b ^ c ^ d correctly', () => {
      const size = 256;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      const c = new Uint8Array(size);
      const d = new Uint8Array(size);
      
      for (let i = 0; i < size; i++) {
        a[i] = i;
        b[i] = (i * 7) & 0xFF;
        c[i] = (i * 13) & 0xFF;
        d[i] = (i * 19) & 0xFF;
      }
      
      const out = new Uint8Array(size);
      native.gf_xor4Vec(a, b, c, d, out);
      
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(a[i] ^ b[i] ^ c[i] ^ d[i]);
      }
    });

    it('should handle various sizes', () => {
      const sizes = [1, 15, 16, 17, 63, 64, 65, 100, 1000];
      
      for (const size of sizes) {
        const a = new Uint8Array(size);
        const b = new Uint8Array(size);
        const c = new Uint8Array(size);
        const d = new Uint8Array(size);
        
        for (let i = 0; i < size; i++) {
          a[i] = (i * 3) & 0xFF;
          b[i] = (i * 5) & 0xFF;
          c[i] = (i * 7) & 0xFF;
          d[i] = (i * 11) & 0xFF;
        }
        
        const out = new Uint8Array(size);
        native.gf_xor4Vec(a, b, c, d, out);
        
        for (let i = 0; i < size; i++) {
          expect(out[i]).toBe(a[i] ^ b[i] ^ c[i] ^ d[i]);
        }
      }
    });

    it('should be commutative', () => {
      const size = 128;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      const c = new Uint8Array(size);
      const d = new Uint8Array(size);
      
      for (let i = 0; i < size; i++) {
        a[i] = (i * 3) & 0xFF;
        b[i] = (i * 5) & 0xFF;
        c[i] = (i * 7) & 0xFF;
        d[i] = (i * 11) & 0xFF;
      }
      
      const out1 = new Uint8Array(size);
      const out2 = new Uint8Array(size);
      
      native.gf_xor4Vec(a, b, c, d, out1);
      native.gf_xor4Vec(d, c, b, a, out2);
      
      for (let i = 0; i < size; i++) {
        expect(out1[i]).toBe(out2[i]);
      }
    });
  });

  describe('Quad Multiply-Accumulate', () => {
    it('should compute accum ^= (d1*c1) ^ (d2*c2) ^ (d3*c3) ^ (d4*c4)', () => {
      const size = 512;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      const data3 = new Uint8Array(size);
      const data4 = new Uint8Array(size);
      
      for (let i = 0; i < size; i++) {
        data1[i] = (i * 3) & 0xFF;
        data2[i] = (i * 5) & 0xFF;
        data3[i] = (i * 7) & 0xFF;
        data4[i] = (i * 11) & 0xFF;
      }
      
      const coeff1 = 0x53;
      const coeff2 = 0x7B;
      const coeff3 = 0xAB;
      const coeff4 = 0xCD;
      
      // Expected: 4 separate mulAccum operations
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data1, coeff1, expected);
      native.gf_mulAccum_interleaved(data2, coeff2, expected);
      native.gf_mulAccum_interleaved(data3, coeff3, expected);
      native.gf_mulAccum_interleaved(data4, coeff4, expected);
      
      // Actual: single quad operation
      const actual = new Uint8Array(size);
      native.gf_mulAccum4_xor4(data1, coeff1, data2, coeff2, 
                               data3, coeff3, data4, coeff4, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });

    it('should handle zero coefficients', () => {
      const size = 256;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      const data3 = new Uint8Array(size);
      const data4 = new Uint8Array(size);
      
      for (let i = 0; i < size; i++) {
        data1[i] = (i * 3) & 0xFF;
        data2[i] = (i * 5) & 0xFF;
        data3[i] = (i * 7) & 0xFF;
        data4[i] = (i * 11) & 0xFF;
      }
      
      const accum = new Uint8Array(size);
      accum.fill(42);
      const original = new Uint8Array(accum);
      
      // All zero coefficients
      native.gf_mulAccum4_xor4(data1, 0, data2, 0, data3, 0, data4, 0, accum);
      
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(original[i]);
      }
    });

    it('should handle mixed zero and non-zero coefficients', () => {
      const size = 256;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      const data3 = new Uint8Array(size);
      const data4 = new Uint8Array(size);
      
      for (let i = 0; i < size; i++) {
        data1[i] = (i * 3) & 0xFF;
        data2[i] = (i * 5) & 0xFF;
        data3[i] = (i * 7) & 0xFF;
        data4[i] = (i * 11) & 0xFF;
      }
      
      // Only coeff1 and coeff3 are non-zero
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data1, 0x53, expected);
      native.gf_mulAccum_interleaved(data3, 0xAB, expected);
      
      const actual = new Uint8Array(size);
      native.gf_mulAccum4_xor4(data1, 0x53, data2, 0, data3, 0xAB, data4, 0, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });
  });

  describe('16-Core Parallel Encoding', () => {
    it('should produce same results as parallel encoding', () => {
      const k = 10;
      const m = 4;
      const shardSize = 1024;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 7) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parity16Core = native.encode16Core(data, matrix, k, m, shardSize);
      
      expect(parity16Core.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parity16Core[i]).toBe(parityParallel[i]);
      }
    });

    it('should work with various configurations', () => {
      const configs = [
        { k: 4, m: 2, shardSize: 512 },
        { k: 10, m: 4, shardSize: 2048 },
        { k: 20, m: 10, shardSize: 1024 },
        { k: 50, m: 20, shardSize: 512 },
      ];
      
      for (const { k, m, shardSize } of configs) {
        const dataSize = k * shardSize;
        const data = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) data[i] = (i * 13) & 0xFF;
        
        const totalShards = k + m;
        const matrixSize = totalShards * k;
        const matrix = new Uint8Array(matrixSize);
        native.buildCauchyMatrix(matrix, totalShards, k, 8);
        
        const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
        const parity16Core = native.encode16Core(data, matrix, k, m, shardSize);
        
        for (let i = 0; i < parityParallel.length; i++) {
          expect(parity16Core[i]).toBe(parityParallel[i]);
        }
      }
    });

    it('should enable data reconstruction', () => {
      const k = 6;
      const m = 3;
      const shardSize = 512;
      
      const dataSize = k * shardSize;
      const originalData = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) originalData[i] = (i * 11) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parity = native.encode16Core(originalData, matrix, k, m, shardSize);
      
      // Lose first data shard
      const availableShards: Uint8Array[] = [];
      const shardIndices: number[] = [];
      
      for (let i = 1; i < k; i++) {
        const shard = new Uint8Array(shardSize);
        shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
        availableShards.push(shard);
        shardIndices.push(i);
      }
      
      const parityShard = new Uint8Array(shardSize);
      parityShard.set(parity.subarray(0, shardSize));
      availableShards.push(parityShard);
      shardIndices.push(k);
      
      const decoded = native.decode(
        availableShards,
        new Int32Array(shardIndices),
        k, m, shardSize, matrix, 8
      );
      
      for (let i = 0; i < dataSize; i++) {
        expect(decoded[i]).toBe(originalData[i]);
      }
    });
  });

  describe('Cache-Aligned Encoding', () => {
    it('should produce same results as parallel encoding', () => {
      const k = 10;
      const m = 4;
      const shardSize = 1024;  // Multiple of 128
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 17) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityCacheAligned = native.encodeCacheAligned(data, matrix, k, m, shardSize);
      
      expect(parityCacheAligned.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityCacheAligned[i]).toBe(parityParallel[i]);
      }
    });

    it('should handle non-aligned sizes gracefully', () => {
      const k = 8;
      const m = 4;
      const shardSize = 1000;  // Not multiple of 128
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 19) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityCacheAligned = native.encodeCacheAligned(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityCacheAligned[i]).toBe(parityParallel[i]);
      }
    });
  });

  describe('Bandwidth-Optimized Encoding', () => {
    it('should produce same results as parallel encoding', () => {
      const k = 10;
      const m = 4;
      const shardSize = 4096;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 23) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityBandwidth = native.encodeBandwidthOptimized(data, matrix, k, m, shardSize);
      
      expect(parityBandwidth.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityBandwidth[i]).toBe(parityParallel[i]);
      }
    });

    it('should work with large shard sizes', () => {
      const k = 6;
      const m = 3;
      const shardSize = 65536;  // 64KB
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 29) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityBandwidth = native.encodeBandwidthOptimized(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityBandwidth[i]).toBe(parityParallel[i]);
      }
    });

    it('should enable data reconstruction', () => {
      const k = 8;
      const m = 4;
      const shardSize = 2048;
      
      const dataSize = k * shardSize;
      const originalData = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) originalData[i] = (i * 31) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parity = native.encodeBandwidthOptimized(originalData, matrix, k, m, shardSize);
      
      // Lose first two data shards
      const availableShards: Uint8Array[] = [];
      const shardIndices: number[] = [];
      
      for (let i = 2; i < k; i++) {
        const shard = new Uint8Array(shardSize);
        shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
        availableShards.push(shard);
        shardIndices.push(i);
      }
      
      // Add two parity shards
      for (let p = 0; p < 2; p++) {
        const shard = new Uint8Array(shardSize);
        shard.set(parity.subarray(p * shardSize, (p + 1) * shardSize));
        availableShards.push(shard);
        shardIndices.push(k + p);
      }
      
      const decoded = native.decode(
        availableShards,
        new Int32Array(shardIndices),
        k, m, shardSize, matrix, 8
      );
      
      for (let i = 0; i < dataSize; i++) {
        expect(decoded[i]).toBe(originalData[i]);
      }
    });
  });

  describe('Huge Page Encoding', () => {
    it('should produce same results as parallel encoding for small shards', () => {
      const k = 10;
      const m = 4;
      const shardSize = 4096;  // Below huge page threshold
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 37) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityHugePage = native.encodeHugePage(data, matrix, k, m, shardSize);
      
      expect(parityHugePage.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityHugePage[i]).toBe(parityParallel[i]);
      }
    });

    it('should work with medium shard sizes', () => {
      const k = 6;
      const m = 3;
      const shardSize = 262144;  // 256KB
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 41) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityHugePage = native.encodeHugePage(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityHugePage[i]).toBe(parityParallel[i]);
      }
    });
  });

  describe('Strategy Selection', () => {
    it('should recommend huge page for very large shards', () => {
      const strategy = native.getOptimalM4Strategy(2 * 1024 * 1024, 10, 4);
      expect(strategy).toBe(3);  // Huge page
    });

    it('should recommend bandwidth-optimized for large workloads', () => {
      const strategy = native.getOptimalM4Strategy(256 * 1024, 30, 10);
      expect(strategy).toBe(2);  // Bandwidth-optimized
    });

    it('should recommend cache-aligned for aligned sizes', () => {
      const strategy = native.getOptimalM4Strategy(1024, 10, 4);
      expect(strategy).toBe(1);  // Cache-aligned
    });
  });

  describe('All Encoding Methods Produce Valid Parity', () => {
    const encodingMethods = [
      { name: '16-core', fn: 'encode16Core' },
      { name: 'cache-aligned', fn: 'encodeCacheAligned' },
      { name: 'bandwidth-optimized', fn: 'encodeBandwidthOptimized' },
      { name: 'huge-page', fn: 'encodeHugePage' },
    ];

    for (const { name, fn } of encodingMethods) {
      it(`${name} encoding should enable reconstruction after losing max erasures`, () => {
        const k = 6;
        const m = 3;
        const shardSize = 1024;
        
        const dataSize = k * shardSize;
        const originalData = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) originalData[i] = (i * 43) & 0xFF;
        
        const totalShards = k + m;
        const matrixSize = totalShards * k;
        const matrix = new Uint8Array(matrixSize);
        native.buildCauchyMatrix(matrix, totalShards, k, 8);
        
        const parity = native[fn](originalData, matrix, k, m, shardSize);
        
        // Lose all m data shards (maximum erasures)
        const availableShards: Uint8Array[] = [];
        const shardIndices: number[] = [];
        
        // Keep only k-m data shards
        for (let i = m; i < k; i++) {
          const shard = new Uint8Array(shardSize);
          shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
          availableShards.push(shard);
          shardIndices.push(i);
        }
        
        // Add all parity shards
        for (let p = 0; p < m; p++) {
          const shard = new Uint8Array(shardSize);
          shard.set(parity.subarray(p * shardSize, (p + 1) * shardSize));
          availableShards.push(shard);
          shardIndices.push(k + p);
        }
        
        const decoded = native.decode(
          availableShards,
          new Int32Array(shardIndices),
          k, m, shardSize, matrix, 8
        );
        
        for (let i = 0; i < dataSize; i++) {
          expect(decoded[i]).toBe(originalData[i]);
        }
      });
    }
  });
});
