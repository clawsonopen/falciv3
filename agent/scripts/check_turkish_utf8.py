"""
UTF-8 / Türkçe karakter doğrulama scripti.
Çalıştır: python scripts/check_turkish_utf8.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCAN_FILES = [
    "token_server.py",
    "persona_prompt_builder.py",
    "agent.py",
]

MOJIBAKE_PATTERN = re.compile(r"[ÃÅÄ\ufffd]")
# 2+ question-marks surrounded by letters in a single quoted string → corrupted Turkish
QMARK_PATTERN = re.compile(r"[a-zA-Z]\?[a-zA-Z]")
ASCII_TURKISH_WORDS = re.compile(
    r"\b(icin|Icin|lutfen|Lutfen|gorsel|Gorsel|yanlis|Yanlis|"
    r"secim|Secim|simdi|Simdi|basla|Basla|baslat|Baslat|"
    r"giris|Giris|cikis|Cikis|gunluk|Gunluk|haftalik|Haftalik|"
    r"aylik|Aylik|iliski|Iliski|gokyuzu|Gokyuzu|oneri|Oneri|"
    r"guncelle|Guncelle|ozellik|Ozellik)\b"
)
TURKISH_CHAR_RE = re.compile(r"[çğışöüÇĞİŞÖÜ]")

# Lines that are NOT user-facing strings (URLs, regex patterns, etc.)
SKIP_LINE_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"countTokens\?key="),
    re.compile(r"generateContent\?key="),
]


def should_skip_line(line: str) -> bool:
    return any(p.search(line) for p in SKIP_LINE_PATTERNS)


def extract_string_literals(line: str) -> list[str]:
    """Extract quoted string contents from a Python line."""
    results = []
    for match in re.finditer(r"""(?:f?)(["'])((?:(?!\1).)*)\1""", line):
        results.append(match.group(2))
    return results


def check_file(filepath: str) -> list[dict]:
    issues = []
    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        issues.append({"type": "read-error", "file": filepath, "line": 0, "sample": str(e)})
        return issues

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()

        # Skip non-string lines and URLs
        if should_skip_line(stripped):
            continue

        # Check mojibake
        if MOJIBAKE_PATTERN.search(stripped):
            # Exclude the _repair_mojibake function itself and detection code
            if "repair_mojibake" not in stripped and "marker" not in stripped and "any(" not in stripped:
                issues.append({
                    "type": "mojibake",
                    "file": filepath,
                    "line": idx,
                    "sample": stripped[:180],
                })

        # Check question-mark replacement in string literals
        literals = extract_string_literals(stripped)
        for lit in literals:
            qm_count = len(QMARK_PATTERN.findall(lit))
            if qm_count >= 2:
                issues.append({
                    "type": "question-mark-turkish",
                    "file": filepath,
                    "line": idx,
                    "sample": lit[:180],
                })

        # Check ASCII-Turkish in string literals
        for lit in literals:
            if ASCII_TURKISH_WORDS.search(lit) and not TURKISH_CHAR_RE.search(lit):
                # Skip internal identifiers and comments
                if lit.strip().startswith("#") or "encoding" in lit or len(lit) < 4:
                    continue
                issues.append({
                    "type": "ascii-turkish",
                    "file": filepath,
                    "line": idx,
                    "sample": lit[:180],
                })

    return issues


def main():
    all_issues = []
    for filename in SCAN_FILES:
        filepath = os.path.join(ROOT, filename)
        if not os.path.exists(filepath):
            continue
        all_issues.extend(check_file(filepath))

    if not all_issues:
        print("✓ UTF-8/Türkçe kontrolü geçti (backend).")
        sys.exit(0)

    print("✗ UTF-8/Türkçe kontrol hataları (backend):", file=sys.stderr)
    for issue in all_issues:
        rel = os.path.relpath(issue["file"], ROOT)
        print(f"  [{issue['type']}] {rel}:{issue['line']} → {issue['sample']}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
