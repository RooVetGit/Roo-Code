import { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://roocode.com"

	return [
		{
			url: `${baseUrl}/`,
			lastModified: new Date("2025-06-03T21:03:19.000Z"),
			changeFrequency: "yearly",
			priority: 1,
		},
		{
			url: `${baseUrl}/enterprise`,
			lastModified: new Date("2025-07-02T20:39:02.000Z"),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/evals`,
			lastModified: new Date("2025-06-11T21:17:53.000Z"),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/privacy`,
			lastModified: new Date("2025-06-20T03:00:11.000Z"),
			changeFrequency: "yearly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/terms`,
			lastModified: new Date("2025-06-20T04:56:14.000Z"),
			changeFrequency: "yearly",
			priority: 0.5,
		},
	]
}
