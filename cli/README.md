# YAVIQ CLI

Command-line interface for YAVIQ - Cut LLM token costs by up to **70%** using cloud-based optimization.

## Installation

```bash
# Copy CLI to your PATH
cp sdk/cli/index.js /usr/local/bin/yaviq
chmod +x /usr/local/bin/yaviq
```

Or use directly with Node.js:

```bash
node sdk/cli/index.js <command> [options]
```

## Quick Start

```bash
# Set your API key
export YAVIQ_API_KEY="tok_live_123"

# Optimize text
node sdk/cli/index.js optimize --key $YAVIQ_API_KEY --input "Compress this text"

# Optimize from file
node sdk/cli/index.js optimize --key $YAVIQ_API_KEY --input-file ./prompt.txt
```

## Commands

### `optimize`

Optimize text/JSON for token efficiency.

**Options:**
- `--key` (required): Your YAVIQ API key
- `--input`: Inline string input
- `--input-file`: Path to file containing input
- `--mode`: Optimization mode (`safe` | `balanced` | `aggressive`, default: `balanced`)
- `--format`: Input format (`auto` | `json` | `yaml` | `csv` | `text`, default: `auto`)
- `--endpoint`: Override API base URL

**Examples:**

```bash
# Basic optimization
node sdk/cli/index.js optimize \
  --key $YAVIQ_API_KEY \
  --input "Summarize this report"

# From file with aggressive mode
node sdk/cli/index.js optimize \
  --key $YAVIQ_API_KEY \
  --input-file ./data.json \
  --format json \
  --mode aggressive

# Custom endpoint
node sdk/cli/index.js optimize \
  --key $YAVIQ_API_KEY \
  --input "Test" \
  --endpoint https://api.your-domain.com
```

### `optimize-structured`

Optimize structured data for efficient downstream usage.

Legacy aliases: `convert-to-toon`, `convert-to-compressed` (backward compatible).

**Options:**
- `--key` (required): Your YAVIQ API key
- `--input`: Inline string input
- `--input-file`: Path to file containing input
- `--format`: Input format (`auto` | `json` | `yaml` | `csv` | `text`, default: `auto`)
- `--endpoint`: Override API base URL

**Examples:**

```bash
# Optimize structured JSON
node sdk/cli/index.js optimize-structured \
  --key $YAVIQ_API_KEY \
  --input '{"users":[{"id":1,"name":"Alice"}]}' \
  --format json
```

### `decode-structured`

Decode optimized structured output back into JSON.

Legacy aliases: `convert-from-toon`, `convert-from-compressed` (backward compatible).

**Options:**
- `--key` (required): Your YAVIQ API key
- `--input`: Inline string input
- `--input-file`: Path to file containing input
- `--endpoint`: Override API base URL

**Examples:**

```bash
# Decode structured output
node sdk/cli/index.js decode-structured \
  --key $YAVIQ_API_KEY \
  --input "(users:(id:1,name:\"Alice\"))"
```

## Environment Variables

- `YAVIQ_ENDPOINT`: Default API endpoint (optional)

## Output Format

All commands output JSON:

```json
{
  "optimized": "...",
  "tokensSaved": 150,
  "compression": 65.5
}
```

## Error Handling

The CLI exits with:
- `0`: Success
- `1`: Error (missing arguments, API errors, etc.)

Error messages are printed to stderr.

## License

MIT

