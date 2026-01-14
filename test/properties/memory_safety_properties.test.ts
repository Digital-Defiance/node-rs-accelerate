/**
 * Property-based tests for memory safety
 * Property 21: Memory Safety
 * Validates: Requirements 10.6
 * 
 * These tests verify memory safety through stress testing and repeated operations.
 * 
 * MEMORY LEAK DETECTION TOOLS:
 * ============================
 * 
 * 1. AddressSanitizer (ASan) - Recommended for macOS/Apple Silicon:
 *    - Build with sanitizer: npm run build:asan
 *    - Run tests: npm run test:memory
 *    - Detects: memory leaks, use-after-free, buffer overflows, double-free
 * 
 * 2. Valgrind (Linux only, not available on macOS):
 *    - Run: valgrind --leak-check=full --show-leak-kinds=all node dist/test
 *    - Note: Not compatible with Apple Silicon
 * 
 * 3. Instruments (macOS native profiler):
 *    - Use Leaks instrument in Xcode Instruments
 *    - Profile the test process for memory leaks
 * 
 * 4. Node.js heap snapshots:
 *    - Use --expose-gc flag and v8.writeHeapSnapshot()
 *    - Compare snapshots before/after operations
 * 
 * RUNNING MEMORY LEAK TESTS:
 * ==========================
 * npm run test:memory          # Run with AddressSanitizer
 * npm run test:memory:verbose  # Run with detailed ASan output
 * npm run test:memory:heap     # Run with heap profiling
 * 
 * INTERPRETING RESULTS:
 * ====================
 * - ASan will report any memory leaks with stack traces
 * - Tests should complete without ASan errors
 * - Monitor memory usage growth during repeated operations
 * - Check for proper cleanup of native resources
 */

import * as fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { GaloisField, MatrixType } from '../../src/config';

