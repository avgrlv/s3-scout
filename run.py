"""Собрать актуальный фронтенд и запустить локальный S3 Scout."""

from pathlib import Path
import shutil
import subprocess
import sys


def main():
    frontend = Path(__file__).resolve().parent / "frontend"
    index = frontend / "dist" / "index.html"
    sources = [*frontend.joinpath("src").rglob("*"), frontend / "package.json", frontend / "package-lock.json", frontend / "vite.config.ts", frontend / "index.html"]
    if not index.is_file() or any(path.is_file() and path.stat().st_mtime > index.stat().st_mtime for path in sources):
        if not shutil.which("npm") or not (frontend / "node_modules").is_dir():
            print("Сначала установи Node.js и зависимости: cd frontend && npm install", file=sys.stderr)
            return 1
        result = subprocess.run(["npm", "run", "build"], cwd=frontend)
        if result.returncode:
            return result.returncode
    try:
        from backend.server import main as serve
    except ModuleNotFoundError as error:
        print(f"Не найдена зависимость {error.name}. Выполни: python -m pip install -r backend/requirements.txt", file=sys.stderr)
        return 1
    serve()
    return 0


if __name__ == "__main__":
    sys.exit(main())
