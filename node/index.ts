/**
 * YAVIQ Node.js SDK
 * Public client for cloud-based optimization and token efficiency.
 */

export type CompressionMode = "safe" | "balanced" | "aggressive" | "low" | "medium" | "high";
export type InputFormat = "auto" | "text" | "json" | "yaml" | "csv";
type InternalInputFormat = InputFormat | "toon";
export type StructuredFormat = "json" | "yaml" | "csv";

export interface OptimizeOptions {
  mode?: CompressionMode;
  format?: InputFormat;
  model?: string;
  debug?: boolean;
}

export interface OptimizeResponse {
  optimized: string;
  tokensSaved: number;
  compression: number;
  originalTokens?: number;
  optimizedTokens?: number;
}

export interface OptimizeAndRunOptions extends OptimizeOptions {
  use_rag?: boolean;
  use_history?: boolean;
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  rag_chunk_limit?: number;
}

export interface OptimizeAndRunResponse {
  final_answer: string;
  /**
   * @internal
   * Internal encoded output representation (not part of public API contract)
   */
  final_answer_toon?: string;
  metrics: {
    original_input_tokens: number;
    optimized_input_tokens: number;
    input_token_savings: string;
    model_output_tokens: number;
    compressed_output_tokens: number;
    output_token_savings: string;
    total_tokens_used: number;
    final_total_savings_percent: string;
  };
  debug?: Record<string, any>;
}

export interface TokenEstimate {
  original_tokens: number;
  optimized_tokens: number;
  estimated_savings: number;
  estimated_savings_percent: number;
}

export interface ConvertResponse {
  /**
   * @internal
   * Internal encoded representation.
   * Not intended for direct use.
   */
  toon?: string;
  json?: any;
  format?: string;
}

export class YAVIQError extends Error {
  constructor(message: string, public statusCode?: number, public code?: string) {
    super(message);
    this.name = "YAVIQError";
  }
}

export class NetworkError extends YAVIQError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class ValidationError extends YAVIQError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class OptimizationParseError extends YAVIQError {
  constructor(message: string) {
    super(message, 400, "OPTIMIZATION_PARSE_ERROR");
    this.name = "OptimizationParseError";
  }
}

/**
 * @deprecated Legacy name. Prefer OptimizationParseError.
 */
export class TOONParseError extends OptimizationParseError {
  constructor(message: string) {
    super(message);
    this.name = "OptimizationParseError";
  }
}

export class EngineFailureError extends YAVIQError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode || 500, "ENGINE_FAILURE");
    this.name = "EngineFailureError";
  }
}

export class SchemaMismatchError extends YAVIQError {
  constructor(message: string) {
    super(message, 400, "SCHEMA_MISMATCH");
    this.name = "SchemaMismatchError";
  }
}

export class YAVIQClient {
  private apiKey: string;
  private endpoint: string;
  public sendTelemetry: boolean = false;

  /**
   * Create a client for the YAVIQ optimization platform.
   */
  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.YAVIQ_API_KEY || "";
    this.endpoint = endpoint || process.env.YAVIQ_ENDPOINT || "https://api.yaviq.local";

