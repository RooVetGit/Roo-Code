import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	/* config options here */
	async redirects() {
		return [
			// Redirect www to non-www
			{
				source: "/:path*",
				has: [
					{
						type: "host",
						value: "www.roocode.com",
					},
				],
				destination: "https://roocode.com/:path*",
				permanent: true,
			},
			// Redirect HTTP to HTTPS
			{
				source: "/:path*",
				has: [
					{
						type: "header",
						key: "x-forwarded-proto",
						value: "http",
					},
				],
				destination: "https://roocode.com/:path*",
				permanent: true,
			},
		]
	},
}

export default nextConfig
