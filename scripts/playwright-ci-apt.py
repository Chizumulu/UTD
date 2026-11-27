#!/usr/bin/env python3
"""Disable only the unrelated Microsoft Ubuntu product feed on ephemeral CI runners."""
import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit


def microsoft_feed(uri):
    try:
        url = urlsplit(uri)
        return (url.scheme in ("http", "https")
                and url.hostname == "packages.microsoft.com"
                and re.fullmatch(r"/ubuntu/24\.04/prod/?", url.path) is not None)
    except ValueError:
        return False


def filter_list(text):
    def filter_line(line):
        match = re.match(r"^\s*deb(?:-src)?\s+(?:\[[^\]]*\]\s+)?(\S+)", line)
        return "# Disabled for Playwright CI: " + line if match and microsoft_feed(match[1]) else line
    return "".join(filter_line(line) for line in text.splitlines(keepends=True))


def filter_sources(text):
    # Preserve other feeds even when a deb822 stanza contains several URIs.
    def filter_stanza(stanza):
        match = re.search(r"(?im)^URIs:[ \t]*([^\n]*(?:\n[ \t]+[^\n]*)*)", stanza)
        if not match:
            return stanza
        uris = match[1].split()
        if not any(map(microsoft_feed, uris)):
            return stanza
        remaining = [uri for uri in uris if not microsoft_feed(uri)]
        if remaining:
            return stanza[:match.start()] + "URIs: " + " ".join(remaining) + stanza[match.end():]
        if re.search(r"(?im)^Enabled:[ \t]*no[ \t]*$", stanza):
            return stanza
        if re.search(r"(?im)^Enabled:", stanza):
            return re.sub(r"(?im)^Enabled:[^\n]*", "Enabled: no", stanza)
        return "Enabled: no\n" + stanza
    return "".join(filter_stanza(part) if i % 2 == 0 else part
                   for i, part in enumerate(re.split(r"(\n[ \t]*\n+)", text)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apt-root", type=Path, default=Path("/etc/apt"))
    args = parser.parse_args()
    paths = [args.apt_root / "sources.list"]
    paths += sorted((args.apt_root / "sources.list.d").glob("*.list"))
    paths += sorted((args.apt_root / "sources.list.d").glob("*.sources"))
    changed = 0
    for path in paths:
        if not path.is_file():
            continue
        original = path.read_text()
        updated = (filter_sources if path.suffix == ".sources" else filter_list)(original)
        if original != updated:
            path.write_text(updated)
            changed += 1
            print(f"Disabled unrelated Microsoft Ubuntu product feed in {path}")
    print(f"APT source files adjusted: {changed}; signature verification unchanged")


if __name__ == "__main__":
    main()
