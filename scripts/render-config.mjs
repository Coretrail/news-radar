import path from 'node:path';
import ipaddr from 'ipaddr.js';
export function allowRules(value = 'all') {
  const networks = value.trim().split(/\s+/).filter(Boolean);
  if (!networks.length) throw Error('ALLOWED_NETWORKS is empty');
  for (const network of networks) {
    if (network === 'all') continue;
    try {
      network.includes('/') ? ipaddr.parseCIDR(network) : ipaddr.parse(network);
    } catch {
      throw Error('Invalid ALLOWED_NETWORKS address or CIDR');
    }
  }
  return networks.map((network) => `allow ${network};`).join('\n    ');
}
export function nativeValues(env = process.env) {
  const absolute = (key, fallback) => {
    const value = env[key] || fallback;
    if (!path.isAbsolute(value) || !/^\/[A-Za-z0-9/_.-]+$/.test(value))
      throw Error(`Invalid ${key}: use a simple absolute path`);
    return value;
  };
  const user = env.NATIVE_USER || 'newsradar';
  const group = env.NATIVE_GROUP || user;
  if (![user, group].every((v) => /^[a-z_][a-z0-9_-]*$/.test(v)))
    throw Error('Invalid native service user/group');
  const listen = env.NATIVE_LISTEN || '127.0.0.1:8080';
  if (!/^(?:\[[a-fA-F0-9:]+\]:|[a-zA-Z0-9.-]+:)?\d{1,5}$/.test(listen))
    throw Error('Invalid NATIVE_LISTEN');
  const serverName = env.NATIVE_SERVER_NAME || 'localhost';
  if (!/^[a-zA-Z0-9._ -]+$/.test(serverName)) throw Error('Invalid NATIVE_SERVER_NAME');
  const upstream = `${env.HOST && !['0.0.0.0', '::'].includes(env.HOST) ? env.HOST : '127.0.0.1'}:${env.PORT || '3001'}`;
  if (!/^[a-zA-Z0-9.:-]+$/.test(upstream)) throw Error('Invalid API upstream');
  return {
    INSTALL_DIR: absolute('NATIVE_INSTALL_DIR', '/srv/news-radar'),
    NODE_BINARY: absolute('NODE_BINARY', '/usr/bin/node'),
    SERVICE_USER: user,
    SERVICE_GROUP: group,
    NGINX_LISTEN: listen,
    NGINX_SERVER_NAME: serverName,
    STATIC_ROOT: `${absolute('NATIVE_INSTALL_DIR', '/srv/news-radar')}/dist`,
    API_UPSTREAM: upstream,
    ALLOW_RULES: allowRules(env.ALLOWED_NETWORKS),
  };
}
export function substitute(template, values) {
  return template.replace(/\$\{([A-Z_]+)\}/g, (_, key) => {
    if (!(key in values)) throw Error(`Missing template value: ${key}`);
    return values[key];
  });
}
