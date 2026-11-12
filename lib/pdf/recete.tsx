import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { METHODS, SLOTS, betweenWeeks, isBetween, computeTotals, doseWater, formatAmount, totalsBasis, waterOrDefault, type Recipe } from "@/lib/recipe";
import { formatPacks, packCounts } from "@/lib/catalog";

// Türkçe karakterler için gömülü yazı tipi
const fontDir = path.join(process.cwd(), "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "Inter-Regular.otf"), fontWeight: 400 },
    { src: path.join(fontDir, "Inter-SemiBold.otf"), fontWeight: 600 },
    { src: path.join(fontDir, "Inter-Bold.otf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const LOGO = path.join(process.cwd(), "public/brand/logo-beyaz.png");

export const PDF_BRAND = {
  engineer: "Zir. Müh. D.Ali Bulut",
  footer: "Yeşilyurt Mh. Akdeniz Cd. No: 20 ALB Tarım Anamur/Mersin  ·  Gsm: 0507 178 16 33",
};

const C = {
  green: "#2f6b3a",
  greenSoft: "#e9f1e7",
  /** Ara sulama başlığı */
  between: "#4f7f9c",
  text: "#1f2a22",
  muted: "#6b746e",
  line: "#d9dcd5",
  zebra: "#f7f8f5",
};

const HEADER_H = 64;

const s = StyleSheet.create({
  // Başlık her sayfada tekrarlanır; içerik başlığın altından başlar
  page: { fontFamily: "Inter", fontSize: 11, color: C.text, paddingTop: HEADER_H + 10, paddingBottom: 40 },
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_H,
    backgroundColor: C.green,
    paddingHorizontal: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  engineer: { color: "#fff", fontSize: 17, fontWeight: 700, textAlign: "right" },
  sub: { color: "#dfeadc", fontSize: 10, textAlign: "right", marginTop: 4 },
  body: { paddingHorizontal: 34 },
  info: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: C.line, borderRadius: 4, marginBottom: 8 },
  cell: { width: "50%", paddingVertical: 4.5, paddingHorizontal: 10 },
  label: { fontSize: 8.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 12, fontWeight: 600 },
  method: {
    alignSelf: "flex-start",
    backgroundColor: C.greenSoft,
    color: C.green,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    marginBottom: 10,
  },
  week: { marginBottom: 6 },
  th: { flexDirection: "row", backgroundColor: C.green, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  thText: { color: "#fff", fontWeight: 700, fontSize: 9.5, paddingVertical: 4, paddingHorizontal: 10 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.line },
  td: { paddingVertical: 2.8, paddingHorizontal: 10, fontSize: 11 },
  group: {
    flexDirection: "row",
    backgroundColor: C.greenSoft,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  groupText: { fontSize: 8.5, fontWeight: 700, color: C.green, letterSpacing: 0.6 },
  footer: { position: "absolute", bottom: 18, left: 34, right: 34, textAlign: "center", fontSize: 9, color: C.muted },
});

export type RecetePdfData = {
  no: string;
  date: string;
  farmerName: string;
  phone: string;
  address: string;
  crop: string;
  recipe: Recipe;
};

export function RecetePdf({ d }: { d: RecetePdfData }) {
  const { recipe } = d;
  const hasNotes = recipe.items.some((it) => it.note);
  const foliar = recipe.items.some((it) => it.method === "yapraktan");
  const irrigation = recipe.items.some((it) => it.method === "sulama");
  const basis = totalsBasis(recipe.area_donum, recipe.water_per_donum, recipe.barrel_liters, foliar);
  const doseL = doseWater(recipe.water_per_donum, recipe.barrel_liters);
  const totals = computeTotals(recipe.items, basis.factor);
  const water = waterOrDefault(recipe.water_per_donum);
  const kindText =
    foliar && irrigation ? "SULAMA + YAPRAKTAN" : foliar ? "YAPRAKTAN UYGULAMA" : "SULAMA İLE UYGULAMA";
  // Sulama miktarları dönüme, yapraktan miktarları varile (girilmediyse dönüme suya) göre
  const SUB_LABEL = {
    sulama: "SULAMA İLE  ·  DÖNÜME",
    yapraktan:
      doseL !== water
        ? `YAPRAKTAN  ·  ${formatAmount(doseL)} LİTRE SUYA  ·  DÖNÜME ${formatAmount(water)} L SU`
        : `YAPRAKTAN  ·  ${formatAmount(water)} LİTRE SUYA`,
  } as const;
  // Sütunlar: Ürün | Dönüme | (Açıklama)
  const W = hasNotes ? { p: "42%", a: "18%", n: "40%" } : { p: "70%", a: "30%", n: "0%" };
  const alignAmt = hasNotes ? "left" : "right";
  const totalRow = (t: (typeof totals)[number], i: number) => {
    const packs = packCounts(t.product, t.amount, t.unit);
    return (
      <View
        key={i}
        wrap={false}
        style={[s.tr, { backgroundColor: i % 2 ? C.zebra : "#fff" }, i === totals.length - 1 ? { borderBottomWidth: 0 } : {}]}
      >
        <Text style={[s.td, { width: "46%", fontWeight: 600 }]}>{t.product}</Text>
        <Text style={[s.td, { width: "20%", textAlign: "right", fontWeight: 700 }]}>
          {formatAmount(t.amount)} {t.unit === "L" ? "Litre" : "kg"}
        </Text>
        <Text style={[s.td, { width: "34%", textAlign: "right", fontSize: 10 }]}>
          {packs.length ? formatPacks(packs) : "—"}
        </Text>
      </View>
    );
  };
  return (
    <Document title={`Reçete ${d.no}`} author={PDF_BRAND.engineer}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <Image src={LOGO} style={{ height: 42, objectFit: "contain" }} />
          <View>
            <Text style={s.engineer}>{PDF_BRAND.engineer}</Text>
            <Text style={s.sub}>No: {d.no}  ·  {d.date}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.info}>
            <View style={[s.cell, { borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line }]}>
              <Text style={s.label}>Çiftçi</Text>
              <Text style={s.value}>{d.farmerName}</Text>
            </View>
            <View style={[s.cell, { borderBottomWidth: 1, borderColor: C.line }]}>
              <Text style={s.label}>Telefon</Text>
              <Text style={s.value}>{d.phone || "—"}</Text>
            </View>
            <View style={[s.cell, { borderRightWidth: 1, borderColor: C.line }]}>
              <Text style={s.label}>Tarla</Text>
              <Text style={s.value}>{d.address || "—"}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Ürün</Text>
              <Text style={s.value}>
                {d.crop || "—"}
                {recipe.area_donum ? `  ·  ${formatAmount(recipe.area_donum)} dönüm` : ""}
              </Text>
            </View>
          </View>

          <Text style={s.method}>{kindText}</Text>

          {SLOTS.map((w) => {
            const items = recipe.items.filter((it) => it.week === w);
            if (items.length === 0) return null;
            const between = isBetween(w);
            const [a, b] = betweenWeeks(w);
            return (
              <View key={w} style={s.week} wrap={false}>
                <View style={[s.th, between ? { backgroundColor: C.between } : {}]}>
                  <Text style={[s.thText, { width: W.p }]}>
                    {between ? `ARA SULAMA  ·  ${a}.–${b}. HAFTA ARASI` : `${w}. HAFTA`}
                  </Text>
                  <Text style={[s.thText, { width: W.a, textAlign: alignAmt }]}>MİKTAR</Text>
                  {hasNotes && <Text style={[s.thText, { width: W.n }]}>AÇIKLAMA</Text>}
                </View>
                {METHODS.map((m) => {
                  const list = items.filter((it) => it.method === m);
                  if (list.length === 0) return null;
                  return (
                    <View key={m}>
                      <View style={s.group}>
                        <Text style={s.groupText}>{SUB_LABEL[m]}</Text>
                      </View>
                      {list.map((it, i) => (
                        <View key={i} style={[s.tr, { backgroundColor: i % 2 ? C.zebra : "#fff" }]}>
                          <Text style={[s.td, { width: W.p, fontWeight: 600 }]}>{it.product}</Text>
                          <Text style={[s.td, { width: W.a, textAlign: alignAmt }]}>
                            {formatAmount(it.amount)} {it.unit}
                          </Text>
                          {hasNotes && <Text style={[s.td, { width: W.n, fontSize: 10 }]}>{it.note}</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {recipe.note ? (
            <View style={{ marginTop: 2, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: C.greenSoft, borderRadius: 4 }} wrap={false}>
              <Text style={[s.label, { color: C.green }]}>Açıklama</Text>
              <Text style={{ fontSize: 11, lineHeight: 1.35 }}>{recipe.note}</Text>
            </View>
          ) : null}

          {totals.length > 0 && (
            // Toplam tablosu sayfaya sığmazsa kalan satırlar sonraki sayfaya geçer;
            // başlık tek başına sayfa sonunda kalmasın diye ilk 3 satırla birlikte tutulur
            <View style={{ marginTop: 8, borderWidth: 1.5, borderColor: C.green, borderRadius: 4 }}>
              <View wrap={false}>
                <View style={[s.th, { borderRadius: 0 }]}>
                  <Text style={[s.thText, { width: "46%" }]}>
                    TOPLAM{basis.warning ? "  ·  1 DÖNÜM İÇİN" : ""}
                  </Text>
                  <Text style={[s.thText, { width: "20%", textAlign: "right" }]}>MİKTAR</Text>
                  <Text style={[s.thText, { width: "34%", textAlign: "right" }]}>PAKET</Text>
                </View>
                {totals.slice(0, 3).map((t, i) => totalRow(t, i))}
              </View>
              {totals.slice(3).map((t, i) => totalRow(t, i + 3))}
            </View>
          )}

        </View>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${PDF_BRAND.footer}  ·  Sayfa ${pageNumber}/${totalPages}` : PDF_BRAND.footer
          }
        />
      </Page>
    </Document>
  );
}
