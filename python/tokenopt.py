"""
YAVIQ Python SDK

Production SDK for the YAVIQ Token Optimization Platform.
Handles authentication, request/response serialization, and error handling.
"""

import json
import os
from typing import Dict, List, Optional, Any, Union
from urllib import request, error

DEFAULT_ENDPOINT = "https://api.yaviq.local"


class YAVIQError(Exception):
    """Base exception for all YAVIQ SDK errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code or "YAVIQ_ERROR"


class NetworkError(YAVIQError):
    """Network-level errors (connection failures, timeouts, DNS issues)."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code, "NETWORK_ERROR")


class ValidationError(YAVIQError):
    """Request validation failures (400-level errors)."""
    def __init__(self, message: str):
        super().__init__(message, 400, "VALIDATION_ERROR")


class TOONParseError(YAVIQError):
    """TOON format parsing or conversion failures."""
    def __init__(self, message: str):
        super().__init__(message, 400, "TOON_PARSE_ERROR")


class EngineFailureError(YAVIQError):
    """Server-side engine failures (500-level errors)."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code or 500, "ENGINE_FAILURE")


class SchemaMismatchError(YAVIQError):
    """Input data structure doesn't match expected schema."""
    def __init__(self, message: str):
        super().__init__(message, 400, "SCHEMA_MISMATCH")


