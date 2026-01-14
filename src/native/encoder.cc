/**
 * Native encoder implementation
 */

#include "encoder.h"
#include "gf_arithmetic.h"
#include "metal_bridge.h"
#include <cstring>
#include <stdexcept>
#include <vector>

namespace Encoder {
  void encode(
    const uint8_t* data,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outParityShards
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported");
    }
    
    if (!data || !matrix || !outParityShards) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (dataShards <= 0 || parityShards <= 0 || shardSize <= 0) {
      throw std::invalid_argument("Invalid shard parameters");
    }
    
    if (field == 16) {
      // GF(2^16) implementation
      GF::initGF65536();
      
      const uint16_t* matrix16 = reinterpret_cast<const uint16_t*>(matrix);
      const uint16_t* data16 = reinterpret_cast<const uint16_t*>(data);
      uint16_t* outParityShards16 = reinterpret_cast<uint16_t*>(outParityShards);
      
      int shardSize16 = shardSize / 2; // Number of uint16_t elements
      
      // For each parity shard
      for (int p = 0; p < parityShards; p++) {
        // Get the row from the encoding matrix for this parity shard
        const uint16_t* matrixRow = matrix16 + (dataShards + p) * dataShards;
        
        // Output pointer for this parity shard
        uint16_t* parityShard = outParityShards16 + p * shardSize16;
        
        // Initialize parity shard to zero
        std::memset(parityShard, 0, shardSize);
        
        // For each data shard
        for (int d = 0; d < dataShards; d++) {
          uint16_t matrixCoeff = matrixRow[d];
          
          // Skip if coefficient is zero
          if (matrixCoeff == 0) {
            continue;
          }
          
          // Get pointer to this data shard
          const uint16_t* dataShard = data16 + d * shardSize16;
          
          // For each element in the shard
          for (int i = 0; i < shardSize16; i++) {
            if (dataShard[i] != 0) {
              uint16_t product = GF::mul16(matrixCoeff, dataShard[i]);
              parityShard[i] ^= product;
            }
          }
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    GF::initGF256();
    
    // For each parity shard
    for (int p = 0; p < parityShards; p++) {
      // Get the row from the encoding matrix for this parity shard
      // Parity rows start at index dataShards
      const uint8_t* matrixRow = matrix + (dataShards + p) * dataShards;
      
      // Output pointer for this parity shard
      uint8_t* parityShard = outParityShards + p * shardSize;
      
      // Initialize parity shard to zero
      std::memset(parityShard, 0, shardSize);
      
      // For each data shard
      for (int d = 0; d < dataShards; d++) {
        uint8_t matrixCoeff = matrixRow[d];
        
        // Skip if coefficient is zero (optimization)
        if (matrixCoeff == 0) {
          continue;
        }
        
        // Get pointer to this data shard
        const uint8_t* dataShard = data + d * shardSize;
        
        // For each byte in the shard
        for (int i = 0; i < shardSize; i++) {
          // Multiply data byte by matrix coefficient and XOR into parity
          if (dataShard[i] != 0) {
            uint8_t product = GF::mul8(matrixCoeff, dataShard[i]);
            parityShard[i] ^= product;
          }
        }
      }
    }
  }

  void encodeGPU(
    const uint8_t* data,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t* outParityShards
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported for GPU encoding");
    }
    
    if (!data || !matrix || !outParityShards) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (dataShards <= 0 || parityShards <= 0 || shardSize <= 0) {
      throw std::invalid_argument("Invalid shard parameters");
    }
    
    // Initialize and check if Metal is available
    if (!MetalAccel::initMetal() || !MetalAccel::isMetalAvailable()) {
      // Fall back to CPU encoding
      Encoder::encode(data, dataShards, parityShards, shardSize, matrix, field, outParityShards);
      return;
    }
    
    // For GF(2^16), fall back to CPU for now (GPU support can be added later)
    if (field == 16) {
      Encoder::encode(data, dataShards, parityShards, shardSize, matrix, field, outParityShards);
      return;
    }
    
    try {
      // For each parity shard
      for (int p = 0; p < parityShards; p++) {
        // Get the row from the encoding matrix for this parity shard
        // Parity rows start at index dataShards
        const uint8_t* matrixRow = matrix + (dataShards + p) * dataShards;
        
        // Output pointer for this parity shard
        uint8_t* parityShard = outParityShards + p * shardSize;
        
        // Initialize parity shard to zero
        std::memset(parityShard, 0, shardSize);
        
        // For each data shard
        for (int d = 0; d < dataShards; d++) {
          uint8_t matrixCoeff = matrixRow[d];
          
          // Skip if coefficient is zero (optimization)
          if (matrixCoeff == 0) {
            continue;
          }
          
          // Get pointer to this data shard
          const uint8_t* dataShard = data + d * shardSize;
          
          // Create temporary buffer for scalar multiplication result
          std::vector<uint8_t> tempResult(shardSize);
          
          // Create coefficient vector (all elements are the same coefficient)
          std::vector<uint8_t> coeffVec(shardSize, matrixCoeff);
          
          // Use GPU to multiply data shard by coefficient
          MetalAccel::gfMulVecGPU(coeffVec.data(), dataShard, tempResult.data(), shardSize, field);
          
          // XOR the result into the parity shard (CPU operation, fast enough)
          for (int i = 0; i < shardSize; i++) {
            parityShard[i] ^= tempResult[i];
          }
        }
      }
    } catch (const std::exception& e) {
      // If GPU encoding fails, fall back to CPU
      Encoder::encode(data, dataShards, parityShards, shardSize, matrix, field, outParityShards);
    }
  }
  
  bool shouldUseGPU(int shardSize, int dataShards, int parityShards) {
    // Empirically determined threshold: 10KB per shard
    // This is based on the design document's recommendation
    const int GPU_THRESHOLD = 10 * 1024;
    
    // Also check if Metal is available
    if (!MetalAccel::isMetalAvailable()) {
      return false;
    }
    
    // Use GPU if shard size exceeds threshold
    return shardSize >= GPU_THRESHOLD;
  }

  void batchEncodeGPU(
    const uint8_t** dataBlocks,
    int batchSize,
    int dataShards,
    int parityShards,
    int shardSize,
    const uint8_t* matrix,
    int field,
    uint8_t** outParityBlocks
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported for batch GPU encoding");
    }
    
    if (!dataBlocks || !matrix || !outParityBlocks) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (batchSize <= 0 || dataShards <= 0 || parityShards <= 0 || shardSize <= 0) {
      throw std::invalid_argument("Invalid batch parameters");
    }
    
    // Initialize and check if Metal is available
    if (!MetalAccel::initMetal() || !MetalAccel::isMetalAvailable()) {
      // Fall back to CPU encoding for each block
      for (int b = 0; b < batchSize; b++) {
        Encoder::encode(dataBlocks[b], dataShards, parityShards, shardSize, matrix, field, outParityBlocks[b]);
      }
      return;
    }
    
    // For GF(2^16), fall back to CPU for now
    if (field == 16) {
      for (int b = 0; b < batchSize; b++) {
        Encoder::encode(dataBlocks[b], dataShards, parityShards, shardSize, matrix, field, outParityBlocks[b]);
      }
      return;
    }
    
    try {
      // Use Metal batch encoding
      MetalAccel::batchEncodeGPU(dataBlocks, outParityBlocks, matrix, batchSize, parityShards, dataShards, shardSize, field);
    } catch (const std::exception& e) {
      // If GPU batch encoding fails, fall back to CPU
      for (int b = 0; b < batchSize; b++) {
        Encoder::encode(dataBlocks[b], dataShards, parityShards, shardSize, matrix, field, outParityBlocks[b]);
      }
    }
  }
}
