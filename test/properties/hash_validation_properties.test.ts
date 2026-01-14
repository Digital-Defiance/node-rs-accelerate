/**
 * Property-based tests for hash validation
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { ShardInfo } from '../../src/config';
import { CorruptionError } from '../../src/errors';
import { computeHash } from '../../src/utils';

describe('Hash Validation', () => {
  /**
   * Property 19: Hash Validation Correctness
   * For any shard with hash validation enabled, the computed hash should match
   * the expected hash if and only if the shard data is uncorrupted
   * Validates: Requirements 8.4
   */
  it('Property 19: Hash Validation Correctness - Hashes are computed for all shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(true)
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
          
          // Encode with hash validation enabled
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify hashes are present
          expect(encoded.dataHashes).toBeDefined();
          expect(encoded.parityHashes).toBeDefined();
          expect(encoded.dataHashes?.length).toBe(config.dataShards);
          expect(encoded.parityHashes?.length).toBe(config.parityShards);
          
          // Verify hashes are correct
          for (let i = 0; i < config.dataShards; i++) {
            const expectedHash = computeHash(encoded.dataShards[i]);
            expect(encoded.dataHashes![i]).toBe(expectedHash);
          }
          
          for (let i = 0; i < config.parityShards; i++) {
            const expectedHash = computeHash(encoded.parityShards[i]);
            expect(encoded.parityHashes![i]).toBe(expectedHash);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19: Hash Validation Correctness - Detects corrupted shards via hash', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(true)
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
          
          // Encode with hash validation enabled
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Corrupt one data shard
          const corruptedShard = new Uint8Array(encoded.dataShards[0]);
          corruptedShard[corruptPos] ^= corruptValue;
          
          // Create shards with original hash but corrupted data
          const shards: ShardInfo[] = [
            {
              index: 0,
              data: corruptedShard,
              isData: true,
              hash: encoded.dataHashes![0] // Original hash, but data is corrupted
            },
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true,
              hash: encoded.dataHashes![index + 1]
            }))
          ];
          
          // Decode with hash validation enabled
          const decoder = new ReedSolomonDecoder(config);
          
          // Should throw CorruptionError due to hash mismatch
          expect(() => {
            decoder.decode(shards);
          }).toThrow(CorruptionError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19: Hash Validation Correctness - Accepts uncorrupted shards with valid hashes', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(true)
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
          
          // Encode with hash validation enabled
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Create shards with hashes
          const shards: ShardInfo[] = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true,
            hash: encoded.dataHashes![index]
          }));
          
          // Decode with hash validation enabled - should not throw
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            const decoded = decoder.decode(shards);
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

  it('Property 19: Hash Validation Correctness - Works with parity shards', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 2, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(true)
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
          
          // Encode with hash validation enabled
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Corrupt one parity shard
          const corruptedParity = new Uint8Array(encoded.parityShards[0]);
          corruptedParity[corruptPos] ^= corruptValue;
          
          // Create shards: drop one data shard, use corrupted parity
          const shards: ShardInfo[] = [
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true,
              hash: encoded.dataHashes![index + 1]
            })),
            {
              index: config.dataShards,
              data: corruptedParity,
              isData: false,
              hash: encoded.parityHashes![0] // Original hash, but data is corrupted
            }
          ];
          
          // Decode with hash validation enabled
          const decoder = new ReedSolomonDecoder(config);
          
          // Should throw CorruptionError due to hash mismatch on parity shard
          expect(() => {
            decoder.decode(shards);
          }).toThrow(CorruptionError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19: Hash Validation Correctness - Hashes are not computed when disabled', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(false)
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
          
          // Encode with hash validation disabled
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify hashes are not present
          expect(encoded.dataHashes).toBeUndefined();
          expect(encoded.parityHashes).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19: Hash Validation Correctness - Validation is skipped when hashes not provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 15 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 128 }),
          enableHashValidation: fc.constant(true)
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
          const corruptedShard = new Uint8Array(encoded.dataShards[0]);
          corruptedShard[corruptPos] ^= corruptValue;
          
          // Create shards WITHOUT hashes (even though validation is enabled)
          const shards: ShardInfo[] = [
            {
              index: 0,
              data: corruptedShard,
              isData: true
              // No hash provided
            },
            ...encoded.dataShards.slice(1).map((shard, index) => ({
              index: index + 1,
              data: shard,
              isData: true
              // No hash provided
            }))
          ];
          
          // Decode with hash validation enabled but no hashes provided
          // Should not throw because hashes are not provided
          const decoder = new ReedSolomonDecoder(config);
          expect(() => {
            decoder.decode(shards);
          }).not.toThrow(CorruptionError);
        }
      ),
      { numRuns: 100 }
    );
  });
});
