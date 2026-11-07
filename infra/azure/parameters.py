"""Print nonsecret foundation parameters only; no SDK, env reads or cloud calls."""
from __future__ import annotations

import argparse
import json
import re


def parameters(location: str = "spaincentral", administrator: str = "kayaowner") -> dict:
    if location != "spaincentral":
        raise ValueError("This reviewed pilot foundation is restricted to spaincentral")
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,30}", administrator):
        raise ValueError("Administrator must be 3–31 lowercase letters, digits or underscores")
    if administrator in {"admin", "administrator", "azure_superuser", "root", "guest", "public", "postgres"}:
        raise ValueError("Reserved PostgreSQL administrator name")
    return {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "location": {"value": location},
            "postgresAdministratorLogin": {"value": administrator},
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--location", default="spaincentral")
    parser.add_argument("--administrator", default="kayaowner")
    args = parser.parse_args()
    try:
        result = parameters(args.location, args.administrator)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
