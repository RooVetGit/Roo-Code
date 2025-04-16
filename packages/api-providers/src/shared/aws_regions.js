/**
 * AWS Region information mapping
 * Maps region prefixes to their full region IDs and descriptions
 */
export const AMAZON_BEDROCK_REGION_INFO = {
	/*
	 * This JSON generated by AWS's AI assistant - Amazon Q on March 29, 2025
	 *
	 *  - Africa (Cape Town) region does not appear to support Amazon Bedrock at this time.
	 *  - Some Asia Pacific regions, such as Asia Pacific (Hong Kong) and Asia Pacific (Jakarta), are not listed among the supported regions for Bedrock services.
	 *  - Middle East regions, including Middle East (Bahrain) and Middle East (UAE), are not mentioned in the list of supported regions for Bedrock. [3]
	 *  - China regions (Beijing and Ningxia) are not listed as supported for Amazon Bedrock.
	 *  - Some newer or specialized AWS regions may not have Bedrock support yet.
	 */
	"us.": { regionId: "us-east-1", description: "US East (N. Virginia)", pattern: "us-", multiRegion: true },
	"use.": { regionId: "us-east-1", description: "US East (N. Virginia)" },
	"use1.": { regionId: "us-east-1", description: "US East (N. Virginia)" },
	"use2.": { regionId: "us-east-2", description: "US East (Ohio)" },
	"usw.": { regionId: "us-west-2", description: "US West (Oregon)" },
	"usw2.": { regionId: "us-west-2", description: "US West (Oregon)" },
	"ug.": {
		regionId: "us-gov-west-1",
		description: "AWS GovCloud (US-West)",
		pattern: "us-gov-",
		multiRegion: true,
	},
	"uge1.": { regionId: "us-gov-east-1", description: "AWS GovCloud (US-East)" },
	"ugw1.": { regionId: "us-gov-west-1", description: "AWS GovCloud (US-West)" },
	"eu.": { regionId: "eu-west-1", description: "Europe (Ireland)", pattern: "eu-", multiRegion: true },
	"euw1.": { regionId: "eu-west-1", description: "Europe (Ireland)" },
	"euw2.": { regionId: "eu-west-2", description: "Europe (London)" },
	"euw3.": { regionId: "eu-west-3", description: "Europe (Paris)" },
	"euc1.": { regionId: "eu-central-1", description: "Europe (Frankfurt)" },
	"eun1.": { regionId: "eu-north-1", description: "Europe (Stockholm)" },
	"eus1.": { regionId: "eu-south-1", description: "Europe (Milan)" },
	"euz1.": { regionId: "eu-central-2", description: "Europe (Zurich)" },
	"ap.": {
		regionId: "ap-southeast-1",
		description: "Asia Pacific (Singapore)",
		pattern: "ap-",
		multiRegion: true,
	},
	"ape1.": { regionId: "ap-east-1", description: "Asia Pacific (Hong Kong)" },
	"apne1.": { regionId: "ap-northeast-1", description: "Asia Pacific (Tokyo)" },
	"apne2.": { regionId: "ap-northeast-2", description: "Asia Pacific (Seoul)" },
	"apne3.": { regionId: "ap-northeast-3", description: "Asia Pacific (Osaka)" },
	"aps1.": { regionId: "ap-south-1", description: "Asia Pacific (Mumbai)" },
	"apse1.": { regionId: "ap-southeast-1", description: "Asia Pacific (Singapore)" },
	"apse2.": { regionId: "ap-southeast-2", description: "Asia Pacific (Sydney)" },
	"ca.": { regionId: "ca-central-1", description: "Canada (Central)", pattern: "ca-", multiRegion: true },
	"cac1.": { regionId: "ca-central-1", description: "Canada (Central)" },
	"sa.": { regionId: "sa-east-1", description: "South America (São Paulo)", pattern: "sa-", multiRegion: true },
	"sae1.": { regionId: "sa-east-1", description: "South America (São Paulo)" },
	//these are not official - they weren't generated by Amazon Q nor were found in
	//the AWS documentation but another roo contributor found apac. was needed so I've
	//added the pattern of the other geo zones
	"apac.": { regionId: "ap-southeast-1", description: "Default APAC region", pattern: "ap-", multiRegion: true },
	"emea.": { regionId: "eu-west-1", description: "Default EMEA region", pattern: "eu-", multiRegion: true },
	"amer.": { regionId: "us-east-1", description: "Default Americas region", pattern: "us-", multiRegion: true },
}
// Extract unique region IDs from REGION_INFO and create the AWS_REGIONS array
export const AWS_REGIONS = Object.values(AMAZON_BEDROCK_REGION_INFO)
	// Extract all region IDs
	.map((info) => ({ value: info.regionId, label: info.regionId }))
	// Filter to unique region IDs (remove duplicates)
	.filter((region, index, self) => index === self.findIndex((r) => r.value === region.value))
	// Sort alphabetically by region ID
	.sort((a, b) => a.value.localeCompare(b.value))
//# sourceMappingURL=aws_regions.js.map
