exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // AbortController — cancela a chamada pra Anthropic antes do limite de
    // tempo da própria função do Netlify (10s no plano atual). Sem isso, a
    // Anthropic continuava processando e cobrando mesmo depois do Netlify
    // já ter desistido de esperar e devolvido erro genérico pro navegador.
    // Com isso, a chamada é cancelada de forma limpa em 8.5s (margem de
    // segurança de 1.5s antes do limite de 10s), e o erro que volta pro
    // frontend já vem identificado como timeout, não erro genérico.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-6',
          max_tokens: body.max_tokens || 3000,
          temperature: body.temperature || 0.3,
          system: body.system,
          messages: body.messages
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        statusCode: 504,
        body: JSON.stringify({ error: { message: 'Timeout — a análise demorou demais e foi cancelada antes de completar (limite de 8.5s).' } })
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
