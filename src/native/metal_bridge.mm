/**
 * Metal GPU acceleration bridge implementation (Objective-C++)
 */

#include "metal_bridge.h"
#include "gf_arithmetic.h"
#import <Metal/Metal.h>
#import <Foundation/Foundation.h>
#include <stdexcept>
#include <string>
#include <cstring>
#include <vector>

namespace MetalAccel {
  // Global Metal state
  static id<MTLDevice> g_device = nil;
  static id<MTLCommandQueue> g_commandQueue = nil;
  static id<MTLLibrary> g_library = nil;
  static bool g_initialized = false;
  
  // Metal shader source code (embedded)
  static const char* g_shaderSource = R"(
#include <metal_stdlib>
using namespace metal;

kernel void gf256_mul_kernel(
    device const uint8_t* a [[buffer(0)]],
    device const uint8_t* b [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    device const uint8_t* log_table [[buffer(3)]],
    device const uint8_t* antilog_table [[buffer(4)]],
    uint id [[thread_position_in_grid]])
{
    uint8_t val_a = a[id];
    uint8_t val_b = b[id];
    
    if (val_a == 0 || val_b == 0) {
        result[id] = 0;
    } else {
        uint8_t log_a = log_table[val_a];
        uint8_t log_b = log_table[val_b];
        uint16_t log_sum = (uint16_t)log_a + (uint16_t)log_b;
        
        if (log_sum >= 255) {
            log_sum -= 255;
        }
        
        result[id] = antilog_table[log_sum];
    }
}

kernel void gf256_add_kernel(
    device const uint8_t* a [[buffer(0)]],
    device const uint8_t* b [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    uint id [[thread_position_in_grid]])
{
    result[id] = a[id] ^ b[id];
}

kernel void gf65536_mul_kernel(
    device const uint16_t* a [[buffer(0)]],
    device const uint16_t* b [[buffer(1)]],
    device uint16_t* result [[buffer(2)]],
    device const uint16_t* log_table [[buffer(3)]],
    device const uint16_t* antilog_table [[buffer(4)]],
    uint id [[thread_position_in_grid]])
{
    uint16_t val_a = a[id];
    uint16_t val_b = b[id];
    
    if (val_a == 0 || val_b == 0) {
        result[id] = 0;
    } else {
        uint16_t log_a = log_table[val_a];
        uint16_t log_b = log_table[val_b];
        uint32_t log_sum = (uint32_t)log_a + (uint32_t)log_b;
        
        if (log_sum >= 65535) {
            log_sum -= 65535;
        }
        
        result[id] = antilog_table[log_sum];
    }
}

kernel void gf65536_add_kernel(
    device const uint16_t* a [[buffer(0)]],
    device const uint16_t* b [[buffer(1)]],
    device uint16_t* result [[buffer(2)]],
    uint id [[thread_position_in_grid]])
{
    result[id] = a[id] ^ b[id];
}

kernel void gf256_matvec_kernel(
    device const uint8_t* matrix [[buffer(0)]],
    device const uint8_t* vector [[buffer(1)]],
    device uint8_t* result [[buffer(2)]],
    device const uint8_t* log_table [[buffer(3)]],
    device const uint8_t* antilog_table [[buffer(4)]],
    constant int& cols [[buffer(5)]],
    uint row [[thread_position_in_grid]])
{
    uint8_t sum = 0;
    for (int col = 0; col < cols; col++) {
        uint8_t m = matrix[row * cols + col];
        uint8_t v = vector[col];
        
        // GF multiply and accumulate
        if (m != 0 && v != 0) {
            uint8_t log_m = log_table[m];
            uint8_t log_v = log_table[v];
            uint16_t log_sum = (uint16_t)log_m + (uint16_t)log_v;
            
            if (log_sum >= 255) {
                log_sum -= 255;
            }
            
            uint8_t product = antilog_table[log_sum];
            sum ^= product;  // GF addition is XOR
        }
    }
    result[row] = sum;
}

kernel void gf65536_matvec_kernel(
    device const uint16_t* matrix [[buffer(0)]],
    device const uint16_t* vector [[buffer(1)]],
    device uint16_t* result [[buffer(2)]],
    device const uint16_t* log_table [[buffer(3)]],
    device const uint16_t* antilog_table [[buffer(4)]],
    constant int& cols [[buffer(5)]],
    uint row [[thread_position_in_grid]])
{
    uint16_t sum = 0;
    for (int col = 0; col < cols; col++) {
        uint16_t m = matrix[row * cols + col];
        uint16_t v = vector[col];
        
        // GF multiply and accumulate
        if (m != 0 && v != 0) {
            uint16_t log_m = log_table[m];
            uint16_t log_v = log_table[v];
            uint32_t log_sum = (uint32_t)log_m + (uint32_t)log_v;
            
            if (log_sum >= 65535) {
                log_sum -= 65535;
            }
            
            uint16_t product = antilog_table[log_sum];
            sum ^= product;  // GF addition is XOR
        }
    }
    result[row] = sum;
}
)";
  
  bool initMetal() {
    @autoreleasepool {
      // Check if already initialized
      if (g_initialized) {
        return true;
      }
      
      // Get default Metal device
      g_device = MTLCreateSystemDefaultDevice();
      if (g_device == nil) {
        // Metal not available - this is not an error, just means we fall back to CPU
        return false;
      }
      
      // Create command queue
      g_commandQueue = [g_device newCommandQueue];
      if (g_commandQueue == nil) {
        g_device = nil;
        return false;
      }
      
      // Compile shader library from source
      NSError* error = nil;
      NSString* shaderSource = [NSString stringWithUTF8String:g_shaderSource];
      g_library = [g_device newLibraryWithSource:shaderSource options:nil error:&error];
      if (g_library == nil) {
        // Shader compilation failed - log error but continue
        // We can still use CPU operations
        if (error != nil) {
          NSLog(@"Failed to compile Metal shaders: %@", [error localizedDescription]);
        }
        // Don't fail initialization - just mark as initialized without GPU support
      }
      
      g_initialized = true;
      return true;
    }
  }
  
  bool isMetalAvailable() {
    @autoreleasepool {
      // If already initialized, return the status
      if (g_initialized) {
        return g_device != nil;
      }
      
      // Otherwise, check if Metal device exists
      id<MTLDevice> device = MTLCreateSystemDefaultDevice();
      return device != nil;
    }
  }
  
  // GPU memory management functions
  void* createGPUBuffer(size_t size, const void* data) {
    @autoreleasepool {
      if (!g_initialized || g_device == nil) {
        throw std::runtime_error("Metal not initialized");
      }
      
      id<MTLBuffer> buffer;
      
      if (data != nullptr) {
        // Create buffer with initial data
        buffer = [g_device newBufferWithBytes:data
                                       length:size
                                      options:MTLResourceStorageModeShared];
      } else {
        // Create empty buffer
        buffer = [g_device newBufferWithLength:size
                                       options:MTLResourceStorageModeShared];
      }
      
      if (buffer == nil) {
        throw std::runtime_error("Failed to create Metal buffer");
      }
      
      // Retain the buffer and return as void*
      // Manual retain since we're not using ARC
      [buffer retain];
      return (__bridge void*)buffer;
    }
  }
  
  void releaseGPUBuffer(void* buffer) {
    @autoreleasepool {
      if (buffer == nullptr) {
        return;
      }
      
      // Release the buffer manually
      id<MTLBuffer> mtlBuffer = (__bridge id<MTLBuffer>)buffer;
      [mtlBuffer release];
    }
  }
  
  void copyToGPU(void* buffer, const void* data, size_t size) {
    @autoreleasepool {
      if (buffer == nullptr || data == nullptr) {
        throw std::runtime_error("Invalid buffer or data pointer");
      }
      
      id<MTLBuffer> mtlBuffer = (__bridge id<MTLBuffer>)buffer;
      
      if (mtlBuffer.length < size) {
        throw std::runtime_error("Buffer too small for data");
      }
      
      // Copy data to GPU buffer
      memcpy([mtlBuffer contents], data, size);
      
      // For non-shared buffers, we would need to call didModifyRange
      // But we're using MTLResourceStorageModeShared, so no sync needed
    }
  }
  
  void copyFromGPU(const void* buffer, void* data, size_t size) {
    @autoreleasepool {
      if (buffer == nullptr || data == nullptr) {
        throw std::runtime_error("Invalid buffer or data pointer");
      }
      
      id<MTLBuffer> mtlBuffer = (__bridge id<MTLBuffer>)buffer;
      
      if (mtlBuffer.length < size) {
        throw std::runtime_error("Buffer too small for data");
      }
      
      // Copy data from GPU buffer
      memcpy(data, [mtlBuffer contents], size);
    }
  }
  
  // GPU GF operations
  void gfMulVecGPU(const uint8_t* a, const uint8_t* b, uint8_t* out, 
                   size_t len, int field) {
    @autoreleasepool {
      if (!g_initialized || g_device == nil) {
        throw std::runtime_error("Metal not initialized");
      }
      
      if (g_library == nil) {
        throw std::runtime_error("Metal shaders not available");
      }
      
      // Get kernel function
      NSError* error = nil;
      NSString* kernelName = (field == 8) ? @"gf256_mul_kernel" : @"gf65536_mul_kernel";
      id<MTLFunction> kernelFunction = [g_library newFunctionWithName:kernelName];
      if (kernelFunction == nil) {
        throw std::runtime_error("Failed to find kernel function");
      }
      
      // Create pipeline state
      id<MTLComputePipelineState> pipelineState = [g_device newComputePipelineStateWithFunction:kernelFunction error:&error];
      if (pipelineState == nil) {
        std::string errorMsg = "Failed to create pipeline state";
        if (error != nil) {
          errorMsg += ": " + std::string([[error localizedDescription] UTF8String]);
        }
        throw std::runtime_error(errorMsg);
      }
      
      // Create buffers
      size_t elementSize = (field == 8) ? sizeof(uint8_t) : sizeof(uint16_t);
      size_t bufferSize = len * elementSize;
      
      id<MTLBuffer> bufferA = [g_device newBufferWithBytes:a length:bufferSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> bufferB = [g_device newBufferWithBytes:b length:bufferSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> bufferOut = [g_device newBufferWithLength:bufferSize options:MTLResourceStorageModeShared];
      
      // Create lookup table buffers
      id<MTLBuffer> logBuffer, antilogBuffer;
      if (field == 8) {
        const uint8_t* logTable = GF::getGF256LogTable();
        const uint8_t* antilogTable = GF::getGF256AntilogTable();
        logBuffer = [g_device newBufferWithBytes:logTable length:256 options:MTLResourceStorageModeShared];
        antilogBuffer = [g_device newBufferWithBytes:antilogTable length:256 options:MTLResourceStorageModeShared];
      } else {
        const uint16_t* logTable = GF::getGF65536LogTable();
        const uint16_t* antilogTable = GF::getGF65536AntilogTable();
        logBuffer = [g_device newBufferWithBytes:logTable length:65536 * sizeof(uint16_t) options:MTLResourceStorageModeShared];
        antilogBuffer = [g_device newBufferWithBytes:antilogTable length:65536 * sizeof(uint16_t) options:MTLResourceStorageModeShared];
      }
      
      // Create command buffer and encoder
      id<MTLCommandBuffer> commandBuffer = [g_commandQueue commandBuffer];
      id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
      
      [encoder setComputePipelineState:pipelineState];
      [encoder setBuffer:bufferA offset:0 atIndex:0];
      [encoder setBuffer:bufferB offset:0 atIndex:1];
      [encoder setBuffer:bufferOut offset:0 atIndex:2];
      [encoder setBuffer:logBuffer offset:0 atIndex:3];
      [encoder setBuffer:antilogBuffer offset:0 atIndex:4];
      
      // Calculate thread group size
      NSUInteger threadGroupSize = pipelineState.maxTotalThreadsPerThreadgroup;
      if (threadGroupSize > len) {
        threadGroupSize = len;
      }
      
      MTLSize threadgroupSize = MTLSizeMake(threadGroupSize, 1, 1);
      MTLSize gridSize = MTLSizeMake(len, 1, 1);
      
      [encoder dispatchThreads:gridSize threadsPerThreadgroup:threadgroupSize];
      [encoder endEncoding];
      
      // Execute and wait
      [commandBuffer commit];
      [commandBuffer waitUntilCompleted];
      
      // Copy result back
      memcpy(out, [bufferOut contents], bufferSize);
    }
  }
  
  void gfAddVecGPU(const uint8_t* a, const uint8_t* b, uint8_t* out,
                   size_t len, int field) {
    @autoreleasepool {
      if (!g_initialized || g_device == nil) {
        throw std::runtime_error("Metal not initialized");
      }
      
      if (g_library == nil) {
        throw std::runtime_error("Metal shaders not available");
      }
      
      // Get kernel function
      NSError* error = nil;
      NSString* kernelName = (field == 8) ? @"gf256_add_kernel" : @"gf65536_add_kernel";
      id<MTLFunction> kernelFunction = [g_library newFunctionWithName:kernelName];
      if (kernelFunction == nil) {
        throw std::runtime_error("Failed to find kernel function");
      }
      
      // Create pipeline state
      id<MTLComputePipelineState> pipelineState = [g_device newComputePipelineStateWithFunction:kernelFunction error:&error];
      if (pipelineState == nil) {
        std::string errorMsg = "Failed to create pipeline state";
        if (error != nil) {
          errorMsg += ": " + std::string([[error localizedDescription] UTF8String]);
        }
        throw std::runtime_error(errorMsg);
      }
      
      // Create buffers
      size_t elementSize = (field == 8) ? sizeof(uint8_t) : sizeof(uint16_t);
      size_t bufferSize = len * elementSize;
      
      id<MTLBuffer> bufferA = [g_device newBufferWithBytes:a length:bufferSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> bufferB = [g_device newBufferWithBytes:b length:bufferSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> bufferOut = [g_device newBufferWithLength:bufferSize options:MTLResourceStorageModeShared];
      
      // Create command buffer and encoder
      id<MTLCommandBuffer> commandBuffer = [g_commandQueue commandBuffer];
      id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
      
      [encoder setComputePipelineState:pipelineState];
      [encoder setBuffer:bufferA offset:0 atIndex:0];
      [encoder setBuffer:bufferB offset:0 atIndex:1];
      [encoder setBuffer:bufferOut offset:0 atIndex:2];
      
      // Calculate thread group size
      NSUInteger threadGroupSize = pipelineState.maxTotalThreadsPerThreadgroup;
      if (threadGroupSize > len) {
        threadGroupSize = len;
      }
      
      MTLSize threadgroupSize = MTLSizeMake(threadGroupSize, 1, 1);
      MTLSize gridSize = MTLSizeMake(len, 1, 1);
      
      [encoder dispatchThreads:gridSize threadsPerThreadgroup:threadgroupSize];
      [encoder endEncoding];
      
      // Execute and wait
      [commandBuffer commit];
      [commandBuffer waitUntilCompleted];
      
      // Copy result back
      memcpy(out, [bufferOut contents], bufferSize);
    }
  }
  
  void matVecMulGPU(const uint8_t* matrix, const uint8_t* vec,
                    uint8_t* out, int rows, int cols, int field) {
    @autoreleasepool {
      if (!g_initialized || g_device == nil) {
        throw std::runtime_error("Metal not initialized");
      }
      
      if (g_library == nil) {
        throw std::runtime_error("Metal shaders not available");
      }
      
      // Get kernel function
      NSError* error = nil;
      NSString* kernelName = (field == 8) ? @"gf256_matvec_kernel" : @"gf65536_matvec_kernel";
      id<MTLFunction> kernelFunction = [g_library newFunctionWithName:kernelName];
      if (kernelFunction == nil) {
        throw std::runtime_error("Failed to find kernel function");
      }
      
      // Create pipeline state
      id<MTLComputePipelineState> pipelineState = [g_device newComputePipelineStateWithFunction:kernelFunction error:&error];
      if (pipelineState == nil) {
        std::string errorMsg = "Failed to create pipeline state";
        if (error != nil) {
          errorMsg += ": " + std::string([[error localizedDescription] UTF8String]);
        }
        throw std::runtime_error(errorMsg);
      }
      
      // Create buffers
      size_t elementSize = (field == 8) ? sizeof(uint8_t) : sizeof(uint16_t);
      size_t matrixSize = rows * cols * elementSize;
      size_t vectorSize = cols * elementSize;
      size_t resultSize = rows * elementSize;
      
      id<MTLBuffer> matrixBuffer = [g_device newBufferWithBytes:matrix length:matrixSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> vectorBuffer = [g_device newBufferWithBytes:vec length:vectorSize options:MTLResourceStorageModeShared];
      id<MTLBuffer> resultBuffer = [g_device newBufferWithLength:resultSize options:MTLResourceStorageModeShared];
      
      // Create lookup table buffers
      id<MTLBuffer> logBuffer, antilogBuffer;
      if (field == 8) {
        const uint8_t* logTable = GF::getGF256LogTable();
        const uint8_t* antilogTable = GF::getGF256AntilogTable();
        logBuffer = [g_device newBufferWithBytes:logTable length:256 options:MTLResourceStorageModeShared];
        antilogBuffer = [g_device newBufferWithBytes:antilogTable length:256 options:MTLResourceStorageModeShared];
      } else {
        const uint16_t* logTable = GF::getGF65536LogTable();
        const uint16_t* antilogTable = GF::getGF65536AntilogTable();
        logBuffer = [g_device newBufferWithBytes:logTable length:65536 * sizeof(uint16_t) options:MTLResourceStorageModeShared];
        antilogBuffer = [g_device newBufferWithBytes:antilogTable length:65536 * sizeof(uint16_t) options:MTLResourceStorageModeShared];
      }
      
      // Create buffer for cols parameter
      id<MTLBuffer> colsBuffer = [g_device newBufferWithBytes:&cols length:sizeof(int) options:MTLResourceStorageModeShared];
      
      // Create command buffer and encoder
      id<MTLCommandBuffer> commandBuffer = [g_commandQueue commandBuffer];
      id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
      
      [encoder setComputePipelineState:pipelineState];
      [encoder setBuffer:matrixBuffer offset:0 atIndex:0];
      [encoder setBuffer:vectorBuffer offset:0 atIndex:1];
      [encoder setBuffer:resultBuffer offset:0 atIndex:2];
      [encoder setBuffer:logBuffer offset:0 atIndex:3];
      [encoder setBuffer:antilogBuffer offset:0 atIndex:4];
      [encoder setBuffer:colsBuffer offset:0 atIndex:5];
      
      // Calculate thread group size
      // Each thread computes one row of the result
      NSUInteger threadGroupSize = pipelineState.maxTotalThreadsPerThreadgroup;
      if (threadGroupSize > (NSUInteger)rows) {
        threadGroupSize = rows;
      }
      
      MTLSize threadgroupSize = MTLSizeMake(threadGroupSize, 1, 1);
      MTLSize gridSize = MTLSizeMake(rows, 1, 1);
      
      [encoder dispatchThreads:gridSize threadsPerThreadgroup:threadgroupSize];
      [encoder endEncoding];
      
      // Execute and wait
      [commandBuffer commit];
      [commandBuffer waitUntilCompleted];
      
      // Copy result back
      memcpy(out, [resultBuffer contents], resultSize);
    }
  }
  
  void batchEncodeGPU(const uint8_t** inputs, uint8_t** outputs,
                      const uint8_t* matrix, int batchSize,
                      int parityShards, int dataShards, int shardSize, int field) {
    @autoreleasepool {
      if (!g_initialized || g_device == nil) {
        throw std::runtime_error("Metal not initialized");
      }
      
      if (g_library == nil) {
        throw std::runtime_error("Metal shaders not available");
      }
      
      // Batch encoding: process all items sequentially but with shared Metal context
      // The key benefit is amortizing Metal initialization overhead across multiple encodes
      // and keeping the GPU warm for better performance
      //
      // Matrix dimensions: (dataShards + parityShards) × dataShards
      // We use rows dataShards through (dataShards + parityShards - 1) for parity generation
      
      for (int b = 0; b < batchSize; b++) {
        // For each parity shard
        for (int p = 0; p < parityShards; p++) {
          // Get the row from the encoding matrix for this parity shard
          // Parity rows start at index dataShards
          const uint8_t* matrixRow = matrix + (dataShards + p) * dataShards;
          
          // Output pointer for this parity shard
          uint8_t* parityShard = outputs[b] + p * shardSize;
          
          // Initialize parity shard to zero
          std::memset(parityShard, 0, shardSize);
          
          // For each data shard
          for (int d = 0; d < dataShards; d++) {
            uint8_t coeff = matrixRow[d];
            
            // Skip if coefficient is zero (optimization)
            if (coeff == 0) {
              continue;
            }
            
            // Get pointer to this data shard
            const uint8_t* dataShard = inputs[b] + d * shardSize;
            
            // Create coefficient vector and temp result
            std::vector<uint8_t> coeffVec(shardSize, coeff);
            std::vector<uint8_t> tempResult(shardSize);
            
            // Use GPU to multiply (this function handles its own command buffer)
            try {
              gfMulVecGPU(coeffVec.data(), dataShard, tempResult.data(), shardSize, field);
              
              // XOR into parity shard
              for (int i = 0; i < shardSize; i++) {
                parityShard[i] ^= tempResult[i];
              }
            } catch (const std::exception& e) {
              // Fall back to CPU for this operation
              for (int i = 0; i < shardSize; i++) {
                if (dataShard[i] != 0) {
                  uint8_t product = GF::mul8(coeff, dataShard[i]);
                  parityShard[i] ^= product;
                }
              }
            }
          }
        }
      }
    }
  }
}
