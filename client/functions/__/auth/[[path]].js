export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // Construct the target URL on the default Firebase domain
    const targetUrl = new URL(url.pathname + url.search, "https://justingenerator.firebaseapp.com");

    console.log(`[AuthProxy] Proxying ${url.pathname} to ${targetUrl.toString()}`);

    // Create a new request object to avoid immutable header issues
    const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
    });

    try {
        const response = await fetch(proxyRequest);

        // We need to return a new Response because the one from fetch might be immutable
        // or have headers we want to adjust. For proxying, passing it through usually works.
        return response;
    } catch (error) {
        console.error("[AuthProxy] Error fetching from Firebase:", error);
        return new Response("Internal Server Error in Auth Proxy", { status: 500 });
    }
}
