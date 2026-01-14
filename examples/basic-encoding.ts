/**
 * Basic Encoding/Decoding Example
 * 
 * This example demonstrates the fundamental usage of Reed-Solomon encoding
 * and decoding to protect data against loss or corruption.
 * 
 * Run with: npx ts-node examples/basic-encoding.ts
 */

import {
  ReedSolomonEncoder,
  ReedSolomonDecoder,
  ShardInfo,
  GaloisField,
  MatrixType
} from '../src';

// Configuration: 10 data shards + 4 parity shards
// This means we can lose up to 4 shards and still recover all data
const K = 10;  // Data shards
const M = 4;   // Parity shards
const SHARD_SIZE = 1024;  // 1KB per shard

async function main() {
  console.log('=== Reed-Solomon Basic Encoding Example ===\n');

  // Create encoder
  const encoder = new ReedSolomonEncoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE,
    field: GaloisField.GF256,
    matrixType: MatrixType.Vandermonde
  });

  console.log(`Configuration: K=${K} data shards, M=${M} parity shards`);
  console.log(`Shard size: ${SHARD_SIZE} bytes`);
  console.log(`Total data size: ${K * SHARD_SIZE} bytes\n`);

  // Create sample data (10KB)
  const originalData = new Uint8Array(K * SHARD_SIZE);
  for (let i = 0; i < originalData.length; i++) {
    originalData[i] = i % 256;  // Fill with pattern
  }

  console.log('Original data (first 20 bytes):', Array.from(originalData.slice(0, 20)));

  // Encode the data
  console.log('\n--- Encoding ---');
  const startEncode = performance.now();
  const encoded = encoder.encode(originalData);
  const encodeTime = performance.now() - startEncode;

  console.log(`Encoding completed in ${encodeTime.toFixed(2)}ms`);
  console.log(`Data shards: ${encoded.dataShards.length}`);
  console.log(`Parity shards: ${encoded.parityShards.length}`);
  console.log(`Total shards: ${encoded.dataShards.length + encoded.parityShards.length}`);

  // Verify systematic encoding (data shards contain original data)
  const dataMatch = encoded.dataShards.every((shard, i) => {
    const start = i * SHARD_SIZE;
    const end = start + SHARD_SIZE;
    return shard.every((byte, j) => byte === originalData[start + j]);
  });
  console.log(`Systematic encoding verified: ${dataMatch}`);

  // Create decoder
  const decoder = new ReedSolomonDecoder({
    dataShards: K,
    parityShards: M,
    shardSize: SHARD_SIZE,
    field: GaloisField.GF256,
    matrixType: MatrixType.Vandermonde
  });

  // Scenario 1: All shards available (no loss)
  console.log('\n--- Scenario 1: No shard loss ---');
  const allShards: ShardInfo[] = [
    ...encoded.dataShards.map((data, i) => ({
      index: i,
      data,
      isData: true
    })),
    ...encoded.parityShards.map((data, i) => ({
      index: K + i,
      data,
      isData: false
    }))
  ];

  const decoded1 = decoder.decode(allShards);
  const match1 = decoded1.every((byte, i) => byte === originalData[i]);
  console.log(`Decoded successfully: ${match1}`);

  // Scenario 2: Lose 2 data shards
  console.log('\n--- Scenario 2: Lost 2 data shards (indices 3, 7) ---');
  const shardsWithLoss2: ShardInfo[] = [
    { index: 0, data: encoded.dataShards[0], isData: true },
    { index: 1, data: encoded.dataShards[1], isData: true },
    { index: 2, data: encoded.dataShards[2], isData: true },
    // index 3 lost
    { index: 4, data: encoded.dataShards[4], isData: true },
    { index: 5, data: encoded.dataShards[5], isData: true },
    { index: 6, data: encoded.dataShards[6], isData: true },
    // index 7 lost
    { index: 8, data: encoded.dataShards[8], isData: true },
    { index: 9, data: encoded.dataShards[9], isData: true },
    { index: 10, data: encoded.parityShards[0], isData: false },
    { index: 11, data: encoded.parityShards[1], isData: false },
  ];

  const decoded2 = decoder.decode(shardsWithLoss2);
  const match2 = decoded2.every((byte, i) => byte === originalData[i]);
  console.log(`Available shards: ${shardsWithLoss2.length}`);
  console.log(`Decoded successfully: ${match2}`);

  // Scenario 3: Lose maximum recoverable (4 shards)
  console.log('\n--- Scenario 3: Lost 4 shards (maximum recoverable) ---');
  const shardsWithMaxLoss: ShardInfo[] = [
    { index: 0, data: encoded.dataShards[0], isData: true },
    { index: 1, data: encoded.dataShards[1], isData: true },
    { index: 2, data: encoded.dataShards[2], isData: true },
    { index: 3, data: encoded.dataShards[3], isData: true },
    { index: 4, data: encoded.dataShards[4], isData: true },
    { index: 5, data: encoded.dataShards[5], isData: true },
    // Lost indices 6, 7, 8, 9
    { index: 10, data: encoded.parityShards[0], isData: false },
    { index: 11, data: encoded.parityShards[1], isData: false },
    { index: 12, data: encoded.parityShards[2], isData: false },
    { index: 13, data: encoded.parityShards[3], isData: false },
  ];

  const decoded3 = decoder.decode(shardsWithMaxLoss);
  const match3 = decoded3.every((byte, i) => byte === originalData[i]);
  console.log(`Available shards: ${shardsWithMaxLoss.length}`);
  console.log(`Decoded successfully: ${match3}`);

  // Scenario 4: Check if shards are sufficient before decoding
  console.log('\n--- Scenario 4: Checking shard sufficiency ---');
  const sufficientIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const insufficientIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];  // Only 9 shards

  console.log(`Can decode with ${sufficientIndices.length} shards: ${decoder.canDecode(sufficientIndices)}`);
  console.log(`Can decode with ${insufficientIndices.length} shards: ${decoder.canDecode(insufficientIndices)}`);

  // Scenario 5: Partial reconstruction (only reconstruct missing shards)
  console.log('\n--- Scenario 5: Partial reconstruction ---');
  const missingIndices = [6, 7];  // Only reconstruct these
  const reconstructed = decoder.reconstruct(shardsWithMaxLoss, missingIndices);
  
  console.log(`Reconstructed ${reconstructed.length} shards`);
  const reconstructMatch = reconstructed.every((shard, i) => {
    const originalIndex = missingIndices[i];
    const originalShard = encoded.dataShards[originalIndex];
    return shard.every((byte, j) => byte === originalShard[j]);
  });
  console.log(`Reconstruction verified: ${reconstructMatch}`);

  console.log('\n=== Example completed successfully ===');
}

main().catch(console.error);
