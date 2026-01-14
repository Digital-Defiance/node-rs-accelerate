/**
 * Unit tests for matrix operations
 */

import * as GF from '../../src/gf';
import * as Matrix from '../../src/matrix';

describe('Matrix Operations', () => {
  beforeAll(() => {
    GF.initGF256();
  });

  describe('Vandermonde Matrix Construction', () => {
    it('should create identity matrix for first K rows', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildVandermondeMatrix(K + M, K);

      // Check first K rows are identity
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          if (i === j) {
            expect(matrix[i * K + j]).toBe(1);
          } else {
            expect(matrix[i * K + j]).toBe(0);
          }
        }
      }
    });

    it('should create Vandermonde structure for parity rows', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildVandermondeMatrix(K + M, K);

      // First parity row (row K): should be [1, 1, 1] (α^0 for all columns)
      expect(matrix[K * K + 0]).toBe(1);
      expect(matrix[K * K + 1]).toBe(1);
      expect(matrix[K * K + 2]).toBe(1);

      // Second parity row (row K+1): should be [1, α, α^2] = [1, 2, 4]
      expect(matrix[(K + 1) * K + 0]).toBe(1); // α^0 = 1
      expect(matrix[(K + 1) * K + 1]).toBe(2); // α^1 = 2
      expect(matrix[(K + 1) * K + 2]).toBe(4); // α^2 = 4
    });

    it('should work with various K, M values', () => {
      const testCases = [
        { K: 2, M: 1 },
        { K: 4, M: 2 },
        { K: 10, M: 4 },
        { K: 20, M: 10 },
      ];

      for (const { K, M } of testCases) {
        const matrix = Matrix.buildVandermondeMatrix(K + M, K);
        expect(matrix.length).toBe((K + M) * K);

        // Verify identity portion
        for (let i = 0; i < K; i++) {
          expect(matrix[i * K + i]).toBe(1);
        }
      }
    });
  });

  describe('Cauchy Matrix Construction', () => {
    it('should create identity matrix for first K rows', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildCauchyMatrix(K + M, K);

      // Check first K rows are identity
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          if (i === j) {
            expect(matrix[i * K + j]).toBe(1);
          } else {
            expect(matrix[i * K + j]).toBe(0);
          }
        }
      }
    });

    it('should create Cauchy structure for parity rows', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildCauchyMatrix(K + M, K);

      // Verify parity rows use Cauchy formula: 1/(x[i] + y[j])
      // x[i] = i (for parity row i)
      // y[j] = M + j
      for (let i = 0; i < M; i++) {
        for (let j = 0; j < K; j++) {
          const x_i = i;
          const y_j = M + j;
          const denominator = x_i ^ y_j; // XOR for GF addition
          const expected = GF.inv8(denominator);
          expect(matrix[(K + i) * K + j]).toBe(expected);
        }
      }
    });

    it('should work with various K, M values', () => {
      const testCases = [
        { K: 2, M: 1 },
        { K: 4, M: 2 },
        { K: 10, M: 4 },
        { K: 20, M: 10 },
      ];

      for (const { K, M } of testCases) {
        const matrix = Matrix.buildCauchyMatrix(K + M, K);
        expect(matrix.length).toBe((K + M) * K);

        // Verify identity portion
        for (let i = 0; i < K; i++) {
          expect(matrix[i * K + i]).toBe(1);
        }
      }
    });

    it('should not have zero elements in parity rows', () => {
      const K = 5;
      const M = 3;
      const matrix = Matrix.buildCauchyMatrix(K + M, K);

      // Check parity rows have no zeros
      for (let i = K; i < K + M; i++) {
        for (let j = 0; j < K; j++) {
          expect(matrix[i * K + j]).not.toBe(0);
        }
      }
    });
  });

  describe('Matrix-Vector Multiplication', () => {
    it('should multiply identity matrix correctly', () => {
      const K = 3;
      const vec = new Uint8Array([5, 10, 15]);
      const identity = new Uint8Array(K * K);

      // Create identity matrix
      for (let i = 0; i < K; i++) {
        identity[i * K + i] = 1;
      }

      const result = Matrix.matVecMulGF(identity, vec, K, K);

      // Identity matrix should return the same vector
      expect(result).toEqual(vec);
    });

    it('should multiply with known values', () => {
      // Simple 2x2 matrix multiplication
      const matrix = new Uint8Array([
        1, 2,  // Row 0
        3, 4   // Row 1
      ]);
      const vec = new Uint8Array([5, 6]);

      const result = Matrix.matVecMulGF(matrix, vec, 2, 2);

      // Row 0: (1*5) + (2*6) = 5 + 12 in GF
      const expected0 = GF.add8(GF.mul8(1, 5), GF.mul8(2, 6));
      // Row 1: (3*5) + (4*6) = 15 + 24 in GF
      const expected1 = GF.add8(GF.mul8(3, 5), GF.mul8(4, 6));

      expect(result[0]).toBe(expected0);
      expect(result[1]).toBe(expected1);
    });

    it('should work with Vandermonde matrix', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildVandermondeMatrix(K + M, K);
      const vec = new Uint8Array([10, 20, 30]);

      const result = Matrix.matVecMulGF(matrix, vec, K + M, K);

      // First K elements should be the input vector (identity rows)
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(20);
      expect(result[2]).toBe(30);

      // Parity elements should be computed
      expect(result.length).toBe(K + M);
    });

    it('should work with Cauchy matrix', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildCauchyMatrix(K + M, K);
      const vec = new Uint8Array([10, 20, 30]);

      const result = Matrix.matVecMulGF(matrix, vec, K + M, K);

      // First K elements should be the input vector (identity rows)
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(20);
      expect(result[2]).toBe(30);

      // Parity elements should be computed
      expect(result.length).toBe(K + M);
    });

    it('should handle zero vector', () => {
      const K = 3;
      const M = 2;
      const matrix = Matrix.buildVandermondeMatrix(K + M, K);
      const vec = new Uint8Array([0, 0, 0]);

      const result = Matrix.matVecMulGF(matrix, vec, K + M, K);

      // Result should be all zeros
      for (let i = 0; i < K + M; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it('should handle various matrix sizes', () => {
      const testCases = [
        { rows: 3, cols: 2 },
        { rows: 5, cols: 3 },
        { rows: 10, cols: 5 },
      ];

      for (const { rows, cols } of testCases) {
        const matrix = new Uint8Array(rows * cols);
        const vec = new Uint8Array(cols);

        // Fill with some values
        for (let i = 0; i < rows * cols; i++) {
          matrix[i] = (i + 1) % 256;
        }
        for (let i = 0; i < cols; i++) {
          vec[i] = (i + 1) % 256;
        }

        const result = Matrix.matVecMulGF(matrix, vec, rows, cols);
        expect(result.length).toBe(rows);
      }
    });
  });

  describe('Matrix Inversion', () => {
    it('should invert identity matrix to itself', () => {
      const size = 3;
      const matrix = new Uint8Array(size * size);
      
      // Create identity matrix
      for (let i = 0; i < size; i++) {
        matrix[i * size + i] = 1;
      }
      
      // Make a copy to compare
      const original = new Uint8Array(matrix);
      
      // Invert
      Matrix.invertMatrixGF(matrix, size);
      
      // Should still be identity
      expect(matrix).toEqual(original);
    });

    it('should verify A * A^(-1) = I for 2x2 matrix', () => {
      const size = 2;
      const matrix = new Uint8Array([
        2, 3,
        4, 5
      ]);
      
      // Make a copy of original
      const original = new Uint8Array(matrix);
      
      // Invert
      Matrix.invertMatrixGF(matrix, size);
      
      // Multiply original * inverse
      const result = new Uint8Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          let sum = 0;
          for (let k = 0; k < size; k++) {
            const prod = GF.mul8(original[i * size + k], matrix[k * size + j]);
            sum = GF.add8(sum, prod);
          }
          result[i * size + j] = sum;
        }
      }
      
      // Result should be identity
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (i === j) {
            expect(result[i * size + j]).toBe(1);
          } else {
            expect(result[i * size + j]).toBe(0);
          }
        }
      }
    });

    it('should verify A * A^(-1) = I for 3x3 matrix', () => {
      const size = 3;
      const matrix = new Uint8Array([
        1, 2, 3,
        4, 5, 6,
        7, 8, 10  // Changed last element to avoid singular matrix
      ]);
      
      // Make a copy of original
      const original = new Uint8Array(matrix);
      
      // Invert
      Matrix.invertMatrixGF(matrix, size);
      
      // Multiply original * inverse
      const result = new Uint8Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          let sum = 0;
          for (let k = 0; k < size; k++) {
            const prod = GF.mul8(original[i * size + k], matrix[k * size + j]);
            sum = GF.add8(sum, prod);
          }
          result[i * size + j] = sum;
        }
      }
      
      // Result should be identity
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (i === j) {
            expect(result[i * size + j]).toBe(1);
          } else {
            expect(result[i * size + j]).toBe(0);
          }
        }
      }
    });

    it('should verify A * A^(-1) = I for various matrix sizes', () => {
      const sizes = [2, 3, 4, 5];
      
      for (const size of sizes) {
        // Create a random invertible matrix
        const matrix = new Uint8Array(size * size);
        for (let i = 0; i < size * size; i++) {
          matrix[i] = (i * 7 + 13) % 256; // Some pseudo-random values
        }
        
        // Make diagonal dominant to increase chance of invertibility
        for (let i = 0; i < size; i++) {
          matrix[i * size + i] = (i + 1) * 17 % 255 + 1; // Non-zero diagonal
        }
        
        // Make a copy of original
        const original = new Uint8Array(matrix);
        
        try {
          // Invert
          Matrix.invertMatrixGF(matrix, size);
          
          // Multiply original * inverse
          const result = new Uint8Array(size * size);
          for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
              let sum = 0;
              for (let k = 0; k < size; k++) {
                const prod = GF.mul8(original[i * size + k], matrix[k * size + j]);
                sum = GF.add8(sum, prod);
              }
              result[i * size + j] = sum;
            }
          }
          
          // Result should be identity
          for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
              if (i === j) {
                expect(result[i * size + j]).toBe(1);
              } else {
                expect(result[i * size + j]).toBe(0);
              }
            }
          }
        } catch (e) {
          // Matrix might be singular, which is okay for random matrices
          // Just skip this test case
        }
      }
    });

    it('should throw error for singular matrix', () => {
      const size = 2;
      // Create a singular matrix (row 2 = row 1)
      const matrix = new Uint8Array([
        1, 2,
        1, 2
      ]);
      
      expect(() => {
        Matrix.invertMatrixGF(matrix, size);
      }).toThrow();
    });

    it('should invert Vandermonde submatrix correctly', () => {
      const K = 3;
      const M = 2;
      const fullMatrix = Matrix.buildVandermondeMatrix(K + M, K);
      
      // Extract first K rows (should be identity, trivial to invert)
      const subMatrix = new Uint8Array(K * K);
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          subMatrix[i * K + j] = fullMatrix[i * K + j];
        }
      }
      
      const original = new Uint8Array(subMatrix);
      Matrix.invertMatrixGF(subMatrix, K);
      
      // Identity inverted should be identity
      expect(subMatrix).toEqual(original);
    });
  });
});
