import argparse
import subprocess
import json
import sys

import tempfile
import os

def run_graphql_query(query):
    # Write query to temp file to avoid shell escaping issues
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.graphql') as tmp:
        tmp.write(query)
        tmp_path = tmp.name
        
    try:
        # Use -F query=@file syntax (GitHub CLI supports this)
        # Note: On Windows, temp files might be locked if open, so we wrote and closed it.
        # We also need to handle the path carefully.
        # gh api graphql -F query=@...
        cmd = f'gh api graphql -F query=@"{tmp_path}"'
        # Force utf-8 encoding to handle emojis and special chars from GitHub CLI
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, encoding='utf-8', errors='replace')
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing GraphQL query: {e.stderr}")
        return None
    finally:
        if os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except: pass

def run_command(command):
    try:
        # Force utf-8 encoding to handle emojis and special chars from GitHub CLI
        result = subprocess.run(command, shell=True, check=True, capture_output=True, encoding='utf-8', errors='replace')
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        print(e.stderr)
        return None

def get_current_pr():
    # Try to get the PR for the current branch
    cmd = "gh pr view --json number"
    output = run_command(cmd)
    if output:
        try:
            data = json.loads(output)
            return data.get("number")
        except: pass
    return None

def get_threads(pr_number):
    # We can fetch owner/repo name first.
    repo_info = run_command("gh repo view --json owner,name")
    if not repo_info: return []
    repo_json = json.loads(repo_info)
    owner = repo_json['owner']['login']
    name = repo_json['name']

    final_query = f"""
    query {{
      repository(owner: "{owner}", name: "{name}") {{
        pullRequest(number: {pr_number}) {{
          reviewThreads(first: 50) {{
            nodes {{
              id
              isResolved
              path
              line
              originalLine
              comments(first: 1) {{
                nodes {{
                  author {{ login }}
                  body
                  createdAt
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """
    
    output = run_graphql_query(final_query)
    if not output: return []
    
    try:
        data = json.loads(output)
        return data['data']['repository']['pullRequest']['reviewThreads']['nodes']
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        # print(f"Output was: {output}")
        return []

def resolve_thread(thread_id):
    query = f'mutation {{ resolveReviewThread(input: {{threadId: "{thread_id}"}}) {{ thread {{ isResolved }} }} }}'
    run_graphql_query(query)
    print(f"Resolved thread {thread_id}")

def reply_thread(thread_id, body):
    # Escape body for GraphQL
    safe_body = body.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    query = f'mutation {{ addPullRequestReviewThreadReply(input: {{pullRequestReviewThreadId: "{thread_id}", body: "{safe_body}"}}) {{ comment {{ id body }} }} }}'
    output = run_graphql_query(query)
    if output:
        print(f"Replied to thread {thread_id}")

def main():
    parser = argparse.ArgumentParser(description="Manage PR Review Threads")
    parser.add_argument("--pr", type=int, help="Pull Request Number")
    parser.add_argument("--list", action="store_true", help="List unresolved threads")
    parser.add_argument("--all", action="store_true", help="List ALL threads (including resolved)")
    parser.add_argument("--resolve", type=str, help="Thread ID to resolve")
    parser.add_argument("--reply", type=str, help="Reply body text")
    parser.add_argument("--thread", type=str, help="Thread ID for reply (required if --reply used)")
    parser.add_argument("--resolve-all", action="store_true", help="Resolve ALL unresolved threads")
    
    args = parser.parse_args()
    
    pr_number = args.pr if args.pr else get_current_pr()
    if not pr_number:
        print("Could not determine PR number. Run inside a PR branch or specify --pr.")
        sys.exit(1)
        
    if args.list:
        threads = get_threads(pr_number)
        print(f"Review Threads for PR #{pr_number}:")
        count = 0
        for t in threads:
            if not args.all and t['isResolved']:
                continue
                
            status = "✅ Resolved" if t['isResolved'] else "🔴 Unresolved"
            comments = t['comments']['nodes']
            first_comment = comments[0] if comments else None
            author = first_comment['author']['login'] if first_comment else "Unknown"
            body = first_comment['body'].replace('\n', ' ') if first_comment else ""
            if len(body) > 100: body = body[:97] + "..."
            
            print(f"\nID: {t['id']}")
            print(f"Status: {status}")
            print(f"File: {t['path']} : {t['line'] or t['originalLine']}")
            print(f"Author: {author}")
            print(f"Content: {body}")
            count += 1
            
        if count == 0:
            print("No threads found matching criteria.")
            
    elif args.resolve:
        resolve_thread(args.resolve)
        if args.reply:
            reply_thread(args.resolve, args.reply)

    elif args.resolve_all:
        threads = get_threads(pr_number)
        unresolved = [t for t in threads if not t['isResolved']]
        if not unresolved:
            print(f"No unresolved threads found for PR #{pr_number}.")
        else:
            print(f"Resolving {len(unresolved)} threads...")
            for t in unresolved:
                resolve_thread(t['id'])
            
    elif args.reply:
        if not args.thread:
            print("Error: --thread ID required for reply.")
            sys.exit(1)
        reply_thread(args.thread, args.reply)
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
