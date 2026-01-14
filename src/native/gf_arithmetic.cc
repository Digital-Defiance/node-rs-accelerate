/**
 * Galois Field arithmetic operations implementation
 */

#include "gf_arithmetic.h"
#include <stdexcept>
#include <memory>
#include <cstdlib>

#ifdef __APPLE__
#include <Accelerate/Accelerate.h>
#endif

namespace GF {
  // GF(2^8) lookup tables - cached after initialization
  // Default primitive polynomial: 0x11D (x^8 + x^4 + x^3 + x^2 + 1)
  static uint8_t gf256_log[256] = {0};      // Logarithm table
  static uint8_t gf256_antilog[256] = {0};  // Antilogarithm table
  static uint8_t gf256_inv[256] = {0};      // Inverse table
  static bool gf256_initialized = false;
  static uint16_t gf256_current_polynomial = 0x11D; // Track current polynomial
  
  // GF(2^16) lookup tables - cached after initialization
  // Default primitive polynomial: 0x1100B (x^16 + x^12 + x^3 + x + 1)
  // Using smart pointers for automatic memory management (RAII)
  static std::unique_ptr<uint16_t[]> gf65536_log;      // Logarithm table (65536 entries)
  static std::unique_ptr<uint16_t[]> gf65536_antilog;  // Antilogarithm table (65536 entries)
  static std::unique_ptr<uint16_t[]> gf65536_inv;      // Inverse table (65536 entries)
  static bool gf65536_initialized = false;
  static uint32_t gf65536_current_polynomial = 0x1100B; // Track current polynomial
  
  // Automatic cleanup on program exit
  static void cleanupGF65536OnExit() {
    cleanupGF65536();
  }
  
  // Register cleanup function to be called on exit
  static struct GF65536Cleanup {
    GF65536Cleanup() {
      std::atexit(cleanupGF65536OnExit);
    }
  } gf65536_cleanup_registrar;
  
  void initGF256() {
    initGF256WithPolynomial(0x11D); // Default polynomial
  }
  
  void initGF256WithPolynomial(uint16_t primitivePolynomial) {
    // If already initialized with the same polynomial, skip
    if (gf256_initialized && gf256_current_polynomial == primitivePolynomial) {
      return;
    }
    
    // If initialized with a different polynomial, reinitialize
    gf256_current_polynomial = primitivePolynomial;
    
    // Generate antilog table (powers of generator α = 2)
    uint16_t x = 1; // Use uint16_t to handle overflow
    for (int i = 0; i < 255; i++) {
      gf256_antilog[i] = (uint8_t)x;
      gf256_log[(uint8_t)x] = i;
      
      // Multiply by α (generator = 2)
      x <<= 1;
      if (x & 0x100) {
        x ^= primitivePolynomial;
      }
    }
    
    // Complete the cycle - α^255 = α^0 = 1
    gf256_antilog[255] = gf256_antilog[0];
    gf256_log[0] = 255; // Special case: log(0) is undefined, set to 255 for safety
    
    // Generate inverse table
    gf256_inv[0] = 0; // 0 has no inverse
    for (int i = 1; i < 256; i++) {
      // inv(x) = α^(255 - log(x))
      // Since α^255 = 1, we have α^(-k) = α^(255-k)
      uint8_t log_i = gf256_log[i];
      uint16_t inv_log = 255 - log_i;
      gf256_inv[i] = gf256_antilog[inv_log];
    }
    
    gf256_initialized = true;
  }
  
  void initGF65536() {
    initGF65536WithPolynomial(0x1100B); // Default polynomial
  }
  
