/**
 * Property-based tests for error handling
 * Property 22: Error Message Clarity
 */

import * as fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { ConfigurationError, InsufficientShardsError, NativeError, CorruptionError } from '../../src/errors';
import { GaloisField, MatrixType } from '../../src/config';

describe('Error Handling Properties', () => {
  describe('Property 22: Error Message Clarity', () => {
    test('ConfigurationError messages include parameter names and values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 0 }), // Invalid dataShards
          fc.integer({ min: 1, max: 10 }),   // Valid parityShards
          fc.integer({ min: 1, max: 1024 }), // Valid shardSize
          (dataShards, parityShards, shardSize) => {
            try {
              new ReedSolomonEncoder({
                dataShards,
                parityShards,
                shardSize
              });
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof ConfigurationError)) {
                return false;
              }
              // Error message should mention the parameter name
              const message = e.message.toLowerCase();
              return message.includes('datashards') || message.includes('positive');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ConfigurationError for invalid parityShards includes context', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),   // Valid dataShards
          fc.integer({ min: -100, max: 0 }), // Invalid parityShards
          fc.integer({ min: 1, max: 1024 }), // Valid shardSize
          (dataShards, parityShards, shardSize) => {
            try {
              new ReedSolomonEncoder({
                dataShards,
                parityShards,
                shardSize
              });
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof ConfigurationError)) {
                return false;
              }
              const message = e.message.toLowerCase();
              return message.includes('parityshards') || message.includes('positive');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ConfigurationError for exceeding field size includes actual values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 200, max: 300 }), // dataShards
          fc.integer({ min: 100, max: 200 }), // parityShards (total > 256)
          fc.integer({ min: 1, max: 1024 }),  // Valid shardSize
          (dataShards, parityShards, shardSize) => {
            try {
              new ReedSolomonEncoder({
                dataShards,
                parityShards,
                shardSize,
                field: GaloisField.GF256
              });
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof ConfigurationError)) {
                return false;
              }
              const message = e.message;
              // Message should include the total and the limit
              return message.includes(String(dataShards + parityShards)) && 
                     message.includes('256');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('InsufficientShardsError includes required and available counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Provide fewer than K shards
            const insufficientShards = encoded.dataShards
              .slice(0, K - 1)
              .map((data, i) => ({ index: i, data, isData: true }));
            
            try {
              decoder.decode(insufficientShards);
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof InsufficientShardsError)) {
                return false;
              }
              const message = e.message;
              // Message should include both required (K) and available (K-1) counts
              return message.includes(String(K)) && 
                     message.includes(String(K - 1));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('NativeError for invalid shard size includes shard index and sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Create shards with one having wrong size
            const shards = encoded.dataShards
              .slice(0, K)
              .map((data, i) => ({ 
                index: i, 
                data: i === 0 ? new Uint8Array(shardSize + 10) : data, // Wrong size for first shard
                isData: true 
              }));
            
            try {
              decoder.decode(shards);
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof NativeError)) {
                return false;
              }
              const message = e.message;
              // Message should include shard index and both actual and expected sizes
              return message.includes('0') && // shard index
                     message.includes(String(shardSize + 10)) && // actual size
                     message.includes(String(shardSize)); // expected size
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('NativeError for invalid shard index includes index and valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Create shards with invalid index
            const invalidIndex = K + M + 10;
            const shards = encoded.dataShards
              .slice(0, K)
              .map((data, i) => ({ 
                index: i === 0 ? invalidIndex : i, // Invalid index for first shard
                data, 
                isData: true 
              }));
            
            try {
              decoder.decode(shards);
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof NativeError)) {
                return false;
              }
              const message = e.message;
              // Message should include the invalid index and valid range
              return message.includes(String(invalidIndex)) && 
                     message.includes(String(K + M - 1));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('CorruptionError for hash validation includes shard index', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize,
              enableHashValidation: true
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize,
              enableHashValidation: true
            });
            
            // Create shards with corrupted data but valid hash from original
            const shards = encoded.dataShards
              .slice(0, K)
              .map((data, i) => {
                const corruptedData = new Uint8Array(data);
                if (i === 0) {
                  corruptedData[0] ^= 0xFF; // Corrupt first byte
                }
                return { 
                  index: i, 
                  data: corruptedData, 
                  isData: true,
                  hash: encoded.dataHashes![i] // Original hash
                };
              });
            
            try {
              decoder.decode(shards);
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof CorruptionError)) {
                return false;
              }
              const message = e.message;
              // Message should include shard index
              return message.includes('0') || message.includes('shard');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('All error types have error codes', () => {
      const errors = [
        new ConfigurationError('test'),
        new InsufficientShardsError(5, 3),
        new CorruptionError('test'),
        new NativeError('test')
      ];
      
      for (const error of errors) {
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
      }
    });

    test('Error messages are human-readable and actionable', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Test with data that's too large
            const tooLargeData = new Uint8Array(K * shardSize + 100);
            
            try {
              encoder.encode(tooLargeData);
              return false; // Should have thrown
            } catch (e) {
              if (!(e instanceof NativeError)) {
                return false;
              }
              const message = e.message;
              // Message should be descriptive and suggest a solution
              return message.length > 20 && // Not too short
                     (message.includes('exceeds') || message.includes('too large')) &&
                     (message.includes('increase') || message.includes('Consider'));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
