# Troubleshooting Guide

This guide covers common issues and solutions for @digitaldefiance/node-rs-accelerate.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Memory Issues](#memory-issues)
- [GPU/Metal Issues](#gpumetal-issues)

---

## Installation Issues

### Native Module Compilation Failed

**Symptoms:**
```
gyp ERR! build error
error: no member named 'xxx' in namespace 'xxx'
```

**Solutions:**

1. **Install Xcode Command Line Tools:**
   ```bash
   xcode-select --install
   ```

2. **Update node-gyp:**
   ```bash
   npm install -g node-gyp
   ```

3. **Clear npm cache and rebuild:**
   ```bash
   rm -rf node_modules
   npm cache clean --force
   npm install
   ```

4. **Check Node.js version:**
   ```bash
   node --version  # Must be >= 16.0.0
   ```

### "Unsupported platform" Error

**Symptoms:**
```
npm ERR! notsup Unsupported platform for @digitaldefiance/node-rs-accelerate
```

**Cause:** This library only supports macOS on ARM64 (Apple Silicon).

**Solutions:**
- Use a Mac with Apple Silicon (M1/M2/M3/M4)
- For Intel Macs, the library is not supported
- For other platforms, consider alternative Reed-Solomon libraries

### Missing Framework Errors

**Symptoms:**
```
ld: framework not found Accelerate
ld: framework not found Metal
```

**Solutions:**

1. **Ensure Xcode is installed:**
   ```bash
   xcode-select -p
   # Should show: /Applications/Xcode.app/Contents/Developer
   ```

2. **Accept Xcode license:**
   ```bash
   sudo xcodebuild -license accept
   ```

3. **Install macOS SDK:**
   ```bash
   xcode-select --install
   ```


---

## Runtime Errors

### ConfigurationError: Invalid Configuration

**Symptoms:**
```
ConfigurationError: dataShards must be positive
ConfigurationError: Total shards (300) exceeds field size (256)
```

**Solutions:**

1. **Check shard counts:**
   ```typescript
   // For GF(2^8): K + M <= 256
   // For GF(2^16): K + M <= 65536
   
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,      // Must be > 0
     parityShards: 4,     // Must be > 0
     shardSize: 1024,     // Must be > 0
     field: GaloisField.GF256  // Max 256 total shards
   });
   ```

2. **Use GF(2^16) for large shard counts:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 1000,
     parityShards: 500,
     shardSize: 1024,
     field: GaloisField.GF65536  // Supports up to 65536 shards
   });
   ```

### InsufficientShardsError

**Symptoms:**
```
InsufficientShardsError: Insufficient shards for decoding: need 10, have 8
```

**Solutions:**

1. **Ensure you have at least K shards:**
   ```typescript
   const K = 10;  // Data shards
   
   // Need at least K shards (any combination of data + parity)
   if (availableShards.length < K) {
     console.error(`Need ${K} shards, have ${availableShards.length}`);
   }
   ```

2. **Check before decoding:**
   ```typescript
   if (!decoder.canDecode(shardIndices)) {
     console.error('Insufficient shards');
     return;
   }
   const decoded = decoder.decode(shards);
   ```

### NativeError: Input Data Size Mismatch

**Symptoms:**
```
NativeError: Input data size (5000) must equal dataShards * shardSize (10240)
```

**Solutions:**

1. **Ensure data size matches configuration:**
   ```typescript
   const K = 10;
   const shardSize = 1024;
   const expectedSize = K * shardSize;  // 10240 bytes
   
   // Pad data if needed
   const paddedData = new Uint8Array(expectedSize);
   paddedData.set(originalData);
   
   const encoded = encoder.encode(paddedData);
   ```

2. **Use compression for variable-size data:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 1024,
     compression: { enabled: true }  // Handles variable sizes
   });
   ```

### CorruptionError: Hash Validation Failed

**Symptoms:**
```
CorruptionError: Hash validation failed for shard 3
```

**Solutions:**

