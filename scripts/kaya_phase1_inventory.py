"""Inventory declared backend routes using AST only, without application imports."""
from __future__ import annotations

import argparse
import ast
import html
import json
from pathlib import Path
import re


METHODS = {"get", "post", "put", "patch", "delete", "websocket", "head", "options", "trace"}
REGISTRATIONS = METHODS | {"route", "api_route", "websocket_route", "add_route", "add_api_route", "add_api_websocket_route", "mount", "include_router"}


class InventoryError(ValueError):
    pass


def _skip_quoted(source: str, start: int) -> int:
    quote = source[start]
    cursor = start + 1
    while cursor < len(source):
        char = source[cursor]
        if char == "\\":
            cursor += 2
        elif char == quote:
            return cursor + 1
        elif quote == "`" and source.startswith("${", cursor):
            cursor = _skip_braces(source, cursor + 1)
        else:
            cursor += 1
    raise InventoryError("Unterminated quoted value in web route source")


def _skip_comment(source: str, start: int) -> int:
    if source.startswith("//", start):
        end = source.find("\n", start + 2)
        return len(source) if end == -1 else end + 1
    end = source.find("*/", start + 2)
    if end == -1:
        raise InventoryError("Unterminated comment in web route source")
    return end + 2


def _skip_braces(source: str, start: int) -> int:
    """Consume a JSX attribute expression, including strings and nested JSX."""
    depth = 1
    cursor = start + 1
    while cursor < len(source):
        char = source[cursor]
        if char in "\"'`":
            cursor = _skip_quoted(source, cursor)
            continue
        if source.startswith(("//", "/*"), cursor):
            cursor = _skip_comment(source, cursor)
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return cursor + 1
        cursor += 1
    raise InventoryError("Unterminated JSX route attribute expression")


def extract_web_routes(source: str) -> set[str]:
    """Extract explicit JSX Route paths without loading a TypeScript runtime.

    This constrained parser accepts attributes in any order and nested JSX in
    element expressions. Paths must be quoted, absolute literals (or '*').
    Expressions, spread attributes and unsupported syntax fail closed so route
    coverage cannot silently shrink. Comments and string contents are ignored.
    """
    routes: set[str] = set()
    cursor = 0
    while cursor < len(source):
        if source.startswith(("//", "/*"), cursor):
            cursor = _skip_comment(source, cursor)
            continue
        if source[cursor] in "\"'`":
            cursor = _skip_quoted(source, cursor)
            continue
        if not source.startswith("<Route", cursor) or (
            cursor + 6 < len(source) and source[cursor + 6] not in " \t\r\n/>"
        ):
            cursor += 1
            continue
        cursor += 6
        found_path = False
        while True:
            while cursor < len(source) and source[cursor].isspace():
                cursor += 1
            if source.startswith("/>", cursor):
                cursor += 2
                break
            if cursor < len(source) and source[cursor] == ">":
                cursor += 1
                break
            if cursor >= len(source):
                raise InventoryError("Unterminated Route opening tag")
            if source[cursor] == "{":
                raise InventoryError("Spread or expression attributes on Route require explicit review")
            match = re.match(r"[A-Za-z_$][A-Za-z0-9_$:.-]*", source[cursor:])
            if not match:
                raise InventoryError("Unsupported Route attribute syntax")
            name = match.group()
            cursor += len(name)
            while cursor < len(source) and source[cursor].isspace():
                cursor += 1
            if cursor >= len(source) or source[cursor] != "=":
                if name == "path":
                    raise InventoryError("Route path must have a quoted literal value")
                continue
            cursor += 1
            while cursor < len(source) and source[cursor].isspace():
                cursor += 1
            if cursor >= len(source):
                raise InventoryError("Unterminated Route attribute value")
            start = cursor
            if source[cursor] in "\"'":
                cursor = _skip_quoted(source, cursor)
                value = source[start + 1:cursor - 1]
                if name == "path":
                    if found_path:
                        raise InventoryError("Duplicate path attribute on Route")
                    found_path = True
                    value = html.unescape(value)
                    if not value or "\\" in value or any(char.isspace() for char in value) or not (value.startswith("/") or value == "*"):
                        raise InventoryError("Route path must be an absolute literal or '*' without whitespace")
                    routes.add(value)
            elif source[cursor] == "{":
                if name == "path":
                    raise InventoryError("Dynamic or expression Route path requires explicit review")
                cursor = _skip_braces(source, cursor)
                # Route declarations nested inside element expressions must also
                # be inventoried rather than hidden by the outer attribute.
                routes.update(extract_web_routes(source[start + 1:cursor - 1]))
            else:
                raise InventoryError("Unsupported unquoted Route attribute value")
    return routes


