import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // NB: deliberately NOT enabling `staleTimes` / `optimisticRouting`.
    // This app is auth-gated and role-aware; the client router cache they
    // turn on can serve stale views right after login/logout/role changes.
    // Freshness matters more here than shaving a few ms off navigation.
  },
};

export default nextConfig;