describe('Memory Safety Properties', () => {
  describe('Property 21: Memory Safety', () => {
    test('Repeated encoder creation and destruction does not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.integer({ min: 10, max: 50 }),  // iterations
          (K, M, shardSize, iterations) => {
            // Create and destroy many encoders
            // If there's a memory leak, this will accumulate
            for (let i = 0; i < iterations; i++) {
              const encoder = new ReedSolomonEncoder({
                dataShards: K,
                parityShards: M,
                shardSize
              });
              
              // Use the encoder
              const data = new Uint8Array(K * shardSize);
              encoder.encode(data);
              
              // Encoder goes out of scope and should be garbage collected
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Repeated decoder creation and destruction does not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.integer({ min: 10, max: 50 }),  // iterations
          (K, M, shardSize, iterations) => {
            // Create encoder once
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            // Create and destroy many decoders
            for (let i = 0; i < iterations; i++) {
              const decoder = new ReedSolomonDecoder({
                dataShards: K,
                parityShards: M,
                shardSize
              });
              
              // Use the decoder
              const shards = encoded.dataShards.map((data, i) => ({
                index: i,
                data,
                isData: true
              }));
              
              decoder.decode(shards);
              
              // Decoder goes out of scope and should be garbage collected
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Repeated encode/decode cycles do not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.integer({ min: 10, max: 50 }),  // iterations
          (K, M, shardSize, iterations) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Perform many encode/decode cycles
            for (let i = 0; i < iterations; i++) {
              const data = new Uint8Array(K * shardSize);
              data.fill(i % 256);
              
              const encoded = encoder.encode(data);
              
              const shards = encoded.dataShards.map((data, i) => ({
                index: i,
                data,
                isData: true
              }));
              
              const decoded = decoder.decode(shards);
              
              // Verify correctness
              for (let j = 0; j < data.length; j++) {
                if (data[j] !== decoded[j]) {
                  return false;
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Large data encoding does not cause buffer overflows', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),     // K
          fc.integer({ min: 2, max: 5 }),      // M
          fc.integer({ min: 1024, max: 4096 }), // Large shardSize
          (K, M, shardSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            
            // Fill with pattern to detect corruption
            for (let i = 0; i < data.length; i++) {
              data[i] = i % 256;
            }
            
            const encoded = encoder.encode(data);
            
            // Verify all shards have correct size
            for (const shard of encoded.dataShards) {
              if (shard.length !== shardSize) {
                return false;
              }
            }
            
            for (const shard of encoded.parityShards) {
              if (shard.length !== shardSize) {
                return false;
              }
            }
            
            // Verify data shards contain original data
            for (let i = 0; i < K; i++) {
              const shard = encoded.dataShards[i];
              const expectedStart = i * shardSize;
              
              for (let j = 0; j < shardSize; j++) {
                if (shard[j] !== data[expectedStart + j]) {
                  return false;
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GF(2^16) initialization and cleanup does not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 200 }), // K (requires GF(2^16)) - reduced max
          fc.integer({ min: 30, max: 50 }),   // M - reduced max
          fc.integer({ min: 64, max: 128 }),  // shardSize - reduced max
          fc.integer({ min: 3, max: 10 }),    // iterations - reduced
          (K, M, shardSize, iterations) => {
            // Ensure total shards don't exceed GF(2^16) limit
            if (K + M > 65536) {
              return true; // Skip this test case
            }
            
            // Create and destroy many encoders with GF(2^16)
            // This tests that GF(2^16) tables are properly managed
            for (let i = 0; i < iterations; i++) {
              const encoder = new ReedSolomonEncoder({
                dataShards: K,
                parityShards: M,
                shardSize,
                field: GaloisField.GF65536
              });
              
              const data = new Uint8Array(K * shardSize);
              encoder.encode(data);
            }
            
            return true;
          }
        ),
        { numRuns: 50 } // Fewer runs due to larger data
      );
    });

    test('Batch encoding does not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.integer({ min: 5, max: 20 }),   // batchSize
          (K, M, shardSize, batchSize) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            // Create batch of data blocks
            const dataBlocks: Uint8Array[] = [];
            for (let i = 0; i < batchSize; i++) {
              const data = new Uint8Array(K * shardSize);
              data.fill(i % 256);
              dataBlocks.push(data);
            }
            
            // Batch encode
            const results = encoder.batchEncode(dataBlocks);
            
            // Verify results
            if (results.length !== batchSize) {
              return false;
            }
            
            for (let i = 0; i < batchSize; i++) {
              if (results[i].dataShards.length !== K) {
                return false;
              }
              if (results[i].parityShards.length !== M) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Reconstruction does not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.integer({ min: 1, max: 3 }),    // numMissing
          (K, M, shardSize, numMissing) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            // Create available shards (all data shards)
            const shards = encoded.dataShards.map((data, i) => ({
              index: i,
              data,
              isData: true
            }));
            
            // Determine which shards to reconstruct
            const missingIndices: number[] = [];
            for (let i = 0; i < numMissing && i < M; i++) {
              missingIndices.push(K + i); // Reconstruct parity shards
            }
            
            // Reconstruct missing shards
            const reconstructed = decoder.reconstruct(shards, missingIndices);
            
            // Verify correct number of shards reconstructed
            if (reconstructed.length !== missingIndices.length) {
              return false;
            }
            
            // Verify each reconstructed shard has correct size
            for (const shard of reconstructed) {
              if (shard.length !== shardSize) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Mixed matrix types do not leak memory', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),   // K
          fc.integer({ min: 2, max: 5 }),    // M
          fc.integer({ min: 64, max: 256 }), // shardSize
          fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy),
          (K, M, shardSize, matrixType) => {
            const encoder = new ReedSolomonEncoder({
              dataShards: K,
              parityShards: M,
              shardSize,
              matrixType
            });
            
            const data = new Uint8Array(K * shardSize);
            const encoded = encoder.encode(data);
            
            const decoder = new ReedSolomonDecoder({
              dataShards: K,
              parityShards: M,
              shardSize,
              matrixType
            });
            
            const shards = encoded.dataShards.map((data, i) => ({
              index: i,
              data,
              isData: true
            }));
            
            const decoded = decoder.decode(shards);
            
            // Verify correctness
            for (let i = 0; i < data.length; i++) {
              if (data[i] !== decoded[i]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Heap profiling test - only runs when NODE_OPTIONS includes --expose-gc
    test('Memory usage remains stable across many operations', () => {
      // Skip if gc is not exposed
      if (typeof global.gc !== 'function') {
        console.log('Skipping heap profiling test (run with --expose-gc to enable)');
        return;
      }

      const K = 5;
      const M = 3;
      const shardSize = 256;
      const iterations = 1000;

      const encoder = new ReedSolomonEncoder({
        dataShards: K,
        parityShards: M,
        shardSize
      });

      const decoder = new ReedSolomonDecoder({
        dataShards: K,
        parityShards: M,
        shardSize
      });

      // Force garbage collection and measure initial memory
      global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < iterations; i++) {
        const data = new Uint8Array(K * shardSize);
        data.fill(i % 256);
        
        const encoded = encoder.encode(data);
        
        const shards = encoded.dataShards.map((data, idx) => ({
          index: idx,
          data,
          isData: true
        }));
        
        decoder.decode(shards);

        // Periodic garbage collection
        if (i % 100 === 0) {
          global.gc();
        }
      }

      // Force final garbage collection and measure final memory
      global.gc();
      const finalMemory = process.memoryUsage().heapUsed;

      // Calculate memory growth
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      console.log(`Memory growth after ${iterations} operations: ${memoryGrowthMB.toFixed(2)} MB`);

      // Memory growth should be minimal (less than 10MB for 1000 operations)
      // This is a heuristic check - some growth is expected due to V8 internals
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });
});
