const { getStore } = require("@netlify/blobs");

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

    const siteID = process.env.GENIO_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN;

    const store = getStore({
      name: "genio-placares",
      siteID: siteID,
      token: token
    });

    await store.setJSON(key, data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, mode: 'server' })
    };
  } catch (err) {
    console.error('save-games error:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mode: 'local-only', error: err.message })
    };
  }
};
