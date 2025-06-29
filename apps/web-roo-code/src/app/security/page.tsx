import { Metadata } from "next"
import { Shield, Lock, CheckCircle, Users, Zap, FileCheck, Globe, Phone } from "lucide-react"

import { Button } from "@/components/ui"
import { AnimatedText } from "@/components/animated-text"
import { AnimatedBackground } from "@/components/homepage"
import { ContactForm } from "@/components/enterprise/contact-form"

export const metadata: Metadata = {
	title: "Enterprise Security | Roo Code - SOC 2 Compliant AI Development",
	description:
		"Enterprise-grade security built into Roo Code. SOC 2 Type I certified, GDPR compliant, with end-to-end encryption and zero-trust architecture for secure AI-powered development.",
	alternates: {
		canonical: "https://roocode.com/security",
	},
}

export default function SecurityPage() {
	return (
		<>
			{/* Hero Section */}
			<section className="relative flex h-[calc(100vh-theme(spacing.16))] items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16">
						<div className="flex flex-col justify-center space-y-6 sm:space-y-8">
							<div>
								<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
									<span className="block">Enterprise-Grade</span>
									<AnimatedText className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
										Security Built-In
									</AnimatedText>
								</h1>
								<p className="mt-4 max-w-md text-base text-muted-foreground sm:mt-6 sm:text-lg">
									Roo Code is designed with{" "}
									<AnimatedText className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
										security-first principles
									</AnimatedText>{" "}
									to meet the stringent requirements of enterprise customers while delivering powerful
									AI-assisted development capabilities.
								</p>
							</div>
							<div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
								<Button
									size="lg"
									className="w-full hover:bg-gray-200 dark:bg-white dark:text-black sm:w-auto"
									asChild>
									<a href="#contact" className="flex w-full items-center justify-center">
										Request Security Demo
										<Shield className="ml-2 h-4 w-4" />
									</a>
								</Button>
								<Button variant="outline" size="lg" className="w-full sm:w-auto">
									<a href="#architecture" className="flex w-full items-center justify-center">
										View Architecture
									</a>
								</Button>
							</div>
						</div>
						<div className="relative mt-8 flex items-center justify-center lg:mt-0">
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="h-[250px] w-[250px] rounded-full bg-blue-500/20 blur-[100px] sm:h-[300px] sm:w-[300px] md:h-[350px] md:w-[350px]" />
							</div>
							<div className="relative z-10 rounded-lg border border-border bg-card p-6 shadow-lg">
								<div className="mb-4 flex items-center space-x-2">
									<Shield className="h-6 w-6 text-blue-400" />
									<h3 className="text-lg font-semibold">Security Highlights</h3>
								</div>
								<div className="space-y-3">
									<div className="flex items-center space-x-2">
										<CheckCircle className="h-4 w-4 text-green-400" />
										<span className="text-sm">SOC 2 Type I Certified</span>
									</div>
									<div className="flex items-center space-x-2">
										<CheckCircle className="h-4 w-4 text-green-400" />
										<span className="text-sm">End-to-end encryption</span>
									</div>
									<div className="flex items-center space-x-2">
										<CheckCircle className="h-4 w-4 text-green-400" />
										<span className="text-sm">Explicit permission controls</span>
									</div>
									<div className="flex items-center space-x-2">
										<CheckCircle className="h-4 w-4 text-green-400" />
										<span className="text-sm">Open-source transparency</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Data Protection Section */}
			<section className="bg-secondary/50 py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">🔒 Data Protection & Privacy</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							Your code stays protected with multiple layers of security and user control.
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
								<Zap className="h-6 w-6 text-blue-500" />
							</div>
							<h3 className="mb-2 text-xl font-bold">Local Processing First</h3>
							<p className="text-muted-foreground">
								Most operations happen locally within VSCode, minimizing external data exposure.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
								<Users className="h-6 w-6 text-blue-500" />
							</div>
							<h3 className="mb-2 text-xl font-bold">Selective Sharing</h3>
							<p className="text-muted-foreground">
								Only explicitly selected code is sent to AI providers with your approval.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
								<FileCheck className="h-6 w-6 text-blue-500" />
							</div>
							<h3 className="mb-2 text-xl font-bold">Smart Filtering</h3>
							<p className="text-muted-foreground">
								Built-in .rooignore system prevents sensitive files from being accessed.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
								<Lock className="h-6 w-6 text-blue-500" />
							</div>
							<h3 className="mb-2 text-xl font-bold">Enterprise Encryption</h3>
							<p className="text-muted-foreground">
								All data encrypted at rest and in transit using industry-standard methods.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Compliance Section */}
			<section className="py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							🏢 Enterprise Compliance & Controls
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							Built to meet the highest standards of enterprise security and compliance.
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-2">
						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-6 text-2xl font-bold">Organizational Management</h3>
							<ul className="space-y-4">
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">MDM Integration:</span> Mobile Device Management
										support for policy enforcement
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Cloud Authentication:</span> Centralized user
										management through Roo Code Cloud
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Access Controls:</span> Role-based permissions
										and organizational policies
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Audit Logging:</span> Comprehensive tracking of
										all external API interactions
									</div>
								</li>
							</ul>
						</div>

						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-6 text-2xl font-bold">Compliance Ready</h3>
							<ul className="space-y-4">
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">GDPR Compliant:</span> European data protection
										standards
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">SOC 2 Type I:</span> Certified with Type II in
										observation{" "}
										<a
											href="https://trust.delve.co/roo-code"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-500 hover:underline">
											(trust.delve.co/roo-code)
										</a>
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">CCPA Ready:</span> California consumer privacy
										compliance
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Industry Standards:</span> ISO 27001-inspired
										controls practices
									</div>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* Security Architecture Section */}
			<section id="architecture" className="bg-secondary/50 py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							🔐 Security Architecture Highlights
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							Multi-layer protection with zero-trust approach.
						</p>
					</div>

					<div className="grid gap-8 lg:grid-cols-2">
						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-6 text-2xl font-bold">Multi-Layer Protection</h3>
							<div className="rounded-lg bg-muted p-6 font-mono text-sm">
								<div className="space-y-2">
									<div>User Code → Security Filters → Encryption → AI Providers</div>
									<div className="text-muted-foreground">
										&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓
									</div>
									<div className="text-muted-foreground">
										&nbsp;.rooignore&nbsp;&nbsp;&nbsp;Access
										Control&nbsp;&nbsp;&nbsp;HTTPS/TLS&nbsp;&nbsp;&nbsp;Secure APIs
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-6 text-2xl font-bold">Security-First Approach</h3>
							<ul className="space-y-4">
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Explicit Permission:</span> Every external
										operation requires user approval
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Minimal Data Sharing:</span> Only selected code
										sent to approved AI providers
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Comprehensive Auditing:</span> Complete tracking
										of all external interactions
									</div>
								</li>
								<li className="flex items-start">
									<CheckCircle className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
									<div>
										<span className="font-semibold">Local Processing:</span> Most operations happen
										within your secure environment
									</div>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							🎯 Common Security Questions Answered
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							Get answers to the most frequently asked security questions.
						</p>
					</div>

					<div className="mx-auto max-w-4xl space-y-6">
						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">Q: Where is our code sent?</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> Only to AI providers you explicitly configure and approve. Code
								never leaves your environment without explicit consent.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">Q: How are API keys protected?</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> Stored in VSCode's encrypted secret storage, integrated with your OS
								keychain. Never transmitted in plain text.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">Q: Can we audit what data is shared?</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> Yes. Complete audit logs show exactly what data was sent to which
								services, when, and by whom. Plus, our open-source codebase allows your security team to
								verify exactly how data flows through the system.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">Q: What about sensitive files?</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> The .rooignore system automatically prevents access to sensitive
								files (credentials, secrets, proprietary code).
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">Q: Is this SOC 2 compliant?</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> Yes. We have SOC 2 Type I certification with Type II currently in
								observation period. You can monitor our compliance status in real-time at{" "}
								<a
									href="https://trust.delve.co/roo-code"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 hover:underline">
									trust.delve.co/roo-code
								</a>
								.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-3 text-lg font-semibold">
								Q: Can we control which AI providers are used?
							</h3>
							<p className="text-muted-foreground">
								<strong>A:</strong> Yes. You have complete control over which AI providers are enabled
								and can restrict to specific approved services only.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Contact Section */}
			<section id="contact" className="bg-secondary/50 py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-3xl text-center">
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							📞 Questions About Security?
						</h2>
						<p className="mb-8 text-lg text-muted-foreground">
							Get in touch with our team to discuss security features, compliance requirements, or
							schedule a demonstration.
						</p>

						<div className="grid gap-6 md:grid-cols-2">
							<div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
									<Shield className="h-6 w-6 text-blue-500" />
								</div>
								<h3 className="mb-2 text-xl font-bold">Request a Demo</h3>
								<p className="mb-4 text-muted-foreground">
									See our enterprise security features in action with a personalized demonstration.
								</p>
								<ContactForm formType="demo" buttonText="Request Demo" buttonClassName="w-full" />
							</div>

							<div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
									<Phone className="h-6 w-6 text-blue-500" />
								</div>
								<h3 className="mb-2 text-xl font-bold">Contact Our Team</h3>
								<p className="mb-4 text-muted-foreground">
									Reach out to discuss security requirements or technical questions.
								</p>
								<div className="space-y-2">
									<div>
										<a href="mailto:support@roocode.com" className="text-blue-500 hover:underline">
											support@roocode.com
										</a>
									</div>
									<div className="text-sm text-muted-foreground">
										We'll connect you with the right team member
									</div>
								</div>
							</div>
						</div>

						<div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
							<h3 className="mb-4 text-xl font-bold">Why Choose Roo Code Security?</h3>
							<div className="grid gap-4 md:grid-cols-3">
								<div className="text-center">
									<div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
										✓
									</div>
									<div className="text-sm">
										<div className="font-semibold">Open Source Transparency</div>
										<div className="text-muted-foreground">
											Verify our security claims by reviewing the code
										</div>
									</div>
								</div>
								<div className="text-center">
									<div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
										✓
									</div>
									<div className="text-sm">
										<div className="font-semibold">Enterprise-Grade Security</div>
										<div className="text-muted-foreground">
											SOC 2 certified with comprehensive compliance
										</div>
									</div>
								</div>
								<div className="text-center">
									<div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
										✓
									</div>
									<div className="text-sm">
										<div className="font-semibold">Developer-Friendly</div>
										<div className="text-muted-foreground">
											Security without compromising productivity
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
