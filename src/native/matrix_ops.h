/**
 * Matrix operations header
 */

#ifndef MATRIX_OPS_H
#define MATRIX_OPS_H

#include <cstdint>

namespace Matrix {
  // Construct encoding matrices
  void buildVandermondeMatrix(uint8_t* matrix, int rows, int cols, int field);
  void buildCauchyMatrix(uint8_t* matrix, int rows, int cols, int field);
  
  // Matrix-vector multiplication in GF
  void matVecMulGF(const uint8_t* matrix, const uint8_t* vec, 
                   uint8_t* out, int rows, int cols, int field);
  
  // Matrix inversion for decoding
  void invertMatrixGF(uint8_t* matrix, int size, int field);
  
  // Gaussian elimination
  void gaussianElimination(uint8_t* matrix, uint8_t* augmented, 
                          int rows, int cols, int augCols, int field);
}

#endif // MATRIX_OPS_H
