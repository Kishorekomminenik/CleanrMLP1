#!/usr/bin/env python3
"""
Convert Repro network NDJSON to a Postman collection.

Usage:
  python ndjson_to_postman.py input.ndjson output.postman_collection.json

Notes:
- Uses one Postman item per request.
- Keeps headers and request body when available.
- Groups requests by hostname.
- Skips entries without a URL or method.
- Does not try to recreate browser auth/cookies perfectly.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlparse


def load_ndjson(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                print(
                    f"[WARN] Skipping invalid JSON on line {line_no}: {exc}",
                    file=sys.stderr,
                )
                continue
            if isinstance(obj, dict):
                rows.append(obj)
            else:
                print(
                    f"[WARN] Skipping non-object JSON on line {line_no}",
                    file=sys.stderr,
                )
    return rows


def normalize_headers(raw: Any) -> list[dict[str, str]]:
    """
    Accepts:
    - dict[str, str]
    - list[{"name": "...", "value": "..."}]
    - list[["Header", "Value"]]
    """
    output: list[dict[str, str]] = []

    if raw is None:
        return output

    if isinstance(raw, dict):
        for k, v in raw.items():
            output.append({"key": str(k), "value": "" if v is None else str(v)})
        return output

    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                name = item.get("name") or item.get("key")
                value = item.get("value")
                if name is not None:
                    output.append(
                        {"key": str(name), "value": "" if value is None else str(value)}
                    )
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                output.append(
                    {"key": str(item[0]), "value": "" if item[1] is None else str(item[1])}
                )
        return output

    return output


def is_static_asset_url(url: str | None) -> bool:
    if not url:
        return True
    lower = url.lower()
    if (
        lower.startswith("chrome://")
        or lower.startswith("edge://")
        or lower.startswith("about:")
        or lower.startswith("chrome-extension://")
        or lower.startswith("moz-extension://")
    ):
        return True
    static_exts = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
        ".ico",
        ".css",
        ".map",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".eot",
        ".mp4",
        ".mp3",
        ".webm",
        ".wav",
        ".m4a",
        ".avi",
        ".mov",
        ".pdf",
    ]
    return any(ext in lower for ext in static_exts)


def is_static_mime_type(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    lower = mime_type.lower()
    return (
        lower.startswith("image/")
        or lower.startswith("font/")
        or lower.startswith("audio/")
        or lower.startswith("video/")
        or lower == "text/css"
        or "font-woff" in lower
        or "font-woff2" in lower
        or "font-opentype" in lower
        or "font-ttf" in lower
        or "font-eot" in lower
    )


def get_header_value(raw: Any, name: str) -> str:
    if not raw:
        return ""
    target = name.lower()
    if isinstance(raw, dict):
        for key, value in raw.items():
            if str(key).lower() == target:
                return "" if value is None else str(value)
        return ""
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                key = item.get("key") or item.get("name")
                if key and str(key).lower() == target:
                    return "" if item.get("value") is None else str(item.get("value"))
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                if str(item[0]).lower() == target:
                    return "" if item[1] is None else str(item[1])
    return ""


def is_api_like_other(entry: dict[str, Any]) -> bool:
    method = str(entry.get("method") or "").upper()
    if method and method not in ("GET", "HEAD", "OPTIONS"):
        return True
    url = str(entry.get("url") or "").lower()
    if "/api/" in url or "/graphql" in url:
        return True
    content_type = get_header_value(entry.get("request_headers"), "content-type").lower()
    if (
        "application/json" in content_type
        or "application/graphql" in content_type
        or "application/x-www-form-urlencoded" in content_type
    ):
        return True
    response_mime = str(entry.get("response_mime_type") or "").lower()
    if "json" in response_mime or "graphql" in response_mime:
        return True
    return False


def is_eligible_entry(entry: dict[str, Any]) -> bool:
    url = str(entry.get("url") or "")
    method = str(entry.get("method") or "")
    if not url or not method:
        return False
    if is_static_asset_url(url) or is_static_mime_type(entry.get("response_mime_type")):
        return False
    resource_type = str(entry.get("resource_type") or "").lower()
    if resource_type in ("xhr", "fetch"):
        return True
    if resource_type == "other":
        return is_api_like_other(entry)
    if not resource_type:
        return is_api_like_other(entry)
    return False


def guess_body_mode(
    body: Any, headers: list[dict[str, str]]
) -> tuple[str, Any] | None:
    if body in (None, "", b""):
        return None

    content_type = ""
    for h in headers:
        if h["key"].lower() == "content-type":
            content_type = h["value"].lower()
            break

    if isinstance(body, (dict, list)):
        return ("raw", json.dumps(body, indent=2))

    body_str = body if isinstance(body, str) else str(body)

    if "application/json" in content_type:
        try:
            parsed = json.loads(body_str)
            return ("raw", json.dumps(parsed, indent=2))
        except Exception:
            return ("raw", body_str)

    if "application/x-www-form-urlencoded" in content_type:
        form_rows = [
            {"key": k, "value": v, "type": "text"}
            for k, v in parse_qsl(body_str, keep_blank_values=True)
        ]
        return ("urlencoded", form_rows)

    return ("raw", body_str)


def build_postman_url(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.split("/") if p]
    query = [{"key": k, "value": v} for k, v in parse_qsl(parsed.query, keep_blank_values=True)]

    return {
        "raw": url,
        "protocol": parsed.scheme,
        "host": parsed.hostname.split(".") if parsed.hostname else [],
        "port": str(parsed.port) if parsed.port else None,
        "path": path_parts,
        "query": query,
    }


def clean_postman_url(url_obj: dict[str, Any]) -> dict[str, Any]:
    if url_obj.get("port") is None:
        url_obj.pop("port", None)
    if not url_obj.get("query"):
        url_obj.pop("query", None)
    if not url_obj.get("path"):
        url_obj["path"] = []
    return url_obj


def request_name(entry: dict[str, Any]) -> str:
    method = str(entry.get("method") or "GET").upper()
    url = str(entry.get("url") or "")
    parsed = urlparse(url)
    path = parsed.path or "/"
    status = entry.get("response_status")
    if status is not None:
        return f"{method} {path} [{status}]"
    return f"{method} {path}"


def build_item(entry: dict[str, Any]) -> dict[str, Any] | None:
    url = entry.get("url")
    method = str(entry.get("method") or "").upper()

    if not url or not method:
        return None
    if not is_eligible_entry(entry):
        return None

    headers = normalize_headers(entry.get("request_headers"))
    body_mode = None
    if not entry.get("request_body_unavailable") and not entry.get(
        "request_body_truncated"
    ):
        body_mode = guess_body_mode(entry.get("request_post_data"), headers)

    req: dict[str, Any] = {
        "method": method,
        "header": headers,
        "url": clean_postman_url(build_postman_url(str(url))),
    }

    if body_mode:
        mode, body_value = body_mode
        if mode == "raw":
            req["body"] = {"mode": "raw", "raw": body_value}
            content_type = next(
                (h["value"].lower() for h in headers if h["key"].lower() == "content-type"),
                "",
            )
            if "application/json" in content_type:
                req["body"]["options"] = {"raw": {"language": "json"}}
        elif mode == "urlencoded":
            req["body"] = {"mode": "urlencoded", "urlencoded": body_value}

    description_bits: list[str] = []
    for key in [
        "timestamp",
        "request_id",
        "resource_type",
        "response_status",
        "response_status_text",
        "incomplete",
        "finalize_reason",
        "error_text",
        "request_body_truncated",
        "response_body_truncated",
        "request_body_unavailable",
        "response_body_unavailable",
        "response_body_skipped",
    ]:
        if key in entry:
            description_bits.append(f"{key}: {entry[key]}")

    response_headers = normalize_headers(entry.get("response_headers"))
    response_body = None
    if not entry.get("response_body_unavailable") and not entry.get(
        "response_body_skipped"
    ):
        response_body = entry.get("response_body")
    saved_responses: list[dict[str, Any]] = []

    if entry.get("response_status") is not None or response_headers or response_body not in (
        None,
        "",
    ):
        body_text = ""
        if isinstance(response_body, (dict, list)):
            body_text = json.dumps(response_body, indent=2)
        elif response_body is not None:
            body_text = str(response_body)

        status_text = entry.get("response_status_text")
        status_text = status_text if status_text else str(entry.get("response_status") or "")
        saved_responses.append(
            {
                "name": f"Example response {entry.get('response_status', '')}".strip(),
                "originalRequest": req,
                "status": status_text,
                "code": int(entry.get("response_status") or 0)
                if str(entry.get("response_status") or "").isdigit()
                else 0,
                "header": response_headers,
                "body": body_text,
            }
        )

    item: dict[str, Any] = {
        "name": request_name(entry),
        "request": req,
    }

    if description_bits:
        item["request"]["description"] = "\n".join(description_bits)

    if saved_responses:
        item["response"] = saved_responses

    return item


def group_by_host(entries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        url = str(entry.get("url") or "")
        host = urlparse(url).hostname or "unknown-host"
        grouped[host].append(entry)
    return grouped


def build_collection(entries: list[dict[str, Any]], source_name: str) -> dict[str, Any]:
    grouped = group_by_host(entries)
    folders: list[dict[str, Any]] = []

    for host in sorted(grouped.keys()):
        items: list[dict[str, Any]] = []
        for entry in grouped[host]:
            item = build_item(entry)
            if item:
                items.append(item)
        if items:
            folders.append({"name": host, "item": items})

    return {
        "info": {
            "name": f"Repro Import - {source_name}",
            "_postman_id": f"repro-{source_name}",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "description": "Generated from Repro network NDJSON export.",
        },
        "item": folders,
        "variable": [],
    }


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: python ndjson_to_postman.py input.ndjson output.postman_collection.json",
            file=sys.stderr,
        )
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"[ERROR] Input file not found: {input_path}", file=sys.stderr)
        return 1

    entries = load_ndjson(input_path)
    if not entries:
        print("[ERROR] No valid NDJSON entries found.", file=sys.stderr)
        return 1

    collection = build_collection(entries, input_path.stem)
    output_path.write_text(
        json.dumps(collection, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"[OK] Wrote Postman collection: {output_path}")
    print(
        f"[OK] Requests processed: {sum(len(folder['item']) for folder in collection['item'])}"
    )
    print(f"[OK] Host groups: {len(collection['item'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
