import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_alembic_upgrade_head_supports_sqlite(tmp_path):
    db_path = tmp_path / "alembic_smoke.db"
    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": f"sqlite:///{db_path}",
            "DEBUG": "false",
            "ENVIRONMENT": "test",
            "STOCK_DAILY_SYNC_ENABLED": "false",
        }
    )

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=PROJECT_ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr

    alembic_config = Config(str(PROJECT_ROOT / "alembic.ini"))
    expected_heads = set(ScriptDirectory.from_config(alembic_config).get_heads())

    with sqlite3.connect(db_path) as connection:
        applied_heads = {
            row[0] for row in connection.execute("SELECT version_num FROM alembic_version")
        }

    assert applied_heads == expected_heads
