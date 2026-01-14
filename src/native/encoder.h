/**
 * Native encoder header
 */

#ifndef ENCODER_H
#define ENCODER_H

#include <cstdint>
#include <cstddef>
#include <vector>

namespace Encoder {
  /**
   * Encode data into Reed-Solomon shards (CPU version)
   * @param data Input data (K * shardSize bytes)
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outParityShards Output buffer for parity shards (M * shardSize bytes)
   */
  void encode(
    const uint8_t* data,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outParityShards
  );
  
  /**
   * Encode data into Reed-Solomon shards (GPU version)
   * @param data Input data (K * shardSize bytes)
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outParityShards Output buffer for parity shards (M * shardSize bytes)
   */
  void encodeGPU(
    const uint8_t* data,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outParityShards
  );
  
  /**
   * Determine if GPU should be used for encoding based on shard size
   * @param shardSize Size of each shard in bytes
   * @param dataShards Number of data shards
   * @param parityShards Number of parity shards
   * @return true if GPU should be used
   */
  bool shouldUseGPU(int shardSize, int dataShards, int parityShards);
  
  /**
   * Batch encode multiple data blocks (GPU version)
   * @param dataBlocks Array of input data blocks (each K * shardSize bytes)
   * @param batchSize Number of data blocks to encode
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outParityBlocks Output buffer for parity blocks (batchSize * M * shardSize bytes)
   */
  void batchEncodeGPU(
    const uint8_t** dataBlocks,
    int batchSize,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t** outParityBlocks
  );
}

#endif // ENCODER_H
