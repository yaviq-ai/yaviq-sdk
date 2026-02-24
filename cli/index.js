#!/usr/bin/env node
/**
 * YAVIQ CLI
 * Usage:
 *   node index.js optimize --key <API_KEY> --input-file ./input.txt --mode balanced
 *   node index.js optimize-structured --key <API_KEY> --input "raw text"
 *   node index.js decode-structured --key <API_KEY> --input "structured text"
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_ENDPOINT =
  process.env.YAVIQ_ENDPOINT || process.env.TOKENOPT_ENDPOINT || "https://api.yaviq.local";

function showHelp() {
  console.log(`YAVIQ CLI

Usage:
  node index.js optimize --key <API_KEY> --input "text"
  node index.js optimize --key <API_KEY> --input-file ./input.txt
  node index.js optimize-structured --key <API_KEY> --input "text"
  node index.js decode-structured --key <API_KEY> --input "text"

Options:
  --key           API key (required)
  --input         Inline string input
  --input-file    Path to file containing input
  --mode          Optimization mode (safe|balanced|aggressive)
  --format        Input format (auto|json|yaml|csv|text)
  --endpoint      Override API base URL
  --help          Show this guide

Legacy aliases:
  convert-to-toon, convert-to-compressed, convert-from-toon, convert-from-compressed
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = value;
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function readInput(args) {
  if (args.input) return args.input;
  if (args["input-file"]) {
    const filePath = path.resolve(process.cwd(), args["input-file"]);
    return fs.readFileSync(filePath, "utf8");
  }
  throw new Error("Provide --input or --input-file");
}

function normalizeEndpoint(endpoint) {
  // Avoid double slashes when composing endpoint paths.
  return endpoint.replace(/\/$/, "");
}

function unwrapResult(result) {
  return result.success === true && result.data ? result.data : result;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function httpPost(url, body, apiKey) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Request failed (${res.status}): ${message}`);
  }

  return res.json();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args._.length) {
    showHelp();
    process.exit(args._.length ? 0 : 1);
  }

  const command = args._[0];
  const apiKey = args.key;
  if (!apiKey) {
    console.error("Missing --key");
    process.exit(1);
  }

  const endpoint = normalizeEndpoint(args.endpoint || DEFAULT_ENDPOINT);

  try {
    if (command === "optimize") {
      const input = await readInput(args);
      const payload = {
        input,
        mode: args.mode || "medium",
        format: args.format || "auto",
      };
      const url = `${endpoint}/v1/optimize`;
      const result = await httpPost(url, payload, apiKey);
      
      // Handle wrapped response: {success: true, data: {...}}
      printJson(unwrapResult(result));
      process.exit(0);
    }

    if (
      command === "optimize-structured" ||
      command === "convert-to-toon" ||
      command === "convert-to-compressed"
    ) {
      const input = await readInput(args);
      const payload = { input, format: args.format || "auto" };
      const url = `${endpoint}/v1/convert-to-toon`;
      const result = await httpPost(url, payload, apiKey);

      // Handle wrapped response: {success: true, data: {...}}
      printJson(unwrapResult(result));
      process.exit(0);
    }

    if (
      command === "decode-structured" ||
      command === "convert-from-toon" ||
      command === "convert-from-compressed"
    ) {
      const input = await readInput(args);
      const payload = { toon: input };
      const url = `${endpoint}/v1/convert-from-toon`;
      const result = await httpPost(url, payload, apiKey);
      
      // Handle wrapped response: {success: true, data: {...}}
      printJson(unwrapResult(result));
      process.exit(0);
    }

    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

run();