1. **Verify shard data integrity:**
   ```typescript
   // Check if shard was corrupted during transmission/storage
   const crypto = require('crypto');
   const actualHash = crypto.createHash('sha256')
     .update(shard.data)
     .digest('hex');
   
   console.log(`Expected: ${shard.hash}`);
   console.log(`Actual: ${actualHash}`);
   ```

2. **Use more parity shards:**
   ```typescript
   // Increase M to tolerate more corruption
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 6,  // Can now lose 6 shards
     shardSize: 1024
   });
   ```


---

## Performance Issues

### Slow Encoding/Decoding

**Symptoms:**
- Throughput much lower than expected
- High CPU usage but low throughput

**Solutions:**

1. **Increase shard size:**
   ```typescript
   // Small shards have high overhead
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 64 * 1024  // 64KB instead of 1KB
   });
   ```

2. **Use batch encoding:**
   ```typescript
   // Instead of individual encoding
   const results = encoder.batchEncode(blocks);
   ```

3. **Reuse encoder instances:**
   ```typescript
   // Create once, reuse many times
   const encoder = new ReedSolomonEncoder(config);
   
   for (const data of dataBlocks) {
     encoder.encode(data);  // Reuses cached matrix
   }
   ```

4. **Disable unnecessary features:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 64 * 1024
     // No compression or hash validation
   });
   ```

### GPU Not Being Used

**Symptoms:**
- Expected GPU acceleration but CPU is being used
- `shouldUseGPU()` returns false

**Solutions:**

1. **Check Metal availability:**
   ```typescript
   import { isMetalAvailable, initMetal } from '@digitaldefiance/node-rs-accelerate';
   
   console.log('Metal available:', isMetalAvailable());
   console.log('Metal initialized:', initMetal());
   ```

2. **Increase shard size above threshold:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 100 * 1024,  // Above default 10KB threshold
     gpuThreshold: 10 * 1024
   });
   ```

