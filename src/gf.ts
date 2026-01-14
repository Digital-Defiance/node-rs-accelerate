/**
 * Galois Field operations TypeScript wrapper
 */

// Load native addon
const addon = require('../build/Release/node_rs_accelerate.node');

/**
 * Initialize GF(2^8) lookup tables with default primitive polynomial (0x11D)
 */
export function initGF256(): void {
  addon.initGF();
}

/**
 * Initialize GF(2^8) lookup tables with custom primitive polynomial
 * @param primitivePolynomial - The primitive polynomial to use (e.g., 0x11D, 0x187, 0x171)
 */
export function initGF256WithPolynomial(primitivePolynomial: number): void {
  addon.initGFWithPolynomial(primitivePolynomial);
}

/**
 * Initialize GF(2^16) lookup tables with default primitive polynomial (0x1100B)
 */
export function initGF65536(): void {
  addon.initGF65536();
}

/**
 * Initialize GF(2^16) lookup tables with custom primitive polynomial
 * @param primitivePolynomial - The primitive polynomial to use (e.g., 0x1100B, 0x1002D)
 */
export function initGF65536WithPolynomial(primitivePolynomial: number): void {
  addon.initGF65536WithPolynomial(primitivePolynomial);
}

/**
 * Get the current primitive polynomial being used for GF(2^8)
 * @returns The current primitive polynomial (e.g., 0x11D)
 */
export function getCurrentGF256Polynomial(): number {
  return addon.getCurrentGF256Polynomial();
}

/**
 * Get the current primitive polynomial being used for GF(2^16)
 * @returns The current primitive polynomial (e.g., 0x1100B)
 */
export function getCurrentGF65536Polynomial(): number {
  return addon.getCurrentGF65536Polynomial();
}

/**
 * GF(2^8) addition (XOR)
 */
export function add8(a: number, b: number): number {
  return addon.gf_add8(a, b);
}

/**
 * GF(2^8) multiplication
 */
export function mul8(a: number, b: number): number {
  return addon.gf_mul8(a, b);
}

/**
 * GF(2^8) division
 */
export function div8(a: number, b: number): number {
  return addon.gf_div8(a, b);
}

/**
 * GF(2^8) multiplicative inverse
 */
export function inv8(a: number): number {
  return addon.gf_inv8(a);
}

/**
 * GF(2^8) power
 */
export function pow8(a: number, n: number): number {
  return addon.gf_pow8(a, n);
}

/**
 * Vectorized GF(2^8) multiplication (scalar implementation)
 * Performs element-wise multiplication: out[i] = a[i] * b[i] in GF(2^8)
 */
export function mulVec8(a: Uint8Array, b: Uint8Array, out: Uint8Array): Uint8Array {
  return addon.gf_mulVec8(a, b, out);
}

/**
 * Vectorized GF(2^8) addition (scalar implementation)
 * Performs element-wise addition: out[i] = a[i] + b[i] in GF(2^8) (XOR)
 */
export function addVec8(a: Uint8Array, b: Uint8Array, out: Uint8Array): Uint8Array {
  return addon.gf_addVec8(a, b, out);
}

/**
 * Vectorized GF(2^8) multiplication (Accelerate framework optimized)
 * Performs element-wise multiplication: out[i] = a[i] * b[i] in GF(2^8)
 * Uses Apple's Accelerate framework for better performance on large arrays
 */
export function mulVec8Accelerated(a: Uint8Array, b: Uint8Array, out: Uint8Array): Uint8Array {
  return addon.gf_mulVec8Accelerated(a, b, out);
}

/**
 * Vectorized GF(2^8) addition (Accelerate framework optimized)
 * Performs element-wise addition: out[i] = a[i] + b[i] in GF(2^8) (XOR)
 * Uses optimized vectorized operations for better performance on large arrays
 */
export function addVec8Accelerated(a: Uint8Array, b: Uint8Array, out: Uint8Array): Uint8Array {
  return addon.gf_addVec8Accelerated(a, b, out);
}

/**
 * GF(2^16) addition (XOR)
 */
export function add16(a: number, b: number): number {
  return addon.gf_add16(a, b);
}

/**
 * GF(2^16) multiplication
 */
export function mul16(a: number, b: number): number {
  return addon.gf_mul16(a, b);
}

/**
 * GF(2^16) division
 */
export function div16(a: number, b: number): number {
  return addon.gf_div16(a, b);
}

/**
 * GF(2^16) multiplicative inverse
 */
export function inv16(a: number): number {
  return addon.gf_inv16(a);
}

/**
 * GF(2^16) power
 */
export function pow16(a: number, n: number): number {
  return addon.gf_pow16(a, n);
}

/**
 * Vectorized GF(2^16) multiplication (scalar implementation)
 * Performs element-wise multiplication: out[i] = a[i] * b[i] in GF(2^16)
 */
export function mulVec16(a: Uint16Array, b: Uint16Array, out: Uint16Array): Uint16Array {
  return addon.gf_mulVec16(a, b, out);
}

/**
 * Vectorized GF(2^16) addition (scalar implementation)
 * Performs element-wise addition: out[i] = a[i] + b[i] in GF(2^16) (XOR)
 */
export function addVec16(a: Uint16Array, b: Uint16Array, out: Uint16Array): Uint16Array {
  return addon.gf_addVec16(a, b, out);
}

/**
 * Vectorized GF(2^16) multiplication (Accelerate framework optimized)
 * Performs element-wise multiplication: out[i] = a[i] * b[i] in GF(2^16)
 * Uses Apple's Accelerate framework for better performance on large arrays
 */
export function mulVec16Accelerated(a: Uint16Array, b: Uint16Array, out: Uint16Array): Uint16Array {
  return addon.gf_mulVec16Accelerated(a, b, out);
}

/**
 * Vectorized GF(2^16) addition (Accelerate framework optimized)
 * Performs element-wise addition: out[i] = a[i] + b[i] in GF(2^16) (XOR)
 * Uses optimized vectorized operations for better performance on large arrays
 */
export function addVec16Accelerated(a: Uint16Array, b: Uint16Array, out: Uint16Array): Uint16Array {
  return addon.gf_addVec16Accelerated(a, b, out);
}
