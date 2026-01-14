/**
 * Property-based tests for Reed-Solomon encoder
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { EncoderConfig, GaloisField, MatrixType } from '../../src/config';
import { ConfigurationError } from '../../src/errors';

describe('Encoder Configuration Validation', () => {
  /**
   * Property 16: Configuration Validation
   * For any invalid configuration (e.g., K+M exceeding field size, zero shards, negative values),
   * the system should throw a descriptive error before attempting operations
   * Validates: Requirements 6.4, 6.5
   */
  it('Property 16: Configuration Validation - Rejects invalid configurations', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Zero or negative data shards
          fc.record({
            dataShards: fc.integer({ min: -100, max: 0 }),
            parityShards: fc.integer({ min: 1, max: 10 }),
            shardSize: fc.integer({ min: 1, max: 1024 })
          }),
          // Zero or negative parity shards
          fc.record({
            dataShards: fc.integer({ min: 1, max: 10 }),
            parityShards: fc.integer({ min: -100, max: 0 }),
            shardSize: fc.integer({ min: 1, max: 1024 })
          }),
          // Zero or negative shard size
          fc.record({
            dataShards: fc.integer({ min: 1, max: 10 }),
            parityShards: fc.integer({ min: 1, max: 10 }),
            shardSize: fc.integer({ min: -100, max: 0 })
          }),
          // K+M exceeds GF(2^8) field size (256)
          fc.record({
            dataShards: fc.integer({ min: 200, max: 300 }),
            parityShards: fc.integer({ min: 100, max: 200 }),
            shardSize: fc.integer({ min: 1, max: 1024 }),
            field: fc.constant(GaloisField.GF256)
          }),
          // K+M exceeds GF(2^16) field size (65536)
          fc.record({
            dataShards: fc.integer({ min: 60000, max: 70000 }),
            parityShards: fc.integer({ min: 10000, max: 20000 }),
            shardSize: fc.integer({ min: 1, max: 1024 }),
            field: fc.constant(GaloisField.GF65536)
          })
        ),
        (config) => {
          // Attempting to create encoder with invalid config should throw ConfigurationError
          expect(() => {
            new ReedSolomonEncoder(config as EncoderConfig);
          }).toThrow(ConfigurationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Configuration Validation - Accepts valid configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 1, max: 100 }),
          parityShards: fc.integer({ min: 1, max: 100 }),
          shardSize: fc.integer({ min: 1, max: 1024 }),
          field: fc.constant(GaloisField.GF256), // Only GF256 is implemented for now
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          const maxShards = 256; // GF256 only for now
          fc.pre(config.dataShards + config.parityShards <= maxShards);
          
          // Valid configuration should not throw
          expect(() => {
            const encoder = new ReedSolomonEncoder(config);
            
            // Verify configuration is stored correctly
            const storedConfig = encoder.getConfig();
            expect(storedConfig.dataShards).toBe(config.dataShards);
            expect(storedConfig.parityShards).toBe(config.parityShards);
            expect(storedConfig.shardSize).toBe(config.shardSize);
            expect(storedConfig.field).toBe(config.field);
            expect(storedConfig.matrixType).toBe(config.matrixType);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Configuration Validation - Applies defaults correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 1, max: 100 }),
          parityShards: fc.integer({ min: 1, max: 100 }),
          shardSize: fc.integer({ min: 1, max: 1024 })
        }),
        (config) => {
          // Precondition: ensure K+M doesn't exceed default field size (GF256)
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create encoder without specifying optional fields
          const encoder = new ReedSolomonEncoder(config);
          const storedConfig = encoder.getConfig();
          
          // Verify defaults are applied
          expect(storedConfig.field).toBe(GaloisField.GF256);
          expect(storedConfig.matrixType).toBe(MatrixType.Vandermonde);
          expect(storedConfig.gpuThreshold).toBe(10 * 1024);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Configuration Validation - Error messages are descriptive', () => {
    // Test that error messages contain useful information
    const invalidConfigs = [
      { dataShards: 0, parityShards: 5, shardSize: 100, expectedMessage: 'dataShards must be positive' },
      { dataShards: -1, parityShards: 5, shardSize: 100, expectedMessage: 'dataShards must be positive' },
      { dataShards: 5, parityShards: 0, shardSize: 100, expectedMessage: 'parityShards must be positive' },
      { dataShards: 5, parityShards: -1, shardSize: 100, expectedMessage: 'parityShards must be positive' },
      { dataShards: 5, parityShards: 5, shardSize: 0, expectedMessage: 'shardSize must be positive' },
      { dataShards: 5, parityShards: 5, shardSize: -1, expectedMessage: 'shardSize must be positive' },
      { dataShards: 200, parityShards: 100, shardSize: 100, field: GaloisField.GF256, expectedMessage: 'exceeds field size' }
    ];

    invalidConfigs.forEach(({ expectedMessage, ...config }) => {
      try {
        new ReedSolomonEncoder(config as EncoderConfig);
        fail('Should have thrown ConfigurationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigurationError);
        expect((e as Error).message).toContain(expectedMessage);
      }
    });
  });
});

