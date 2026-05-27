"""Export userVisitedSites from Firebase Realtime Database to a CSV.

Reads `userVisitedSites/{uid}/{siteId}` and joins each entry with the user
profile at `users/{uid}` and the full site record at `2026_sites/{siteId}` so
the output includes the site's zipCode (which isn't stored on the visited-site
record itself).

Output columns:
    site name, user first name, user last name, user email,
    site city, site state, site zipCode

Configuration:
    - FIREBASE_DATABASE_URL is loaded automatically from the project's .env
      (also checks scripts/.env). Override with --database-url if needed.
    - A Firebase service account JSON key is required for admin reads. Place
      it at scripts/serviceAccountKey.json (default) or pass --service-account.
      Generate one in Firebase Console → Project settings → Service accounts
      → "Generate new private key".

Usage:
    python scripts/export_visited_sites.py --output visited_sites.csv

Install dependencies:
    pip install -r scripts/requirements.txt
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import Any

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, db

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_SERVICE_ACCOUNT = SCRIPT_DIR / "serviceAccountKey.json"


def load_env() -> None:
    """Load .env from the project root, falling back to scripts/.env."""
    for candidate in (PROJECT_ROOT / ".env", SCRIPT_DIR / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def split_name(full_name: str | None) -> tuple[str, str]:
    """Split a full name into (first, last). Anything after the first space is last."""
    if not full_name:
        return "", ""
    parts = full_name.strip().split(None, 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def init_firebase(service_account_path: str, database_url: str) -> None:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred, {"databaseURL": database_url})


def fetch_dict(path: str) -> dict[str, Any]:
    """Fetch a path and normalize to a dict.

    Firebase returns lists when keys are sequential integers, so we coerce
    those into a string-keyed dict and drop any None placeholders (which
    Firebase inserts for gaps in numeric keys).
    """
    snapshot = db.reference(path).get()
    if snapshot is None:
        return {}
    if isinstance(snapshot, list):
        return {str(i): value for i, value in enumerate(snapshot) if value is not None}
    if isinstance(snapshot, dict):
        return snapshot
    raise RuntimeError(
        f"Expected dict or list at {path!r}, got {type(snapshot).__name__}"
    )


def normalize_collection(value: Any) -> dict[str, Any]:
    """Same list/dict normalization, but for an already-fetched value."""
    if value is None:
        return {}
    if isinstance(value, list):
        return {str(i): v for i, v in enumerate(value) if v is not None}
    if isinstance(value, dict):
        return value
    return {}


def export_to_csv(output_path: str) -> int:
    visited_by_user = fetch_dict("userVisitedSites")
    users = fetch_dict("users")
    sites = fetch_dict("2026_sites")

    rows_written = 0
    with open(output_path, "w", newline="", encoding="utf-8") as fp:
        writer = csv.writer(fp)
        writer.writerow(
            [
                "site name",
                "user first name",
                "user last name",
                "user email",
                "site city",
                "site state",
                "site zipCode",
            ]
        )

        for uid, visited_sites in visited_by_user.items():
            visited_sites = normalize_collection(visited_sites)
            if not visited_sites:
                continue

            user_profile = users.get(uid) or {}
            first_name, last_name = split_name(user_profile.get("name"))
            email = user_profile.get("email", "")

            for site_id, visited in visited_sites.items():
                if not isinstance(visited, dict):
                    continue

                full_site = sites.get(site_id) or sites.get(str(visited.get("id"))) or {}

                site_name = visited.get("name") or full_site.get("name", "")
                city = visited.get("city") or full_site.get("city", "")
                state = visited.get("state") or full_site.get("state", "")
                zip_code = full_site.get("zipCode", "")

                writer.writerow(
                    [
                        site_name,
                        first_name,
                        last_name,
                        email,
                        city,
                        state,
                        zip_code,
                    ]
                )
                rows_written += 1

    return rows_written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--service-account",
        default=None,
        help=(
            "Path to Firebase service account JSON key. Defaults to "
            f"{DEFAULT_SERVICE_ACCOUNT} or $GOOGLE_APPLICATION_CREDENTIALS."
        ),
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Firebase Realtime Database URL. Defaults to FIREBASE_DATABASE_URL from .env.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="visited_sites.csv",
        help="Output CSV path (default: visited_sites.csv).",
    )
    return parser.parse_args()


def resolve_service_account(cli_value: str | None) -> str | None:
    if cli_value:
        return cli_value
    env_value = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env_value:
        return env_value
    if DEFAULT_SERVICE_ACCOUNT.exists():
        return str(DEFAULT_SERVICE_ACCOUNT)
    return None


def main() -> int:
    load_env()
    args = parse_args()

    database_url = args.database_url or os.environ.get("FIREBASE_DATABASE_URL")
    if not database_url:
        print(
            "Error: FIREBASE_DATABASE_URL not found. Set it in .env or pass --database-url.",
            file=sys.stderr,
        )
        return 2

    service_account = resolve_service_account(args.service_account)
    if not service_account:
        print(
            "Error: No service account credentials found.\n"
            f"  Place the JSON key at {DEFAULT_SERVICE_ACCOUNT}, set "
            "GOOGLE_APPLICATION_CREDENTIALS, or pass --service-account.\n"
            "  Generate one in Firebase Console → Project settings → Service "
            'accounts → "Generate new private key".',
            file=sys.stderr,
        )
        return 2

    init_firebase(service_account, database_url)

    rows = export_to_csv(args.output)
    print(f"Wrote {rows} row(s) to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