def _string(node: ast.AST, context: str) -> str:
    if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
        raise InventoryError("Nonliteral route metadata: " + context)
    return node.value


def _attribute(node: ast.AST, owner: str) -> str | None:
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == owner:
        return node.attr
    return None


def _decorated_routes(tree: ast.Module, owner: str, prefix: str, router: str, source: str) -> list[dict]:
    records = []
    seen_calls = set()
    for function in ast.walk(tree):
        if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in function.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            method = _attribute(decorator.func, owner)
            if method not in METHODS:
                continue
            if not decorator.args:
                raise InventoryError("Route path must be an explicit literal argument: " + source)
            path = prefix + _string(decorator.args[0], source)
            if not path.startswith("/"):
                raise InventoryError("Route has no absolute path: " + source)
            records.append({"router": router, "method": method.upper(), "path": path,
                            "handler": function.name, "source_path": source, "line": decorator.lineno})
            seen_calls.add(id(decorator))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            method = _attribute(node.func, owner)
            if method in REGISTRATIONS and id(node) not in seen_calls:
                if owner == "application" and method == "include_router":
                    continue
                raise InventoryError(f"Unrecognized route registration {owner}.{method} in {source}:{node.lineno}")
    return records


def extract_inventory(repo: Path) -> dict:
    repo = Path(repo).resolve()
    source = "backend/app/synthetic_runtime.py"
    main = ast.parse((repo / source).read_text())
    imports = {
        alias.asname or alias.name: alias.name
        for node in main.body if isinstance(node, ast.ImportFrom) and node.module == "routers"
        for alias in node.names
    }
    mounted = []
    for node in ast.walk(main):
        if not isinstance(node, ast.Call) or _attribute(node.func, "application") != "include_router":
            continue
        if len(node.args) != 1:
            raise InventoryError("include_router must contain one explicit router")
        target = node.args[0]
        if not (isinstance(target, ast.Attribute) and target.attr == "router" and isinstance(target.value, ast.Name) and target.value.id in imports):
            raise InventoryError("Unrecognized mounted router")
        mount_prefix = ""
        for keyword in node.keywords:
            if keyword.arg == "prefix":
                mount_prefix = _string(keyword.value, "include_router prefix")
            elif keyword.arg is None:
                raise InventoryError("Dynamic include_router options cannot be inventoried")
        mounted.append((imports[target.value.id], mount_prefix))
    if not mounted:
        raise InventoryError("No mounted routers found")
    records = []
    for name, mount_prefix in mounted:
        source = f"backend/app/routers/{name}.py"
        tree = ast.parse((repo / source).read_text())
        constructors = [node for node in tree.body if isinstance(node, ast.Assign)
                        and any(isinstance(target, ast.Name) and target.id == "router" for target in node.targets)
                        and isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name) and node.value.func.id == "APIRouter"]
        if len(constructors) != 1:
            raise InventoryError("Expected one explicit APIRouter assignment in " + source)
        prefix = ""
        for keyword in constructors[0].value.keywords:
            if keyword.arg == "prefix":
                prefix = _string(keyword.value, source + " prefix")
            elif keyword.arg is None:
                raise InventoryError("Dynamic APIRouter options cannot be inventoried: " + source)
        records.extend(_decorated_routes(tree, "router", mount_prefix + prefix, name, source))
    records.extend(_decorated_routes(main, "application", "", "system", "backend/app/synthetic_runtime.py"))
    identities = [(item["method"], item["path"]) for item in records]
    if len(identities) != len(set(identities)):
        raise InventoryError("Duplicate method/path declarations require review")
    return {"source": "AST only; no application imports", "mounted_router_count": len(mounted),
            "route_count": len(records), "routes": records}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    text = json.dumps(extract_inventory(args.repo), indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
