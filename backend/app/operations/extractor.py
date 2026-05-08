"""
Regex-based extractor for logistics references, status and delay causes.
Stage 2 will replace/augment this with Ollama LLM.
"""
import re
from typing import Any

# ── Reference patterns ────────────────────────────────────

_SO_PATTERNS = [
    r'\bService\s+Order[-:\s#]+(\d{4,12})\b',
    r'\bSO[-\s#]?(\d{5,12})\b',
    r'\bS\.O\.[-:\s]+([A-Z0-9\-]{4,15})\b',
    r'\bSOA?[-\s]?(\d{5,12})\b',
]

_BL_PATTERNS = [
    # STOR-format HBL (e.g. STOR0158537)
    r'\b(STOR\d{5,12})\b',
    r'\bB/?L[-:\s#]+([A-Z0-9]{6,20})\b',
    r'\bBL[-\s#]?([A-Z0-9]{6,20})\b',
    r'\bBill\s+of\s+Lading[-:\s]+([A-Z0-9]{6,20})\b',
    r'\bMBL[-:\s]+([A-Z0-9]{6,20})\b',
    r'\bHBL[-:\s]+([A-Z0-9]{6,20})\b',
]

_AWB_PATTERNS = [
    r'\bAWB[-:\s#]+(\d{3}[-\s]\d{8})\b',
    r'\bAWB[-:\s#]+([A-Z0-9]{6,16})\b',
    r'\bAirway\s+Bill[-:\s]+([A-Z0-9\-]{6,16})\b',
    r'\b(\d{3}-\d{8})\b',          # IATA AWB format 123-12345678
]

_DELIVERY_PATTERNS = [
    # Primary DN match: "DN 16107309"
    r'\bDN[-\s#]?(\d{6,12})\b',
    # Second DN after "and/y": "DN 16107309 and 16113629"
    r'\bDN[-\s#]?\d{6,12}\s+(?:and|y)\s+(\d{6,12})\b',
    r'\bDelivery\s+(?:Number|No\.?|#)[-:\s]+(\d{5,12})\b',
    r'\bDEL[-\s#]?(\d{5,12})\b',
]

_OP_PATTERNS = [
    # Alphanumeric OP like "DP2211" (letters then digits)
    r'\bOP[-\s#]?([A-Z]{1,4}\d{2,10})\b',
    # Pure numeric OP
    r'\bOP[-\s#]?(\d{4,12})\b',
    r'\bO\.P\.[-:\s]+([A-Z0-9\-]{3,15})\b',
    r'\bOrden\s+de\s+[Pp]edido[-:\s]+([A-Z0-9\-]{3,15})\b',
]

_FORWARDER_PATTERNS = [
    r'\b(DHL|Fedex|FedEx|UPS|Maersk|MSC|CMA CGM|COSCO|Evergreen|Yang Ming|'
    r'DB Schenker|Schenker|Kuehne\s*\+?\s*Nagel|Kuehne|Expeditors|'
    r'Panalpina|DSV|Hellmann|Nippon Express|Sinotrans|Agility|'
    r'Geodis|Bolloré|Bolloré Logistics|Ceva|Rhenus)\b',
]

# ── Status keywords ───────────────────────────────────────

_STATUS_MAP: dict[str, list[str]] = {
    "en_consolidacion": [
        "consolidaci", "consolidating", "en consolidacion",
        "consolidar", "consolidado",
    ],
    "aprobado_aduana": [
        "aprobado aduana", "aprobado por aduana", "customs approved",
        "customs clearance approved", "cleared for export", "cleared for import",
    ],
    "intervencion_aduana": [
        "intervenci", "customs intervention", "pendiente aduana",
        "canal rojo", "canal naranja",
    ],
    "en_transito": [
        "en tr", "in transit", "shipped", "embarcado", "on board",
        "vessel departed", "salida del buque", "flight departed",
    ],
    "detenida_aduana": [
        "detenida aduana", "customs hold", "retenida", "held at customs",
        "customs detention", "demora aduanera",
    ],
    "liberada_aduana": [
        "liberada aduana", "customs released", "liberada", "cleared customs",
        "release order", "despacho liberado",
    ],
    "entregada_warehouse": [
        "entregada warehouse", "delivered warehouse", "warehouse delivery",
        "recibida en almacen", "received warehouse",
    ],
    "enviada_costeo": [
        "enviada costeo", "a costeo", "sent for costing", "para costeo",
    ],
}

# ── Delay keywords ────────────────────────────────────────

