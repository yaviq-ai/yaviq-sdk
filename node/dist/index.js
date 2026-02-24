"use strict";
/**
 * YAVIQ Node.js SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YAVIQClient = exports.SchemaMismatchError = exports.EngineFailureError = exports.TOONParseError = exports.ValidationError = exports.NetworkError = exports.YAVIQError = void 0;
exports.default = optimize;
exports.countEstimatedTokens = countEstimatedTokens;
class YAVIQError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "YAVIQError";
    }
}
exports.YAVIQError = YAVIQError;
class NetworkError extends YAVIQError {
    constructor(message, statusCode) {
        super(message, statusCode, "NETWORK_ERROR");
        this.name = "NetworkError";
    }
}
exports.NetworkError = NetworkError;
class ValidationError extends YAVIQError {
    constructor(message) {
        super(message, 400, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class TOONParseError extends YAVIQError {
    constructor(message) {
        super(message, 400, "TOON_PARSE_ERROR");
        this.name = "TOONParseError";
    }
}
exports.TOONParseError = TOONParseError;
class EngineFailureError extends YAVIQError {
    constructor(message, statusCode) {
        super(message, statusCode || 500, "ENGINE_FAILURE");
        this.name = "EngineFailureError";
    }
}
exports.EngineFailureError = EngineFailureError;
class SchemaMismatchError extends YAVIQError {
    constructor(message) {
        super(message, 400, "SCHEMA_MISMATCH");
        this.name = "SchemaMismatchError";
    }
}
exports.SchemaMismatchError = SchemaMismatchError;
class YAVIQClient {
    constructor(apiKey, endpoint) {
        this.sendTelemetry = false;
        this.apiKey = apiKey || process.env.YAVIQ_API_KEY || "";
        this.endpoint = endpoint || process.env.YAVIQ_ENDPOINT || "https://api.yaviq.local";
        if (!this.apiKey) {
            throw new ValidationError("API key is required. Set YAVIQ_API_KEY environment variable or pass apiKey to constructor.");
        }
    }
    async httpPost(path, body) {
        const url = `${this.endpoint.replace(/\/$/, "")}${path}`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                }
                catch {
                    errorData = { error: errorText };
                }
                const errorMessage = errorData.error || errorData.message || `Request failed (${response.status})`;
                if (response.status >= 400 && response.status < 500) {
                    throw new ValidationError(errorMessage);
                }
                else if (response.status >= 500) {
                    throw new EngineFailureError(errorMessage, response.status);
                }
                else {
                    throw new NetworkError(errorMessage, response.status);
                }
            }
            const result = await response.json();
            if (result.success === true && result.data) {
                return result.data;
            }
            if (result.success === false) {
                const errorMsg = result.error || "Unknown error";
                const status = result.status || 500;
                throw new EngineFailureError(errorMsg, status);
            }
            return result;
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            if (error instanceof Error && error.message.includes("fetch")) {
                throw new NetworkError(`Network request failed: ${error.message}`);
            }
            throw new EngineFailureError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async optimize(input, options = {}) {
        if (!input || typeof input !== "string") {
            throw new ValidationError("Input is required and must be a string");
        }
        const mode = this.normalizeMode(options.mode || "medium");
        const format = options.format || "auto";
        try {
            const result = await this.httpPost("/v1/optimize", {
                input,
                format,
                mode,
                model: options.model,
            });
            if (this.sendTelemetry) {
                console.log("[Telemetry] optimize", { tokensSaved: result.tokensSaved, compression: result.compression });
            }
            return result;
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            throw new EngineFailureError(`Optimize failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async optimizeAndRun(input, options = {}) {
        var _a;
        if (!input || typeof input !== "string") {
            throw new ValidationError("Input is required and must be a string");
        }
        const mode = this.normalizeMode(options.mode || "balanced");
        const format = options.format || "auto";
        try {
            const result = await this.httpPost("/v1/optimize-run", {
                userId: "sdk_user",
                input,
                format,
                mode,
                model: options.model,
                use_rag: options.use_rag || false,
                use_history: options.use_history || false,
                history: options.history,
                rag_chunk_limit: options.rag_chunk_limit,
                debug: options.debug || false,
            });
            if (this.sendTelemetry) {
                console.log("[Telemetry] optimizeAndRun", {
                    tokensUsed: result.metrics.total_tokens_used,
                    savings: result.metrics.final_total_savings_percent,
                    latency: (_a = result.debug) === null || _a === void 0 ? void 0 : _a.latency_ms,
                });
            }
            return result;
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            throw new EngineFailureError(`Optimize and run failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async estimateTokens(input, options = {}) {
        if (!input || typeof input !== "string") {
            throw new ValidationError("Input is required and must be a string");
        }
        const optimized = await this.optimize(input, options);
        const originalTokens = optimized.originalTokens || this.countTokens(input);
        const optimizedTokens = optimized.optimizedTokens || this.countTokens(optimized.optimized);
        const estimatedSavings = originalTokens - optimizedTokens;
        const estimatedSavingsPercent = originalTokens > 0 ? (estimatedSavings / originalTokens) * 100 : 0;
        return {
            original_tokens: originalTokens,
            optimized_tokens: optimizedTokens,
            estimated_savings: estimatedSavings,
            estimated_savings_percent: Math.round(estimatedSavingsPercent * 100) / 100,
        };
    }
    async toToon(input, format = "auto") {
        if (!input || typeof input !== "string") {
            throw new ValidationError("Input is required and must be a string");
        }
        try {
            const result = await this.httpPost("/v1/convert-to-toon", {
                input,
                format,
            });
            return this.normalizeToonInput(result.toon);
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            throw new TOONParseError(`Convert to TOON failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Legacy alias for backward compatibility.
    async convertToCompressed(input, format = "auto") {
        return this.toToon(input, format);
    }
    async fromToon(toon) {
        // Public API contract remains strict.
        if (!toon || typeof toon !== "string") {
            throw new ValidationError("TOON input is required and must be a string");
        }
        try {
            const result = await this.httpPost("/v1/convert-from-toon", {
                toon,
            });
            return result.json;
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            throw new TOONParseError(`Convert from TOON failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Legacy alias for backward compatibility.
    async convertFromCompressed(toon) {
        const normalizedToon = this.normalizeToonInput(toon);
        return this.fromToon(normalizedToon);
    }
    async convert(input, format) {
        if (!input || typeof input !== "string") {
            throw new ValidationError("Input is required and must be a string");
        }
        try {
            const result = await this.httpPost("/v1/convert-to-toon", {
                input,
                format: format || "auto",
            });
            return {
                toon: this.normalizeToonInput(result.toon),
                format: result.format,
            };
        }
        catch (error) {
            if (error instanceof YAVIQError) {
                throw error;
            }
            throw new TOONParseError(`Convert failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async optimizeRag(docs, options = {}) {
        const input = Array.isArray(docs) ? docs.join("\n\n") : docs;
        if (!input || typeof input !== "string") {
            throw new ValidationError("Documents are required");
        }
        return this.optimizeAndRun(input, {
            ...options,
            use_rag: true,
            rag_chunk_limit: options.rag_chunk_limit || 10,
        });
    }
    async compressHistory(messages, currentInput, options = {}) {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new ValidationError("Messages array is required and must not be empty");
        }
        if (!currentInput || typeof currentInput !== "string") {
            throw new ValidationError("Current input is required");
        }
        return this.optimizeAndRun(currentInput, {
            ...options,
            use_history: true,
            history: messages,
        });
    }
    async optimizePrompt(input, options = {}) {
        return this.optimize(input, { ...options, format: "text" });
    }
    async optimizeStructured(input, format = "json") {
        return this.optimize(input, { format });
    }
    async optimizeChatHistory(messages, currentInput, options = {}) {
        return this.compressHistory(messages, currentInput, options);
    }
    async optimizeRAG(documents, options = {}) {
        return this.optimizeRag(documents, options);
    }
    async optimizeAgentContext(agentId, messages, currentInput, options = {}) {
        return this.optimizeAndRun(currentInput, {
            ...options,
            use_history: true,
            history: messages,
        });
    }
    async optimizeAgentMessage(params) {
        const payloadStr = typeof params.payload === "string" ? params.payload : JSON.stringify(params.payload);
        return this.optimize(payloadStr, { format: "auto" });
    }
    countTokens(text) {
        return estimateTokenCount(text);
    }
    normalizeMode(mode) {
        const modeMap = {
            low: "safe",
            safe: "safe",
            medium: "balanced",
            balanced: "balanced",
            high: "aggressive",
            aggressive: "aggressive",
        };
        return modeMap[mode] || "balanced";
    }
    normalizeToonInput(toon) {
        if (Array.isArray(toon)) {
            return toon.join("\n");
        }
        if (typeof toon === "string") {
            return toon;
        }
        throw new ValidationError("TOON input is required and must be a string");
    }
}
exports.YAVIQClient = YAVIQClient;
async function optimize(params) {
    const client = new YAVIQClient(params.apiKey, params.endpoint);
    return client.optimize(params.input, {
        format: params.format,
        mode: params.mode,
        model: params.model,
    });
}
function countEstimatedTokens(text) {
    return estimateTokenCount(text);
}
function estimateTokenCount(text) {
    if (!text)
        return 0;
    return Math.ceil(text.trim().split(/\s+/).length / 0.75);
}
