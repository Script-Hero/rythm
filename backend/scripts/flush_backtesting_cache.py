#!/usr/bin/env python3
"""
Flushes Backtesting Service Redis caches.

By default removes:
- backtest:chart_data:*  (cached equity/price series)
- backtest:trades:*      (cached trade lists)

Options allow adding custom patterns or including analytics backtest caches.
"""

import os
import sys
import argparse
from typing import List


def _connect_redis(url: str):
    try:
        import redis
    except ImportError:
        print("ERROR: Python package 'redis' is not installed.\n"
              "Install with: pip install redis", file=sys.stderr)
        sys.exit(1)

    try:
        client = redis.from_url(url, decode_responses=True)
        client.ping()
        return client
    except Exception as e:
        print(f"ERROR: Failed to connect to Redis at {url}: {e}", file=sys.stderr)
        sys.exit(1)


def _scan_and_delete(client, patterns: List[str], dry_run: bool = False, batch: int = 5000) -> int:
    total_deleted = 0
    for pattern in patterns:
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor=cursor, match=pattern, count=batch)
            if not keys:
                if cursor == 0:
                    break
            if keys:
                if dry_run:
                    print(f"Would delete {len(keys)} keys for pattern '{pattern}'")
                else:
                    # Use pipeline for efficiency
                    pipe = client.pipeline()
                    for k in keys:
                        pipe.delete(k)
                    deleted_counts = pipe.execute()
                    # redis returns 1 per key deleted, 0 if not found
                    deleted = sum(1 for x in deleted_counts if isinstance(x, int) and x > 0)
                    total_deleted += deleted
            if cursor == 0:
                break
    return total_deleted


def main():
    parser = argparse.ArgumentParser(description="Flush Backtesting Service caches from Redis")
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", os.getenv("BACKTEST_REDIS_URL", "redis://localhost:6379/0")),
                        help="Redis connection URL (env REDIS_URL) [default: %(default)s]")
    parser.add_argument("--include-analytics", action="store_true",
                        help="Also remove Analytics Service backtest caches (analytics:backtest:*)")
    parser.add_argument("--extra-pattern", action="append", default=[],
                        help="Additional key pattern(s) to delete (can be used multiple times)")
    parser.add_argument("--yes", "-y", action="store_true", help="Do not prompt for confirmation")
    parser.add_argument("--dry-run", action="store_true", help="List counts without deleting")

    args = parser.parse_args()

    # Default patterns for backtesting-service caches
    patterns = [
        "backtest:chart_data:*",
        "backtest:trades:*",
    ]
    if args.include_analytics:
        patterns.append("analytics:backtest:*")
    if args.extra_pattern:
        patterns.extend(args.extra_pattern)

    print("Redis URL:", args.redis_url)
    print("Key patterns to delete:")
    for p in patterns:
        print("  -", p)

    if not args.yes and not args.dry_run:
        confirm = input("Proceed with deletion? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("Aborted.")
            sys.exit(0)

    client = _connect_redis(args.redis_url)
    deleted = _scan_and_delete(client, patterns, dry_run=args.dry_run)
    if args.dry_run:
        print("Dry run complete.")
    else:
        print(f"Deleted {deleted} keys.")


if __name__ == "__main__":
    main()