3. **Force GPU usage:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 1024,
     useGPU: true  // Force GPU
   });
   ```

### High Memory Usage

**Symptoms:**
- Node.js process using excessive memory
- Out of memory errors

**Solutions:**

1. **Use streaming API:**
   ```typescript
   // Instead of loading entire file
   await pipeline(
     createReadStream('large-file.dat'),
     encoder.encodeStream(),
     // Process chunks
   );
   ```

2. **Process in smaller chunks:**
   ```typescript
   const CHUNK_SIZE = 100 * 1024 * 1024;  // 100MB
   
   for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
     const chunk = readChunk(file, offset, CHUNK_SIZE);
     const encoded = encoder.encode(chunk);
     // Process and release
   }
   ```

3. **Reduce configuration size:**
   ```typescript
   // Smaller configuration = less memory
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,    // Instead of 100
     parityShards: 4,   // Instead of 50
     shardSize: 64 * 1024
   });
   ```


---

## Platform-Specific Issues

### macOS Version Compatibility

**Symptoms:**
```
Error: Metal requires macOS 11.0 or later
```

**Solutions:**
- Upgrade to macOS 11.0 (Big Sur) or later
- Metal GPU acceleration requires macOS 11.0+
- CPU operations work on macOS 10.15+ but are not officially supported

### Apple Silicon vs Intel

**Symptoms:**
```
Error: This library requires Apple Silicon (ARM64)
```

**Solutions:**
- This library is optimized for and only supports Apple Silicon
- For Intel Macs, consider alternative libraries:
  - `reed-solomon-erasure` (pure JavaScript)
  - `galois` (WebAssembly)

### Rosetta 2 Issues

**Symptoms:**
- Library works but performance is poor
- Running under Rosetta 2 translation

**Solutions:**

1. **Check architecture:**
   ```bash
   node -p "process.arch"
   # Should be: arm64
   ```

2. **Ensure native ARM64 Node.js:**
   ```bash
   # Download ARM64 version from nodejs.org
   # Or use nvm:
   arch -arm64 nvm install 20
   ```

3. **Rebuild native modules:**
   ```bash
   rm -rf node_modules
   npm install
   ```

---

## Memory Issues

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Process eventually crashes with OOM

**Solutions:**

1. **Run memory leak tests:**
   ```bash
   yarn test:memory
   ```

2. **Check for retained references:**
   ```typescript
   // Bad: retaining encoded data
   const allEncoded = [];
   for (const data of dataBlocks) {
     allEncoded.push(encoder.encode(data));  // Memory grows!
   }
   
   // Good: process and release
   for (const data of dataBlocks) {
     const encoded = encoder.encode(data);
     await processAndStore(encoded);
     // encoded goes out of scope
   }
   ```

3. **Use streaming for large files:**
   ```typescript
   // Constant memory usage
   await pipeline(
     createReadStream('large-file.dat'),
     encoder.encodeStream(),
     createWriteStream('encoded.dat')
   );
   ```

### Out of Memory Errors

**Symptoms:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js heap size:**
   ```bash
   node --max-old-space-size=4096 your-script.js
   ```

2. **Reduce data size per operation:**
   ```typescript
   // Process in smaller chunks
   const CHUNK_SIZE = 50 * 1024 * 1024;  // 50MB
   ```

3. **Use streaming API:**
   ```typescript
   const stream = encoder.encodeStream();
   ```


---

## GPU/Metal Issues

### Metal Not Available

**Symptoms:**
```typescript
isMetalAvailable() // returns false
```

**Solutions:**

1. **Check macOS version:**
   ```bash
   sw_vers -productVersion
   # Must be 11.0 or later
   ```

2. **Check for Metal support:**
   ```bash
   system_profiler SPDisplaysDataType | grep Metal
   ```

3. **Ensure not running in VM:**
   - Metal is not available in most virtual machines
   - Use a physical Mac with Apple Silicon

### Metal Initialization Failed

**Symptoms:**
```
MetalError: Failed to initialize Metal device
```

**Solutions:**

1. **Check GPU availability:**
   ```bash
   system_profiler SPDisplaysDataType
   ```

2. **Restart the system:**
   - Sometimes Metal resources get stuck
   - A restart can resolve initialization issues

3. **Check for GPU driver issues:**
   ```bash
   # Check system logs
   log show --predicate 'subsystem == "com.apple.Metal"' --last 1h
   ```

### GPU Out of Memory

**Symptoms:**
```
MetalError: GPU allocation failed
```

**Solutions:**

1. **Reduce batch size:**
   ```typescript
   // Instead of large batches
   const results = encoder.batchEncode(blocks.slice(0, 10));
   ```

2. **Use smaller shard sizes:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 64 * 1024  // Smaller shards
   });
   ```

3. **Fall back to CPU:**
   ```typescript
   const encoder = new ReedSolomonEncoder({
     dataShards: 10,
     parityShards: 4,
     shardSize: 1024 * 1024,
     useGPU: false  // Use CPU instead
   });
   ```

### GPU Performance Lower Than Expected

**Symptoms:**
- GPU is being used but performance is poor
- CPU outperforms GPU

**Solutions:**

1. **Increase shard size:**
   - GPU has overhead; needs large operations to amortize
   - Try shardSize >= 100KB

2. **Use batch encoding:**
   ```typescript
   // Amortize GPU overhead across multiple blocks
   const results = encoder.batchEncode(blocks);
   ```

3. **Check for thermal throttling:**
   - GPU may throttle under sustained load
   - Allow cooling between benchmarks

---

## Getting Help

If you're still experiencing issues:

1. **Check existing issues:**
   https://github.com/digitaldefiance/node-rs-accelerate/issues

2. **Create a new issue with:**
   - Node.js version (`node --version`)
   - macOS version (`sw_vers`)
   - Chip type (`uname -m`)
   - Full error message and stack trace
   - Minimal reproduction code

3. **Run diagnostics:**
   ```typescript
   import { isMetalAvailable, initMetal } from '@digitaldefiance/node-rs-accelerate';
   
   console.log('Node.js:', process.version);
   console.log('Platform:', process.platform);
   console.log('Arch:', process.arch);
   console.log('Metal available:', isMetalAvailable());
   console.log('Metal initialized:', initMetal());
   ```
