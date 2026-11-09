import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { METHODS, WEEKS, computeTotals, formatAmount, per100L, totalsBasis, waterOrDefault, type Recipe } from "@/lib/recipe";

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
  footer: "Yeşilyurt Mah. Kazım Karabekir Cad. No:13/9 Anamur / Mersin  ·  Gsm: 0507 178 16 33",
};

const C = {
  green: "#2f6b3a",
  greenSoft: "#e9f1e7",
  text: "#1f2a22",
  muted: "#6b746e",
  line: "#d9dcd5",
  zebra: "#f7f8f5",
};

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9.5, color: C.text, paddingBottom: 32 },
  band: {
    backgroundColor: C.green,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  engineer: { color: "#fff", fontSize: 13, fontWeight: 700, textAlign: "right" },
  sub: { color: "#dfeadc", fontSize: 8, textAlign: "right", marginTop: 3 },
  body: { paddingHorizontal: 24, paddingTop: 10 },
  info: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: C.line, borderRadius: 4, marginBottom: 8 },
  cell: { width: "50%", paddingVertical: 4, paddingHorizontal: 8 },
  label: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 10, fontWeight: 600 },
  method: {
    alignSelf: "flex-start",
    backgroundColor: C.greenSoft,
    color: C.green,
    fontWeight: 700,
    fontSize: 8.5,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginBottom: 7,
  },
  week: { marginBottom: 7 },
  th: { flexDirection: "row", backgroundColor: C.green, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  thText: { color: "#fff", fontWeight: 700, fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.line },
  td: { paddingVertical: 3.5, paddingHorizontal: 8, fontSize: 10 },
  group: {
    flexDirection: "row",
    backgroundColor: C.greenSoft,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  groupText: { fontSize: 7.5, fontWeight: 700, color: C.green, letterSpacing: 0.6 },
  footer: { position: "absolute", bottom: 12, left: 24, right: 24, textAlign: "center", fontSize: 7, color: C.muted },
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
  const basis = totalsBasis(recipe.area_donum, recipe.water_per_donum, foliar);
  const totals = computeTotals(recipe.items, basis.factor);
  const water = waterOrDefault(recipe.water_per_donum);
  const kindText =
    foliar && irrigation ? "SULAMA + YAPRAKTAN" : foliar ? "YAPRAKTAN UYGULAMA" : "SULAMA İLE UYGULAMA";
  const SUB_LABEL = { sulama: "SULAMA İLE", yapraktan: "YAPRAKTAN" } as const;
  // Sütun genişlikleri: Ürün | Dönüme | (100 L suya) | (Açıklama)
  const W = foliar
    ? hasNotes
      ? { p: "32%", a: "17%", c: "19%", n: "32%" }
      : { p: "50%", a: "25%", c: "25%", n: "0%" }
    : hasNotes
      ? { p: "38%", a: "27%", c: "0%", n: "35%" }
      : { p: "62%", a: "38%", c: "0%", n: "0%" };
  const alignAmt = hasNotes ? "left" : "right";
  return (
    <Document title={`Reçete ${d.no}`} author={PDF_BRAND.engineer}>
      <Page size="A5" style={s.page}>
        <View style={s.band}>
          <Image src={LOGO} style={{ height: 34, objectFit: "contain" }} />
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

          <Text style={s.method}>
            {kindText}
            {foliar ? `  ·  YAPRAKTAN: DÖNÜME ${formatAmount(water)} L SU` : ""}
          </Text>

          {WEEKS.map((w) => {
            const items = recipe.items.filter((it) => it.week === w);
            if (items.length === 0) return null;
            return (
              <View key={w} style={s.week} wrap={false}>
                <View style={s.th}>
                  <Text style={[s.thText, { width: W.p }]}>{w}. HAFTA</Text>
                  <Text style={[s.thText, { width: W.a, textAlign: alignAmt }]}>DÖNÜME</Text>
                  {foliar && <Text style={[s.thText, { width: W.c, textAlign: alignAmt }]}>100 L SUYA</Text>}
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
                          {foliar && (
                            <Text style={[s.td, { width: W.c, textAlign: alignAmt }]}>
                              {m === "yapraktan" ? `${formatAmount(per100L(it.amount, water) ?? 0)} ${it.unit}` : "—"}
                            </Text>
                          )}
                          {hasNotes && <Text style={[s.td, { width: W.n, fontSize: 9.5 }]}>{it.note}</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {recipe.note ? (
            <View style={{ marginTop: 2, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: C.greenSoft, borderRadius: 4 }} wrap={false}>
              <Text style={[s.label, { color: C.green }]}>Açıklama</Text>
              <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>{recipe.note}</Text>
            </View>
          ) : null}

          {totals.length > 0 && (
            <View style={{ marginTop: 8, borderWidth: 1.5, borderColor: C.green, borderRadius: 4 }} wrap={false}>
              <View style={{ backgroundColor: C.green, paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ color: "#fff", fontWeight: 700, fontSize: 8.5 }}>TOPLAM ÜRÜN MİKTARLARI  ·  3 HAFTA  ·  {basis.areaLabel.toLocaleUpperCase("tr-TR")}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {totals.map((t, i) => (
                  <View
                    key={i}
                    style={{
                      width: "50%",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderColor: C.line,
                      borderTopWidth: i >= 2 ? 1 : 0,
                      borderLeftWidth: i % 2 ? 1 : 0,
                    }}
                  >
                    <Text style={{ fontSize: 9.5, fontWeight: 600, maxWidth: "65%" }}>{t.product}</Text>
                    <Text style={{ fontSize: 9.5, fontWeight: 700 }}>
                      {formatAmount(t.amount)} {t.unit === "L" ? "Litre" : "kg"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>

        <Text style={s.footer} fixed>{PDF_BRAND.footer}</Text>
      </Page>
    </Document>
  );
}
