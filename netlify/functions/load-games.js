exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const key = (event.queryStringParameters && event.queryStringParameters.key) || 'games';

    const siteId = process.env.GENIO_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN;

    if (!siteId || !token) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: null, mode: 'local-only' }) };
    }

    const url = `https://api.netlify.com/api/v1/sites/${siteId}/blobs/${encodeURIComponent(key)}?namespace=genio-placares`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (resp.status === 404) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: null }) };
    }

    if (!resp.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: null }) };
    }

    const data = await resp.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: data, mode: 'server' })
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, data: null }) };
  }
};