  void initGF65536WithPolynomial(uint32_t primitivePolynomial) {
    // If already initialized with the same polynomial, skip
    if (gf65536_initialized && gf65536_current_polynomial == primitivePolynomial) {
      return;
    }
    
    // If initialized with a different polynomial, reinitialize
    gf65536_current_polynomial = primitivePolynomial;
    
    // Allocate lookup tables using smart pointers (RAII)
    // Memory will be automatically freed when unique_ptr goes out of scope
    gf65536_log = std::make_unique<uint16_t[]>(65536);
    gf65536_antilog = std::make_unique<uint16_t[]>(65536);
    gf65536_inv = std::make_unique<uint16_t[]>(65536);
    
    // Generate antilog table (powers of generator α = 2)
    uint32_t x = 1; // Use uint32_t to handle overflow
    for (int i = 0; i < 65535; i++) {
      gf65536_antilog[i] = (uint16_t)x;
      gf65536_log[(uint16_t)x] = i;
      
      // Multiply by α (generator = 2)
      x <<= 1;
      if (x & 0x10000) {
        x ^= primitivePolynomial;
      }
    }
    
    // Complete the cycle - α^65535 = α^0 = 1
    gf65536_antilog[65535] = gf65536_antilog[0];
    gf65536_log[0] = 65535; // Special case: log(0) is undefined, set to 65535 for safety
    
    // Generate inverse table
    gf65536_inv[0] = 0; // 0 has no inverse
    for (int i = 1; i < 65536; i++) {
      // inv(x) = α^(65535 - log(x))
      // Since α^65535 = 1, we have α^(-k) = α^(65535-k)
      uint16_t log_i = gf65536_log[i];
      uint32_t inv_log = 65535 - log_i;
      gf65536_inv[i] = gf65536_antilog[inv_log];
    }
    
    gf65536_initialized = true;
  }
  
  uint8_t add8(uint8_t a, uint8_t b) {
    return a ^ b; // XOR for GF addition
  }
  
  uint8_t mul8(uint8_t a, uint8_t b) {
    if (!gf256_initialized) {
      initGF256();
    }
    
    // Handle zero cases
    if (a == 0 || b == 0) {
      return 0;
    }
    
    // Handle identity cases
    if (a == 1) {
      return b;
    }
    if (b == 1) {
      return a;
    }
    
    // Use logarithm property: log(a*b) = log(a) + log(b)
    uint16_t log_sum = (uint16_t)gf256_log[a] + (uint16_t)gf256_log[b];
    
    // Reduce modulo 255 (since α^255 = 1 in GF(2^8))
    log_sum = log_sum % 255;
    
    return gf256_antilog[log_sum];
  }
  
  uint8_t div8(uint8_t a, uint8_t b) {
    if (!gf256_initialized) {
      initGF256();
    }
    
    if (b == 0) {
      throw std::invalid_argument("Division by zero in GF(2^8)");
    }
    
    if (a == 0) {
      return 0;
    }
    
    // Handle identity cases
    if (b == 1) {
      return a;
    }
    
    // Division: a / b = a * inv(b)
    // Using logs: log(a/b) = log(a) - log(b) mod 255
    int16_t log_diff = (int16_t)gf256_log[a] - (int16_t)gf256_log[b];
    
    // Handle negative result - add 255 to make it positive
    while (log_diff < 0) {
      log_diff += 255;
    }
    
    // Reduce modulo 255
    log_diff = log_diff % 255;
    
    return gf256_antilog[log_diff];
  }
  
  uint8_t inv8(uint8_t a) {
    if (!gf256_initialized) {
      initGF256();
    }
    
    if (a == 0) {
      throw std::invalid_argument("Inverse of zero in GF(2^8)");
    }
    
    return gf256_inv[a];
  }
  
  uint8_t pow8(uint8_t a, uint8_t n) {
    if (!gf256_initialized) {
      initGF256();
    }
    
    // Handle special cases
    if (n == 0) {
      return 1; // a^0 = 1
    }
    
    if (a == 0) {
      return 0; // 0^n = 0 for n > 0
    }
    
    if (a == 1) {
      return 1; // 1^n = 1
    }
    
    // Use logarithm property: log(a^n) = n * log(a)
    uint16_t log_product = (uint16_t)n * (uint16_t)gf256_log[a];
    
    // Reduce modulo 255
    log_product %= 255;
    
    return gf256_antilog[log_product];
  }
  
  void mulVec8(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    if (!gf256_initialized) {
      initGF256();
    }
    
    for (size_t i = 0; i < len; i++) {
      out[i] = mul8(a[i], b[i]);
    }
  }
  
  void addVec8(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    for (size_t i = 0; i < len; i++) {
      out[i] = a[i] ^ b[i];
    }
  }
  
  void mulVec8Accelerated(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
    if (!gf256_initialized) {
      initGF256();
    }
    
#ifdef __APPLE__
    // Use Accelerate framework for vectorized operations
    // For GF multiplication, we need to handle zeros specially and use lookup tables
    // Since vDSP doesn't have direct uint8 operations, we process in chunks
    
    // For small arrays, scalar is faster due to overhead
    if (len < 64) {
      mulVec8(a, b, out, len);
      return;
    }
    
    // Process elements using lookup tables
    // This is still element-wise but with better cache locality
    for (size_t i = 0; i < len; i++) {
      uint8_t a_val = a[i];
      uint8_t b_val = b[i];
      
      if (a_val == 0 || b_val == 0) {
        out[i] = 0;
      } else {
        uint16_t log_sum = (uint16_t)gf256_log[a_val] + (uint16_t)gf256_log[b_val];
        log_sum %= 255;
        out[i] = gf256_antilog[log_sum];
      }
    }
#else
    // Fallback to scalar implementation
    mulVec8(a, b, out, len);
#endif
  }
  
