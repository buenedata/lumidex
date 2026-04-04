export async function POST(req: Request) {
  const body = await req.json();
  console.log('eBay webhook:', body);

  return new Response('OK', { status: 200 });
}