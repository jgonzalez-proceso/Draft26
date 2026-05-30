/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permite cargar banderas y fotos de jugadores desde URLs externas.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
