import fs from "fs";
import path from "path";
import { Module, createRequire } from "module";

export interface ParseSuccess {
  ok: true;
  mimeType: string;
  extension: string;
  size: number;
  content: string;
  metadata?: Record<string, unknown>;
  pages?: number;
  tables?: Array<Array<string[]>>;
}

export interface ParseFailure {
  ok: false;
  error: "unsupported_file_type" | "parse_failed" | "file_too_large";
  message: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

export class FileParserRegistry {
  async parse(filePath: string, maxBytes = DEFAULT_MAX_BYTES): Promise<ParseResult> {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return { ok: false, error: "parse_failed", message: `File not found: ${filePath}` };
    }

    if (stat.size > maxBytes) {
      return {
        ok: false,
        error: "file_too_large",
        message: `File size ${stat.size} exceeds limit of ${maxBytes} bytes`,
      };
    }

    const ext = path.extname(filePath).toLowerCase().slice(1);
    const size = stat.size;

    try {
      return await this.dispatchByExtension(filePath, ext, size);
    } catch (err: unknown) {
      return {
        ok: false,
        error: "parse_failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async dispatchByExtension(filePath: string, ext: string, size: number): Promise<ParseResult> {
    switch (ext) {
      case "txt":
      case "md":
      case "markdown":
      case "ts":
      case "tsx":
      case "js":
      case "jsx":
      case "mjs":
      case "cjs":
      case "py":
      case "rb":
      case "go":
      case "rs":
      case "java":
      case "c":
      case "cpp":
      case "h":
      case "cs":
      case "sh":
      case "bash":
      case "zsh":
      case "sql":
      case "graphql":
      case "gql":
      case "toml":
      case "ini":
      case "env":
        return this.parseText(filePath, this.extToMime(ext), ext, size);

      case "json":
        return this.parseJson(filePath, size);

      case "yaml":
      case "yml":
        return this.parseYaml(filePath, size);

      case "csv":
        return this.parseCsv(filePath, size, ",");

      case "tsv":
        return this.parseCsv(filePath, size, "\t");

      case "html":
      case "htm":
        return this.parseHtml(filePath, ext, size);

      case "xml":
        return this.parseXml(filePath, size);

      case "pdf":
        return this.parsePdf(filePath, size);

      case "docx":
        return this.parseDocx(filePath, size);

      case "xlsx":
      case "xls":
        return this.parseXlsx(filePath, ext, size);

      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
      case "bmp":
      case "tiff":
      case "tif":
      case "svg":
        return this.parseImage(filePath, ext, size);

      default:
        return {
          ok: false,
          error: "unsupported_file_type",
          message: `No parser registered for extension: .${ext}`,
        };
    }
  }

  private parseText(filePath: string, mimeType: string, ext: string, size: number): ParseResult {
    const content = fs.readFileSync(filePath, "utf8");
    return { ok: true, mimeType, extension: ext, size, content };
  }

  private parseJson(filePath: string, size: number): ParseResult {
    const raw = fs.readFileSync(filePath, "utf8");
    JSON.parse(raw); // validate
    return { ok: true, mimeType: "application/json", extension: "json", size, content: raw };
  }

  private async parseYaml(filePath: string, size: number): Promise<ParseResult> {
    const { parse } = await import("yaml");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parse(raw);
    return {
      ok: true,
      mimeType: "application/yaml",
      extension: "yaml",
      size,
      content: raw,
      metadata: { parsed },
    };
  }

  private async parseCsv(filePath: string, size: number, delimiter: string): Promise<ParseResult> {
    const { parse } = await import("csv-parse/sync");
    const raw = fs.readFileSync(filePath, "utf8");
    const records: string[][] = parse(raw, { delimiter, relax_quotes: true });
    const ext = delimiter === "\t" ? "tsv" : "csv";
    return {
      ok: true,
      mimeType: delimiter === "\t" ? "text/tab-separated-values" : "text/csv",
      extension: ext,
      size,
      content: raw,
      tables: [records],
    };
  }

  private async parseHtml(filePath: string, ext: string, size: number): Promise<ParseResult> {
    const { load } = await import("cheerio");
    const raw = fs.readFileSync(filePath, "utf8");
    const $ = load(raw);
    $("script,style,noscript").remove();
    const content = $("body").text().replace(/\s+/g, " ").trim() || $.text().replace(/\s+/g, " ").trim();
    return { ok: true, mimeType: "text/html", extension: ext, size, content };
  }

  private async parseXml(filePath: string, size: number): Promise<ParseResult> {
    const { XMLParser } = await import("fast-xml-parser");
    const raw = fs.readFileSync(filePath, "utf8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(raw);
    return {
      ok: true,
      mimeType: "application/xml",
      extension: "xml",
      size,
      content: raw,
      metadata: { parsed },
    };
  }

  private async parsePdf(filePath: string, size: number): Promise<ParseResult> {
    // pdf-parse is CJS-only, use createRequire to import it
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const buf = fs.readFileSync(filePath);
    const result = await pdfParse(buf);
    return {
      ok: true,
      mimeType: "application/pdf",
      extension: "pdf",
      size,
      content: result.text,
      pages: result.numpages,
    };
  }

  private async parseDocx(filePath: string, size: number): Promise<ParseResult> {
    const mammoth = await import("mammoth");
    const buf = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
      size,
      content: result.value,
    };
  }

  private async parseXlsx(filePath: string, ext: string, size: number): Promise<ParseResult> {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const tables: Array<Array<string[]>> = [];
    let textLines: string[] = [];
    wb.eachSheet((sheet) => {
      const sheetRows: string[][] = [];
      sheet.eachRow((row) => {
        const cells = (row.values as (ExcelJS.CellValue | undefined)[])
          .slice(1)
          .map((v) => (v == null ? "" : String(v)));
        sheetRows.push(cells);
        textLines.push(cells.join("\t"));
      });
      tables.push(sheetRows);
    });
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: ext,
      size,
      content: textLines.join("\n"),
      tables,
    };
  }

  private async parseImage(filePath: string, ext: string, size: number): Promise<ParseResult> {
    const { fileTypeFromBuffer } = await import("file-type");
    const buf = fs.readFileSync(filePath);
    const type = await fileTypeFromBuffer(buf);
    const mimeType = type?.mime ?? `image/${ext}`;
    return {
      ok: true,
      mimeType,
      extension: ext,
      size,
      content: `[Image file: ${path.basename(filePath)}, type: ${mimeType}, size: ${size} bytes]`,
      metadata: { detectedMime: type?.mime, detectedExt: type?.ext },
    };
  }

  private extToMime(ext: string): string {
    const map: Record<string, string> = {
      txt: "text/plain",
      md: "text/markdown",
      markdown: "text/markdown",
      ts: "application/typescript",
      tsx: "application/typescript",
      js: "application/javascript",
      jsx: "application/javascript",
      mjs: "application/javascript",
      cjs: "application/javascript",
      py: "text/x-python",
      rb: "application/x-ruby",
      go: "text/x-go",
      rs: "text/x-rust",
      java: "text/x-java-source",
      c: "text/x-csrc",
      cpp: "text/x-c++src",
      h: "text/x-chdr",
      cs: "text/x-csharp",
      sh: "application/x-sh",
      bash: "application/x-sh",
      zsh: "application/x-sh",
      sql: "application/sql",
      graphql: "application/graphql",
      gql: "application/graphql",
      toml: "application/toml",
      ini: "text/plain",
      env: "text/plain",
    };
    return map[ext] ?? "text/plain";
  }
}
