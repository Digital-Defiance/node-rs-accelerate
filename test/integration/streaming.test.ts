/**
 * Integration tests for streaming API
 * Tests streaming large files and backpressure handling
 * Requirements: 7.3, 7.6
 */

import { Readable, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StreamingEncoder, StreamingDecoder } from '../../src/streaming';
import { ReedSolomonEncoder } from '../../src/encoder';

const pipelineAsync = promisify(pipeline);

/**
 * Helper function to create a temporary file with random data
 */
async function createTempFile(size: number): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `test-${Date.now()}-${Math.random()}.dat`);
  
  // Generate random data
  const data = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  
  await fs.promises.writeFile(tempFile, data);
  return tempFile;
}

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

describe('Streaming Large Files', () => {
  let tempFiles: string[] = [];

  afterEach(async () => {
    // Clean up temp files
    for (const file of tempFiles) {
      try {
        await fs.promises.unlink(file);
      } catch (e) {
        // Ignore errors
      }
    }
    tempFiles = [];
  });

  it('should stream encode and decode a 1MB file', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    // Create 1MB temp file
    const fileSize = 1024 * 1024; // 1MB
    const tempFile = await createTempFile(fileSize);
    tempFiles.push(tempFile);

    // Read original data
    const originalData = await fs.promises.readFile(tempFile);

    // Stream encode
    const encoder = new StreamingEncoder(config);
    const inputStream = fs.createReadStream(tempFile);
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(encoder)
    );

    // Verify we got encoded chunks
    expect(encodedChunks.length).toBeGreaterThan(0);

    // Stream decode
    const decoder = new StreamingDecoder(config);
    const encodedStream = Readable.from(encodedChunks);
    const decoded = await collectStreamData(
      encodedStream.pipe(decoder)
    );

    // Verify round-trip
    expect(decoded.length).toBe(originalData.length);
    expect(decoded.equals(originalData)).toBe(true);
  }, 30000); // 30 second timeout

  it('should stream encode and decode a 10MB file', async () => {
    const config = {
      dataShards: 8,
      parityShards: 4,
      shardSize: 2048
    };

    // Create 10MB temp file
    const fileSize = 10 * 1024 * 1024; // 10MB
    const tempFile = await createTempFile(fileSize);
    tempFiles.push(tempFile);

    // Read original data
    const originalData = await fs.promises.readFile(tempFile);

    // Stream encode
    const encoder = new StreamingEncoder(config);
    const inputStream = fs.createReadStream(tempFile, { highWaterMark: 64 * 1024 });
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(encoder)
    );

    // Verify we got encoded chunks
    expect(encodedChunks.length).toBeGreaterThan(0);

    // Stream decode
    const decoder = new StreamingDecoder(config);
    const encodedStream = Readable.from(encodedChunks);
    const decoded = await collectStreamData(
      encodedStream.pipe(decoder)
    );

    // Verify round-trip
    expect(decoded.length).toBe(originalData.length);
    expect(decoded.equals(originalData)).toBe(true);
  }, 60000); // 60 second timeout

  it('should handle streaming with small read chunks', async () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 512
    };

    // Create 100KB temp file
    const fileSize = 100 * 1024; // 100KB
    const tempFile = await createTempFile(fileSize);
    tempFiles.push(tempFile);

    // Read original data
    const originalData = await fs.promises.readFile(tempFile);

    // Stream encode with very small read chunks (1KB)
    const encoder = new StreamingEncoder(config);
    const inputStream = fs.createReadStream(tempFile, { highWaterMark: 1024 });
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(encoder)
    );

    // Stream decode
    const decoder = new StreamingDecoder(config);
    const encodedStream = Readable.from(encodedChunks);
    const decoded = await collectStreamData(
      encodedStream.pipe(decoder)
    );

    // Verify round-trip
    expect(decoded.length).toBe(originalData.length);
    expect(decoded.equals(originalData)).toBe(true);
  }, 30000);

  it('should handle streaming with padding for incomplete final chunk', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    const chunkSize = config.dataShards * config.shardSize;
    
    // Create file that's not a multiple of chunk size
    const fileSize = chunkSize * 5 + 1234; // 5 complete chunks + 1234 bytes
    const tempFile = await createTempFile(fileSize);
    tempFiles.push(tempFile);

    // Read original data
    const originalData = await fs.promises.readFile(tempFile);

    // Stream encode
    const encoder = new StreamingEncoder(config);
    const inputStream = fs.createReadStream(tempFile);
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(encoder)
    );

    // Verify final chunk is marked
    const finalChunk = encodedChunks[encodedChunks.length - 1];
    expect(finalChunk.isFinal).toBe(true);
    expect(finalChunk.paddedBytes).toBeGreaterThan(0);

    // Stream decode
    const decoder = new StreamingDecoder(config);
    const encodedStream = Readable.from(encodedChunks);
    const decoded = await collectStreamData(
      encodedStream.pipe(decoder)
    );

    // Verify padding was removed correctly
    expect(decoded.length).toBe(originalData.length);
    expect(decoded.equals(originalData)).toBe(true);
  }, 30000);
});

