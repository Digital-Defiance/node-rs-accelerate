/**
 * Main benchmark runner
 * 
 * Runs all benchmarks and generates performance comparison reports
 */

const fs = require('fs');
const path = require('path');
const { runEncodingBenchmarks } = require('./encoding');
const { runDecodingBenchmarks } = require('./decoding');
const { runGFBenchmarks } = require('./gf_operations');

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format throughput to human-readable string
 */
function formatThroughput(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, outputPath) {
  let markdown = '# Performance Benchmark Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `Platform: ${process.platform} ${process.arch}\n`;
  markdown += `Node.js: ${process.version}\n\n`;
  
  markdown += '---\n\n';
  
  // Encoding benchmarks
  markdown += '## Encoding Performance\n\n';
  markdown += '### CPU Performance\n\n';
  markdown += '| Configuration | Data Size | Avg Time (ms) | Throughput |\n';
  markdown += '|---------------|-----------|---------------|------------|\n';
  
  for (const result of results.encoding) {
    markdown += `| ${result.config} | ${result.dataSize} (${formatBytes(result.actualSize)}) | `;
    markdown += `${result.cpu.avgTime.toFixed(2)} | ${formatThroughput(result.cpu.throughput)} |\n`;
  }
  
  // GPU encoding if available
  const gpuEncodingResults = results.encoding.filter(r => r.gpu !== null);
  if (gpuEncodingResults.length > 0) {
    markdown += '\n### GPU Performance\n\n';
    markdown += '| Configuration | Data Size | CPU Time (ms) | GPU Time (ms) | Speedup |\n';
    markdown += '|---------------|-----------|---------------|---------------|----------|\n';
    
    for (const result of gpuEncodingResults) {
      const speedup = result.cpu.avgTime / result.gpu.avgTime;
      markdown += `| ${result.config} | ${result.dataSize} | `;
      markdown += `${result.cpu.avgTime.toFixed(2)} | ${result.gpu.avgTime.toFixed(2)} | ${speedup.toFixed(2)}x |\n`;
    }
  }
  
  // Decoding benchmarks
  markdown += '\n## Decoding Performance\n\n';
  markdown += '### CPU Performance by Erasure Pattern\n\n';
  markdown += '| Configuration | Data Size | Pattern | Avg Time (ms) | Throughput |\n';
  markdown += '|---------------|-----------|---------|---------------|------------|\n';
  
  for (const result of results.decoding) {
    markdown += `| ${result.config} | ${result.dataSize} | ${result.pattern} | `;
    markdown += `${result.cpu.avgTime.toFixed(2)} | ${formatThroughput(result.cpu.throughput)} |\n`;
  }
  
  // GPU decoding if available
  const gpuDecodingResults = results.decoding.filter(r => r.gpu !== null);
  if (gpuDecodingResults.length > 0) {
    markdown += '\n### GPU Performance\n\n';
    markdown += '| Configuration | Data Size | Pattern | CPU Time (ms) | GPU Time (ms) | Speedup |\n';
    markdown += '|---------------|-----------|---------|---------------|---------------|----------|\n';
    
    for (const result of gpuDecodingResults) {
      const speedup = result.cpu.avgTime / result.gpu.avgTime;
      markdown += `| ${result.config} | ${result.dataSize} | ${result.pattern} | `;
      markdown += `${result.cpu.avgTime.toFixed(2)} | ${result.gpu.avgTime.toFixed(2)} | ${speedup.toFixed(2)}x |\n`;
    }
  }
  
  // GF operations
  markdown += '\n## Galois Field Operations Performance\n\n';
  markdown += '### GF(2^8) Scalar Operations\n\n';
  markdown += '| Operation | Time (ms) | Ops/sec |\n';
  markdown += '|-----------|-----------|----------|\n';
  
  const gf8Ops = ['add', 'mul', 'div', 'inv', 'pow'];
  for (const op of gf8Ops) {
    const data = results.gf.scalarGF8[op];
    markdown += `| ${op.charAt(0).toUpperCase() + op.slice(1)} | ${data.time.toFixed(2)} | `;
    markdown += `${(data.ops / 1000000).toFixed(2)}M |\n`;
  }
  
  markdown += '\n### GF(2^8) Vectorized Operations (Accelerate Speedup)\n\n';
  markdown += '| Vector Size | Scalar Time (ms) | Accelerate Time (ms) | Speedup |\n';
  markdown += '|-------------|------------------|----------------------|----------|\n';
  
  for (const result of results.gf.vectorizedGF8) {
    markdown += `| ${result.size} | ${result.scalar.time.toFixed(2)} | `;
    markdown += `${result.accelerate.time.toFixed(2)} | ${result.speedup.toFixed(2)}x |\n`;
  }
  
  markdown += '\n### GF(2^16) Scalar Operations\n\n';
  markdown += '| Operation | Time (ms) | Ops/sec |\n';
  markdown += '|-----------|-----------|----------|\n';
  
  for (const op of gf8Ops) {
    const data = results.gf.scalarGF16[op];
    markdown += `| ${op.charAt(0).toUpperCase() + op.slice(1)} | ${data.time.toFixed(2)} | `;
    markdown += `${(data.ops / 1000000).toFixed(2)}M |\n`;
  }
  
  markdown += '\n### GF(2^16) Vectorized Operations (Accelerate Speedup)\n\n';
  markdown += '| Vector Size | Scalar Time (ms) | Accelerate Time (ms) | Speedup |\n';
  markdown += '|-------------|------------------|----------------------|----------|\n';
  
  for (const result of results.gf.vectorizedGF16) {
    markdown += `| ${result.size} | ${result.scalar.time.toFixed(2)} | `;
    markdown += `${result.accelerate.time.toFixed(2)} | ${result.speedup.toFixed(2)}x |\n`;
  }
  
  // Summary statistics
  markdown += '\n## Summary Statistics\n\n';
  
  // Best encoding throughput
  const bestEncoding = results.encoding.reduce((best, r) => 
    r.cpu.throughput > best.cpu.throughput ? r : best
  );
  markdown += `**Best Encoding Throughput (CPU):** ${formatThroughput(bestEncoding.cpu.throughput)}\n`;
  markdown += `- Configuration: ${bestEncoding.config}\n`;
  markdown += `- Data Size: ${bestEncoding.dataSize}\n\n`;
  
  if (gpuEncodingResults.length > 0) {
    const bestGPUEncoding = gpuEncodingResults.reduce((best, r) => 
      r.gpu.throughput > best.gpu.throughput ? r : best
    );
    markdown += `**Best Encoding Throughput (GPU):** ${formatThroughput(bestGPUEncoding.gpu.throughput)}\n`;
    markdown += `- Configuration: ${bestGPUEncoding.config}\n`;
    markdown += `- Data Size: ${bestGPUEncoding.dataSize}\n`;
    
    const avgGPUSpeedup = gpuEncodingResults.reduce((sum, r) => 
      sum + (r.cpu.avgTime / r.gpu.avgTime), 0
    ) / gpuEncodingResults.length;
    markdown += `- Average GPU Speedup: ${avgGPUSpeedup.toFixed(2)}x\n\n`;
  }
  
  // Best decoding throughput
  const bestDecoding = results.decoding.reduce((best, r) => 
    r.cpu.throughput > best.cpu.throughput ? r : best
  );
  markdown += `**Best Decoding Throughput (CPU):** ${formatThroughput(bestDecoding.cpu.throughput)}\n`;
  markdown += `- Configuration: ${bestDecoding.config}\n`;
  markdown += `- Data Size: ${bestDecoding.dataSize}\n`;
  markdown += `- Pattern: ${bestDecoding.pattern}\n\n`;
  
  if (gpuDecodingResults.length > 0) {
    const bestGPUDecoding = gpuDecodingResults.reduce((best, r) => 
      r.gpu.throughput > best.gpu.throughput ? r : best
    );
    markdown += `**Best Decoding Throughput (GPU):** ${formatThroughput(bestGPUDecoding.gpu.throughput)}\n`;
    markdown += `- Configuration: ${bestGPUDecoding.config}\n`;
    markdown += `- Data Size: ${bestGPUDecoding.dataSize}\n`;
    markdown += `- Pattern: ${bestGPUDecoding.pattern}\n`;
    
    const avgGPUSpeedup = gpuDecodingResults.reduce((sum, r) => 
      sum + (r.cpu.avgTime / r.gpu.avgTime), 0
    ) / gpuDecodingResults.length;
    markdown += `- Average GPU Speedup: ${avgGPUSpeedup.toFixed(2)}x\n\n`;
  }
  
  // GF operations summary
  const avgGF8Speedup = results.gf.vectorizedGF8.reduce((sum, r) => 
    sum + r.speedup, 0
  ) / results.gf.vectorizedGF8.length;
  markdown += `**GF(2^8) Vectorization:**\n`;
  markdown += `- Average Accelerate Speedup: ${avgGF8Speedup.toFixed(2)}x\n`;
  markdown += `- Best Speedup: ${Math.max(...results.gf.vectorizedGF8.map(r => r.speedup)).toFixed(2)}x\n\n`;
  
  const avgGF16Speedup = results.gf.vectorizedGF16.reduce((sum, r) => 
    sum + r.speedup, 0
  ) / results.gf.vectorizedGF16.length;
  markdown += `**GF(2^16) Vectorization:**\n`;
  markdown += `- Average Accelerate Speedup: ${avgGF16Speedup.toFixed(2)}x\n`;
  markdown += `- Best Speedup: ${Math.max(...results.gf.vectorizedGF16.map(r => r.speedup)).toFixed(2)}x\n\n`;
  
  // Performance targets
  markdown += '\n## Performance Targets\n\n';
  markdown += 'Requirements from specification:\n\n';
  markdown += '- **Target 1:** 10x speedup over pure JavaScript for 100+ shards\n';
  markdown += '- **Target 2:** 50x speedup with GPU acceleration for 1000+ shards\n\n';
  
  // Check if targets are met
  const largeConfig = results.encoding.find(r => 
    r.config === '(100,50)' || r.config === '(255,128)'
  );
  if (largeConfig) {
    markdown += `**Status for 100+ shards:** Configuration ${largeConfig.config}\n`;
    markdown += `- CPU throughput: ${formatThroughput(largeConfig.cpu.throughput)}\n`;
    markdown += `- Note: Comparison with pure JavaScript implementation needed for speedup calculation\n\n`;
  }
  
  markdown += '---\n\n';
  markdown += '*Note: This report shows hardware-accelerated performance using Apple\'s Accelerate framework ';
  markdown += 'and Metal Performance Shaders. Actual speedup vs pure JavaScript will vary based on implementation.*\n';
  
  // Write to file
  fs.writeFileSync(outputPath, markdown);
  console.log(`\nMarkdown report written to: ${outputPath}`);
}

