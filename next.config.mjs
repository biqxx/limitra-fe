/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce the minimal server bundle used by the production Docker image.
  output: 'standalone',
};

export default nextConfig;
