const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const key = event.queryStringParameters?.key || 'games';

    const store = getStore({ name: 'genio-placares', consistency: 'strong' });
    const data = await store.get(key, { type: 'json' });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: data || null })
    };
  } catch (err) {
    // Se não encontrar, retorna null sem erro
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: null })
    };
  }
};
