/**
 * Unit tests for Extreme Hardware Optimizations
 * 
 * Tests the following unconventional techniques:
 * 1. Three-Way XOR (veor3) - Single instruction for a ^ b ^ c
 * 2. Double Multiply-Accumulate - Process 2 shards at once
 * 3. Pipelined Encoding - Hide memory latency
 * 4. Non-Temporal Encoding - Bypass cache for large outputs
 */

import * as path from 'path';

// Load native module
const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('Extreme Hardware Optimizations', () => {
  beforeAll(() => {
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
    native.initExtreme();
  });

  describe('Feature Detection', () => {
    it('should report CRC32 availability as boolean', () => {
      const available = native.isCRC32Available();
      expect(typeof available).toBe('boolean');
    });

    it('should report veor3 availability as boolean', () => {
      const available = native.isVeor3Available();
      expect(typeof available).toBe('boolean');
    });

    it('should have veor3 available on Apple Silicon', () => {
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(native.isVeor3Available()).toBe(true);
      }
    });

    it('should return valid optimal encoding strategy', () => {
      const strategy = native.getOptimalEncodingStrategy(65536, 10, 4);
      expect(typeof strategy).toBe('number');
      expect(strategy).toBeGreaterThanOrEqual(0);
      expect(strategy).toBeLessThanOrEqual(2);
    });
  });

  describe('Three-Way XOR (veor3)', () => {
    it('should compute a ^ b ^ c correctly', () => {
      const size = 256;
      const a = new Uint8Array(size);
      const b = new Uint8Array(size);
      const c = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        a[i] = i;
        b[i] = (i * 7) & 0xFF;
        c[i] = (i * 13) & 0xFF;
      }
      
      const out = new Uint8Array(size);
      native.gf_xor3Vec(a, b, c, out);
      
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(a[i] ^ b[i] ^ c[i]);
      }
    });

    it('should handle various sizes', () => {
      const sizes = [1, 15, 16, 17, 63, 64, 65, 100, 1000];
      
      for (const size of sizes) {
        const a = new Uint8Array(size);
        const b = new Uint8Array(size);
        const c = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          a[i] = (i * 3) & 0xFF;
          b[i] = (i * 5) & 0xFF;
          c[i] = (i * 7) & 0xFF;
        }
        
        const out = new Uint8Array(size);
        native.gf_xor3Vec(a, b, c, out);
        
        for (let i = 0; i < size; i++) {
          expect(out[i]).toBe(a[i] ^ b[i] ^ c[i]);
        }
      }
    });

    it('should handle all-zeros', () => {
      const size = 100;
      const zeros = new Uint8Array(size);
      const out = new Uint8Array(size);
      
      native.gf_xor3Vec(zeros, zeros, zeros, out);
      
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(0);
      }
    });

    it('should handle all-255', () => {
      const size = 100;
      const maxVals = new Uint8Array(size);
      maxVals.fill(255);
      const out = new Uint8Array(size);
      
      native.gf_xor3Vec(maxVals, maxVals, maxVals, out);
      
      // 255 ^ 255 ^ 255 = 255
      for (let i = 0; i < size; i++) {
        expect(out[i]).toBe(255);
      }
    });
  });

  describe('Double Multiply-Accumulate', () => {
    it('should compute accum ^= (data1 * coeff1) ^ (data2 * coeff2)', () => {
      const size = 256;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data1[i] = i;
        data2[i] = (i * 7) & 0xFF;
      }
      
      const coeff1 = 0x53;
      const coeff2 = 0x7B;
      
      // Compute expected result using standard method
      const expected = new Uint8Array(size);
      native.gf_mulAccum_interleaved(data1, coeff1, expected);
      native.gf_mulAccum_interleaved(data2, coeff2, expected);
      
      // Compute using veor3 method
      const actual = new Uint8Array(size);
      native.gf_mulAccum2_veor3(data1, coeff1, data2, coeff2, actual);
      
      for (let i = 0; i < size; i++) {
        expect(actual[i]).toBe(expected[i]);
      }
    });

    it('should handle zero coefficients', () => {
      const size = 100;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data1[i] = (i * 3) & 0xFF;
        data2[i] = (i * 5) & 0xFF;
      }
      
      const accum = new Uint8Array(size);
      accum.fill(42);
      const original = new Uint8Array(accum);
      
      // Both coefficients zero - should not change accumulator
      native.gf_mulAccum2_veor3(data1, 0, data2, 0, accum);
      
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(original[i]);
      }
    });

    it('should handle coefficient = 1', () => {
      const size = 100;
      const data1 = new Uint8Array(size);
      const data2 = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data1[i] = (i * 3) & 0xFF;
        data2[i] = (i * 5) & 0xFF;
      }
      
      const accum = new Uint8Array(size);
      native.gf_mulAccum2_veor3(data1, 1, data2, 1, accum);
      
      // Should be data1 ^ data2
      for (let i = 0; i < size; i++) {
        expect(accum[i]).toBe(data1[i] ^ data2[i]);
      }
    });
  });

  describe('Pipelined Encoding', () => {
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
      const parityPipelined = native.encodePipelined(data, matrix, k, m, shardSize);
      
      expect(parityPipelined.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityPipelined[i]).toBe(parityParallel[i]);
      }
    });

    it('should work with various configurations', () => {
      const configs = [
        { k: 4, m: 2, shardSize: 512 },
        { k: 10, m: 4, shardSize: 2048 },
        { k: 20, m: 10, shardSize: 1024 },
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
        const parityPipelined = native.encodePipelined(data, matrix, k, m, shardSize);
        
        for (let i = 0; i < parityParallel.length; i++) {
          expect(parityPipelined[i]).toBe(parityParallel[i]);
        }
      }
    });
  });

  describe('Non-Temporal Encoding', () => {
    it('should produce same results as parallel encoding', () => {
      const k = 10;
      const m = 4;
      const shardSize = 4096;
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 11) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityNonTemporal = native.encodeNonTemporal(data, matrix, k, m, shardSize);
      
      expect(parityNonTemporal.length).toBe(parityParallel.length);
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityNonTemporal[i]).toBe(parityParallel[i]);
      }
    });

    it('should work with large shard sizes', () => {
      const k = 6;
      const m = 3;
      const shardSize = 65536;  // 64KB
      
      const dataSize = k * shardSize;
      const data = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) data[i] = (i * 17) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
      const parityNonTemporal = native.encodeNonTemporal(data, matrix, k, m, shardSize);
      
      for (let i = 0; i < parityParallel.length; i++) {
        expect(parityNonTemporal[i]).toBe(parityParallel[i]);
      }
    });
  });

  describe('Encoding Produces Valid Parity', () => {
    it('pipelined encoding should enable data reconstruction', () => {
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
      
      const parity = native.encodePipelined(originalData, matrix, k, m, shardSize);
      
      // Simulate losing first data shard
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

    it('non-temporal encoding should enable data reconstruction', () => {
      const k = 6;
      const m = 3;
      const shardSize = 512;
      
      const dataSize = k * shardSize;
      const originalData = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) originalData[i] = (i * 13) & 0xFF;
      
      const totalShards = k + m;
      const matrixSize = totalShards * k;
      const matrix = new Uint8Array(matrixSize);
      native.buildCauchyMatrix(matrix, totalShards, k, 8);
      
      const parity = native.encodeNonTemporal(originalData, matrix, k, m, shardSize);
      
      // Simulate losing first data shard
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
});
