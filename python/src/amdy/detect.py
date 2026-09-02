"""Minimal WebSocket detection-stream helper.

Matches the spec's ``x-websocket`` definition: connect to
``wss://api.amdy.io:2700``, send raw 8 kHz 16-bit signed little-endian mono
PCM in 320-sample (20 ms) frames, and receive a JSON verdict with the
detection result, consumed audio duration, and confidence score.

Requires the optional dependency: ``pip install amdy[ws]``.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional

try:
    import websockets
except ImportError:  # pragma: no cover - exercised only without the extra
    websockets = None  # type: ignore[assignment]

DEFAULT_WEBSOCKET_URL = "wss://api.amdy.io:2700"
SAMPLE_RATE_HZ = 8000
FRAME_SAMPLES = 320  # 20 ms of 8 kHz audio
BYTES_PER_SAMPLE = 2


def pcm_frames(pcm: bytes, frame_samples: int = FRAME_SAMPLES):
    """Split raw PCM bytes into 320-sample frames (640 bytes each)."""
    frame_bytes = frame_samples * BYTES_PER_SAMPLE
    for offset in range(0, len(pcm), frame_bytes):
        yield pcm[offset : offset + frame_bytes]


class AmdyDetector:
    """Streams PCM to the AMDY detection WebSocket and returns the verdict."""

    def __init__(self, url: str = DEFAULT_WEBSOCKET_URL) -> None:
        if websockets is None:
            raise RuntimeError(
                "the 'websockets' package is required for detection; "
                "install with: pip install amdy[ws]"
            )
        self.url = url

    async def detect_async(self, pcm: bytes, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Send all 320-sample frames from ``pcm`` and return the JSON verdict."""
        async with websockets.connect(self.url) as ws:
            for frame in pcm_frames(pcm):
                await ws.send(frame)
            message = await asyncio.wait_for(ws.recv(), timeout)
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        return json.loads(message)

    def detect(self, pcm: bytes, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Blocking wrapper around :meth:`detect_async`."""
        return asyncio.run(self.detect_async(pcm, timeout=timeout))
