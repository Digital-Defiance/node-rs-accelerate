/**
 * Debug test for GPU encoding
 */

import { ReedSolomonEncoder } from '../src/encoder';
import { ReedSolomonDecoder } from '../src/decoder';
import { initMetal, isMetalAvailable } from '../src/utils';

describe('Debug GPU Encoding', () => {
  it('should encode with small shard size using GPU', () => {
    console.log('Metal available:', isMetalAvailable());
    console.log('Metal initialized:', initMetal());
    
    const config = {
      dataShards: 2,
      parityShards: 1,
      shardSize: 11 * 1024, // 11KB to trigger GPU
      useGPU: true
    };
    
    const data = new Uint8Array(config.dataShards * config.shardSize);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    
    console.log('Creating encoder...');
    const encoder = new ReedSolomonEncoder(config);
    
    console.log('Encoding...');
    const encoded = encoder.encode(data);
    
    console.log('Encoded successfully!');
    expect(encoded.dataShards.length).toBe(2);
    expect(encoded.parityShards.length).toBe(1);
  });
});
