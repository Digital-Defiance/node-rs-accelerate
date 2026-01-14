/**
 * Property-based tests for TypedArray consistency
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { EncoderConfig, DecoderConfig, GaloisField, MatrixType, ShardInfo } from '../../src/config';

describe('TypedArray Consistency', () => {
  /**
   * Property 17: TypedArray Consistency
   * For any API function accepting or returning data buffers, the buffers should be
   * TypedArrays (Uint8Array or Uint16Array) matching the configured field size
   * Validates: Requirements 6.3
   */
  
  it('Property 17: TypedArray Consistency - Encoder returns Uint8Array for GF256', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 }),
          field: fc.constant(GaloisField.GF256)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 5120 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Create encoder and encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify all data shards are Uint8Array
          expect(encoded.dataShards).toBeInstanceOf(Array);
          for (let i = 0; i < encoded.dataShards.length; i++) {
            expect(encoded.dataShards[i]).toBeInstanceOf(Uint8Array);
            expect(encoded.dataShards[i].length).toBe(config.shardSize);
            
            // Verify each element is a valid uint8 (0-255)
            for (let j = 0; j < encoded.dataShards[i].length; j++) {
              expect(encoded.dataShards[i][j]).toBeGreaterThanOrEqual(0);
              expect(encoded.dataShards[i][j]).toBeLessThanOrEqual(255);
              expect(Number.isInteger(encoded.dataShards[i][j])).toBe(true);
            }
          }
          
          // Verify all parity shards are Uint8Array
          expect(encoded.parityShards).toBeInstanceOf(Array);
          for (let i = 0; i < encoded.parityShards.length; i++) {
            expect(encoded.parityShards[i]).toBeInstanceOf(Uint8Array);
            expect(encoded.parityShards[i].length).toBe(config.shardSize);
            
            // Verify each element is a valid uint8 (0-255)
            for (let j = 0; j < encoded.parityShards[i].length; j++) {
              expect(encoded.parityShards[i][j]).toBeGreaterThanOrEqual(0);
              expect(encoded.parityShards[i][j]).toBeLessThanOrEqual(255);
              expect(Number.isInteger(encoded.parityShards[i][j])).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: TypedArray Consistency - Decoder accepts Uint8Array and returns Uint8Array for GF256', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 }),
          field: fc.constant(GaloisField.GF256)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 5120 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Prepare shards for decoding (all Uint8Array)
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,  // Uint8Array
            isData: true
          }));
          
          // Verify all shard data are Uint8Array
          for (const shard of shards) {
            expect(shard.data).toBeInstanceOf(Uint8Array);
          }
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify decoded data is Uint8Array
          expect(decoded).toBeInstanceOf(Uint8Array);
          expect(decoded.length).toBe(expectedSize);
          
          // Verify each element is a valid uint8 (0-255)
          for (let i = 0; i < decoded.length; i++) {
            expect(decoded[i]).toBeGreaterThanOrEqual(0);
            expect(decoded[i]).toBeLessThanOrEqual(255);
            expect(Number.isInteger(decoded[i])).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: TypedArray Consistency - Encoder input must be Uint8Array for GF256', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          field: fc.constant(GaloisField.GF256)
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const expectedSize = config.dataShards * config.shardSize;
          const encoder = new ReedSolomonEncoder(config);
          
          // Test with Uint8Array (should work)
          const validData = new Uint8Array(expectedSize);
          expect(() => {
            encoder.encode(validData);
          }).not.toThrow();
          
          // The encoder should handle Uint8Array correctly
          const encoded = encoder.encode(validData);
          expect(encoded.dataShards[0]).toBeInstanceOf(Uint8Array);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 17: TypedArray Consistency - Batch encoding returns arrays of Uint8Array for GF256', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }),
          batchSize: fc.integer({ min: 2, max: 4 }),
          field: fc.constant(GaloisField.GF256)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create batch of data blocks (all Uint8Array)
          const dataBlocks: Uint8Array[] = [];
          const expectedSize = config.dataShards * config.shardSize;
          
          for (let b = 0; b < config.batchSize; b++) {
            const data = new Uint8Array(expectedSize);
            for (let i = 0; i < expectedSize; i++) {
              data[i] = inputData[(i + b * 1000) % inputData.length];
            }
            dataBlocks.push(data);
          }
          
          // Verify all input blocks are Uint8Array
          for (const block of dataBlocks) {
            expect(block).toBeInstanceOf(Uint8Array);
          }
          
          // Batch encode
          const encoder = new ReedSolomonEncoder(config);
          const batchResults = encoder.batchEncode(dataBlocks);
          
          // Verify all results contain Uint8Array shards
          expect(batchResults).toBeInstanceOf(Array);
          expect(batchResults.length).toBe(config.batchSize);
          
          for (const result of batchResults) {
            // Verify data shards are Uint8Array
            for (const shard of result.dataShards) {
              expect(shard).toBeInstanceOf(Uint8Array);
              expect(shard.length).toBe(config.shardSize);
            }
            
            // Verify parity shards are Uint8Array
            for (const shard of result.parityShards) {
              expect(shard).toBeInstanceOf(Uint8Array);
              expect(shard.length).toBe(config.shardSize);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 17: TypedArray Consistency - Reconstruction returns Uint8Array for GF256', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 2, max: 5 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          field: fc.constant(GaloisField.GF256)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1280 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Prepare shards (use all data shards)
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Reconstruct missing parity shards
          const missingIndices = [config.dataShards, config.dataShards + 1];
          
          const decoder = new ReedSolomonDecoder(config);
          const reconstructed = decoder.reconstruct(shards, missingIndices);
          
          // Verify reconstructed shards are Uint8Array
          expect(reconstructed).toBeInstanceOf(Array);
          expect(reconstructed.length).toBe(missingIndices.length);
          
          for (const shard of reconstructed) {
            expect(shard).toBeInstanceOf(Uint8Array);
            expect(shard.length).toBe(config.shardSize);
            
            // Verify each element is a valid uint8 (0-255)
            for (let i = 0; i < shard.length; i++) {
              expect(shard[i]).toBeGreaterThanOrEqual(0);
              expect(shard[i]).toBeLessThanOrEqual(255);
              expect(Number.isInteger(shard[i])).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 17: TypedArray Consistency - All operations preserve TypedArray type through pipeline', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          field: fc.constant(GaloisField.GF256)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1280 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Start with Uint8Array
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          expect(data).toBeInstanceOf(Uint8Array);
          
          // Encode - should return Uint8Array shards
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          for (const shard of encoded.dataShards) {
            expect(shard).toBeInstanceOf(Uint8Array);
          }
          for (const shard of encoded.parityShards) {
            expect(shard).toBeInstanceOf(Uint8Array);
          }
          
          // Prepare shards - should be Uint8Array
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          for (const shard of shards) {
            expect(shard.data).toBeInstanceOf(Uint8Array);
          }
          
          // Decode - should return Uint8Array
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          expect(decoded).toBeInstanceOf(Uint8Array);
          
          // Verify round-trip maintains type and data
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 17: TypedArray Consistency - Configuration getters return correct types', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 }),
          field: fc.constant(GaloisField.GF256),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create encoder
          const encoder = new ReedSolomonEncoder(config);
          const storedConfig = encoder.getConfig();
          
          // Verify config values are correct types
          expect(typeof storedConfig.dataShards).toBe('number');
          expect(typeof storedConfig.parityShards).toBe('number');
          expect(typeof storedConfig.shardSize).toBe('number');
          expect(typeof storedConfig.field).toBe('number');
          expect(typeof storedConfig.matrixType).toBe('string');
          
          // Verify numeric values are integers
          expect(Number.isInteger(storedConfig.dataShards)).toBe(true);
          expect(Number.isInteger(storedConfig.parityShards)).toBe(true);
          expect(Number.isInteger(storedConfig.shardSize)).toBe(true);
          
          // Verify field is valid GaloisField enum value
          expect([GaloisField.GF256, GaloisField.GF65536]).toContain(storedConfig.field);
          
          // Verify matrixType is valid MatrixType enum value
          expect([MatrixType.Vandermonde, MatrixType.Cauchy]).toContain(storedConfig.matrixType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
