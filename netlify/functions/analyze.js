// netlify/functions/analyze.js

const TIMEOUT_MS = 9000;

exports.handler = async function (event) {
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

  const controller = new AbortController();
  const corte = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = JSON.parse(event.body);

    // `??` e não `||`: preserva 0 e outros valores falsy legítimos
    const payload = {
      model: body.model ?? 'claude-sonnet-4-6',
      max_tokens: body.max_tokens ?? 3000,
      temperature: body.temperature ?? 0.3,
      system: body.system,      // verbatim — é o que permite o cache_control
      messages: body.messages
    };

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

    // log no painel do Netlify — dá para conferir o gasto sem abrir o console
    if (data && data.usage) {
      const u = data.usage;
      console.log('[USAGE] entrada=' + (u.input_tokens || 0) +
        ' saida=' + (u.output_tokens || 0) +
        ' cache_gravado=' + (u.cache_creation_input_tokens || 0) +
        ' cache_lido=' + (u.cache_read_input_tokens || 0));
    }

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    const abortou = err.name === 'AbortError';
    return {
      statusCode: abortou ? 504 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message: abortou
            ? 'A geração passou de ' + (TIMEOUT_MS / 1000) + 's e foi cancelada antes de terminar. ' +
              'Tente de novo; se repetir, o texto colado provavelmente está grande demais.'
            : err.message
        }
      })
    };
  } finally {
    clearTimeout(corte);
  }
};
