#!/usr/bin/env python3
"""Install LLVM's OpenMP runtime into the active project virtual environment."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys


LIBOMP_INSTALL_NAME = "@rpath/libomp.dylib"


def run_command(*args: str) -> str:
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return result.stdout


def homebrew_libomp() -> Path:
    brew = shutil.which("brew")
    if brew is None:
        raise RuntimeError(
            "Homebrew is required to locate libomp. Install it with "
            "`brew install libomp`, or pass --source."
        )
    prefix = Path(run_command(brew, "--prefix", "libomp").strip())
    source = prefix / "lib" / "libomp.dylib"
    if not source.is_file():
        raise RuntimeError(
            f"libomp is not installed at {source}. Run `brew install libomp`, "
            "or pass --source."
        )
    return source


def numba_openmp_extensions(venv: Path) -> list[Path]:
    return sorted(
        path
        for path in venv.glob(
            "lib/python*/site-packages/numba/np/ufunc/omppool*.so"
        )
        if path.is_file()
    )


def virtualenv_lib_rpath(extension: Path, venv: Path) -> str:
    relative_lib = os.path.relpath(venv / "lib", extension.parent)
    return f"@loader_path/{relative_lib}"


def installed_rpaths(binary: Path) -> set[str]:
    output = run_command("otool", "-l", str(binary))
    lines = output.splitlines()
    rpaths: set[str] = set()
    for index, line in enumerate(lines):
        if line.strip() != "cmd LC_RPATH":
            continue
        for detail in lines[index + 1 : index + 5]:
            stripped = detail.strip()
            if stripped.startswith("path "):
                rpaths.add(stripped.removeprefix("path ").split(" (offset", 1)[0])
                break
    return rpaths


def install_libomp(source: Path, venv: Path) -> tuple[Path, list[Path]]:
    if not source.is_file():
        raise FileNotFoundError(f"libomp source does not exist: {source}")

    target = venv / "lib" / "libomp.dylib"
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != target.resolve():
        if target.exists():
            target.chmod(target.stat().st_mode | stat.S_IWUSR)
        shutil.copy2(source, target)
        target.chmod(target.stat().st_mode | stat.S_IWUSR)

    run_command("install_name_tool", "-id", LIBOMP_INSTALL_NAME, str(target))
    run_command("codesign", "--force", "--sign", "-", str(target))

    extensions = numba_openmp_extensions(venv)
    if not extensions:
        raise RuntimeError(
            "Numba's omppool extension was not found in this virtual environment. "
            "Install engine/requirements.txt before installing libomp."
        )

    for extension in extensions:
        rpath = virtualenv_lib_rpath(extension, venv)
        if rpath not in installed_rpaths(extension):
            run_command("install_name_tool", "-add_rpath", rpath, str(extension))
        run_command("codesign", "--force", "--sign", "-", str(extension))

    return target, extensions


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy libomp.dylib into the active macOS virtual environment."
    )
    parser.add_argument(
        "--source",
        type=Path,
        help="Path to libomp.dylib; defaults to the Homebrew libomp formula.",
    )
    return parser.parse_args()


def main() -> int:
    if sys.platform != "darwin":
        print("libomp.dylib installation is only required on macOS.", file=sys.stderr)
        return 2
    if sys.prefix == sys.base_prefix:
        print("Run this script with engine/.venv/bin/python3.", file=sys.stderr)
        return 2

    args = parse_args()
    source = args.source.resolve() if args.source else homebrew_libomp()
    venv = Path(sys.prefix).resolve()
    target, extensions = install_libomp(source, venv)
    print(f"Installed {target}")
    for extension in extensions:
        print(f"Configured {extension}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
