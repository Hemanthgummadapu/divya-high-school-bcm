"""Debug script: load first paper, build payload, write to tmp_payload.json."""

import json
from pathlib import Path

# Paths relative to project root
ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "question-papers.json"
OUT_PATH = ROOT / "tmp_payload.json"

def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    papers = data.get("papers", [])
    if not papers:
        print("No papers found.")
        return

    paper = papers[0]
    payload = {
        "header": {
            "subject": paper.get("subject", ""),
            "class": paper.get("grade", ""),
        },
        "questions": paper.get("questions", []),
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    n = len(payload["questions"])
    print(f"Number of questions found: {n}")

if __name__ == "__main__":
    main()
