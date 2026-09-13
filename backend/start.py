"""Start the Phase 0 held API without migration, seeding or schema repair."""
import os


def main() -> None:
    if os.environ.get("KAYA_EXECUTION_MODE", "hold") != "hold":
        raise SystemExit("HOLD: this server entry point cannot start the synthetic runtime")

    import uvicorn

    port = int(os.environ.get("PORT", "8010"))
    print(f"[start] Starting held API on 0.0.0.0:{port}...", flush=True)
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
