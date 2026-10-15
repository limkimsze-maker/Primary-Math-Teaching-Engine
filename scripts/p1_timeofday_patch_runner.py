from pathlib import Path
import subprocess
import sys

script = Path(__file__).with_name('p1_timeofday_patch.py')
text = script.read_text()
old = "marker = '</style><script src=\"https://cdn.counter.dev/script.js\"'"
new = "marker = '</style>'"
if old not in text:
    raise SystemExit('Expected live-HTML style marker rule not found in patch script.')
script.write_text(text.replace(old, new, 1))
subprocess.check_call([sys.executable, str(script)])
