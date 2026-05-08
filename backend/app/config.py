"""Central configuration — paths and app settings."""
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent.parent          # backend/
DATA_DIR      = BASE_DIR.parent / "data"                        # project_root/data/
DOCS_DIR      = BASE_DIR.parent / "docs_storage"                # project_root/docs_storage/
DB_PATH       = DATA_DIR / "control_tower.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# ── App ───────────────────────────────────────────────────
APP_VERSION  = "1.0.0"
APP_NAME     = "Control Tower IA"

# ── Outlook sync ──────────────────────────────────────────
DEFAULT_SYNC_DAYS = 30          # días hacia atrás para buscar correos

# ── Logistics keywords for email filtering ────────────────
LOGISTICS_KEYWORDS = [
    "SO-", "service order", "delivery", "shipment", "embarque",
    "BL ", "B/L", "bill of lading", "AWB", "airway bill",
    "forwarder", "aduana", "customs", "transito", "tránsito",
    "ETD", "ETA", "pickup", "freight", "flete",
    "warehouse", "almacen", "costeo", "OP-",
    "booking", "consolidation", "consolidación",
]
