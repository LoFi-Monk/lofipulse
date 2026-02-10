
import sys
import os
import unittest
import shutil

# Add the script path to sys.path
SCRIPT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.agent', 'skills', 'youtube-transcript', 'scripts'))
sys.path.append(SCRIPT_DIR)

from get_transcript import TranscriptExporter, TranscriptData, TranscriptBlock

class TestIssue9(unittest.TestCase):
    def setUp(self):
        # Clean up output dir before test
        self.output_dir = os.path.join('.agent', 'research', 'yt-transcripts')
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)

    def test_youtube_short_link_timestamp(self):
        # Setup data with a short link
        url = "https://youtu.be/dQw4w9WgXcQ"
        data = TranscriptData(
            url=url,
            title="Test Video",
            channel="Test Channel",
            blocks=[
                TranscriptBlock(timestamp="00:00", start=0.0, text="Intro"),
                TranscriptBlock(timestamp="01:00", start=60.0, text="Content")
            ],
            keywords=["test"]
        )

        # Execute
        file_path = TranscriptExporter.save_markdown(data)
        
        # Verify
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Debug output
        print(f"Generated Content:\n{content}")

        # Assert correct timestamp format for youtu.be short links (MUST use ?t=, not &t=)
        self.assertIn("https://youtu.be/dQw4w9WgXcQ?t=0s", content)
        self.assertIn("https://youtu.be/dQw4w9WgXcQ?t=60s", content)
        
        # Explicit check to ensure we don't have the bug
        self.assertNotIn("&t=", content)

if __name__ == '__main__':
    unittest.main()
