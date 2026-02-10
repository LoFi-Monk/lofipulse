import argparse
import os
import datetime
import sys

# --- Configuration ---
MAX_LOG_LINES = 200
LOG_FILENAME = "verification_history.md"

def get_log_path():
    """
    Determines the path to the centralized log file.
    
    Why: The Judge Skill runs inside an isolated environment (scripts dir),
    but it must write to the same 'verification_history.md' in the Project Root
    that `lofi_gate.py` uses.
    
    Navigation:
    [Root]/lofi-gate/.agent/skills/lofi-gate-judge/scripts/logger.py
    We traverse up 4 levels to find [Root]/lofi-gate/
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "../../../../"))
    return os.path.join(project_root, LOG_FILENAME)

def parse_footer(lines):
    """
    Parses the "Sticky Footer" to preserve running totals.
    Matches logic in lofi_gate.py exactly.
    """
    size = 0
    savings = 0
    clean_lines = []
    # Footer format: "> 📊 **Total Token Size:** 123 | 💰 **Total Token Savings:** 456"
    footer_marker_size = "**Total Token Size:**"
    
    for line in lines:
        if footer_marker_size in line:
            try:
                # Remove Markdown quoting and splitting
                content = line.strip().replace("> ", "")
                parts = content.split("|")
                
                # Part 0: extract Size
                p0 = parts[0].split(":")[-1].strip().replace("*", "")
                size = int(p0)
                
                # Part 1: extract Savings
                if len(parts) > 1:
                    p1 = parts[1].split(":")[-1].strip().replace("*", "")
                    savings = int(p1)
            except: pass
        else:
            clean_lines.append(line)
            
    return clean_lines, size, savings

def log_to_history(label, status, message, tokens_used=0, tokens_saved=0, duration=0, command_context="", error_content=None):
    """
    Appends a log entry to the history file with metrics and interaction.
    """
    log_path = get_log_path()
    if not log_path:
        print("Error: Could not determine log path.")
        return

    # 1. Read all lines
    lines = []
    if os.path.exists(log_path):
        try:
            with open(log_path, 'r', encoding='utf-8') as f: lines = f.readlines()
        except: pass

    # 2. Extract & Remove Footer (so we can append it later)
    lines, current_size, current_savings = parse_footer(lines)
    
    # 3. Log Rotation
    # Keeps the log file lightweight.
    SAFE_LOG_LINES = MAX_LOG_LINES * 2
    if len(lines) > SAFE_LOG_LINES:
        lines = lines[-SAFE_LOG_LINES:]
        if not lines[0].startswith("\n..."):
                lines.insert(0, f"\n... (Log truncated to last {SAFE_LOG_LINES} lines) ...\n")

    # 4. Update Totals
    current_size += tokens_used
    current_savings += tokens_saved

    # 5. Format Entry
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Judge Statuses might be APPROVED/REJECTED, map them widely.
    icon = "✅" if status in ["PASS", "APPROVED", "SUCCESS"] else "❌"
    
    duration_str = f"({duration:.2f}s)" if duration > 0 else ""
    # Metrics display for the line item
    metrics_msg = f"(total token size: {tokens_used}) (tokens truncated: {tokens_saved})"
    
    context_str = f"[{command_context}]" if command_context else "[Internal]"
    
    entry = f"- **[{timestamp}]** {context_str} {icon} **{label}**: {status} {duration_str} {metrics_msg}\n"
    lines.append(entry)
    
    # 6. Append Error Snippet (HTML Dropdown)
    if error_content:
        lines.append("  <details>\n")
        lines.append("  <summary>🔍 View Details</summary>\n\n")
        lines.append("  ```text\n")
        for line in error_content.splitlines():
            lines.append(f"  {line}\n")
        lines.append("  ```\n")
        lines.append("  </details>\n")

    # 7. Append New Sticky Footer
    footer = f"\n> 📊 **Total Token Size:** {current_size} | 💰 **Total Token Savings:** {current_savings}\n"
    lines.append(footer)
    
    # 8. Write
    try:
        # Ensure dir exists in case this is the first run
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, 'w', encoding='utf-8') as f: f.writelines(lines)
        print(f"Logged to {LOG_FILENAME}")
    except Exception as e:
        print(f"Error writing to log: {e}")

if __name__ == "__main__":
    # CLI Interface for the Judge Skill to call this script
    parser = argparse.ArgumentParser(description="Unified Logger for LoFi Gate")
    parser.add_argument("--label", required=True, help="Label of the check (e.g. Test Suite)")
    parser.add_argument("--status", required=True, help="Status (PASS, FAIL, etc)")
    parser.add_argument("--message", default="", help="Log message content")
    
    # Optional Metrics
    parser.add_argument("--tokens-used", type=int, default=0, help="Total tokens in output")
    parser.add_argument("--tokens-saved", type=int, default=0, help="Tokens saved by truncation")
    parser.add_argument("--duration", type=float, default=0.0, help="Duration in seconds")
    parser.add_argument("--command", default="", help="Command context (e.g. npm test)")
    parser.add_argument("--error-content", default="", help="Error snippet to wrap in details")
    
    args = parser.parse_args()
    
    log_to_history(
        args.label, 
        args.status, 
        args.message, 
        args.tokens_used, 
        args.tokens_saved, 
        args.duration, 
        args.command, 
        args.error_content
    )
