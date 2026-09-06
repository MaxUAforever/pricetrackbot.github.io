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
])

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type,X-Telegram-Init-Data",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      },
    })
  }

  const backendBaseUrl = env.BOT_API_BASE_URL
  if (!backendBaseUrl) {
    return jsonResponse(503, {
      success: false,
      error: "Service is not configured yet.",
    })
  }

  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    backendBaseUrl,
  )

  const headers = new Headers(request.headers)
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  if (env.BACKEND_EXTRA_HEADER_NAME) {
    headers.set(
      env.BACKEND_EXTRA_HEADER_NAME,
      env.BACKEND_EXTRA_HEADER_VALUE || "true",
    )
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : request.body,
      redirect: "follow",
    })

    const responseHeaders = new Headers()
    const contentType = response.headers.get("content-type")
    if (contentType) {
      responseHeaders.set("Content-Type", contentType)
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("Backend proxy request failed", {
      path: incomingUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse(502, {
      success: false,
      error: "Service is not available at the moment.",
    })
  }
}
