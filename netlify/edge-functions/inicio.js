// No domínio da marca, "/" entrega a página inicial estática (/inicio/), boa para o Google.
// Nos domínios próprios das lojas, "/" continua sendo a loja (o app).
const MARCA = new Set(['usefood.netlify.app', 'usefood.com.br', 'www.usefood.com.br']);

export default async (request) => {
  const { hostname } = new URL(request.url);
  const marca = MARCA.has(hostname) || hostname.endsWith('--usefood.netlify.app');
  if (!marca) return;
  return new URL('/inicio/', request.url);
};

export const config = { path: '/' };
