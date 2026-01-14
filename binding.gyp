{
  "targets": [{
    "target_name": "node_rs_accelerate",
    "sources": [
      "src/native/addon.cc",
      "src/native/gf_arithmetic.cc",
      "src/native/gf_neon.cc",
      "src/native/gf_accelerate.cc",
      "src/native/gf_simd.cc",
      "src/native/gf_extreme.cc",
      "src/native/gf_m4max.cc",
      "src/native/matrix_ops.cc",
      "src/native/metal_bridge.mm",
      "src/native/encoder.cc",
      "src/native/decoder.cc"
    ],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "conditions": [
      ["OS=='mac'", {
        "xcode_settings": {
          "OTHER_CFLAGS": [
            "-std=c++17",
            "-ObjC++",
            "-O3",
            "-march=armv8.2-a+fp16+crypto+sha3",
            "-mtune=apple-m1",
            "-ffast-math",
            "-funroll-loops",
            "-fvectorize",
            "-flto"
          ],
          "OTHER_LDFLAGS": [
            "-framework Accelerate",
            "-framework Metal",
            "-framework Foundation",
            "-flto"
          ],
          "MACOSX_DEPLOYMENT_TARGET": "11.0",
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
          "GCC_OPTIMIZATION_LEVEL": "3"
        }
      }]
    ],
    "cflags!": ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"],
    "cflags_cc": ["-fexceptions", "-O3", "-march=armv8.2-a+fp16+crypto+sha3", "-ffast-math", "-funroll-loops"]
  }]
}
