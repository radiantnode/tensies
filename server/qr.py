"""Shared QR generation for the lobby invite — used both by the /api/qr SVG
endpoint and the WebSocket path that embeds the QR inline (as a base64 data URL)
so the lobby stamp shows it with no separate fetch. Ink-on-transparent so it
scans against the stamp's cream paper."""
import base64
import io

import segno

# Vermilion stamp ink — dark enough on the cream paper (~4.7:1) to scan.
_INK = "#b8442a"


def qr_svg(url: str) -> bytes:
    """QR SVG for a join URL: ink modules on a transparent background, small
    quiet zone, no XML prolog (fine for inline / <img>)."""
    buf = io.BytesIO()
    segno.make(url, error="m").save(
        buf, kind="svg", dark=_INK, light=None, border=2, xmldecl=False)
    return buf.getvalue()


def qr_data_url(url: str) -> str:
    """The same SVG as a base64 `data:` URL, for embedding in a WS message."""
    b64 = base64.b64encode(qr_svg(url)).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"
