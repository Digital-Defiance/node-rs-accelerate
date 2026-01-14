# Primitive Polynomials for Reed-Solomon Encoding

## Overview

This document describes the primitive polynomials used in the @digitaldefiance/node-rs-accelerate library for Galois Field arithmetic. Primitive polynomials are fundamental to Reed-Solomon error correction codes, as they define the structure of the Galois Field used for encoding and decoding operations.

## What is a Primitive Polynomial?

A primitive polynomial is an irreducible polynomial that generates all non-zero elements of a Galois Field through successive powers of a generator element (typically α = 2). For Reed-Solomon codes:

- **GF(2^8)**: Uses 8-bit symbols, supports up to 256 total shards
- **GF(2^16)**: Uses 16-bit symbols, supports up to 65,536 total shards

## Supported Primitive Polynomials

### GF(2^8) Primitive Polynomials

The library supports multiple primitive polynomials for GF(2^8) to ensure interoperability with different Reed-Solomon implementations:

| Name | Hex Value | Binary Representation | Polynomial | Standard/Usage |
|------|-----------|----------------------|------------|----------------|
| **DEFAULT** | `0x11D` | `100011101` | x^8 + x^4 + x^3 + x^2 + 1 | Default, AES, most RS implementations |
| **ANSI** | `0x187` | `110000111` | x^8 + x^7 + x^2 + x + 1 | ANSI standard |
| **CCSDS** | `0x171` | `101110001` | x^8 + x^6 + x^5 + x^4 + 1 | CCSDS space communications |
| **ALT1** | `0x12B` | `100101011` | x^8 + x^5 + x^3 + x + 1 | Alternative primitive |
| **ALT2** | `0x12D` | `100101101` | x^8 + x^5 + x^3 + x^2 + 1 | Alternative primitive |

### GF(2^16) Primitive Polynomials

The library supports multiple primitive polynomials for GF(2^16) for large-scale Reed-Solomon applications:

| Name | Hex Value | Binary Representation | Polynomial | Usage |
|------|-----------|----------------------|------------|-------|
| **DEFAULT** | `0x1100B` | `10001000000001011` | x^16 + x^12 + x^3 + x + 1 | Default for GF(2^16) |
| **ALT1** | `0x1002D` | `10000000000101101` | x^16 + x^5 + x^3 + x^2 + 1 | Alternative primitive |
| **ALT2** | `0x1002B` | `10000000000101011` | x^16 + x^5 + x^3 + x + 1 | Alternative primitive |
| **ALT3** | `0x1100D` | `10001000000001101` | x^16 + x^12 + x^3 + x^2 + 1 | Alternative primitive |

## Usage

### TypeScript API

```typescript
import { 
  PrimitivePolynomialGF256, 
  PrimitivePolynomialGF65536,
  EncoderConfig,
  GaloisField 
} from '@digitaldefiance/node-rs-accelerate';

// Using default polynomial (0x11D for GF(2^8))
const config1: EncoderConfig = {
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  field: GaloisField.GF256
};

// Using CCSDS polynomial for space communications compatibility
const config2: EncoderConfig = {
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  field: GaloisField.GF256,
  primitivePolynomialGF256: PrimitivePolynomialGF256.CCSDS
};

// Using custom polynomial for GF(2^16)
const config3: EncoderConfig = {
  dataShards: 1000,
  parityShards: 500,
  shardSize: 1024,
  field: GaloisField.GF65536,
  primitivePolynomialGF65536: PrimitivePolynomialGF65536.ALT1
};
```

### Direct GF Initialization

```typescript
import { 
  initGF256WithPolynomial, 
  initGF65536WithPolynomial,
  PrimitivePolynomialGF256,
  PrimitivePolynomialGF65536
} from '@digitaldefiance/node-rs-accelerate';

// Initialize GF(2^8) with ANSI polynomial
initGF256WithPolynomial(PrimitivePolynomialGF256.ANSI);

// Initialize GF(2^16) with alternative polynomial
initGF65536WithPolynomial(PrimitivePolynomialGF65536.ALT1);
```

### Checking Current Polynomial

```typescript
import { 
  getCurrentGF256Polynomial, 
  getCurrentGF65536Polynomial 
} from '@digitaldefiance/node-rs-accelerate';

// Get current GF(2^8) polynomial
const gf256Poly = getCurrentGF256Polynomial();
console.log(`Current GF(2^8) polynomial: 0x${gf256Poly.toString(16)}`);

// Get current GF(2^16) polynomial
const gf65536Poly = getCurrentGF65536Polynomial();
console.log(`Current GF(2^16) polynomial: 0x${gf65536Poly.toString(16)}`);
```

## Interoperability Considerations

### Matching Encoder and Decoder

**CRITICAL**: The encoder and decoder MUST use the same primitive polynomial. If they use different polynomials, decoding will fail or produce incorrect results.

```typescript
// Encoder configuration
const encoderConfig: EncoderConfig = {
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  field: GaloisField.GF256,
  primitivePolynomialGF256: PrimitivePolynomialGF256.CCSDS
};

// Decoder configuration MUST match
const decoderConfig: DecoderConfig = {
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  field: GaloisField.GF256,
  primitivePolynomialGF256: PrimitivePolynomialGF256.CCSDS  // MUST match encoder
};
```

### Cross-System Compatibility

When interoperating with other Reed-Solomon implementations:

1. **Identify the primitive polynomial** used by the other system
2. **Configure the library** to use the same polynomial
3. **Verify matrix type** (Vandermonde vs Cauchy) also matches
4. **Test with known data** to ensure compatibility

### Common Standards

- **AES/Rijndael**: Uses `0x11D` (DEFAULT)
- **QR Codes**: Uses `0x11D` (DEFAULT)
- **CCSDS (Space Communications)**: Uses `0x171` (CCSDS)
- **Some ANSI Standards**: Use `0x187` (ANSI)

## Generator Polynomial

The library uses a generator element α = 2 for all Galois Fields. The generator polynomial is constructed from the primitive polynomial:

- For GF(2^8): g(x) = (x - α^0)(x - α^1)...(x - α^(M-1))
- For GF(2^16): g(x) = (x - α^0)(x - α^1)...(x - α^(M-1))

Where M is the number of parity shards.

## Performance Considerations

Different primitive polynomials have the same computational complexity. The choice of polynomial does not affect performance, only interoperability with other systems.

## References

- [Finite Field Arithmetic](https://en.wikipedia.org/wiki/Finite_field_arithmetic) - Mathematical foundation
- [Reed-Solomon Error Correction](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction) - RS codes overview
- [CCSDS 131.0-B-3](https://public.ccsds.org/Pubs/131x0b3e1.pdf) - Space communications standard
- [AES Specification](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf) - Uses GF(2^8) with 0x11D

## Testing Primitive Polynomials

The library includes property-based tests to verify that all supported primitive polynomials generate valid Galois Fields with the required mathematical properties (closure, associativity, commutativity, distributivity, and multiplicative inverses).

See `test/properties/gf_properties.test.ts` for the test implementation.
