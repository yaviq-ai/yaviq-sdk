# YAVIQ Python SDK

Official Python SDK for YAVIQ - Cut LLM token costs by up to **70%** using YAVIQ compressed format compression.

## Installation

```bash
pip install yaviq
```

Or install from source:

```bash
cd sdk/python
pip install .
```

## Quick Start

```python
from yaviq import optimize

result = optimize(
    api_key="tok_live_123",
    input="Summarize this engineering report in 4 bullets.",
    mode="medium"
)

print(result["optimized"])
print(f"Saved {result['tokensSaved']} tokens ({result['compression']}% compression)")
```

## API Reference

### `optimize(api_key, input, format="auto", mode="medium", endpoint=None)`

Compress text/JSON into optimized YAVIQ compressed format format.

**Parameters:**
- `api_key` (str, required): Your YAVIQ API key
- `input` (str, required): Text or JSON to compress
- `format` (str, optional): Input format - `"auto"` | `"json"` | `"yaml"` | `"csv"` | `"text"` (default: `"auto"`)
- `mode` (str, optional): Compression mode - `"low"` | `"medium"` | `"aggressive"` (default: `"medium"`)
- `endpoint` (str, optional): Override API base URL (default: `os.environ.get("YAVIQ_ENDPOINT")` or `"https://api.yaviq.local"`)

**Returns:**
```python
{
    "optimized": str,      # Compressed output
    "tokensSaved": int,    # Tokens saved
    "compression": float,  # Compression percentage
}
```

**Raises:**
- `ValueError`: If `api_key` or `input` is missing
- `RuntimeError`: On HTTP errors (4xx, 5xx) or network failures

## Examples

### Basic Text Compression

```python
from yaviq import optimize

result = optimize(
    api_key="tok_live_123",
    input="This is a very long prompt that needs compression...",
    mode="medium"
)
```

### JSON Compression

```python
import json
from yaviq import optimize

json_data = {
    "users": [
        {"id": 1, "name": "Alice", "email": "alice@example.com"},
        {"id": 2, "name": "Bob", "email": "bob@example.com"},
    ]
}

result = optimize(
    api_key="tok_live_123",
    input=json.dumps(json_data),
    format="json",
    mode="aggressive"
)
```

### With Custom Endpoint

```python
result = optimize(
    api_key="tok_live_123",
    input="Compress this text",
    endpoint="https://api.your-domain.com"
)
```

### Error Handling

```python
from yaviq import optimize

try:
    result = optimize(api_key="...", input="...")
except ValueError as e:
    print(f"Invalid parameters: {e}")
except RuntimeError as e:
    print(f"API error: {e}")
```

## Environment Variables

- `YAVIQ_ENDPOINT`: Default API endpoint (optional)

## Requirements

- Python 3.8+
- No external dependencies (uses standard library only)

## License

MIT

