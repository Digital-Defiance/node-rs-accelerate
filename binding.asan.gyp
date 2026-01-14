{
  "targets": [{
    "target_name": "node_rs_accelerate",
    "sources": [
      "src/native/addon.cc",
      "src/native/gf_arithmetic.cc",
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
            "-fsanitize=address",
            "-fno-omit-frame-pointer",
            "-g"
          ],
          "OTHER_LDFLAGS": [
            "-framework Accelerate",
            "-framework Metal",
            "-framework Foundation",
            "-fsanitize=address"
          ],
          "MACOSX_DEPLOYMENT_TARGET": "11.0",
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
        }
      }]
    ],
    "cflags!": ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"],
    "cflags_cc": [
      "-fexceptions",
      "-fsanitize=address",
      "-fno-omit-frame-pointer",
      "-g"
    ],
    "ldflags": ["-fsanitize=address"]
  }]
}
