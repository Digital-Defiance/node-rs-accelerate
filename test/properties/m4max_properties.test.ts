/**
 * Property-Based Tests for M4 Max Extreme Optimizations
 * 
 * These tests verify mathematical correctness of M4 Max-specific
 * hardware exploitation techniques using fast-check.
 * 
 * Properties tested:
 * 1. 4-way mulAccum equivalence to standard implementation
 * 2. 8-way mulAccum equivalence to standard implementation
 * 3. 4-way XOR correctness and commutativity
 * 4. Quad mulAccum equivalence to four separate operations
 * 5. All encoding methods produce identical results
 * 6. All encoding methods enable correct reconstruction
 */

import * as fc from 'fast-check';
import * as path from 'path';

const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('M4 Max Optimization Properties', () => {
  beforeAll(() => {
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
    native.initExtreme();
    native.initM4Max();
  });

  describe('4-Way Multiply-Accumulate Properties', () => {
    it('Property: mulAccum4Way === standard mulAccum for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 256, max: 4096 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 256, maxLength: 4096 }),
          fc.integer({ min: 0, max: 255 }),
          (size, dataVals, coeff) => {
            const len = Math.min(size, dataVals.length);
            const data = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              data[i] = dataVals[i % dataVals.length];
            }
            
            const expected = new Uint8Array(len);
            native.gf_mulAccum_interleaved(data, coeff, expected);
            
            const actual = new Uint8Array(len);
            native.gf_mulAccum4Way(data, coeff, actual);
            
            for (let i = 0; i < len; i++) {
              if (actual[i] !== expected[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: mulAccum4Way with coeff=0 leaves accumulator unchanged', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          (dataVals, accumVals) => {
            const len = Math.min(dataVals.length, accumVals.length);
            const data = new Uint8Array(dataVals.slice(0, len));
            const accum = new Uint8Array(accumVals.slice(0, len));
            const original = new Uint8Array(accum);
            
            native.gf_mulAccum4Way(data, 0, accum);
            
            for (let i = 0; i < len; i++) {
              if (accum[i] !== original[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('8-Way Multiply-Accumulate Properties', () => {
    it('Property: mulAccum8Way === standard mulAccum for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 512, max: 8192 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 512, maxLength: 2048 }),
          fc.integer({ min: 0, max: 255 }),
          (size, dataVals, coeff) => {
            const len = Math.min(size, dataVals.length);
            const data = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              data[i] = dataVals[i % dataVals.length];
            }
            
            const expected = new Uint8Array(len);
            native.gf_mulAccum_interleaved(data, coeff, expected);
            
            const actual = new Uint8Array(len);
            native.gf_mulAccum8Way(data, coeff, actual);
            
            for (let i = 0; i < len; i++) {
              if (actual[i] !== expected[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('4-Way XOR Properties', () => {
    it('Property: xor4Vec(a, b, c, d) === a ^ b ^ c ^ d for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 256 }),
          (size, aVals, bVals, cVals, dVals) => {
            const len = Math.min(size, aVals.length, bVals.length, cVals.length, dVals.length);
            const a = new Uint8Array(len);
            const b = new Uint8Array(len);
            const c = new Uint8Array(len);
            const d = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
              a[i] = aVals[i % aVals.length];
              b[i] = bVals[i % bVals.length];
              c[i] = cVals[i % cVals.length];
              d[i] = dVals[i % dVals.length];
            }
            
            const out = new Uint8Array(len);
            native.gf_xor4Vec(a, b, c, d, out);
            
            for (let i = 0; i < len; i++) {
              if (out[i] !== (a[i] ^ b[i] ^ c[i] ^ d[i])) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: xor4Vec is commutative - order does not matter', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 128 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 128 }),
          (aVals, bVals, cVals, dVals) => {
            const len = Math.min(aVals.length, bVals.length, cVals.length, dVals.length);
            const a = new Uint8Array(aVals.slice(0, len));
            const b = new Uint8Array(bVals.slice(0, len));
            const c = new Uint8Array(cVals.slice(0, len));
            const d = new Uint8Array(dVals.slice(0, len));
            
            const out1 = new Uint8Array(len);
            const out2 = new Uint8Array(len);
            
            native.gf_xor4Vec(a, b, c, d, out1);
            native.gf_xor4Vec(d, c, b, a, out2);
            
            for (let i = 0; i < len; i++) {
              if (out1[i] !== out2[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Quad Multiply-Accumulate Properties', () => {
    it('Property: mulAccum4_xor4 === four separate mulAccum operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 64, max: 512 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 512 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (size, d1Vals, d2Vals, d3Vals, d4Vals, c1, c2, c3, c4) => {
            const len = Math.min(size, d1Vals.length, d2Vals.length, d3Vals.length, d4Vals.length);
            const data1 = new Uint8Array(len);
            const data2 = new Uint8Array(len);
            const data3 = new Uint8Array(len);
            const data4 = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
              data1[i] = d1Vals[i % d1Vals.length];
              data2[i] = d2Vals[i % d2Vals.length];
              data3[i] = d3Vals[i % d3Vals.length];
              data4[i] = d4Vals[i % d4Vals.length];
            }
            
            // Expected: four separate operations
            const expected = new Uint8Array(len);
            native.gf_mulAccum_interleaved(data1, c1, expected);
            native.gf_mulAccum_interleaved(data2, c2, expected);
            native.gf_mulAccum_interleaved(data3, c3, expected);
            native.gf_mulAccum_interleaved(data4, c4, expected);
            
            // Actual: single quad operation
            const actual = new Uint8Array(len);
            native.gf_mulAccum4_xor4(data1, c1, data2, c2, data3, c3, data4, c4, actual);
            
            for (let i = 0; i < len; i++) {
              if (actual[i] !== expected[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: mulAccum4_xor4 with all zero coefficients leaves accumulator unchanged', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 256 }),
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 64, maxLength: 256 }),
          (d1Vals, d2Vals, d3Vals, d4Vals, accumVals) => {
            const len = Math.min(d1Vals.length, d2Vals.length, d3Vals.length, d4Vals.length, accumVals.length);
            const data1 = new Uint8Array(d1Vals.slice(0, len));
            const data2 = new Uint8Array(d2Vals.slice(0, len));
            const data3 = new Uint8Array(d3Vals.slice(0, len));
            const data4 = new Uint8Array(d4Vals.slice(0, len));
            const accum = new Uint8Array(accumVals.slice(0, len));
            const original = new Uint8Array(accum);
            
            native.gf_mulAccum4_xor4(data1, 0, data2, 0, data3, 0, data4, 0, accum);
            
            for (let i = 0; i < len; i++) {
              if (accum[i] !== original[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Encoding Method Equivalence Properties', () => {
    const encodingMethods = ['encode16Core', 'encodeCacheAligned', 'encodeBandwidthOptimized', 'encodeHugePage'];

    it('Property: All M4 encoding methods produce identical results to parallel encoding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 16 }),  // k
          fc.integer({ min: 2, max: 8 }),   // m
          fc.integer({ min: 8, max: 11 }),  // log2(shardSize)
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 500 }),
          (k, m, log2Size, dataVals) => {
            const shardSize = 1 << log2Size;
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
            
            for (const method of encodingMethods) {
              const parityM4 = native[method](data, matrix, k, m, shardSize);
              
              if (parityM4.length !== parityParallel.length) return false;
              
              for (let i = 0; i < parityParallel.length; i++) {
                if (parityM4[i] !== parityParallel[i]) return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Encoding Reconstruction Properties', () => {
    const encodingMethods = [
      { name: '16-core', fn: 'encode16Core' },
      { name: 'cache-aligned', fn: 'encodeCacheAligned' },
      { name: 'bandwidth-optimized', fn: 'encodeBandwidthOptimized' },
      { name: 'huge-page', fn: 'encodeHugePage' },
    ];

    for (const { name, fn } of encodingMethods) {
      it(`Property: ${name} encoding enables correct reconstruction for all inputs`, () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 4, max: 12 }),  // k
            fc.integer({ min: 2, max: 6 }),   // m
            fc.integer({ min: 8, max: 10 }),  // log2(shardSize)
            fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 300 }),
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
              
              const parity = native[fn](originalData, matrix, k, m, shardSize);
              
              // Select k shards (drop some data, use parity)
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
          { numRuns: 15 }
        );
      });
    }
  });

  describe('Strategy Selection Properties', () => {
    it('Property: strategy selection returns valid strategy for all inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 64, max: 10 * 1024 * 1024 }),
          fc.integer({ min: 2, max: 255 }),
          fc.integer({ min: 1, max: 128 }),
          (shardSize, dataShards, parityShards) => {
            const strategy = native.getOptimalM4Strategy(shardSize, dataShards, parityShards);
            return strategy >= 0 && strategy <= 3;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: huge page strategy for shards >= 2MB', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2 * 1024 * 1024, max: 10 * 1024 * 1024 }),
          fc.integer({ min: 4, max: 50 }),
          fc.integer({ min: 2, max: 20 }),
          (shardSize, dataShards, parityShards) => {
            const strategy = native.getOptimalM4Strategy(shardSize, dataShards, parityShards);
            return strategy === 3;  // Huge page
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
