"""Tests for the WebSocket detection helper's pure-Python pieces."""

import pytest

from amdy import FRAME_SAMPLES, SAMPLE_RATE_HZ, pcm_frames


def test_frame_constants_match_spec():
    assert SAMPLE_RATE_HZ == 8000
    assert FRAME_SAMPLES == 320  # 20 ms of 8 kHz audio


def test_pcm_frames_split_into_320_sample_chunks():
    # 1000 samples of 16-bit audio -> 3 full frames + 1 partial
    pcm = b"\x00\x01" * 1000
    frames = list(pcm_frames(pcm))
    assert len(frames) == 4
    assert all(len(f) == 640 for f in frames[:3])
    assert len(frames[3]) == (1000 % 320) * 2


def test_pcm_frames_exact_multiple():
    pcm = b"\x00\x00" * 640  # 640 samples -> exactly 2 frames
    frames = list(pcm_frames(pcm))
    assert len(frames) == 2
    assert all(len(f) == 640 for f in frames)


def test_pcm_frames_empty():
    assert list(pcm_frames(b"")) == []


def test_detector_requires_optional_dependency(monkeypatch):
    import amdy.detect as detect_mod

    monkeypatch.setattr(detect_mod, "websockets", None)
    from amdy import AmdyDetector

    with pytest.raises(RuntimeError, match="amdy\\[ws\\]"):
        AmdyDetector()
