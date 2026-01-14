# Memory Leak Detection Guide

This document describes how to detect and diagnose memory leaks in the `@digitaldefiance/node-rs-accelerate` library.

## Overview

Memory leaks in native Node.js addons can be challenging to detect and fix. This library includes comprehensive memory leak detection tests and tools to ensure memory safety.

**Property 21: Memory Safety** validates that the library properly manages memory across all operations, preventing leaks, use-after-free errors, and buffer overflows.

## Quick Start

Run memory leak detection tests:

```bash
# Run all memory leak detection tests with AddressSanitizer
npm run test:memory

# Run with verbose output and detailed logs
npm run test:memory:verbose

# Run with heap profiling enabled
npm run test:memory:heap

# Run only AddressSanitizer tests (skip heap profiling)
npm run test:memory:asan-only
```

## Tools and Techniques

### 1. AddressSanitizer (ASan) - Recommended

**What it detects:**
- Memory leaks
- Use-after-free errors
- Buffer overflows and underflows
- Double-free errors
- Stack buffer overflows

**How to use:**

```bash
# Automatic (recommended)
npm run test:memory

# Manual
npm run build:asan
ASAN_OPTIONS="detect_leaks=1" npm run test:properties -- --testPathPattern=memory_safety
```

**Interpreting results:**

AddressSanitizer will print detailed reports when it detects issues:

```
=================================================================
==12345==ERROR: LeakSanitizer: detected memory leaks

Direct leak of 256 byte(s) in 1 object(s) allocated from:
    #0 0x... in malloc
    #1 0x... in MyFunction src/native/encoder.cc:42
    #2 0x... in Encode src/native/encoder.cc:100
```

The stack trace shows where the leaked memory was allocated. Fix by ensuring proper cleanup in destructors or using RAII patterns.

### 2. Heap Profiling with Node.js

**What it detects:**
- Gradual memory growth over time
- Retained objects that should be garbage collected
- Memory usage patterns

**How to use:**

```bash
# Automatic
npm run test:memory:heap

# Manual
NODE_OPTIONS="--expose-gc" npm run test:properties -- --testPathPattern=memory_safety
```

**Interpreting results:**

The heap profiling test measures memory usage before and after 1000 encode/decode operations:

```
Memory growth after 1000 operations: 2.34 MB
```

Acceptable growth: < 10 MB for 1000 operations
Concerning growth: > 50 MB (indicates potential leak)

### 3. Xcode Instruments (macOS)

**What it detects:**
- Memory leaks in native code
- Allocation patterns
- Memory usage over time

**How to use:**

1. Build the project: `npm run build`
2. Open Xcode Instruments
3. Select "Leaks" template
4. Target: Node.js process running tests
5. Run: `npm run test:properties -- --testPathPattern=memory_safety`
6. Analyze the leak report

### 4. Valgrind (Linux only)

**Note:** Valgrind is not available on macOS/Apple Silicon. Use AddressSanitizer instead.

For Linux systems:

```bash
valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes node dist/test
```

## Memory Safety Tests

The library includes comprehensive property-based tests for memory safety:

### Test Coverage

1. **Repeated encoder creation/destruction** - Ensures encoders are properly cleaned up
2. **Repeated decoder creation/destruction** - Ensures decoders are properly cleaned up
3. **Repeated encode/decode cycles** - Ensures no accumulation over many operations
4. **Large data encoding** - Tests buffer overflow protection
5. **GF(2^16) initialization** - Tests large lookup table management
6. **Batch encoding** - Tests batch operation memory management
7. **Reconstruction** - Tests partial reconstruction memory handling
8. **Mixed matrix types** - Tests different matrix implementations
9. **Heap stability** - Measures actual memory growth over time

### Running Individual Tests

```bash
# Run all memory safety tests
npm run test:properties -- --testPathPattern=memory_safety

# Run specific test
npm run test:properties -- --testPathPattern=memory_safety -t "Repeated encoder"

# Run with coverage
npm run test:properties -- --testPathPattern=memory_safety --coverage
```

## Common Memory Issues and Solutions

### Issue 1: Memory Leak in Native Code

**Symptoms:**
- AddressSanitizer reports "detected memory leaks"
- Memory usage grows continuously

