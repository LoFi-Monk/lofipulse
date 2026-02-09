---
name: youtube-transcript
description: Fetches the transcript (subtitles) from a YouTube video without requiring an API key.
---

# YouTube Transcript Getter

This skill retrieves the text transcript of a YouTube video using the `youtube-transcript-api` library and saves it to a file.

## Capabilities

- **High-Speed Fetching**: Uses parallel threading to fetch metadata and transcripts simultaneously.
- **Interactive Markdown**: Generates minute-by-minute paragraphs with clickable timestamp links to jump directly to YouTube at that moment.
- **AI-Ready Metadata**: Includes structured YAML frontmatter (title, channel, URL, keywords) for easy automated ingestion.
- **Automated Keywords**: Programmatically identifies top topics through frequency analysis without requiring external LLM costs.
- **Robust Error Handling**: Provides clear, actionable feedback for private videos or disabled captions.

## When to use

- **Research**: When you need to quickly extract information from a video without watching the whole thing (e.g. "What did they say about X?").
- **Code Extraction**: When a tutorial has code snippets that you want to copy/paste rather than typing out.
- **Content Summarization**: When you want to feed a video transcript into an LLM for summarization or analysis.
- **Keyword Search**: When you are looking for specific terms or topics within a large repository of video content.

## Prerequisites

- Python 3.x
- `youtube-transcript-api` (Install via `pip install youtube-transcript-api`)
- `requests` (Install via `pip install requests`)

## Instructions

When the user asks for a transcript of a video (e.g., "get transcript of https://www.youtube.com/watch?v=..."), run the `get_transcript.py` script.

### Usage

```bash
python .agent/skills/youtube-transcript/scripts/get_transcript.py <YOUTUBE_URL>
```

**Output:**

- Saves the transcript to `.agent/research/yt-transcripts/`.
- Prints the file path of the saved transcript.

### 4. Log Execution Result

- Follow the logging policy at `.agent/rules/skill-logging-policy.md`.
- Use status "Success" if the transcript was generated, "Failed" otherwise.
- Message should include the video title (if available) or URL.

## Examples

**User Request:**
"Get the transcript for https://www.youtube.com/watch?v=dQw4w9WgXcQ"

**Action:**

```bash
python .agent/skills/youtube-transcript/scripts/get_transcript.py https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
