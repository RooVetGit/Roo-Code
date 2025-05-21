# Adding Custom Marketplace Sources

The Marketplace allows you to extend its functionality by adding custom sources. This guide explains how to set up and manage your own Marktplace repositories to access additional components beyond the default offerings.

## Setting up a Marketplace Source Repository

A Marketplace source repository is a Git repository that contains Marketplace items organized in a specific structure. You can create your own repository to host custom packages:

### Repository Requirements

1. **Proper Structure**: The repository must follow the required directory structure
2. **Valid Metadata**: Each package must include properly formatted metadata files
3. **Git Repository**: The source must be a Git repository accessible via HTTPS

### Building your registry repository

#### Start from a sample registry repository

Check the branches of the [**rm-samples**](https://github.com/NamesMT/rm-samples) repository here.

#### Creating a New Repository

1. Create a new repository on GitHub, GitLab, or another Git hosting service
2. Initialize the repository with a README.md file
3. Clone the repository to your local machine:

```bash
git clone https://github.com/your-username/your-registry-repo.git
cd your-registry-repo
```

4. Create the basic registry structure:

```bash
mkdir -p packages modes mcps prompts
touch metadata.en.yml
```

5. Add repository metadata to `metadata.en.yml`:

```yaml
name: "Your Repository Name"
description: "A collection of custom packages for Roo Code"
version: "1.0.0"
```

6. Commit and push the initial structure:

```bash
git add .
git commit -m "Initialize package repository structure"
git push origin main
```

## Adding Sources to Roo Code

Once you have a properly structured source repository, you can add it to your Roo Code Marketplace as a source:

### Default Package Source

Roo Code comes with a default package source:

- URL: `https://github.com/RooVetGit/Roo-Code-Marketplace`
- This source is enabled by default, and anytime all sources have been deleted.

### Adding a New Source

1. Open VS Code with the Roo Code extension
2. Navigate to the Marketplace
3. Switch to the "Sources" tab
4. Click the "Add Source" button
5. Enter the repository URL:
    - Format: `https://github.com/username/repository.git`
    - Example: `https://github.com/your-username/your-registry-repo.git`
6. Click "Add" to save the source

### Managing Sources

The "Sources" tab provides several options for managing your registry sources:

1. **Remove**: Delete a source from your configuration
2. **Refresh**: Update the item list from a source - this is forced git clone/pull to override local caching of data

### Source Caching and Refreshing

Marketplace sources are cached to improve performance:

- **Cache Duration**: Sources are cached for 1 hour (3600000 ms)
- **Force Refresh**: To force an immediate refresh of a source:
    1. Go to the "Sources" tab
    2. Click the "Refresh" button next to the source you want to update
    3. This will bypass the cache and fetch the latest data from the repository

### Troubleshooting Sources

If a source isn't loading properly:

1. Check that the repository URL is correct
2. Ensure the repository follows the required structure
3. Look for error messages in the Marketplace interface
4. Try refreshing the sources list
5. Disable and re-enable the source

## Creating Private Sources

For team or organization use, you might want to create private sources:

### Private Repository Setup

1. Create a private repository on your Git hosting service
2. Follow the same structure requirements as public repositories
3. Set up appropriate access controls for your team members

### Authentication Options

To access private repositories, you may need to:

1. Configure Git credentials on your system
2. Use a personal access token with appropriate permissions
3. Set up SSH keys for authentication

### Organization Best Practices

For teams and organizations:

1. Designate maintainers responsible for the source
2. Establish quality standards for contributed items and packages
3. Create a review process for new additions
4. Document usage guidelines for team members
5. Consider implementing versioning for your items and packages

## Using Multiple Sources

The Marketplace supports multiple sources simultaneously:

### Benefits of Multiple Sources

- Access components from different providers
- Separate internal and external components
- Test new work before contributing them to the main repository
- Create specialized sources for different projects or teams

### Source Management Strategy

1. Keep the default source enabled for core components
2. Add specialized sources for specific needs
3. Create a personal source for testing and development
4. Refresh sources after you've pushed changes to them to get the latest items

---

**Previous**: [Adding Packages](./05-adding-packages.md) | **Next**: [Marketplace Architecture](../implementation/01-architecture.md)
