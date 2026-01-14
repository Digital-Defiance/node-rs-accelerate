/**
 * Configuration types and interfaces for Reed-Solomon encoding/decoding
 */

/**
 * Galois Field size for Reed-Solomon operations
 * 
 * @remarks
 * The field size determines the maximum number of shards that can be created.
 * - GF256: Supports up to 256 total shards (data + parity)
 * - GF65536: Supports up to 65536 total shards (data + parity)
 * 
 * @public
 */
export enum GaloisField {
  /** GF(2^8) - up to 256 shards */
  GF256 = 8,
  /** GF(2^16) - up to 65536 shards */
  GF65536 = 16
}

/**
 * Standard primitive polynomials for GF(2^8)
 * 
 * @remarks
 * Different primitive polynomials can be used for interoperability with other systems.
 * All polynomials listed are primitive and will generate valid Galois Fields.
 * 
 * Common standards:
 * - DEFAULT (0x11D): Used by most Reed-Solomon implementations, AES
 * - ANSI (0x187): Used in some ANSI standards
 * - CCSDS (0x171): Used in space communications (CCSDS standard)
 * 
 * @public
 */
export enum PrimitivePolynomialGF256 {
  /** x^8 + x^4 + x^3 + x^2 + 1 (0x11D) - Default, used by AES and most RS implementations */
  DEFAULT = 0x11D,
  /** x^8 + x^7 + x^2 + x + 1 (0x187) - ANSI standard */
  ANSI = 0x187,
  /** x^8 + x^6 + x^5 + x^4 + 1 (0x171) - CCSDS space communications standard */
  CCSDS = 0x171,
  /** x^8 + x^5 + x^3 + x + 1 (0x12B) - Alternative primitive polynomial */
  ALT1 = 0x12B,
  /** x^8 + x^5 + x^3 + x^2 + 1 (0x12D) - Alternative primitive polynomial */
  ALT2 = 0x12D
}

/**
 * Standard primitive polynomials for GF(2^16)
 * 
 * @remarks
 * Different primitive polynomials can be used for interoperability with other systems.
 * All polynomials listed are primitive and will generate valid Galois Fields.
 * 
 * Common standards:
 * - DEFAULT (0x1100B): Commonly used in Reed-Solomon implementations
 * - ALT1 (0x1002D): Alternative primitive polynomial
 * 
 * @public
 */
export enum PrimitivePolynomialGF65536 {
  /** x^16 + x^12 + x^3 + x + 1 (0x1100B) - Default */
  DEFAULT = 0x1100B,
  /** x^16 + x^5 + x^3 + x^2 + 1 (0x1002D) - Alternative primitive polynomial */
  ALT1 = 0x1002D,
  /** x^16 + x^5 + x^3 + x + 1 (0x1002B) - Alternative primitive polynomial */
  ALT2 = 0x1002B,
  /** x^16 + x^12 + x^3 + x^2 + 1 (0x1100D) - Alternative primitive polynomial */
  ALT3 = 0x1100D
}

/**
 * Matrix construction type for encoding
 * 
 * @remarks
 * Different matrix types have different numerical properties:
 * - Vandermonde: Traditional Reed-Solomon matrix, simpler construction
 * - Cauchy: Better numerical properties, avoids certain degenerate cases
 * 
 * @public
 */
export enum MatrixType {
  /** Vandermonde matrix construction */
  Vandermonde = 'vandermonde',
  /** Cauchy matrix construction */
  Cauchy = 'cauchy'
}

/**
 * Compression configuration options
 * 
 * @remarks
 * Compression can reduce bandwidth requirements for redundant data.
 * The data is compressed before encoding and decompressed after decoding.
 * 
 * @public
 */
export interface CompressionConfig {
  /** Enable compression */
  enabled: boolean;
  /** Compression level (0-9, default: 6). Higher values = better compression but slower */
  level?: number;
  /** Compression algorithm (default: gzip) */
  algorithm?: 'gzip' | 'deflate' | 'brotli';
}

