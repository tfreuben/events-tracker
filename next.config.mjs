/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 14 for src/instrumentation.ts to run. Stable from Next 15.
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
