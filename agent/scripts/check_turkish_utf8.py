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
    "agent.py",
]

MOJIBAKE_PATTERN = re.compile(r"[ÃÅÄ\ufffd]")
QMARK_PATTERN = re.compile(r"[a-zA-Z]\?[a-zA-Z]")
ASCII_TURKISH_WORDS = re.compile(
    r"\b(icin|Icin|lutfen|Lutfen|gorsel|Gorsel|yanlis|Yanlis|"
    r"secim|Secim|simdi|Simdi|basla|Basla|baslat|Baslat|"
    r"giris|Giris|cikis|Cikis|gunluk|Gunluk|haftalik|Haftalik|"
    r"aylik|Aylik|iliski|Iliski|gokyuzu|Gokyuzu|oneri|Oneri|"
    r"guncelle|Guncelle|ozellik|Ozellik)\b"
)
TURKISH_CHAR_RE = re.compile(r"[çğıöşüÇĞİÖŞÜ]")

SKIP_LINE_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"countTokens\?key="),
    re.compile(r"generateContent\?key="),
]


def should_skip_line(line: str) -> bool:
    return any(pattern.search(line) for pattern in SKIP_LINE_PATTERNS)


def extract_string_literals(line: str) -> list[str]:
    results = []
    for match in re.finditer(r"""(?:f?)(["'])((?:(?!\1).)*)\1""", line):
        results.append(match.group(2))
    return results


def check_file(filepath: str) -> list[dict]:
    issues = []
    try:
        with open(filepath, encoding="utf-8") as file:
            lines = file.readlines()
    except Exception as exc:
        issues.append({"type": "read-error", "file": filepath, "line": 0, "sample": str(exc)})
        return issues

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if should_skip_line(stripped):
            continue

        if MOJIBAKE_PATTERN.search(stripped):
            issues.append({
                "type": "mojibake",
                "file": filepath,
                "line": idx,
                "sample": stripped[:180],
            })

        for literal in extract_string_literals(stripped):
            if len(QMARK_PATTERN.findall(literal)) >= 2:
                issues.append({
                    "type": "question-mark-turkish",
                    "file": filepath,
                    "line": idx,
                    "sample": literal[:180],
                })

            if ASCII_TURKISH_WORDS.search(literal) and not TURKISH_CHAR_RE.search(literal):
                if literal.strip().startswith("#") or "encoding" in literal or len(literal) < 4:
                    continue
                issues.append({
                    "type": "ascii-turkish",
                    "file": filepath,
                    "line": idx,
                    "sample": literal[:180],
                })

    return issues


def main():
    all_issues = []
    for filename in SCAN_FILES:
        filepath = os.path.join(ROOT, filename)
        if os.path.exists(filepath):
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
