const VERSAO = 'v3-50s';
const TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS) || 50000;
 
exports.handler = async function (event) {
  // ── Cartão de identidade: GET devolve qual versão está publicada ──
  // Serve para conferir deploy sem disparar análise nem gastar crédito.
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versao: VERSAO,
        timeout_segundos: TIMEOUT_MS / 1000,
        timeout_vem_de: process.env.ANALYZE_TIMEOUT_MS ? 'variável de ambiente' : 'padrão do arquivo',
        chave_configurada: !!process.env.ANTHROPIC_API_KEY,
        node: process.version
      }, null, 2)
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
 
    // `??` e não `||`: preserva 0 e outros valores falsy legítimos
    // (com `||`, temperature 0 virava 0.3 silenciosamente)
    const payload = {
      model: body.model ?? 'claude-sonnet-4-6',
      max_tokens: body.max_tokens ?? 3000,
      temperature: body.temperature ?? 0.3,
      system: body.system,      // ← verbatim. É o que permite o cache_control.
      messages: body.messages
    };
 
    const chars = JSON.stringify(payload.system || '').length +
                  JSON.stringify(payload.messages || '').length;
 
    console.log('[INICIO] ' + VERSAO + ' | corte=' + (TIMEOUT_MS / 1000) + 's' +
      ' | modelo=' + payload.model + ' | teto=' + payload.max_tokens +
      ' | enviados=' + chars + ' chars');
 
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
    const seg = (Date.now() - t0) / 1000;
 
    if (data && data.usage) {
      const u = data.usage;
      const sai = u.output_tokens || 0;
      console.log('[USAGE] ' + seg.toFixed(1) + 's | ' +
        (seg > 0 ? (sai / seg).toFixed(0) : '?') + ' tok/s' +
        ' | entrada=' + (u.input_tokens || 0) +
        ' saida=' + sai + ' (teto ' + payload.max_tokens + ')' +
        ' cache_gravado=' + (u.cache_creation_input_tokens || 0) +
        ' cache_lido=' + (u.cache_read_input_tokens || 0));
      // bateu no teto = narrativa cortada no meio; é outro problema, não timeout
      if (sai >= payload.max_tokens) {
        console.log('[ATENÇÃO] a saída bateu no teto de max_tokens — a narrativa ' +
          'provavelmente foi cortada no meio. Reduzir o texto pedido no prompt, ' +
          'não aumentar o corte de tempo.');
      }
    } else {
      console.log('[USAGE] ' + seg.toFixed(1) + 's | sem bloco usage | status ' + response.status +
        ' | corpo=' + JSON.stringify(data).slice(0, 300));
    }
 
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
 
  } catch (err) {
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const abortou = err.name === 'AbortError';
    console.log('[ERRO] ' + VERSAO + ' | ' + seg + 's | ' +
      (abortou ? 'cancelado pelo corte local de ' + (TIMEOUT_MS / 1000) + 's' : err.message));
    return {
      statusCode: abortou ? 504 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message: abortou
            ? '[' + VERSAO + '] A geração passou de ' + (TIMEOUT_MS / 1000) + 's. ' +
              'Pela velocidade medida do modelo (~44 tokens/s), uma narrativa completa ' +
              'leva 15 a 24s — passar de ' + (TIMEOUT_MS / 1000) + 's não é lentidão normal. ' +
              'Confira no log da função a linha [USAGE] ou [ERRO].'
            : '[' + VERSAO + '] ' + err.message
        }
      })
    };
  } finally {
    clearTimeout(corte);
  }
};