class YAVIQClient:
    """
    Main client for interacting with the YAVIQ API.
    
    Thread-safe for read operations. For concurrent writes, use separate
    client instances or implement appropriate locking.
    """
    
    def __init__(self, api_key: Optional[str] = None, endpoint: Optional[str] = None):
        """
        Initialize YAVIQ client.
        
        Args:
            api_key: API key for authentication. If None, reads from YAVIQ_API_KEY env var.
            endpoint: Base API endpoint URL. If None, reads from YAVIQ_ENDPOINT env var
                     or defaults to DEFAULT_ENDPOINT.
        
        Raises:
            ValidationError: If API key is not provided.
        """
        self.api_key = api_key or os.environ.get("YAVIQ_API_KEY", "")
        self.endpoint = endpoint or os.environ.get("YAVIQ_ENDPOINT", DEFAULT_ENDPOINT)
        self.send_telemetry = False
        
        if not self.api_key:
            raise ValidationError(
                "API key is required. Set YAVIQ_API_KEY environment variable or pass api_key to constructor."
            )
    
    def _http_post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HTTP POST request to the YAVIQ API.
        
        Handles request serialization, authentication, response parsing, and error
        transformation. Supports both wrapped ({success: true, data: {...}}) and
        direct response formats.
        
        Args:
            path: API endpoint path (e.g., "/v1/optimize")
            body: Request payload dictionary
        
        Returns:
            Parsed response data dictionary
        
        Raises:
            ValidationError: For 4xx client errors
            EngineFailureError: For 5xx server errors
            NetworkError: For network-level failures
        """
        url = self.endpoint.rstrip("/") + path
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        
        req = request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        
        try:
            with request.urlopen(req) as resp:
                response_body = resp.read().decode("utf-8")
                result = json.loads(response_body)
                
                if isinstance(result, dict) and result.get("success") is True and "data" in result:
                    return result["data"]
                
                if isinstance(result, dict) and result.get("success") is False:
                    error_msg = result.get("error", "Unknown error")
                    status = result.get("status", 500)
                    raise EngineFailureError(error_msg, status)
                
                return result
        except error.HTTPError as http_err:
            error_body = http_err.read().decode("utf-8", errors="ignore")
            try:
                error_data = json.loads(error_body)
                error_msg = error_data.get("error") or error_data.get("message") or error_body
            except (json.JSONDecodeError, AttributeError):
                error_msg = error_body or f"HTTP {http_err.code}"
            
            if 400 <= http_err.code < 500:
                raise ValidationError(f"Request failed ({http_err.code}): {error_msg}")
            elif http_err.code >= 500:
                raise EngineFailureError(f"Server error ({http_err.code}): {error_msg}", http_err.code)
            else:
                raise NetworkError(f"Request failed ({http_err.code}): {error_msg}", http_err.code)
        except error.URLError as url_err:
            raise NetworkError(f"Network error: {url_err.reason}")
    
    def optimize(
        self,
        input_text: str,
        mode: str = "medium",
        format: str = "auto",
        model: Optional[str] = None,
        debug: bool = False,
    ) -> Dict[str, Any]:
        """
        Optimize text input to reduce token count while preserving semantic meaning.
        
        Compression modes:
        - "safe" / "low": Minimal compression, maximum quality
        - "balanced" / "medium": Balanced tradeoff (recommended)
        - "aggressive" / "high": Maximum compression
        
        Args:
            input_text: Text content to optimize
            mode: Compression aggressiveness level
            format: Input format hint ("auto", "text", "json", "yaml", "csv")
            model: Target LLM model identifier (optional)
            debug: Enable debug mode for additional diagnostics
        
        Returns:
            Dictionary with optimized text, tokensSaved, compression, etc.
        
        Raises:
            ValidationError: If input is invalid
            EngineFailureError: If optimization fails
            NetworkError: If network request fails
        """
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Input is required and must be a string")
        
        mode = self._normalize_mode(mode)
        
        result = self._http_post("/v1/optimize", {
            "input": input_text,
            "format": format,
            "mode": mode,
            "model": model,
        })
        
        if self.send_telemetry:
            print(f"[Telemetry] optimize: tokensSaved={result.get('tokensSaved', 0)}, compression={result.get('compression', 0)}%")
        
        return result
    
    def optimize_and_run(
        self,
        input_text: str,
        mode: str = "balanced",
        format: str = "auto",
        model: Optional[str] = None,
        use_rag: bool = False,
        use_history: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
        rag_chunk_limit: Optional[int] = None,
        debug: bool = False,
    ) -> Dict[str, Any]:
        """
        End-to-end workflow: optimize input, call LLM, optimize output.
        
        Combines input optimization, LLM invocation, and output compression in a
        single API call. Designed for production workflows requiring minimal token
        usage throughout the request/response cycle.
        
        Args:
            input_text: User query or prompt to process
            mode: Compression mode (defaults to "balanced")
            format: Input format hint
            model: LLM model identifier (required if not set globally)
            use_rag: Enable RAG document compression
            use_history: Enable chat history compression (requires history parameter)
            history: List of previous conversation messages with "role" and "content" keys
            rag_chunk_limit: Maximum number of RAG chunks (default: 10)
            debug: Enable debug mode for detailed metrics
        
        Returns:
            Dictionary with final_answer, metrics, and optional debug info
        
        Raises:
            ValidationError: If input or history format is invalid
            EngineFailureError: If optimization or LLM call fails
            NetworkError: If network request fails
        """
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Input is required and must be a string")
        
        mode = self._normalize_mode(mode)
        
        result = self._http_post("/v1/optimize-run", {
            "userId": "sdk_user",
            "input": input_text,
            "format": format,
            "mode": mode,
            "model": model,
            "use_rag": use_rag,
            "use_history": use_history,
            "history": history,
            "rag_chunk_limit": rag_chunk_limit,
            "debug": debug,
        })
        
        if self.send_telemetry:
            metrics = result.get("metrics", {})
            print(f"[Telemetry] optimize_and_run: tokensUsed={metrics.get('total_tokens_used', 0)}, savings={metrics.get('final_total_savings_percent', '0%')}")
        
        return result
    
    def estimate_tokens(
        self,
        input_text: str,
        mode: str = "medium",
        format: str = "auto",
    ) -> Dict[str, Any]:
        """
        Estimate potential token savings without performing full optimization.
        
        Performs a lightweight optimization pass to calculate expected savings.
        Useful for cost estimation and budgeting decisions.
        
        Note: This method performs optimization internally for accuracy. For
        heuristic-only estimation, use count_tokens().
        
        Args:
            input_text: Text content to analyze
            mode: Compression mode to use
            format: Input format hint
        
        Returns:
            Dictionary with original_tokens, optimized_tokens, estimated_savings,
            and estimated_savings_percent
        
        Raises:
            ValidationError: If input is invalid
            EngineFailureError: If estimation fails
        """
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Input is required and must be a string")
        
        optimized = self.optimize(input_text, mode=mode, format=format)
        
        original_tokens = optimized.get("originalTokens") or self.count_tokens(input_text)
        optimized_tokens = optimized.get("optimizedTokens") or self.count_tokens(optimized.get("optimized", ""))
        estimated_savings = original_tokens - optimized_tokens
        estimated_savings_percent = (estimated_savings / original_tokens * 100) if original_tokens > 0 else 0
        
        return {
            "original_tokens": original_tokens,
            "optimized_tokens": optimized_tokens,
            "estimated_savings": estimated_savings,
            "estimated_savings_percent": round(estimated_savings_percent, 2),
        }
    
    def to_toon(self, input_text: str, format: str = "auto") -> str:
        """
        Convert structured data (JSON, YAML, CSV) to TOON format.
        
        TOON is YAVIQ's compact serialization format for LLM token efficiency.
        Preserves data structure while reducing token count by 40-70% compared to JSON.
        
        Args:
            input_text: Structured data string (JSON, YAML, or CSV)
            format: Input format hint ("auto", "json", "yaml", "csv")
        
        Returns:
            TOON-formatted string
        
        Raises:
            ValidationError: If input is invalid
            TOONParseError: If conversion fails
            EngineFailureError: If conversion engine fails
        """
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Input is required and must be a string")
        
        try:
            result = self._http_post("/v1/convert-to-toon", {
                "input": input_text,
                "format": format,
            })
            return result["toon"]
        except Exception as e:
            if isinstance(e, YAVIQError):
                raise
            raise TOONParseError(f"Convert to TOON failed: {e}")
    
    # Legacy alias for backward compatibility.
    def convert_to_compressed(self, input_text: str, format: str = "auto") -> str:
        return self.to_toon(input_text, format)
    
    def from_toon(self, toon: str) -> Any:
        """
        Convert TOON format back to native Python data structures.
        
        Args:
            toon: TOON-formatted string to parse
        
        Returns:
            Parsed Python object (dict, list, or primitive types)
        
        Raises:
            ValidationError: If TOON string is invalid
            TOONParseError: If parsing fails
            EngineFailureError: If conversion engine fails
        """
        if not toon or not isinstance(toon, str):
            raise ValidationError("TOON input is required and must be a string")
        
        try:
            result = self._http_post("/v1/convert-from-toon", {
                "toon": toon,
            })
            return result["json"]
        except Exception as e:
            if isinstance(e, YAVIQError):
                raise
            raise TOONParseError(f"Convert from TOON failed: {e}")

    # Legacy alias for backward compatibility.
    def convert_from_compressed(self, toon: str) -> Any:
        return self.from_toon(toon)
    
    def convert(self, input_text: str, format: Optional[str] = None) -> Dict[str, Any]:
        """
        Auto-detect format and convert to TOON with format metadata.
        
        Convenience method combining format detection and conversion.
        
        Args:
            input_text: Structured data string to convert
            format: Optional format hint. If None, format is auto-detected.
        
        Returns:
            Dictionary with "toon" and "format" keys
        
        Raises:
            ValidationError: If input is invalid
            TOONParseError: If conversion fails
            EngineFailureError: If conversion engine fails
        """
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Input is required and must be a string")
        
        try:
            result = self._http_post("/v1/convert-to-toon", {
                "input": input_text,
                "format": format or "auto",
            })
            return {
                "toon": result["toon"],
                "format": result["format"],
            }
        except Exception as e:
            if isinstance(e, YAVIQError):
                raise
            raise TOONParseError(f"Convert failed: {e}")
    
    def optimize_rag(
        self,
        docs: Union[str, List[str]],
        mode: str = "balanced",
        rag_chunk_limit: Optional[int] = None,
        debug: bool = False,
    ) -> Dict[str, Any]:
        """
        Optimize documents for Retrieval-Augmented Generation (RAG) workflows.
        
        Applies specialized compression for RAG contexts: chunk-level optimization,
        relevance-based selection, and semantic compression preserving retrieval signals.
        
        Args:
            docs: Single document string or list of document strings
            mode: Compression mode (defaults to "balanced")
            rag_chunk_limit: Maximum number of chunks to include (default: 10)
            debug: Enable debug mode for chunk-level diagnostics
        
        Returns:
            Same structure as optimize_and_run(), optimized for RAG workflows
        
        Raises:
            ValidationError: If documents are invalid
            EngineFailureError: If RAG optimization fails
        """
        input_text = "\n\n".join(docs) if isinstance(docs, list) else docs
        
        if not input_text or not isinstance(input_text, str):
            raise ValidationError("Documents are required")
        
        return self.optimize_and_run(
            input_text,
            mode=mode,
            use_rag=True,
            rag_chunk_limit=rag_chunk_limit or 10,
            debug=debug,
        )
    
    def compress_history(
        self,
        messages: List[Dict[str, str]],
        current_input: str,
        mode: str = "balanced",
        debug: bool = False,
    ) -> Dict[str, Any]:
        """
        Compress chat history to reduce token usage in multi-turn conversations.
        
        Applies intelligent compression: message summarization, relevance-based
        selection, and context preservation for recent critical messages.
        
        Args:
            messages: List of previous conversation messages with "role" and "content" keys
            current_input: Current user query/input to process
            mode: Compression mode (defaults to "balanced")
            debug: Enable debug mode to see compression details
        
        Returns:
            Same structure as optimize_and_run(), with history compression applied
        
        Raises:
            ValidationError: If messages format is invalid or current_input is missing
            EngineFailureError: If history compression fails
        """
        if not isinstance(messages, list) or len(messages) == 0:
            raise ValidationError("Messages array is required and must not be empty")
        
        if not current_input or not isinstance(current_input, str):
            raise ValidationError("Current input is required")
        
        return self.optimize_and_run(
            current_input,
            mode=mode,
            use_history=True,
            history=messages,
            debug=debug,
        )
    
    def count_tokens(self, text: str) -> int:
        """
        Estimate token count using heuristic word-to-token ratio (~0.75 words per token).
        
        Client-side estimation for quick estimates. For accurate token counts,
        use the API's token counting which accounts for model-specific tokenization,
        multi-byte characters, and special tokens.
        
        Args:
            text: Text string to estimate
        
        Returns:
            Estimated token count (integer, rounded)
        """
        if not text:
            return 0
        words = len(text.strip().split())
        return int(round(words / 0.75))
    
    def _normalize_mode(self, mode: str) -> str:
        """Normalize compression mode aliases to backend format."""
        mode_map = {
            "low": "safe",
            "safe": "safe",
            "medium": "balanced",
            "balanced": "balanced",
            "high": "aggressive",
            "aggressive": "aggressive",
        }
        return mode_map.get(mode, "balanced")


def optimize(
    api_key: str,
    input: str,
    format: str = "auto",
    mode: str = "medium",
    endpoint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Standalone function for backward compatibility.
    
    Creates a temporary client instance. For production code, prefer using
    YAVIQClient directly for better resource management.
    
    Args:
        api_key: API key for authentication
        input: Text to optimize
        format: Input format hint
        mode: Compression mode
        endpoint: Optional API endpoint override
    
    Returns:
        Optimization result dictionary
    """
    client = YAVIQClient(api_key=api_key, endpoint=endpoint)
    return client.optimize(input, mode=mode, format=format)


def estimate_tokens(text: str) -> int:
    """
    Standalone token estimation function for backward compatibility.
    
    Uses heuristic (~0.75 words per token). For accurate token counts,
    use the API's estimate_tokens() method.
    
    Args:
        text: Text string to estimate
    
    Returns:
        Estimated token count (integer)
    """
    if not text:
        return 0
    words = len(text.strip().split())
    return int(round(words / 0.75))
