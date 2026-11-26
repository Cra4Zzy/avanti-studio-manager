"""Package only the authenticated app. No demos, credentials, migrations or customer data."""
from pathlib import Path
import shutil, json, os, re
root = Path.cwd()
out = root / "release"
if out.exists(): shutil.rmtree(out)
out.mkdir()
files = ("index.html", "src/studio-live.js", "src/studio-live.css", "src/install.js",
         "assets/studio-icon.svg", "manifest.webmanifest", "sw.js", "styles.css", "src/studio-original.css")
for name in files:
    src = root / name
    assert src.is_file() and src.stat().st_size, name
    dst = out / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
html_path = out / "index.html"
html = html_path.read_text()
revision = os.environ.get("GITHUB_SHA", "local")[:12]
html = re.sub(r"([?&]v=)[0-9]+", lambda m: m.group(1) + revision, html)
html = html.replace("__STUDIO_REVISION__", revision)
html_path.write_text(html)
assert 'src/studio-live.js' in html and 'manifest.webmanifest' in html
assert 'studio-preview.js' not in html and 'src/app.js' not in html
manifest = json.loads((out / "manifest.webmanifest").read_text())
assert manifest["start_url"] == "./" and manifest["scope"] == "./"
for icon in manifest["icons"]: assert (out / icon["src"]).is_file()
(out / "build-info.json").write_text(json.dumps({"commit": os.environ.get("GITHUB_SHA", "local"), "app": "avanti-studio"})+"\n")
print("Authenticated studio app packaged; local demos and server-only files excluded.")
