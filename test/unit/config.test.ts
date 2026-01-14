/**
 * Configuration validation tests
 */

import { validateConfig, estimateMemoryUsage, shouldUseGPU } from '../../src/utils';
import { GaloisField, MatrixType } from '../../src/config';
import { ConfigurationError } from '../../src/errors';

describe('Configuration Validation', () => {
  describe('validateConfig', () => {
    it('should accept valid configuration', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 1024
      };
      
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject zero data shards', () => {
      const config = {
        dataShards: 0,
        parityShards: 4,
        shardSize: 1024
      };
      
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
      expect(() => validateConfig(config)).toThrow('dataShards must be positive');
    });

    it('should reject zero parity shards', () => {
      const config = {
        dataShards: 10,
        parityShards: 0,
        shardSize: 1024
      };
      
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
      expect(() => validateConfig(config)).toThrow('parityShards must be positive');
    });

    it('should reject zero shard size', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 0
      };
      
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
      expect(() => validateConfig(config)).toThrow('shardSize must be positive');
    });

    it('should reject total shards exceeding GF(2^8) limit', () => {
      const config = {
        dataShards: 200,
        parityShards: 100,
        shardSize: 1024,
        field: GaloisField.GF256
      };
      
      expect(() => validateConfig(config)).toThrow(ConfigurationError);
      expect(() => validateConfig(config)).toThrow('exceeds field size');
    });

    it('should accept large shard counts for GF(2^16)', () => {
      const config = {
        dataShards: 1000,
        parityShards: 500,
        shardSize: 1024,
        field: GaloisField.GF65536
      };
      
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate memory for small configuration', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 1024
      };
      
      const memory = estimateMemoryUsage(config);
      expect(memory).toBeGreaterThan(0);
      expect(memory).toBeGreaterThan(14 * 1024); // At least shard memory
    });

    it('should estimate more memory for larger configuration', () => {
      const smallConfig = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 1024
      };
      
      const largeConfig = {
        dataShards: 100,
        parityShards: 50,
        shardSize: 10240
      };
      
      const smallMemory = estimateMemoryUsage(smallConfig);
      const largeMemory = estimateMemoryUsage(largeConfig);
      
      expect(largeMemory).toBeGreaterThan(smallMemory);
    });
  });

  describe('shouldUseGPU', () => {
    it('should use CPU for small shards', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 1024 // 1KB < 10KB threshold
      };
      
      expect(shouldUseGPU(config)).toBe(false);
    });

    it('should use GPU for large shards', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 100 * 1024 // 100KB > 10KB threshold
      };
      
      expect(shouldUseGPU(config)).toBe(true);
    });

    it('should respect explicit useGPU setting', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 1024,
        useGPU: true
      };
      
      expect(shouldUseGPU(config)).toBe(true);
    });

    it('should respect custom GPU threshold', () => {
      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 2048,
        gpuThreshold: 1024
      };
      
      expect(shouldUseGPU(config)).toBe(true);
    });
  });
});
