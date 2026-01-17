export async function onRequest(context) {
    const { request, next } = context;
    const url = new URL(request.url);

    // Construct the target URL on the default Firebase domain
    const targetUrl = new URL(url.pathname + url.search, "https://justingenerator.firebaseapp.com");

    console.log(`[AuthProxy] Intercepting ${url.pathname} and proxying to ${targetUrl.toString()}`);

    // Create a new request object to avoid immutable header issues
    const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
    });

    try {
        const response = await fetch(proxyRequest);

        // Add a debug header so we can verify if the proxy is active on the live site
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("X-Auth-Proxy", "active");

        return newResponse;
    } catch (error) {
        console.error("[AuthProxy] Error fetching from Firebase:", error);
        return new Response("Internal Server Error in Auth Proxy", {
            status: 500,
            headers: { "X-Auth-Proxy-Error": error.message }
        });
    }
}
