/**
 * Unit tests for the field-polynomial primitivity guard.
 *
 * initGF256WithPolynomial / initGF65536WithPolynomial build their log and
 * antilog tables by walking powers of the generator alpha = 2. That only
 * produces a valid field if alpha's multiplicative order is exactly 2^m - 1.
 * With a shorter order the antilog table wraps early, most of the log table is
 * never written, and every subsequent product is silently wrong. These tests
 * pin the guard that rejects such polynomials.
 */

import {
  initGF256,
  initGF256WithPolynomial,
  initGF65536,
  initGF65536WithPolynomial,
  getCurrentGF256Polynomial,
  getCurrentGF65536Polynomial,
  mul8,
  inv8,
} from '../../src/gf';

/**
 * Independent reference implementation of the order of alpha = 2 in GF(2^m)
 * under `poly`. Returns 0 if the power sequence never returns to 1.
 *
 * Deliberately written from the definition rather than shared with the native
 * code, so the test is not just restating the implementation.
 */
function alphaOrder(poly: number, m: number): number {
  const overflowBit = 1 << m;
  const groupOrder = overflowBit - 1;
  let x = 1;
  for (let i = 1; i <= groupOrder; i++) {
    x <<= 1;
    if (x & overflowBit) {
      x ^= poly;
    }
    if (x === 1) {
      return i;
    }
  }
  return 0;
}

const GF256_DOCUMENTED_GOOD = [0x11d, 0x187, 0x171];
const GF65536_DOCUMENTED_GOOD = [0x1100b, 0x1002d];

// The guard mutates process-global native state on success. Restore the
// defaults so later suites in the same worker see a standard field.
afterAll(() => {
  initGF256();
  initGF65536();
});

describe('GF(2^8) polynomial validation', () => {
  beforeEach(() => {
    initGF256();
  });

  it('rejects 0x11B, the AES polynomial, which is irreducible but not primitive', () => {
    // Sanity-check the premise with the reference implementation first.
    expect(alphaOrder(0x11b, 8)).toBe(51);

    expect(() => initGF256WithPolynomial(0x11b)).toThrow(/not primitive/i);
    expect(() => initGF256WithPolynomial(0x11b)).toThrow(/order 51/);
    expect(() => initGF256WithPolynomial(0x11b)).toThrow(/255 is required/);
  });

  it('accepts the documented polynomials', () => {
    for (const poly of GF256_DOCUMENTED_GOOD) {
      expect(alphaOrder(poly, 8)).toBe(255);
      expect(() => initGF256WithPolynomial(poly)).not.toThrow();
      expect(getCurrentGF256Polynomial()).toBe(poly);
    }
  });

  it('rejects values that are not degree 8', () => {
    // 0x1D has the right coefficients but no x^8 term, so the table builder's
    // single-bit reduction test would never fire.
    expect(() => initGF256WithPolynomial(0x1d)).toThrow(/degree 8/);
    expect(() => initGF256WithPolynomial(0x00)).toThrow(/degree 8/);
    expect(() => initGF256WithPolynomial(0xff)).toThrow(/degree 8/);
  });

  it('classifies every degree-8 polynomial the same way the definition does', () => {
    const wronglyRejected: string[] = [];
    const wronglyAccepted: string[] = [];

    for (let poly = 0x100; poly <= 0x1ff; poly++) {
      const primitive = alphaOrder(poly, 8) === 255;
      let accepted = true;
      try {
        initGF256WithPolynomial(poly);
      } catch {
        accepted = false;
      }
      if (primitive && !accepted) {
        wronglyRejected.push('0x' + poly.toString(16).toUpperCase());
      }
      if (!primitive && accepted) {
        wronglyAccepted.push('0x' + poly.toString(16).toUpperCase());
      }
    }

    expect(wronglyAccepted).toEqual([]);
    expect(wronglyRejected).toEqual([]);
  });

  it('leaves the active field untouched when a polynomial is rejected', () => {
    initGF256WithPolynomial(0x11d);
    const before = getCurrentGF256Polynomial();

    expect(() => initGF256WithPolynomial(0x11b)).toThrow();

    expect(getCurrentGF256Polynomial()).toBe(before);
    // And the field still works (0x57 * 0x83 = 0x31 under 0x11D).
    expect(mul8(0x57, 0x83)).toBe(0x31);
  });

  it('produces a usable field for each accepted polynomial', () => {
    // If a polynomial is accepted, the log table must be fully populated,
    // which shows up as every non-zero element having a true inverse.
    for (const poly of GF256_DOCUMENTED_GOOD) {
      initGF256WithPolynomial(poly);
      for (let a = 1; a < 256; a++) {
        expect(mul8(a, inv8(a))).toBe(1);
      }
    }
  });
});

describe('GF(2^16) polynomial validation', () => {
  beforeEach(() => {
    initGF65536();
  });

  it('accepts the documented polynomials', () => {
    for (const poly of GF65536_DOCUMENTED_GOOD) {
      expect(alphaOrder(poly, 16)).toBe(65535);
      expect(() => initGF65536WithPolynomial(poly)).not.toThrow();
      expect(getCurrentGF65536Polynomial()).toBe(poly);
    }
  });

  it('rejects an irreducible-looking but non-primitive polynomial', () => {
    const poly = 0x1002b;
    const order = alphaOrder(poly, 16);
    expect(order).toBeGreaterThan(0);
    expect(order).not.toBe(65535);

    expect(() => initGF65536WithPolynomial(poly)).toThrow(/not primitive/i);
    expect(() => initGF65536WithPolynomial(poly)).toThrow(
      new RegExp(`order ${order}`)
    );
  });

  it('rejects values that are not degree 16', () => {
    expect(() => initGF65536WithPolynomial(0x100b)).toThrow(/degree 16/);
    expect(() => initGF65536WithPolynomial(0x2100b)).toThrow(/degree 16/);
  });

  it('leaves the active field untouched when a polynomial is rejected', () => {
    initGF65536WithPolynomial(0x1100b);
    const before = getCurrentGF65536Polynomial();

    expect(() => initGF65536WithPolynomial(0x1002b)).toThrow();

    expect(getCurrentGF65536Polynomial()).toBe(before);
  });
});
