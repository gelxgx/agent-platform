import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { convertDocument } from "../../src/uploads/converter.js";

const TMP_DIR = path.resolve("data/.test-converter");

function setup() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

afterEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

describe("convertDocument", () => {
  it("should return filePath as-is for .txt files", async () => {
    setup();
    const txtPath = path.join(TMP_DIR, "readme.txt");
    fs.writeFileSync(txtPath, "hello world");

    const result = await convertDocument(txtPath, "readme.txt");
    expect(result).toBe(txtPath);
  });

  it("should return filePath as-is for .md files", async () => {
    setup();
    const mdPath = path.join(TMP_DIR, "notes.md");
    fs.writeFileSync(mdPath, "# Title");

    const result = await convertDocument(mdPath, "notes.md");
    expect(result).toBe(mdPath);
  });

  it("should return filePath as-is for .csv files", async () => {
    setup();
    const csvPath = path.join(TMP_DIR, "data.csv");
    fs.writeFileSync(csvPath, "a,b,c\n1,2,3");

    const result = await convertDocument(csvPath, "data.csv");
    expect(result).toBe(csvPath);
  });

  it("should return filePath as-is for .json files", async () => {
    setup();
    const jsonPath = path.join(TMP_DIR, "config.json");
    fs.writeFileSync(jsonPath, '{"key": "value"}');

    const result = await convertDocument(jsonPath, "config.json");
    expect(result).toBe(jsonPath);
  });

  it("should return null for unsupported extensions", async () => {
    setup();
    const imgPath = path.join(TMP_DIR, "photo.png");
    fs.writeFileSync(imgPath, "fake-png-data");

    const result = await convertDocument(imgPath, "photo.png");
    expect(result).toBeNull();
  });

  it("should return null for unknown extensions", async () => {
    setup();
    const binPath = path.join(TMP_DIR, "data.bin");
    fs.writeFileSync(binPath, "binary");

    const result = await convertDocument(binPath, "data.bin");
    expect(result).toBeNull();
  });

  it("should convert .xlsx to text file", async () => {
    setup();
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Age"],
      ["Alice", 30],
      ["Bob", 25],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "People");
    const xlsxPath = path.join(TMP_DIR, "test.xlsx");
    XLSX.writeFile(wb, xlsxPath);

    const result = await convertDocument(xlsxPath, "test.xlsx");
    expect(result).toBe(xlsxPath + ".txt");
    expect(fs.existsSync(result!)).toBe(true);

    const content = fs.readFileSync(result!, "utf-8");
    expect(content).toContain("Name");
    expect(content).toContain("Alice");
    expect(content).toContain("People");
  });
});
