#!/usr/bin/env python3
import sys
try:
    from lofi_gate.logic import run_checks
except ImportError:
    print("❌ Critical Error: 'lofi-gate' package not installed.")
    print("Please run: pip install lofi-gate")
    sys.exit(1)

if __name__ == "__main__":
    # Run the verification logic
    sys.exit(run_checks())
