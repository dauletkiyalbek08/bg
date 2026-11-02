import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatDate } from "./date";
import { labels, scales } from "./content";
import type { User, AssessmentResult } from "./types";
export async function makePDF(
  user: User,
  result: AssessmentResult,
  org: string,
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await readFile(join(process.cwd(), "public/fonts/Report.ttf"));
  const font = await doc.embedFont(bytes, { subset: true });
  let page = doc.addPage([595, 842]);
  let y = 790;
  function line(text: string, size = 11, color = rgb(0.14, 0.12, 0.23)) {
    const words = text.split(/\s+/);
    let row = "";
    for (const word of words) {
      if (row && font.widthOfTextAtSize(row + " " + word, size) > 490) {
        draw(row);
        row = word;
      } else row += (row ? " " : "") + word;
    }
    if (row) draw(row);
    function draw(value: string) {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(value, { x: 50, y, size, font, color });
      y -= size * 1.6;
    }
    y -= 5;
  }
  line("Bagdar", 30, rgb(0.42, 0.23, 1));
  line("Өз бағытыңды тап", 13);
  y -= 10;
  line(user.name, 20);
  line(org);
  line(formatDate(result.completedAt, true));
  line("Әдістеме: " + result.methodology, 9);
  y -= 15;
  for (const [family, keys] of Object.entries(scales)) {
    line(
      family === "riasec"
        ? "Қызығушылықтар"
        : family === "klimov"
          ? "Кәсіби бағыттар"
          : "Дағдыларды өзіндік бағалау",
      15,
    );
    for (const k of keys) {
      line(`${labels[k]}: ${Math.round(result.scores[k])} / 100`);
      const width = result.scores[k] * 4;
      page.drawRectangle({
        x: 50,
        y: y + 1,
        width: 400,
        height: 4,
        color: rgb(0.94, 0.92, 0.98),
      });
      page.drawRectangle({
        x: 50,
        y: y + 1,
        width,
        height: 4,
        color: rgb(0.42, 0.23, 1),
      });
      y -= 10;
    }
    y -= 10;
  }
  line("Саған сәйкес келуі мүмкін мамандықтар", 17);
  result.top.forEach((c, i) => {
    line(`${i + 1}. ${c.name} — ${Math.round(c.index)} / 100`, 13);
    c.reasons.forEach((r) => line(r, 10));
  });
  line("Келесі қадамдар", 15);
  line(
    "Бір мамандықты таңдап, оның күнделікті жұмысына ұқсас шағын жоба жасап көр. Қызығушылықтарыңды маманмен талқыла.",
  );
  if (result.flags.some((f) => f !== "timing_unavailable"))
    line("Нәтижені маманмен талқылап, тестті қайта тапсырып көру ұсынылады.");
  line(
    "Бұл нәтиже — өзіңді тануға арналған бағдар. Ол диагноз емес және болашақ мамандығыңды біржола анықтамайды. Көрсеткіш табыс ықтималдығы емес.",
    10,
  );
  return doc.save();
}
