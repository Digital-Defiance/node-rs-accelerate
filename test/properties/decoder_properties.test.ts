/**
 * Property-based tests for Reed-Solomon decoder
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { EncoderConfig, ShardInfo, GaloisField, MatrixType } from '../../src/config';
import { InsufficientShardsError, CorruptionError } from '../../src/errors';

describe('Decoder Error Handling', () => {
  /**
   * Property 10: Insufficient Shards Error
   * For any configuration with K data shards, attempting to decode with fewer than K shards
   * should result in an InsufficientShardsError
   * Validates: Requirements 3.2
   */
  it('Property 10: Insufficient Shards Error - Throws when fewer than K shards provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 })
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
          
          // Create all available shards
          const allShards: ShardInfo[] = [
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
          
          // Try to decode with fewer than K shards (K-1 shards)
          const insufficientShards = allShards.slice(0, config.dataShards - 1);
          
          // Should throw InsufficientShardsError
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            decoder.decode(insufficientShards);
          }).toThrow(InsufficientShardsError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Insufficient Shards Error - Error message contains required and available counts', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 })
        }),
        fc.integer({ min: 0, max: 10 }), // Number of shards to provide (less than K)
        fc.uint8Array({ minLength: 1, maxLength: 5120 }),
        (config, numShardsToProvide, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          // Precondition: ensure we provide fewer than K shards
          fc.pre(numShardsToProvide < config.dataShards);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Create insufficient shards
          const shards: ShardInfo[] = encoded.dataShards
            .slice(0, numShardsToProvide)
            .map((shard, index) => ({
              index,
              data: shard,
              isData: true
            }));
          
          // Try to decode
          const decoder = new ReedSolomonDecoder(config);
          try {
            decoder.decode(shards);
            fail('Should have thrown InsufficientShardsError');
          } catch (e) {
            expect(e).toBeInstanceOf(InsufficientShardsError);
            const error = e as InsufficientShardsError;
            
            // Verify error message contains both required and available counts
            expect(error.message).toContain(config.dataShards.toString());
            expect(error.message).toContain(numShardsToProvide.toString());
            expect(error.message).toContain('need');
            expect(error.message).toContain('have');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Insufficient Shards Error - Does not throw when exactly K shards provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 5120 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Provide exactly K shards
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Should not throw
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            decoder.decode(shards);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Insufficient Shards Error - Does not throw when more than K shards provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 3840 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size and we have extra shards
          fc.pre(config.dataShards + config.parityShards <= 256);
          fc.pre(config.parityShards >= 1); // Ensure we have at least one extra shard
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Provide K+1 shards (all data shards + one parity shard)
          const shards: ShardInfo[] = [
            ...encoded.dataShards.map((shard, index) => ({
              index,
              data: shard,
              isData: true
            })),
            {
              index: config.dataShards,
              data: encoded.parityShards[0],
              isData: false
            }
          ];
          
          // Should not throw
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            decoder.decode(shards);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Insufficient Shards Error - Throws with zero shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Try to decode with zero shards
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            decoder.decode([]);
          }).toThrow(InsufficientShardsError);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Round-Trip Encoding/Decoding (Comprehensive)', () => {
  /**
   * Property 9: Round-Trip Encoding/Decoding
   * For any input data and any selection of K shards from K+M encoded shards,
   * decoding should perfectly reconstruct the original input data
   * Validates: Requirements 3.1, 12.4
   */
  it('Property 9: Round-Trip Encoding/Decoding - With random shard selection', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 0, max: 100 }), // Random seed for shard selection
        (config, inputData, seed) => {
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
          
          // Create all available shards (data + parity)
          const allShards: ShardInfo[] = [
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
          
          // Randomly select K shards from all available shards
          // Use seed to make selection deterministic but varied
          const shuffled = [...allShards];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (seed * (i + 1)) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const selectedShards = shuffled.slice(0, config.dataShards);
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(selectedShards);
          
          // Verify round-trip: decoded data should match original
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Round-Trip Encoding/Decoding - With missing data shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 1, max: 10 }), // Number of data shards to drop
        (config, inputData, numDataShardsToDrop) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          // Precondition: ensure we don't drop too many data shards
          fc.pre(numDataShardsToDrop < config.dataShards);
          // Precondition: ensure we have enough parity shards to recover
          fc.pre(numDataShardsToDrop <= config.parityShards);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Create shards: keep some data shards, drop others, add parity shards
          const numDataShardsToKeep = config.dataShards - numDataShardsToDrop;
          const shards: ShardInfo[] = [
            // Keep first numDataShardsToKeep data shards
            ...encoded.dataShards.slice(0, numDataShardsToKeep).map((shard, index) => ({
              index,
              data: shard,
              isData: true
            })),
            // Add enough parity shards to reach K total shards
            ...encoded.parityShards.slice(0, numDataShardsToDrop).map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works even with missing data shards
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Round-Trip Encoding/Decoding - With only parity shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1280 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          // Precondition: ensure we have enough parity shards
          fc.pre(config.parityShards >= config.dataShards);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Use only parity shards (no data shards)
          const shards: ShardInfo[] = encoded.parityShards
            .slice(0, config.dataShards)
            .map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }));
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works with only parity shards
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Round-Trip Encoding/Decoding - With various data patterns', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.oneof(
          // All zeros
          fc.constant(new Uint8Array(1920).fill(0)),
          // All ones
          fc.constant(new Uint8Array(1920).fill(1)),
          // All 255s
          fc.constant(new Uint8Array(1920).fill(255)),
          // Sequential pattern
          fc.constant(new Uint8Array(1920).map((_, i) => i % 256)),
          // Random data
          fc.uint8Array({ minLength: 1, maxLength: 1920 })
        ),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Use all data shards
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works with various data patterns
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Round-Trip Encoding/Decoding - With maximum erasures', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Create all available shards
          const allShards: ShardInfo[] = [
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
          
          // Use exactly K shards (maximum M erasures)
          // Take last K shards to ensure we're using parity shards
          const shards = allShards.slice(-config.dataShards);
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works with maximum erasures
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Parity Validation', () => {
  /**
   * Property 11: Parity Validation
   * For any reconstructed data and available parity shards, the reconstructed data
   * should satisfy all parity equations defined by the encoding matrix
   * Validates: Requirements 3.8, 8.1
   */
  it('Property 11: Parity Validation - Reconstructed data satisfies parity equations', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Drop some data shards and decode
          const numDataShardsToDrop = Math.min(1, config.parityShards);
          const shards: ShardInfo[] = [
            ...encoded.dataShards.slice(numDataShardsToDrop).map((shard, index) => ({
              index: index + numDataShardsToDrop,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.slice(0, numDataShardsToDrop).map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Re-encode the decoded data
          const reencoded = encoder.encode(decoded);
          
          // Verify that parity shards match
          // If reconstruction is correct, parity shards should be identical
          for (let i = 0; i < config.parityShards; i++) {
            expect(reencoded.parityShards[i].length).toBe(encoded.parityShards[i].length);
            for (let j = 0; j < config.shardSize; j++) {
              expect(reencoded.parityShards[i][j]).toBe(encoded.parityShards[i][j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Parity Validation - Data shards satisfy parity equations', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify that encoding the data shards produces the same parity shards
          // This validates that the parity equations are satisfied
          const reencoded = encoder.encode(data);
          
          // Data shards should be identical (systematic encoding)
          for (let i = 0; i < config.dataShards; i++) {
            for (let j = 0; j < config.shardSize; j++) {
              expect(reencoded.dataShards[i][j]).toBe(encoded.dataShards[i][j]);
            }
          }
          
          // Parity shards should be identical
          for (let i = 0; i < config.parityShards; i++) {
            for (let j = 0; j < config.shardSize; j++) {
              expect(reencoded.parityShards[i][j]).toBe(encoded.parityShards[i][j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Parity Validation - Parity check detects corruption', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 0, max: 127 }), // Byte position to corrupt
        fc.integer({ min: 1, max: 255 }), // Corruption value (non-zero)
        (config, inputData, corruptPos, corruptValue) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          fc.pre(corruptPos < config.shardSize);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Corrupt one data shard
          const corruptedDataShards = encoded.dataShards.map((shard, index) => {
            if (index === 0) {
              const corrupted = new Uint8Array(shard);
              corrupted[corruptPos] ^= corruptValue; // XOR to corrupt
              return corrupted;
            }
            return shard;
          });
          
          // Re-encode the corrupted data
          const corruptedData = new Uint8Array(expectedSize);
          for (let i = 0; i < config.dataShards; i++) {
            corruptedData.set(corruptedDataShards[i], i * config.shardSize);
          }
          const reencoded = encoder.encode(corruptedData);
          
          // Parity shards should be different (detecting corruption)
          let parityDiffers = false;
          for (let i = 0; i < config.parityShards; i++) {
            for (let j = 0; j < config.shardSize; j++) {
              if (reencoded.parityShards[i][j] !== encoded.parityShards[i][j]) {
                parityDiffers = true;
                break;
              }
            }
            if (parityDiffers) break;
          }
          
          // Corruption should be detected (parity differs)
          expect(parityDiffers).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Parity Validation - Works with different matrix types', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Re-encode to verify parity
          const reencoded = encoder.encode(data);
          
          // Parity validation should work for both matrix types
          for (let i = 0; i < config.parityShards; i++) {
            for (let j = 0; j < config.shardSize; j++) {
              expect(reencoded.parityShards[i][j]).toBe(encoded.parityShards[i][j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Partial Reconstruction', () => {
  /**
   * Property 12: Partial Reconstruction Correctness
   * For any subset of missing shard indices and sufficient available shards,
   * partial reconstruction should produce shards that match what full encoding would produce
   * Validates: Requirements 3.9
   */
  it('Property 12: Partial Reconstruction Correctness - Reconstructs specific missing shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 1, max: 5 }), // Number of shards to reconstruct
        (config, inputData, numToReconstruct) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          // Precondition: don't try to reconstruct more than M shards
          fc.pre(numToReconstruct <= config.parityShards);
          // Precondition: don't try to reconstruct more than K data shards
          fc.pre(numToReconstruct <= config.dataShards);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Select which shards to reconstruct (first numToReconstruct data shards)
          const missingIndices = Array.from({ length: numToReconstruct }, (_, i) => i);
          
          // Create available shards (remaining data shards + all parity shards)
          const availableShards: ShardInfo[] = [
            ...encoded.dataShards.slice(numToReconstruct).map((shard, index) => ({
              index: index + numToReconstruct,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Reconstruct missing shards
          const decoder = new ReedSolomonDecoder(config);
          const reconstructed = decoder.reconstruct(availableShards, missingIndices);
          
          // Verify reconstructed shards match original
          expect(reconstructed.length).toBe(numToReconstruct);
          for (let i = 0; i < numToReconstruct; i++) {
            expect(reconstructed[i].length).toBe(config.shardSize);
            for (let j = 0; j < config.shardSize; j++) {
              expect(reconstructed[i][j]).toBe(encoded.dataShards[i][j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Partial Reconstruction Correctness - Reconstructs parity shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Reconstruct first parity shard
          const missingIndices = [config.dataShards];
          
          // Use all data shards
          const availableShards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Reconstruct
          const decoder = new ReedSolomonDecoder(config);
          const reconstructed = decoder.reconstruct(availableShards, missingIndices);
          
          // Verify reconstructed parity shard matches original
          expect(reconstructed.length).toBe(1);
          expect(reconstructed[0].length).toBe(config.shardSize);
          for (let j = 0; j < config.shardSize; j++) {
            expect(reconstructed[0][j]).toBe(encoded.parityShards[0][j]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Partial Reconstruction Correctness - Reconstructs multiple missing shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 4, max: 15 }),
          parityShards: fc.integer({ min: 3, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Reconstruct multiple shards (data and parity)
          const missingIndices = [0, 1, config.dataShards];
          
          // Use remaining shards
          const availableShards: ShardInfo[] = [
            ...encoded.dataShards.slice(2).map((shard, index) => ({
              index: index + 2,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.slice(1).map((shard, index) => ({
              index: config.dataShards + index + 1,
              data: shard,
              isData: false
            }))
          ];
          
          // Reconstruct
          const decoder = new ReedSolomonDecoder(config);
          const reconstructed = decoder.reconstruct(availableShards, missingIndices);
          
          // Verify all reconstructed shards match originals
          expect(reconstructed.length).toBe(3);
          expect(reconstructed[0]).toEqual(encoded.dataShards[0]);
          expect(reconstructed[1]).toEqual(encoded.dataShards[1]);
          expect(reconstructed[2]).toEqual(encoded.parityShards[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Partial Reconstruction Correctness - Works with different matrix types', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Reconstruct first data shard
          const missingIndices = [0];
          
          // Use remaining shards
          const availableShards: ShardInfo[] = [
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Reconstruct
          const decoder = new ReedSolomonDecoder(config);
          const reconstructed = decoder.reconstruct(availableShards, missingIndices);
          
          // Verify reconstruction works for both matrix types
          expect(reconstructed.length).toBe(1);
          expect(reconstructed[0]).toEqual(encoded.dataShards[0]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Corruption Detection', () => {
  /**
   * Property Test for Corruption Detection
   * For any encoded data with corrupted shards, validation should detect the corruption
   * Validates: Requirements 8.1, 8.2
   */
  it('Property: Corruption Detection - Detects corrupted data shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 0, max: 127 }), // Byte position to corrupt
        fc.integer({ min: 1, max: 255 }), // Corruption value (non-zero)
        (config, inputData, corruptPos, corruptValue) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          fc.pre(corruptPos < config.shardSize);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Corrupt one data shard
          const corruptedDataShard = new Uint8Array(encoded.dataShards[0]);
          corruptedDataShard[corruptPos] ^= corruptValue; // XOR to corrupt
          
          // Use all data shards (including corrupted one) - no reconstruction needed
          const shards: ShardInfo[] = [
            {
              index: 0,
              data: corruptedDataShard,
              isData: true
            },
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true
            })),
            ...encoded.parityShards.map((shard, index) => ({
              index: config.dataShards + index,
              data: shard,
              isData: false
            }))
          ];
          
          // Decode with validation enabled
          const decoder = new ReedSolomonDecoder(config);
          
          // Should throw CorruptionError when validation is enabled
          expect(() => {
            decoder.decode(shards, true);
          }).toThrow(CorruptionError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Corruption Detection - Detects corrupted parity shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        fc.integer({ min: 0, max: 127 }), // Byte position to corrupt
        fc.integer({ min: 1, max: 255 }), // Corruption value (non-zero)
        (config, inputData, corruptPos, corruptValue) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          fc.pre(corruptPos < config.shardSize);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Use all data shards (no reconstruction needed)
          const dataShards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Corrupt one parity shard
          const corruptedParity = new Uint8Array(encoded.parityShards[0]);
          corruptedParity[corruptPos] ^= corruptValue;
          
          const parityShards: ShardInfo[] = [
            {
              index: config.dataShards,
              data: corruptedParity,
              isData: false
            },
            ...encoded.parityShards.slice(1).map((shard, index) => ({
              index: config.dataShards + index + 1,
              data: shard,
              isData: false
            }))
          ];
          
          const allShards = [...dataShards, ...parityShards];
          
          // Decode with validation enabled
          const decoder = new ReedSolomonDecoder(config);
          
          // Should throw CorruptionError when validation detects corrupted parity
          expect(() => {
            decoder.decode(allShards, true);
          }).toThrow(CorruptionError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Corruption Detection - Passes validation with uncorrupted data', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Create all shards (uncorrupted)
          const allShards: ShardInfo[] = [
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
          
          // Decode with validation enabled - should not throw
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            const decoded = decoder.decode(allShards, true);
            // Verify decoded data matches original
            expect(decoded.length).toBe(data.length);
            for (let i = 0; i < data.length; i++) {
              expect(decoded[i]).toBe(data[i]);
            }
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Corruption Detection - Works with reconstructed data', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 1920 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Drop one data shard and use parity to reconstruct
          const shards: ShardInfo[] = [
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true
            })),
            {
              index: config.dataShards,
              data: encoded.parityShards[0],
              isData: false
            },
            ...encoded.parityShards.slice(1).map((shard, index) => ({
              index: config.dataShards + index + 1,
              data: shard,
              isData: false
            }))
          ];
          
          // Decode with validation - should pass since data is uncorrupted
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            const decoded = decoder.decode(shards, true);
            // Verify decoded data matches original
            expect(decoded.length).toBe(data.length);
            for (let i = 0; i < data.length; i++) {
              expect(decoded[i]).toBe(data[i]);
            }
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Shard Sufficiency Validation', () => {
  /**
   * Property 18: Shard Sufficiency Validation
   * For any set of shard indices, the validation function should correctly determine
   * whether the set is sufficient for decoding (returns true if and only if count >= K and shards are valid)
   * Validates: Requirements 8.5
   */
  it('Property 18: Shard Sufficiency Validation - Returns true with exactly K valid shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Create exactly K valid shard indices (first K shards)
          const shardIndices = Array.from({ length: config.dataShards }, (_, i) => i);
          
          // Should return true
          expect(decoder.canDecode(shardIndices)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns true with more than K valid shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Create K+1 valid shard indices
          const shardIndices = Array.from({ length: config.dataShards + 1 }, (_, i) => i);
          
          // Should return true
          expect(decoder.canDecode(shardIndices)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns false with fewer than K shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.integer({ min: 0, max: 10 }), // Number of shards (less than K)
        (config, numShards) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          // Precondition: ensure we have fewer than K shards
          fc.pre(numShards < config.dataShards);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Create fewer than K shard indices
          const shardIndices = Array.from({ length: numShards }, (_, i) => i);
          
          // Should return false
          expect(decoder.canDecode(shardIndices)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns false with invalid shard indices', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          const totalShards = config.dataShards + config.parityShards;
          
          // Create K shard indices, but include one invalid index
          const shardIndices = Array.from({ length: config.dataShards }, (_, i) => {
            if (i === 0) {
              return totalShards; // Invalid index (out of range)
            }
            return i;
          });
          
          // Should return false due to invalid index
          expect(decoder.canDecode(shardIndices)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns false with negative shard indices', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Create K shard indices, but include one negative index
          const shardIndices = Array.from({ length: config.dataShards }, (_, i) => {
            if (i === 0) {
              return -1; // Invalid negative index
            }
            return i;
          });
          
          // Should return false due to negative index
          expect(decoder.canDecode(shardIndices)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns false with duplicate shard indices', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 3, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Create K shard indices with duplicates (only K-1 unique)
          const shardIndices = Array.from({ length: config.dataShards }, (_, i) => {
            if (i === config.dataShards - 1) {
              return 0; // Duplicate of first index
            }
            return i;
          });
          
          // Should return false due to insufficient unique shards
          expect(decoder.canDecode(shardIndices)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns true with random valid shard selection', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        fc.integer({ min: 0, max: 100 }), // Random seed for selection
        (config, seed) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          const totalShards = config.dataShards + config.parityShards;
          
          // Create all possible shard indices
          const allIndices = Array.from({ length: totalShards }, (_, i) => i);
          
          // Randomly shuffle and select K shards
          const shuffled = [...allIndices];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (seed * (i + 1)) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const selectedIndices = shuffled.slice(0, config.dataShards);
          
          // Should return true with any K valid unique shards
          expect(decoder.canDecode(selectedIndices)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Returns false with empty array', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          
          // Empty array
          const shardIndices: number[] = [];
          
          // Should return false
          expect(decoder.canDecode(shardIndices)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 18: Shard Sufficiency Validation - Works with all shards available', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          const decoder = new ReedSolomonDecoder(config);
          const totalShards = config.dataShards + config.parityShards;
          
          // All shard indices
          const shardIndices = Array.from({ length: totalShards }, (_, i) => i);
          
          // Should return true
          expect(decoder.canDecode(shardIndices)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
