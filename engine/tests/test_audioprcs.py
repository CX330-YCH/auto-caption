import importlib.util
import unittest
from pathlib import Path

import numpy as np


ENGINE_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ENGINE_ROOT / 'utils' / 'audioprcs.py'
SPEC = importlib.util.spec_from_file_location('audio_processing_under_test', MODULE_PATH)
audio_processing = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audio_processing)


class AudioProcessingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture_path = ENGINE_ROOT / 'tests' / 'fixtures' / 'stereo_s16le.hex'
        cls.stereo_chunk = bytes.fromhex(fixture_path.read_text(encoding='utf-8').strip())

    def test_mono_audio_is_returned_unchanged(self):
        mono_chunk = np.array([100, -200, 300], dtype=np.int16).tobytes()

        self.assertEqual(
            audio_processing.merge_chunk_channels(mono_chunk, 1),
            mono_chunk
        )

    def test_stereo_audio_is_averaged_into_mono(self):
        result = audio_processing.merge_chunk_channels(self.stereo_chunk, 2)

        self.assertEqual(
            np.frombuffer(result, dtype=np.int16).tolist(),
            [0, 2000, -1500, 32767, 200]
        )

    def test_same_rate_resampling_still_merges_channels(self):
        result = audio_processing.resample_chunk_mono(
            self.stereo_chunk,
            channels=2,
            orig_sr=16000,
            target_sr=16000
        )

        self.assertEqual(
            np.frombuffer(result, dtype=np.int16).tolist(),
            [0, 2000, -1500, 32767, 200]
        )

    def test_resampling_produces_the_expected_frame_count(self):
        sample_count = 4800
        sample_positions = np.arange(sample_count)
        tone = (
            np.sin(2 * np.pi * 440 * sample_positions / 48000) * 12000
        ).astype(np.int16)

        result = audio_processing.resample_chunk_mono(
            tone.tobytes(),
            channels=1,
            orig_sr=48000,
            target_sr=16000
        )

        self.assertEqual(len(result), 1600 * np.dtype(np.int16).itemsize)

    def test_invalid_interleaved_channel_data_is_rejected(self):
        with self.assertRaises(ValueError):
            audio_processing.merge_chunk_channels(b'\x00\x00', 2)


if __name__ == '__main__':
    unittest.main()