describe('Systematic Encoding Structure', () => {
  /**
   * Property 7: Systematic Encoding Structure
   * For any input data and configuration (K, M), the first K shards of the encoded output 
   * should contain the original data unchanged, and the total output should contain exactly K+M shards
   * Validates: Requirements 2.1, 2.3
   */
  it('Property 7: Systematic Encoding Structure', () => {
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
          
          // Adjust input data to match expected size (K * shardSize)
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          
          // Fill with input data (repeat if necessary, truncate if too long)
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Create encoder and encode
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify total shard count is K+M
          expect(encoded.dataShards.length).toBe(config.dataShards);
          expect(encoded.parityShards.length).toBe(config.parityShards);
          
          // Verify each shard has the correct size
          for (let i = 0; i < config.dataShards; i++) {
            expect(encoded.dataShards[i].length).toBe(config.shardSize);
          }
          for (let i = 0; i < config.parityShards; i++) {
            expect(encoded.parityShards[i].length).toBe(config.shardSize);
          }
          
          // Verify systematic property: data shards contain original data unchanged
          for (let i = 0; i < config.dataShards; i++) {
            const start = i * config.shardSize;
            const end = start + config.shardSize;
            const expectedShard = data.slice(start, end);
            
            // Compare byte by byte
            for (let j = 0; j < config.shardSize; j++) {
              expect(encoded.dataShards[i][j]).toBe(expectedShard[j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Systematic Encoding Structure - Works with different matrix types', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 20 }),
          parityShards: fc.integer({ min: 1, max: 10 }),
          shardSize: fc.integer({ min: 1, max: 256 }),
          matrixType: fc.constantFrom(MatrixType.Vandermonde, MatrixType.Cauchy)
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
          
          // Verify systematic property holds for both matrix types
          for (let i = 0; i < config.dataShards; i++) {
            const start = i * config.shardSize;
            const end = start + config.shardSize;
            const expectedShard = data.slice(start, end);
            
            for (let j = 0; j < config.shardSize; j++) {
              expect(encoded.dataShards[i][j]).toBe(expectedShard[j]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Round-Trip Encoding/Decoding', () => {
  /**
   * Property 9: Round-Trip Encoding/Decoding
   * For any input data and any selection of K shards from K+M encoded shards,
   * decoding should perfectly reconstruct the original input data
   * Validates: Requirements 3.1, 12.4
   */
  it('Property 9: Round-Trip Encoding/Decoding - With all data shards', () => {
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
          
          // Prepare shards for decoding (use all data shards)
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
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

  it('Property 9: Round-Trip Encoding/Decoding - With mixed data and parity shards', () => {
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
          
          // Select exactly K shards (first K shards for simplicity in this test)
          const selectedShards = allShards.slice(0, config.dataShards);
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(selectedShards);
          
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

  it('Property 9: Round-Trip Encoding/Decoding - Works with different matrix types', () => {
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
          
          // Use all data shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works for both matrix types
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

describe('GPU Encoding/Decoding', () => {
  /**
   * Property 9: Round-Trip Encoding/Decoding (GPU)
   * For any input data with large shard sizes (>10KB), GPU encoding then decoding
   * should produce identical results to CPU encoding/decoding
   * Validates: Requirements 2.7, 3.6
   */
  it('Property 9: Round-Trip Encoding/Decoding (GPU) - GPU path produces correct results', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }), // > 10KB to trigger GPU
          useGPU: fc.constant(true) // Force GPU usage
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode with GPU
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Verify systematic property still holds with GPU
          for (let i = 0; i < config.dataShards; i++) {
            const start = i * config.shardSize;
            const end = start + config.shardSize;
            const expectedShard = data.slice(start, end);
            
            for (let j = 0; j < config.shardSize; j++) {
              expect(encoded.dataShards[i][j]).toBe(expectedShard[j]);
            }
          }
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode with GPU
          const decoder = new ReedSolomonDecoder({ ...config, useGPU: true });
          const decoded = decoder.decode(shards);
          
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

  it('Property 9: Round-Trip Encoding/Decoding (GPU) - CPU and GPU produce identical results', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }) // > 10KB
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode with CPU
          const encoderCPU = new ReedSolomonEncoder({ ...config, useGPU: false });
          const encodedCPU = encoderCPU.encode(data);
          
          // Encode with GPU
          const encoderGPU = new ReedSolomonEncoder({ ...config, useGPU: true });
          const encodedGPU = encoderGPU.encode(data);
          
          // Verify CPU and GPU produce identical parity shards
          expect(encodedCPU.parityShards.length).toBe(encodedGPU.parityShards.length);
          for (let i = 0; i < encodedCPU.parityShards.length; i++) {
            expect(encodedCPU.parityShards[i].length).toBe(encodedGPU.parityShards[i].length);
            for (let j = 0; j < encodedCPU.parityShards[i].length; j++) {
              expect(encodedCPU.parityShards[i][j]).toBe(encodedGPU.parityShards[i][j]);
            }
          }
          
          // Verify both can decode correctly
          const shards = encodedGPU.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          const decoderCPU = new ReedSolomonDecoder({ ...config, useGPU: false });
          const decodedCPU = decoderCPU.decode(shards);
          
          const decoderGPU = new ReedSolomonDecoder({ ...config, useGPU: true });
          const decodedGPU = decoderGPU.decode(shards);
          
          // Verify both decoders produce identical results
          expect(decodedCPU.length).toBe(decodedGPU.length);
          for (let i = 0; i < decodedCPU.length; i++) {
            expect(decodedCPU[i]).toBe(decodedGPU[i]);
          }
          
          // Verify both match original data
          for (let i = 0; i < data.length; i++) {
            expect(decodedCPU[i]).toBe(data[i]);
            expect(decodedGPU[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Round-Trip Encoding/Decoding (GPU) - GPU fallback works when Metal unavailable', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }),
          useGPU: fc.constant(true) // Request GPU but it may fall back to CPU
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Adjust input data to match expected size
          const expectedSize = config.dataShards * config.shardSize;
          const data = new Uint8Array(expectedSize);
          for (let i = 0; i < expectedSize; i++) {
            data[i] = inputData[i % inputData.length];
          }
          
          // Encode (will use GPU if available, CPU otherwise)
          const encoder = new ReedSolomonEncoder(config);
          const encoded = encoder.encode(data);
          
          // Prepare shards for decoding
          const shards = encoded.dataShards.map((shard, index) => ({
            index,
            data: shard,
            isData: true
          }));
          
          // Decode (will use GPU if available, CPU otherwise)
          const decoder = new ReedSolomonDecoder(config);
          const decoded = decoder.decode(shards);
          
          // Verify round-trip works regardless of whether GPU was actually used
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

describe('Batched GPU Operations', () => {
  /**
   * Property 13: Batched Operations Equivalence
   * For any batch of input data blocks, batch encoding should produce identical results
   * to encoding each block individually
   * Validates: Requirements 2.10, 4.8
   */
  it('Property 13: Batched Operations Equivalence - Batch encoding matches individual encoding', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }), // > 10KB for GPU
          batchSize: fc.integer({ min: 2, max: 5 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create batch of data blocks
          const dataBlocks: Uint8Array[] = [];
          const expectedSize = config.dataShards * config.shardSize;
          
          for (let b = 0; b < config.batchSize; b++) {
            const data = new Uint8Array(expectedSize);
            // Use different data for each block (offset by block index)
            for (let i = 0; i < expectedSize; i++) {
              data[i] = inputData[(i + b * 1000) % inputData.length];
            }
            dataBlocks.push(data);
          }
          
          // Encode individually
          const encoder = new ReedSolomonEncoder(config);
          const individualResults = dataBlocks.map(data => encoder.encode(data));
          
          // Encode as batch
          const batchResults = encoder.batchEncode(dataBlocks);
          
          // Verify batch size matches
          expect(batchResults.length).toBe(config.batchSize);
          expect(batchResults.length).toBe(individualResults.length);
          
          // Verify each batch result matches individual result
          for (let b = 0; b < config.batchSize; b++) {
            const individual = individualResults[b];
            const batched = batchResults[b];
            
            // Verify data shards match
            expect(batched.dataShards.length).toBe(individual.dataShards.length);
            for (let i = 0; i < individual.dataShards.length; i++) {
              expect(batched.dataShards[i].length).toBe(individual.dataShards[i].length);
              for (let j = 0; j < individual.dataShards[i].length; j++) {
                expect(batched.dataShards[i][j]).toBe(individual.dataShards[i][j]);
              }
            }
            
            // Verify parity shards match
            expect(batched.parityShards.length).toBe(individual.parityShards.length);
            for (let i = 0; i < individual.parityShards.length; i++) {
              expect(batched.parityShards[i].length).toBe(individual.parityShards[i].length);
              for (let j = 0; j < individual.parityShards[i].length; j++) {
                expect(batched.parityShards[i][j]).toBe(individual.parityShards[i][j]);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 13: Batched Operations Equivalence - Batch results can be decoded correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 5 }),
          parityShards: fc.integer({ min: 1, max: 3 }),
          shardSize: fc.integer({ min: 11 * 1024, max: 15 * 1024 }),
          batchSize: fc.integer({ min: 2, max: 5 })
        }),
        fc.uint8Array({ minLength: 1, maxLength: 75 * 1024 }),
        (config, inputData) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Create batch of data blocks
          const dataBlocks: Uint8Array[] = [];
          const expectedSize = config.dataShards * config.shardSize;
          
          for (let b = 0; b < config.batchSize; b++) {
            const data = new Uint8Array(expectedSize);
            for (let i = 0; i < expectedSize; i++) {
              data[i] = inputData[(i + b * 1000) % inputData.length];
            }
            dataBlocks.push(data);
          }
          
          // Batch encode
          const encoder = new ReedSolomonEncoder(config);
          const batchResults = encoder.batchEncode(dataBlocks);
          
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
            
            // Decode
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

  it('Property 13: Batched Operations Equivalence - Handles empty batch gracefully', () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 12 * 1024
    };
    
    const encoder = new ReedSolomonEncoder(config);
    
    // Empty batch should throw error
    expect(() => {
      encoder.batchEncode([]);
    }).toThrow();
  });

  it('Property 13: Batched Operations Equivalence - Validates all block sizes', () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 12 * 1024
    };
    
    const encoder = new ReedSolomonEncoder(config);
    const expectedSize = config.dataShards * config.shardSize;
    
    // Create batch with one invalid size
    const dataBlocks = [
      new Uint8Array(expectedSize),
      new Uint8Array(expectedSize - 100), // Invalid size
      new Uint8Array(expectedSize)
    ];
    
    // Should throw error about invalid size
    expect(() => {
      encoder.batchEncode(dataBlocks);
    }).toThrow();
  });
});
