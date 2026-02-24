# YAVIQ Node.js SDK

Official Node.js SDK for YAVIQ — reduce LLM token usage with a cloud-based optimization platform.

## Installation

```bash
npm install @yaviq/sdk
```

## Overview

This SDK sends your inputs to YAVIQ's hosted optimization service and returns a more cost-efficient representation for downstream use. It is a client library only.

## Quick Start

```typescript
import optimize from "@yaviq/sdk";

const result = await optimize({
  apiKey: process.env.YAVIQ_API_KEY!,
  input: "Summarize this engineering report in 4 bullets.",
  mode: "balanced",
});

console.log(result.optimized);
console.log(`Saved ${result.tokensSaved} tokens (${result.compression}% compression)`);
```

## API Reference

### `optimize(params)`

Optimize input for token efficiency via the YAVIQ cloud service.

**Parameters:**
- `apiKey` (string, required): Your YAVIQ API key
- `input` (string, required): Text to optimize
- `format` (string, optional): Input format - `"auto"` | `"text"` | `"json"` | `"yaml"` | `"csv"` (default: `"auto"`)
- `mode` (string, optional): Optimization mode - `"safe"` | `"balanced"` | `"aggressive"` (default: `"balanced"`)
- `model` (string, optional): Target LLM model (optional)
- `endpoint` (string, optional): Override API base URL (default: `process.env.YAVIQ_ENDPOINT` or `"https://api.yaviq.local"`)

**Returns:**
```typescript
{
  optimized: string;      // Optimized output
  tokensSaved: number;    // Tokens saved
  compression: number;    // Percent reduction
}
```

## Examples

### Basic Text Optimization

```typescript
const result = await optimize({
  apiKey: "tok_live_123",
  input: "This is a very long prompt that needs optimization...",
  mode: "balanced",
});
```

### JSON Optimization

```typescript
const jsonData = {
  users: [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ],
};

const result = await optimize({
  apiKey: "tok_live_123",
  input: JSON.stringify(jsonData),
  format: "json",
  mode: "aggressive",
});
```

### With Custom Endpoint

```typescript
const result = await optimize({
  apiKey: "tok_live_123",
  input: "Optimize this text",
  endpoint: "https://api.your-domain.com",
});
```

## Environment Variables

- `YAVIQ_ENDPOINT`: Default API endpoint (optional)

## Error Handling

The SDK throws errors for:
- Missing `apiKey` or `input`
- HTTP errors (4xx, 5xx)
- Network failures

```typescript
try {
  const result = await optimize({ apiKey: "...", input: "..." });
} catch (error) {
  console.error("Optimization failed:", error.message);
}
```

## TypeScript Support

Full TypeScript definitions are included. Import types:

```typescript
import type { OptimizeOptions, OptimizeResponse } from "@yaviq/sdk";
```

## What This SDK Does Not Include

- No local optimization engine or inference runtime
- No model weights or proprietary algorithms
- No offline processing or embedded compression logic

## License

MIT

