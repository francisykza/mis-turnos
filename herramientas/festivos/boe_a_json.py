import sys, json, re
from html.parser import HTMLParser

MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,
         "septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
CODES = ["AN","AR","AS","IB","CN","CB","CM","CL","CT","EX","GA","MD","MC","NC","PV","RI","VC","CE","ML"]

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.cur=None; self.cell=None; self.intable=False
    def handle_starttag(self, t, a):
        if t=="table": self.intable=True
        if not self.intable: return
        if t=="tr": self.cur=[]
        if t in("td","th"): self.cell=""
    def handle_endtag(self, t):
        if t=="table": self.intable=False
        if not self.intable: return
        if t in("td","th") and self.cell is not None and self.cur is not None:
            self.cur.append(" ".join(self.cell.replace("\xa0"," ").split())); self.cell=None
        if t=="tr" and self.cur is not None:
            self.rows.append(self.cur); self.cur=None
    def handle_data(self, d):
        if self.cell is not None: self.cell+=d

year = int(sys.argv[2])
raw=open(sys.argv[1],"rb").read()
try: txt=raw.decode("utf-8")
except UnicodeDecodeError: txt=raw.decode("latin-1")
p = P(); p.feed(txt)
mes = None; out = {c: {} for c in CODES}
for r in p.rows:
    first = r[0].strip()
    if first.lower() in MESES: mes = MESES[first.lower()]; continue
    m = re.match(r"^(\d{1,2}) (.+?)\.?$", first)
    if not m or mes is None or len(r) < 20: continue
    dia, nombre = int(m.group(1)), m.group(2)
    fecha = f"{year}-{mes:02d}-{dia:02d}"
    for i, c in enumerate(CODES):
        mark = re.sub(r"[^*]", "", r[1+i])
        if mark: out[c][fecha] = nombre
open(sys.argv[3],"w",encoding="utf-8").write(json.dumps(out,ensure_ascii=False,indent=0))
