import fs from "node:fs";
import path from "node:path";

export async function convertDocument(
  filePath: string,
  filename: string
): Promise<string | null> {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".pdf":
      return convertPdf(filePath);
    case ".docx":
      return convertDocx(filePath);
    case ".xlsx":
      return convertXlsx(filePath);
    case ".md":
    case ".txt":
    case ".csv":
    case ".json":
      return filePath;
    default:
      return null;
  }
}

async function convertPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const data = fs.readFileSync(filePath);
  const pdf = new PDFParse({ data: new Uint8Array(data) });
  const result = await pdf.getText();
  const outPath = filePath + ".txt";
  fs.writeFileSync(outPath, result.text, "utf-8");
  await pdf.destroy();
  return outPath;
}

async function convertDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  const outPath = filePath + ".txt";
  fs.writeFileSync(outPath, result.value, "utf-8");
  return outPath;
}

async function convertXlsx(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`## ${sheetName}\n${csv}`);
  }

  const outPath = filePath + ".txt";
  fs.writeFileSync(outPath, sheets.join("\n\n"), "utf-8");
  return outPath;
}
