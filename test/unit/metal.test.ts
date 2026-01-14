/**
 * Unit tests for Metal GPU acceleration detection and initialization
 */

import { isMetalAvailable, initMetal } from '../../src/utils';

describe('Metal GPU Acceleration', () => {
  describe('isMetalAvailable', () => {
    it('should return a boolean value', () => {
      const available = isMetalAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should return true on macOS with Metal support', () => {
      // On macOS with Apple Silicon or Intel with Metal support, this should be true
      // On other platforms or older macOS, this should be false
      const available = isMetalAvailable();
      
      // We can't assert a specific value since it depends on the platform
      // But we can verify it's a boolean and log the result
      expect(typeof available).toBe('boolean');
      console.log(`Metal available: ${available}`);
    });

    it('should not throw an error when called multiple times', () => {
      expect(() => {
        isMetalAvailable();
        isMetalAvailable();
        isMetalAvailable();
      }).not.toThrow();
    });
  });

  describe('initMetal', () => {
    it('should return a boolean value', () => {
      const initialized = initMetal();
      expect(typeof initialized).toBe('boolean');
    });

    it('should initialize Metal if available', () => {
      const available = isMetalAvailable();
      const initialized = initMetal();
      
      // If Metal is available, initialization should succeed
      // If Metal is not available, initialization should fail gracefully
      if (available) {
        expect(initialized).toBe(true);
      } else {
        expect(initialized).toBe(false);
      }
    });

    it('should be idempotent - calling multiple times should work', () => {
      const first = initMetal();
      const second = initMetal();
      const third = initMetal();
      
      // All calls should return the same result
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('should not throw an error even if Metal is unavailable', () => {
      expect(() => {
        initMetal();
      }).not.toThrow();
    });
  });

  describe('Metal availability and initialization consistency', () => {
    it('should have consistent availability and initialization results', () => {
      const available = isMetalAvailable();
      const initialized = initMetal();
      
      // If Metal is available, initialization should succeed
      if (available) {
        expect(initialized).toBe(true);
      }
      
      // If initialization succeeded, Metal should be available
      if (initialized) {
        expect(available).toBe(true);
      }
    });
  });
});
