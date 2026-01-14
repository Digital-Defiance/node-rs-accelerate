/**
 * Unit tests for Galois Field arithmetic edge cases
 */

import { initGF256, add8, mul8, div8, inv8, pow8 } from '../../src/gf';

// Initialize GF tables before tests
beforeAll(() => {
  initGF256();
});

describe('GF(2^8) Edge Cases', () => {
  describe('Operations with 0', () => {
    it('should handle addition with 0', () => {
      expect(add8(0, 0)).toBe(0);
      expect(add8(0, 5)).toBe(5);
      expect(add8(5, 0)).toBe(5);
      expect(add8(0, 255)).toBe(255);
    });

    it('should handle multiplication with 0', () => {
      expect(mul8(0, 0)).toBe(0);
      expect(mul8(0, 5)).toBe(0);
      expect(mul8(5, 0)).toBe(0);
      expect(mul8(0, 255)).toBe(0);
    });

    it('should handle division with 0 numerator', () => {
      expect(div8(0, 1)).toBe(0);
      expect(div8(0, 5)).toBe(0);
      expect(div8(0, 255)).toBe(0);
    });

    it('should throw error for division by 0', () => {
      expect(() => div8(5, 0)).toThrow('Division by zero');
      expect(() => div8(255, 0)).toThrow('Division by zero');
    });

    it('should throw error for inverse of 0', () => {
      expect(() => inv8(0)).toThrow('Inverse of zero');
    });

    it('should handle power with 0 base', () => {
      expect(pow8(0, 1)).toBe(0);
      expect(pow8(0, 5)).toBe(0);
      expect(pow8(0, 255)).toBe(0);
    });
  });

  describe('Operations with 1 (multiplicative identity)', () => {
    it('should handle multiplication with 1', () => {
      expect(mul8(1, 1)).toBe(1);
      expect(mul8(1, 5)).toBe(5);
      expect(mul8(5, 1)).toBe(5);
      expect(mul8(1, 255)).toBe(255);
    });

    it('should handle division with 1', () => {
      expect(div8(1, 1)).toBe(1);
      expect(div8(5, 1)).toBe(5);
      expect(div8(255, 1)).toBe(255);
      expect(div8(1, 5)).toBe(inv8(5));
    });

    it('should handle inverse of 1', () => {
      expect(inv8(1)).toBe(1);
    });

    it('should handle power with 1 base', () => {
      expect(pow8(1, 0)).toBe(1);
      expect(pow8(1, 1)).toBe(1);
      expect(pow8(1, 5)).toBe(1);
      expect(pow8(1, 255)).toBe(1);
    });

    it('should handle power with 0 exponent', () => {
      expect(pow8(0, 0)).toBe(1); // 0^0 = 1 by convention
      expect(pow8(1, 0)).toBe(1);
      expect(pow8(5, 0)).toBe(1);
      expect(pow8(255, 0)).toBe(1);
    });
  });

  describe('Operations with 255 (maximum value)', () => {
    it('should handle addition with 255', () => {
      expect(add8(255, 0)).toBe(255);
      expect(add8(255, 255)).toBe(0); // 255 XOR 255 = 0
    });

    it('should handle multiplication with 255', () => {
      expect(mul8(255, 1)).toBe(255);
      expect(mul8(255, 255)).toBeGreaterThanOrEqual(0);
      expect(mul8(255, 255)).toBeLessThanOrEqual(255);
    });

    it('should handle division with 255', () => {
      expect(div8(255, 1)).toBe(255);
      expect(div8(255, 255)).toBe(1);
    });

    it('should handle inverse of 255', () => {
      const inv = inv8(255);
      expect(mul8(255, inv)).toBe(1);
    });
  });

  describe('Inverse of all non-zero elements', () => {
    it('should compute valid inverse for all non-zero elements', () => {
      for (let i = 1; i <= 255; i++) {
        const inverse = inv8(i);
        const product = mul8(i, inverse);
        expect(product).toBe(1);
      }
    });
  });

  describe('Known GF(2^8) values', () => {
    it('should compute known multiplication results', () => {
      // Generator α = 2
      expect(mul8(2, 2)).toBe(4);   // α * α = α^2
      expect(mul8(2, 4)).toBe(8);   // α * α^2 = α^3
      expect(mul8(2, 8)).toBe(16);  // α * α^3 = α^4
    });

    it('should handle XOR addition correctly', () => {
      expect(add8(1, 1)).toBe(0);   // 1 XOR 1 = 0
      expect(add8(5, 5)).toBe(0);   // any value XOR itself = 0
      expect(add8(3, 5)).toBe(6);   // 0b011 XOR 0b101 = 0b110
    });
  });
});
