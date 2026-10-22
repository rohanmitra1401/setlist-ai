import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Report-only until it has been checked against production traffic.
// 'unsafe-inline': the App Router injects inline bootstrap scripts.
// 'unsafe-eval': Essentia's WASM glue calls `new Function`.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'${isDev ? " https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Album art comes from Spotify's CDNs; Facebook-linked accounts have Facebook-hosted avatars.
  "img-src 'self' data: https://*.scdn.co https://*.spotifycdn.com https://*.fbsbx.com https://*.fbcdn.net",
  "font-src 'self'",
  // 30-second previews are fetched from Apple's and Deezer's CDNs.
  "connect-src 'self' https://audio-ssl.itunes.apple.com https://*.mzstatic.com https://*.dzcdn.net",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.spotify.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
