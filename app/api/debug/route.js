export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = String(process.env.OPENROUTER_API_KEY ?? '').trim();
  const model = String(process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b').trim();
  const provider = String(process.env.AI_PROVIDER ?? 'offline').toLowerCase().trim();

  return Response.json({
    provider,
    model,
    key_length: key.length,
    key_starts_with: key.slice(0, 20),
    key_ends_with: key.slice(-10),
    has_whitespace: /\s/.test(key),
    looks_valid: key.startsWith('sk-or-v1-'),
  });
}
