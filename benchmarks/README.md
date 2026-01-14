# Benchmarks

This directory contains comprehensive benchmarks for the @digitaldefiance/node-rs-accelerate library.

## Overview

The benchmark suite measures performance across three key areas:

1. **Encoding Performance** - Various (K, M) configurations and data sizes
2. **Decoding Performance** - Different erasure patterns and reconstruction scenarios
3. **Galois Field Operations** - Scalar vs vectorized operations, CPU vs GPU

## Running Benchmarks

### Run All Benchmarks

```bash
npm run benchmark
```

This will run the complete benchmark suite and generate reports in `benchmarks/reports/`.

### Run Individual Benchmarks

```bash
# Encoding benchmarks only
node benchmarks/encoding.js

# Decoding benchmarks only
node benchmarks/decoding.js

# Galois Field operations benchmarks only
node benchmarks/gf_operations.js

# NEON optimization benchmarks
node benchmarks/neon_benchmark.js

# Accelerate framework benchmarks
node benchmarks/accelerate_benchmark.js
```

## Benchmark Configurations

### Encoding Benchmarks

Tests the following configurations:
- **(10, 4)** - 10 data shards, 4 parity shards
- **(20, 10)** - 20 data shards, 10 parity shards
- **(50, 20)** - 50 data shards, 20 parity shards
- **(100, 50)** - 100 data shards, 50 parity shards
- **(255, 128)** - 255 data shards, 128 parity shards (max for GF(2^8))

Data sizes tested:
- 1KB
- 10KB
- 100KB
- 1MB
- 10MB

For each configuration and size, benchmarks measure:
- CPU encoding performance
- GPU encoding performance (for larger data)
- Throughput (bytes/second)
- Average, min, and max encoding times

### Decoding Benchmarks

Tests the following erasure patterns:
- **No erasures** - All data shards available (baseline)
- **Random erasures** - Random selection of K shards from K+M
- **Sequential erasures** - First K shards (worst case for some implementations)
- **Burst erasures** - Consecutive missing shards in the middle

For each pattern, benchmarks measure:
- CPU decoding performance
- GPU decoding performance (for larger data)
- Reconstruction throughput
- Impact of erasure pattern on performance

### Galois Field Operations Benchmarks

Tests both GF(2^8) and GF(2^16) operations:

**Scalar operations:**
- Addition (XOR)
- Multiplication
- Division
- Inverse
- Power

**Vectorized operations:**
- Scalar implementation (baseline)
- Accelerate framework optimized
- Speedup comparison

Vector sizes tested:
- 1KB
- 10KB
- 100KB
- 1MB
- 10MB

## Output

### Console Output

Benchmarks print detailed results to the console, including:
- Individual test results
- Summary statistics
- Performance comparisons
- Speedup calculations

### Generated Reports

The main benchmark runner (`npm run benchmark`) generates two report files in `benchmarks/reports/`:

1. **Markdown Report** (`benchmark-report-YYYY-MM-DD.md`)
   - Human-readable tables
   - Summary statistics
   - Performance targets comparison
   - Easy to include in documentation

2. **JSON Report** (`benchmark-report-YYYY-MM-DD.json`)
   - Machine-readable format
   - Complete raw data
   - Suitable for automated analysis
   - Can be used for performance tracking over time

## Performance Targets

From the requirements specification:

- **Target 1:** 10x speedup over pure JavaScript for 100+ shards
- **Target 2:** 50x speedup with GPU acceleration for 1000+ shards

The benchmark reports include a section comparing actual performance against these targets.

## Interpreting Results

### Throughput

Higher throughput (bytes/second) is better. This measures how much data can be encoded/decoded per second.

### Speedup

Speedup is calculated as: `CPU time / GPU time` or `Scalar time / Accelerate time`

A speedup of 2x means the optimized version is twice as fast.

### Erasure Pattern Impact

The decoding benchmarks show how different erasure patterns affect performance:
- **No erasures** - Fastest (baseline)
- **Sequential** - Usually similar to baseline
- **Random** - May be slightly slower due to cache effects
- **Burst** - Impact depends on implementation

## System Requirements

- macOS 11.0 or later (Big Sur+)
- Apple Silicon (M1/M2/M3/M4)
- Node.js 16.0 or later
- Built native addon (`npm run build`)

## Notes

- Benchmarks automatically skip very large combinations to keep runtime reasonable
- GPU benchmarks only run for data sizes >= 100KB
- First iteration is used as warmup and excluded from timing
- Each benchmark runs 10 iterations by default
- Results may vary based on system load and thermal conditions

## Continuous Benchmarking

For CI/CD integration, the JSON reports can be used to:
- Track performance over time
- Detect performance regressions
- Compare different implementations
- Validate optimization improvements

Example: Compare two benchmark runs:

```bash
# Run baseline
npm run benchmark
mv benchmarks/reports/benchmark-report-*.json baseline.json

# Make changes, rebuild, run again
npm run build
npm run benchmark
mv benchmarks/reports/benchmark-report-*.json current.json

# Compare (requires custom script)
node scripts/compare-benchmarks.js baseline.json current.json
```

## Troubleshooting

### "Metal not available" warnings

If you see warnings about Metal not being available:
- Ensure you're running on Apple Silicon
- Check that Metal framework is properly linked
- GPU benchmarks will automatically fall back to CPU

### Out of memory errors

For very large configurations (e.g., 255 shards with 10MB data):
- Reduce the data size
- Skip large combinations
- Increase Node.js heap size: `node --max-old-space-size=4096 benchmarks/run.js`

### Inconsistent results

If results vary significantly between runs:
- Close other applications to reduce system load
- Let the system cool down between runs
- Run multiple times and average the results
- Check for thermal throttling

## Contributing

When adding new benchmarks:
1. Follow the existing structure
2. Include both CPU and GPU variants where applicable
3. Add appropriate summary statistics
4. Update this README
5. Ensure benchmarks complete in reasonable time (<5 minutes for full suite)
