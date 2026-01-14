/**
 * Matrix operations TypeScript wrapper
 */

// Load native addon
const addon = require('../build/Release/node_rs_accelerate.node');

/**
 * Build Vandermonde matrix for Reed-Solomon encoding
 * 
 * @param rows Total rows (K+M)
 * @param cols Number of columns (K)
 * @param field Field size (8 for GF(2^8))
 * @returns Uint8Array containing the matrix in row-major order
 */
export function buildVandermondeMatrix(rows: number, cols: number, field: number = 8): Uint8Array {
  const matrix = new Uint8Array(rows * cols);
  addon.buildVandermondeMatrix(matrix, rows, cols, field);
  return matrix;
}

/**
 * Build Cauchy matrix for Reed-Solomon encoding
 * 
 * @param rows Total rows (K+M)
 * @param cols Number of columns (K)
 * @param field Field size (8 for GF(2^8))
 * @returns Uint8Array containing the matrix in row-major order
 */
export function buildCauchyMatrix(rows: number, cols: number, field: number = 8): Uint8Array {
  const matrix = new Uint8Array(rows * cols);
  addon.buildCauchyMatrix(matrix, rows, cols, field);
  return matrix;
}

/**
 * Matrix-vector multiplication in Galois Field
 * 
 * @param matrix Input matrix in row-major order (rows × cols)
 * @param vec Input vector (cols elements)
 * @param rows Number of rows in matrix
 * @param cols Number of columns in matrix
 * @param field Field size (8 for GF(2^8))
 * @returns Output vector (rows elements)
 */
export function matVecMulGF(
  matrix: Uint8Array,
  vec: Uint8Array,
  rows: number,
  cols: number,
  field: number = 8
): Uint8Array {
  const out = new Uint8Array(rows);
  addon.matVecMulGF(matrix, vec, out, rows, cols, field);
  return out;
}

/**
 * Invert a square matrix in Galois Field
 * 
 * @param matrix Input matrix (size × size) - will be modified in-place
 * @param size Matrix dimension
 * @param field Field size (8 for GF(2^8))
 */
export function invertMatrixGF(matrix: Uint8Array, size: number, field: number = 8): void {
  addon.invertMatrixGF(matrix, size, field);
}
