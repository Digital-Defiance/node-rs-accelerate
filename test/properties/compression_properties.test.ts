/**
 * Property-based tests for compression integration
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { EncoderConfig, CompressionConfig } from '../../src/config';

describe('Compression Round-Trip', () => {
  /**
   * Property 15: Compression Round-Trip
   * For any input data with compression enabled, encoding with compression then decoding
   * with decompression should perfectly reconstruct the original data
   * Validates: Requirements 11.3
   */
  it('Property 15: Compression Round-Trip - gzip compression', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 256, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constant('gzip' as const),
            level: fc.integer({ min: 0, max: 9 })
          })
        }),
        fc.uint8Array({ minLength: 100, maxLength: 10240 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Store original data for comparison
          const originalData = new Uint8Array(inputData);
          
          // Encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(originalData);
          
          // Verify compression metadata is present
          expect(encoded.compressed).toBe(true);
          expect(encoded.originalSize).toBe(originalData.length);
          expect(encoded.compressedSize).toBeDefined();
          expect(encoded.compressedSize).toBeGreaterThan(0);
          
          // Prepare shards for decoding (use all data shards)
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode with decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip: decoded data should match original
          expect(decoded.length).toBe(originalData.length);
          for (let i = 0; i < originalData.length; i++) {
            expect(decoded[i]).toBe(originalData[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - deflate compression', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 256, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constant('deflate' as const),
            level: fc.integer({ min: 0, max: 9 })
          })
        }),
        fc.uint8Array({ minLength: 100, maxLength: 10240 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const originalData = new Uint8Array(inputData);
          
          // Encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(originalData);
          
          // Verify compression metadata
          expect(encoded.compressed).toBe(true);
          expect(encoded.originalSize).toBe(originalData.length);
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode with decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip
          expect(decoded.length).toBe(originalData.length);
          for (let i = 0; i < originalData.length; i++) {
            expect(decoded[i]).toBe(originalData[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - brotli compression', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 256, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constant('brotli' as const),
            level: fc.integer({ min: 0, max: 9 })
          })
        }),
        fc.uint8Array({ minLength: 100, maxLength: 10240 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const originalData = new Uint8Array(inputData);
          
          // Encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(originalData);
          
          // Verify compression metadata
          expect(encoded.compressed).toBe(true);
          expect(encoded.originalSize).toBe(originalData.length);
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode with decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip
          expect(decoded.length).toBe(originalData.length);
          for (let i = 0; i < originalData.length; i++) {
            expect(decoded[i]).toBe(originalData[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - with mixed data and parity shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 10 }),
          parityShards: fc.integer({ min: 2, max: 5 }),
          shardSize: fc.integer({ min: 256, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constantFrom('gzip' as const, 'deflate' as const, 'brotli' as const),
            level: fc.integer({ min: 1, max: 9 })
          })
        }),
        fc.uint8Array({ minLength: 100, maxLength: 10240 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const originalData = new Uint8Array(inputData);
          
          // Encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(originalData);
          
          // Create all available shards (data + parity)
          const allShards = [
            ...encoded.dataShards.map((shard, index) => ({
              index,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Select exactly K shards (mix of data and parity)
          // Take some data shards and some parity shards
          const numDataShards = Math.max(1, Math.floor(config.dataShards * 0.6));
          const numParityShards = config.dataShards - numDataShards;
          
          // Ensure we don't exceed available parity shards
          const actualParityShards = Math.min(numParityShards, config.parityShards);
          const actualDataShards = config.dataShards - actualParityShards;
          
          const selectedShards = [
            ...allShards.slice(0, actualDataShards),
            ...allShards.slice(config.dataShards, config.dataShards + actualParityShards)
          ];
          
          // Verify we have exactly K shards
          expect(selectedShards.length).toBe(config.dataShards);
          
          // Decode with decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(selectedShards);
          
          // Verify round-trip
          expect(decoded.length).toBe(originalData.length);
          for (let i = 0; i < originalData.length; i++) {
            expect(decoded[i]).toBe(originalData[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - without compression enabled', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 256, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(false)
          })
        }),
        fc.uint8Array({ minLength: 100, maxLength: 10240 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode without compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify compression metadata is not present
          expect(encoded.compressed).toBeUndefined();
          expect(encoded.originalSize).toBeUndefined();
          expect(encoded.compressedSize).toBeUndefined();
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode without decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - compression reduces size for repetitive data', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 512, max: 2048 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constant('gzip' as const),
            level: fc.constant(9) // Maximum compression
          })
        }),
        fc.integer({ min: 0, max: 255 }),
        (config, repeatByte) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create highly repetitive data (should compress well)
          const dataSize = 1024;
          const originalData = new Uint8Array(dataSize);
          originalData.fill(repeatByte);
          
          // Encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(originalData);
          
          // Verify compression actually reduced size
          expect(encoded.compressed).toBe(true);
          expect(encoded.originalSize).toBe(dataSize);
          expect(encoded.compressedSize).toBeDefined();
          expect(encoded.compressedSize!).toBeLessThan(dataSize);
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode with decompression
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip
          expect(decoded.length).toBe(originalData.length);
          for (let i = 0; i < originalData.length; i++) {
            expect(decoded[i]).toBe(originalData[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 15: Compression Round-Trip - batch encoding with compression', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }), // > 10KB for GPU
          batchSize: fc.integer({ min: 2, max: 4 }),
          compression: fc.record({
            enabled: fc.constant(true),
            algorithm: fc.constantFrom('gzip' as const, 'deflate' as const),
            level: fc.integer({ min: 1, max: 9 })
          })
        }),
        fc.uint8Array({ minLength: 1000, maxLength: 50000 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create batch of data blocks
          const dataBlocks: Uint8Array[] = [];
          
          for (let b = 0; b < config.batchSize; b++) {
            const blockSize = 5000 + b * 1000;
            const data = new Uint8Array(blockSize);
            for (let i = 0; i < blockSize; i++) {
              data[i] = inputData[(i + b * 1000) % inputData.length];
            }
            dataBlocks.push(data);
          }
          
          // Batch encode with compression
          const encoder = new ReedSolomonEncoder(config);
          const batchResults = encoder.batchEncode(dataBlocks);
          
          // Verify all results have compression metadata
          for (let b = 0; b < config.batchSize; b++) {
            expect(batchResults[b].compressed).toBe(true);
            expect(batchResults[b].originalSize).toBe(dataBlocks[b].length);
            expect(batchResults[b].compressedSize).toBeDefined();
          }
          
          // Decode each batch result and verify round-trip
          const decoder = new ReedSolomonDecoder(config);
          
          for (let b = 0; b < config.batchSize; b++) {
            const encoded = batchResults[b];
            const originalData = dataBlocks[b];
            
            // Prepare shards for decoding
            const shards = encoded.dataShards.map((shard, index) => ({
              index,
              data: shard,
              isData: true
            }));
            
            // Decode with decompression
            const decoded = decoder.decode(shards);
            
            // Verify round-trip
            expect(decoded.length).toBe(originalData.length);
            for (let i = 0; i < originalData.length; i++) {
              expect(decoded[i]).toBe(originalData[i]);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 15: Compression Round-Trip - handles invalid compression level', () => {
    const config: EncoderConfig = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 512,
      compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 15 // Invalid: must be 0-9
      }
    };
    
    const data = new Uint8Array(1000);
    data.fill(42);
    
    const encoder = new ReedSolomonEncoder(config);
    
    // Should throw error about invalid compression level
    expect(() => {
      encoder.encode(data);
    }).toThrow(/compression level/i);
  });

  it('Property 15: Compression Round-Trip - handles unsupported algorithm', () => {
    const config: EncoderConfig = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 512,
      compression: {
        enabled: true,
        algorithm: 'invalid' as any,
        level: 6
      }
    };
    
    const data = new Uint8Array(1000);
    data.fill(42);
    
    const encoder = new ReedSolomonEncoder(config);
    
    // Should throw error about unsupported algorithm
    expect(() => {
      encoder.encode(data);
    }).toThrow(/unsupported.*algorithm/i);
  });
});
