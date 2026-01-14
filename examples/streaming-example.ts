/**
 * Streaming Example
 * 
 * This example demonstrates how to use the streaming API to encode
 * and decode large files without loading everything into memory.
 * 
 * Run with: npx ts-node examples/streaming-example.ts
 */

import { Readable, Writable, Transform, pipeline } from 'stream';
import { promisify } from 'util';
import {
  ReedSolomonEncoder,
  ReedSolomonDecoder,
  StreamingEncoder,
  StreamingDecoder,
  EncodedData
} from '../src';

const pipelineAsync = promisify(pipeline);

// Configuration
const K = 10;  // Data shards
const M = 4;   // Parity shards
const SHARD_SIZE = 4 * 1024;  // 4KB per shard (smaller for demo)

// Generate test data stream
function createDataStream(totalBytes: number): Readable {
  let bytesGenerated = 0;
  
  return new Readable({
    read(size) {
      const remaining = totalBytes - bytesGenerated;
      if (remaining <= 0) {
        this.push(null);
        return;
      }
      
      const chunkSize = Math.min(size, remaining);
      const chunk = Buffer.alloc(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        chunk[i] = (bytesGenerated + i) % 256;
      }
      bytesGenerated += chunkSize;
      this.push(chunk);
    }
  });
}

// Collect encoded chunks
class EncodedChunkCollector extends Writable {
  public chunks: any[] = [];
  
  constructor() {
    super({ objectMode: true });
  }
  
  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk);
    callback();
  }
}

// Simulate shard loss by removing some shards from encoded chunks
function simulateShardLoss(chunks: any[], lossPattern: number[]): any[] {
  return chunks.map(chunk => {
    const modifiedChunk = { ...chunk };
    
    // Remove specified data shards
    modifiedChunk.dataShards = chunk.dataShards.filter((_: any, i: number) => 
      !lossPattern.includes(i)
    );
    
    // Remove specified parity shards
    modifiedChunk.parityShards = chunk.parityShards.filter((_: any, i: number) => 
      !lossPattern.includes(K + i)
    );
    
    // Update indices to reflect what's available
    const availableDataIndices = chunk.dataShards
      .map((_: any, i: number) => i)
      .filter((i: number) => !lossPattern.includes(i));
    
    const availableParityIndices = chunk.parityShards
      .map((_: any, i: number) => K + i)
      .filter((i: number) => !lossPattern.includes(i));
    
    // Reconstruct with proper indices
    modifiedChunk.dataShards = availableDataIndices.map((idx: number) => 
      chunk.dataShards[idx]
    );
    modifiedChunk.parityShards = availableParityIndices.map((idx: number) => 
      chunk.parityShards[idx - K]
    );
    
    return modifiedChunk;
  });
}

// Create a readable stream from encoded chunks
function createEncodedStream(chunks: any[]): Readable {
  let index = 0;
  
  return new Readable({
    objectMode: true,
    read() {
      if (index < chunks.length) {
        this.push(chunks[index++]);
      } else {
        this.push(null);
      }
    }
  });
}

// Collect decoded data
class DecodedDataCollector extends Writable {
  public data: Buffer[] = [];
  
  _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void): void {
    this.data.push(chunk);
    callback();
  }
  
  getData(): Buffer {
    return Buffer.concat(this.data);
  }
}