  void addVec8Accelerated(const uint8_t* a, const uint8_t* b, uint8_t* out, size_t len) {
#ifdef __APPLE__
    // Use Accelerate framework for vectorized XOR
    // vDSP doesn't have XOR, but we can use NEON intrinsics on ARM64
    // For now, use optimized loop that compiler can auto-vectorize
    
    // Process in chunks of 16 for better vectorization
    size_t i = 0;
    size_t chunks = len / 16;
    
    for (size_t chunk = 0; chunk < chunks; chunk++) {
      size_t base = chunk * 16;
      // Unrolled loop for better vectorization
      out[base + 0] = a[base + 0] ^ b[base + 0];
      out[base + 1] = a[base + 1] ^ b[base + 1];
      out[base + 2] = a[base + 2] ^ b[base + 2];
      out[base + 3] = a[base + 3] ^ b[base + 3];
      out[base + 4] = a[base + 4] ^ b[base + 4];
      out[base + 5] = a[base + 5] ^ b[base + 5];
      out[base + 6] = a[base + 6] ^ b[base + 6];
      out[base + 7] = a[base + 7] ^ b[base + 7];
      out[base + 8] = a[base + 8] ^ b[base + 8];
      out[base + 9] = a[base + 9] ^ b[base + 9];
      out[base + 10] = a[base + 10] ^ b[base + 10];
      out[base + 11] = a[base + 11] ^ b[base + 11];
      out[base + 12] = a[base + 12] ^ b[base + 12];
      out[base + 13] = a[base + 13] ^ b[base + 13];
      out[base + 14] = a[base + 14] ^ b[base + 14];
      out[base + 15] = a[base + 15] ^ b[base + 15];
    }
    
    // Handle remaining elements
    for (i = chunks * 16; i < len; i++) {
      out[i] = a[i] ^ b[i];
    }
#else
    // Fallback to scalar implementation
    addVec8(a, b, out, len);
#endif
  }
  
  uint16_t add16(uint16_t a, uint16_t b) {
    return a ^ b;
  }
  
  uint16_t mul16(uint16_t a, uint16_t b) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
    // Handle zero cases
    if (a == 0 || b == 0) {
      return 0;
    }
    
    // Handle identity cases
    if (a == 1) {
      return b;
    }
    if (b == 1) {
      return a;
    }
    
    // Use logarithm property: log(a*b) = log(a) + log(b)
    uint32_t log_sum = (uint32_t)gf65536_log[a] + (uint32_t)gf65536_log[b];
    
    // Reduce modulo 65535 (since α^65535 = 1 in GF(2^16))
    log_sum = log_sum % 65535;
    
