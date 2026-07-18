import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CsvRecord } from "./types";

export interface DecodedCsv {
  text: string;
  sha256: string;
  byteLength: number;
  hasUtf8Bom: boolean;
}

export async function readUtf8Csv(path: string): Promise<DecodedCsv> {
  const bytes = await readFile(path);
  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("CSV_ENCODING_INVALID");
  }

  return {
    text: text.replace(/^\uFEFF/, ""),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    hasUtf8Bom
  };
}

export function parseStrictCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = "";
  let line = 1;
  let recordLine = 1;
  let index = 0;
  let quoted = false;
  let closedQuote = false;
  let fieldStarted = false;

  const pushRecord = () => {
    values.push(field);
    records.push({ line: recordLine, values });
    values = [];
    field = "";
    fieldStarted = false;
    closedQuote = false;
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 2;
        continue;
      }
      if (char === '"') {
        quoted = false;
        closedQuote = true;
        index += 1;
        continue;
      }
      if (char === "\r" && next === "\n") {
        field += "\r\n";
        line += 1;
        index += 2;
        continue;
      }
      if (char === "\n" || char === "\r") {
        field += char;
        line += 1;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (closedQuote && char !== "," && char !== "\r" && char !== "\n") {
      throw new Error(`CSV_MALFORMED_QUOTE:${line}`);
    }

    if (char === '"') {
      if (fieldStarted || field.length > 0) {
        throw new Error(`CSV_MALFORMED_QUOTE:${line}`);
      }
      quoted = true;
      fieldStarted = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      values.push(field);
      field = "";
      fieldStarted = false;
      closedQuote = false;
      index += 1;
      continue;
    }

    if (char === "\r" || char === "\n") {
      pushRecord();
      if (char === "\r" && next === "\n") index += 2;
      else index += 1;
      line += 1;
      recordLine = line;
      continue;
    }

    fieldStarted = true;
    field += char;
    index += 1;
  }

  if (quoted) throw new Error(`CSV_UNCLOSED_QUOTE:${recordLine}`);
  if (fieldStarted || field.length > 0 || values.length > 0 || closedQuote) pushRecord();

  return records;
}

export function isBlankRecord(record: CsvRecord): boolean {
  return record.values.every((value) => value.trim() === "");
}

export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
