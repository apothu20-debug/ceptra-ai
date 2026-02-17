/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // Static export for mobile (Capacitor)
  ...(process.env.BUILD_MOBILE === 'true' ? { output: 'export' } : {}),
  // Allow larger API responses for file generation
  experimental: {
    serverComponentsExternalPackages: ['pptxgenjs', 'exceljs', 'sharp'],
  },
};
module.exports = nextConfig;
