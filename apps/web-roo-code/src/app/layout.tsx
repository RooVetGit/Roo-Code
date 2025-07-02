import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import { Providers } from "@/components/providers"

import Shell from "./shell"

import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: {
		default: "Roo Code – Your AI-Powered Dev Team in VS Code",
		template: "%s | Roo Code",
	},
	description:
		"Roo Code puts an entire AI dev team right in your editor, outpacing closed tools with deep project-wide context, multi-step agentic coding, and unmatched developer-centric flexibility.",
	keywords: [
		"AI coding assistant",
		"VS Code extension",
		"AI development tools",
		"code completion",
		"AI pair programming",
		"developer productivity",
		"coding AI",
		"software development",
		"AI code generation",
		"intelligent code editor",
	],
	authors: [{ name: "Roo Code, Inc." }],
	creator: "Roo Code, Inc.",
	publisher: "Roo Code, Inc.",
	alternates: {
		canonical: "https://roocode.com",
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://roocode.com",
		siteName: "Roo Code",
		title: "Roo Code – Your AI-Powered Dev Team in VS Code",
		description:
			"Roo Code puts an entire AI dev team right in your editor, outpacing closed tools with deep project-wide context, multi-step agentic coding, and unmatched developer-centric flexibility.",
	},
	twitter: {
		card: "summary_large_image",
		title: "Roo Code – Your AI-Powered Dev Team in VS Code",
		description:
			"Roo Code puts an entire AI dev team right in your editor, outpacing closed tools with deep project-wide context, multi-step agentic coding, and unmatched developer-centric flexibility.",
		creator: "@RooCodeInc",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	verification: {
		google: "google-site-verification-placeholder", // This should be replaced with actual verification code
	},
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png" }],
		other: [
			{
				rel: "android-chrome-192x192",
				url: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				rel: "android-chrome-512x512",
				url: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link
					rel="stylesheet"
					type="text/css"
					href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
				/>
			</head>
			<body className={inter.className}>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "Organization",
							name: "Roo Code, Inc.",
							alternateName: "Roo Code",
							url: "https://roocode.com",
							logo: "https://roocode.com/Roo-Code-Logo-Horiz-blk.svg",
							description:
								"Roo Code puts an entire AI dev team right in your editor, outpacing closed tools with deep project-wide context, multi-step agentic coding, and unmatched developer-centric flexibility.",
							foundingDate: "2024",
							industry: "Software Development",
							sameAs: [
								"https://github.com/RooCodeInc/Roo-Code",
								"https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline",
							],
							contactPoint: {
								"@type": "ContactPoint",
								contactType: "customer service",
								email: "support@roocode.com",
							},
							address: {
								"@type": "PostalAddress",
								streetAddress: "98 Graceland Dr",
								addressLocality: "San Rafael",
								addressRegion: "CA",
								postalCode: "94901",
								addressCountry: "US",
							},
						}),
					}}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "WebSite",
							name: "Roo Code",
							url: "https://roocode.com",
							description:
								"Your AI-Powered Dev Team in VS Code. Deep project-wide context, multi-step agentic coding, and unmatched developer-centric flexibility.",
							publisher: {
								"@type": "Organization",
								name: "Roo Code, Inc.",
							},
							potentialAction: {
								"@type": "SearchAction",
								target: "https://roocode.com/search?q={search_term_string}",
								"query-input": "required name=search_term_string",
							},
						}),
					}}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "SoftwareApplication",
							name: "Roo Code",
							applicationCategory: "DeveloperApplication",
							operatingSystem: "VS Code",
							description:
								"AI-powered development assistant that puts an entire dev team right in your VS Code editor.",
							url: "https://roocode.com",
							downloadUrl:
								"https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline",
							author: {
								"@type": "Organization",
								name: "Roo Code, Inc.",
							},
							offers: {
								"@type": "Offer",
								price: "0",
								priceCurrency: "USD",
								availability: "https://schema.org/InStock",
							},
						}),
					}}
				/>
				<div itemScope itemType="https://schema.org/WebSite">
					<link itemProp="url" href="https://roocode.com" />
					<meta itemProp="name" content="Roo Code" />
				</div>
				<Providers>
					<Shell>{children}</Shell>
				</Providers>
			</body>
		</html>
	)
}
