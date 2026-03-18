/* ─── Grant Export Utilities (PDF + DOCX) ─────────────────────────── */

// Shared types
interface ExportGrant {
  name: string;
  founder?: string | null;
  url?: string | null;
  amount?: string | null;
  deadlineDate?: string | null;
  howToApply?: string | null;
  geographicScope?: string | null;
  eligibility?: string | null;
  projectDuration?: string | null;
  submissionEffort?: string | null;
  notes?: string | null;
}

interface ExportAudit {
  overallScore: number;
  overallVerdict: string;
  summary: string;
  improvedAt: string | null;
}

interface ExportDraft {
  sections: Record<string, string>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Markdown token parsing ──────────────────────────────────────

interface TextToken {
  text: string;
  bold: boolean;
}

/** Parse inline **bold** markers into tokens */
function parseInlineBold(raw: string): TextToken[] {
  const tokens: TextToken[] = [];
  const parts = raw.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**")) {
      tokens.push({ text: p.slice(2, -2), bold: true });
    } else {
      tokens.push({ text: p, bold: false });
    }
  }
  return tokens;
}

/** Split a markdown block into logical lines (paragraphs, bullets, headings) */
interface BlockLine {
  type: "paragraph" | "bullet" | "heading";
  tokens: TextToken[];
}

