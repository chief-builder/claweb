/**
 * RFC 8707: Resource Indicators for OAuth 2.0
 *
 * Allows clients to request tokens that are scoped to specific resource servers
 * Improves security by preventing token misuse across different resources
 */

/**
 * Resource indicator
 */
export interface ResourceIndicator {
  uri: string; // Resource server URI
  scopes?: string[]; // Scopes valid for this resource
  description?: string; // Human-readable description
}

/**
 * Token request with resource indicators
 */
export interface ResourceIndicatorRequest {
  resource?: string | string[]; // Resource indicators (URIs)
  scope?: string; // Requested scopes
}

/**
 * Token response with resource indicators
 */
export interface ResourceIndicatorResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  resource?: string | string[]; // Resource indicators for which token is valid
}

/**
 * Resource Indicator Service
 */
export class ResourceIndicatorService {
  private registeredResources: Map<string, ResourceIndicator>;

  constructor() {
    this.registeredResources = new Map();
    this.registerDefaultResources();
  }

  /**
   * Register default MCP resources
   */
  private registerDefaultResources(): void {
    // MCP Tools resource
    this.registerResource({
      uri: 'mcp://tools',
      scopes: ['mcp.tools.read', 'mcp.tools.execute'],
      description: 'MCP Tools API',
    });

    // MCP Resources
    this.registerResource({
      uri: 'mcp://resources',
      scopes: ['mcp.resources.read'],
      description: 'MCP Resources API',
    });

    // MCP Prompts
    this.registerResource({
      uri: 'mcp://prompts',
      scopes: ['mcp.prompts.read'],
      description: 'MCP Prompts API',
    });

    // MCP Admin
    this.registerResource({
      uri: 'mcp://admin',
      scopes: ['mcp.admin'],
      description: 'MCP Administrative API',
    });
  }

  /**
   * Register a resource
   */
  registerResource(resource: ResourceIndicator): void {
    this.validateResourceUri(resource.uri);
    this.registeredResources.set(resource.uri, resource);
  }

  /**
   * Unregister a resource
   */
  unregisterResource(uri: string): void {
    this.registeredResources.delete(uri);
  }

  /**
   * Get registered resource
   */
  getResource(uri: string): ResourceIndicator | undefined {
    return this.registeredResources.get(uri);
  }

  /**
   * Get all registered resources
   */
  getAllResources(): ResourceIndicator[] {
    return Array.from(this.registeredResources.values());
  }

  /**
   * Validate resource URI format
   */
  private validateResourceUri(uri: string): void {
    try {
      const url = new URL(uri);

      // Must be absolute URI
      if (!url.protocol || !url.hostname) {
        throw new Error('Resource indicator must be an absolute URI');
      }
    } catch (error) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
  }

  /**
   * Validate resource indicators in token request
   */
  validateResourceRequest(request: ResourceIndicatorRequest): {
    valid: boolean;
    errors?: string[];
    resources?: string[];
  } {
    const errors: string[] = [];
    const resources: string[] = [];

    if (!request.resource) {
      // No resource indicators - valid (token for all resources)
      return { valid: true, resources: [] };
    }

    // Normalize to array
    const requestedResources = Array.isArray(request.resource)
      ? request.resource
      : [request.resource];

    for (const resourceUri of requestedResources) {
      // Validate URI format
      try {
        this.validateResourceUri(resourceUri);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Invalid resource URI');
        continue;
      }

      // Check if resource is registered
      const resource = this.getResource(resourceUri);
      if (!resource) {
        errors.push(`Unknown resource: ${resourceUri}`);
        continue;
      }

      // Validate scopes for this resource
      if (request.scope && resource.scopes) {
        const requestedScopes = request.scope.split(' ');
        const invalidScopes = requestedScopes.filter(
          (scope) => !resource.scopes?.includes(scope)
        );

        if (invalidScopes.length > 0) {
          errors.push(
            `Invalid scopes for resource ${resourceUri}: ${invalidScopes.join(', ')}`
          );
          continue;
        }
      }

      resources.push(resourceUri);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      resources,
    };
  }

  /**
   * Check if token is valid for resource
   */
  isTokenValidForResource(
    tokenResources: string | string[] | undefined,
    requestedResource: string
  ): boolean {
    // If token has no resource indicators, it's valid for all resources
    if (!tokenResources) {
      return true;
    }

    // Normalize to array
    const resources = Array.isArray(tokenResources) ? tokenResources : [tokenResources];

    // Check if requested resource is in token's resource list
    return resources.includes(requestedResource);
  }

  /**
   * Get scopes valid for a resource
   */
  getValidScopes(resourceUri: string): string[] {
    const resource = this.getResource(resourceUri);
    return resource?.scopes || [];
  }

  /**
   * Filter scopes by resource
   */
  filterScopesByResource(scopes: string[], resourceUri: string): string[] {
    const validScopes = this.getValidScopes(resourceUri);
    if (validScopes.length === 0) {
      // No scope restrictions for this resource
      return scopes;
    }

    return scopes.filter((scope) => validScopes.includes(scope));
  }

  /**
   * Build resource metadata for discovery
   */
  getResourceMetadata(): {
    resources: Array<{
      uri: string;
      scopes?: string[];
      description?: string;
    }>;
  } {
    return {
      resources: this.getAllResources().map((r) => ({
        uri: r.uri,
        scopes: r.scopes,
        description: r.description,
      })),
    };
  }
}

/**
 * Default resource indicator service instance
 */
let defaultResourceService: ResourceIndicatorService | null = null;

/**
 * Get or create default resource indicator service
 */
export function getResourceIndicatorService(): ResourceIndicatorService {
  if (!defaultResourceService) {
    defaultResourceService = new ResourceIndicatorService();
  }
  return defaultResourceService;
}
