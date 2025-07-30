# Organization Default Providers Implementation

This document describes the implementation of the organization default providers feature for Roo Code Cloud.

## Overview

The organization default providers feature allows organizations to define default provider configurations that can be recommended or enforced for their members. This helps standardize provider settings across the organization while still allowing individual customization.

## Implementation Components

### 1. Schema Extensions (`packages/types/src/cloud.ts`)

Added new types and schemas:

- `OrganizationDefaultProviderProfile`: Represents a named provider configuration
- `OrganizationDefaultProviders`: Container for organization provider settings
- Extended `OrganizationSettings` to include `defaultProviders` field

```typescript
export interface OrganizationDefaultProviderProfile {
  id: string
  name: string
  description?: string
  isRecommended?: boolean
  priority?: number
  settings: ProviderSettings
}

export interface OrganizationDefaultProviders {
  enabled?: boolean
  profiles?: OrganizationDefaultProviderProfile[]
  primaryProfileId?: string
  fallbackProfileIds?: string[]
}
```

### 2. UI Components

#### OrganizationDefaultProviders Component
- Main component for managing organization default providers
- Allows creating, editing, and deleting provider profiles
- Supports reordering profiles by priority
- Integrates with existing ApiOptions component for provider configuration

#### Updated ApiOptions Component
- Added support for displaying organization default providers
- New props for organization settings integration
- Conditional rendering of organization defaults section

### 3. Utility Functions (`utils/providerProfileUtils.ts`)

Provides helper functions for:
- Creating and validating provider profiles
- Reordering profiles by priority
- Applying organization defaults to user settings
- Managing primary and fallback profiles

### 4. State Management Hook (`hooks/useOrganizationDefaultProviders.ts`)

Custom hook that provides:
- State management for organization provider settings
- CRUD operations for provider profiles
- Validation and error handling
- Utility functions for profile management

## Key Features

### Provider Profile Management
- **Named Profiles**: Create named provider configurations (e.g., "Primary OpenAI", "Fallback Anthropic")
- **Descriptions**: Add descriptions to help users understand when to use each profile
- **Recommendations**: Mark profiles as recommended for organization members
- **Priority Ordering**: Set priority order for profile selection

### Profile Types
- **Primary Profile**: The main recommended provider configuration
- **Fallback Profiles**: Alternative configurations when primary fails
- **Recommended Profiles**: Profiles marked as organization-recommended

### Integration with Existing Settings
- Seamlessly integrates with existing provider configuration UI
- Respects user's existing provider choices
- Provides visual indicators for organization-recommended providers

## Usage Example

```typescript
// Organization admin configures default providers
const organizationDefaults: OrganizationDefaultProviders = {
  enabled: true,
  profiles: [
    {
      id: "primary-openai",
      name: "Primary OpenAI",
      description: "Main OpenAI configuration for the organization",
      isRecommended: true,
      priority: 1,
      settings: {
        apiProvider: "openai",
        openAiApiKey: "org-api-key",
        openAiModelId: "gpt-4",
        openAiBaseUrl: "https://api.openai.com/v1"
      }
    },
    {
      id: "fallback-anthropic",
      name: "Fallback Anthropic",
      description: "Backup Anthropic configuration",
      isRecommended: false,
      priority: 2,
      settings: {
        apiProvider: "anthropic",
        apiKey: "org-anthropic-key",
        apiModelId: "claude-3-sonnet-20240229"
      }
    }
  ],
  primaryProfileId: "primary-openai",
  fallbackProfileIds: ["fallback-anthropic"]
}

// User's provider settings are enhanced with organization defaults
const userSettings = applyOrganizationDefaults(userProviderSettings, organizationDefaults)
```

## Integration Points

### Settings View Integration
```typescript
<ApiOptions
  // ... existing props
  organizationSettings={organizationSettings}
  onUpdateOrganizationSettings={handleUpdateOrganizationSettings}
  showOrganizationDefaults={isOrganizationAdmin}
/>
```

### Organization Settings Page
The organization default providers component can be integrated into organization settings pages where administrators can manage provider configurations for their organization.

## Benefits

1. **Standardization**: Organizations can standardize provider configurations across teams
2. **Onboarding**: New users get working provider configurations immediately
3. **Fallback Support**: Automatic fallback to alternative providers when primary fails
4. **Flexibility**: Users can still customize their individual settings
5. **Recommendations**: Clear visual indicators for organization-recommended providers

## Security Considerations

- API keys and sensitive configuration should be managed securely
- Organization admins should have appropriate permissions to manage default providers
- User settings should take precedence over organization defaults for security-sensitive fields

## Future Enhancements

1. **Provider Health Monitoring**: Automatic switching to fallback providers based on health checks
2. **Usage Analytics**: Track which providers are most commonly used
3. **Cost Management**: Integration with cost tracking and budgeting features
4. **Template Sharing**: Allow sharing of provider configurations between organizations
5. **Conditional Profiles**: Apply different profiles based on user roles or project types

## Testing

The implementation includes comprehensive tests covering:
- Component rendering and interaction
- State management and validation
- Utility functions and edge cases
- Integration with existing provider system

## Migration

Existing organizations will have the feature disabled by default. Organizations can opt-in by:
1. Enabling the feature in organization settings
2. Creating their first provider profile
3. Setting up primary and fallback configurations as needed

The feature is fully backward compatible and does not affect existing user configurations.