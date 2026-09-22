// netlify/functions/analyze.mjs  —  FORMATO MODERNO DO NETLIFY
// Apague o analyze.js antigo: os dois não podem existir juntos.
// Conferir se está no ar (não gasta crédito):
//     https://SEUSITE.netlify.app/.netlify/functions/analyze
// Tem que aparecer "versao": "v4-moderno".

const VERSAO = 'v4-moderno';

function env(nome) {
  try { if (globalThis.Netlify && Netlify.env && Netlify.env.get(nome)) return Netlify.env.get(nome); } catch (e) {}
  return process.env[nome];
}

const TIMEOUT_MS = Number(env('ANALYZE_TIMEOUT_MS')) || 55000;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
  if (req.method === 'GET') {
    return json({
      versao: VERSAO,
      formato: 'Functions API moderna (export default) — limite de 60s',
      timeout_segundos: TIMEOUT_MS / 1000,
      chave_configurada: !!env('ANTHROPIC_API_KEY')
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const chave = env('ANTHROPIC_API_KEY');
  if (!chave) {
    return json({ error: { message: 'ANTHROPIC_API_KEY não configurada no Netlify.' } }, 500);
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const corte = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = await req.json();

    const payload = {
      model: body.model ?? 'claude-sonnet-4-6',
      max_tokens: body.max_tokens ?? 3000,
      temperature: body.temperature ?? 0.3,
      system: body.system,
      messages: body.messages
    };

    console.log('[INICIO] ' + VERSAO + ' | modelo=' + payload.model + ' | teto=' + payload.max_tokens);

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await resposta.json();
    const seg = (Date.now() - t0) / 1000;

    if (data && data.usage) {
      const u = data.usage;
      console.log('[USAGE] ' + seg.toFixed(1) + 's' +
        ' | saida=' + (u.output_tokens || 0) + ' (teto ' + payload.max_tokens + ')' +
        ' | entrada=' + (u.input_tokens || 0) +
        ' cache_gravado=' + (u.cache_creation_input_tokens || 0) +
        ' cache_lido=' + (u.cache_read_input_tokens || 0));
    } else {
      console.log('[USAGE] ' + seg.toFixed(1) + 's | status ' + resposta.status +
        ' | ' + JSON.stringify(data).slice(0, 300));
    }

    return json(data, resposta.status);

  } catch (err) {
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const abortou = err.name === 'AbortError';
    console.log('[ERRO] ' + VERSAO + ' | ' + seg + 's | ' + (abortou ? 'corte local' : err.message));
    return json({
      error: {
        message: '[' + VERSAO + '] ' + (abortou
          ? 'A geração passou de ' + (TIMEOUT_MS / 1000) + 's e foi cancelada.'
          : err.message)
      }
    }, abortou ? 504 : 500);
  } finally {
    clearTimeout(corte);
  }
};
