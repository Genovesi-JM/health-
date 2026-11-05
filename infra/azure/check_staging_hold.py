"""Fail closed before/after a staging image update; never prints app settings."""
import json
import sys


def validate(app):
    if app.get("name") != "ca-kaya-staging-api":
        raise ValueError("Unexpected staging application")
    properties = app["properties"]
    ingress = properties["configuration"]["ingress"]
    if ingress.get("external") is not False or ingress.get("targetPort") != 8000:
        raise ValueError("Staging must have internal ingress on port 8000")
    containers = properties["template"]["containers"]
    if len(containers) != 1:
        raise ValueError("Unreviewed container configuration")
    container = containers[0]
    if container.get("command") or container.get("args"):
        raise ValueError("An entry-point override could bypass the clinical HOLD")
    settings = {item["name"]: item for item in container.get("env", [])}
    mode = settings.get("KAYA_EXECUTION_MODE")
    if mode is not None and mode.get("value") != "hold":
        raise ValueError("Clinical execution mode must remain held")
    probes = container.get("probes", [])
    if not probes or any(probe.get("tcpSocket", {}).get("port") != 8000 for probe in probes):
        raise ValueError("The held service requires TCP probes")
    return True


if __name__ == "__main__":
    try:
        validate(json.load(sys.stdin))
    except (ValueError, KeyError, TypeError):
        raise SystemExit("Internal HOLD configuration check failed")
    print("Internal HOLD configuration verified; clinical acceptance remains separate")
