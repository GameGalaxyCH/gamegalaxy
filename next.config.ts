import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Output Standalone: Required for your Docker setup
  output: "standalone",

  // 2. Disable "Powered by Next.js":
  // This removes the header that tells hackers exactly what framework 
  // you are running. It's a small but professional "security by obscurity" step.
  poweredByHeader: false,

  // 3. React Strict Mode:
  // Catches unsafe lifecycles and deprecated API usage during development.
  reactStrictMode: true,

  serverExternalPackages: [
    'puppeteer-core',
    'puppeteer',
    'puppeteer-extra', 
    'puppeteer-extra-plugin-stealth'
  ],
  
  async headers() {
    return [
      {
        // Apply these headers to ALL routes
        source: "/:path*",
        headers: [
          {
            // SECURITY: Prevents your site from being embedded in an iframe.
            // Use "DENY" for maximum security. 
            // Change to "SAMEORIGIN" if you plan to embed your own site within itself.
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // SECURITY: Prevents the browser from "guessing" the content type.
            // It stops attacks where hackers hide malicious scripts in images/files.
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // PRIVACY: Controls how much information is sent to other sites when 
            // a user clicks a link on your site. "strict-origin-..." is the modern standard.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // HARDWARE PROTECTION: (From your 4th snippet - Very Professional)
            // Explicitly tells the browser "We do not use the camera, mic, or geolocation."
            // This stops malicious 3rd party scripts from trying to access them.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            // HTTPS ENFORCEMENT: (From your 2nd snippet)
            // Tells the browser: "Only talk to me over HTTPS for the next year."
            // Even if a user types 'http://', the browser will force 'https://'.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;