/**
 * Property-based tests for Advanced SIMD optimizations
 * 
 * Uses fast-check to verify mathematical properties hold across random inputs:
 * - Correctness: SIMD results match scalar reference
 * - Consistency: Different implementations produce same results
 * - Algebraic properties: GF operations satisfy field axioms
 */

import * as fc from 'fast-check';
import * as path from 'path';

// Load native module
const native = require(path.join(__dirname, '..', '..', 'build', 'Release', 'node_rs_accelerate.node'));

describe('SIMD Property-Based Tests', () => {
  beforeAll(() => {
    native.initGF();
    native.initNEON();
    native.initAccelerate();
    native.initSIMD();
  });

  describe('vtbl Multiply by Constant Properties', () => {
    it('should match scalar multiplication for all inputs', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10000 }),
          fc.integer({ min: 0, max: 255 }),
          (data, constant) => {
            const out = new Uint8Array(data.length);
            native.gf_mulVecConstant_vtbl(data, constant, out);
            
            for (let i = 0; i < data.length; i++) {
              const expected = native.gf_mul8(data[i], constant);
              if (out[i] !== expected) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should satisfy multiplicative identity (x * 1 = x)', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (data) => {
            const out = new Uint8Array(data.length);
            native.gf_mulVecConstant_vtbl(data, 1, out);
            
            for (let i = 0; i < data.length; i++) {
              if (out[i] !== data[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should satisfy zero property (x * 0 = 0)', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (data) => {
            const out = new Uint8Array(data.length);
            native.gf_mulVecConstant_vtbl(data, 0, out);
            
            for (let i = 0; i < data.length; i++) {
              if (out[i] !== 0) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match NEON implementation', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          fc.integer({ min: 0, max: 255 }),
          (data, constant) => {
            const outVtbl = new Uint8Array(data.length);
            const outNeon = new Uint8Array(data.length);
            
            native.gf_mulVecConstant_vtbl(data, constant, outVtbl);
            native.gf_mulVecConstant8_NEON(data, constant, outNeon);
            
            for (let i = 0; i < data.length; i++) {
              if (outVtbl[i] !== outNeon[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('pmull Vector Multiply Properties', () => {
    it('should match scalar multiplication for all inputs', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          (a, b) => {
            const len = Math.min(a.length, b.length);
            const aSlice = a.slice(0, len);
            const bSlice = b.slice(0, len);
            const out = new Uint8Array(len);
            
            native.gf_mulVec_pmull(aSlice, bSlice, out);
            
            for (let i = 0; i < len; i++) {
              const expected = native.gf_mul8(aSlice[i], bSlice[i]);
              if (out[i] !== expected) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be commutative (a * b = b * a)', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (a, b) => {
            const len = Math.min(a.length, b.length);
            const aSlice = a.slice(0, len);
            const bSlice = b.slice(0, len);
            const out1 = new Uint8Array(len);
            const out2 = new Uint8Array(len);
            
            native.gf_mulVec_pmull(aSlice, bSlice, out1);
            native.gf_mulVec_pmull(bSlice, aSlice, out2);
            
            for (let i = 0; i < len; i++) {
              if (out1[i] !== out2[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Interleaved Multiply-Accumulate Properties', () => {
    it('should correctly accumulate (accum ^= data * constant)', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          fc.integer({ min: 0, max: 255 }),
          (data, initialAccum, constant) => {
            const len = Math.min(data.length, initialAccum.length);
            const dataSlice = data.slice(0, len);
            const accum = initialAccum.slice(0, len);
            const originalAccum = new Uint8Array(accum);
            
            native.gf_mulAccum_interleaved(dataSlice, constant, accum);
            
            for (let i = 0; i < len; i++) {
              const product = native.gf_mul8(dataSlice[i], constant);
              const expected = originalAccum[i] ^ product;
              if (accum[i] !== expected) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should leave accumulator unchanged when constant is 0', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (data, initialAccum) => {
            const len = Math.min(data.length, initialAccum.length);
            const dataSlice = data.slice(0, len);
            const accum = initialAccum.slice(0, len);
            const originalAccum = new Uint8Array(accum);
            
            native.gf_mulAccum_interleaved(dataSlice, 0, accum);
            
            for (let i = 0; i < len; i++) {
              if (accum[i] !== originalAccum[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match Accelerate implementation', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 5000 }),
          fc.integer({ min: 0, max: 255 }),
          (data, constant) => {
            const accumInterleaved = new Uint8Array(data.length);
            const accumAccelerate = new Uint8Array(data.length);
            
            native.gf_mulAccum_interleaved(data, constant, accumInterleaved);
            native.gf_mulAccum_Accelerate(data, constant, accumAccelerate);
            
            for (let i = 0; i < data.length; i++) {
              if (accumInterleaved[i] !== accumAccelerate[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Parallel Encoding Properties', () => {
    // Helper to generate valid RS configurations
    const rsConfig = fc.record({
      k: fc.integer({ min: 2, max: 20 }),
      m: fc.integer({ min: 1, max: 10 }),
      shardSize: fc.integer({ min: 64, max: 4096 }).map(s => s - (s % 64)) // Align to 64 bytes
    }).filter(({ k, m }) => k + m <= 255);

    it('should match Accelerate encoding', () => {
      fc.assert(
        fc.property(
          rsConfig,
          ({ k, m, shardSize }) => {
            const dataSize = k * shardSize;
            const data = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) data[i] = (i * 7) & 0xFF;
            
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parityParallel = native.encodeParallel(data, matrix, k, m, shardSize);
            const parityAccelerate = native.encodeAccelerate(data, matrix, k, m, shardSize);
            
            if (parityParallel.length !== parityAccelerate.length) return false;
            
            for (let i = 0; i < parityParallel.length; i++) {
              if (parityParallel[i] !== parityAccelerate[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 20 } // Fewer runs due to encoding being expensive
      );
    });

    it('should produce parity that enables reconstruction', () => {
      fc.assert(
        fc.property(
          rsConfig,
          fc.integer({ min: 0, max: 255 }),
          ({ k, m, shardSize }, seed) => {
            // Create deterministic test data based on seed
            const dataSize = k * shardSize;
            const originalData = new Uint8Array(dataSize);
            for (let i = 0; i < dataSize; i++) {
              originalData[i] = ((i * seed) + (i >> 8)) & 0xFF;
            }
            
            // Build matrix and encode
            const totalShards = k + m;
            const matrixSize = totalShards * k;
            const matrix = new Uint8Array(matrixSize);
            native.buildCauchyMatrix(matrix, totalShards, k, 8);
            
            const parity = native.encodeParallel(originalData, matrix, k, m, shardSize);
            
            // Simulate losing first data shard, use first parity shard instead
            const availableShards: Uint8Array[] = [];
            const shardIndices: number[] = [];
            
            // Use data shards 1 through k-1 (skip shard 0)
            for (let i = 1; i < k; i++) {
              const shard = new Uint8Array(shardSize);
              shard.set(originalData.subarray(i * shardSize, (i + 1) * shardSize));
              availableShards.push(shard);
              shardIndices.push(i);
            }
            
            // Add first parity shard
            const parityShard = new Uint8Array(shardSize);
            parityShard.set(parity.subarray(0, shardSize));
            availableShards.push(parityShard);
            shardIndices.push(k);
            
            // Decode
            const decoded = native.decode(
              availableShards,
              new Int32Array(shardIndices),
              k, m, shardSize, matrix, 8
            );
            
            // Verify reconstruction
            for (let i = 0; i < dataSize; i++) {
              if (decoded[i] !== originalData[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('Algebraic Properties', () => {
    it('should satisfy distributive property: a * (b + c) = a*b + a*c', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 500 }),
          fc.uint8Array({ minLength: 1, maxLength: 500 }),
          fc.integer({ min: 1, max: 255 }),
          (b, c, a) => {
            const len = Math.min(b.length, c.length);
            const bSlice = b.slice(0, len);
            const cSlice = c.slice(0, len);
            
            // Compute b + c (XOR in GF)
            const bPlusC = new Uint8Array(len);
            for (let i = 0; i < len; i++) bPlusC[i] = bSlice[i] ^ cSlice[i];
            
            // Compute a * (b + c)
            const lhs = new Uint8Array(len);
            native.gf_mulVecConstant_vtbl(bPlusC, a, lhs);
            
            // Compute a*b + a*c
            const ab = new Uint8Array(len);
            const ac = new Uint8Array(len);
            native.gf_mulVecConstant_vtbl(bSlice, a, ab);
            native.gf_mulVecConstant_vtbl(cSlice, a, ac);
            
            const rhs = new Uint8Array(len);
            for (let i = 0; i < len; i++) rhs[i] = ab[i] ^ ac[i];
            
            // Verify equality
            for (let i = 0; i < len; i++) {
              if (lhs[i] !== rhs[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should satisfy associative property for multiplication', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 500 }),
          fc.integer({ min: 1, max: 255 }),
          fc.integer({ min: 1, max: 255 }),
          (data, a, b) => {
            // Compute (data * a) * b
            const temp1 = new Uint8Array(data.length);
            const lhs = new Uint8Array(data.length);
            native.gf_mulVecConstant_vtbl(data, a, temp1);
            native.gf_mulVecConstant_vtbl(temp1, b, lhs);
            
            // Compute data * (a * b)
            const ab = native.gf_mul8(a, b);
            const rhs = new Uint8Array(data.length);
            native.gf_mulVecConstant_vtbl(data, ab, rhs);
            
            // Verify equality
            for (let i = 0; i < data.length; i++) {
              if (lhs[i] !== rhs[i]) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
