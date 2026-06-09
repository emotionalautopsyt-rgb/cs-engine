exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const body = JSON.parse(event.body);
    const { key, data } = body;
    if (!key || !data) {
      return { statusCode: 400, body: JSON.stringify({ error: 'key e data obrigatorios' }) };
    }

    // Usar NETLIFY_BLOBS_CONTEXT que o Netlify injeta automaticamente
    // ou usar a API REST com o token de deploy
    const token = process.env.NETLIFY_TOKEN;
    const siteID = process.env.GENIO_SITE_ID;

    // Netlify Blobs REST API com token de acesso pessoal
    // Endpoint correto para Personal Access Token
    const url = `https://api.netlify.com/api/v1/blobs/${siteID}/genio-placares/${encodeURIComponent(key)}`;
    
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      body: JSON.stringify(data)
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`${resp.status}: ${err}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mode: 'server' })
    };
  } catch (err) {
    console.error('save-games:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mode: 'local-only', error: err.message })
    };
  }
};
