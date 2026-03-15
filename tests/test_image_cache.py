"""Tests for user-scoped image caching in ads route."""

import json
import os
import sys
import tempfile
import threading
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from server.routes.ads import (
    _user_cache_dir,
    _prompt_hash,
    _load_cache_manifest,
    _save_cache_manifest,
    _gen_key,
    _generating,
    _gen_lock,
    GenerateImageRequest,
)


class TestCacheHelpers:
    def test_prompt_hash_deterministic(self):
        h1 = _prompt_hash("hello world")
        h2 = _prompt_hash("hello world")
        assert h1 == h2
        assert len(h1) == 12

    def test_prompt_hash_varies_on_input(self):
        h1 = _prompt_hash("prompt A")
        h2 = _prompt_hash("prompt B")
        assert h1 != h2

    def test_gen_key_includes_client_and_brief(self):
        key = _gen_key("user_123", "brief_001")
        assert "user_123" in key
        assert "brief_001" in key

    def test_gen_key_different_users_differ(self):
        k1 = _gen_key("alice", "brief_001")
        k2 = _gen_key("bob", "brief_001")
        assert k1 != k2

    def test_user_cache_dir_creates_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                path = _user_cache_dir("test_user", "brief_001")
                assert os.path.isdir(path)
                assert "test_user" in path
                assert "brief_001" in path

    def test_user_cache_dir_sanitizes_client_id(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                path = _user_cache_dir("../../etc/passwd", "brief_001")
                assert ".." not in os.path.basename(os.path.dirname(path))


class TestCacheManifest:
    def test_load_missing_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = _load_cache_manifest(tmpdir)
            assert result == {}

    def test_save_and_load_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            data = {"key1": {"image_files": ["/tmp/a.png"], "generated_at": "2025-01-01"}}
            _save_cache_manifest(tmpdir, data)
            loaded = _load_cache_manifest(tmpdir)
            assert loaded == data

    def test_load_corrupt_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "cache_manifest.json")
            with open(path, "w") as f:
                f.write("not valid json{{{")
            result = _load_cache_manifest(tmpdir)
            assert result == {}


class TestConcurrencyKeys:
    def test_concurrent_different_users_allowed(self):
        """Different client_ids for the same brief should not block each other."""
        k1 = _gen_key("alice", "brief_001")
        k2 = _gen_key("bob", "brief_001")

        with _gen_lock:
            _generating.add(k1)

        assert k1 in _generating
        assert k2 not in _generating

        with _gen_lock:
            _generating.discard(k1)

    def test_same_user_same_brief_blocked(self):
        k = _gen_key("alice", "brief_001")

        with _gen_lock:
            _generating.add(k)

        assert k in _generating

        with _gen_lock:
            _generating.discard(k)


class TestGenerateImageRequest:
    def test_defaults(self):
        req = GenerateImageRequest()
        assert req.client_id == "default"
        assert req.force_regenerate is False

    def test_custom_values(self):
        req = GenerateImageRequest(client_id="user_abc", force_regenerate=True)
        assert req.client_id == "user_abc"
        assert req.force_regenerate is True
