# Alibaba Cloud Ops MCP Server

## Overview

The Alibaba Cloud Ops MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Alibaba Cloud APIs. It enables AI assistants to operate resources on Alibaba Cloud, supporting ECS, Cloud Monitor, OOS, and other widely used cloud products.

## Features

### Supported Services

The MCP server provides comprehensive support for Alibaba Cloud services:

#### ECS (Elastic Compute Service)

- **RunCommand**: Execute commands on instances
- **StartInstances**: Start ECS instances
- **StopInstances**: Stop ECS instances
- **RebootInstances**: Reboot ECS instances
- **DescribeInstances**: View instance details
- **DescribeRegions**: List available regions
- **DescribeZones**: List availability zones
- **DescribeAvailableResource**: Check resource inventory
- **DescribeImages**: View available images
- **DescribeSecurityGroups**: List security groups
- **RunInstances**: Create new instances
- **DeleteInstances**: Delete instances
- **ResetPassword**: Modify instance passwords
- **ReplaceSystemDisk**: Replace operating system

#### VPC (Virtual Private Cloud)

- **DescribeVpcs**: View VPC configurations
- **DescribeVSwitches**: List VSwitches

#### RDS (Relational Database Service)

- **DescribeDBInstances**: List RDS instances
- **StartDBInstances**: Start RDS instances
- **StopDBInstances**: Stop RDS instances
- **RestartDBInstances**: Restart RDS instances

#### OSS (Object Storage Service)

- **ListBuckets**: List storage buckets
- **PutBucket**: Create new buckets
- **DeleteBucket**: Delete buckets
- **ListObjects**: View objects in buckets

#### CloudMonitor

- **GetCpuUsageData**: Monitor CPU usage
- **GetCpuLoadavgData**: Get CPU load averages (1-minute)
- **GetCpuloadavg5mData**: Get CPU load averages (5-minute)
- **GetCpuloadavg15mData**: Get CPU load averages (15-minute)
- **GetMemUsedData**: Monitor memory usage
- **GetMemUsageData**: Get memory utilization
- **GetDiskUsageData**: Monitor disk utilization
- **GetDiskTotalData**: Get total disk capacity
- **GetDiskUsedData**: Get disk usage data

## Prerequisites

Before installing the Alibaba Cloud Ops MCP Server, ensure you have:

1. **Python 3.8 or higher** installed on your system
2. **uv package manager** - Install with:

    ```bash
    # On macOS and Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # On Windows
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    ```

3. **Alibaba Cloud Account** with appropriate permissions
4. **Access Key ID and Secret** from your Alibaba Cloud account

## Installation

### Manual Configuration

Add the following configuration to your MCP settings file:

```json
{
	"mcpServers": {
		"alibaba-cloud-ops-mcp-server": {
			"timeout": 600,
			"command": "uvx",
			"args": ["alibaba-cloud-ops-mcp-server@latest"],
			"env": {
				"ALIBABA_CLOUD_ACCESS_KEY_ID": "Your Access Key ID",
				"ALIBABA_CLOUD_ACCESS_KEY_SECRET": "Your Access Key SECRET"
			}
		}
	}
}
```

### Configuration Options

The server supports several environment variables for configuration:

| Variable                          | Description                                       | Required |
| --------------------------------- | ------------------------------------------------- | -------- |
| `ALIBABA_CLOUD_ACCESS_KEY_ID`     | Your Alibaba Cloud Access Key ID                  | Yes      |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | Your Alibaba Cloud Access Key Secret              | Yes      |
| `ALIBABA_CLOUD_REGION_ID`         | Default region for operations (e.g., cn-hangzhou) | No       |
| `ALIBABA_CLOUD_SECURITY_TOKEN`    | STS Security Token for temporary credentials      | No       |

### Advanced Configuration

For more complex scenarios, you can use additional configuration options:

#### With Custom Region

```json
{
	"mcpServers": {
		"alibaba-cloud-ops-mcp-server": {
			"timeout": 600,
			"command": "uvx",
			"args": ["alibaba-cloud-ops-mcp-server@latest"],
			"env": {
				"ALIBABA_CLOUD_ACCESS_KEY_ID": "Your Access Key ID",
				"ALIBABA_CLOUD_ACCESS_KEY_SECRET": "Your Access Key SECRET",
				"ALIBABA_CLOUD_REGION_ID": "cn-hangzhou"
			}
		}
	}
}
```

#### With STS Token

```json
{
	"mcpServers": {
		"alibaba-cloud-ops-mcp-server": {
			"timeout": 600,
			"command": "uvx",
			"args": ["alibaba-cloud-ops-mcp-server@latest"],
			"env": {
				"ALIBABA_CLOUD_ACCESS_KEY_ID": "Your Access Key ID",
				"ALIBABA_CLOUD_ACCESS_KEY_SECRET": "Your Access Key SECRET",
				"ALIBABA_CLOUD_SECURITY_TOKEN": "Your STS Token",
				"ALIBABA_CLOUD_REGION_ID": "cn-hangzhou"
			}
		}
	}
}
```

## Security Best Practices

1. **Never commit credentials**: Always use environment variables or secure credential stores
2. **Use minimal permissions**: Create IAM policies with only the necessary permissions
3. **Rotate access keys regularly**: Update your access keys periodically
4. **Use STS tokens** for temporary access when possible
5. **Monitor API usage**: Regularly review CloudMonitor logs for unusual activity

## Troubleshooting

### Common Issues

1. **Authentication Errors**

    - Verify your Access Key ID and Secret are correct
    - Check if your credentials have the necessary permissions
    - Ensure your access keys are active in the Alibaba Cloud console

2. **Timeout Issues**

    - Increase the timeout value in the configuration
    - Check your network connectivity to Alibaba Cloud endpoints
    - Verify the selected region is accessible

3. **Permission Denied**
    - Review your IAM policies
    - Ensure the user/role has permissions for the requested operations
    - Check resource-level permissions

## Resources

- [GitHub Repository](https://github.com/aliyun/alibaba-cloud-ops-mcp-server)
- [Alibaba Cloud Documentation](https://www.alibabacloud.com/help)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Alibaba Cloud Console](https://console.alibabacloud.com/)

## Support

For issues or questions:

- Open an issue on the [GitHub repository](https://github.com/aliyun/alibaba-cloud-ops-mcp-server/issues)
- Check the [Alibaba Cloud Community](https://developer.aliyun.com/)
- Review the [MCP documentation](https://modelcontextprotocol.io/)

## License

The Alibaba Cloud Ops MCP Server is open source. Please refer to the [repository](https://github.com/aliyun/alibaba-cloud-ops-mcp-server) for license information.