/**
 * Configuration for Reed-Solomon encoder
 * 
 * @remarks
 * The encoder splits input data into K data shards and generates M parity shards.
 * Any K shards from the total K+M shards can reconstruct the original data.
 * 
 * @example
 * ```typescript
 * const config: EncoderConfig = {
 *   dataShards: 10,      // K = 10
 *   parityShards: 4,     // M = 4
 *   shardSize: 1024,     // 1KB per shard
 *   field: GaloisField.GF256,
 *   matrixType: MatrixType.Vandermonde
 * };
 * ```
 * 
 * @public
 */
export interface EncoderConfig {
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
  /** Force GPU usage (default: auto-detect based on size) */
  useGPU?: boolean;
  /** Minimum shard size in bytes to use GPU (default: 10KB) */
  gpuThreshold?: number;
  /** Optional compression configuration */
  compression?: CompressionConfig;
  /** Enable SHA-256 hash validation (default: false) */
  enableHashValidation?: boolean;
  /** Primitive polynomial for GF(2^8) (default: DEFAULT/0x11D) */
  primitivePolynomialGF256?: PrimitivePolynomialGF256;
  /** Primitive polynomial for GF(2^16) (default: DEFAULT/0x1100B) */
  primitivePolynomialGF65536?: PrimitivePolynomialGF65536;
}

/**
 * Configuration for Reed-Solomon decoder
 * 
 * @remarks
 * The decoder must use the same configuration parameters (K, M, shard size, field, matrix type)
 * that were used during encoding.
 * 
 * @example
 * ```typescript
 * const config: DecoderConfig = {
 *   dataShards: 10,      // Must match encoder
 *   parityShards: 4,     // Must match encoder
 *   shardSize: 1024,     // Must match encoder
 *   field: GaloisField.GF256,
 *   matrixType: MatrixType.Vandermonde
 * };
 * ```
 * 
 * @public
 */
export interface DecoderConfig {
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
  /** Force GPU usage (default: auto-detect based on size) */
  useGPU?: boolean;
  /** Optional compression configuration (must match encoder if used) */
  compression?: CompressionConfig;
  /** Enable SHA-256 hash validation (default: false) */
  enableHashValidation?: boolean;
  /** Primitive polynomial for GF(2^8) (must match encoder) */
  primitivePolynomialGF256?: PrimitivePolynomialGF256;
  /** Primitive polynomial for GF(2^16) (must match encoder) */
  primitivePolynomialGF65536?: PrimitivePolynomialGF65536;
}

/**
 * Result of Reed-Solomon encoding operation
 * 
 * @remarks
 * Contains K data shards (original data) and M parity shards (redundancy).
 * Any K shards from the total K+M can reconstruct the original data.
 * 
 * @public
 */
export interface EncodedData {
  /** K shards containing original data (systematic encoding) */
  dataShards: Uint8Array[];
  /** M shards containing parity/redundancy data */
  parityShards: Uint8Array[];
  /** Configuration used for encoding */
  config: EncoderConfig;
  /** Whether data was compressed before encoding */
  compressed?: boolean;
  /** Original size before compression (if compression was used) */
  originalSize?: number;
  /** Size after compression (if compression was used) */
  compressedSize?: number;
  /** SHA-256 hashes of data shards (if hash validation enabled) */
  dataHashes?: string[];
  /** SHA-256 hashes of parity shards (if hash validation enabled) */
  parityHashes?: string[];
}

/**
 * Information about a single shard for decoding
 * 
 * @remarks
 * Used to provide available shards to the decoder. The decoder needs at least K shards
 * (any combination of data and parity shards) to reconstruct the original data.
 * 
 * @example
 * ```typescript
 * const shard: ShardInfo = {
 *   index: 0,              // First data shard
 *   data: new Uint8Array([...]),
 *   isData: true,
 *   hash: 'abc123...'      // Optional hash for validation
 * };
 * ```
 * 
 * @public
 */
export interface ShardInfo {
  /** Shard index (0 to K-1 for data, K to K+M-1 for parity) */
  index: number;
  /** Shard data (must be shardSize bytes) */
  data: Uint8Array;
  /** true if data shard (index < K), false if parity shard (index >= K) */
  isData: boolean;
  /** Optional SHA-256 hash of shard data (hex string) for validation */
  hash?: string;
}
