"""System test for the Vite build/dev configuration (task 5de6420d).

This guards the build-tooling contract for the Quran web app (Vite 5 + React 18):

  1. ``vite.config.js`` exists at the repo root and declares the React plugin so the
     JSX/HMR pipeline works for both ``npm run dev`` and ``npm run build``.
  2. ``package.json`` exposes ``dev`` and ``build`` scripts that invoke Vite.
  3. When a JS toolchain (npm + installed ``node_modules``) is available, ``npm run
     build`` actually completes with a zero exit code — proving the config drives a
     real, error-free production build.

The static assertions always run (stdlib + pytest only) so the contract is verified
even in an environment without the JS toolchain. The live ``npm run build`` portion
is attempted opportunistically and is skipped — never failed — when npm or
``node_modules`` is unavailable, so the test stays deterministic in CI.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
VITE_CONFIG = REPO_ROOT / "vite.config.js"
PACKAGE_JSON = REPO_ROOT / "package.json"


def _vite_config_source():
    assert VITE_CONFIG.is_file(), "vite.config.js must exist at the project root"
    return VITE_CONFIG.read_text(encoding="utf-8")


def _package_scripts():
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    return data.get("scripts", {})


def test_npm_commands_run_without_errors():
    # 1) The Vite config exists and wires up the React plugin + defineConfig wrapper.
    source = _vite_config_source()
    assert "defineConfig" in source, "vite.config.js must use defineConfig()"
    assert "@vitejs/plugin-react" in source, (
        "vite.config.js must register @vitejs/plugin-react for JSX/HMR support"
    )
    assert "react()" in source, "the react() plugin must be enabled in the plugins list"

    # 2) package.json exposes the dev/build scripts and both drive Vite, so
    #    `npm run dev` and `npm run build` resolve to the Vite CLI.
    scripts = _package_scripts()
    assert "dev" in scripts, "package.json must define a 'dev' script"
    assert "build" in scripts, "package.json must define a 'build' script"
    assert "vite" in scripts["dev"], "'dev' script must invoke vite"
    assert "vite" in scripts["build"], "'build' script must invoke vite build"

    # 3) Opportunistic live build: only when the JS toolchain is present. This proves
    #    the config produces an error-free production build. Skipped (not failed) when
    #    npm or node_modules is missing so the test is deterministic without the
    #    toolchain.
    npm = shutil.which("npm")
    node_modules = REPO_ROOT / "node_modules"
    vite_bin = node_modules / ".bin" / ("vite.cmd" if os.name == "nt" else "vite")
    if npm is None or not vite_bin.exists():
        pytest.skip(
            "npm and installed node_modules (with the vite binary) are required to "
            "run the live `npm run build`; static config checks already passed"
        )

    result = subprocess.run(
        [npm, "run", "build"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=110,
    )
    assert result.returncode == 0, (
        "`npm run build` must complete without errors.\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )
