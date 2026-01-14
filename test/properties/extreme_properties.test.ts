/**
 * Property-Based Tests for Extreme Hardware Optimizations
 * 
 * These tests verify mathematical correctness of unconventional
 * hardware exploitation techniques using fast-check.
 * 
 * Properties tested:
 * 1. veor3 equivalence: a ^ b ^ c via veor3 === (a ^ b) ^ c
 * 2. mulAccum2_veor3 equivalence: double accum === two separate accums
 * 3. Pipelined encoding equivalence: same results as parallel encoding
 * 4. Non-temporal encoding equivalence: same results as parallel encoding
 */

import * as fc from 'fast-check';
import * as path from 'path';

const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('Extreme Optimization Properties', () => {
  beforeAll(() => {
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
    native.initExtreme();
  });

  describe('Three-Way XOR Properties', () => {
    it('Property: veor3(a, b, c) === (a ^ b) ^ c for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 256 }),
          (size, aVals, bVals, cVals) => {
            const len = Math.min(size, aVals.length, bVals.length, cVals.length);
            const a = new Uint8Array(len);
            const b = new Uint8Array(len);
            const c = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
              a[i] = aVals[i % aVals.length];
              b[i] = bVals[i % bVals.length];
              c[i] = cVals[i % cVals.length];
            }
            
            // Compute using veor3
            const veor3Result = new Uint8Array(len);
            native.gf_xor3Vec(a, b, c, veor3Result);
            
            // Compute using standard XOR
            const expected = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              expected[i] = a[i] ^ b[i] ^ c[i];
            }
            
            for (let i = 0; i < len; i++) {
              if (veor3Result[i] !== expected[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: veor3 is commutative - order of operands does not matter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          (size, aVals, bVals, cVals) => {
            const len = Math.min(size, aVals.length, bVals.length, cVals.length);
            const a = new Uint8Array(len);
            const b = new Uint8Array(len);
            const c = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
              a[i] = aVals[i % aVals.length];
              b[i] = bVals[i % bVals.length];
              c[i] = cVals[i % cVals.length];
            }
            
            // Test different orderings
            const abc = new Uint8Array(len);
            const acb = new Uint8Array(len);
            const bac = new Uint8Array(len);
            const bca = new Uint8Array(len);
            const cab = new Uint8Array(len);
            const cba = new Uint8Array(len);
            
            native.gf_xor3Vec(a, b, c, abc);
            native.gf_xor3Vec(a, c, b, acb);
            native.gf_xor3Vec(b, a, c, bac);
            native.gf_xor3Vec(b, c, a, bca);
            native.gf_xor3Vec(c, a, b, cab);
            native.gf_xor3Vec(c, b, a, cba);
            
            // All should be equal
            for (let i = 0; i < len; i++) {
              if (abc[i] !== acb[i] || abc[i] !== bac[i] || 
                  abc[i] !== bca[i] || abc[i] !== cab[i] || abc[i] !== cba[i]) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: veor3(a, a, a) === a (XOR with self twice)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          (aVals) => {
            const a = new Uint8Array(aVals);
            const out = new Uint8Array(a.length);
            
            native.gf_xor3Vec(a, a, a, out);
            
            // a ^ a ^ a = a
            for (let i = 0; i < a.length; i++) {
              if (out[i] !== a[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Double Multiply-Accumulate Properties', () => {
    it('Property: mulAccum2_veor3 === two separate mulAccum operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (size, data1Vals, data2Vals, coeff1, coeff2) => {
            const len = Math.min(size, data1Vals.length, data2Vals.length);
            const data1 = new Uint8Array(len);
            const data2 = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
              data1[i] = data1Vals[i % data1Vals.length];
              data2[i] = data2Vals[i % data2Vals.length];
            }
            
            // Method 1: Two separate mulAccum
            const expected = new Uint8Array(len);
            native.gf_mulAccum_interleaved(data1, coeff1, expected);
            native.gf_mulAccum_interleaved(data2, coeff2, expected);
            
            // Method 2: Single mulAccum2_veor3
            const actual = new Uint8Array(len);
            native.gf_mulAccum2_veor3(data1, coeff1, data2, coeff2, actual);
            
            for (let i = 0; i < len; i++) {
              if (actual[i] !== expected[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: mulAccum2_veor3 with zero coefficients leaves accumulator unchanged', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          (data1Vals, data2Vals, accumVals) => {
            const len = Math.min(data1Vals.length, data2Vals.length, accumVals.length);
            const data1 = new Uint8Array(data1Vals.slice(0, len));
            const data2 = new Uint8Array(data2Vals.slice(0, len));
            const accum = new Uint8Array(accumVals.slice(0, len));
            const original = new Uint8Array(accum);
            
            // Both coefficients zero
            native.gf_mulAccum2_veor3(data1, 0, data2, 0, accum);
            
            for (let i = 0; i < len; i++) {
              if (accum[i] !== original[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: mulAccum2_veor3 with coeff=1 is equivalent to XOR', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 128 }),
          (data1Vals, data2Vals) => {
            const len = Math.min(data1Vals.length, data2Vals.length);
            const data1 = new Uint8Array(data1Vals.slice(0, len));
            const data2 = new Uint8Array(data2Vals.slice(0, len));
            
            const accum = new Uint8Array(len);
            native.gf_mulAccum2_veor3(data1, 1, data2, 1, accum);
            
            // Should be data1 ^ data2
            for (let i = 0; i < len; i++) {
              if (accum[i] !== (data1[i] ^ data2[i])) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Pipelined Encoding Properties', () => {
    it('Property: pipelined encoding produces identical results to parallel encoding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 20 }),  // k (data shards)
          fc.integer({ min: 2, max: 10 }),  // m (parity shards)
          fc.integer({ min: 6, max: 10 }),  // log2(shardSize)
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 1000 }),
          (k, m, log2Size, dataVals) => {
            const shardSize = 1 << log2Size;  // 64 to 1024 bytes
            const dataSize = k * shardSize;
            
            const data = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) {
              data[i] = dataVals[i % dataVals.length];
            }
            
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
            const parityPipelined = native.encodePipelined(data, matrix, k, m, shardSize);
            
            if (parityParallel.length !== parityPipelined.length) return false;
            
            for (let i = 0; i < parityParallel.length; i++) {
              if (parityParallel[i] !== parityPipelined[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: pipelined encoding enables correct data reconstruction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 12 }),  // k
          fc.integer({ min: 2, max: 6 }),   // m
          fc.integer({ min: 7, max: 9 }),   // log2(shardSize)
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 500 }),
          fc.integer({ min: 0, max: 100 }), // seed for shard selection
          (k, m, log2Size, dataVals, seed) => {
            const shardSize = 1 << log2Size;
            const dataSize = k * shardSize;
            
            const originalData = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) {
              originalData[i] = dataVals[i % dataVals.length];
            }
            
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parity = native.encodePipelined(originalData, matrix, k, m, shardSize);
            
            // Select k shards (drop some data shards, use parity)
            const availableShards: Uint8Array[] = [];
            const shardIndices: number[] = [];
            
            // Use a deterministic selection based on seed
            const dropCount = Math.min(m, 1 + (seed % m));
            let dropped = 0;
            
            for (let i = 0; i < k && shardIndices.length < k; i++) {
              if (dropped < dropCount && (seed + i) % 3 === 0) {
                dropped++;
                continue;
              }
              const shard = new Uint8Array(shardSize);
              shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
              availableShards.push(shard);
              shardIndices.push(i);
            }
            
            // Add parity shards to reach k total
            for (let p = 0; p < m && shardIndices.length < k; p++) {
              const shard = new Uint8Array(shardSize);
              shard.set(parity.subarray(p * shardSize, (p + 1) * shardSize));
              availableShards.push(shard);
              shardIndices.push(k + p);
            }
            
            if (shardIndices.length < k) return true; // Skip if not enough shards
            
            const decoded = native.decode(
              availableShards,
              new Int32Array(shardIndices),
              k, m, shardSize, matrix, 8
            );
            
            for (let i = 0; i < dataSize; i++) {
              if (decoded[i] !== originalData[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Non-Temporal Encoding Properties', () => {
    it('Property: non-temporal encoding produces identical results to parallel encoding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 16 }),  // k
          fc.integer({ min: 2, max: 8 }),   // m
          fc.integer({ min: 8, max: 12 }),  // log2(shardSize) - larger for non-temporal
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 500 }),
          (k, m, log2Size, dataVals) => {
            const shardSize = 1 << log2Size;  // 256 to 4096 bytes
            const dataSize = k * shardSize;
            
            const data = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) {
              data[i] = dataVals[i % dataVals.length];
            }
            
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
            const parityNonTemporal = native.encodeNonTemporal(data, matrix, k, m, shardSize);
            
            if (parityParallel.length !== parityNonTemporal.length) return false;
            
            for (let i = 0; i < parityParallel.length; i++) {
              if (parityParallel[i] !== parityNonTemporal[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('Property: non-temporal encoding enables correct data reconstruction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 10 }),  // k
          fc.integer({ min: 2, max: 5 }),   // m
          fc.integer({ min: 9, max: 11 }),  // log2(shardSize)
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 300 }),
          fc.integer({ min: 0, max: 100 }), // seed
          (k, m, log2Size, dataVals, seed) => {
            const shardSize = 1 << log2Size;
            const dataSize = k * shardSize;
            
            const originalData = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) {
              originalData[i] = dataVals[i % dataVals.length];
            }
            
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parity = native.encodeNonTemporal(originalData, matrix, k, m, shardSize);
            
            // Select k shards
            const availableShards: Uint8Array[] = [];
            const shardIndices: number[] = [];
            
            const dropCount = Math.min(m, 1 + (seed % m));
            let dropped = 0;
            
            for (let i = 0; i < k && shardIndices.length < k; i++) {
              if (dropped < dropCount && (seed + i) % 3 === 0) {
                dropped++;
                continue;
              }
              const shard = new Uint8Array(shardSize);
              shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
              availableShards.push(shard);
              shardIndices.push(i);
            }
            
            for (let p = 0; p < m && shardIndices.length < k; p++) {
              const shard = new Uint8Array(shardSize);
              shard.set(parity.subarray(p * shardSize, (p + 1) * shardSize));
              availableShards.push(shard);
              shardIndices.push(k + p);
            }
            
            if (shardIndices.length < k) return true;
            
            const decoded = native.decode(
              availableShards,
              new Int32Array(shardIndices),
              k, m, shardSize, matrix, 8
            );
            
            for (let i = 0; i < dataSize; i++) {
              if (decoded[i] !== originalData[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Optimal Strategy Selection Properties', () => {
    it('Property: strategy selection returns valid strategy for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 64, max: 10 * 1024 * 1024 }),  // shardSize
          fc.integer({ min: 2, max: 255 }),                 // dataShards
          fc.integer({ min: 1, max: 128 }),                 // parityShards
          (shardSize, dataShards, parityShards) => {
            const strategy = native.getOptimalEncodingStrategy(shardSize, dataShards, parityShards);
            return strategy >= 0 && strategy <= 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: large shards (>=1MB) recommend non-temporal strategy', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024 * 1024, max: 10 * 1024 * 1024 }),  // >= 1MB
          fc.integer({ min: 4, max: 50 }),
          fc.integer({ min: 2, max: 20 }),
          (shardSize, dataShards, parityShards) => {
            const strategy = native.getOptimalEncodingStrategy(shardSize, dataShards, parityShards);
            return strategy === 2;  // Non-temporal
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