**Solutions:**
- Use RAII (Resource Acquisition Is Initialization) pattern
- Use smart pointers (`std::unique_ptr`, `std::shared_ptr`)
- Ensure destructors properly clean up resources
- Check for early returns that skip cleanup

**Example fix:**

```cpp
// Bad - manual memory management
uint8_t* buffer = new uint8_t[size];
// ... use buffer ...
delete[] buffer; // May be skipped on error

// Good - RAII with smart pointer
auto buffer = std::make_unique<uint8_t[]>(size);
// ... use buffer ...
// Automatically cleaned up
```

### Issue 2: Use-After-Free

**Symptoms:**
- AddressSanitizer reports "heap-use-after-free"
- Crashes or corrupted data

**Solutions:**
- Set pointers to nullptr after deletion
- Use smart pointers that prevent use-after-free
- Validate object lifetime in async operations

### Issue 3: Buffer Overflow

**Symptoms:**
- AddressSanitizer reports "heap-buffer-overflow"
- Data corruption

**Solutions:**
- Always validate buffer sizes before operations
- Use bounds checking for all array accesses
- Use safe string operations (strncpy vs strcpy)

### Issue 4: JavaScript Object Retention

**Symptoms:**
- Heap profiling shows growing memory
- No ASan errors

**Solutions:**
- Ensure proper cleanup of Napi::Reference objects
- Avoid circular references between JS and native
- Use weak references where appropriate

## Best Practices

### Native Code (C++)

1. **Use RAII everywhere**
   ```cpp
   class Encoder {
     std::unique_ptr<uint8_t[]> matrix_;
     std::unique_ptr<GFTables> tables_;
   public:
     ~Encoder() {
       // Automatic cleanup
     }
   };
   ```

2. **Validate all inputs**
   ```cpp
   if (data == nullptr || size == 0) {
     throw std::invalid_argument("Invalid input");
   }
   ```

3. **Use smart pointers for N-API objects**
   ```cpp
   Napi::ObjectReference persistent_ref_;
   // Automatically cleaned up
   ```

4. **Check allocation success**
   ```cpp
   auto buffer = std::make_unique<uint8_t[]>(size);
   if (!buffer) {
     throw std::bad_alloc();
   }
   ```

### TypeScript Code

1. **Don't hold references unnecessarily**
   ```typescript
   // Bad
   class Cache {
     private encoders: Map<string, ReedSolomonEncoder> = new Map();
   }
   
   // Good
   function encode(data: Uint8Array) {
     const encoder = new ReedSolomonEncoder(config);
     const result = encoder.encode(data);
     // encoder is garbage collected
     return result;
   }
   ```

2. **Clear large buffers when done**
   ```typescript
   const largeBuffer = new Uint8Array(1024 * 1024 * 100);
   // ... use buffer ...
   largeBuffer.fill(0); // Help GC
   ```

## Continuous Integration

Memory leak tests should be run in CI/CD:

```yaml
# .github/workflows/test.yml
- name: Memory Leak Detection
  run: npm run test:memory
  
- name: Upload ASan Logs
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: asan-logs
    path: asan.log.*
```

## Troubleshooting

### AddressSanitizer not working

**Problem:** Tests run but no ASan output

**Solutions:**
- Ensure you built with `npm run build:asan`
- Check that ASAN_OPTIONS is set: `echo $ASAN_OPTIONS`
- Verify ASan is in the binary: `otool -L build/Release/node_rs_accelerate.node | grep asan`

### False positives

**Problem:** ASan reports leaks in system libraries

**Solutions:**
- Use suppression file for known false positives
- Update to latest macOS/Xcode
- Check if leak is actually in your code

### Performance impact

**Problem:** Tests are very slow with ASan

**Solutions:**
- This is expected - ASan adds significant overhead
- Run ASan tests separately from regular tests
- Use `--asan-only` flag to skip heap profiling

## References

- [AddressSanitizer Documentation](https://clang.llvm.org/docs/AddressSanitizer.html)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [N-API Memory Management](https://nodejs.org/api/n-api.html#memory-management)
- [Xcode Instruments Guide](https://developer.apple.com/documentation/xcode/improving-your-app-s-performance)

## Support

If you encounter memory issues:

1. Run `npm run test:memory:verbose` to get detailed logs
2. Check the ASan logs in `asan.log.*` files
3. Review the stack traces to identify the source
4. Open an issue with the ASan output and reproduction steps