async function main() {
  console.log('=== Reed-Solomon Streaming Example ===\n');
  console.log(`Configuration: K=${K}, M=${M}, shard size=${SHARD_SIZE} bytes`);
  console.log(`Chunk size: ${K * SHARD_SIZE} bytes (${K} shards × ${SHARD_SIZE} bytes)\n`);
  
  // Generate test data (multiple chunks worth)
  const totalBytes = K * SHARD_SIZE * 3;  // 3 chunks
  console.log(`Total data size: ${totalBytes} bytes (${totalBytes / 1024} KB)`);
  console.log(`Expected chunks: ${Math.ceil(totalBytes / (K * SHARD_SIZE))}\n`);
  
  // Create encoder
  const encoder = new ReedSolomonEncoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE
  });
  
  // --- Encoding Phase ---
  console.log('--- Encoding Phase ---');
  
  const encodedCollector = new EncodedChunkCollector();
  const dataStream = createDataStream(totalBytes);
  const encoderStream = encoder.encodeStream();
  
  const startEncode = performance.now();
  await pipelineAsync(dataStream, encoderStream, encodedCollector);
  const encodeTime = performance.now() - startEncode;
  
  console.log(`Encoded ${encodedCollector.chunks.length} chunks`);
  console.log(`Encoding time: ${encodeTime.toFixed(2)}ms`);
  console.log(`Throughput: ${(totalBytes / encodeTime / 1000).toFixed(2)} MB/s`);
  
  // Show chunk details
  for (let i = 0; i < encodedCollector.chunks.length; i++) {
    const chunk = encodedCollector.chunks[i];
    console.log(`  Chunk ${i}: ${chunk.dataShards.length} data + ${chunk.parityShards.length} parity shards`);
  }
  
  // --- Decoding Phase (No Loss) ---
  console.log('\n--- Decoding Phase (No Loss) ---');
  
  const decoder = new ReedSolomonDecoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE
  });
  
  const decodedCollector1 = new DecodedDataCollector();
  const encodedStream1 = createEncodedStream(encodedCollector.chunks);
  const decoderStream1 = decoder.decodeStream();
  
  const startDecode1 = performance.now();
  await pipelineAsync(encodedStream1, decoderStream1, decodedCollector1);
  const decodeTime1 = performance.now() - startDecode1;
  
  const decoded1 = decodedCollector1.getData();
  console.log(`Decoded ${decoded1.length} bytes`);
  console.log(`Decoding time: ${decodeTime1.toFixed(2)}ms`);
  
  // Verify
  let match1 = true;
  for (let i = 0; i < totalBytes; i++) {
    if (decoded1[i] !== i % 256) {
      match1 = false;
      break;
    }
  }
  console.log(`Verification: ${match1 ? 'PASSED ✓' : 'FAILED ✗'}`);
  
  // --- Decoding Phase (With Loss) ---
  console.log('\n--- Decoding Phase (With 2 Shard Loss) ---');
  
  // Simulate losing shards 2 and 7
  const lossPattern = [2, 7];
  console.log(`Simulating loss of shards: ${lossPattern.join(', ')}`);
  
  const chunksWithLoss = simulateShardLoss(encodedCollector.chunks, lossPattern);
  
  // For decoding with loss, we need to manually reconstruct ShardInfo
  // The streaming decoder expects full encoded chunks, so we'll decode manually
  console.log('Decoding chunks with missing shards...');
  
  let decodedWithLoss = Buffer.alloc(0);
  for (let i = 0; i < chunksWithLoss.length; i++) {
    const chunk = chunksWithLoss[i];
    
    // Build ShardInfo array from available shards
    const shards: any[] = [];
    
    // Add available data shards
    const availableDataIndices = Array.from({ length: K }, (_, i) => i)
      .filter(i => !lossPattern.includes(i));
    
    for (let j = 0; j < availableDataIndices.length; j++) {
      const idx = availableDataIndices[j];
      shards.push({
        index: idx,
        data: encodedCollector.chunks[i].dataShards[idx],
        isData: true
      });
    }
    
    // Add available parity shards
    const availableParityIndices = Array.from({ length: M }, (_, i) => K + i)
      .filter(i => !lossPattern.includes(i));
    
    for (let j = 0; j < availableParityIndices.length; j++) {
      const idx = availableParityIndices[j];
      shards.push({
        index: idx,
        data: encodedCollector.chunks[i].parityShards[idx - K],
        isData: false
      });
    }
    
    console.log(`  Chunk ${i}: ${shards.length} shards available`);
    
    // Decode
    const decoded = decoder.decode(shards);
    decodedWithLoss = Buffer.concat([decodedWithLoss, Buffer.from(decoded)]);
  }
  
  console.log(`Decoded ${decodedWithLoss.length} bytes`);
  
  // Verify
  let match2 = true;
  for (let i = 0; i < totalBytes; i++) {
    if (decodedWithLoss[i] !== i % 256) {
      match2 = false;
      break;
    }
  }
  console.log(`Verification: ${match2 ? 'PASSED ✓' : 'FAILED ✗'}`);
  
  // --- Memory Usage Demo ---
  console.log('\n--- Memory Efficiency ---');
  console.log('Streaming processes data in chunks, keeping memory usage low.');
  console.log(`Peak memory per chunk: ~${(K + M) * SHARD_SIZE / 1024} KB`);
  console.log('This allows processing files larger than available RAM.');
  
  console.log('\n=== Streaming example completed ===');
}

main().catch(console.error);
