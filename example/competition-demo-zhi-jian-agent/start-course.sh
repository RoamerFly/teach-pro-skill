#!/bin/sh
case "$0" in */*) cd "${0%/*}" || exit 1 ;; esac
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 &&
    "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
    exec "$candidate" serve_course.py "$@"
  fi
done
printf '%s\n' 'Python 3.11 or newer is required. Install it and try again.' >&2
exit 1
