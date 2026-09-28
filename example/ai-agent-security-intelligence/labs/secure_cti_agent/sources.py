from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


CVE_PATTERN = re.compile(r"^CVE-(1999|2\d{3})-\d{4,}$")


def normalize_cve(value: str) -> str:
    normalized = value.strip().upper()
    if not CVE_PATTERN.fullmatch(normalized):
        raise ValueError("INVALID_CVE")
    return normalized


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    source_id: str
    cve: str
    summary: str
    retrieved_at: str
    synthetic: bool


class FixtureSource:
    """Offline-only source. The model never controls a URL or file path."""

    def __init__(self) -> None:
        self._path = Path(__file__).parent / "fixtures" / "kev_sample.json"

    def lookup(self, cve: str) -> Evidence:
        wanted = normalize_cve(cve)
        payload = json.loads(self._path.read_text(encoding="utf-8"))
        if payload.get("synthetic") is not True:
            raise ValueError("FIXTURE_MUST_BE_SYNTHETIC")
        for item in payload.get("items", []):
            if normalize_cve(item["cve"]) == wanted:
                return Evidence(
                    evidence_id=item["evidence_id"],
                    source_id=payload["source_id"],
                    cve=wanted,
                    summary=item["summary"],
                    retrieved_at=payload["retrieved_at"],
                    synthetic=True,
                )
        raise LookupError("NOT_FOUND")


def evidence_to_text(evidence: Evidence) -> str:
    return json.dumps(
        {
            "evidence_id": evidence.evidence_id,
            "source_id": evidence.source_id,
            "cve": evidence.cve,
            "summary": evidence.summary,
            "retrieved_at": evidence.retrieved_at,
            "synthetic": evidence.synthetic,
        },
        ensure_ascii=False,
    )
