import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Fetches public web pages for the website import, and nothing else.
 *
 * A workspace admin types the address, so it must never reach this server's
 * own network: loopback, private ranges, link-local (cloud metadata lives at
 * 169.254.169.254) and the like are refused. The check runs inside the socket's
 * DNS lookup, so a name that resolves to a public address for one check and a
 * private one for the connection cannot slip through.
 */

export const IMPORT_USER_AGENT = "PenavenBot/1.0 (+https://penaven.vercel.app; website import)";

const blocked = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}

/** True for any address this server must not connect to on a visitor's behalf. */
export function isBlockedAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;

  // IPv4 written inside IPv6 (::ffff:127.0.0.1, ::127.0.0.1) is judged as IPv4.
  const embedded = address.match(/^::(?:ffff:(?:0:)?)?(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (embedded) return isBlockedAddress(embedded);
  const hexMapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    return isBlockedAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return blocked.check(address, "ipv6");
}

export class ImportFetchError extends Error {
  constructor(
    message: string,
    readonly code: "blocked" | "bad-url" | "too-large" | "timeout" | "network" | "redirects",
  ) {
    super(message);
    this.name = "ImportFetchError";
  }
}

/** Parses an address an admin typed, adding https:// when the scheme is missing. */
export function parsePublicUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2000 || /[\s\0]/.test(trimmed)) {
    throw new ImportFetchError("Enter a website address such as https://example.com.", "bad-url");
  }
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ImportFetchError("Enter a website address such as https://example.com.", "bad-url");
  }
  assertFetchable(url);
  return url;
}

/** Throws unless the URL is plain http(s) to a public host on the default port. */
export function assertFetchable(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportFetchError("Only http and https addresses can be imported.", "bad-url");
  }
  if (url.username || url.password) {
    throw new ImportFetchError("Addresses with a user name or password can't be imported.", "bad-url");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImportFetchError("Only websites on the standard ports can be imported.", "bad-url");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new ImportFetchError("That address is on a private network, so it can't be imported.", "blocked");
  }
  if (
    !net.isIP(host) &&
    (!host.includes(".") || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host) || host === "localhost")
  ) {
    throw new ImportFetchError("That address is not a public website.", "blocked");
  }
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const usable = addresses.filter((entry) => !isBlockedAddress(entry.address));
    if (usable.length === 0 || usable.length !== addresses.length) {
      const refused = Object.assign(new Error("blocked address"), { code: "EBLOCKED" });
      return callback(refused, "", 4);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, usable);
    }
    callback(null, usable[0].address, usable[0].family);
  });
};

export type FetchedPage = {
  url: string;
  status: number;
  contentType: string;
  body: string;
};

export type PageFetcher = (url: URL, maxBytes: number) => Promise<FetchedPage>;

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function requestOnce(url: URL, maxBytes: number): Promise<FetchedPage & { location: string | null }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: {
          "User-Agent": IMPORT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            request.destroy(new ImportFetchError("Page is too large to import.", "too-large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const location = response.headers.location;
          resolve({
            url: url.toString(),
            status: response.statusCode ?? 0,
            contentType: String(response.headers["content-type"] ?? "").toLowerCase(),
            body: Buffer.concat(chunks).toString("utf8"),
            location: typeof location === "string" ? location : null,
          });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () =>
      request.destroy(new ImportFetchError("The website took too long to answer.", "timeout")),
    );
    request.on("error", (error: NodeJS.ErrnoException) => {
      if (error instanceof ImportFetchError) return reject(error);
      if (error.code === "EBLOCKED") {
        return reject(
          new ImportFetchError("That website resolves to a private network, so it can't be imported.", "blocked"),
        );
      }
      reject(new ImportFetchError("The website could not be reached.", "network"));
    });
    request.end();
  });
}

/**
 * GET with redirects followed by hand, each one checked again. Returns the
 * final response; the caller decides what a status code means.
 */
export const fetchPublicPage: PageFetcher = async (start, maxBytes) => {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchable(url);
    const response = await requestOnce(url, maxBytes);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, url);
      continue;
    }
    return { url: response.url, status: response.status, contentType: response.contentType, body: response.body };
  }
  throw new ImportFetchError("The website redirected too many times.", "redirects");
};
