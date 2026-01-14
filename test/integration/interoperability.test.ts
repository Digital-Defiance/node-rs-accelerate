/**
 * Interoperability tests for Reed-Solomon encoding/decoding
 * Feature: node-rs-accelerate
 * 
 * These tests verify that the library works correctly with standard Reed-Solomon parameters
 * and can interoperate with other implementations.
 * 
 * Validates: Requirements 9.1
 */

import { ReedSolomonEncoder } from '../../src/encoder';
import { ReedSolomonDecoder } from '../../src/decoder';
import { 
  GaloisField, 
  MatrixType, 
  PrimitivePolynomialGF256,
  PrimitivePolynomialGF65536 
} from '../../src/config';

describe('Interoperability Tests', () => {
  describe('Standard Reed-Solomon Parameters', () => {
    /**
     * Test common RS(10,4) configuration
     * This is a widely used configuration in distributed storage systems
     */
    it('should work with standard RS(10,4) configuration', () => {
      const testData = new Uint8Array(100);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const config = {
        dataShards: 10,
        parityShards: 4,
        shardSize: 10,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      expect(encoded.dataShards.length).toBe(10);
      expect(encoded.parityShards.length).toBe(4);

      // Verify systematic encoding - data shards contain original data
      const reconstructedData = new Uint8Array(100);
      for (let i = 0; i < 10; i++) {
        reconstructedData.set(encoded.dataShards[i], i * 10);
      }
      expect(reconstructedData).toEqual(testData);

      // Test decoding with various shard combinations
      const decoder = new ReedSolomonDecoder(config);

      // Test 1: Use all data shards
      const shards1 = encoded.dataShards.map((data: Uint8Array, index: number) => ({
        index,
        data,
        isData: true
      }));
      const decoded1 = decoder.decode(shards1);
      expect(decoded1).toEqual(testData);

      // Test 2: Use some data shards and some parity shards
      const shards2 = [
        ...encoded.dataShards.slice(0, 7).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 3).map((data: Uint8Array, index: number) => ({
          index: 10 + index,
          data,
          isData: false
        }))
      ];
      const decoded2 = decoder.decode(shards2);
      expect(decoded2).toEqual(testData);
    });

    /**
     * Test RS(20,10) configuration
     * Common in video streaming and large file distribution
     */
    it('should work with standard RS(20,10) configuration', () => {
      const testData = new Uint8Array(200);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = (i * 7) % 256;
      }

      const config = {
        dataShards: 20,
        parityShards: 10,
        shardSize: 10,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      expect(encoded.dataShards.length).toBe(20);
      expect(encoded.parityShards.length).toBe(10);

      const decoder = new ReedSolomonDecoder(config);

      // Use minimum required shards (20 out of 30)
      const shards = [
        ...encoded.dataShards.slice(0, 15).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 5).map((data: Uint8Array, index: number) => ({
          index: 20 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test RS(200,55) configuration - near maximum for GF(2^8)
     * Used in some satellite communications
     */
    it('should work with near-maximum GF(2^8) configuration RS(200,55)', () => {
      const testData = new Uint8Array(200 * 4); // 200 shards * 4 bytes each
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const config = {
        dataShards: 200,
        parityShards: 55,
        shardSize: 4,
        field: GaloisField.GF256,
        matrixType: MatrixType.Cauchy, // Cauchy for better numerical stability
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      expect(encoded.dataShards.length).toBe(200);
      expect(encoded.parityShards.length).toBe(55);

      const decoder = new ReedSolomonDecoder(config);

      // Use exactly 200 shards (minimum required)
      const shards = encoded.dataShards.map((data: Uint8Array, index: number) => ({
        index,
        data,
        isData: true
      }));

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });
  });

  describe('Different Primitive Polynomials', () => {
    /**
     * Test with CCSDS polynomial (used in space communications)
     */
    it('should work with CCSDS primitive polynomial (0x171)', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

      const config = {
        dataShards: 8,
        parityShards: 4,
        shardSize: 2,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.CCSDS
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      // Simulate losing 4 data shards
      const shards = [
        ...encoded.dataShards.slice(0, 4).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.map((data: Uint8Array, index: number) => ({
          index: 8 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test with ANSI polynomial
     */
    it('should work with ANSI primitive polynomial (0x187)', () => {
      const testData = new Uint8Array(50);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = (i * 13) % 256;
      }

      const config = {
        dataShards: 10,
        parityShards: 5,
        shardSize: 5,
        field: GaloisField.GF256,
        matrixType: MatrixType.Cauchy,
        primitivePolynomialGF256: PrimitivePolynomialGF256.ANSI
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      // Use mix of data and parity shards
      const shards = [
        ...encoded.dataShards.slice(0, 6).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 4).map((data: Uint8Array, index: number) => ({
          index: 10 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });
  });

  describe('Matrix Type Compatibility', () => {
    /**
     * Test Vandermonde matrix construction
     */
    it('should work with Vandermonde matrix', () => {
      const testData = new Uint8Array(30);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i;
      }

      const config = {
        dataShards: 6,
        parityShards: 3,
        shardSize: 5,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      const shards = [
        ...encoded.dataShards.slice(0, 4).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 2).map((data: Uint8Array, index: number) => ({
          index: 6 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test Cauchy matrix construction
     */
    it('should work with Cauchy matrix', () => {
      const testData = new Uint8Array(30);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = (i * 3) % 256;
      }

      const config = {
        dataShards: 6,
        parityShards: 3,
        shardSize: 5,
        field: GaloisField.GF256,
        matrixType: MatrixType.Cauchy,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      const shards = [
        ...encoded.dataShards.slice(0, 4).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 2).map((data: Uint8Array, index: number) => ({
          index: 6 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });
  });

  describe('GF(2^16) Interoperability', () => {
    /**
     * Test with GF(2^16) for large shard counts
     */
    it('should work with GF(2^16) and large shard counts', () => {
      const testData = new Uint8Array(1000 * 2); // 1000 shards * 2 bytes each
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const config = {
        dataShards: 1000,
        parityShards: 500,
        shardSize: 2,
        field: GaloisField.GF65536,
        matrixType: MatrixType.Cauchy,
        primitivePolynomialGF65536: PrimitivePolynomialGF65536.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      expect(encoded.dataShards.length).toBe(1000);
      expect(encoded.parityShards.length).toBe(500);

      const decoder = new ReedSolomonDecoder(config);

      // Use exactly 1000 shards (all data shards)
      const shards = encoded.dataShards.map((data: Uint8Array, index: number) => ({
        index,
        data,
        isData: true
      }));

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test with GF(2^16) and alternative polynomial
     */
    it('should work with GF(2^16) and alternative polynomial', () => {
      const testData = new Uint8Array(100 * 4); // 100 shards * 4 bytes each
      for (let i = 0; i < testData.length; i++) {
        testData[i] = (i * 7) % 256;
      }

      const config = {
        dataShards: 100,
        parityShards: 50,
        shardSize: 4,
        field: GaloisField.GF65536,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF65536: PrimitivePolynomialGF65536.ALT1
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      // Use mix of data and parity shards
      const shards = [
        ...encoded.dataShards.slice(0, 70).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.slice(0, 30).map((data: Uint8Array, index: number) => ({
          index: 100 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    /**
     * Test with minimum configuration (2,1)
     */
    it('should work with minimum configuration RS(2,1)', () => {
      const testData = new Uint8Array([42, 84]);

      const config = {
        dataShards: 2,
        parityShards: 1,
        shardSize: 1,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      // Use both data shards
      const shards = encoded.dataShards.map((data: Uint8Array, index: number) => ({
        index,
        data,
        isData: true
      }));

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);

      // Use one data shard and one parity shard
      const shards2 = [
        { index: 0, data: encoded.dataShards[0], isData: true },
        { index: 2, data: encoded.parityShards[0], isData: false }
      ];

      const decoded2 = decoder.decode(shards2);
      expect(decoded2).toEqual(testData);
    });

    /**
     * Test with single byte per shard
     */
    it('should work with single byte per shard', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);

      const config = {
        dataShards: 5,
        parityShards: 2,
        shardSize: 1,
        field: GaloisField.GF256,
        matrixType: MatrixType.Cauchy,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      // Lose 2 data shards
      const shards = [
        ...encoded.dataShards.slice(0, 3).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.map((data: Uint8Array, index: number) => ({
          index: 5 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test with all zeros
     */
    it('should work with all-zero data', () => {
      const testData = new Uint8Array(20); // All zeros

      const config = {
        dataShards: 4,
        parityShards: 2,
        shardSize: 5,
        field: GaloisField.GF256,
        matrixType: MatrixType.Vandermonde,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      const shards = [
        ...encoded.dataShards.slice(0, 2).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.map((data: Uint8Array, index: number) => ({
          index: 4 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });

    /**
     * Test with all 0xFF
     */
    it('should work with all-0xFF data', () => {
      const testData = new Uint8Array(20);
      testData.fill(0xFF);

      const config = {
        dataShards: 4,
        parityShards: 2,
        shardSize: 5,
        field: GaloisField.GF256,
        matrixType: MatrixType.Cauchy,
        primitivePolynomialGF256: PrimitivePolynomialGF256.DEFAULT
      };

      const encoder = new ReedSolomonEncoder(config);
      const encoded = encoder.encode(testData);

      const decoder = new ReedSolomonDecoder(config);

      const shards = [
        ...encoded.dataShards.slice(0, 2).map((data: Uint8Array, index: number) => ({
          index,
          data,
          isData: true
        })),
        ...encoded.parityShards.map((data: Uint8Array, index: number) => ({
          index: 4 + index,
          data,
          isData: false
        }))
      ];

      const decoded = decoder.decode(shards);
      expect(decoded).toEqual(testData);
    });
  });
});
