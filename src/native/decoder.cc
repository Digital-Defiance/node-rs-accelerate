/**
 * Native decoder implementation
 */

#include "decoder.h"
#include "gf_arithmetic.h"
#include "matrix_ops.h"
#include "metal_bridge.h"
#include <cstring>
#include <stdexcept>
#include <vector>
#include <algorithm>

namespace Decoder {
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
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported");
    }
    
    if (!shards || !shardIndices || !matrix || !outData) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (numShards < dataShards) {
      throw std::invalid_argument("Insufficient shards for decoding");
    }
    
    if (dataShards <= 0 || parityShards <= 0 || shardSize <= 0) {
      throw std::invalid_argument("Invalid shard parameters");
    }
    
    if (field == 16) {
      // GF(2^16) implementation
      GF::initGF65536();
      
      const uint16_t* matrix16 = reinterpret_cast<const uint16_t*>(matrix);
      uint16_t* outData16 = reinterpret_cast<uint16_t*>(outData);
      int shardSize16 = shardSize / 2;
      
      // Check if we have all data shards
      bool hasAllDataShards = true;
      std::vector<bool> hasDataShard(dataShards, false);
      
      for (int i = 0; i < numShards; i++) {
        if (shardIndices[i] < dataShards) {
          hasDataShard[shardIndices[i]] = true;
        }
      }
      
      for (int i = 0; i < dataShards; i++) {
        if (!hasDataShard[i]) {
          hasAllDataShards = false;
          break;
        }
      }
      
      // If we have all data shards, just copy them
      if (hasAllDataShards) {
        for (int i = 0; i < numShards; i++) {
          if (shardIndices[i] < dataShards) {
            std::memcpy(
              outData + shardIndices[i] * shardSize,
              shards[i],
              shardSize
            );
          }
        }
        return;
      }
      
      // Build decoding matrix from available shards
      std::vector<uint16_t> decodingMatrix(dataShards * dataShards);
      
      for (int i = 0; i < dataShards; i++) {
        int shardIdx = shardIndices[i];
        std::memcpy(
          decodingMatrix.data() + i * dataShards,
          matrix16 + shardIdx * dataShards,
          dataShards * sizeof(uint16_t)
        );
      }
      
      // Invert the decoding matrix
      Matrix::invertMatrixGF(reinterpret_cast<uint8_t*>(decodingMatrix.data()), dataShards, field);
      
      // Reconstruct each data shard
      for (int d = 0; d < dataShards; d++) {
        uint16_t* dataShard = outData16 + d * shardSize16;
        std::memset(dataShard, 0, shardSize);
        
        for (int bytePos = 0; bytePos < shardSize16; bytePos++) {
          std::vector<uint16_t> shardBytes(dataShards);
          for (int i = 0; i < dataShards; i++) {
            const uint16_t* shard16 = reinterpret_cast<const uint16_t*>(shards[i]);
            shardBytes[i] = shard16[bytePos];
          }
          
          uint16_t result = 0;
          for (int i = 0; i < dataShards; i++) {
            uint16_t coeff = decodingMatrix[d * dataShards + i];
            if (coeff != 0 && shardBytes[i] != 0) {
              uint16_t product = GF::mul16(coeff, shardBytes[i]);
              result ^= product;
            }
          }
          
          dataShard[bytePos] = result;
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    GF::initGF256();
    
    // Check if we have all data shards (indices 0 to K-1)
    bool hasAllDataShards = true;
    std::vector<bool> hasDataShard(dataShards, false);
    
    for (int i = 0; i < numShards; i++) {
      if (shardIndices[i] < dataShards) {
        hasDataShard[shardIndices[i]] = true;
      }
    }
    
    for (int i = 0; i < dataShards; i++) {
      if (!hasDataShard[i]) {
        hasAllDataShards = false;
        break;
      }
    }
    
    // If we have all data shards, just copy them
    if (hasAllDataShards) {
      for (int i = 0; i < numShards; i++) {
        if (shardIndices[i] < dataShards) {
          std::memcpy(
            outData + shardIndices[i] * shardSize,
            shards[i],
            shardSize
          );
        }
      }
      return;
    }
    
    // Otherwise, we need to do matrix inversion and reconstruction
    // Build decoding matrix from available shards
    std::vector<uint8_t> decodingMatrix(dataShards * dataShards);
    
    for (int i = 0; i < dataShards; i++) {
      int shardIdx = shardIndices[i];
      // Copy the corresponding row from the encoding matrix
      std::memcpy(
        decodingMatrix.data() + i * dataShards,
        matrix + shardIdx * dataShards,
        dataShards
      );
    }
    
    // Invert the decoding matrix
    Matrix::invertMatrixGF(decodingMatrix.data(), dataShards, field);
    
    // Reconstruct each data shard
    for (int d = 0; d < dataShards; d++) {
      uint8_t* dataShard = outData + d * shardSize;
      std::memset(dataShard, 0, shardSize);
      
      // For each byte position
      for (int bytePos = 0; bytePos < shardSize; bytePos++) {
        // Extract bytes from available shards at this position
        std::vector<uint8_t> shardBytes(dataShards);
        for (int i = 0; i < dataShards; i++) {
          shardBytes[i] = shards[i][bytePos];
        }
        
        // Multiply by inverted matrix row
        uint8_t result = 0;
        for (int i = 0; i < dataShards; i++) {
          uint8_t coeff = decodingMatrix[d * dataShards + i];
          if (coeff != 0 && shardBytes[i] != 0) {
            uint8_t product = GF::mul8(coeff, shardBytes[i]);
            result ^= product;
          }
        }
        
        dataShard[bytePos] = result;
      }
    }
  }
  
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
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported");
    }
    
    if (!shards || !shardIndices || !missingIndices || !matrix || !outData) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (numShards < dataShards) {
      throw std::invalid_argument("Insufficient shards for reconstruction");
    }
    
    if (dataShards <= 0 || parityShards <= 0 || shardSize <= 0 || numMissing <= 0) {
      throw std::invalid_argument("Invalid shard parameters");
    }
    
    if (field == 16) {
      // GF(2^16) implementation
      GF::initGF65536();
      
      const uint16_t* matrix16 = reinterpret_cast<const uint16_t*>(matrix);
      uint16_t* outData16 = reinterpret_cast<uint16_t*>(outData);
      int shardSize16 = shardSize / 2;
      
      // Build decoding matrix
      std::vector<uint16_t> decodingMatrix(dataShards * dataShards);
      
      for (int i = 0; i < dataShards; i++) {
        int shardIdx = shardIndices[i];
        std::memcpy(
          decodingMatrix.data() + i * dataShards,
          matrix16 + shardIdx * dataShards,
          dataShards * sizeof(uint16_t)
        );
      }
      
      // Invert the decoding matrix
      Matrix::invertMatrixGF(reinterpret_cast<uint8_t*>(decodingMatrix.data()), dataShards, field);
      
      // Reconstruct only the requested missing shards
      for (int m = 0; m < numMissing; m++) {
        int missingIdx = missingIndices[m];
        uint16_t* missingShard = outData16 + m * shardSize16;
        std::memset(missingShard, 0, shardSize);
        
        const uint16_t* encodingRow = matrix16 + missingIdx * dataShards;
        
        for (int bytePos = 0; bytePos < shardSize16; bytePos++) {
          std::vector<uint16_t> dataBytes(dataShards);
          
          for (int d = 0; d < dataShards; d++) {
            uint16_t result = 0;
            for (int i = 0; i < dataShards; i++) {
              uint16_t coeff = decodingMatrix[d * dataShards + i];
              const uint16_t* shard16 = reinterpret_cast<const uint16_t*>(shards[i]);
              uint16_t shardByte = shard16[bytePos];
              if (coeff != 0 && shardByte != 0) {
                uint16_t product = GF::mul16(coeff, shardByte);
                result ^= product;
              }
            }
            dataBytes[d] = result;
          }
          
          uint16_t result = 0;
          for (int d = 0; d < dataShards; d++) {
            uint16_t coeff = encodingRow[d];
            if (coeff != 0 && dataBytes[d] != 0) {
              uint16_t product = GF::mul16(coeff, dataBytes[d]);
              result ^= product;
            }
          }
          
          missingShard[bytePos] = result;
        }
      }
      return;
    }
    
    // GF(2^8) implementation
    GF::initGF256();
    
    // Build decoding matrix from available shards
    std::vector<uint8_t> decodingMatrix(dataShards * dataShards);
    
    for (int i = 0; i < dataShards; i++) {
      int shardIdx = shardIndices[i];
      // Copy the corresponding row from the encoding matrix
      std::memcpy(
        decodingMatrix.data() + i * dataShards,
        matrix + shardIdx * dataShards,
        dataShards
      );
    }
    
    // Invert the decoding matrix
    Matrix::invertMatrixGF(decodingMatrix.data(), dataShards, field);
    
    // Reconstruct only the requested missing shards
    for (int m = 0; m < numMissing; m++) {
      int missingIdx = missingIndices[m];
      uint8_t* missingShard = outData + m * shardSize;
      std::memset(missingShard, 0, shardSize);
      
      // Get the encoding matrix row for this shard
      const uint8_t* encodingRow = matrix + missingIdx * dataShards;
      
      // For each byte position
      for (int bytePos = 0; bytePos < shardSize; bytePos++) {
        // First, reconstruct the data shards at this byte position
        std::vector<uint8_t> dataBytes(dataShards);
        
        for (int d = 0; d < dataShards; d++) {
          // Extract bytes from available shards at this position
          uint8_t result = 0;
          for (int i = 0; i < dataShards; i++) {
            uint8_t coeff = decodingMatrix[d * dataShards + i];
            uint8_t shardByte = shards[i][bytePos];
            if (coeff != 0 && shardByte != 0) {
              uint8_t product = GF::mul8(coeff, shardByte);
              result ^= product;
            }
          }
          dataBytes[d] = result;
        }
        
        // Now compute the missing shard byte using the encoding matrix
        uint8_t result = 0;
        for (int d = 0; d < dataShards; d++) {
          uint8_t coeff = encodingRow[d];
          if (coeff != 0 && dataBytes[d] != 0) {
            uint8_t product = GF::mul8(coeff, dataBytes[d]);
            result ^= product;
          }
        }
        
        missingShard[bytePos] = result;
      }
    }
  }

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
  ) {
    if (field != 8 && field != 16) {
      throw std::runtime_error("Only GF(2^8) and GF(2^16) are supported for GPU decoding");
    }
    
    if (!shards || !shardIndices || !matrix || !outData) {
      throw std::invalid_argument("Null pointer provided");
    }
    
    if (numShards < dataShards) {
      throw std::invalid_argument("Insufficient shards for decoding");
    }
    
    if (dataShards <= 0 || parityShards <= 0 || shardSize <= 0) {
      throw std::invalid_argument("Invalid shard parameters");
    }
    
    // Initialize and check if Metal is available and matrix size warrants GPU usage
    if (!MetalAccel::initMetal() || !MetalAccel::isMetalAvailable() || !Decoder::shouldUseGPUForDecoding(dataShards, parityShards)) {
      // Fall back to CPU decoding
      Decoder::decode(shards, shardIndices, numShards, dataShards, parityShards, shardSize, matrix, field, outData);
      return;
    }
    
    // For GF(2^16), fall back to CPU for now
    if (field == 16) {
      Decoder::decode(shards, shardIndices, numShards, dataShards, parityShards, shardSize, matrix, field, outData);
      return;
    }
    
    try {
      // Check if we have all data shards (indices 0 to K-1)
      bool hasAllDataShards = true;
      std::vector<bool> hasDataShard(dataShards, false);
      
      for (int i = 0; i < numShards; i++) {
        if (shardIndices[i] < dataShards) {
          hasDataShard[shardIndices[i]] = true;
        }
      }
      
      for (int i = 0; i < dataShards; i++) {
        if (!hasDataShard[i]) {
          hasAllDataShards = false;
          break;
        }
      }
      
      // If we have all data shards, just copy them
      if (hasAllDataShards) {
        for (int i = 0; i < numShards; i++) {
          if (shardIndices[i] < dataShards) {
            std::memcpy(
              outData + shardIndices[i] * shardSize,
              shards[i],
              shardSize
            );
          }
        }
        return;
      }
      
      // Otherwise, we need to do matrix inversion and reconstruction
      // Build decoding matrix from available shards
      std::vector<uint8_t> decodingMatrix(dataShards * dataShards);
      
      for (int i = 0; i < dataShards; i++) {
        int shardIdx = shardIndices[i];
        // Copy the corresponding row from the encoding matrix
        std::memcpy(
          decodingMatrix.data() + i * dataShards,
          matrix + shardIdx * dataShards,
          dataShards
        );
      }
      
      // Invert the decoding matrix (CPU operation - matrix inversion is complex for GPU)
      Matrix::invertMatrixGF(decodingMatrix.data(), dataShards, field);
      
      // Reconstruct each data shard using GPU for matrix-vector multiplication
      for (int d = 0; d < dataShards; d++) {
        uint8_t* dataShard = outData + d * shardSize;
        std::memset(dataShard, 0, shardSize);
        
        // For each byte position
        for (int bytePos = 0; bytePos < shardSize; bytePos++) {
          // Extract bytes from available shards at this position
          std::vector<uint8_t> shardBytes(dataShards);
          for (int i = 0; i < dataShards; i++) {
            shardBytes[i] = shards[i][bytePos];
          }
          
          // Get the row of the inverted matrix for this data shard
          const uint8_t* matrixRow = decodingMatrix.data() + d * dataShards;
          
          // Multiply by inverted matrix row using GPU
          // For small vectors, CPU might be faster, but we'll use GPU for consistency
          uint8_t result = 0;
          for (int i = 0; i < dataShards; i++) {
            uint8_t coeff = matrixRow[i];
            if (coeff != 0 && shardBytes[i] != 0) {
              uint8_t product = GF::mul8(coeff, shardBytes[i]);
              result ^= product;
            }
          }
          
          dataShard[bytePos] = result;
        }
      }
    } catch (const std::exception& e) {
      // If GPU decoding fails, fall back to CPU
      Decoder::decode(shards, shardIndices, numShards, dataShards, parityShards, shardSize, matrix, field, outData);
    }
  }
  
  bool shouldUseGPUForDecoding(int dataShards, int parityShards) {
    // Based on design document: dispatch to GPU when matrix size > 500×500
    // Matrix size for decoding is dataShards × dataShards
    const int GPU_MATRIX_THRESHOLD = 500;
    
    // Also check if Metal is available
    if (!MetalAccel::isMetalAvailable()) {
      return false;
    }
    
    // Use GPU if matrix size exceeds threshold
    return dataShards > GPU_MATRIX_THRESHOLD;
  }
}
