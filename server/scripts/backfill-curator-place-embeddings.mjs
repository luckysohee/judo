#!/usr/bin/env node
/**
 * curator_places.one_line_embedding 백필 (OpenAI text-embedding-3-small, 1536d)
 *
 * 실행 (저장소 루트):
 *   node server/scripts/backfill-curator-place-embeddings.mjs
 *
 * 환경: 루트 .env + server/.env (server/index.js 와 동일하게 로드)
 *   OPENAI_API_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 옵션 환경변수:
 *   EMBED_BATCH_SIZE=24  (기본 24)
 *   EMBED_MAX_ROWS=500   (기본 무제한)
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { taxonomyContextBlockForMl } from "../../src/utils/placeTaxonomy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const MODEL = "text-embedding-3-small";
const DIM = 1536;

function embeddingSource(row) {
  const parts = [
    taxonomyContextBlockForMl(),
    row.one_line_reason,
    ...(Array.isArray(row.tags) ? row.tags : []),
    ...(Array.isArray(row.moods) ? row.moods : []),
    ...(Array.isArray(row.alcohol_types) ? row.alcohol_types : []),
  ]
    .map((s) => (s == null ? "" : String(s).trim()))
    .filter(Boolean);
  return parts.join(" ").slice(0, 8000);
}

async function main() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();

  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  if (!openaiKey || openaiKey.length < 20) {
    console.error("OPENAI_API_KEY 가 필요합니다.");
    process.exit(1);
  }

  const batchSize = Math.min(
    64,
    Math.max(1, parseInt(process.env.EMBED_BATCH_SIZE || "24", 10) || 24)
  );
  const maxRows = process.env.EMBED_MAX_ROWS
    ? parseInt(process.env.EMBED_MAX_ROWS, 10)
    : null;

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: openaiKey });

  let updated = 0;
  let skipped = 0;

  for (;;) {
    const { data: rows, error } = await sb
      .from("curator_places")
      .select("id, one_line_reason, tags, moods, alcohol_types, one_line_embedding")
      .eq("is_archived", false)
      .is("one_line_embedding", null)
      .limit(batchSize);

    if (error) {
      console.error("select error:", error);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      if (maxRows != null && updated >= maxRows) {
        console.log(`\nEMBED_MAX_ROWS=${maxRows} 도달, 종료.`);
        console.log({ updated, skipped });
        return;
      }

      const text = embeddingSource(row);
      if (!text) {
        skipped += 1;
        continue;
      }

      let vec;
      try {
        const emb = await openai.embeddings.create({
          model: MODEL,
          input: text,
        });
        vec = emb.data[0]?.embedding;
      } catch (e) {
        console.error("embedding failed for", row.id, e?.message || e);
        process.exit(1);
      }

      if (!vec || vec.length !== DIM) {
        console.error("bad embedding dim for", row.id);
        process.exit(1);
      }

      const { error: upErr } = await sb
        .from("curator_places")
        .update({ one_line_embedding: vec })
        .eq("id", row.id);

      if (upErr) {
        console.error("update error:", upErr);
        process.exit(1);
      }
      updated += 1;
      process.stdout.write(`\rupdated ${updated} (skipped empty ${skipped})`);
    }
  }

  console.log(`\ndone. updated=${updated} skipped_empty=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
