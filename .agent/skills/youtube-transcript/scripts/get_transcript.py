import sys
import requests
import re
import os
import concurrent.futures
from collections import Counter
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from youtube_transcript_api import (
    YouTubeTranscriptApi, 
    TranscriptsDisabled, 
    NoTranscriptFound, 
    VideoUnavailable, 
    CouldNotRetrieveTranscript
)

# --- Constants & Pre-compiled Regex ---
# Compiled patterns at module level avoid the overhead of re-compiling inside functions
# that may be called in loops or across multiple threads.
OUTPUT_DIR = os.path.join('.agent', 'research', 'yt-transcripts')

# This regex is broad to handle standard watch URLs, short URLs, and embed links. 
# It captures the 11-char ID which is the unique key for all YouTube API interactions.
VIDEO_ID_REGEX = re.compile(r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})")

# Basic scraping patterns for when an official API isn't available or needed.
TITLE_REGEX = re.compile(r'<title>(.*?)</title>')
CHANNEL_META_REGEX = re.compile(r'<link itemprop="name" content="(.*?)">')
CHANNEL_AUTHOR_REGEX = re.compile(r'"author":"(.*?)"')

# File systems are picky about characters like ":" or "?". 
# Sanitization ensures the script doesn't crash during IO on Windows/Linux.
FILENAME_SAFE_REGEX = re.compile(r'[<>:"/\\|?*]')

# Stopwords are selected to filter out structural/conversational filler.
# A minimum length of 6 characters is enforced later to focus on technical/unique nouns.
STOPWORDS = {
    "there", "these", "their", "about", "which", "would", "could", "should", "really", "actually", 
    "people", "things", "think", "going", "because", "every", "other", "where", "after", "before", 
    "right", "through", "while", "even", "under", "again", "more", "make", "what", "then", "into", 
    "also", "great", "thanks", "support", "button", "always", "watching", "youtube", "video", "channel"
}

@dataclass
class TranscriptBlock:
    """Represents a logically grouped segment of time (usually 60s)."""
    timestamp: str
    start: float
    text: str

@dataclass
class TranscriptData:
    """
    Central data model for a processed video. 
    Using a dataclass provides clear type hinting and prevents 'dictionary-string-key' errors
    during complex processing or template rendering.
    """
    url: str
    title: str = "YouTube Transcript"
    channel: str = "Unknown Channel"
    blocks: List[TranscriptBlock] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)

class YouTubeClient:
    """
    Handles connectivity to external services.
    Encapsulated to allow for future proxy support or alternative scraping methods.
    """
    def __init__(self):
        # A requests.Session reuses the underlying TCP connection (keep-alive).
        # This significantly speeds up multiple metadata fetches or redirect handling.
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"})

    def fetch_metadata(self, url: str) -> Dict[str, str]:
        """
        Scrapes video title and channel name. 
        Metadata failure is designated as NON-FATAL; the transcript is the primary goal.
        """
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            html = response.text
            
            title = "YouTube Transcript"
            title_match = TITLE_REGEX.search(html)
            if title_match:
                title = title_match.group(1).replace(" - YouTube", "").strip()
            
            # Channel names can be in different meta tags depending on the video type (standard vs music).
            # We try the standard schema.org tag first, then fallback to JSON-LD style.
            channel = "Unknown Channel"
            channel_match = CHANNEL_META_REGEX.search(html) or CHANNEL_AUTHOR_REGEX.search(html)
            if channel_match:
                channel = channel_match.group(1).strip()
                
            return {"title": title, "channel": channel}
        except Exception:
            return {"title": "YouTube Transcript", "channel": "Unknown Channel"}

    def fetch_transcript_raw(self, video_id: str) -> List:
        """
        Fetches the actual text snippets. 
        Exception mapping is used here to provide 'human-actionable' error messages 
        rather than exposing the user to technical Python stack traces.
        """
        try:
            return YouTubeTranscriptApi().fetch(video_id)
        except TranscriptsDisabled:
            raise Exception("ERROR: Transcripts are disabled for this video (Owner choice).")
        except NoTranscriptFound:
            raise Exception("ERROR: No transcript was found for this video in the requested language.")
        except VideoUnavailable:
            raise Exception("ERROR: This video is unavailable (Private, Deleted, or Region-Locked).")
        except CouldNotRetrieveTranscript:
            raise Exception("ERROR: Could not fetch the transcript (Network block or anti-bot).")
        except Exception as e:
            raise Exception(f"ERROR: Unexpected API failure: {str(e)}")