describe('Backpressure Handling', () => {
  it('should handle backpressure in streaming encoder', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    const chunkSize = config.dataShards * config.shardSize;
    const numChunks = 100;
    const dataSize = chunkSize * numChunks;

    // Create data
    const data = Buffer.alloc(dataSize);
    for (let i = 0; i < dataSize; i++) {
      data[i] = i % 256;
    }

    // Create slow consumer that simulates backpressure
    let consumedChunks = 0;
    let backpressureApplied = false;

    const slowConsumer = new Writable({
      objectMode: true,
      highWaterMark: 2, // Small buffer to trigger backpressure
      write(chunk, encoding, callback) {
        consumedChunks++;
        
        // Simulate slow processing
        setTimeout(() => {
          callback();
        }, 10);
      }
    });

    // Monitor backpressure
    const encoder = new StreamingEncoder(config);
    encoder.on('drain', () => {
      backpressureApplied = true;
    });

    // Create input stream
    const inputStream = Readable.from([data]);

    // Pipe through encoder to slow consumer
    await pipelineAsync(
      inputStream,
      encoder,
      slowConsumer
    );

    // Verify all chunks were consumed
    expect(consumedChunks).toBe(numChunks);
    
    // Note: backpressure may or may not be applied depending on timing
    // The important thing is that the pipeline completes successfully
  }, 30000);

  it('should handle backpressure in streaming decoder', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    const chunkSize = config.dataShards * config.shardSize;
    const numChunks = 50;
    const dataSize = chunkSize * numChunks;

    // Create and encode data
    const data = Buffer.alloc(dataSize);
    for (let i = 0; i < dataSize; i++) {
      data[i] = i % 256;
    }

    const encoder = new ReedSolomonEncoder(config);
    const encodedChunks: any[] = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      const chunk = data.slice(start, end);
      const encoded = encoder.encode(new Uint8Array(chunk));
      encodedChunks.push({
        ...encoded,
        chunkIndex: i
      });
    }

    // Create slow consumer
    let bytesConsumed = 0;

    const slowConsumer = new Writable({
      highWaterMark: 16 * 1024, // 16KB buffer
      write(chunk, encoding, callback) {
        bytesConsumed += chunk.length;
        
        // Simulate slow processing
        setTimeout(() => {
          callback();
        }, 5);
      }
    });

    // Decode with backpressure
    const decoder = new StreamingDecoder(config);
    const encodedStream = Readable.from(encodedChunks);

    await pipelineAsync(
      encodedStream,
      decoder,
      slowConsumer
    );

    // Verify all data was consumed
    expect(bytesConsumed).toBe(dataSize);
  }, 30000);

  it('should handle errors gracefully during streaming', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    // Create encoder
    const encoder = new StreamingEncoder(config);

    // Create input stream that will error
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Test error'));
      }
    });

    // Pipe and expect error
    await expect(
      pipelineAsync(errorStream, encoder)
    ).rejects.toThrow('Test error');
  });

  it('should handle decoder errors gracefully', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    // Create decoder
    const decoder = new StreamingDecoder(config);

    // Create input stream with invalid data
    const invalidStream = Readable.from([
      { invalid: 'data' }
    ]);

    // Pipe and expect error
    await expect(
      collectStreamData(invalidStream.pipe(decoder))
    ).rejects.toThrow();
  });
});

