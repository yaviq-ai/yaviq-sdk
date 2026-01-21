## 📌 Terminology Clarification (Important)

**YAVIQ** is an SDK and cost-optimization platform for LLM usage.

Internally, YAVIQ applies proprietary optimization techniques to reduce
token usage and inference cost. These internal processes and
representations are fully abstracted away from users and are **not part
of the public API or product surface**.

Users interact only with **YAVIQ APIs and SDKs**.
No knowledge of internal formats or representations is required.

---

# YAVIQ SDK — Complete Feature Set

## ✅ All 9 Core Features

---

## 1. Optimize Prompt

**Compress prompts and inputs to reduce LLM token usage and cost.**

### What developers do
- Pass raw text or structured data
- Receive an optimized version ready for LLMs
- See exact token and cost savings

### Key capabilities
- Auto-detects input format (text, JSON, YAML, CSV)
- Optimizes both structured and unstructured data
- Preserves meaning while reducing tokens
- Returns clear savings metrics

---

## 2. Optimize + Run LLM

**One-step pipeline: optimize input → run LLM → return result + metrics**

### What developers do
- Call one function instead of managing multiple steps
- Optionally enable RAG and history optimization
- Receive final answer with detailed usage metrics

### Key capabilities
- Pre-LLM optimization
- Post-LLM output optimization
- Built-in RAG and history compression
- Unified response with metrics

---

## 3. Token Estimation

**Estimate token and cost savings before calling an LLM.**

### What developers do
- Preview cost impact
- Compare optimization modes
- Make cost-aware decisions

### Key capabilities
- Original token count
- Optimized token count
- Estimated savings (absolute + percentage)

---

## 4. Structured Data Optimization

**Optimize structured data for efficient LLM usage.**

### What developers do
- Provide JSON / YAML / CSV / structured text
- Receive an optimized representation internally
- Convert back to original structure when needed

### Key capabilities
- Automatic format detection
- Lossless round-trip conversion
- Designed for token-efficient LLM usage
- No schema changes required

> Internal optimization formats are abstracted and not part of the public API.

---

## 5. RAG Helper

**Optimize documents for Retrieval-Augmented Generation (RAG).**

### What developers do
- Pass raw documents
- Get optimized content for retrieval and LLM context
- Reduce noise and token overhead

### Key capabilities
- Chunk-level optimization
- Semantic summarization
- Noise removal
- Cost-efficient retrieval preparation

---

## 6. History Compression

**Reduce token usage for long chat histories.**

### What developers do
- Pass conversation history
- Maintain important context
- Remove irrelevant messages automatically

### Key capabilities
- Context-preserving summarization
- Memory reduction
- Optimized follow-up prompts

---

## 7. Telemetry Reporting

**Automatic visibility into usage and savings.**

### What developers do
- Enable telemetry
- Observe optimization impact
- Track cost efficiency over time

### Metrics provided
- Token usage
- Token savings
- Optimization ratios
- Errors and latency

---

## 8. Error Handling Layer

**Clear, consistent, developer-friendly errors.**

### What developers get
- Validation errors
- Network errors
- Optimization/processing errors
- Backend failures

All errors are human-readable and actionable.

---

## 9. Environment Integration

**Zero-configuration setup using environment variables.**

### Supported
- Automatic API key detection
- Custom endpoint override
- CLI, Node.js, and Python compatibility

---

## Summary

YAVIQ provides a **complete, production-ready optimization layer**
for LLM usage:

- Lower token usage
- Lower cost
- Better scalability
- Minimal developer effort

**No internal formats to learn.  
No workflow disruption.  
Just optimized LLM usage.**
