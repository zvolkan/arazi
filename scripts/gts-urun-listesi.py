"""
GTS stok Excel'inden reçete ürün listesini üretir: lib/urunler.json

Kullanım:
  pip install pandas python-calamine
  python scripts/gts-urun-listesi.py GTS.xlsx

Satır biçimi: "Ürün Adı - 20,00 Lt (Tescil No: ...) - (Paket Tip: Bidon)"
"Miktar" (stok) sütunu kullanılmaz.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

ROW = re.compile(
    r"^(?P<name>.*?)\s+-\s+(?P<size>[\d.,]+)\s*(?P<unit>Lt|Kg)\s*"
    r"\(Tescil No:[^)]*\)\s*-\s*\(Paket Tip:\s*(?P<type>[^)]*)\)\s*$",
    re.IGNORECASE,
)
UNIT = {"lt": "L", "kg": "kg"}


def main(path: str) -> None:
    df = pd.read_excel(path, engine="calamine")
    col = next(c for c in df.columns if "stok" in str(c).lower() or "ad" in str(c).lower())
    products: dict[str, dict] = {}
    skipped = []
    for raw in df[col].dropna():
        m = ROW.match(str(raw).strip())
        if not m:
            skipped.append(raw)
            continue
        name = re.sub(r"\s+", " ", m["name"]).strip(" -")
        size = float(m["size"].replace(",", "."))
        unit = UNIT[m["unit"].lower()]
        ptype = m["type"].strip().lower()
        key = name.casefold()
        p = products.setdefault(key, {"name": name, "unit": unit, "packs": []})
        if p["unit"] != unit:
            skipped.append(f"{raw}  (birim çakışması)")
            continue
        if not any(x["size"] == size for x in p["packs"]):
            p["packs"].append({"size": size, "type": ptype})
    out = sorted(products.values(), key=lambda p: p["name"].casefold())
    for p in out:
        p["packs"].sort(key=lambda x: x["size"])
    dest = Path(__file__).resolve().parent.parent / "lib" / "urunler.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out)} ürün yazıldı → {dest}")
    if skipped:
        print(f"{len(skipped)} satır atlandı:")
        for s in skipped:
            print("  ", s)


if __name__ == "__main__":
    main(sys.argv[1])