function parseMarkdownBlock(text: string): BlockLine[] {
  const lines: BlockLine[] = [];
  // Split by double newlines for paragraphs
  const rawBlocks = text.split(/\n/);
  for (const raw of rawBlocks) {
    const trimmed = raw.trim();
    if (!trimmed) {
      lines.push({ type: "paragraph", tokens: [{ text: "", bold: false }] });
      continue;
    }
    // Bullet point
    if (/^[-•*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s+/, "");
      lines.push({ type: "bullet", tokens: parseInlineBold(content) });
    }
    // Markdown heading
    else if (/^#{1,3}\s+/.test(trimmed)) {
      const content = trimmed.replace(/^#{1,3}\s+/, "");
      lines.push({ type: "heading", tokens: [{ text: content, bold: true }] });
    }
    // Regular text
    else {
      lines.push({ type: "paragraph", tokens: parseInlineBold(trimmed) });
    }
  }
  return lines;
}

// ─── PDF Export ──────────────────────────────────────────────────

export async function exportGrantPdf(
  grant: ExportGrant,
  draft: ExportDraft | undefined,
  audit: ExportAudit | null,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mL = 20, mR = 20, mT = 25, mB = 20;
  const usable = W - mL - mR;
  let y = mT;

  const newPage = () => { doc.addPage(); y = mT; };
  const need = (n: number) => { if (y + n > H - mB) newPage(); };

  /** Render an array of TextTokens with word-wrapping and inline bold */
  const renderTokens = (tokens: TextToken[], indent = 0, fontSize = 10) => {
    const lineHeight = fontSize * 0.45;
    const maxW = usable - indent;
    const xStart = mL + indent;

    // Flatten tokens into words preserving bold state
    interface Word { text: string; bold: boolean }
    const words: Word[] = [];
    for (const t of tokens) {
      const parts = t.text.split(/(\s+)/);
      for (const p of parts) {
        if (p) words.push({ text: p, bold: t.bold });
      }
    }

    let x = xStart;
    let lineStarted = false;

    for (const w of words) {
      // Whitespace-only
      if (/^\s+$/.test(w.text)) {
        if (lineStarted) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          x += doc.getTextWidth(" ");
        }
        continue;
      }

      doc.setFont("helvetica", w.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const ww = doc.getTextWidth(w.text);

      // Wrap
      if (lineStarted && x + ww > xStart + maxW) {
        y += lineHeight;
        need(lineHeight);
        x = xStart;
        lineStarted = false;
      }

      doc.setTextColor(30);
      doc.text(w.text, x, y);
      x += ww;
      lineStarted = true;
    }
    if (lineStarted) y += lineHeight;
  };

  // ── COVER PAGE ──────────────────────────────────────────────
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 6, "F");

  y = 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text("GRANT APPLICATION", mL, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(20);
  const titleLines = doc.splitTextToSize(grant.name, usable) as string[];
  for (const line of titleLines) { doc.text(line, mL, y); y += 10; }
  y += 4;

  doc.setDrawColor(200);
  doc.line(mL, y, W - mR, y);
  y += 10;

  // Info rows
  const infoRow = (label: string, value: string | null | undefined) => {
    if (!value?.trim()) return;
    need(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label.toUpperCase(), mL, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(value, usable) as string[];
    for (const l of lines) { doc.text(l, mL, y); y += 4.5; }
    y += 4;
  };

  infoRow("Funder / Organisation", grant.founder);
  infoRow("Grant URL", grant.url);
  infoRow("Funding Amount", grant.amount);
  infoRow("Deadline", grant.deadlineDate ? fmtDate(grant.deadlineDate) : null);
  infoRow("Geographic Scope", grant.geographicScope);
  infoRow("Eligibility", grant.eligibility);
  infoRow("Project Duration", grant.projectDuration);
  infoRow("How to Apply", grant.howToApply);
  infoRow("Submission Effort", grant.submissionEffort);
  infoRow("Notes", grant.notes);

  // Audit box
  if (audit) {
    need(20);
    y += 4;
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(mL, y, usable, 18, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text(`Audit Score: ${audit.overallScore}/100  —  ${audit.overallVerdict}`, mL + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    if (audit.improvedAt) {
      doc.text(`Improved on ${fmtDate(audit.improvedAt)}`, mL + 5, y + 13);
    }
    y += 24;
  }

  need(10);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`,
    mL,
    y,
  );

  // ── SECTION PAGES ─────────────────────────────────────────
  if (draft?.sections) {
    newPage();
    const entries = Object.entries(draft.sections);
    for (const [name, text] of entries) {
      if (!text?.trim()) continue;

      // Section heading
      need(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(16, 120, 90);
      doc.text(name, mL, y);
      y += 2;
      doc.setDrawColor(16, 185, 129);
      doc.line(mL, y, mL + Math.min(doc.getTextWidth(name), usable), y);
      y += 7;

      // Render markdown-aware content
      const blocks = parseMarkdownBlock(text);
      for (const block of blocks) {
        if (block.tokens.length === 1 && block.tokens[0].text === "") {
          y += 3; // blank line gap
          continue;
        }
        need(6);
        if (block.type === "heading") {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(40);
          const flat = block.tokens.map((t) => t.text).join("");
          doc.text(flat, mL, y);
          y += 5.5;
        } else if (block.type === "bullet") {
          // Bullet marker
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(30);
          doc.text("•", mL + 2, y);
          renderTokens(block.tokens, 8);
        } else {
          renderTokens(block.tokens, 0);
        }
      }
      y += 8;
    }
  }

  // ── PAGE NUMBERS ──────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${total}`, W / 2, H - 10, { align: "center" });
    doc.setDrawColor(220);
    doc.line(mL, H - 14, W - mR, H - 14);
  }

  doc.save(`grant-${grant.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

// ─── DOCX Export ─────────────────────────────────────────────────

export async function exportGrantDocx(
  grant: ExportGrant,
  draft: ExportDraft | undefined,
  audit: ExportAudit | null,
) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    TableRow,
    TableCell,
    Table,
    WidthType,
    ShadingType,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  /** Convert tokens to TextRun[] */
  const toRuns = (tokens: TextToken[], baseOpts: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}) =>
    tokens.map(
      (t) =>
        new TextRun({
          text: t.text,
          bold: t.bold || baseOpts.bold,
          size: baseOpts.size ?? 22,
          font: "Calibri",
          ...baseOpts,
        }),
    );

  /** Parse markdown text into Paragraph[] */
  const mdToParagraphs = (text: string): InstanceType<typeof Paragraph>[] => {
    const blocks = parseMarkdownBlock(text);
    const paras: InstanceType<typeof Paragraph>[] = [];
    for (const block of blocks) {
      if (block.tokens.length === 1 && block.tokens[0].text === "") {
        paras.push(new Paragraph({ spacing: { after: 100 } }));
        continue;
      }
      if (block.type === "heading") {
        paras.push(
          new Paragraph({
            children: toRuns(block.tokens, { bold: true, size: 24 }),
            spacing: { before: 200, after: 100 },
          }),
        );
      } else if (block.type === "bullet") {
        paras.push(
          new Paragraph({
            children: toRuns(block.tokens),
            bullet: { level: 0 },
            spacing: { after: 60 },
          }),
        );
      } else {
        paras.push(
          new Paragraph({
            children: toRuns(block.tokens),
            spacing: { after: 80 },
          }),
        );
      }
    }
    return paras;
  };

  // ── Build document sections ──────────────────────────────
  const children: InstanceType<typeof Paragraph | typeof Table>[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "GRANT APPLICATION", size: 20, color: "888888", font: "Calibri" })],
      spacing: { after: 100 },
    }),
  );
  children.push(
    new Paragraph({
      text: grant.name,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  // Divider
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      },
      spacing: { after: 200 },
    }),
  );

  // Info table
  const infoEntries: [string, string][] = [];
  const addInfo = (label: string, value: string | null | undefined) => {
    if (value?.trim()) infoEntries.push([label, value.trim()]);
  };
  addInfo("Funder / Organisation", grant.founder);
  addInfo("Grant URL", grant.url);
  addInfo("Funding Amount", grant.amount);
  addInfo("Deadline", grant.deadlineDate ? fmtDate(grant.deadlineDate) : null);
  addInfo("Geographic Scope", grant.geographicScope);
  addInfo("Eligibility", grant.eligibility);
  addInfo("Project Duration", grant.projectDuration);
  addInfo("How to Apply", grant.howToApply);
  addInfo("Submission Effort", grant.submissionEffort);
  addInfo("Notes", grant.notes);

  if (infoEntries.length > 0) {
    const rows = infoEntries.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 18, color: "666666", font: "Calibri" })],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, fill: "F5F5F5", color: "F5F5F5" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value, size: 20, font: "Calibri" })],
                }),
              ],
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0" },
              },
            }),
          ],
        }),
    );
    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Audit box
  if (audit) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Audit Score: ${audit.overallScore}/100  —  ${audit.overallVerdict}`, bold: true, size: 24, color: "10B981", font: "Calibri" }),
        ],
        spacing: { before: 200, after: 40 },
      }),
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: audit.summary, size: 20, color: "555555", font: "Calibri" })],
        spacing: { after: 60 },
      }),
    );
    if (audit.improvedAt) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Improved on ${fmtDate(audit.improvedAt)}`, size: 18, color: "0D9488", font: "Calibri" })],
          spacing: { after: 200 },
        }),
      );
    }
  }

  // Generated timestamp
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`,
          size: 16,
          color: "999999",
          font: "Calibri",
        }),
      ],
      spacing: { after: 200 },
    }),
  );

  // ── Sections ──────────────────────────────────────────────
  const sectionChildren: InstanceType<typeof Paragraph>[] = [];
  if (draft?.sections) {
    for (const [name, text] of Object.entries(draft.sections)) {
      if (!text?.trim()) continue;

      // Section heading
      sectionChildren.push(
        new Paragraph({
          text: name,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "10B981" } },
        }),
      );

      // Section content with markdown
      sectionChildren.push(...mdToParagraphs(text));
      sectionChildren.push(new Paragraph({ spacing: { after: 200 } }));
    }
  }

  const docObj = new Document({
    sections: [
      {
        properties: {},
        children: [...children],
      },
      ...(sectionChildren.length > 0
        ? [
            {
              properties: {},
              children: sectionChildren,
            },
          ]
        : []),
    ],
  });

  const blob = await Packer.toBlob(docObj);
  saveAs(blob, `grant-${grant.name.toLowerCase().replace(/\s+/g, "-")}.docx`);
}