_DELAY_MAP: dict[str, list[str]] = {
    "falta_documentacion": [
        "falta documentaci", "documentaci.*pendiente", "missing doc",
        "docs pendientes", "documentos faltantes",
    ],
    "retraso_proveedor": [
        "retraso.*proveedor", "supplier delay", "proveedor demorado",
        "vendor delay", "retraso.*vendor",
    ],
    "problema_produccion": [
        "problema.*producci", "production issue", "produccion retrasada",
        "manufacturing delay", "demora.*producci",
    ],
    "falta_stock": [
        "falta.*stock", "out of stock", "sin stock", "stock shortage",
        "no stock disponible",
    ],
    "demoras_aduaneras": [
        "demoras? aduaner", "customs delay", "retraso.*aduana",
        "aduanas demorad",
    ],
    "falta_booking": [
        "falta.*booking", "sin booking", "no booking", "booking pendiente",
        "no hay booking",
    ],
    "retraso_pickup": [
        "retraso.*pickup", "pickup delay", "demorado.*pickup",
        "pickup no realizado", "pickup retrasado",
    ],
    "problemas_climaticos": [
        "clima", "weather", "tormenta", "storm", "condiciones clim",
        "mal tiempo", "hurac",
    ],
    "retraso_aerolinea": [
        "aero.*lnea", "aerolinea", "airline delay", "naviera.*demora",
        "shipping line delay", "carrier delay",
    ],
    "error_interno": [
        "error interno", "internal error", "error nuestro", "falla interna",
        "equivocaci.*interna",
    ],
    "espera_aprobacion": [
        "espera.*aprobaci", "aprobaci.*interna", "waiting.*approval",
        "pending.*approval", "pendiente de aprobaci",
    ],
    "problema_embalaje": [
        "problema.*embalaje", "packaging issue", "embalaje.*mal",
        "packing problem", "embalaje deficiente",
    ],
    "falta_cotizacion": [
        "falta.*cotizaci", "cotizacion.*pendiente", "sin cotizaci",
        "missing quote", "no hay cotizaci",
    ],
}

# ── Pending docs keywords ─────────────────────────────────

_PENDING_DOC_KEYWORDS = [
    r"\bfalta\b.*\bdoc", r"\bdoc.*\bpendiente",
    r"\bmissing\b.*\bdoc", r"\bdoc.*\bfaltante",
    r"\benviar.*\bfactura", r"\bsolicitar.*\bbl\b",
    r"\bpacking list.*\bpendiente", r"\binvoice.*\bmissing",
]

# ── Date extraction ───────────────────────────────────────

_DATE_PATTERNS = [
    (r'ETA[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',            "eta_promised"),
    (r'ETD[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',            "etd_promised"),
    (r'pickup[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',         "pickup_scheduled"),
    (r'fecha\s+de\s+arribo[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})', "eta_promised"),
]


# ── Public API ────────────────────────────────────────────

def extract_references(subject: str, body: str) -> dict[str, Any]:
    text = f"{subject} {body}"

    return {
        "so_number":        _first_match(text, _SO_PATTERNS),
        "bl_number":        _first_match(text, _BL_PATTERNS),
        "awb_number":       _first_match(text, _AWB_PATTERNS),
        "delivery_numbers": _all_matches(text, _DELIVERY_PATTERNS),
        "op_internal":      _first_match(text, _OP_PATTERNS),
        "forwarder":        _first_match(text, _FORWARDER_PATTERNS),
        "dates":            _extract_dates(text),
    }


def detect_status(subject: str, body: str) -> str | None:
    text = (subject + " " + body).lower()
    for status, keywords in _STATUS_MAP.items():
        for kw in keywords:
            if re.search(kw, text):
                return status
    return None


def detect_delays(subject: str, body: str) -> list[str]:
    text = (subject + " " + body).lower()
    causes: list[str] = []
    for cause, keywords in _DELAY_MAP.items():
        for kw in keywords:
            if re.search(kw, text):
                causes.append(cause)
                break
    return causes


def has_pending_docs(subject: str, body: str) -> bool:
    text = (subject + " " + body).lower()
    return any(re.search(p, text) for p in _PENDING_DOC_KEYWORDS)


def classify_document(filename: str) -> str:
    name = filename.lower()
    if any(k in name for k in ["invoice", "factura", "inv_"]):
        return "invoice"
    if any(k in name for k in ["packing", "pack_list", "pl_"]):
        return "packing_list"
    if any(k in name for k in [" bl ", "_bl_", "bill of lading", "bl."]):
        return "bl"
    if any(k in name for k in ["awb", "airway"]):
        return "awb"
    if any(k in name for k in ["customs", "aduana", "dua"]):
        return "customs_doc"
    if any(k in name for k in ["certif", "origen", "origin", "coo"]):
        return "certificate_of_origin"
    if any(k in name for k in ["cotiz", "quote", "oferta"]):
        return "quotation"
    if any(k in name for k in ["seguro", "insurance", "poliza"]):
        return "insurance"
    return "other"


# ── Private helpers ───────────────────────────────────────

def _first_match(text: str, patterns: list[str]) -> str | None:
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip().upper()
    return None


def _all_matches(text: str, patterns: list[str]) -> list[str]:
    found: set[str] = set()
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            found.add(m.group(1).strip().upper())
    return list(found)


def _extract_dates(text: str) -> dict[str, str]:
    dates: dict[str, str] = {}
    for pattern, field in _DATE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            dates[field] = m.group(1)
    return dates