    if (!this.apiKey) {
      throw new ValidationError(
        "API key is required. Set YAVIQ_API_KEY environment variable or pass apiKey to constructor."
      );
    }
  }

  private async httpPost<T>(path: string, body: unknown): Promise<T> {
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
        } catch {
          errorData = { error: errorText };
        }

        const errorMessage = errorData.error || errorData.message || `Request failed (${response.status})`;
        
        if (response.status >= 400 && response.status < 500) {
          throw new ValidationError(errorMessage);
        } else if (response.status >= 500) {
          throw new EngineFailureError(errorMessage, response.status);
        } else {
          throw new NetworkError(errorMessage, response.status);
        }
      }

      const result = await response.json();
      
      if (result.success === true && result.data) {
        return result.data as T;
      }
      
      if (result.success === false) {
        const errorMsg = result.error || "Unknown error";
        const status = result.status || 500;
        throw new EngineFailureError(errorMsg, status);
      }

      return result as T;
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("fetch")) {
        throw new NetworkError(`Network request failed: ${error.message}`);
      }
      throw new EngineFailureError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimize input content for token efficiency.
   */
  async optimize(input: string, options: OptimizeOptions = {}): Promise<OptimizeResponse> {
    if (!input || typeof input !== "string") {
      throw new ValidationError("Input is required and must be a string");
    }

    const mode = this.normalizeMode(options.mode || "medium");
    const format = options.format || "auto";

    try {
      const result = await this.httpPost<OptimizeResponse>("/v1/optimize", {
        input,
        format,
        mode,
        model: options.model,
      });

      if (this.sendTelemetry) {
        console.log("[Telemetry] optimize", { tokensSaved: result.tokensSaved, compression: result.compression });
      }

      return result;
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      throw new EngineFailureError(`Optimize failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimize input and execute a model run using the cloud platform.
   */
  async optimizeAndRun(input: string, options: OptimizeAndRunOptions = {}): Promise<OptimizeAndRunResponse> {
    if (!input || typeof input !== "string") {
      throw new ValidationError("Input is required and must be a string");
    }

    const mode = this.normalizeMode(options.mode || "balanced");
    const format = options.format || "auto";

    try {
      const result = await this.httpPost<OptimizeAndRunResponse>("/v1/optimize-run", {
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
          latency: result.debug?.latency_ms,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      throw new EngineFailureError(`Optimize and run failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimate token savings. This is approximate and non-authoritative.
   */
  async estimateTokens(input: string, options: OptimizeOptions = {}): Promise<TokenEstimate> {
    if (!input || typeof input !== "string") {
      throw new ValidationError("Input is required and must be a string");
    }

    const optimized = await this.optimize(input, options);
    
    const originalTokens = optimized.originalTokens || this.countTokens(input);
    const optimizedTokens = optimized.optimizedTokens || this.countTokens(optimized.optimized);
    const estimatedSavings = originalTokens - optimizedTokens;
    const estimatedSavingsPercent =
      originalTokens > 0 ? (estimatedSavings / originalTokens) * 100 : 0;

    return {
      original_tokens: originalTokens,
      optimized_tokens: optimizedTokens,
      estimated_savings: estimatedSavings,
      estimated_savings_percent: Math.round(estimatedSavingsPercent * 100) / 100,
    };
  }

  /**
   * @deprecated Internal legacy encoder. Prefer convert().
   */
  async toToon(input: string, format: InternalInputFormat = "auto"): Promise<string> {
    if (!input || typeof input !== "string") {
      throw new ValidationError("Input is required and must be a string");
    }

    try {
      const result = await this.httpPost<{ toon: string; format: string }>("/v1/convert-to-toon", {
        input,
        format,
      });

      return this.normalizeToonInput(result.toon);
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      throw new OptimizationParseError(
        `Convert to TOON failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * @deprecated Legacy alias for backward compatibility.
   */
  async convertToCompressed(input: string, format: InputFormat = "auto"): Promise<string> {
    return this.toToon(input, format);
  }

  /**
   * @deprecated Internal legacy decoder. Prefer decodeStructured().
   */
  async fromToon(toon: string): Promise<any> {
    // Public API contract remains strict.
    if (!toon || typeof toon !== "string") {
      throw new ValidationError("TOON input is required and must be a string");
    }

    try {
      const result = await this.httpPost<{ json: any }>("/v1/convert-from-toon", {
        toon,
      });

      return result.json;
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      throw new OptimizationParseError(
        `Convert from TOON failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * @deprecated Legacy alias for backward compatibility.
   */
  async convertFromCompressed(toon: string): Promise<any> {
    const normalizedToon = this.normalizeToonInput(toon as unknown);
    return this.fromToon(normalizedToon);
  }

  /**
   * Decode a structured payload produced by the platform.
   */
  async decodeStructured(encoded: string): Promise<any> {
    return this.fromToon(encoded);
  }

  /**
   * Convert structured input into an optimized platform representation.
   */
  async convert(input: string, format?: InputFormat): Promise<ConvertResponse> {
    if (!input || typeof input !== "string") {
      throw new ValidationError("Input is required and must be a string");
    }

    try {
      const result = await this.httpPost<{ toon: string; format: string }>("/v1/convert-to-toon", {
        input,
        format: format || "auto",
      });

      return {
        toon: this.normalizeToonInput(result.toon),
        format: result.format,
      };
    } catch (error) {
      if (error instanceof YAVIQError) {
        throw error;
      }
      throw new OptimizationParseError(`Convert failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimize documents for retrieval-augmented generation workflows.
   */
  async optimizeRag(docs: string | string[], options: OptimizeAndRunOptions = {}): Promise<OptimizeAndRunResponse> {
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

  /**
   * Optimize chat history and the current prompt for efficient inference.
   */
  async compressHistory(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    currentInput: string,
    options: OptimizeAndRunOptions = {}
  ): Promise<OptimizeAndRunResponse> {
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

  /**
   * Optimize plain text prompts.
   */
  async optimizePrompt(input: string, options: OptimizeOptions = {}): Promise<OptimizeResponse> {
    return this.optimize(input, { ...options, format: "text" });
  }

  /**
   * Optimize structured input while preserving format.
   */
  async optimizeStructured(input: string, format: StructuredFormat = "json"): Promise<OptimizeResponse> {
    return this.optimize(input, { format });
  }

  /**
   * Optimize multi-turn chat history for token savings.
   */
  async optimizeChatHistory(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    currentInput: string,
    options: OptimizeAndRunOptions = {}
  ): Promise<OptimizeAndRunResponse> {
    return this.compressHistory(messages, currentInput, options);
  }

  /**
   * Uppercase alias for optimizeRag.
   */
  async optimizeRAG(
    documents: string | string[],
    options: OptimizeAndRunOptions = {}
  ): Promise<OptimizeAndRunResponse> {
    return this.optimizeRag(documents, options);
  }

  /**
   * Optimize agent context for efficient downstream execution.
   */
  async optimizeAgentContext(
    agentId: string,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string; timestamp?: number }>,
    currentInput: string,
    options: OptimizeAndRunOptions = {}
  ): Promise<OptimizeAndRunResponse> {
    return this.optimizeAndRun(currentInput, {
      ...options,
      use_history: true,
      history: messages,
    });
  }

  /**
   * Optimize agent-to-agent message payloads.
   */
  async optimizeAgentMessage(params: {
    fromAgent: string;
    toAgent: string;
    task: string;
    payload: string | Record<string, unknown>;
    messageType?: "request" | "response" | "notification" | "error";
    timestamp?: number;
  }): Promise<OptimizeResponse> {
    const payloadStr =
      typeof params.payload === "string" ? params.payload : JSON.stringify(params.payload);
    
    return this.optimize(payloadStr, { format: "auto" });
  }

  /**
   * Approximate token count. Not authoritative.
   */
  countTokens(text: string): number {
    return estimateTokenCount(text);
  }

  private normalizeMode(mode: CompressionMode): "safe" | "balanced" | "aggressive" {
    const modeMap: Record<string, "safe" | "balanced" | "aggressive"> = {
      low: "safe",
      safe: "safe",
      medium: "balanced",
      balanced: "balanced",
      high: "aggressive",
      aggressive: "aggressive",
    };
    return modeMap[mode] || "balanced";
  }

  private normalizeToonInput(toon: unknown): string {
    if (Array.isArray(toon)) {
      return toon.join("\n");
    }
    if (typeof toon === "string") {
      return toon;
    }
    throw new ValidationError("TOON input is required and must be a string");
  }
}

export default async function optimize(
  params: {
    apiKey: string;
    input: string;
    format?: InputFormat;
    mode?: CompressionMode;
    model?: string;
    endpoint?: string;
  }
): Promise<OptimizeResponse> {
  const client = new YAVIQClient(params.apiKey, params.endpoint);
  return client.optimize(params.input, {
    format: params.format,
    mode: params.mode,
    model: params.model,
  });
}

/**
 * Approximate token count helper. Not authoritative.
 */
export function countEstimatedTokens(text: string): number {
  return estimateTokenCount(text);
}

function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length / 0.75);
}
