import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	serverExternalPackages: ["postgres", "ioredis", "bullmq"],
}

export default nextConfig
