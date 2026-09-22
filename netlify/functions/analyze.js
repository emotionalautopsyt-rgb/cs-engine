// netlify/functions/analyze.js  —  versão v5
// Conferir se está no ar (não gasta crédito): abra no navegador
//   https://SEUSITE.netlify.app/.netlify/functions/analyze
// Tem que aparecer "versao": "v5".

const VERSAO = 'v5';
const TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS) || 55000;

exports.handler = async function (event) {
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versao: VERSAO,
        timeout_segundos: TIMEOUT_MS / 1000,
        chave_configurada: !!process.env.ANTHROPIC_API_KEY
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY não configurada no Netlify.' } })
    };
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const corte = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = JSON.parse(event.body);

    const payload = {
      model: body.model ?? 'claude-sonnet-4-6',
      max_tokens: body.max_tokens ?? 3000,
      temperature: body.temperature ?? 0.3,
      system: body.system,
      messages: body.messages
    };

    console.log('[INICIO] ' + VERSAO + ' | modelo=' + payload.model + ' | teto=' + payload.max_tokens);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const seg = ((Date.now() - t0) / 1000).toFixed(1);

    if (data && data.usage) {
      console.log('[USAGE] ' + seg + 's | saida=' + (data.usage.output_tokens || 0) +
        ' | entrada=' + (data.usage.input_tokens || 0) +
        ' | cache_lido=' + (data.usage.cache_read_input_tokens || 0));
    } else {
      console.log('[USAGE] ' + seg + 's | status ' + response.status);
    }

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const abortou = err.name === 'AbortError';
    console.log('[ERRO] ' + VERSAO + ' | ' + seg + 's | ' + (abortou ? 'corte local' : err.message));
    return {
      statusCode: abortou ? 504 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message: '[' + VERSAO + '] ' + (abortou
            ? 'A geração passou de ' + (TIMEOUT_MS / 1000) + 's e foi cancelada.'
            : err.message)
        }
      })
    };
  } finally {
    clearTimeout(corte);
  }
};
