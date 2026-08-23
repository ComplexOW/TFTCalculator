import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import type { TftSet } from "@/data/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();
const CACHE_PATH = join(PROJECT_ROOT, "src", "data", "tft-set.json");
const TSX_CLI_PATH = resolve(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const FETCH_SCRIPT_PATH = resolve(PROJECT_ROOT, "scripts", "fetch-tft-data.ts");

function readCachedData(): TftSet {
  return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as TftSet;
}

async function refreshCache(): Promise<TftSet> {
  await execFileAsync(
    process.execPath,
    [TSX_CLI_PATH, FETCH_SCRIPT_PATH, "--refresh"],
    {
      cwd: PROJECT_ROOT,
      timeout: 90_000,
      windowsHide: true,
    },
  );

  return readCachedData();
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[api/tft-data]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const source = new URL(request.url).searchParams.get("source") ?? "cache";

  try {
    if (source === "live") {
      const data = await refreshCache();
      return NextResponse.json(data);
    }

    return NextResponse.json(readCachedData());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const data = await refreshCache();
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
