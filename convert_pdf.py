import markdown
from xhtml2pdf import pisa
import sys

SRC = "class-3-wordpress-lesson-plan.md"
OUT = "class-3-wordpress-lesson-plan.pdf"

with open(SRC, encoding="utf-8") as f:
    md = f.read()

body = markdown.markdown(md, extensions=["tables", "fenced_code", "sane_lists"])

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.5; color:#222; }}
  h1 {{ font-size: 20px; color: #0b5d8f; border-bottom: 3px solid #0b5d8f; padding-bottom: 4px;}}
  h2 {{ font-size: 15px; color: #0b5d8f; margin-top: 18px; border-bottom: 1px solid #ccc;}}
  h3 {{ font-size: 13px; color: #333; margin-top: 12px;}}
  table {{ border-collapse: collapse; width: 100%; margin: 8px 0; }}
  th, td {{ border: 1px solid #999; padding: 4px 6px; }}
  th {{ background: #0b5d8f; color: #fff; }}
  tr:nth-child(even) td {{ background: #f2f7fb; }}
  blockquote {{ border-left: 4px solid #0b5d8f; margin: 6px 0; padding: 4px 12px; background:#f5f9fc; color:#333; }}
  code {{ background:#eee; padding:1px 4px; font-size:10px; }}
  hr {{ border: none; border-top: 1px solid #bbb; margin: 14px 0; }}
  ul, ol {{ margin: 6px 0 6px 18px; padding:0; }}
  li {{ margin: 3px 0; }}
  p {{ margin: 6px 0; }}
</style></head>
<body>{body}</body></html>
"""

with open(OUT, "w+b") as f:
    pisa.CreatePDF(html, dest=f, encoding="utf-8")
print("wrote", OUT)
