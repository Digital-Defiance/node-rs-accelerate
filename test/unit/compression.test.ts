/**
 * Unit tests for compression utilities
 */

import { compressDataSync, decompressDataSync } from '../../src/compression';
import { CompressionConfig } from '../../src/config';

describe('Compression Utilities', () => {
  it('should compress and decompress data with gzip', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'gzip',
      level: 6
    };
    
    const originalData = new Uint8Array(1000);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const compressed = compressDataSync(originalData, config);
    expect(compressed.length).toBeGreaterThan(0);
    
    const decompressed = decompressDataSync(compressed, config);
    expect(decompressed.length).toBe(originalData.length);
    
    for (let i = 0; i < originalData.length; i++) {
      expect(decompressed[i]).toBe(originalData[i]);
    }
  });

  it('should compress and decompress data with deflate', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'deflate',
      level: 6
    };
    
    const originalData = new Uint8Array(1000);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const compressed = compressDataSync(originalData, config);
    expect(compressed.length).toBeGreaterThan(0);
    
    const decompressed = decompressDataSync(compressed, config);
    expect(decompressed.length).toBe(originalData.length);
    
    for (let i = 0; i < originalData.length; i++) {
      expect(decompressed[i]).toBe(originalData[i]);
    }
  });

  it('should compress and decompress data with brotli', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'brotli',
      level: 6
    };
    
    const originalData = new Uint8Array(1000);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const compressed = compressDataSync(originalData, config);
    expect(compressed.length).toBeGreaterThan(0);
    
    const decompressed = decompressDataSync(compressed, config);
    expect(decompressed.length).toBe(originalData.length);
    
    for (let i = 0; i < originalData.length; i++) {
      expect(decompressed[i]).toBe(originalData[i]);
    }
  });

  it('should return original data when compression is disabled', () => {
    const config: CompressionConfig = {
      enabled: false
    };
    
    const originalData = new Uint8Array(1000);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const compressed = compressDataSync(originalData, config);
    expect(compressed).toBe(originalData);
    
    const decompressed = decompressDataSync(compressed, config);
    expect(decompressed).toBe(originalData);
  });

  it('should throw error for invalid compression level', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'gzip',
      level: 15 // Invalid
    };
    
    const data = new Uint8Array(100);
    
    expect(() => {
      compressDataSync(data, config);
    }).toThrow(/compression level/i);
  });

  it('should throw error for unsupported algorithm', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'invalid' as any,
      level: 6
    };
    
    const data = new Uint8Array(100);
    
    expect(() => {
      compressDataSync(data, config);
    }).toThrow(/unsupported.*algorithm/i);
  });

  it('should compress repetitive data efficiently', () => {
    const config: CompressionConfig = {
      enabled: true,
      algorithm: 'gzip',
      level: 9
    };
    
    // Create highly repetitive data
    const originalData = new Uint8Array(10000);
    originalData.fill(42);
    
    const compressed = compressDataSync(originalData, config);
    
    // Compressed size should be much smaller than original
    expect(compressed.length).toBeLessThan(originalData.length / 10);
    
    const decompressed = decompressDataSync(compressed, config);
    expect(decompressed.length).toBe(originalData.length);
    
    for (let i = 0; i < originalData.length; i++) {
      expect(decompressed[i]).toBe(42);
    }
  });
});
