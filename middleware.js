// Serve the consumer quote page at the root of inquiry.aperiansolutions.com.
// (A vercel.json rewrite can't do this: the real index.html file wins on "/".)
export const config = { matcher: '/' };

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'inquiry.aperiansolutions.com') {
    const url = new URL(request.url);
    url.pathname = '/quote';
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  }
}
