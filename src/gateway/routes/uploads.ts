import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { convertDocument } from "../../uploads/converter.js";

const THREADS_ROOT = path.resolve("data/threads");

const uploads = new Hono();

uploads.post("/:id/uploads", async (c) => {
  const id = c.req.param("id");
  const uploadsDir = path.join(THREADS_ROOT, id, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const body = await c.req.parseBody();
  const file = body["file"] as File;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = path.basename(file.name);
  const filePath = path.join(uploadsDir, safeName);
  fs.writeFileSync(filePath, buffer);

  let converted: string | null = null;
  try {
    converted = await convertDocument(filePath, safeName);
  } catch (err) {
    console.error("[Uploads] Conversion failed:", err);
  }

  return c.json({
    filename: safeName,
    size: buffer.length,
    converted: converted !== null && converted !== filePath,
    convertedPath: converted,
  });
});

uploads.get("/:id/uploads", (c) => {
  const id = c.req.param("id");
  const uploadsDir = path.join(THREADS_ROOT, id, "uploads");

  if (!fs.existsSync(uploadsDir)) {
    return c.json({ files: [] });
  }

  const files = fs
    .readdirSync(uploadsDir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => {
      const stat = fs.statSync(path.join(uploadsDir, d.name));
      return {
        name: d.name,
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      };
    });

  return c.json({ files });
});

uploads.delete("/:id/uploads/:filename", (c) => {
  const id = c.req.param("id");
  const filename = c.req.param("filename");
  const safeName = path.basename(filename);
  const filePath = path.join(THREADS_ROOT, id, "uploads", safeName);

  if (!fs.existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }

  fs.unlinkSync(filePath);

  // Also remove converted .txt if exists
  const txtPath = filePath + ".txt";
  if (fs.existsSync(txtPath)) {
    fs.unlinkSync(txtPath);
  }

  return c.json({ message: `File ${safeName} deleted` });
});

export { uploads };
