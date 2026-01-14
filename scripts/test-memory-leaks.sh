#!/bin/bash

# Memory Leak Detection Test Script
# This script runs the memory safety tests with various leak detection tools

set -e

echo "=========================================="
echo "Memory Leak Detection Test Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script is designed for macOS/Apple Silicon${NC}"
    echo "For Linux, use valgrind instead:"
    echo "  valgrind --leak-check=full --show-leak-kinds=all node dist/test"
    exit 1
fi

# Function to print section headers
print_section() {
    echo ""
    echo -e "${GREEN}=========================================="
    echo "$1"
    echo -e "==========================================${NC}"
    echo ""
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Parse command line arguments
VERBOSE=false
HEAP_PROFILE=false
ASAN_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --heap)
            HEAP_PROFILE=true
            shift
            ;;
        --asan-only)
            ASAN_ONLY=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose     Enable verbose AddressSanitizer output"
            echo "  --heap        Enable heap profiling with --expose-gc"
            echo "  --asan-only   Only run AddressSanitizer tests (skip heap profiling)"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Step 1: Build with AddressSanitizer
print_section "Step 1: Building with AddressSanitizer"

if [ -f "binding.asan.gyp" ]; then
    echo "Building native addon with AddressSanitizer..."
    node-gyp rebuild --binding=binding.asan.gyp
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${RED}✗ Build failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: binding.asan.gyp not found${NC}"
    exit 1
fi

# Step 2: Set up AddressSanitizer environment
print_section "Step 2: Configuring AddressSanitizer"

export ASAN_OPTIONS="detect_leaks=1:check_initialization_order=1:strict_init_order=1"

if [ "$VERBOSE" = true ]; then
    export ASAN_OPTIONS="$ASAN_OPTIONS:verbosity=1:log_path=asan.log"
    echo "Verbose mode enabled - logs will be written to asan.log.*"
fi

echo "ASAN_OPTIONS: $ASAN_OPTIONS"

# Step 3: Run memory safety tests with AddressSanitizer
print_section "Step 3: Running Memory Safety Tests with AddressSanitizer"

echo "Running property-based memory safety tests..."
echo ""

# Run the tests
npm run test:properties -- --testPathPattern=memory_safety

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All memory safety tests passed${NC}"
else
    echo ""
    echo -e "${RED}✗ Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
fi

# Check for ASan log files
if [ "$VERBOSE" = true ] && ls asan.log.* 1> /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}AddressSanitizer logs created:${NC}"
    ls -lh asan.log.*
    echo ""
    echo "Review these logs for detailed leak information"
fi

# Step 4: Heap profiling (optional)
if [ "$HEAP_PROFILE" = true ] && [ "$ASAN_ONLY" = false ]; then
    print_section "Step 4: Running Heap Profiling Tests"
    
    echo "Running tests with --expose-gc for heap profiling..."
    echo ""
    
    NODE_OPTIONS="--expose-gc" npm run test:properties -- --testPathPattern=memory_safety
    
    HEAP_EXIT_CODE=$?
    
    if [ $HEAP_EXIT_CODE -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Heap profiling tests passed${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠ Heap profiling tests had issues (exit code: $HEAP_EXIT_CODE)${NC}"
    fi
fi

# Step 5: Summary
print_section "Summary"

echo "Memory leak detection tests completed."
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ No memory leaks detected by AddressSanitizer${NC}"
else
    echo -e "${RED}✗ Memory issues detected - review test output above${NC}"
fi

if [ "$HEAP_PROFILE" = true ] && [ "$ASAN_ONLY" = false ]; then
    if [ $HEAP_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ Heap usage remained stable${NC}"
    else
        echo -e "${YELLOW}⚠ Heap profiling indicated potential issues${NC}"
    fi
fi

echo ""
echo "Additional tools for memory analysis:"
echo "  - Xcode Instruments (Leaks template)"
echo "  - Node.js heap snapshots (v8.writeHeapSnapshot())"
echo "  - Chrome DevTools memory profiler"
echo ""

# Rebuild without sanitizer for normal use
print_section "Cleanup: Rebuilding without AddressSanitizer"

echo "Rebuilding for normal use..."
node-gyp rebuild

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Cleanup successful${NC}"
else
    echo -e "${YELLOW}⚠ Cleanup build had issues - you may need to run 'npm run build' manually${NC}"
fi

echo ""
echo "=========================================="
echo "Memory leak detection complete"
echo "=========================================="

# Exit with the test exit code
exit $TEST_EXIT_CODE
