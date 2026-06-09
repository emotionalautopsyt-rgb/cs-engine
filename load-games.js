const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const key = (event.queryStringParameters && event.queryStringParameters.key) || 'games';

    const siteID = process.env.GENIO_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN;

    const store = getStore({
      name: "genio-placares",
      siteID: siteID,
      token: token
    });

    const data = await store.get(key, { type: "json" });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: data || null, mode: 'server' })
    };
  } catch (err) {
    console.error('load-games error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: null, mode: 'local-only' })
    };
  }
};
