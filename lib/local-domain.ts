import * as ip from 'ip';

export function isLocalDomain(url: URL): boolean {
  const hostname = url.hostname;

  if (ip.isV4Format(hostname) || ip.isV6Format(hostname)) {
    return ip.isPrivate(hostname);
  }

  if (
    url.hostname.endsWith('.local') ||
    url.hostname.endsWith('.lan') ||
    url.hostname.endsWith('.internal') ||
    url.hostname.endsWith('.home')
  ) {
    return true;
  }

  return false;
}
