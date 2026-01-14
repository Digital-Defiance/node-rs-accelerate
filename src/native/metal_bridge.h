/**
 * Metal GPU acceleration bridge header
 */

#ifndef METAL_BRIDGE_H
#define METAL_BRIDGE_H

#include <cstdint>
#include <cstddef>

namespace MetalAccel {
  // Initialize Metal
  bool initMetal();
  bool isMetalAvailable();
  
  // GPU memory management
  void* createGPUBuffer(size_t size, const void* data = nullptr);
  void releaseGPUBuffer(void* buffer);
  void copyToGPU(void* buffer, const void* data, size_t size);
  void copyFromGPU(const void* buffer, void* data, size_t size);
  
  // GPU GF operations
  void gfMulVecGPU(const uint8_t* a, const uint8_t* b, uint8_t* out, 
                   size_t len, int field);
  void gfAddVecGPU(const uint8_t* a, const uint8_t* b, uint8_t* out,
                   size_t len, int field);
  
  // GPU matrix operations
  void matVecMulGPU(const uint8_t* matrix, const uint8_t* vec,
                    uint8_t* out, int rows, int cols, int field);
  
  // Batch encoding on GPU
  void batchEncodeGPU(const uint8_t** inputs, uint8_t** outputs,
                      const uint8_t* matrix, int batchSize,
                      int parityShards, int dataShards, int shardSize, int field);
}

#endif // METAL_BRIDGE_H