    return gf65536_antilog[log_sum];
  }
  
  uint16_t div16(uint16_t a, uint16_t b) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
    if (b == 0) {
      throw std::invalid_argument("Division by zero in GF(2^16)");
    }
    
    if (a == 0) {
      return 0;
    }
    
    // Handle identity cases
    if (b == 1) {
      return a;
    }
    
    // Division: a / b = a * inv(b)
    // Using logs: log(a/b) = log(a) - log(b) mod 65535
    int32_t log_diff = (int32_t)gf65536_log[a] - (int32_t)gf65536_log[b];
    
    // Handle negative result - add 65535 to make it positive
    while (log_diff < 0) {
      log_diff += 65535;
    }
    
    // Reduce modulo 65535
    log_diff = log_diff % 65535;
    
    return gf65536_antilog[log_diff];
  }
  
  uint16_t inv16(uint16_t a) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
    if (a == 0) {
      throw std::invalid_argument("Inverse of zero in GF(2^16)");
    }
    
    return gf65536_inv[a];
  }
  
  uint16_t pow16(uint16_t a, uint16_t n) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
    // Handle special cases
    if (n == 0) {
      return 1; // a^0 = 1
    }
    
    if (a == 0) {
      return 0; // 0^n = 0 for n > 0
    }
    
    if (a == 1) {
      return 1; // 1^n = 1
    }
    
    // Use logarithm property: log(a^n) = n * log(a)
    uint32_t log_product = (uint32_t)n * (uint32_t)gf65536_log[a];
    
    // Reduce modulo 65535
    log_product %= 65535;
    
    return gf65536_antilog[log_product];
  }
  
  void mulVec16(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
    for (size_t i = 0; i < len; i++) {
      out[i] = mul16(a[i], b[i]);
    }
  }
  
  void addVec16(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len) {
    for (size_t i = 0; i < len; i++) {
      out[i] = a[i] ^ b[i];
    }
  }
  
  void mulVec16Accelerated(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len) {
    if (!gf65536_initialized) {
      initGF65536();
    }
    
#ifdef __APPLE__
    // Use Accelerate framework for vectorized operations
    // For GF multiplication, we need to handle zeros specially and use lookup tables
    
    // For small arrays, scalar is faster due to overhead
    if (len < 64) {
      mulVec16(a, b, out, len);
      return;
    }
    
    // Process elements using lookup tables
    // This is still element-wise but with better cache locality
    for (size_t i = 0; i < len; i++) {
      uint16_t a_val = a[i];
      uint16_t b_val = b[i];
      
      if (a_val == 0 || b_val == 0) {
        out[i] = 0;
      } else {
        uint32_t log_sum = (uint32_t)gf65536_log[a_val] + (uint32_t)gf65536_log[b_val];
        log_sum %= 65535;
        out[i] = gf65536_antilog[log_sum];
      }
    }
#else
    // Fallback to scalar implementation
    mulVec16(a, b, out, len);
#endif
  }
  
  void addVec16Accelerated(const uint16_t* a, const uint16_t* b, uint16_t* out, size_t len) {
#ifdef __APPLE__
    // Use Accelerate framework for vectorized XOR
    // Process in chunks of 16 for better vectorization
    size_t i = 0;
    size_t chunks = len / 16;
    
    for (size_t chunk = 0; chunk < chunks; chunk++) {
      size_t base = chunk * 16;
      // Unrolled loop for better vectorization
      out[base + 0] = a[base + 0] ^ b[base + 0];
      out[base + 1] = a[base + 1] ^ b[base + 1];
      out[base + 2] = a[base + 2] ^ b[base + 2];
      out[base + 3] = a[base + 3] ^ b[base + 3];
      out[base + 4] = a[base + 4] ^ b[base + 4];
      out[base + 5] = a[base + 5] ^ b[base + 5];
      out[base + 6] = a[base + 6] ^ b[base + 6];
      out[base + 7] = a[base + 7] ^ b[base + 7];
      out[base + 8] = a[base + 8] ^ b[base + 8];
      out[base + 9] = a[base + 9] ^ b[base + 9];
      out[base + 10] = a[base + 10] ^ b[base + 10];
      out[base + 11] = a[base + 11] ^ b[base + 11];
      out[base + 12] = a[base + 12] ^ b[base + 12];
      out[base + 13] = a[base + 13] ^ b[base + 13];
      out[base + 14] = a[base + 14] ^ b[base + 14];
      out[base + 15] = a[base + 15] ^ b[base + 15];
    }
    
    // Handle remaining elements
    for (i = chunks * 16; i < len; i++) {
      out[i] = a[i] ^ b[i];
    }
#else
    // Fallback to scalar implementation
    addVec16(a, b, out, len);
#endif
  }
  
  void cleanupGF65536() {
    if (gf65536_initialized) {
      // Smart pointers automatically clean up memory
      // Just reset them to release the memory
      gf65536_log.reset();
      gf65536_antilog.reset();
      gf65536_inv.reset();
      gf65536_initialized = false;
    }
  }
  
  // Lookup table accessors for GPU operations
  const uint8_t* getGF256LogTable() {
    if (!gf256_initialized) {
      initGF256();
    }
    return gf256_log;
  }
  
  const uint8_t* getGF256AntilogTable() {
    if (!gf256_initialized) {
      initGF256();
    }
    return gf256_antilog;
  }
  
  const uint16_t* getGF65536LogTable() {
    if (!gf65536_initialized) {
      initGF65536();
    }
    return gf65536_log.get();
  }
  
  const uint16_t* getGF65536AntilogTable() {
    if (!gf65536_initialized) {
      initGF65536();
    }
    return gf65536_antilog.get();
  }
  
  uint16_t getCurrentGF256Polynomial() {
    return gf256_current_polynomial;
  }
  
  uint32_t getCurrentGF65536Polynomial() {
    return gf65536_current_polynomial;
  }
}
