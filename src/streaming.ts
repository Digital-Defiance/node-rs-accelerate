/**
 * Streaming API for Reed-Solomon encoding and decoding
 */

import { Transform, TransformCallback } from 'stream';
import { EncoderConfig, DecoderConfig, ShardInfo, EncodedData } from './config';
import { ReedSolomonEncoder } from './encoder';
import { ReedSolomonDecoder } from './decoder';
import { NativeError } from './errors';

/**
 * Streaming encoder that processes data in chunks
 * Maintains state across chunks and handles backpressure
 */
export class StreamingEncoder extends Transform {
  private encoder: ReedSolomonEncoder;
  private buffer: Buffer;
  private chunkSize: number;
  private shardIndex: number;

  constructor(config: EncoderConfig) {
    super({
      // Object mode for output (emits EncodedData objects)
      writableObjectMode: false,
      readableObjectMode: true,
      // Enable backpressure handling
      highWaterMark: 16
    });

    this.encoder = new ReedSolomonEncoder(config);
    this.buffer = Buffer.alloc(0);
    
    // Calculate chunk size: K * shardSize
    this.chunkSize = config.dataShards * config.shardSize;
    this.shardIndex = 0;
  }

  /**
   * Transform implementation - processes incoming data chunks
   * @param chunk Input data chunk
   * @param encoding Encoding (ignored for Buffer)
   * @param callback Callback to signal completion
   */
  _transform(chunk: Buffer, encoding: string, callback: TransformCallback): void {
    try {
      // Append new chunk to buffer
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Process complete chunks
      while (this.buffer.length >= this.chunkSize) {
        // Extract one complete chunk
        const dataChunk = this.buffer.slice(0, this.chunkSize);
        this.buffer = this.buffer.slice(this.chunkSize);

        // Encode the chunk
        const encoded = this.encoder.encode(new Uint8Array(dataChunk));

        // Emit encoded data with shard index for tracking
        this.push({
          ...encoded,
          chunkIndex: this.shardIndex++
        });
      }

      // Signal that we're ready for more data
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new NativeError(String(error)));
    }
  }

  /**
   * Flush implementation - processes remaining buffered data
   * @param callback Callback to signal completion
   */
  _flush(callback: TransformCallback): void {
    try {
      // If there's remaining data, pad it and encode
      if (this.buffer.length > 0) {
        // Pad buffer to chunk size with zeros
        const paddedBuffer = Buffer.alloc(this.chunkSize);
        this.buffer.copy(paddedBuffer);
        
        // Encode the final chunk
        const encoded = this.encoder.encode(new Uint8Array(paddedBuffer));

        // Emit encoded data with metadata about padding
        this.push({
          ...encoded,
          chunkIndex: this.shardIndex++,
          paddedBytes: this.chunkSize - this.buffer.length,
          isFinal: true
        });
      }

      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new NativeError(String(error)));
    }
  }

  /**
   * Get the current chunk index
   * @returns Current chunk index
   */
  getChunkIndex(): number {
    return this.shardIndex;
  }

  /**
   * Get the buffer size
   * @returns Current buffer size in bytes
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Streaming decoder that processes shards incrementally
 * Maintains state across chunks and handles backpressure
 */
export class StreamingDecoder extends Transform {
  private decoder: ReedSolomonDecoder;
  private shardBuffer: Map<number, ShardInfo[]>;
  private config: DecoderConfig;
  private currentChunkIndex: number;
  private expectedShardsPerChunk: number;

  constructor(config: DecoderConfig) {
    super({
      // Object mode for both input and output
      writableObjectMode: true,
      readableObjectMode: false,
      // Enable backpressure handling
      highWaterMark: 16
    });

    this.decoder = new ReedSolomonDecoder(config);
    this.config = config;
    this.shardBuffer = new Map();
    this.currentChunkIndex = 0;
    this.expectedShardsPerChunk = config.dataShards + config.parityShards;
  }

  /**
   * Transform implementation - processes incoming shard data
   * @param chunk Encoded data chunk with shards
   * @param encoding Encoding (ignored for object mode)
   * @param callback Callback to signal completion
   */
  _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    try {
      // Validate chunk structure
      if (!chunk || !chunk.dataShards || !chunk.parityShards) {
        callback(new NativeError('Invalid chunk format: missing dataShards or parityShards'));
        return;
      }

      const chunkIndex = chunk.chunkIndex ?? this.currentChunkIndex;

      // Convert encoded data to ShardInfo array
      const shards: ShardInfo[] = [];
      
      // Add data shards
      for (let i = 0; i < chunk.dataShards.length; i++) {
        shards.push({
          index: i,
          data: chunk.dataShards[i],
          isData: true
        });
      }

      // Add parity shards
      for (let i = 0; i < chunk.parityShards.length; i++) {
        shards.push({
          index: this.config.dataShards + i,
          data: chunk.parityShards[i],
          isData: false
        });
      }

      // Store shards for this chunk
      if (!this.shardBuffer.has(chunkIndex)) {
        this.shardBuffer.set(chunkIndex, []);
      }
      this.shardBuffer.get(chunkIndex)!.push(...shards);

      // Try to decode if we have enough shards
      const availableShards = this.shardBuffer.get(chunkIndex)!;
      if (availableShards.length >= this.config.dataShards) {
        // Decode the chunk
        const decoded = this.decoder.decode(availableShards);

        // Handle padding for final chunk
        let outputData = decoded;
        if (chunk.isFinal && chunk.paddedBytes > 0) {
          // Remove padding from final chunk
          const originalLength = decoded.length - chunk.paddedBytes;
          outputData = decoded.slice(0, originalLength);
        }

        // Emit decoded data
        this.push(Buffer.from(outputData));

        // Clean up processed chunk
        this.shardBuffer.delete(chunkIndex);
        this.currentChunkIndex = chunkIndex + 1;
      }

      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new NativeError(String(error)));
    }
  }

  /**
   * Flush implementation - processes any remaining buffered shards
   * @param callback Callback to signal completion
   */
  _flush(callback: TransformCallback): void {
    try {
      // Try to decode any remaining chunks
      for (const [chunkIndex, shards] of this.shardBuffer.entries()) {
        if (shards.length >= this.config.dataShards) {
          const decoded = this.decoder.decode(shards);
          this.push(Buffer.from(decoded));
        }
      }

      // Clear buffer
      this.shardBuffer.clear();
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new NativeError(String(error)));
    }
  }

  /**
   * Get the number of buffered chunks
   * @returns Number of chunks in buffer
   */
  getBufferedChunkCount(): number {
    return this.shardBuffer.size;
  }

  /**
   * Get the current chunk index
   * @returns Current chunk index
   */
  getCurrentChunkIndex(): number {
    return this.currentChunkIndex;
  }
}
