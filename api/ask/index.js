/*
  POST /api/ask  →  Mid-Atlantic-Agent

  Runs as a managed function on the Static Web App, in the same deployment as
  the site. That is the whole reason it exists: the browser must never hold the
  Foundry credential, and this is the cheapest place to keep it — no separate
  resource, no CORS, and it inherits the site's Entra gate for free when that
  lands.

  Configuration, as Application settings on the Static Web App (NOT in this
  repo, and not in the client bundle):

    AGENT_ENDPOINT   https://cmta-kn-dev-resource.services.ai.azure.com/api/projects
                     /cmta-kn-dev/agents/Mid-Atlantic-Agent/endpoint/protocols
                     /openai/responses
    AGENT_KEY        the API key — OR leave unset and use managed identity

  Managed identity is the better setup and means no secret exists anywhere:
  turn on the Static Web App's system-assigned identity, grant it the
  "Azure AI Developer" role on the Foundry project, and delete AGENT_KEY. This
  function takes whichever is configured.
*/

const ENDPOINT = process.env.AGENT_ENDPOINT;
const KEY = process.env.AGENT_KEY;
const SCOPE = 'https://ai.azure.com/.default';
const TIMEOUT_MS = 55000; // SWA managed functions cap out around 45-60s

// Cached so a burst of questions does not fetch a token per request.
let cachedToken = null;

async function bearer() {
  if (KEY) return `api-key ${KEY}`;
  if (cachedToken && cachedToken.expires > Date.now() + 60000) {
    return `Bearer ${cachedToken.value}`;
  }
  // The App Service identity endpoint, present whenever a managed identity is
  // enabled. No SDK needed, which keeps this function dependency-free.
  const url = `${process.env.IDENTITY_ENDPOINT}?resource=${SCOPE}&api-version=2019-08-01`;
  const res = await fetch(url, { headers: { 'X-IDENTITY-HEADER': process.env.IDENTITY_HEADER } });
  if (!res.ok) throw new Error(`identity endpoint ${res.status}`);
  const tok = await res.json();
  cachedToken = { value: tok.access_token, expires: Date.parse(tok.expires_on) };
  return `Bearer ${cachedToken.value}`;
}

module.exports = async function (context, req) {
  const reply = (status, body) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body,
    };
  };

  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const question = (req.body && req.body.question ? String(req.body.question) : '').trim();
  if (!question) return reply(400, { error: 'Ask a question.' });
  if (question.length > 2000) {
    return reply(400, { error: 'That question is too long. Trim it to 2000 characters.' });
  }
  if (!ENDPOINT) {
    context.log.error('AGENT_ENDPOINT is not set');
    return reply(503, { error: 'The agent is not configured yet.' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: await bearer() },
      body: JSON.stringify({ input: question, stream: false }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      // The upstream body can carry deployment details and quota messages, so
      // it is logged but never returned to the browser.
      context.log.error(`agent ${upstream.status}: ${text.slice(0, 500)}`);
      return reply(502, { error: 'The agent could not answer that. Try again shortly.' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return reply(502, { error: 'The agent returned something unreadable.' });
    }

    // The `responses` protocol nests the text a few levels down and the exact
    // shape moves between API versions, so pull it defensively rather than
    // trusting one path.
    const answer =
      data.output_text ||
      (Array.isArray(data.output) &&
        data.output
          .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
          .map((c) => c.text || '')
          .join('')
          .trim()) ||
      '';

    return reply(200, { answer, raw: answer ? undefined : data });
  } catch (err) {
    if (err.name === 'AbortError') {
      return reply(504, { error: 'The agent took too long. Try a shorter question.' });
    }
    context.log.error(err);
    return reply(500, { error: 'Something went wrong reaching the agent.' });
  } finally {
    clearTimeout(timer);
  }
};