class TranscriptProcessor:
    """Handles pure logic transformations. No IO occurs here."""
    
    @staticmethod
    def group_blocks(raw_data: List) -> List[TranscriptBlock]:
        """
        Aggregates fragmented snippets into coherent 'paragraphs' by minute. 
        This is a 'readability' bridge: YouTube snippets are often 1-3 words, 
        which is difficult for both humans and AI to ingest effectively.
        """
        blocks = []
        current_interval = -1
        current_text = []
        current_start = 0

        for snippet in raw_data:
            # We support both object-style (new API) and dict-style (mocks/older API) 
            # to remain backwards compatible and testable.
            try:
                start_time = snippet.start
                text = snippet.text
            except AttributeError:
                start_time = snippet['start']
                text = snippet['text']

            interval = int(start_time // 60)

            if interval > current_interval:
                if current_text:
                    blocks.append(TranscriptBlock(
                        timestamp=TranscriptProcessor.format_seconds(current_start),
                        start=current_start,
                        text=" ".join(current_text)
                    ))
                current_interval = interval
                current_start = start_time
                current_text = [text.strip()]
            else:
                current_text.append(text.strip())

        # Cleanup: Don't forget the final trailing paragraph
        if current_text:
            blocks.append(TranscriptBlock(
                timestamp=TranscriptProcessor.format_seconds(current_start),
                start=current_start,
                text=" ".join(current_text)
            ))
        return blocks

    @staticmethod
    def format_seconds(seconds: float) -> str:
        """Human-readable time format for the Table of Contents/Headers."""
        seconds = int(seconds)
        if seconds < 3600:
            return f"{seconds // 60:02d}:{seconds % 60:02d}"
        else:
            return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"

    @staticmethod
    def extract_keywords(text: str, count: int = 10) -> List[str]:
        """
        Local frequency analysis to provide context without external AI cost.
        Longer words are targeted as they are statistically more likely to be 
        specific nouns, terms, or tech stacks rather than grammar fillers.
        """
        words = re.findall(r'\b\w{6,}\b', text.lower())
        filtered = [w for w in words if w not in STOPWORDS]
        return [word for word, _ in Counter(filtered).most_common(count)]

class TranscriptExporter:
    """Formats and writes result to disk."""
    
    @staticmethod
    def save_markdown(data: TranscriptData) -> str:
        """
        The Markdown output is designed for 'Dual Consumption':
        - YAML Frontmatter: For automated tools/agents to parse state.
        - Human-readable Body: For the developer to read/scan.
        """
        safe_title = FILENAME_SAFE_REGEX.sub('', data.title).strip()[:200]
        if not safe_title:
             match = VIDEO_ID_REGEX.search(data.url)
             vid_id = match.group(1) if match else "unknown"
             safe_title = f"transcript_{vid_id}"
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        file_path = os.path.join(OUTPUT_DIR, f"{safe_title}.md")
        
        # Strip existing 't=' parameters (and only 't=', preserving others if possible)
        # Using [^&#]* to match until the next parameter or fragment
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

        # Robustly strip 't' parameter using parse/unparse
        parsed = urlparse(data.url)
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        if 't' in query_params:
            del query_params['t']
        
        # Determine the correct separator based on the remaining query
        # If query params exist, use '?'. If not, the base URL is clean.
        # But wait, we need to reconstruct the FULL url without 't'.
        # Rebuilding the query string:
        new_query = urlencode(query_params, doseq=True)
        base_url = urlunparse((
            parsed.scheme, 
            parsed.netloc, 
            parsed.path, 
            parsed.params, 
            new_query, 
            parsed.fragment
        ))

        content_lines = []
        for b in data.blocks:
            separator = "&" if "?" in base_url else "?"
            jump_url = f"{base_url}{separator}t={int(b.start)}s"
            # Interactive headers allow the user to immediately jump to the relevant context.
            content_lines.append(f"### [{b.timestamp}]({jump_url})\n\n{b.text}\n")

        import json
        
        # Use json.dumps to ensure proper escaping of quotes for YAML values
        safe_title_yaml = json.dumps(data.title)
        safe_channel_yaml = json.dumps(data.channel)
        safe_url_yaml = json.dumps(data.url)
        safe_keywords_yaml = json.dumps(data.keywords)
        
        markdown = (
            f"---\n"
            f"title: {safe_title_yaml}\n"
            f"channel: {safe_channel_yaml}\n"
            f"url: {safe_url_yaml}\n"
            f"keywords: {safe_keywords_yaml}\n"
            f"---\n\n"
            f"# {data.title}\n\n"
            f"**Channel:** {data.channel}  \n"
            f"**Source URL:** {data.url}\n\n"
            f"---\n\n"
            f"## 🔑 Top Keywords\n"
            + ", ".join([f"`{k}`" for k in data.keywords]) + "\n\n"
            f"---\n\n"
            + "\n".join(content_lines)
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        return file_path

def get_video_id(url: str) -> Optional[str]:
    """Ensures input is valid. Returns None if we can't safely proceed."""
    match = VIDEO_ID_REGEX.search(url)
    if match: return match.group(1)
    if len(url) == 11 and re.match(r'[a-zA-Z0-9_-]{11}', url): return url
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python get_transcript.py <youtube_url>")
        sys.exit(1)

    url = sys.argv[1]
    video_id = get_video_id(url)
    if not video_id:
        # User-friendly validation prevents upstream API errors.
        print(f"Error: Invalid YouTube URL or Video ID: '{url}'")
        sys.exit(1)

    client = YouTubeClient()
    print(f"Fetching metadata and transcript for: {video_id}...")

    # --- Concurrency Model ---
    # We use ThreadPoolExecutor because these are I/O bound network requests.
    # Fetching HTML (Client) and Transcript (API) in parallel shaves ~50% off network latency.
    with concurrent.futures.ThreadPoolExecutor() as executor:
        meta_future = executor.submit(client.fetch_metadata, url)
        transcript_future = executor.submit(client.fetch_transcript_raw, video_id)
        
        try:
            metadata = meta_future.result()
            raw_transcript = transcript_future.result()
        except Exception as e:
            # Re-mapping exceptions to stderr ensures failure is loud and explicit.
            error_msg = str(e).replace("Exception: ", "")
            print(error_msg, file=sys.stderr)
            sys.exit(1)

    # --- Processing Chain ---
    try:
        blocks = TranscriptProcessor.group_blocks(raw_transcript)
        full_text = " ".join([b.text for b in blocks])
        keywords = TranscriptProcessor.extract_keywords(full_text)
        
        # Dataclass initialization encapsulates the entire 'state' of the transcription.
        data = TranscriptData(
            url=url, 
            title=metadata['title'], 
            channel=metadata['channel'],
            blocks=blocks,
            keywords=keywords
        )

        # --- Export ---
        file_path = TranscriptExporter.save_markdown(data)
        print(f"Success! Transcript saved to: {file_path}")
    except Exception as e:
        print(f"ERROR: Processing failure: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
