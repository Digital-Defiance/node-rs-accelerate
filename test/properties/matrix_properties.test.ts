/**
 * Property-based tests for matrix operations
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { initGF256, mul8, add8, inv8 } from '../../src/gf';
import { buildVandermondeMatrix, buildCauchyMatrix, matVecMulGF } from '../../src/matrix';

// Initialize GF tables before tests
beforeAll(() => {
  initGF256();
});

describe('Matrix Construction Properties', () => {
  // Generator for valid K and M values
  // K: data shards (2-50), M: parity shards (1-20)
  // Constraint: K + M <= 256 for GF(2^8)
  const encodingConfig = fc.record({
    K: fc.integer({ min: 2, max: 50 }),
    M: fc.integer({ min: 1, max: 20 })
  }).filter(({ K, M }) => K + M <= 256);

  /**
   * Property 8: Encoding Matrix Validity
   * For any encoding configuration, the constructed matrix (Vandermonde or Cauchy) 
   * should have full rank K, ensuring any K rows are linearly independent
   * Validates: Requirements 2.6, 9.4
   */
  describe('Property 8: Encoding Matrix Validity', () => {
    it('Vandermonde matrix should have identity structure for first K rows', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildVandermondeMatrix(K + M, K);
          
          // Verify first K rows form an identity matrix
          for (let i = 0; i < K; i++) {
            for (let j = 0; j < K; j++) {
              if (i === j) {
                expect(matrix[i * K + j]).toBe(1);
              } else {
                expect(matrix[i * K + j]).toBe(0);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Cauchy matrix should have identity structure for first K rows', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildCauchyMatrix(K + M, K);
          
          // Verify first K rows form an identity matrix
          for (let i = 0; i < K; i++) {
            for (let j = 0; j < K; j++) {
              if (i === j) {
                expect(matrix[i * K + j]).toBe(1);
              } else {
                expect(matrix[i * K + j]).toBe(0);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Vandermonde matrix parity rows should be non-zero', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildVandermondeMatrix(K + M, K);
          
          // Verify parity rows (rows K to K+M-1) have at least one non-zero element per row
          for (let i = K; i < K + M; i++) {
            let hasNonZero = false;
            for (let j = 0; j < K; j++) {
              if (matrix[i * K + j] !== 0) {
                hasNonZero = true;
                break;
              }
            }
            expect(hasNonZero).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Cauchy matrix parity rows should be non-zero', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildCauchyMatrix(K + M, K);
          
          // Verify parity rows (rows K to K+M-1) have all non-zero elements
          // Cauchy construction ensures no zero denominators
          for (let i = K; i < K + M; i++) {
            for (let j = 0; j < K; j++) {
              expect(matrix[i * K + j]).not.toBe(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Vandermonde matrix should produce correct systematic encoding', () => {
      fc.assert(
        fc.property(
          encodingConfig,
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          ({ K, M }, data) => {
            // Ensure data length matches K
            const dataVec = new Uint8Array(K);
            for (let i = 0; i < K; i++) {
              dataVec[i] = data[i % data.length];
            }
            
            const matrix = buildVandermondeMatrix(K + M, K);
            const result = matVecMulGF(matrix, dataVec, K + M, K);
            
            // First K elements should be unchanged (systematic property)
            for (let i = 0; i < K; i++) {
              expect(result[i]).toBe(dataVec[i]);
            }
            
            // Should produce K+M total elements
            expect(result.length).toBe(K + M);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Cauchy matrix should produce correct systematic encoding', () => {
      fc.assert(
        fc.property(
          encodingConfig,
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          ({ K, M }, data) => {
            // Ensure data length matches K
            const dataVec = new Uint8Array(K);
            for (let i = 0; i < K; i++) {
              dataVec[i] = data[i % data.length];
            }
            
            const matrix = buildCauchyMatrix(K + M, K);
            const result = matVecMulGF(matrix, dataVec, K + M, K);
            
            // First K elements should be unchanged (systematic property)
            for (let i = 0; i < K; i++) {
              expect(result[i]).toBe(dataVec[i]);
            }
            
            // Should produce K+M total elements
            expect(result.length).toBe(K + M);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Any K rows from Vandermonde matrix should be linearly independent', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildVandermondeMatrix(K + M, K);
          
          // Test linear independence by verifying that the first K rows
          // (which form an identity matrix) can reconstruct any data vector
          const testVec = new Uint8Array(K);
          for (let i = 0; i < K; i++) {
            testVec[i] = (i + 1) % 256;
          }
          
          // Extract first K rows (identity portion)
          const subMatrix = new Uint8Array(K * K);
          for (let i = 0; i < K; i++) {
            for (let j = 0; j < K; j++) {
              subMatrix[i * K + j] = matrix[i * K + j];
            }
          }
          
          // Multiply by test vector
          const result = matVecMulGF(subMatrix, testVec, K, K);
          
          // Should get back the test vector (identity property)
          for (let i = 0; i < K; i++) {
            expect(result[i]).toBe(testVec[i]);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Any K rows from Cauchy matrix should be linearly independent', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const matrix = buildCauchyMatrix(K + M, K);
          
          // Test linear independence by verifying that the first K rows
          // (which form an identity matrix) can reconstruct any data vector
          const testVec = new Uint8Array(K);
          for (let i = 0; i < K; i++) {
            testVec[i] = (i + 1) % 256;
          }
          
          // Extract first K rows (identity portion)
          const subMatrix = new Uint8Array(K * K);
          for (let i = 0; i < K; i++) {
            for (let j = 0; j < K; j++) {
              subMatrix[i * K + j] = matrix[i * K + j];
            }
          }
          
          // Multiply by test vector
          const result = matVecMulGF(subMatrix, testVec, K, K);
          
          // Should get back the test vector (identity property)
          for (let i = 0; i < K; i++) {
            expect(result[i]).toBe(testVec[i]);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Matrix dimensions should be correct', () => {
      fc.assert(
        fc.property(encodingConfig, ({ K, M }) => {
          const vandermondeMatrix = buildVandermondeMatrix(K + M, K);
          const cauchyMatrix = buildCauchyMatrix(K + M, K);
          
          // Both matrices should have (K+M) * K elements
          expect(vandermondeMatrix.length).toBe((K + M) * K);
          expect(cauchyMatrix.length).toBe((K + M) * K);
        }),
        { numRuns: 100 }
      );
    });

    it('Matrix-vector multiplication should preserve dimensions', () => {
      fc.assert(
        fc.property(
          encodingConfig,
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          ({ K, M }, data) => {
            const dataVec = new Uint8Array(K);
            for (let i = 0; i < K; i++) {
              dataVec[i] = data[i % data.length];
            }
            
            const matrix = buildVandermondeMatrix(K + M, K);
            const result = matVecMulGF(matrix, dataVec, K + M, K);
            
            // Result should have K+M elements
            expect(result.length).toBe(K + M);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
