
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Or any other appropriate limit
    },
    // allowedDevOrigins: ["https://6000-firebase-studio-1746988265215.cluster-oayqgyglpfgseqclbygurw4xd4.cloudworkstations.dev"], // Removed due to unrecognized key error
  },
};

export default nextConfig;
