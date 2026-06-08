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

    const siteId = process.env.GENIO_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN;

    if (!siteId || !token) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'local-only' }) };
    }

    const url = `https://api.netlify.com/api/v1/sites/${siteId}/blobs/${encodeURIComponent(key)}?namespace=genio-placares`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'local-only', warning: err }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'server' }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'local-only', error: err.message }) };
  }
};
