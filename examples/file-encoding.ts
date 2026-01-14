/**
 * File Encoding Example
 * 
 * This example demonstrates how to encode and decode files using
 * Reed-Solomon error correction. It shows how to:
 * - Read a file and split it into shards
 * - Encode with parity for redundancy
 * - Simulate shard loss
 * - Recover the original file
 * 
 * Run with: npx ts-node examples/file-encoding.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ReedSolomonEncoder,
  ReedSolomonDecoder,
  ShardInfo,
  EncodedData
} from '../src';

// Configuration
const K = 10;  // Data shards
const M = 4;   // Parity shards (can lose up to 4 shards)
const SHARD_SIZE = 64 * 1024;  // 64KB per shard

// Helper to compute file hash
function computeHash(data: Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper to create a test file
function createTestFile(filePath: string, sizeBytes: number): void {
  const data = Buffer.alloc(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    data[i] = i % 256;
  }
  fs.writeFileSync(filePath, data);
}

// Encode a file into shards
function encodeFile(filePath: string): { encoded: EncodedData; originalHash: string } {
  console.log(`\nEncoding file: ${filePath}`);
  
  // Read file
  const fileData = fs.readFileSync(filePath);
  const originalHash = computeHash(new Uint8Array(fileData));
  console.log(`File size: ${fileData.length} bytes`);
  console.log(`Original hash: ${originalHash.slice(0, 16)}...`);
  
  // Calculate required shard size
  const requiredSize = K * SHARD_SIZE;
  
  // Pad file to required size if needed
  let dataToEncode: Uint8Array;
  if (fileData.length < requiredSize) {
    dataToEncode = new Uint8Array(requiredSize);
    dataToEncode.set(new Uint8Array(fileData));
    console.log(`Padded to ${requiredSize} bytes`);
  } else if (fileData.length > requiredSize) {
    throw new Error(`File too large. Max size: ${requiredSize} bytes`);
  } else {
    dataToEncode = new Uint8Array(fileData);
  }
  
  // Create encoder
  const encoder = new ReedSolomonEncoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE
  });
  
  // Encode
  const startTime = performance.now();
  const encoded = encoder.encode(dataToEncode);
  const encodeTime = performance.now() - startTime;
  
  console.log(`Encoding time: ${encodeTime.toFixed(2)}ms`);
  console.log(`Throughput: ${(dataToEncode.length / encodeTime / 1000).toFixed(2)} MB/s`);
  console.log(`Created ${encoded.dataShards.length} data shards + ${encoded.parityShards.length} parity shards`);
  
  return { encoded, originalHash };
}

// Save shards to disk (simulating distributed storage)
function saveShards(encoded: EncodedData, outputDir: string): void {
  console.log(`\nSaving shards to: ${outputDir}`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save data shards
  for (let i = 0; i < encoded.dataShards.length; i++) {
    const shardPath = path.join(outputDir, `data_${i.toString().padStart(3, '0')}.shard`);
    fs.writeFileSync(shardPath, encoded.dataShards[i]);
  }
  
  // Save parity shards
  for (let i = 0; i < encoded.parityShards.length; i++) {
    const shardPath = path.join(outputDir, `parity_${i.toString().padStart(3, '0')}.shard`);
    fs.writeFileSync(shardPath, encoded.parityShards[i]);
  }
  
  // Save metadata
  const metadata = {
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE,
    totalShards: K + M
  };
  fs.writeFileSync(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`Saved ${K + M} shard files + metadata`);
}

// Load shards from disk (with simulated loss)
function loadShards(inputDir: string, lostIndices: number[] = []): ShardInfo[] {
  console.log(`\nLoading shards from: ${inputDir}`);
  console.log(`Simulating loss of shards: ${lostIndices.join(', ') || 'none'}`);
  
  const shards: ShardInfo[] = [];
  
  // Load data shards
  for (let i = 0; i < K; i++) {
    if (lostIndices.includes(i)) {
      console.log(`  Shard ${i} (data): LOST`);
      continue;
    }
    
    const shardPath = path.join(inputDir, `data_${i.toString().padStart(3, '0')}.shard`);
    const data = new Uint8Array(fs.readFileSync(shardPath));
    shards.push({ index: i, data, isData: true });
  }
  
  // Load parity shards
  for (let i = 0; i < M; i++) {
    const globalIndex = K + i;
    if (lostIndices.includes(globalIndex)) {
      console.log(`  Shard ${globalIndex} (parity): LOST`);
      continue;
    }
    
    const shardPath = path.join(inputDir, `parity_${i.toString().padStart(3, '0')}.shard`);
    const data = new Uint8Array(fs.readFileSync(shardPath));
    shards.push({ index: globalIndex, data, isData: false });
  }
  
  console.log(`Loaded ${shards.length} shards (${K + M - lostIndices.length} available)`);
  return shards;
}

// Decode shards back to file
function decodeFile(shards: ShardInfo[], outputPath: string, originalSize: number): string {
  console.log(`\nDecoding to: ${outputPath}`);
  
  // Create decoder
  const decoder = new ReedSolomonDecoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE
  });
  
  // Check if we have enough shards
  if (!decoder.canDecode(shards.map(s => s.index))) {
    throw new Error(`Insufficient shards for decoding. Need ${K}, have ${shards.length}`);
  }
  
  // Decode
  const startTime = performance.now();
  const decoded = decoder.decode(shards);
  const decodeTime = performance.now() - startTime;
  
  console.log(`Decoding time: ${decodeTime.toFixed(2)}ms`);
  console.log(`Throughput: ${(decoded.length / decodeTime / 1000).toFixed(2)} MB/s`);
  
  // Trim to original size and save
  const trimmed = decoded.slice(0, originalSize);
  fs.writeFileSync(outputPath, trimmed);
  
  const recoveredHash = computeHash(trimmed);
  console.log(`Recovered hash: ${recoveredHash.slice(0, 16)}...`);
  
  return recoveredHash;
}

// Cleanup test files
function cleanup(paths: string[]): void {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      if (fs.statSync(p).isDirectory()) {
        fs.rmSync(p, { recursive: true });
      } else {
        fs.unlinkSync(p);
      }
    }
  }
}

async function main() {
  console.log('=== Reed-Solomon File Encoding Example ===');
  console.log(`Configuration: K=${K}, M=${M}, shard size=${SHARD_SIZE} bytes`);
  console.log(`Maximum file size: ${K * SHARD_SIZE} bytes (${(K * SHARD_SIZE / 1024).toFixed(0)} KB)`);
  
  const testFile = '/tmp/rs-test-input.dat';
  const shardsDir = '/tmp/rs-test-shards';
  const recoveredFile = '/tmp/rs-test-recovered.dat';
  
  try {
    // Create test file (500KB)
    const fileSize = 500 * 1024;
    console.log(`\nCreating test file: ${fileSize} bytes`);
    createTestFile(testFile, fileSize);
    
    // Encode file
    const { encoded, originalHash } = encodeFile(testFile);
    
    // Save shards
    saveShards(encoded, shardsDir);
    
    // Scenario 1: No loss
    console.log('\n--- Scenario 1: No shard loss ---');
    const shards1 = loadShards(shardsDir, []);
    const hash1 = decodeFile(shards1, recoveredFile, fileSize);
    console.log(`Verification: ${hash1 === originalHash ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    // Scenario 2: Lose 2 data shards
    console.log('\n--- Scenario 2: Lost 2 data shards ---');
    const shards2 = loadShards(shardsDir, [2, 7]);
    const hash2 = decodeFile(shards2, recoveredFile, fileSize);
    console.log(`Verification: ${hash2 === originalHash ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    // Scenario 3: Lose 4 shards (maximum recoverable)
    console.log('\n--- Scenario 3: Lost 4 shards (maximum) ---');
    const shards3 = loadShards(shardsDir, [0, 3, 6, 9]);
    const hash3 = decodeFile(shards3, recoveredFile, fileSize);
    console.log(`Verification: ${hash3 === originalHash ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    // Scenario 4: Lose mix of data and parity
    console.log('\n--- Scenario 4: Lost 2 data + 2 parity ---');
    const shards4 = loadShards(shardsDir, [1, 5, 10, 12]);
    const hash4 = decodeFile(shards4, recoveredFile, fileSize);
    console.log(`Verification: ${hash4 === originalHash ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    console.log('\n=== All scenarios completed successfully ===');
    
  } finally {
    // Cleanup
    console.log('\nCleaning up test files...');
    cleanup([testFile, shardsDir, recoveredFile]);
  }
}

main().catch(console.error);
