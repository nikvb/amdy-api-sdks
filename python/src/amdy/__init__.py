"""AMDY Answering Machine Detection API SDK."""

from .client import AmdyClient, DEFAULT_BASE_URL, DEFAULT_TIMEOUT
from .detect import AmdyDetector, DEFAULT_WEBSOCKET_URL, FRAME_SAMPLES, SAMPLE_RATE_HZ, pcm_frames
from .exceptions import (
    AmdyApiError,
    AmdyAuthError,
    AmdyConnectionError,
    AmdyError,
    AmdyNotFoundError,
)

__version__ = "0.1.0"

__all__ = [
    "AmdyClient",
    "AmdyDetector",
    "DEFAULT_BASE_URL",
    "DEFAULT_TIMEOUT",
    "DEFAULT_WEBSOCKET_URL",
    "FRAME_SAMPLES",
    "SAMPLE_RATE_HZ",
    "pcm_frames",
    "AmdyError",
    "AmdyApiError",
    "AmdyAuthError",
    "AmdyNotFoundError",
    "AmdyConnectionError",
    "__version__",
]
