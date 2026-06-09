exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const key = (event.queryStringParameters && event.queryStringParameters.key) || 'games';
    const token = process.env.NETLIFY_TOKEN;
    const siteID = process.env.GENIO_SITE_ID;

    const url = `https://api.netlify.com/api/v1/blobs/${siteID}/genio-placares/${encodeURIComponent(key)}`;
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (resp.status === 404) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, data: null }) };
    }

    if (!resp.ok) {
      throw new Error(`${resp.status}`);
    }

    const text = await resp.text();
    const data = JSON.parse(text);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, data: data, mode: 'server' })
    };
  } catch (err) {
    console.error('load-games:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, data: null, mode: 'local-only' })
    };
  }
};
