/**
 * Property-based tests for streaming API
 * Feature: node-rs-accelerate
 */

import fc from 'fast-check';
import { Readable, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import { ReedSolomonEncoder, ReedSolomonDecoder } from '../../src';
import { StreamingEncoder, StreamingDecoder } from '../../src/streaming';
import { EncoderConfig, DecoderConfig } from '../../src/config';

const pipelineAsync = promisify(pipeline);

/**
 * Helper function to collect stream output into a buffer
 */
function collectStreamData(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Helper function to collect stream objects into an array
 */
function collectStreamObjects<T>(stream: Readable): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const objects: T[] = [];
    stream.on('data', (obj) => objects.push(obj));
    stream.on('end', () => resolve(objects));
    stream.on('error', reject);
  });
}

describe('Streaming Equivalence', () => {
  /**
   * Property 14: Streaming Equivalence
   * For any input data, streaming encoding/decoding should produce identical results
   * to batch processing the entire input at once
   * Validates: Requirements 7.1, 7.2, 7.4
   */
  it('Property 14: Streaming Equivalence - Streaming encoder produces same results as batch encoder', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 16, max: 128 }),
          numChunks: fc.integer({ min: 1, max: 4 })
        }),
        async (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Calculate chunk size and create data
          const chunkSize = config.dataShards * config.shardSize;
          const adjustedLength = config.numChunks * chunkSize;
          
          // Generate data of exact size needed
          const data = new Uint8Array(adjustedLength);
          for (let i = 0; i < adjustedLength; i++) {
            data[i] = i % 256;
          }
          
          const numChunks = config.numChunks;
          
          // Batch encoding: encode each chunk individually
          const encoder = new ReedSolomonEncoder(config);
          const batchResults: any[] = [];
          
          for (let i = 0; i < numChunks; i++) {
            const start = i * chunkSize;
            const end = start + chunkSize;
            const chunk = data.slice(start, end);
            const encoded = encoder.encode(chunk);
            batchResults.push({
              ...encoded,
              chunkIndex: i
            });
          }
          
          // Streaming encoding
          const streamingEncoder = new StreamingEncoder(config);
          const inputStream = Readable.from([Buffer.from(data)]);
          
          const streamResults = await collectStreamObjects<any>(
            inputStream.pipe(streamingEncoder)
          );
          
          // Verify same number of chunks
          expect(streamResults.length).toBe(batchResults.length);
          
          // Verify each chunk matches
          for (let i = 0; i < batchResults.length; i++) {
            const batch = batchResults[i];
            const stream = streamResults[i];
            
            // Verify data shards match
            expect(stream.dataShards.length).toBe(batch.dataShards.length);
            for (let j = 0; j < batch.dataShards.length; j++) {
              expect(stream.dataShards[j].length).toBe(batch.dataShards[j].length);
              for (let k = 0; k < batch.dataShards[j].length; k++) {
                expect(stream.dataShards[j][k]).toBe(batch.dataShards[j][k]);
              }
            }
            
            // Verify parity shards match
            expect(stream.parityShards.length).toBe(batch.parityShards.length);
            for (let j = 0; j < batch.parityShards.length; j++) {
              expect(stream.parityShards[j].length).toBe(batch.parityShards[j].length);
              for (let k = 0; k < batch.parityShards[j].length; k++) {
                expect(stream.parityShards[j][k]).toBe(batch.parityShards[j][k]);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Streaming Equivalence - Streaming decoder produces same results as batch decoder', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 16, max: 128 }),
          numChunks: fc.integer({ min: 1, max: 4 })
        }),
        async (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Calculate chunk size and create data
          const chunkSize = config.dataShards * config.shardSize;
          const adjustedLength = config.numChunks * chunkSize;
          
          // Generate data of exact size needed
          const data = new Uint8Array(adjustedLength);
          for (let i = 0; i < adjustedLength; i++) {
            data[i] = i % 256;
          }
          
          const numChunks = config.numChunks;
          
          // First encode the data
          const encoder = new ReedSolomonEncoder(config);
          const encodedChunks: any[] = [];
          
          for (let i = 0; i < numChunks; i++) {
            const start = i * chunkSize;
            const end = start + chunkSize;
            const chunk = data.slice(start, end);
            const encoded = encoder.encode(chunk);
            encodedChunks.push({
              ...encoded,
              chunkIndex: i
            });
          }
          
          // Batch decoding
          const decoder = new ReedSolomonDecoder(config);
          const batchDecodedChunks: Uint8Array[] = [];
          
          for (const encoded of encodedChunks) {
            const shards = encoded.dataShards.map((shard: Uint8Array, index: number) => ({
              index,
              data: shard,
              isData: true
            }));
            const decoded = decoder.decode(shards);
            batchDecodedChunks.push(decoded);
          }
          
          const batchDecoded = Buffer.concat(batchDecodedChunks.map(d => Buffer.from(d)));
          
          // Streaming decoding
          const streamingDecoder = new StreamingDecoder(config);
          const encodedStream = Readable.from(encodedChunks);
          
          const streamDecoded = await collectStreamData(
            encodedStream.pipe(streamingDecoder)
          );
          
          // Verify streaming and batch decoding produce identical results
          expect(streamDecoded.length).toBe(batchDecoded.length);
          for (let i = 0; i < batchDecoded.length; i++) {
            expect(streamDecoded[i]).toBe(batchDecoded[i]);
          }
          
          // Verify both match original data
          for (let i = 0; i < data.length; i++) {
            expect(batchDecoded[i]).toBe(data[i]);
            expect(streamDecoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Streaming Equivalence - Round-trip streaming encoding/decoding', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 10 }),
          parityShards: fc.integer({ min: 1, max: 5 }),
          shardSize: fc.integer({ min: 16, max: 128 }),
          numChunks: fc.integer({ min: 1, max: 4 })
        }),
        async (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Calculate chunk size and create data
          const chunkSize = config.dataShards * config.shardSize;
          const adjustedLength = config.numChunks * chunkSize;
          
          // Generate data of exact size needed
          const data = new Uint8Array(adjustedLength);
          for (let i = 0; i < adjustedLength; i++) {
            data[i] = i % 256;
          }
          
          // Create streaming encoder and decoder
          const streamingEncoder = new StreamingEncoder(config);
          const streamingDecoder = new StreamingDecoder(config);
          
          // Create input stream
          const inputStream = Readable.from([Buffer.from(data)]);
          
          // Pipe through encoder and decoder
          const outputStream = inputStream
            .pipe(streamingEncoder)
            .pipe(streamingDecoder);
          
          const decoded = await collectStreamData(outputStream);
          
          // Verify round-trip: decoded should match original
          expect(decoded.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(decoded[i]).toBe(data[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Streaming Equivalence - Handles multiple small chunks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 8 }),
          parityShards: fc.integer({ min: 1, max: 4 }),
          shardSize: fc.integer({ min: 16, max: 64 }),
          numChunks: fc.integer({ min: 2, max: 4 }),
          numInputChunks: fc.integer({ min: 2, max: 10 })
        }),
        async (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Calculate chunk size and create data
          const chunkSize = config.dataShards * config.shardSize;
          const adjustedLength = config.numChunks * chunkSize;
          
          // Generate data of exact size needed
          const data = new Uint8Array(adjustedLength);
          for (let i = 0; i < adjustedLength; i++) {
            data[i] = i % 256;
          }
          
          const numInputChunks = config.numInputChunks;
          
          // Split input data into multiple small chunks
          const inputChunks: Buffer[] = [];
          const inputChunkSize = Math.ceil(data.length / numInputChunks);
          
          for (let i = 0; i < data.length; i += inputChunkSize) {
            const end = Math.min(i + inputChunkSize, data.length);
            inputChunks.push(Buffer.from(data.slice(i, end)));
          }
          
          // Create streaming encoder
          const streamingEncoder = new StreamingEncoder(config);
          const inputStream = Readable.from(inputChunks);
          
          const encodedChunks = await collectStreamObjects<any>(
            inputStream.pipe(streamingEncoder)
          );
          
          // Verify we got the expected number of encoded chunks
          expect(encodedChunks.length).toBe(config.numChunks);
          
          // Decode and verify
          const streamingDecoder = new StreamingDecoder(config);
          const encodedStream = Readable.from(encodedChunks);
          
          const decoded = await collectStreamData(
            encodedStream.pipe(streamingDecoder)
          );
          
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

  it('Property 14: Streaming Equivalence - Handles padding for incomplete final chunk', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataShards: fc.integer({ min: 2, max: 8 }),
          parityShards: fc.integer({ min: 1, max: 4 }),
          shardSize: fc.integer({ min: 16, max: 64 }),
          numCompleteChunks: fc.integer({ min: 1, max: 3 }),
          extraBytes: fc.integer({ min: 1, max: 100 })
        }),
        async (config) => {
          // Precondition: ensure K+M doesn't exceed field size
          fc.pre(config.dataShards + config.parityShards <= 256);
          
          // Calculate chunk size
          const chunkSize = config.dataShards * config.shardSize;
          
          // Ensure extra bytes don't exceed chunk size
          fc.pre(config.extraBytes < chunkSize);
          
          // Create data with incomplete final chunk
          const dataLength = config.numCompleteChunks * chunkSize + config.extraBytes;
          const data = new Uint8Array(dataLength);
          for (let i = 0; i < dataLength; i++) {
            data[i] = i % 256;
          }
          
          // Stream encode with padding
          const streamingEncoder = new StreamingEncoder(config);
          const inputStream = Readable.from([Buffer.from(data)]);
          
          const encodedChunks = await collectStreamObjects<any>(
            inputStream.pipe(streamingEncoder)
          );
          
          // Verify final chunk is marked
          const finalChunk = encodedChunks[encodedChunks.length - 1];
          expect(finalChunk.isFinal).toBe(true);
          expect(finalChunk.paddedBytes).toBeGreaterThan(0);
          
          // Decode and verify padding is removed
          const streamingDecoder = new StreamingDecoder(config);
          const encodedStream = Readable.from(encodedChunks);
          
          const decoded = await collectStreamData(
            encodedStream.pipe(streamingDecoder)
          );
          
          // Verify decoded length matches original (padding removed)
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

describe('Streaming State Management', () => {
  it('Property 14: Streaming maintains state across chunks', async () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 32
    };
    
    const chunkSize = config.dataShards * config.shardSize;
    const data = new Uint8Array(chunkSize * 3); // 3 complete chunks
    
    // Fill with test data
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    
    // Create encoder and track state
    const streamingEncoder = new StreamingEncoder(config);
    
    // Verify initial state
    expect(streamingEncoder.getChunkIndex()).toBe(0);
    expect(streamingEncoder.getBufferSize()).toBe(0);
    
    // Feed data in small chunks
    const inputChunks = [
      data.slice(0, chunkSize),
      data.slice(chunkSize, chunkSize * 2),
      data.slice(chunkSize * 2)
    ];
    
    const inputStream = Readable.from(inputChunks.map(c => Buffer.from(c)));
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(streamingEncoder)
    );
    
    // Verify we got 3 encoded chunks
    expect(encodedChunks.length).toBe(3);
    
    // Verify chunk indices are sequential
    for (let i = 0; i < encodedChunks.length; i++) {
      expect(encodedChunks[i].chunkIndex).toBe(i);
    }
  });

  it('Property 14: Streaming decoder maintains state across chunks', async () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 32
    };
    
    const chunkSize = config.dataShards * config.shardSize;
    const data = new Uint8Array(chunkSize * 2); // 2 complete chunks
    
    // Fill with test data
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    
    // Encode first
    const encoder = new ReedSolomonEncoder(config);
    const encodedChunks = [
      { ...encoder.encode(data.slice(0, chunkSize)), chunkIndex: 0 },
      { ...encoder.encode(data.slice(chunkSize)), chunkIndex: 1 }
    ];
    
    // Create decoder and track state
    const streamingDecoder = new StreamingDecoder(config);
    
    // Verify initial state
    expect(streamingDecoder.getCurrentChunkIndex()).toBe(0);
    expect(streamingDecoder.getBufferedChunkCount()).toBe(0);
    
    // Decode
    const encodedStream = Readable.from(encodedChunks);
    const decoded = await collectStreamData(
      encodedStream.pipe(streamingDecoder)
    );
    
    // Verify round-trip
    expect(decoded.length).toBe(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(decoded[i]).toBe(data[i]);
    }
  });
});
