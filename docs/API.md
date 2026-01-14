# API Reference

Complete API documentation for @digitaldefiance/node-rs-accelerate.

## Table of Contents

- [Classes](#classes)
  - [ReedSolomonEncoder](#reedsolomonencoder)
  - [ReedSolomonDecoder](#reedsolomondecoder)
  - [StreamingEncoder](#streamingencoder)
  - [StreamingDecoder](#streamingdecoder)
- [Interfaces](#interfaces)
  - [EncoderConfig](#encoderconfig)
  - [DecoderConfig](#decoderconfig)
  - [EncodedData](#encodeddata)
  - [ShardInfo](#shardinfo)
  - [CompressionConfig](#compressionconfig)
- [Enums](#enums)
  - [GaloisField](#galoisfield)
  - [MatrixType](#matrixtype)
  - [PrimitivePolynomialGF256](#primitivepolynomialgf256)
  - [PrimitivePolynomialGF65536](#primitivepolynomialgf65536)
- [Error Classes](#error-classes)
  - [ReedSolomonError](#reedsolomonerror)
  - [ConfigurationError](#configurationerror)
  - [InsufficientShardsError](#insufficientshardserror)
  - [CorruptionError](#corruptionerror)
  - [NativeError](#nativeerror)
  - [MetalError](#metalerror)
- [Utility Functions](#utility-functions)
  - [validateConfig](#validateconfig)
  - [estimateMemoryUsage](#estimatememoryusage)
  - [shouldUseGPU](#shouldusegpu)
  - [isMetalAvailable](#ismetalavailable)
  - [initMetal](#initmetal)

---

## Classes

### ReedSolomonEncoder

Reed-Solomon encoder for creating error-correcting codes.

The encoder implements systematic Reed-Solomon encoding, where the first K shards contain the original data unchanged, and M additional parity shards provide redundancy. Any K shards from the total K+M can reconstruct the original data.

#### Constructor

```typescript
constructor(config: EncoderConfig)
```

Creates a new Reed-Solomon encoder.

**Parameters:**
- `config` - Encoder configuration

**Throws:**
- `ConfigurationError` - If configuration is invalid
- `NativeError` - If Galois Field initialization fails

**Example:**
```typescript
const encoder = new ReedSolomonEncoder({
  dataShards: 10,
  parityShards: 4,
  shardSize: 1024,
  field: GaloisField.GF256,
  matrixType: MatrixType.Vandermonde
});
```

#### Methods

##### encode

```typescript
encode(data: Uint8Array): EncodedData
```

Encode data into Reed-Solomon shards.

Splits input data into K data shards and generates M parity shards using Reed-Solomon encoding. The encoding is systematic, meaning the first K shards contain the original data unchanged.

**Parameters:**
- `data` - Input data to encode (must be `dataShards * shardSize` bytes)

**Returns:** `EncodedData` - Encoded data with K data shards and M parity shards

**Throws:**
- `NativeError` - If encoding fails or data size is invalid

**Example:**
```typescript
const data = new Uint8Array(10 * 1024);  // 10KB
const encoded = encoder.encode(data);
console.log(`Data shards: ${encoded.dataShards.length}`);
console.log(`Parity shards: ${encoded.parityShards.length}`);
```

##### batchEncode

```typescript
batchEncode(dataBlocks: Uint8Array[]): EncodedData[]
```

Batch encode multiple data blocks using GPU acceleration.

Encodes multiple data blocks in a single GPU operation, amortizing GPU initialization and data transfer overhead across all blocks.

**Parameters:**
- `dataBlocks` - Array of input data blocks to encode

**Returns:** `EncodedData[]` - Array of encoded data, one for each input block

**Throws:**
- `NativeError` - If batch encoding fails

**Example:**
```typescript
const blocks = [
  new Uint8Array(10 * 1024),
  new Uint8Array(10 * 1024),
  new Uint8Array(10 * 1024)
];
const encoded = encoder.batchEncode(blocks);
```

##### encodeStream

```typescript
encodeStream(): Transform
```

Create a streaming encoder Transform stream.

Returns a Node.js Transform stream that can be used in stream pipelines to encode data incrementally.

**Returns:** `Transform` - Transform stream for encoding

**Example:**
```typescript
import { createReadStream, createWriteStream } from 'fs';

createReadStream('input.dat')
  .pipe(encoder.encodeStream())
  .pipe(/* handle encoded chunks */);
```

##### getConfig

```typescript
getConfig(): EncoderConfig
```

Get the current encoder configuration.

**Returns:** `EncoderConfig` - Copy of the current configuration

---

### ReedSolomonDecoder

Reed-Solomon decoder for reconstructing data from shards.

The decoder reconstructs original data from any K shards out of K+M total shards. It can recover from up to M missing or corrupted shards.

#### Constructor

```typescript
constructor(config: DecoderConfig)
```

Creates a new Reed-Solomon decoder.

**Parameters:**
- `config` - Decoder configuration (must match encoder)

**Throws:**
- `ConfigurationError` - If configuration is invalid
- `NativeError` - If Galois Field initialization fails

#### Methods

##### decode

```typescript
decode(shards: ShardInfo[], validateParityShards?: boolean): Uint8Array
```

Decode data from available shards.

Reconstructs the original data from any K shards out of K+M total. The shards can be any combination of data and parity shards.

**Parameters:**
- `shards` - Available shards with indices (must have at least K shards)
- `validateParityShards` - If true, validate reconstructed data against available parity shards (default: false)

**Returns:** `Uint8Array` - Reconstructed original data

**Throws:**
- `InsufficientShardsError` - If fewer than K shards provided
- `NativeError` - If decoding fails
- `CorruptionError` - If hash or parity validation fails

**Example:**
```typescript
const shards: ShardInfo[] = [
  { index: 0, data: shard0, isData: true },
  { index: 1, data: shard1, isData: true },
  // ... more shards
];
const decoded = decoder.decode(shards);
```

##### reconstruct

```typescript
reconstruct(shards: ShardInfo[], missingIndices: number[]): Uint8Array[]
```

Reconstruct specific missing shards.

Instead of reconstructing all original data, this method reconstructs only the specified missing shards. More efficient when you only need specific shards.

**Parameters:**
- `shards` - Available shards (must have at least K shards)
- `missingIndices` - Indices of shards to reconstruct

**Returns:** `Uint8Array[]` - Array of reconstructed shards

**Throws:**
- `InsufficientShardsError` - If fewer than K shards provided
- `NativeError` - If reconstruction fails

**Example:**
```typescript
const reconstructed = decoder.reconstruct(shards, [6, 7]);
console.log(`Reconstructed ${reconstructed.length} shards`);
```

##### canDecode

```typescript
canDecode(shardIndices: number[]): boolean
```

Check if provided shards are sufficient for decoding.

Validates that at least K unique valid shard indices are provided.

**Parameters:**
- `shardIndices` - Indices of available shards

**Returns:** `boolean` - true if decoding is possible

**Example:**
```typescript
if (decoder.canDecode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
  console.log('Sufficient shards for decoding');
}
```

##### decodeStream

```typescript
decodeStream(): Transform
```

Create a streaming decoder Transform stream.

**Returns:** `Transform` - Transform stream for decoding

---

### StreamingEncoder

Transform stream for encoding data in chunks.

Extends Node.js Transform stream. Maintains state across chunks and handles backpressure.

#### Constructor

```typescript
constructor(config: EncoderConfig)
```

#### Methods

##### getChunkIndex

```typescript
getChunkIndex(): number
```

Get the current chunk index.

##### getBufferSize

```typescript
getBufferSize(): number
```

Get the current buffer size in bytes.

---

### StreamingDecoder

Transform stream for decoding shards incrementally.

Extends Node.js Transform stream. Processes shards incrementally and handles backpressure.

#### Constructor

```typescript
constructor(config: DecoderConfig)
```

#### Methods

##### getBufferedChunkCount

```typescript
getBufferedChunkCount(): number
```

Get the number of buffered chunks.

##### getCurrentChunkIndex

```typescript
getCurrentChunkIndex(): number
```

Get the current chunk index.

---

## Interfaces

### EncoderConfig

Configuration for Reed-Solomon encoder.

```typescript
interface EncoderConfig {
  /** K - number of data shards (must be positive) */
  dataShards: number;
  
  /** M - number of parity shards (must be positive) */
  parityShards: number;
  
  /** Size of each shard in bytes (must be positive) */
  shardSize: number;
  
  /** Galois Field size (default: GF256) */
  field?: GaloisField;
  
  /** Matrix construction type (default: Vandermonde) */
  matrixType?: MatrixType;
  
  /** Force GPU usage (default: auto-detect) */
  useGPU?: boolean;
  
  /** Minimum shard size to use GPU (default: 10KB) */
  gpuThreshold?: number;
  
  /** Optional compression configuration */
  compression?: CompressionConfig;
  
  /** Enable SHA-256 hash validation (default: false) */
  enableHashValidation?: boolean;
  
  /** Primitive polynomial for GF(2^8) */
  primitivePolynomialGF256?: PrimitivePolynomialGF256;
  
  /** Primitive polynomial for GF(2^16) */
  primitivePolynomialGF65536?: PrimitivePolynomialGF65536;
}
```

### DecoderConfig

Configuration for Reed-Solomon decoder.

```typescript
interface DecoderConfig {
  /** K - number of data shards (must match encoder) */
  dataShards: number;
  
  /** M - number of parity shards (must match encoder) */
  parityShards: number;
  
  /** Size of each shard in bytes (must match encoder) */
  shardSize: number;
  
  /** Galois Field size (must match encoder) */
  field?: GaloisField;
  
  /** Matrix construction type (must match encoder) */
  matrixType?: MatrixType;
  
  /** Force GPU usage (default: auto-detect) */
  useGPU?: boolean;
  
  /** Compression configuration (must match encoder) */
  compression?: CompressionConfig;
  
  /** Enable SHA-256 hash validation (default: false) */
  enableHashValidation?: boolean;
  
  /** Primitive polynomial for GF(2^8) (must match encoder) */
  primitivePolynomialGF256?: PrimitivePolynomialGF256;
  
  /** Primitive polynomial for GF(2^16) (must match encoder) */
  primitivePolynomialGF65536?: PrimitivePolynomialGF65536;
}
```

### EncodedData

Result of Reed-Solomon encoding operation.

```typescript
interface EncodedData {
  /** K shards containing original data (systematic encoding) */
  dataShards: Uint8Array[];
  
  /** M shards containing parity/redundancy data */
  parityShards: Uint8Array[];
  
  /** Configuration used for encoding */
  config: EncoderConfig;
  
  /** Whether data was compressed before encoding */
  compressed?: boolean;
  
  /** Original size before compression */
  originalSize?: number;
  
  /** Size after compression */
  compressedSize?: number;
  
  /** SHA-256 hashes of data shards (if hash validation enabled) */
  dataHashes?: string[];
  
  /** SHA-256 hashes of parity shards (if hash validation enabled) */
  parityHashes?: string[];
}
```

### ShardInfo

Information about a single shard for decoding.

```typescript
interface ShardInfo {
  /** Shard index (0 to K-1 for data, K to K+M-1 for parity) */
  index: number;
  
  /** Shard data (must be shardSize bytes) */
  data: Uint8Array;
  
  /** true if data shard, false if parity shard */
  isData: boolean;
  
  /** Optional SHA-256 hash for validation */
  hash?: string;
}
```

### CompressionConfig

Compression configuration options.

```typescript
interface CompressionConfig {
  /** Enable compression */
  enabled: boolean;
  
  /** Compression level (0-9, default: 6) */
  level?: number;
  
  /** Compression algorithm (default: gzip) */
  algorithm?: 'gzip' | 'deflate' | 'brotli';
}
```

---

## Enums

### GaloisField

Galois Field size for Reed-Solomon operations.

```typescript
enum GaloisField {
  /** GF(2^8) - up to 256 shards */
  GF256 = 8,
  
  /** GF(2^16) - up to 65536 shards */
  GF65536 = 16
}
```

### MatrixType

Matrix construction type for encoding.

```typescript
enum MatrixType {
  /** Vandermonde matrix construction */
  Vandermonde = 'vandermonde',
  
  /** Cauchy matrix construction */
  Cauchy = 'cauchy'
}
```

### PrimitivePolynomialGF256

Standard primitive polynomials for GF(2^8).

```typescript
enum PrimitivePolynomialGF256 {
  /** x^8 + x^4 + x^3 + x^2 + 1 (0x11D) - Default */
  DEFAULT = 0x11D,
  
  /** x^8 + x^7 + x^2 + x + 1 (0x187) - ANSI standard */
  ANSI = 0x187,
  
  /** x^8 + x^6 + x^5 + x^4 + 1 (0x171) - CCSDS standard */
  CCSDS = 0x171,
  
  /** x^8 + x^5 + x^3 + x + 1 (0x12B) */
  ALT1 = 0x12B,
  
  /** x^8 + x^5 + x^3 + x^2 + 1 (0x12D) */
  ALT2 = 0x12D
}
```

### PrimitivePolynomialGF65536

Standard primitive polynomials for GF(2^16).

```typescript
enum PrimitivePolynomialGF65536 {
  /** x^16 + x^12 + x^3 + x + 1 (0x1100B) - Default */
  DEFAULT = 0x1100B,
  
  /** x^16 + x^5 + x^3 + x^2 + 1 (0x1002D) */
  ALT1 = 0x1002D,
  
  /** x^16 + x^5 + x^3 + x + 1 (0x1002B) */
  ALT2 = 0x1002B,
  
  /** x^16 + x^12 + x^3 + x^2 + 1 (0x1100D) */
  ALT3 = 0x1100D
}
```

---

## Error Classes

### ReedSolomonError

Base error class for all Reed-Solomon errors.

```typescript
class ReedSolomonError extends Error {
  code: string;
  constructor(message: string, code: string);
}
```

### ConfigurationError

Error thrown when configuration parameters are invalid.

```typescript
class ConfigurationError extends ReedSolomonError {
  constructor(message: string);
}
```

**Error Code:** `INVALID_CONFIG`

**Common Causes:**
- `dataShards` or `parityShards` not positive
- `shardSize` not positive
- Total shards exceed field size

### InsufficientShardsError

Error thrown when insufficient shards are provided for decoding.

```typescript
class InsufficientShardsError extends ReedSolomonError {
  constructor(required: number, available: number);
}
```

**Error Code:** `INSUFFICIENT_SHARDS`

### CorruptionError

Error thrown when data corruption is detected.

```typescript
class CorruptionError extends ReedSolomonError {
  constructor(message: string);
}
```

**Error Code:** `DATA_CORRUPTION`

**Common Causes:**
- Hash validation failed
- Parity validation failed
- Data corrupted beyond repair

### NativeError

Error thrown when native code operations fail.

```typescript
class NativeError extends ReedSolomonError {
  constructor(message: string);
}
```

**Error Code:** `NATIVE_ERROR`

### MetalError

Error thrown when Metal GPU operations fail.

```typescript
class MetalError extends ReedSolomonError {
  constructor(message: string);
}
```

**Error Code:** `METAL_ERROR`

---

## Utility Functions

### validateConfig

```typescript
function validateConfig(config: EncoderConfig | DecoderConfig): void
```

Validate encoder or decoder configuration.

**Parameters:**
- `config` - Configuration to validate

**Throws:**
- `ConfigurationError` - If configuration is invalid

**Example:**
```typescript
try {
  validateConfig({ dataShards: 10, parityShards: 4, shardSize: 1024 });
  console.log('Configuration is valid');
} catch (e) {
  console.error('Invalid:', e.message);
}
```

### estimateMemoryUsage

```typescript
function estimateMemoryUsage(config: EncoderConfig): number
```

Estimate memory usage for an encoding operation.

**Parameters:**
- `config` - Encoder configuration

**Returns:** `number` - Estimated memory usage in bytes

**Example:**
```typescript
const bytes = estimateMemoryUsage(config);
console.log(`Estimated memory: ${bytes / (1024 * 1024)} MB`);
```

### shouldUseGPU

```typescript
function shouldUseGPU(config: EncoderConfig): boolean
```

Determine if GPU acceleration should be used.

**Parameters:**
- `config` - Encoder configuration

**Returns:** `boolean` - true if GPU should be used

### isMetalAvailable

```typescript
function isMetalAvailable(): boolean
```

Check if Metal GPU acceleration is available.

**Returns:** `boolean` - true if Metal is available

### initMetal

```typescript
function initMetal(): boolean
```

Initialize Metal GPU acceleration.

**Returns:** `boolean` - true if Metal was successfully initialized
