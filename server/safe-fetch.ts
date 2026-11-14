import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
export function isPublicAddress(raw: string) {
  try {
    let ip = ipaddr.parse(raw);
    if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress())
      ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === 'unicast';
  } catch {
    return false;
  }
}
export async function validateTarget(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443'))
    throw Error('Só HTTPS público na porta 443 é permitido');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw Error('Destino privado/reservado bloqueado');
  return { url: u, addresses };
}
export async function safeFetch(
  raw: string,
  headers: Record<string, string> = {},
  redirects = 0,
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders; url: string }> {
  if (redirects > 4) throw Error('Demasiados redirecionamentos');
  const { url, addresses } = await validateTarget(raw);
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'NewsRadar/1.0 (self-hosted RSS reader)',
          Accept:
            'application/rss+xml, application/atom+xml, application/json, text/xml;q=0.9,*/*;q=0.2',
          'Accept-Encoding': 'identity',
          ...headers,
        },
        lookup: ((_host: any, _options: any, callback: any) => {
          const a = addresses.find((a) => a.family === 4) || addresses[0];
          if (_options.all) callback(null, addresses);
          else callback(null, a.address, a.family);
        }) as any,
      },
      (res) => {
        const status = res.statusCode || 500;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          safeFetch(new URL(res.headers.location, url).toString(), {}, redirects + 1).then(
            resolve,
            reject,
          );
          return;
        }
        let size = 0;
        const parts: Buffer[] = [];
        res.on('data', (b: Buffer) => {
          size += b.length;
          if (size > 3 * 1024 * 1024) {
            res.destroy();
            reject(Error('Resposta excede 3MB'));
          } else parts.push(b);
        });
        res.on('end', () =>
          resolve({
            status,
            body: Buffer.concat(parts).toString('utf8'),
            headers: res.headers,
            url: url.toString(),
          }),
        );
        res.on('error', reject);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(Error('Prazo total de 12 segundos excedido')),
      12000,
    );
    req.on('close', () => clearTimeout(deadline));
    req.setTimeout(12000, () => req.destroy(Error('Timeout de 12 segundos')));
    req.on('error', reject);
  });
}
