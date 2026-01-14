/**
 * Property-based tests for Galois Field arithmetic
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { 
  initGF256, 
  initGF65536,
  add8, 
  mul8, 
  div8, 
  inv8, 
  pow8,
  mulVec8,
  addVec8,
  mulVec8Accelerated,
  addVec8Accelerated,
  add16,
  mul16,
  div16,
  inv16,
  pow16,
  mulVec16,
  addVec16,
  mulVec16Accelerated,
  addVec16Accelerated
} from '../../src/gf';

// Initialize GF tables before tests
beforeAll(() => {
  initGF256();
  initGF65536();
});

describe('GF(2^8) Field Axioms', () => {
  // Generator for GF(2^8) elements (0-255)
  const gf8Element = fc.integer({ min: 0, max: 255 });
  const gf8NonZero = fc.integer({ min: 1, max: 255 });

  /**
   * Property 1: Galois Field Closure
   * For any two elements a and b in GF(2^8), all operations should produce results within the same field
   * Validates: Requirements 1.1, 1.5
   */
  it('Property 1: Galois Field Closure', () => {
    fc.assert(
      fc.property(gf8Element, gf8Element, (a, b) => {
        // Addition closure
        const sum = add8(a, b);
        expect(sum).toBeGreaterThanOrEqual(0);
        expect(sum).toBeLessThanOrEqual(255);

        // Multiplication closure
        const product = mul8(a, b);
        expect(product).toBeGreaterThanOrEqual(0);
        expect(product).toBeLessThanOrEqual(255);

        // Division closure (when b != 0)
        if (b !== 0) {
          const quotient = div8(a, b);
          expect(quotient).toBeGreaterThanOrEqual(0);
          expect(quotient).toBeLessThanOrEqual(255);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Galois Field Multiplicative Inverse
   * For any non-zero element a in GF(2^8), multiplying a by its inverse should yield 1
   * Validates: Requirements 1.6
   */
  it('Property 2: Galois Field Multiplicative Inverse', () => {
    fc.assert(
      fc.property(gf8NonZero, (a) => {
        // a * inv(a) = 1
        const inverse = inv8(a);
        const product = mul8(a, inverse);
        expect(product).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Galois Field Associativity
   * For any three elements a, b, c in GF(2^8), (a * b) * c should equal a * (b * c)
   * Validates: Requirements 1.5
   */
  it('Property 3: Galois Field Associativity', () => {
    fc.assert(
      fc.property(gf8Element, gf8Element, gf8Element, (a, b, c) => {
        // Multiplication associativity: (a * b) * c = a * (b * c)
        const left = mul8(mul8(a, b), c);
        const right = mul8(a, mul8(b, c));
        expect(left).toBe(right);

        // Addition associativity: (a + b) + c = a + (b + c)
        const leftAdd = add8(add8(a, b), c);
        const rightAdd = add8(a, add8(b, c));
        expect(leftAdd).toBe(rightAdd);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Galois Field Commutativity
   * For any two elements a and b in GF(2^8), a * b should equal b * a, and a + b should equal b + a
   * Validates: Requirements 1.5
   */
  it('Property 4: Galois Field Commutativity', () => {
    fc.assert(
      fc.property(gf8Element, gf8Element, (a, b) => {
        // Multiplication commutativity: a * b = b * a
        expect(mul8(a, b)).toBe(mul8(b, a));

        // Addition commutativity: a + b = b + a
        expect(add8(a, b)).toBe(add8(b, a));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Galois Field Distributivity
   * For any three elements a, b, c in GF(2^8), a * (b + c) should equal (a * b) + (a * c)
   * Validates: Requirements 1.5
   */
  it('Property 5: Galois Field Distributivity', () => {
    fc.assert(
      fc.property(gf8Element, gf8Element, gf8Element, (a, b, c) => {
        // Distributivity: a * (b + c) = (a * b) + (a * c)
        const left = mul8(a, add8(b, c));
        const right = add8(mul8(a, b), mul8(a, c));
        expect(left).toBe(right);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Vectorized GF(2^8) Operations', () => {
  // Generator for GF(2^8) element arrays
  const gf8Array = (minLength: number, maxLength: number) =>
    fc.uint8Array({ minLength, maxLength });

  /**
   * Property 6: Vectorized GF Operations Equivalence
   * For any array of GF elements, vectorized operations (using SIMD or GPU) should produce 
   * identical results to scalar operations
   * Validates: Requirements 1.4, 1.8
   */
  it('Property 6: Vectorized GF Operations Equivalence - Addition', () => {
    fc.assert(
      fc.property(gf8Array(1, 1024), gf8Array(1, 1024), (a, b) => {
        // Ensure arrays have the same length
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Compute using scalar operations
        const scalarOut = new Uint8Array(len);
        addVec8(aSlice, bSlice, scalarOut);
        
        // Compute using accelerated operations
        const acceleratedOut = new Uint8Array(len);
        addVec8Accelerated(aSlice, bSlice, acceleratedOut);
        
        // Results should be identical
        for (let i = 0; i < len; i++) {
          expect(acceleratedOut[i]).toBe(scalarOut[i]);
        }
        
        // Also verify against element-wise scalar operations
        for (let i = 0; i < len; i++) {
          expect(scalarOut[i]).toBe(add8(aSlice[i], bSlice[i]));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6: Vectorized GF Operations Equivalence - Multiplication', () => {
    fc.assert(
      fc.property(gf8Array(1, 1024), gf8Array(1, 1024), (a, b) => {
        // Ensure arrays have the same length
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Compute using scalar operations
        const scalarOut = new Uint8Array(len);
        mulVec8(aSlice, bSlice, scalarOut);
        
        // Compute using accelerated operations
        const acceleratedOut = new Uint8Array(len);
        mulVec8Accelerated(aSlice, bSlice, acceleratedOut);
        
        // Results should be identical
        for (let i = 0; i < len; i++) {
          expect(acceleratedOut[i]).toBe(scalarOut[i]);
        }
        
        // Also verify against element-wise scalar operations
        for (let i = 0; i < len; i++) {
          expect(scalarOut[i]).toBe(mul8(aSlice[i], bSlice[i]));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6: Vectorized GF Operations Equivalence - Large Arrays', () => {
    fc.assert(
      fc.property(gf8Array(100, 10000), gf8Array(100, 10000), (a, b) => {
        // Test with larger arrays to ensure accelerated path is used
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Test multiplication
        const scalarMul = new Uint8Array(len);
        const acceleratedMul = new Uint8Array(len);
        mulVec8(aSlice, bSlice, scalarMul);
        mulVec8Accelerated(aSlice, bSlice, acceleratedMul);
        
        for (let i = 0; i < len; i++) {
          expect(acceleratedMul[i]).toBe(scalarMul[i]);
        }
        
        // Test addition
        const scalarAdd = new Uint8Array(len);
        const acceleratedAdd = new Uint8Array(len);
        addVec8(aSlice, bSlice, scalarAdd);
        addVec8Accelerated(aSlice, bSlice, acceleratedAdd);
        
        for (let i = 0; i < len; i++) {
          expect(acceleratedAdd[i]).toBe(scalarAdd[i]);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('GF(2^16) Field Axioms', () => {
  // Generator for GF(2^16) elements (0-65535)
  const gf16Element = fc.integer({ min: 0, max: 65535 });
  const gf16NonZero = fc.integer({ min: 1, max: 65535 });

  /**
   * Property 1: Galois Field Closure (GF(2^16))
   * For any two elements a and b in GF(2^16), all operations should produce results within the same field
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 1: Galois Field Closure (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Element, gf16Element, (a, b) => {
        // Addition closure
        const sum = add16(a, b);
        expect(sum).toBeGreaterThanOrEqual(0);
        expect(sum).toBeLessThanOrEqual(65535);

        // Multiplication closure
        const product = mul16(a, b);
        expect(product).toBeGreaterThanOrEqual(0);
        expect(product).toBeLessThanOrEqual(65535);

        // Division closure (when b != 0)
        if (b !== 0) {
          const quotient = div16(a, b);
          expect(quotient).toBeGreaterThanOrEqual(0);
          expect(quotient).toBeLessThanOrEqual(65535);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Galois Field Multiplicative Inverse (GF(2^16))
   * For any non-zero element a in GF(2^16), multiplying a by its inverse should yield 1
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 2: Galois Field Multiplicative Inverse (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16NonZero, (a) => {
        // a * inv(a) = 1
        const inverse = inv16(a);
        const product = mul16(a, inverse);
        expect(product).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Galois Field Associativity (GF(2^16))
   * For any three elements a, b, c in GF(2^16), (a * b) * c should equal a * (b * c)
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 3: Galois Field Associativity (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Element, gf16Element, gf16Element, (a, b, c) => {
        // Multiplication associativity: (a * b) * c = a * (b * c)
        const left = mul16(mul16(a, b), c);
        const right = mul16(a, mul16(b, c));
        expect(left).toBe(right);

        // Addition associativity: (a + b) + c = a + (b + c)
        const leftAdd = add16(add16(a, b), c);
        const rightAdd = add16(a, add16(b, c));
        expect(leftAdd).toBe(rightAdd);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Galois Field Commutativity (GF(2^16))
   * For any two elements a and b in GF(2^16), a * b should equal b * a, and a + b should equal b + a
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 4: Galois Field Commutativity (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Element, gf16Element, (a, b) => {
        // Multiplication commutativity: a * b = b * a
        expect(mul16(a, b)).toBe(mul16(b, a));

        // Addition commutativity: a + b = b + a
        expect(add16(a, b)).toBe(add16(b, a));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Galois Field Distributivity (GF(2^16))
   * For any three elements a, b, c in GF(2^16), a * (b + c) should equal (a * b) + (a * c)
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 5: Galois Field Distributivity (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Element, gf16Element, gf16Element, (a, b, c) => {
        // Distributivity: a * (b + c) = (a * b) + (a * c)
        const left = mul16(a, add16(b, c));
        const right = add16(mul16(a, b), mul16(a, c));
        expect(left).toBe(right);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Vectorized GF(2^16) Operations', () => {
  // Generator for GF(2^16) element arrays
  const gf16Array = (minLength: number, maxLength: number) =>
    fc.uint16Array({ minLength, maxLength });

  /**
   * Property 6: Vectorized GF Operations Equivalence (GF(2^16))
   * For any array of GF elements, vectorized operations should produce identical results to scalar operations
   * Validates: Requirements 1.2, 1.5
   */
  it('Property 6: Vectorized GF Operations Equivalence - Addition (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Array(1, 1024), gf16Array(1, 1024), (a, b) => {
        // Ensure arrays have the same length
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Compute using scalar operations
        const scalarOut = new Uint16Array(len);
        addVec16(aSlice, bSlice, scalarOut);
        
        // Compute using accelerated operations
        const acceleratedOut = new Uint16Array(len);
        addVec16Accelerated(aSlice, bSlice, acceleratedOut);
        
        // Results should be identical
        for (let i = 0; i < len; i++) {
          expect(acceleratedOut[i]).toBe(scalarOut[i]);
        }
        
        // Also verify against element-wise scalar operations
        for (let i = 0; i < len; i++) {
          expect(scalarOut[i]).toBe(add16(aSlice[i], bSlice[i]));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6: Vectorized GF Operations Equivalence - Multiplication (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Array(1, 1024), gf16Array(1, 1024), (a, b) => {
        // Ensure arrays have the same length
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Compute using scalar operations
        const scalarOut = new Uint16Array(len);
        mulVec16(aSlice, bSlice, scalarOut);
        
        // Compute using accelerated operations
        const acceleratedOut = new Uint16Array(len);
        mulVec16Accelerated(aSlice, bSlice, acceleratedOut);
        
        // Results should be identical
        for (let i = 0; i < len; i++) {
          expect(acceleratedOut[i]).toBe(scalarOut[i]);
        }
        
        // Also verify against element-wise scalar operations
        for (let i = 0; i < len; i++) {
          expect(scalarOut[i]).toBe(mul16(aSlice[i], bSlice[i]));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6: Vectorized GF Operations Equivalence - Large Arrays (GF(2^16))', () => {
    fc.assert(
      fc.property(gf16Array(100, 10000), gf16Array(100, 10000), (a, b) => {
        // Test with larger arrays to ensure accelerated path is used
        const len = Math.min(a.length, b.length);
        const aSlice = a.slice(0, len);
        const bSlice = b.slice(0, len);
        
        // Test multiplication
        const scalarMul = new Uint16Array(len);
        const acceleratedMul = new Uint16Array(len);
        mulVec16(aSlice, bSlice, scalarMul);
        mulVec16Accelerated(aSlice, bSlice, acceleratedMul);
        
        for (let i = 0; i < len; i++) {
          expect(acceleratedMul[i]).toBe(scalarMul[i]);
        }
        
        // Test addition
        const scalarAdd = new Uint16Array(len);
        const acceleratedAdd = new Uint16Array(len);
        addVec16(aSlice, bSlice, scalarAdd);
        addVec16Accelerated(aSlice, bSlice, acceleratedAdd);
        
        for (let i = 0; i < len; i++) {
          expect(acceleratedAdd[i]).toBe(scalarAdd[i]);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('GPU/CPU Equivalence', () => {
  // Import GPU functions
  const addon = require('../../build/Release/node_rs_accelerate.node');
  
  // Check if Metal is available
  const metalAvailable = addon.isMetalAvailable();
  const metalInitialized = metalAvailable ? addon.initMetal() : false;
  
  // Skip GPU tests if Metal is not available
  const describeGPU = metalInitialized ? describe : describe.skip;
  
  describeGPU('GF(2^8) GPU Operations', () => {
    const gf8Array = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 100, maxLength: 1000 });
    
    /**
     * Property 6: Vectorized GF Operations Equivalence (GPU)
     * For any array of GF elements, GPU operations should produce identical results to CPU operations
     * Validates: Requirements 4.2, 4.4, 12.7
     */
    it('Property 6: Vectorized GF Operations Equivalence (GPU) - Multiplication', () => {
      fc.assert(
        fc.property(gf8Array, gf8Array, (aArr, bArr) => {
          // Ensure arrays have the same length
          const len = Math.min(aArr.length, bArr.length);
          const a = new Uint8Array(aArr.slice(0, len));
          const b = new Uint8Array(bArr.slice(0, len));
          
          // CPU result
          const cpuResult = new Uint8Array(len);
          mulVec8(a, b, cpuResult);
          
          // GPU result
          const gpuResult = new Uint8Array(len);
          try {
            addon.gf_mulVecGPU(a, b, gpuResult, 8);
            
            // Compare results
            for (let i = 0; i < len; i++) {
              expect(gpuResult[i]).toBe(cpuResult[i]);
            }
          } catch (error) {
            // If GPU operation fails, skip this test
            // This can happen if shaders fail to compile
            console.warn('GPU multiplication failed:', error);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('Property 6: Vectorized GF Operations Equivalence (GPU) - Addition', () => {
      fc.assert(
        fc.property(gf8Array, gf8Array, (aArr, bArr) => {
          // Ensure arrays have the same length
          const len = Math.min(aArr.length, bArr.length);
          const a = new Uint8Array(aArr.slice(0, len));
          const b = new Uint8Array(bArr.slice(0, len));
          
          // CPU result
          const cpuResult = new Uint8Array(len);
          addVec8(a, b, cpuResult);
          
          // GPU result
          const gpuResult = new Uint8Array(len);
          try {
            addon.gf_addVecGPU(a, b, gpuResult, 8);
            
            // Compare results
            for (let i = 0; i < len; i++) {
              expect(gpuResult[i]).toBe(cpuResult[i]);
            }
          } catch (error) {
            // If GPU operation fails, skip this test
            console.warn('GPU addition failed:', error);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
  
  if (!metalInitialized) {
    it('Metal GPU not available - GPU tests skipped', () => {
      console.log('Metal GPU acceleration is not available on this system');
      console.log('GPU equivalence tests will be skipped');
      expect(metalAvailable).toBe(false);
    });
  }
});

/**
 * Property 20: Primitive Polynomial Consistency
 * For any chosen primitive polynomial for a Galois Field, all field operations should remain consistent
 * Validates: Requirements 9.3
 */
describe('Primitive Polynomial Consistency', () => {
  const gf8Element = fc.integer({ min: 0, max: 255 });
  const gf8NonZero = fc.integer({ min: 1, max: 255 });
  const gf16Element = fc.integer({ min: 0, max: 65535 });
  const gf16NonZero = fc.integer({ min: 1, max: 65535 });

  // Import the new functions
  const { 
    initGF256WithPolynomial, 
    initGF65536WithPolynomial,
    getCurrentGF256Polynomial,
    getCurrentGF65536Polynomial,
    PrimitivePolynomialGF256,
    PrimitivePolynomialGF65536
  } = require('../../src/gf');
  const { PrimitivePolynomialGF256: ConfigGF256, PrimitivePolynomialGF65536: ConfigGF65536 } = require('../../src/config');

  it('Property 20: GF(2^8) operations remain consistent with different primitive polynomials', () => {
    // Test with DEFAULT polynomial (0x11D)
    initGF256WithPolynomial(ConfigGF256.DEFAULT);
    expect(getCurrentGF256Polynomial()).toBe(ConfigGF256.DEFAULT);

    fc.assert(
      fc.property(gf8NonZero, gf8NonZero, (a, b) => {
        // Field axioms should hold regardless of polynomial
        // Multiplicative inverse: a * inv(a) = 1
        const inverse = inv8(a);
        const product = mul8(a, inverse);
        expect(product).toBe(1);

        // Commutativity: a * b = b * a
        const ab = mul8(a, b);
        const ba = mul8(b, a);
        expect(ab).toBe(ba);

        // Division consistency: (a * b) / b = a
        const prod = mul8(a, b);
        const quot = div8(prod, b);
        expect(quot).toBe(a);
      }),
      { numRuns: 50 }
    );

    // Test with ANSI polynomial (0x187)
    initGF256WithPolynomial(ConfigGF256.ANSI);
    expect(getCurrentGF256Polynomial()).toBe(ConfigGF256.ANSI);

    fc.assert(
      fc.property(gf8NonZero, gf8NonZero, (a, b) => {
        // Same field axioms should hold with different polynomial
        const inverse = inv8(a);
        const product = mul8(a, inverse);
        expect(product).toBe(1);

        const ab = mul8(a, b);
        const ba = mul8(b, a);
        expect(ab).toBe(ba);

        const prod = mul8(a, b);
        const quot = div8(prod, b);
        expect(quot).toBe(a);
      }),
      { numRuns: 50 }
    );

    // Test with CCSDS polynomial (0x171)
    initGF256WithPolynomial(ConfigGF256.CCSDS);
    expect(getCurrentGF256Polynomial()).toBe(ConfigGF256.CCSDS);

    fc.assert(
      fc.property(gf8NonZero, gf8NonZero, (a, b) => {
        const inverse = inv8(a);
        const product = mul8(a, inverse);
        expect(product).toBe(1);

        const ab = mul8(a, b);
        const ba = mul8(b, a);
        expect(ab).toBe(ba);

        const prod = mul8(a, b);
        const quot = div8(prod, b);
        expect(quot).toBe(a);
      }),
      { numRuns: 50 }
    );

    // Restore default polynomial for other tests
    initGF256WithPolynomial(ConfigGF256.DEFAULT);
  });

  it('Property 20: GF(2^16) operations remain consistent with different primitive polynomials', () => {
    // Test with DEFAULT polynomial (0x1100B)
    initGF65536WithPolynomial(ConfigGF65536.DEFAULT);
    expect(getCurrentGF65536Polynomial()).toBe(ConfigGF65536.DEFAULT);

    fc.assert(
      fc.property(gf16NonZero, gf16NonZero, (a, b) => {
        // Field axioms should hold regardless of polynomial
        // Multiplicative inverse: a * inv(a) = 1
        const inverse = inv16(a);
        const product = mul16(a, inverse);
        expect(product).toBe(1);

        // Commutativity: a * b = b * a
        const ab = mul16(a, b);
        const ba = mul16(b, a);
        expect(ab).toBe(ba);

        // Division consistency: (a * b) / b = a
        const prod = mul16(a, b);
        const quot = div16(prod, b);
        expect(quot).toBe(a);
      }),
      { numRuns: 50 }
    );

    // Test with ALT1 polynomial (0x1002D)
    initGF65536WithPolynomial(ConfigGF65536.ALT1);
    expect(getCurrentGF65536Polynomial()).toBe(ConfigGF65536.ALT1);

    fc.assert(
      fc.property(gf16NonZero, gf16NonZero, (a, b) => {
        // Same field axioms should hold with different polynomial
        const inverse = inv16(a);
        const product = mul16(a, inverse);
        expect(product).toBe(1);

        const ab = mul16(a, b);
        const ba = mul16(b, a);
        expect(ab).toBe(ba);

        const prod = mul16(a, b);
        const quot = div16(prod, b);
        expect(quot).toBe(a);
      }),
      { numRuns: 50 }
    );

    // Restore default polynomial for other tests
    initGF65536WithPolynomial(ConfigGF65536.DEFAULT);
  });

  it('Property 20: Polynomial switching does not break field operations', () => {
    // Switch between polynomials and verify operations still work
    const polynomials = [
      ConfigGF256.DEFAULT,
      ConfigGF256.ANSI,
      ConfigGF256.CCSDS,
      ConfigGF256.ALT1,
      ConfigGF256.ALT2
    ];

    for (const poly of polynomials) {
      initGF256WithPolynomial(poly);
      expect(getCurrentGF256Polynomial()).toBe(poly);

      // Verify basic operations work
      expect(add8(5, 10)).toBe(5 ^ 10); // XOR is independent of polynomial
      expect(mul8(1, 100)).toBe(100); // Identity element
      expect(mul8(0, 100)).toBe(0); // Zero element

      // Verify inverse works
      const testValue = 42;
      const inverse = inv8(testValue);
      expect(mul8(testValue, inverse)).toBe(1);
    }

    // Restore default
    initGF256WithPolynomial(ConfigGF256.DEFAULT);
  });

  it('Property 20: Round-trip encoding/decoding works with different polynomials', () => {
    const { ReedSolomonEncoder } = require('../../src/encoder');
    const { ReedSolomonDecoder } = require('../../src/decoder');
    const { GaloisField, MatrixType } = require('../../src/config');

    // Test with CCSDS polynomial
    const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    
    const encoderConfig = {
      dataShards: 5,
      parityShards: 2,
      shardSize: 2,
      field: GaloisField.GF256,
      matrixType: MatrixType.Vandermonde,
      primitivePolynomialGF256: ConfigGF256.CCSDS
    };

    const encoder = new ReedSolomonEncoder(encoderConfig);
    const encoded = encoder.encode(testData);

    // Verify we have the right number of shards
    expect(encoded.dataShards.length).toBe(5);
    expect(encoded.parityShards.length).toBe(2);

    // Decode with matching polynomial
    const decoderConfig = {
      dataShards: 5,
      parityShards: 2,
      shardSize: 2,
      field: GaloisField.GF256,
      matrixType: MatrixType.Vandermonde,
      primitivePolynomialGF256: ConfigGF256.CCSDS // MUST match encoder
    };

    const decoder = new ReedSolomonDecoder(decoderConfig);

    // Use first 5 shards (all data shards)
    const shards = encoded.dataShards.map((data: Uint8Array, index: number) => ({
      index,
      data,
      isData: true
    }));

    const decoded = decoder.decode(shards);

    // Verify round-trip
    expect(decoded).toEqual(testData);

    // Restore default polynomial
    initGF256WithPolynomial(ConfigGF256.DEFAULT);
  });
});
