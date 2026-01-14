/**
 * Native decoder header
 */

#ifndef DECODER_H
#define DECODER_H

#include <cstdint>
#include <cstddef>
#include <vector>

namespace Decoder {
  /**
   * Decode data from available shards (CPU version)
   * @param shards Array of available shard data (each shardSize bytes)
   * @param shardIndices Array of shard indices (0 to K+M-1)
   * @param numShards Number of available shards (must be >= K)
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Original encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outData Output buffer for reconstructed data (K * shardSize bytes)
   */
  void decode(
    const uint8_t** shards,
    const int* shardIndices,
    int numShards,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outData
  );
  
  /**
   * Decode data from available shards (GPU version)
   * @param shards Array of available shard data (each shardSize bytes)
   * @param shardIndices Array of shard indices (0 to K+M-1)
   * @param numShards Number of available shards (must be >= K)
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Original encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outData Output buffer for reconstructed data (K * shardSize bytes)
   */
  void decodeGPU(
    const uint8_t** shards,
    const int* shardIndices,
    int numShards,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outData
  );
  
  /**
   * Reconstruct specific missing shards
   * @param shards Array of available shard data (each shardSize bytes)
   * @param shardIndices Array of shard indices (0 to K+M-1)
   * @param missingIndices Array of indices of shards to reconstruct
   * @param numShards Number of available shards (must be >= K)
   * @param numMissing Number of missing shards to reconstruct
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @param shardSize Size of each shard in bytes
   * @param matrix Original encoding matrix ((K+M) x K)
   * @param field Field size (8 for GF(2^8), 16 for GF(2^16))
   * @param outData Output buffer for reconstructed shards (numMissing * shardSize bytes)
   */
  void reconstruct(
    const uint8_t** shards,
    const int* shardIndices,
    const int* missingIndices,
    int numShards,
    int numMissing,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outData
  );
  
  /**
   * Determine if GPU should be used for decoding based on matrix size
   * @param dataShards Number of data shards (K)
   * @param parityShards Number of parity shards (M)
   * @return true if GPU should be used
   */
  bool shouldUseGPUForDecoding(int dataShards, int parityShards);
}

#endif // DECODER_H