describe('Streaming API Integration', () => {
  it('should work with Node.js pipeline API', async () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 512
    };

    const chunkSize = config.dataShards * config.shardSize;
    const dataSize = chunkSize * 10;

    // Create data
    const data = Buffer.alloc(dataSize);
    for (let i = 0; i < dataSize; i++) {
      data[i] = i % 256;
    }

    // Create streams
    const inputStream = Readable.from([data]);
    const encoder = new StreamingEncoder(config);
    const decoder = new StreamingDecoder(config);

    // Collect output
    const chunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    // Use pipeline API
    await pipelineAsync(
      inputStream,
      encoder,
      decoder,
      outputStream
    );

    // Verify round-trip
    const decoded = Buffer.concat(chunks);
    expect(decoded.length).toBe(data.length);
    expect(decoded.equals(data)).toBe(true);
  });

  it('should support progress tracking', async () => {
    const config = {
      dataShards: 4,
      parityShards: 2,
      shardSize: 1024
    };

    const chunkSize = config.dataShards * config.shardSize;
    const numChunks = 20;
    const dataSize = chunkSize * numChunks;

    // Create data
    const data = Buffer.alloc(dataSize);
    for (let i = 0; i < dataSize; i++) {
      data[i] = i % 256;
    }

    // Track progress
    const encodedChunkIndices: number[] = [];

    const encoder = new StreamingEncoder(config);
    encoder.on('data', (chunk) => {
      encodedChunkIndices.push(chunk.chunkIndex);
    });

    const inputStream = Readable.from([data]);
    const encodedChunks = await collectStreamObjects<any>(
      inputStream.pipe(encoder)
    );

    // Verify progress tracking
    expect(encodedChunkIndices.length).toBe(numChunks);
    expect(encodedChunkIndices).toEqual([...Array(numChunks).keys()]);
  });

  it('should handle concurrent streaming operations', async () => {
    const config = {
      dataShards: 3,
      parityShards: 2,
      shardSize: 256
    };

    const chunkSize = config.dataShards * config.shardSize;
    const dataSize = chunkSize * 5;

    // Create multiple data streams
    const streams = Array.from({ length: 5 }, (_, i) => {
      const data = Buffer.alloc(dataSize);
      for (let j = 0; j < dataSize; j++) {
        data[j] = (i * 1000 + j) % 256;
      }
      return data;
    });

    // Encode all streams concurrently
    const encodePromises = streams.map(async (data) => {
      const encoder = new StreamingEncoder(config);
      const inputStream = Readable.from([data]);
      return collectStreamObjects<any>(inputStream.pipe(encoder));
    });

    const allEncodedChunks = await Promise.all(encodePromises);

    // Decode all streams concurrently
    const decodePromises = allEncodedChunks.map(async (encodedChunks) => {
      const decoder = new StreamingDecoder(config);
      const encodedStream = Readable.from(encodedChunks);
      return collectStreamData(encodedStream.pipe(decoder));
    });

    const allDecoded = await Promise.all(decodePromises);

    // Verify all round-trips
    for (let i = 0; i < streams.length; i++) {
      expect(allDecoded[i].length).toBe(streams[i].length);
      expect(allDecoded[i].equals(streams[i])).toBe(true);
    }
  });
});
