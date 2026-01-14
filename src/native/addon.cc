/**
 * N-API entry point for native Reed-Solomon module
 */

#include <napi.h>
#include "gf_arithmetic.h"
#include "gf_neon.h"
#include "gf_accelerate.h"
#include "gf_simd.h"
#include "gf_extreme.h"
#include "gf_m4max.h"
#include "matrix_ops.h"
#include "encoder.h"
#include "decoder.h"
#include "metal_bridge.h"

Napi::Value InitGF(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF::initGF256();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value InitGF65536(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF::initGF65536();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value InitGFWithPolynomial(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected primitive polynomial as number").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t primitivePolynomial = info[0].As<Napi::Number>().Uint32Value();
  
  try {
    GF::initGF256WithPolynomial(primitivePolynomial);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value InitGF65536WithPolynomial(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected primitive polynomial as number").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint32_t primitivePolynomial = info[0].As<Napi::Number>().Uint32Value();
  
  try {
    GF::initGF65536WithPolynomial(primitivePolynomial);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GetCurrentGF256Polynomial(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    uint16_t polynomial = GF::getCurrentGF256Polynomial();
    return Napi::Number::New(env, polynomial);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GetCurrentGF65536Polynomial(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    uint32_t polynomial = GF::getCurrentGF65536Polynomial();
    return Napi::Number::New(env, polynomial);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// GF(2^8) operations for testing
Napi::Value GF_Add8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint8_t a = info[0].As<Napi::Number>().Uint32Value();
  uint8_t b = info[1].As<Napi::Number>().Uint32Value();
  
  return Napi::Number::New(env, GF::add8(a, b));
}

Napi::Value GF_Mul8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint8_t a = info[0].As<Napi::Number>().Uint32Value();
  uint8_t b = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::mul8(a, b));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Div8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint8_t a = info[0].As<Napi::Number>().Uint32Value();
  uint8_t b = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::div8(a, b));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Inv8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected a number").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint8_t a = info[0].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::inv8(a));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Pow8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint8_t a = info[0].As<Napi::Number>().Uint32Value();
  uint8_t n = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::pow8(a, n));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Vectorized GF operations
Napi::Value GF_MulVec8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::mulVec8(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVec8(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::addVec8(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVec8Accelerated(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::mulVec8Accelerated(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVec8Accelerated(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::addVec8Accelerated(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// GF(2^16) operations
Napi::Value GF_Add16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t a = info[0].As<Napi::Number>().Uint32Value();
  uint16_t b = info[1].As<Napi::Number>().Uint32Value();
  
  return Napi::Number::New(env, GF::add16(a, b));
}

Napi::Value GF_Mul16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t a = info[0].As<Napi::Number>().Uint32Value();
  uint16_t b = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::mul16(a, b));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Div16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t a = info[0].As<Napi::Number>().Uint32Value();
  uint16_t b = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::div16(a, b));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Inv16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected a number").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t a = info[0].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::inv16(a));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_Pow16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  uint16_t a = info[0].As<Napi::Number>().Uint32Value();
  uint16_t n = info[1].As<Napi::Number>().Uint32Value();
  
  try {
    return Napi::Number::New(env, GF::pow16(a, n));
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Vectorized GF(2^16) operations
Napi::Value GF_MulVec16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint16Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint16Array a = info[0].As<Napi::Uint16Array>();
  Napi::Uint16Array b = info[1].As<Napi::Uint16Array>();
  Napi::Uint16Array out = info[2].As<Napi::Uint16Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::mulVec16(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVec16(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint16Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint16Array a = info[0].As<Napi::Uint16Array>();
  Napi::Uint16Array b = info[1].As<Napi::Uint16Array>();
  Napi::Uint16Array out = info[2].As<Napi::Uint16Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::addVec16(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVec16Accelerated(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint16Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint16Array a = info[0].As<Napi::Uint16Array>();
  Napi::Uint16Array b = info[1].As<Napi::Uint16Array>();
  Napi::Uint16Array out = info[2].As<Napi::Uint16Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::mulVec16Accelerated(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVec16Accelerated(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint16Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint16Array a = info[0].As<Napi::Uint16Array>();
  Napi::Uint16Array b = info[1].As<Napi::Uint16Array>();
  Napi::Uint16Array out = info[2].As<Napi::Uint16Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF::addVec16Accelerated(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value IsMetalAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, MetalAccel::isMetalAvailable());
}

Napi::Value InitMetal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    bool success = MetalAccel::initMetal();
    return Napi::Boolean::New(env, success);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVecGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int field = 8; // Default to GF(2^8)
  if (info.Length() >= 4 && info[3].IsNumber()) {
    field = info[3].As<Napi::Number>().Int32Value();
  }
  
  try {
    // Initialize Metal before using GPU
    if (!MetalAccel::initMetal()) {
      Napi::Error::New(env, "Failed to initialize Metal").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    
    MetalAccel::gfMulVecGPU(a.Data(), b.Data(), out.Data(), a.ElementLength(), field);
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVecGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int field = 8; // Default to GF(2^8)
  if (info.Length() >= 4 && info[3].IsNumber()) {
    field = info[3].As<Napi::Number>().Int32Value();
  }
  
  try {
    // Initialize Metal before using GPU
    if (!MetalAccel::initMetal()) {
      Napi::Error::New(env, "Failed to initialize Metal").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    
    MetalAccel::gfAddVecGPU(a.Data(), b.Data(), out.Data(), a.ElementLength(), field);
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// Matrix operations
Napi::Value BuildVandermondeMatrix(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 4 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsNumber() || 
      !info[3].IsNumber()) {
    Napi::TypeError::New(env, "Expected (Uint8Array, rows, cols, field)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  int rows = info[1].As<Napi::Number>().Int32Value();
  int cols = info[2].As<Napi::Number>().Int32Value();
  int field = info[3].As<Napi::Number>().Int32Value();
  
  // For GF(2^16), each element is 2 bytes (uint16_t)
  int bytesPerElement = (field == 16) ? 2 : 1;
  size_t expectedSize = static_cast<size_t>(rows * cols * bytesPerElement);
  
  if (matrix.ElementLength() != expectedSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    Matrix::buildVandermondeMatrix(matrix.Data(), rows, cols, field);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value BuildCauchyMatrix(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 4 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsNumber() || 
      !info[3].IsNumber()) {
    Napi::TypeError::New(env, "Expected (Uint8Array, rows, cols, field)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  int rows = info[1].As<Napi::Number>().Int32Value();
  int cols = info[2].As<Napi::Number>().Int32Value();
  int field = info[3].As<Napi::Number>().Int32Value();
  
  // For GF(2^16), each element is 2 bytes (uint16_t)
  int bytesPerElement = (field == 16) ? 2 : 1;
  size_t expectedSize = static_cast<size_t>(rows * cols * bytesPerElement);
  
  if (matrix.ElementLength() != expectedSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    Matrix::buildCauchyMatrix(matrix.Data(), rows, cols, field);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value MatVecMulGF(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray() || 
      !info[3].IsNumber() || 
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (matrix, vec, out, rows, cols)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array vec = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  int rows = info[3].As<Napi::Number>().Int32Value();
  int cols = info[4].As<Napi::Number>().Int32Value();
  int field = 8; // Default to GF(2^8)
  
  if (info.Length() >= 6 && info[5].IsNumber()) {
    field = info[5].As<Napi::Number>().Int32Value();
  }
  
  if (matrix.ElementLength() != static_cast<size_t>(rows * cols)) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (vec.ElementLength() != static_cast<size_t>(cols)) {
    Napi::TypeError::New(env, "Vector size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (out.ElementLength() != static_cast<size_t>(rows)) {
    Napi::TypeError::New(env, "Output size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    Matrix::matVecMulGF(matrix.Data(), vec.Data(), out.Data(), rows, cols, field);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value InvertMatrixGF(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected (matrix, size)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  int size = info[1].As<Napi::Number>().Int32Value();
  int field = 8; // Default to GF(2^8)
  
  if (info.Length() >= 3 && info[2].IsNumber()) {
    field = info[2].As<Napi::Number>().Int32Value();
  }
  
  if (matrix.ElementLength() != static_cast<size_t>(size * size)) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    Matrix::invertMatrixGF(matrix.Data(), size, field);
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (data, dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 6 ||
      !info[0].IsTypedArray() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsTypedArray() ||
      !info[5].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  int shardSize = info[3].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[4].As<Napi::Uint8Array>();
  int field = info[5].As<Napi::Number>().Int32Value();
  
  // Validate sizes
  if (data.ElementLength() != static_cast<size_t>(dataShards * shardSize)) {
    Napi::TypeError::New(env, "Data size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // For GF(2^16), each matrix element is 2 bytes (uint16_t)
  int bytesPerElement = (field == 16) ? 2 : 1;
  int totalShards = dataShards + parityShards;
  size_t expectedMatrixSize = static_cast<size_t>(totalShards * dataShards * bytesPerElement);
  
  if (matrix.ElementLength() != expectedMatrixSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate output buffer for parity shards
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    Encoder::encode(
      data.Data(),
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      outParityShards.Data()
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value EncodeGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (data, dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 6 ||
      !info[0].IsTypedArray() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsTypedArray() ||
      !info[5].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  int shardSize = info[3].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[4].As<Napi::Uint8Array>();
  int field = info[5].As<Napi::Number>().Int32Value();
  
  // Validate sizes
  if (data.ElementLength() != static_cast<size_t>(dataShards * shardSize)) {
    Napi::TypeError::New(env, "Data size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // For GF(2^16), each matrix element is 2 bytes (uint16_t)
  int bytesPerElement = (field == 16) ? 2 : 1;
  int totalShards = dataShards + parityShards;
  size_t expectedMatrixSize = static_cast<size_t>(totalShards * dataShards * bytesPerElement);
  
  if (matrix.ElementLength() != expectedMatrixSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate output buffer for parity shards
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    Encoder::encodeGPU(
      data.Data(),
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      outParityShards.Data()
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value ShouldUseGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (shardSize, dataShards, parityShards)
  if (info.Length() < 3 ||
      !info[0].IsNumber() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber()) {
    Napi::TypeError::New(env, "Expected (shardSize, dataShards, parityShards)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int shardSize = info[0].As<Napi::Number>().Int32Value();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  
  bool useGPU = Encoder::shouldUseGPU(shardSize, dataShards, parityShards);
  return Napi::Boolean::New(env, useGPU);
}

Napi::Value Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (shards, shardIndices, dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 7 ||
      !info[0].IsArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber() ||
      !info[5].IsTypedArray() ||
      !info[6].IsNumber()) {
    Napi::TypeError::New(env, "Expected (shards[], shardIndices, dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Array shardsArray = info[0].As<Napi::Array>();
  Napi::Int32Array shardIndices = info[1].As<Napi::Int32Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[5].As<Napi::Uint8Array>();
  int field = info[6].As<Napi::Number>().Int32Value();
  
  int numShards = shardsArray.Length();
  
  if (numShards < dataShards) {
    Napi::Error::New(env, "Insufficient shards for decoding").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (shardIndices.ElementLength() != static_cast<size_t>(numShards)) {
    Napi::TypeError::New(env, "Shard indices count mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Extract shard pointers
  std::vector<const uint8_t*> shardPtrs(numShards);
  for (int i = 0; i < numShards; i++) {
    Napi::Value shardValue = shardsArray[i];
    if (!shardValue.IsTypedArray()) {
      Napi::TypeError::New(env, "All shards must be Uint8Arrays").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Napi::Uint8Array shard = shardValue.As<Napi::Uint8Array>();
    if (shard.ElementLength() != static_cast<size_t>(shardSize)) {
      Napi::TypeError::New(env, "All shards must have the same size").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    shardPtrs[i] = shard.Data();
  }
  
  // Allocate output buffer
  Napi::Uint8Array outData = Napi::Uint8Array::New(env, dataShards * shardSize);
  
  try {
    Decoder::decode(
      shardPtrs.data(),
      reinterpret_cast<const int*>(shardIndices.Data()),
      numShards,
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      outData.Data()
    );
    
    return outData;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value DecodeGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (shards, shardIndices, dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 7 ||
      !info[0].IsArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber() ||
      !info[5].IsTypedArray() ||
      !info[6].IsNumber()) {
    Napi::TypeError::New(env, "Expected (shards[], shardIndices, dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Array shardsArray = info[0].As<Napi::Array>();
  Napi::Int32Array shardIndices = info[1].As<Napi::Int32Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[5].As<Napi::Uint8Array>();
  int field = info[6].As<Napi::Number>().Int32Value();
  
  int numShards = shardsArray.Length();
  
  if (numShards < dataShards) {
    Napi::Error::New(env, "Insufficient shards for decoding").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (shardIndices.ElementLength() != static_cast<size_t>(numShards)) {
    Napi::TypeError::New(env, "Shard indices count mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Extract shard pointers
  std::vector<const uint8_t*> shardPtrs(numShards);
  for (int i = 0; i < numShards; i++) {
    Napi::Value shardValue = shardsArray[i];
    if (!shardValue.IsTypedArray()) {
      Napi::TypeError::New(env, "All shards must be Uint8Arrays").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Napi::Uint8Array shard = shardValue.As<Napi::Uint8Array>();
    if (shard.ElementLength() != static_cast<size_t>(shardSize)) {
      Napi::TypeError::New(env, "All shards must have the same size").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    shardPtrs[i] = shard.Data();
  }
  
  // Allocate output buffer
  Napi::Uint8Array outData = Napi::Uint8Array::New(env, dataShards * shardSize);
  
  try {
    Decoder::decodeGPU(
      shardPtrs.data(),
      reinterpret_cast<const int*>(shardIndices.Data()),
      numShards,
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      outData.Data()
    );
    
    return outData;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value ShouldUseGPUForDecoding(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (dataShards, parityShards)
  if (info.Length() < 2 ||
      !info[0].IsNumber() ||
      !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected (dataShards, parityShards)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int dataShards = info[0].As<Napi::Number>().Int32Value();
  int parityShards = info[1].As<Napi::Number>().Int32Value();
  
  bool useGPU = Decoder::shouldUseGPUForDecoding(dataShards, parityShards);
  return Napi::Boolean::New(env, useGPU);
}

Napi::Value BatchEncodeGPU(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (dataBlocks[], dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 6 ||
      !info[0].IsArray() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsTypedArray() ||
      !info[5].IsNumber()) {
    Napi::TypeError::New(env, "Expected (dataBlocks[], dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Array dataBlocksArray = info[0].As<Napi::Array>();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  int shardSize = info[3].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[4].As<Napi::Uint8Array>();
  int field = info[5].As<Napi::Number>().Int32Value();
  
  int batchSize = dataBlocksArray.Length();
  
  if (batchSize == 0) {
    Napi::TypeError::New(env, "Batch size must be greater than 0").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // For GF(2^16), each matrix element is 2 bytes (uint16_t)
  int bytesPerElement = (field == 16) ? 2 : 1;
  int totalShards = dataShards + parityShards;
  size_t expectedMatrixSize = static_cast<size_t>(totalShards * dataShards * bytesPerElement);
  
  if (matrix.ElementLength() != expectedMatrixSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Extract data block pointers
  std::vector<const uint8_t*> dataBlockPtrs(batchSize);
  for (int i = 0; i < batchSize; i++) {
    Napi::Value blockValue = dataBlocksArray[i];
    if (!blockValue.IsTypedArray()) {
      Napi::TypeError::New(env, "All data blocks must be Uint8Arrays").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Napi::Uint8Array block = blockValue.As<Napi::Uint8Array>();
    if (block.ElementLength() != static_cast<size_t>(dataShards * shardSize)) {
      Napi::TypeError::New(env, "All data blocks must have size dataShards * shardSize").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    dataBlockPtrs[i] = block.Data();
  }
  
  // Allocate output buffers for parity blocks
  Napi::Array outParityBlocks = Napi::Array::New(env, batchSize);
  std::vector<uint8_t*> parityBlockPtrs(batchSize);
  
  for (int i = 0; i < batchSize; i++) {
    Napi::Uint8Array parityBlock = Napi::Uint8Array::New(env, parityShards * shardSize);
    outParityBlocks[i] = parityBlock;
    parityBlockPtrs[i] = parityBlock.Data();
  }
  
  try {
    Encoder::batchEncodeGPU(
      dataBlockPtrs.data(),
      batchSize,
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      parityBlockPtrs.data()
    );
    
    return outParityBlocks;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value Reconstruct(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (shards, shardIndices, missingIndices, dataShards, parityShards, shardSize, matrix, field)
  if (info.Length() < 8 ||
      !info[0].IsArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsTypedArray() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber() ||
      !info[5].IsNumber() ||
      !info[6].IsTypedArray() ||
      !info[7].IsNumber()) {
    Napi::TypeError::New(env, "Expected (shards[], shardIndices, missingIndices, dataShards, parityShards, shardSize, matrix, field)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Array shardsArray = info[0].As<Napi::Array>();
  Napi::Int32Array shardIndices = info[1].As<Napi::Int32Array>();
  Napi::Int32Array missingIndices = info[2].As<Napi::Int32Array>();
  int dataShards = info[3].As<Napi::Number>().Int32Value();
  int parityShards = info[4].As<Napi::Number>().Int32Value();
  int shardSize = info[5].As<Napi::Number>().Int32Value();
  Napi::Uint8Array matrix = info[6].As<Napi::Uint8Array>();
  int field = info[7].As<Napi::Number>().Int32Value();
  
  int numShards = shardsArray.Length();
  int numMissing = missingIndices.ElementLength();
  
  if (numShards < dataShards) {
    Napi::Error::New(env, "Insufficient shards for reconstruction").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (shardIndices.ElementLength() != static_cast<size_t>(numShards)) {
    Napi::TypeError::New(env, "Shard indices count mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Extract shard pointers
  std::vector<const uint8_t*> shardPtrs(numShards);
  for (int i = 0; i < numShards; i++) {
    Napi::Value shardValue = shardsArray[i];
    if (!shardValue.IsTypedArray()) {
      Napi::TypeError::New(env, "All shards must be Uint8Arrays").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Napi::Uint8Array shard = shardValue.As<Napi::Uint8Array>();
    if (shard.ElementLength() != static_cast<size_t>(shardSize)) {
      Napi::TypeError::New(env, "All shards must have the same size").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    shardPtrs[i] = shard.Data();
  }
  
  // Allocate output buffer
  Napi::Uint8Array outData = Napi::Uint8Array::New(env, numMissing * shardSize);
  
  try {
    Decoder::reconstruct(
      shardPtrs.data(),
      reinterpret_cast<const int*>(shardIndices.Data()),
      reinterpret_cast<const int*>(missingIndices.Data()),
      numShards,
      numMissing,
      dataShards,
      parityShards,
      shardSize,
      matrix.Data(),
      field,
      outData.Data()
    );
    
    return outData;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// NEON-optimized functions
Napi::Value InitNEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF_NEON::initNEON();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value IsNEONAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_NEON::isNEONAvailable());
}

// Accelerate-optimized functions
Napi::Value InitAccelerate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF_Accelerate::initAccelerate();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value IsAccelerateAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_Accelerate::isAccelerateAvailable());
}

Napi::Value GF_MatVecMul_Accelerate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray() || 
      !info[3].IsNumber() || 
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (matrix, vec, out, rows, cols)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array vec = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  int rows = info[3].As<Napi::Number>().Int32Value();
  int cols = info[4].As<Napi::Number>().Int32Value();
  
  if (matrix.ElementLength() != static_cast<size_t>(rows * cols)) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (vec.ElementLength() != static_cast<size_t>(cols)) {
    Napi::TypeError::New(env, "Vector size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (out.ElementLength() != static_cast<size_t>(rows)) {
    Napi::TypeError::New(env, "Output size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_Accelerate::matVecMulGF_Accelerate(matrix.Data(), vec.Data(), out.Data(), rows, cols);
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_XOR_Accelerate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_Accelerate::xorAccelerate(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulAccum_Accelerate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected (data, constant, accum)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  uint8_t constant = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[2].As<Napi::Uint8Array>();
  
  if (data.ElementLength() != accum.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_Accelerate::mulAccumAccelerate(data.Data(), constant, accum.Data(), data.ElementLength());
    return accum;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value EncodeAccelerate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (data, matrix, dataShards, parityShards, shardSize)
  if (info.Length() < 5 ||
      !info[0].IsTypedArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, matrix, dataShards, parityShards, shardSize)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  
  // Validate sizes
  if (data.ElementLength() != static_cast<size_t>(dataShards * shardSize)) {
    Napi::TypeError::New(env, "Data size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int totalShards = dataShards + parityShards;
  size_t expectedMatrixSize = static_cast<size_t>(totalShards * dataShards);
  
  if (matrix.ElementLength() != expectedMatrixSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate output buffer for parity shards
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    GF_Accelerate::encodeAccelerate(
      data.Data(),
      matrix.Data(),
      outParityShards.Data(),
      dataShards,
      parityShards,
      shardSize
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVec8_NEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_NEON::mulVec8_NEON(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_AddVec8_NEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_NEON::addVec8_NEON(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVecConstant8_NEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected (Uint8Array, constant, Uint8Array)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  uint8_t constant = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_NEON::mulVecConstant8_NEON(a.Data(), constant, out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MatVecMul8_NEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray() || 
      !info[3].IsNumber() || 
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (matrix, vec, out, rows, cols)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array matrix = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array vec = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  int rows = info[3].As<Napi::Number>().Int32Value();
  int cols = info[4].As<Napi::Number>().Int32Value();
  
  if (matrix.ElementLength() != static_cast<size_t>(rows * cols)) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (vec.ElementLength() != static_cast<size_t>(cols)) {
    Napi::TypeError::New(env, "Vector size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  if (out.ElementLength() != static_cast<size_t>(rows)) {
    Napi::TypeError::New(env, "Output size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_NEON::matVecMul8_NEON(matrix.Data(), vec.Data(), out.Data(), rows, cols);
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_PolyMul8_NEON(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_NEON::polyMul8_NEON(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// ============================================================================
// Advanced SIMD functions (vtbl, pmull, GCD parallel encoding)
// ============================================================================

Napi::Value InitSIMD(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF_SIMD::initSIMD();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value IsSIMDAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_SIMD::isSIMDAvailable());
}

Napi::Value IsMultiThreadAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_SIMD::isMultiThreadAvailable());
}

Napi::Value GetOptimalThreadCount(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Number::New(env, GF_SIMD::getOptimalThreadCount());
}

Napi::Value GF_MulVecConstant_vtbl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected (Uint8Array, constant, Uint8Array)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  uint8_t constant = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_SIMD::mulVecConstant_vtbl(a.Data(), constant, out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulVec_pmull(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected three Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[2].As<Napi::Uint8Array>();
  
  if (a.ElementLength() != b.ElementLength() || a.ElementLength() != out.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_SIMD::mulVec_pmull(a.Data(), b.Data(), out.Data(), a.ElementLength());
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulAccum_interleaved(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected (data, constant, accum)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  uint8_t constant = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[2].As<Napi::Uint8Array>();
  
  if (data.ElementLength() != accum.ElementLength()) {
    Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  try {
    GF_SIMD::mulAccum_interleaved(data.Data(), constant, accum.Data(), data.ElementLength());
    return accum;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value EncodeParallel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Expected arguments: (data, matrix, dataShards, parityShards, shardSize)
  if (info.Length() < 5 ||
      !info[0].IsTypedArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, matrix, dataShards, parityShards, shardSize)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  
  // Validate sizes
  if (data.ElementLength() != static_cast<size_t>(dataShards * shardSize)) {
    Napi::TypeError::New(env, "Data size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  int totalShards = dataShards + parityShards;
  size_t expectedMatrixSize = static_cast<size_t>(totalShards * dataShards);
  
  if (matrix.ElementLength() != expectedMatrixSize) {
    Napi::TypeError::New(env, "Matrix size mismatch").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate output buffer for parity shards
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    GF_SIMD::encodeParallel(
      data.Data(),
      matrix.Data(),
      outParityShards.Data(),
      dataShards,
      parityShards,
      shardSize
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

// ============================================================================
// Extreme Optimization Functions
// ============================================================================

Napi::Value InitExtreme(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    GF_Extreme::initExtreme();
    return env.Undefined();
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value IsCRC32Available(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_Extreme::isCRC32Available());
}

Napi::Value IsVeor3Available(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_Extreme::isVeor3Available());
}

Napi::Value GF_Xor3Vec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 4 || 
      !info[0].IsTypedArray() || 
      !info[1].IsTypedArray() || 
      !info[2].IsTypedArray() ||
      !info[3].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected four Uint8Arrays").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array c = info[2].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[3].As<Napi::Uint8Array>();
  
  size_t len = std::min({a.ElementLength(), b.ElementLength(), 
                         c.ElementLength(), out.ElementLength()});
  
  try {
    GF_Extreme::xor3Vec(a.Data(), b.Data(), c.Data(), out.Data(), len);
    return out;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GF_MulAccum2_veor3(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 || 
      !info[0].IsTypedArray() || 
      !info[1].IsNumber() || 
      !info[2].IsTypedArray() ||
      !info[3].IsNumber() ||
      !info[4].IsTypedArray()) {
    Napi::TypeError::New(env, "Expected (data1, coeff1, data2, coeff2, accum)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data1 = info[0].As<Napi::Uint8Array>();
  uint8_t coeff1 = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array data2 = info[2].As<Napi::Uint8Array>();
  uint8_t coeff2 = info[3].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[4].As<Napi::Uint8Array>();
  
  size_t len = std::min({data1.ElementLength(), data2.ElementLength(), accum.ElementLength()});
  
  try {
    GF_Extreme::mulAccum2_veor3(data1.Data(), coeff1, data2.Data(), coeff2, accum.Data(), len);
    return accum;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value EncodePipelined(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 ||
      !info[0].IsTypedArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, matrix, dataShards, parityShards, shardSize)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    GF_Extreme::encodePipelined(
      data.Data(),
      matrix.Data(),
      outParityShards.Data(),
      dataShards,
      parityShards,
      shardSize
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value EncodeNonTemporal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5 ||
      !info[0].IsTypedArray() ||
      !info[1].IsTypedArray() ||
      !info[2].IsNumber() ||
      !info[3].IsNumber() ||
      !info[4].IsNumber()) {
    Napi::TypeError::New(env, "Expected (data, matrix, dataShards, parityShards, shardSize)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int dataShards = info[2].As<Napi::Number>().Int32Value();
  int parityShards = info[3].As<Napi::Number>().Int32Value();
  int shardSize = info[4].As<Napi::Number>().Int32Value();
  
  Napi::Uint8Array outParityShards = Napi::Uint8Array::New(env, parityShards * shardSize);
  
  try {
    GF_Extreme::encodeNonTemporal(
      data.Data(),
      matrix.Data(),
      outParityShards.Data(),
      dataShards,
      parityShards,
      shardSize
    );
    
    return outParityShards;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value GetOptimalEncodingStrategy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 ||
      !info[0].IsNumber() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber()) {
    Napi::TypeError::New(env, "Expected (shardSize, dataShards, parityShards)")
      .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  size_t shardSize = info[0].As<Napi::Number>().Int64Value();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  
  int strategy = GF_Extreme::getOptimalStrategy(shardSize, dataShards, parityShards);
  return Napi::Number::New(env, strategy);
}

// ============================================================================
// M4 Max Extreme Optimizations
// ============================================================================

Napi::Value InitM4Max(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  GF_M4Max::initM4Max();
  return env.Undefined();
}

Napi::Value IsSMEAvailable(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_M4Max::isSMEAvailable());
}

Napi::Value IsM4Max(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, GF_M4Max::isM4Max());
}

Napi::Value GetPerformanceCoreCount(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Number::New(env, GF_M4Max::getPerformanceCoreCount());
}

Napi::Value GetEfficiencyCoreCount(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Number::New(env, GF_M4Max::getEfficiencyCoreCount());
}

Napi::Value BenchmarkMemoryBandwidth(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  double bandwidth = GF_M4Max::benchmarkMemoryBandwidth();
  return Napi::Number::New(env, bandwidth);
}

Napi::Value GF_MulAccum4Way(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected 3 arguments: data, coeff, accum").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  uint8_t coeff = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[2].As<Napi::Uint8Array>();
  
  size_t len = std::min(data.ElementLength(), accum.ElementLength());
  GF_M4Max::mulAccum4Way(data.Data(), coeff, accum.Data(), len);
  
  return env.Undefined();
}

Napi::Value GF_MulAccum8Way(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected 3 arguments: data, coeff, accum").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  uint8_t coeff = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[2].As<Napi::Uint8Array>();
  
  size_t len = std::min(data.ElementLength(), accum.ElementLength());
  GF_M4Max::mulAccum8Way(data.Data(), coeff, accum.Data(), len);
  
  return env.Undefined();
}

Napi::Value GF_Xor4Vec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected 5 arguments: a, b, c, d, out").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array a = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array b = info[1].As<Napi::Uint8Array>();
  Napi::Uint8Array c = info[2].As<Napi::Uint8Array>();
  Napi::Uint8Array d = info[3].As<Napi::Uint8Array>();
  Napi::Uint8Array out = info[4].As<Napi::Uint8Array>();
  
  size_t len = std::min({a.ElementLength(), b.ElementLength(), c.ElementLength(), 
                         d.ElementLength(), out.ElementLength()});
  GF_M4Max::xor4Vec(a.Data(), b.Data(), c.Data(), d.Data(), out.Data(), len);
  
  return env.Undefined();
}

Napi::Value GF_MulAccum4_xor4(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 9) {
    Napi::TypeError::New(env, "Expected 9 arguments: data1, coeff1, data2, coeff2, data3, coeff3, data4, coeff4, accum").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data1 = info[0].As<Napi::Uint8Array>();
  uint8_t coeff1 = info[1].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array data2 = info[2].As<Napi::Uint8Array>();
  uint8_t coeff2 = info[3].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array data3 = info[4].As<Napi::Uint8Array>();
  uint8_t coeff3 = info[5].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array data4 = info[6].As<Napi::Uint8Array>();
  uint8_t coeff4 = info[7].As<Napi::Number>().Uint32Value();
  Napi::Uint8Array accum = info[8].As<Napi::Uint8Array>();
  
  size_t len = std::min({data1.ElementLength(), data2.ElementLength(), 
                         data3.ElementLength(), data4.ElementLength(), 
                         accum.ElementLength()});
  
  GF_M4Max::mulAccum4_xor4(data1.Data(), coeff1, data2.Data(), coeff2,
                           data3.Data(), coeff3, data4.Data(), coeff4,
                           accum.Data(), len);
  
  return env.Undefined();
}

Napi::Value Encode16Core(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected 5 arguments: data, matrix, k, m, shardSize").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int k = info[2].As<Napi::Number>().Int32Value();
  int m = info[3].As<Napi::Number>().Int32Value();
  size_t shardSize = info[4].As<Napi::Number>().Int64Value();
  
  Napi::Uint8Array parity = Napi::Uint8Array::New(env, m * shardSize);
  
  GF_M4Max::encode16Core(data.Data(), matrix.Data(), parity.Data(), k, m, shardSize);
  
  return parity;
}

Napi::Value EncodeCacheAligned(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected 5 arguments: data, matrix, k, m, shardSize").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int k = info[2].As<Napi::Number>().Int32Value();
  int m = info[3].As<Napi::Number>().Int32Value();
  size_t shardSize = info[4].As<Napi::Number>().Int64Value();
  
  Napi::Uint8Array parity = Napi::Uint8Array::New(env, m * shardSize);
  
  GF_M4Max::encodeCacheAligned(data.Data(), matrix.Data(), parity.Data(), k, m, shardSize);
  
  return parity;
}

Napi::Value EncodeBandwidthOptimized(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected 5 arguments: data, matrix, k, m, shardSize").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int k = info[2].As<Napi::Number>().Int32Value();
  int m = info[3].As<Napi::Number>().Int32Value();
  size_t shardSize = info[4].As<Napi::Number>().Int64Value();
  
  Napi::Uint8Array parity = Napi::Uint8Array::New(env, m * shardSize);
  
  GF_M4Max::encodeBandwidthOptimized(data.Data(), matrix.Data(), parity.Data(), k, m, shardSize);
  
  return parity;
}

Napi::Value EncodeHugePage(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected 5 arguments: data, matrix, k, m, shardSize").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Uint8Array data = info[0].As<Napi::Uint8Array>();
  Napi::Uint8Array matrix = info[1].As<Napi::Uint8Array>();
  int k = info[2].As<Napi::Number>().Int32Value();
  int m = info[3].As<Napi::Number>().Int32Value();
  size_t shardSize = info[4].As<Napi::Number>().Int64Value();
  
  Napi::Uint8Array parity = Napi::Uint8Array::New(env, m * shardSize);
  
  GF_M4Max::encodeHugePage(data.Data(), matrix.Data(), parity.Data(), k, m, shardSize);
  
  return parity;
}

Napi::Value GetOptimalM4Strategy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected 3 arguments: shardSize, dataShards, parityShards").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  size_t shardSize = info[0].As<Napi::Number>().Int64Value();
  int dataShards = info[1].As<Napi::Number>().Int32Value();
  int parityShards = info[2].As<Napi::Number>().Int32Value();
  
  int strategy = GF_M4Max::getOptimalM4Strategy(shardSize, dataShards, parityShards);
  return Napi::Number::New(env, strategy);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "initGF"), Napi::Function::New(env, InitGF));
  exports.Set(Napi::String::New(env, "initGF65536"), Napi::Function::New(env, InitGF65536));
  exports.Set(Napi::String::New(env, "initGFWithPolynomial"), Napi::Function::New(env, InitGFWithPolynomial));
  exports.Set(Napi::String::New(env, "initGF65536WithPolynomial"), Napi::Function::New(env, InitGF65536WithPolynomial));
  exports.Set(Napi::String::New(env, "getCurrentGF256Polynomial"), Napi::Function::New(env, GetCurrentGF256Polynomial));
  exports.Set(Napi::String::New(env, "getCurrentGF65536Polynomial"), Napi::Function::New(env, GetCurrentGF65536Polynomial));
  exports.Set(Napi::String::New(env, "gf_add8"), Napi::Function::New(env, GF_Add8));
  exports.Set(Napi::String::New(env, "gf_mul8"), Napi::Function::New(env, GF_Mul8));
  exports.Set(Napi::String::New(env, "gf_div8"), Napi::Function::New(env, GF_Div8));
  exports.Set(Napi::String::New(env, "gf_inv8"), Napi::Function::New(env, GF_Inv8));
  exports.Set(Napi::String::New(env, "gf_pow8"), Napi::Function::New(env, GF_Pow8));
  exports.Set(Napi::String::New(env, "gf_mulVec8"), Napi::Function::New(env, GF_MulVec8));
  exports.Set(Napi::String::New(env, "gf_addVec8"), Napi::Function::New(env, GF_AddVec8));
  exports.Set(Napi::String::New(env, "gf_mulVec8Accelerated"), Napi::Function::New(env, GF_MulVec8Accelerated));
  exports.Set(Napi::String::New(env, "gf_addVec8Accelerated"), Napi::Function::New(env, GF_AddVec8Accelerated));
  exports.Set(Napi::String::New(env, "gf_add16"), Napi::Function::New(env, GF_Add16));
  exports.Set(Napi::String::New(env, "gf_mul16"), Napi::Function::New(env, GF_Mul16));
  exports.Set(Napi::String::New(env, "gf_div16"), Napi::Function::New(env, GF_Div16));
  exports.Set(Napi::String::New(env, "gf_inv16"), Napi::Function::New(env, GF_Inv16));
  exports.Set(Napi::String::New(env, "gf_pow16"), Napi::Function::New(env, GF_Pow16));
  exports.Set(Napi::String::New(env, "gf_mulVec16"), Napi::Function::New(env, GF_MulVec16));
  exports.Set(Napi::String::New(env, "gf_addVec16"), Napi::Function::New(env, GF_AddVec16));
  exports.Set(Napi::String::New(env, "gf_mulVec16Accelerated"), Napi::Function::New(env, GF_MulVec16Accelerated));
  exports.Set(Napi::String::New(env, "gf_addVec16Accelerated"), Napi::Function::New(env, GF_AddVec16Accelerated));
  exports.Set(Napi::String::New(env, "isMetalAvailable"), Napi::Function::New(env, IsMetalAvailable));
  exports.Set(Napi::String::New(env, "initMetal"), Napi::Function::New(env, InitMetal));
  exports.Set(Napi::String::New(env, "gf_mulVecGPU"), Napi::Function::New(env, GF_MulVecGPU));
  exports.Set(Napi::String::New(env, "gf_addVecGPU"), Napi::Function::New(env, GF_AddVecGPU));
  exports.Set(Napi::String::New(env, "buildVandermondeMatrix"), Napi::Function::New(env, BuildVandermondeMatrix));
  exports.Set(Napi::String::New(env, "buildCauchyMatrix"), Napi::Function::New(env, BuildCauchyMatrix));
  exports.Set(Napi::String::New(env, "matVecMulGF"), Napi::Function::New(env, MatVecMulGF));
  exports.Set(Napi::String::New(env, "invertMatrixGF"), Napi::Function::New(env, InvertMatrixGF));
  exports.Set(Napi::String::New(env, "encode"), Napi::Function::New(env, Encode));
  exports.Set(Napi::String::New(env, "encodeGPU"), Napi::Function::New(env, EncodeGPU));
  exports.Set(Napi::String::New(env, "shouldUseGPU"), Napi::Function::New(env, ShouldUseGPU));
  exports.Set(Napi::String::New(env, "batchEncodeGPU"), Napi::Function::New(env, BatchEncodeGPU));
  exports.Set(Napi::String::New(env, "decode"), Napi::Function::New(env, Decode));
  exports.Set(Napi::String::New(env, "decodeGPU"), Napi::Function::New(env, DecodeGPU));
  exports.Set(Napi::String::New(env, "shouldUseGPUForDecoding"), Napi::Function::New(env, ShouldUseGPUForDecoding));
  exports.Set(Napi::String::New(env, "reconstruct"), Napi::Function::New(env, Reconstruct));
  
  // NEON-optimized functions
  exports.Set(Napi::String::New(env, "initNEON"), Napi::Function::New(env, InitNEON));
  exports.Set(Napi::String::New(env, "isNEONAvailable"), Napi::Function::New(env, IsNEONAvailable));
  exports.Set(Napi::String::New(env, "gf_mulVec8_NEON"), Napi::Function::New(env, GF_MulVec8_NEON));
  exports.Set(Napi::String::New(env, "gf_addVec8_NEON"), Napi::Function::New(env, GF_AddVec8_NEON));
  exports.Set(Napi::String::New(env, "gf_mulVecConstant8_NEON"), Napi::Function::New(env, GF_MulVecConstant8_NEON));
  exports.Set(Napi::String::New(env, "gf_matVecMul8_NEON"), Napi::Function::New(env, GF_MatVecMul8_NEON));
  exports.Set(Napi::String::New(env, "gf_polyMul8_NEON"), Napi::Function::New(env, GF_PolyMul8_NEON));
  
  // Accelerate-optimized functions
  exports.Set(Napi::String::New(env, "initAccelerate"), Napi::Function::New(env, InitAccelerate));
  exports.Set(Napi::String::New(env, "isAccelerateAvailable"), Napi::Function::New(env, IsAccelerateAvailable));
  exports.Set(Napi::String::New(env, "gf_matVecMul_Accelerate"), Napi::Function::New(env, GF_MatVecMul_Accelerate));
  exports.Set(Napi::String::New(env, "gf_xor_Accelerate"), Napi::Function::New(env, GF_XOR_Accelerate));
  exports.Set(Napi::String::New(env, "gf_mulAccum_Accelerate"), Napi::Function::New(env, GF_MulAccum_Accelerate));
  exports.Set(Napi::String::New(env, "encodeAccelerate"), Napi::Function::New(env, EncodeAccelerate));
  
  // Advanced SIMD functions (vtbl, pmull, GCD parallel encoding)
  exports.Set(Napi::String::New(env, "initSIMD"), Napi::Function::New(env, InitSIMD));
  exports.Set(Napi::String::New(env, "isSIMDAvailable"), Napi::Function::New(env, IsSIMDAvailable));
  exports.Set(Napi::String::New(env, "isMultiThreadAvailable"), Napi::Function::New(env, IsMultiThreadAvailable));
  exports.Set(Napi::String::New(env, "getOptimalThreadCount"), Napi::Function::New(env, GetOptimalThreadCount));
  exports.Set(Napi::String::New(env, "gf_mulVecConstant_vtbl"), Napi::Function::New(env, GF_MulVecConstant_vtbl));
  exports.Set(Napi::String::New(env, "gf_mulVec_pmull"), Napi::Function::New(env, GF_MulVec_pmull));
  exports.Set(Napi::String::New(env, "gf_mulAccum_interleaved"), Napi::Function::New(env, GF_MulAccum_interleaved));
  exports.Set(Napi::String::New(env, "encodeParallel"), Napi::Function::New(env, EncodeParallel));
  
  // Extreme optimization functions (veor3, pipelined, non-temporal)
  exports.Set(Napi::String::New(env, "initExtreme"), Napi::Function::New(env, InitExtreme));
  exports.Set(Napi::String::New(env, "isCRC32Available"), Napi::Function::New(env, IsCRC32Available));
  exports.Set(Napi::String::New(env, "isVeor3Available"), Napi::Function::New(env, IsVeor3Available));
  exports.Set(Napi::String::New(env, "gf_xor3Vec"), Napi::Function::New(env, GF_Xor3Vec));
  exports.Set(Napi::String::New(env, "gf_mulAccum2_veor3"), Napi::Function::New(env, GF_MulAccum2_veor3));
  exports.Set(Napi::String::New(env, "encodePipelined"), Napi::Function::New(env, EncodePipelined));
  exports.Set(Napi::String::New(env, "encodeNonTemporal"), Napi::Function::New(env, EncodeNonTemporal));
  exports.Set(Napi::String::New(env, "getOptimalEncodingStrategy"), Napi::Function::New(env, GetOptimalEncodingStrategy));
  
  // M4 Max extreme optimization functions
  exports.Set(Napi::String::New(env, "initM4Max"), Napi::Function::New(env, InitM4Max));
  exports.Set(Napi::String::New(env, "isSMEAvailable"), Napi::Function::New(env, IsSMEAvailable));
  exports.Set(Napi::String::New(env, "isM4Max"), Napi::Function::New(env, IsM4Max));
  exports.Set(Napi::String::New(env, "getPerformanceCoreCount"), Napi::Function::New(env, GetPerformanceCoreCount));
  exports.Set(Napi::String::New(env, "getEfficiencyCoreCount"), Napi::Function::New(env, GetEfficiencyCoreCount));
  exports.Set(Napi::String::New(env, "benchmarkMemoryBandwidth"), Napi::Function::New(env, BenchmarkMemoryBandwidth));
  exports.Set(Napi::String::New(env, "gf_mulAccum4Way"), Napi::Function::New(env, GF_MulAccum4Way));
  exports.Set(Napi::String::New(env, "gf_mulAccum8Way"), Napi::Function::New(env, GF_MulAccum8Way));
  exports.Set(Napi::String::New(env, "gf_xor4Vec"), Napi::Function::New(env, GF_Xor4Vec));
  exports.Set(Napi::String::New(env, "gf_mulAccum4_xor4"), Napi::Function::New(env, GF_MulAccum4_xor4));
  exports.Set(Napi::String::New(env, "encode16Core"), Napi::Function::New(env, Encode16Core));
  exports.Set(Napi::String::New(env, "encodeCacheAligned"), Napi::Function::New(env, EncodeCacheAligned));
  exports.Set(Napi::String::New(env, "encodeBandwidthOptimized"), Napi::Function::New(env, EncodeBandwidthOptimized));
  exports.Set(Napi::String::New(env, "encodeHugePage"), Napi::Function::New(env, EncodeHugePage));
  exports.Set(Napi::String::New(env, "getOptimalM4Strategy"), Napi::Function::New(env, GetOptimalM4Strategy));
  
  return exports;
}

NODE_API_MODULE(node_rs_accelerate, Init)