/**
 * Generate JSON report
 */
function generateJSONReport(results, outputPath) {
  const report = {
    timestamp: new Date().toISOString(),
    platform: {
      os: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    results: {
      encoding: results.encoding,
      decoding: results.decoding,
      gf: results.gf
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`JSON report written to: ${outputPath}`);
}

/**
 * Main benchmark runner
 */
function main() {
  console.log('Starting comprehensive benchmark suite...\n');
  
  const results = {
    encoding: [],
    decoding: [],
    gf: {}
  };
  
  try {
    // Run encoding benchmarks
    console.log('Running encoding benchmarks...\n');
    results.encoding = runEncodingBenchmarks();
    
    console.log('\n');
    
    // Run decoding benchmarks
    console.log('Running decoding benchmarks...\n');
    results.decoding = runDecodingBenchmarks();
    
    console.log('\n');
    
    // Run GF operation benchmarks
    console.log('Running Galois Field operation benchmarks...\n');
    results.gf = runGFBenchmarks();
    
    console.log('\n');
    
    // Generate reports
    console.log('Generating reports...\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const reportDir = path.join(__dirname, 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const markdownPath = path.join(reportDir, `benchmark-report-${timestamp}.md`);
    const jsonPath = path.join(reportDir, `benchmark-report-${timestamp}.json`);
    
    generateMarkdownReport(results, markdownPath);
    generateJSONReport(results, jsonPath);
    
    console.log('\nBenchmark suite completed successfully!');
    
  } catch (e) {
    console.error('Benchmark suite failed:', e);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, generateMarkdownReport, generateJSONReport };
