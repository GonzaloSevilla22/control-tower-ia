"""Central configuration — paths and app settings."""
import os
import sys
from pathlib import Path

# ── Paths — dev vs. packaged (PyInstaller) ────────────────
BASE_DIR = Path(__file__).resolve().parent.parent       # backend/

if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle — use user's AppData so the folder is writable
    APP_DATA = Path(os.environ.get('APPDATA', Path.home())) / 'ControlTowerIA'
else:
    # Development — use project root
    APP_DATA = BASE_DIR.parent

DATA_DIR = APP_DATA / "data"
DOCS_DIR = APP_DATA / "docs_storage"
DB_PATH  = DATA_DIR / "control_tower.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# ── App ───────────────────────────────────────────────────
APP_VERSION = "1.0.0"
APP_NAME    = "Control Tower IA"

# ── Outlook sync ──────────────────────────────────────────
DEFAULT_SYNC_DAYS = 30

# ── Logistics keywords for email filtering ────────────────
LOGISTICS_KEYWORDS = [
    "SO-", "service order", "delivery", "shipment", "embarque",
    "BL ", "B/L", "bill of lading", "AWB", "airway bill",
    "forwarder", "aduana", "customs", "transito", "tránsito",
    "ETD", "ETA", "pickup", "freight", "flete",
    "warehouse", "almacen", "costeo", "OP-",
    "booking", "consolidation", "consolidación",
]
