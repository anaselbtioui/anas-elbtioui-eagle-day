from pathlib import Path
import re

p = Path(r"C:\Users\anas\_code\hackathon\public\textures\pattern.svg")
t = p.read_text(encoding="utf-8")
t2 = re.sub(r'<g id="BACKGROUND">[\s\S]*?</g>\s*', "", t, count=1)
p.write_text(t2, encoding="utf-8")
print("BACKGROUND removed:", "BACKGROUND" not in t2)
print("FFFFFF left:", "#FFFFFF" in t2)
