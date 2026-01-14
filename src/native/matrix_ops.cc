/**
 * Matrix operations implementation
 */

#include "matrix_ops.h"
#include "gf_arithmetic.h"
#include <cstring>
#include <vector>
#include <algorithm>
#include <stdexcept>

namespace Matrix {
  /**
   * Build Vandermonde matrix for Reed-Solomon encoding
   * 
   * For systematic encoding with K data shards and M parity shards:
   * - First K rows are identity matrix (data shards pass through unchanged)
   * - Remaining M rows are Vandermonde matrix for parity computation
   * 
   * Vandermonde matrix structure:
   * Row i, Col j: α^(i*j) where α is the generator (typically 2)
   * 
   * @param matrix Output buffer for (K+M) × K matrix (row-major order)
   * @param rows Total rows (K+M)
   * @param cols Number of columns (K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   */
  void buildVandermondeMatrix(uint8_t* matrix, int rows, int cols, int field) {
    if (field == 16) {
      // For GF(2^16), we need to work with uint16_t
      // Cast the uint8_t pointer to uint16_t
      uint16_t* matrix16 = reinterpret_cast<uint16_t*>(matrix);
      
      // Initialize GF tables if not already done
      GF::initGF65536();
      
      // Clear the matrix
      std::memset(matrix, 0, rows * cols * sizeof(uint16_t));
      
      // First K rows: Identity matrix (systematic encoding)
      for (int i = 0; i < cols && i < rows; i++) {
        matrix16[i * cols + i] = 1;
      }
      
      // Remaining M rows: Vandermonde matrix for parity
      const uint16_t generator = 2;
      
      for (int i = cols; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
          int parity_row = i - cols;
          int exponent = parity_row * j;
          
          if (exponent == 0) {
            matrix16[i * cols + j] = 1;
          } else {
            uint16_t result = 1;
            for (int k = 0; k < exponent; k++) {
              result = GF::mul16(result, generator);
            }
            matrix16[i * cols + j] = result;
          }
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    // Initialize GF tables if not already done
    GF::initGF256();
    
    // Clear the matrix
    std::memset(matrix, 0, rows * cols);
    
    // First K rows: Identity matrix (systematic encoding)
    for (int i = 0; i < cols && i < rows; i++) {
      matrix[i * cols + i] = 1;
    }
    
    // Remaining M rows: Vandermonde matrix for parity
    // Row i (where i >= K), Col j: α^((i-K)*j)
    // Using generator α = 2
    const uint8_t generator = 2;
    
    for (int i = cols; i < rows; i++) {
      for (int j = 0; j < cols; j++) {
        // Compute α^((i-cols)*j) = 2^((i-cols)*j)
        int parity_row = i - cols; // 0-indexed parity row
        int exponent = parity_row * j;
        
        if (exponent == 0) {
          // α^0 = 1
          matrix[i * cols + j] = 1;
        } else {
          // Use repeated multiplication for power
          // Could optimize with GF::pow8, but this is clearer
          uint8_t result = 1;
          for (int k = 0; k < exponent; k++) {
            result = GF::mul8(result, generator);
          }
          matrix[i * cols + j] = result;
        }
      }
    }
  }
  
  /**
   * Build Cauchy matrix for Reed-Solomon encoding
   * 
   * Cauchy matrices have better numerical properties than Vandermonde matrices
   * and avoid certain degenerate cases.
   * 
   * For systematic encoding with K data shards and M parity shards:
   * - First K rows are identity matrix (data shards pass through unchanged)
   * - Remaining M rows use Cauchy formula: C[i][j] = 1/(x[i] + y[j])
   * 
   * We choose x and y values to ensure all denominators are non-zero:
   * - x[i] = i (for i = 0 to M-1)
   * - y[j] = M + j (for j = 0 to K-1)
   * 
   * This ensures x[i] + y[j] is never zero in GF(2^8)
   * 
   * @param matrix Output buffer for (K+M) × K matrix (row-major order)
   * @param rows Total rows (K+M)
   * @param cols Number of columns (K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   */
  void buildCauchyMatrix(uint8_t* matrix, int rows, int cols, int field) {
    if (field == 16) {
      // For GF(2^16), we need to work with uint16_t
      uint16_t* matrix16 = reinterpret_cast<uint16_t*>(matrix);
      
      // Initialize GF tables if not already done
      GF::initGF65536();
      
      // Clear the matrix
      std::memset(matrix, 0, rows * cols * sizeof(uint16_t));
      
      // First K rows: Identity matrix (systematic encoding)
      for (int i = 0; i < cols && i < rows; i++) {
        matrix16[i * cols + i] = 1;
      }
      
      // Remaining M rows: Cauchy matrix for parity
      int M = rows - cols;
      
      for (int i = cols; i < rows; i++) {
        int parity_row = i - cols;
        uint16_t x_i = parity_row;
        
        for (int j = 0; j < cols; j++) {
          uint16_t y_j = M + j;
          uint16_t denominator = x_i ^ y_j;
          
          if (denominator == 0) {
            throw std::runtime_error("Cauchy matrix construction failed: zero denominator");
          }
          
          matrix16[i * cols + j] = GF::inv16(denominator);
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    // Initialize GF tables if not already done
    GF::initGF256();
    
    // Clear the matrix
    std::memset(matrix, 0, rows * cols);
    
    // First K rows: Identity matrix (systematic encoding)
    for (int i = 0; i < cols && i < rows; i++) {
      matrix[i * cols + i] = 1;
    }
    
    // Remaining M rows: Cauchy matrix for parity
    // Choose x and y values to avoid zero denominators
    // x[i] = i (for parity rows)
    // y[j] = M + j (for columns)
    int M = rows - cols; // Number of parity shards
    
    for (int i = cols; i < rows; i++) {
      int parity_row = i - cols; // 0-indexed parity row
      uint8_t x_i = parity_row; // x value for this row
      
      for (int j = 0; j < cols; j++) {
        uint8_t y_j = M + j; // y value for this column
        
        // Compute 1/(x[i] + y[j]) in GF(2^8)
        // Addition in GF is XOR
        uint8_t denominator = x_i ^ y_j;
        
        if (denominator == 0) {
          throw std::runtime_error("Cauchy matrix construction failed: zero denominator");
        }
        
        // Division by denominator = multiplication by inverse
        matrix[i * cols + j] = GF::inv8(denominator);
      }
    }
  }
  
  /**
   * Matrix-vector multiplication in Galois Field
   * 
   * Computes: out = matrix × vec
   * Where matrix is (rows × cols) and vec is (cols × 1)
   * Result out is (rows × 1)
   * 
   * All operations are performed in GF(2^8):
   * - Multiplication uses GF::mul8
   * - Addition uses XOR (GF::add8)
   * 
   * @param matrix Input matrix in row-major order (rows × cols)
   * @param vec Input vector (cols elements)
   * @param out Output vector (rows elements)
   * @param rows Number of rows in matrix
   * @param cols Number of columns in matrix
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   */
  void matVecMulGF(const uint8_t* matrix, const uint8_t* vec, 
                   uint8_t* out, int rows, int cols, int field) {
    if (field == 16) {
      // For GF(2^16), work with uint16_t
      const uint16_t* matrix16 = reinterpret_cast<const uint16_t*>(matrix);
      const uint16_t* vec16 = reinterpret_cast<const uint16_t*>(vec);
      uint16_t* out16 = reinterpret_cast<uint16_t*>(out);
      
      // Initialize GF tables if not already done
      GF::initGF65536();
      
      // For each row in the matrix
      for (int i = 0; i < rows; i++) {
        uint16_t sum = 0;
        
        // Compute dot product of row i with vector
        for (int j = 0; j < cols; j++) {
          uint16_t matrix_elem = matrix16[i * cols + j];
          uint16_t vec_elem = vec16[j];
          
          // Multiply in GF and accumulate with XOR (GF addition)
          uint16_t product = GF::mul16(matrix_elem, vec_elem);
          sum = GF::add16(sum, product); // XOR
        }
        
        out16[i] = sum;
      }
      return;
    }
    
    // GF(2^8) implementation
    // Initialize GF tables if not already done
    GF::initGF256();
    
    // For each row in the matrix
    for (int i = 0; i < rows; i++) {
      uint8_t sum = 0;
      
      // Compute dot product of row i with vector
      for (int j = 0; j < cols; j++) {
        uint8_t matrix_elem = matrix[i * cols + j];
        uint8_t vec_elem = vec[j];
        
        // Multiply in GF and accumulate with XOR (GF addition)
        uint8_t product = GF::mul8(matrix_elem, vec_elem);
        sum = GF::add8(sum, product); // XOR
      }
      
      out[i] = sum;
    }
  }
  
  /**
   * Gaussian elimination in Galois Field
   * 
   * Performs Gaussian elimination with partial pivoting on an augmented matrix.
   * The input matrix is modified in-place to row echelon form.
   * 
   * @param matrix Input matrix (rows × cols) to be reduced
   * @param augmented Augmented matrix (rows × augCols) processed alongside
   * @param rows Number of rows
   * @param cols Number of columns in main matrix
   * @param augCols Number of columns in augmented matrix
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   */
  void gaussianElimination(uint8_t* matrix, uint8_t* augmented, 
                          int rows, int cols, int augCols, int field) {
    if (field == 16) {
      // For GF(2^16), work with uint16_t
      uint16_t* matrix16 = reinterpret_cast<uint16_t*>(matrix);
      uint16_t* augmented16 = reinterpret_cast<uint16_t*>(augmented);
      
      // Initialize GF tables if not already done
      GF::initGF65536();
      
      // Forward elimination with partial pivoting
      for (int pivot = 0; pivot < std::min(rows, cols); pivot++) {
        // Find pivot row (non-zero element in column)
        int pivotRow = -1;
        for (int i = pivot; i < rows; i++) {
          if (matrix16[i * cols + pivot] != 0) {
            pivotRow = i;
            break;
          }
        }
        
        // If no pivot found, column is all zeros, skip
        if (pivotRow == -1) {
          continue;
        }
        
        // Swap rows if needed
        if (pivotRow != pivot) {
          // Swap in main matrix
          for (int j = 0; j < cols; j++) {
            std::swap(matrix16[pivot * cols + j], matrix16[pivotRow * cols + j]);
          }
          // Swap in augmented matrix
          for (int j = 0; j < augCols; j++) {
            std::swap(augmented16[pivot * augCols + j], augmented16[pivotRow * augCols + j]);
          }
        }
        
        // Scale pivot row so pivot element becomes 1
        uint16_t pivotElem = matrix16[pivot * cols + pivot];
        if (pivotElem != 1) {
          uint16_t pivotInv = GF::inv16(pivotElem);
          
          // Scale main matrix row
          for (int j = pivot; j < cols; j++) {
            matrix16[pivot * cols + j] = GF::mul16(matrix16[pivot * cols + j], pivotInv);
          }
          
          // Scale augmented matrix row
          for (int j = 0; j < augCols; j++) {
            augmented16[pivot * augCols + j] = GF::mul16(augmented16[pivot * augCols + j], pivotInv);
          }
        }
        
        // Eliminate column in all other rows
        for (int i = 0; i < rows; i++) {
          if (i == pivot) continue;
          
          uint16_t factor = matrix16[i * cols + pivot];
          if (factor == 0) continue;
          
          // Subtract factor * pivot_row from current row
          for (int j = pivot; j < cols; j++) {
            uint16_t subtractVal = GF::mul16(factor, matrix16[pivot * cols + j]);
            matrix16[i * cols + j] = GF::add16(matrix16[i * cols + j], subtractVal); // XOR
          }
          
          // Same for augmented matrix
          for (int j = 0; j < augCols; j++) {
            uint16_t subtractVal = GF::mul16(factor, augmented16[pivot * augCols + j]);
            augmented16[i * augCols + j] = GF::add16(augmented16[i * augCols + j], subtractVal); // XOR
          }
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    // Initialize GF tables if not already done
    GF::initGF256();
    
    // Forward elimination with partial pivoting
    for (int pivot = 0; pivot < std::min(rows, cols); pivot++) {
      // Find pivot row (non-zero element in column)
      int pivotRow = -1;
      for (int i = pivot; i < rows; i++) {
        if (matrix[i * cols + pivot] != 0) {
          pivotRow = i;
          break;
        }
      }
      
      // If no pivot found, column is all zeros, skip
      if (pivotRow == -1) {
        continue;
      }
      
      // Swap rows if needed
      if (pivotRow != pivot) {
        // Swap in main matrix
        for (int j = 0; j < cols; j++) {
          std::swap(matrix[pivot * cols + j], matrix[pivotRow * cols + j]);
        }
        // Swap in augmented matrix
        for (int j = 0; j < augCols; j++) {
          std::swap(augmented[pivot * augCols + j], augmented[pivotRow * augCols + j]);
        }
      }
      
      // Scale pivot row so pivot element becomes 1
      uint8_t pivotElem = matrix[pivot * cols + pivot];
      if (pivotElem != 1) {
        uint8_t pivotInv = GF::inv8(pivotElem);
        
        // Scale main matrix row
        for (int j = pivot; j < cols; j++) {
          matrix[pivot * cols + j] = GF::mul8(matrix[pivot * cols + j], pivotInv);
        }
        
        // Scale augmented matrix row
        for (int j = 0; j < augCols; j++) {
          augmented[pivot * augCols + j] = GF::mul8(augmented[pivot * augCols + j], pivotInv);
        }
      }
      
      // Eliminate column in all other rows
      for (int i = 0; i < rows; i++) {
        if (i == pivot) continue;
        
        uint8_t factor = matrix[i * cols + pivot];
        if (factor == 0) continue;
        
        // Subtract factor * pivot_row from current row
        for (int j = pivot; j < cols; j++) {
          uint8_t subtractVal = GF::mul8(factor, matrix[pivot * cols + j]);
          matrix[i * cols + j] = GF::add8(matrix[i * cols + j], subtractVal); // XOR
        }
        
        // Same for augmented matrix
        for (int j = 0; j < augCols; j++) {
          uint8_t subtractVal = GF::mul8(factor, augmented[pivot * augCols + j]);
          augmented[i * augCols + j] = GF::add8(augmented[i * augCols + j], subtractVal); // XOR
        }
      }
    }
  }
  
  /**
   * Invert a square matrix in Galois Field
   * 
   * Uses Gaussian elimination to compute the inverse of a matrix.
   * The matrix is augmented with an identity matrix, then reduced to
   * row echelon form. If successful, the augmented part becomes the inverse.
   * 
   * @param matrix Input/output matrix (size × size), modified in-place to its inverse
   * @param size Matrix dimension
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @throws std::runtime_error if matrix is singular (not invertible)
   */
  void invertMatrixGF(uint8_t* matrix, int size, int field) {
    if (field == 16) {
      // For GF(2^16), work with uint16_t
      uint16_t* matrix16 = reinterpret_cast<uint16_t*>(matrix);
      
      // Initialize GF tables if not already done
      GF::initGF65536();
      
      // Create augmented matrix [A | I]
      std::vector<uint16_t> workMatrix(size * size);
      std::vector<uint16_t> augMatrix(size * size);
      
      // Copy input matrix to work matrix
      std::memcpy(workMatrix.data(), matrix16, size * size * sizeof(uint16_t));
      
      // Initialize augmented matrix as identity
      std::memset(augMatrix.data(), 0, size * size * sizeof(uint16_t));
      for (int i = 0; i < size; i++) {
        augMatrix[i * size + i] = 1;
      }
      
      // Perform Gaussian elimination
      gaussianElimination(reinterpret_cast<uint8_t*>(workMatrix.data()), 
                         reinterpret_cast<uint8_t*>(augMatrix.data()), 
                         size, size, size, field);
      
      // Verify that work matrix is now identity (matrix was invertible)
      for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
          uint16_t expected = (i == j) ? 1 : 0;
          if (workMatrix[i * size + j] != expected) {
            throw std::runtime_error("Matrix is singular and cannot be inverted");
          }
        }
      }
      
      // Copy inverse from augmented matrix back to input
      std::memcpy(matrix16, augMatrix.data(), size * size * sizeof(uint16_t));
      return;
    }
    
    // GF(2^8) implementation
    // Initialize GF tables if not already done
    GF::initGF256();
    
    // Create augmented matrix [A | I]
    // We'll work with a copy of the input matrix and an identity matrix
    std::vector<uint8_t> workMatrix(size * size);
    std::vector<uint8_t> augMatrix(size * size);
    
    // Copy input matrix to work matrix
    std::memcpy(workMatrix.data(), matrix, size * size);
    
    // Initialize augmented matrix as identity
    std::memset(augMatrix.data(), 0, size * size);
    for (int i = 0; i < size; i++) {
      augMatrix[i * size + i] = 1;
    }
    
    // Perform Gaussian elimination
    gaussianElimination(workMatrix.data(), augMatrix.data(), size, size, size, field);
    
    // Verify that work matrix is now identity (matrix was invertible)
    for (int i = 0; i < size; i++) {
      for (int j = 0; j < size; j++) {
        uint8_t expected = (i == j) ? 1 : 0;
        if (workMatrix[i * size + j] != expected) {
          throw std::runtime_error("Matrix is singular and cannot be inverted");
        }
      }
    }
    
    // Copy inverse from augmented matrix back to input
    std::memcpy(matrix, augMatrix.data(), size * size);
  }
}
