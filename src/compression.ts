/**
 * Compression utilities for Reed-Solomon encoding/decoding
 */

import { promisify } from 'util';
import { gzip, gunzip, deflate, inflate, brotliCompress, brotliDecompress, constants } from 'zlib';
import { CompressionConfig } from './config';
import { NativeError } from './errors';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Compress data using the specified configuration
 * @param data Data to compress
 * @param config Compression configuration
 * @returns Compressed data
 */
export async function compressData(
  data: Uint8Array,
  config: CompressionConfig
): Promise<Uint8Array> {
  if (!config.enabled) {
    return data;
  }

  const algorithm = config.algorithm || 'gzip';
  const level = config.level !== undefined ? config.level : 6;

  // Validate compression level
  if (level < 0 || level > 9) {
    throw new NativeError(`Invalid compression level ${level} (must be 0-9)`);
  }

  try {
    let compressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        compressed = await gzipAsync(data, { level });
        break;
      case 'deflate':
        compressed = await deflateAsync(data, { level });
        break;
      case 'brotli':
        compressed = await brotliCompressAsync(data, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: level
          }
        });
        break;
      default:
        throw new NativeError(`Unsupported compression algorithm: ${algorithm}`);
    }

    return new Uint8Array(compressed);
  } catch (e) {
    throw new NativeError(`Compression failed: ${e}`);
  }
}

/**
 * Decompress data using the specified configuration
 * @param data Compressed data
 * @param config Compression configuration
 * @returns Decompressed data
 */
export async function decompressData(
  data: Uint8Array,
  config: CompressionConfig
): Promise<Uint8Array> {
  if (!config.enabled) {
    return data;
  }

  const algorithm = config.algorithm || 'gzip';

  try {
    let decompressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        decompressed = await gunzipAsync(data);
        break;
      case 'deflate':
        decompressed = await inflateAsync(data);
        break;
      case 'brotli':
        decompressed = await brotliDecompressAsync(data);
        break;
      default:
        throw new NativeError(`Unsupported compression algorithm: ${algorithm}`);
    }

    return new Uint8Array(decompressed);
  } catch (e) {
    throw new NativeError(`Decompression failed: ${e}`);
  }
}

/**
 * Synchronous compression for non-async contexts
 * @param data Data to compress
 * @param config Compression configuration
 * @returns Compressed data
 */
export function compressDataSync(
  data: Uint8Array,
  config: CompressionConfig
): Uint8Array {
  if (!config.enabled) {
    return data;
  }

  const algorithm = config.algorithm || 'gzip';
  const level = config.level !== undefined ? config.level : 6;

  // Validate compression level
  if (level < 0 || level > 9) {
    throw new NativeError(`Invalid compression level ${level} (must be 0-9)`);
  }

  try {
    let compressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        compressed = require('zlib').gzipSync(data, { level });
        break;
      case 'deflate':
        compressed = require('zlib').deflateSync(data, { level });
        break;
      case 'brotli':
        compressed = require('zlib').brotliCompressSync(data, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: level
          }
        });
        break;
      default:
        throw new NativeError(`Unsupported compression algorithm: ${algorithm}`);
    }

    return new Uint8Array(compressed);
  } catch (e) {
    throw new NativeError(`Compression failed: ${e}`);
  }
}

/**
 * Synchronous decompression for non-async contexts
 * @param data Compressed data
 * @param config Compression configuration
 * @returns Decompressed data
 */
export function decompressDataSync(
  data: Uint8Array,
  config: CompressionConfig
): Uint8Array {
  if (!config.enabled) {
    return data;
  }

  const algorithm = config.algorithm || 'gzip';

  try {
    let decompressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        decompressed = require('zlib').gunzipSync(data);
        break;
      case 'deflate':
        decompressed = require('zlib').inflateSync(data);
        break;
      case 'brotli':
        decompressed = require('zlib').brotliDecompressSync(data);
        break;
      default:
        throw new NativeError(`Unsupported compression algorithm: ${algorithm}`);
    }

    return new Uint8Array(decompressed);
  } catch (e) {
    throw new NativeError(`Decompression failed: ${e}`);
  }
}
