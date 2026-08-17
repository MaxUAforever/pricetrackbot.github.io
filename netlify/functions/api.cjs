const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function proxyPath(eventPath) {
  const suffix = (eventPath || "")
    .replace(/^\/\.netlify\/functions\/api\/?/, "")
    .replace(/^\/api\/?/, "");
  return `/api/${suffix}`;
}

function queryString(event) {
  if (event.rawQuery) {
    return event.rawQuery;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  }
  return params.toString();
}

function requestBody(event) {
  if (!event.body) {
    return undefined;
  }
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : event.body;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type,X-Telegram-Init-Data",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      },
    };
  }

  const backendBaseUrl = process.env.BOT_API_BASE_URL;
  if (!backendBaseUrl) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Service is not configured yet.",
      }),
    };
  }

  const target = new URL(proxyPath(event.path), backendBaseUrl);
  const search = queryString(event);
  if (search) {
    target.search = search;
  }

  const headers = {};
  for (const [key, value] of Object.entries(event.headers || {})) {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && value !== undefined) {
      headers[lowerKey] = value;
    }
  }
  const extraHeaderName = process.env.BACKEND_EXTRA_HEADER_NAME;
  if (extraHeaderName) {
    headers[extraHeaderName.toLowerCase()] =
      process.env.BACKEND_EXTRA_HEADER_VALUE || "true";
  }

  try {
    const response = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod)
        ? undefined
        : requestBody(event),
    });

    const responseHeaders = {};
    const contentType = response.headers.get("content-type");
    if (contentType) {
      responseHeaders["Content-Type"] = contentType;
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Service is not available at the moment.",
      }),
    };
  }
};
