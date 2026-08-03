/**
 * Galois Field arithmetic operations header
 */

#ifndef GF_ARITHMETIC_H
#define GF_ARITHMETIC_H

#include <cstdint>
#include <cstddef>
#include <stdexcept>

namespace GF {
  // Initialize lookup tables
  void initGF256();
  void initGF65536();

  // Initialize lookup tables with a caller-supplied field polynomial.
  //
  // The polynomial must have degree exactly m (8 or 16) and must be primitive:
  // the generator alpha = 2 must have multiplicative order exactly 2^m - 1.
  // Both conditions are checked before any table is built; a polynomial that
  // fails either throws std::invalid_argument and leaves the current field
  // untouched. (A merely irreducible polynomial such as 0x11B, the AES
  // polynomial, gives alpha order 51 and would silently corrupt the tables.)
  void initGF256WithPolynomial(uint16_t primitivePolynomial);
  void initGF65536WithPolynomial(uint32_t primitivePolynomial);
  void cleanupGF65536(); // Cleanup GF(2^16) tables (called automatically on exit)
  
  // Access to lookup tables for GPU operations
  const uint8_t* getGF256LogTable();
  const uint8_t* getGF256AntilogTable();
  const uint16_t* getGF65536LogTable();
  const uint16_t* getGF65536AntilogTable();
  
  // Get current primitive polynomials
  uint16_t getCurrentGF256Polynomial();
  uint32_t getCurrentGF65536Polynomial();
  
  // Basic GF(2^8) operations
  uint8_t add8(uint8_t a, uint8_t b);
  uint8_t mul8(uint8_t a, uint8_t b);
  uint8_t div8(uint8_t a, uint8_t b);
  uint8_t inv8(uint8_t a);
  uint8_t pow8(uint8_t a, uint8_t n);
  
  // Vectorized GF(2^8) operations (scalar implementation)
  void mulVec8(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
  void addVec8(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
  
  // Vectorized GF(2^8) operations (Accelerate framework optimized)
  void mulVec8Accelerated(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
  void addVec8Accelerated(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len);
  
  // Basic GF(2^16) operations
  uint16_t add16(uint16_t a, uint16_t b);
  uint16_t mul16(uint16_t a, uint16_t b);
  uint16_t div16(uint16_t a, uint16_t b);
  uint16_t inv16(uint16_t a);
  uint16_t pow16(uint16_t a, uint16_t n);
  
  // Vectorized GF(2^16) operations (scalar implementation)
  void mulVec16(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len);
  void addVec16(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len);
  
  // Vectorized GF(2^16) operations (Accelerate framework optimized)
  void mulVec16Accelerated(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len);
  void addVec16Accelerated(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len);
}

#endif // GF_ARITHMETIC_H
