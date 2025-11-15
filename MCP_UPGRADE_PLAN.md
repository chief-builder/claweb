# MCP Specification Upgrade Plan

This document outlines the plan to upgrade our reference implementation from the current state (based on 2025-03-26) to the latest specification versions: 2025-06-18 and the upcoming 2025-11-25 release.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [2025-06-18 Specification Changes](#2025-06-18-specification-changes)
3. [Upgrade Plan for 2025-06-18](#upgrade-plan-for-2025-06-18)
4. [2025-11-25 Upcoming Changes](#2025-11-25-upcoming-changes)
5. [Roadmap for 2025-11-25](#roadmap-for-2025-11-25)
6. [Implementation Timeline](#implementation-timeline)

---

## Current State Analysis

### What We Have Now

Our current implementation (based on 2025-03-26 spec) includes:

✅ **Core Protocol**
- JSON-RPC 2.0 messaging
- Stdio transport
- Client-server architecture
- Capability negotiation

✅ **Server Features**
- Tools (calculator, echo, get_current_time)
- Resources (config, status)
- Prompts (code_review)

✅ **Client Features**
- Tool discovery and invocation
- Resource reading
- Basic error handling

✅ **Agents**
- Simple rule-based agent
- Intelligent agent with Claude Haiku

### What We're Missing (2025-06-18 features)

❌ **Structured Tool Output**
❌ **Elicitation Support**
❌ **Resource Links in Tool Results**
❌ **OAuth/Authorization with RFC 8707**
❌ **MCP-Protocol-Version Header (HTTP)**
❌ **Enhanced Security Best Practices**
❌ **Metadata Fields (_meta)**
❌ **CompletionRequest Context Field**
❌ **Title/Display Name Support**

---

## 2025-06-18 Specification Changes

### 1. Structured Tool Output ⭐

**What Changed:**
- Tools can now return structured JSON in `structuredContent` field
- Optional `outputSchema` for validation
- Backward compatibility via TextContent serialization

**Benefits:**
- Type-safe tool results
- Better validation
- Easier parsing for LLMs

**Example:**
```typescript
// Before (2025-03-26)
{
  content: [{
    type: "text",
    text: JSON.stringify({ result: 42 })
  }]
}

// After (2025-06-18)
{
  content: [{
    type: "text",
    text: JSON.stringify({ result: 42 })
  }],
  structuredContent: {
    result: 42,
    unit: "integer",
    operation: "multiply"
  }
}
```

### 2. Elicitation 🔄

**What Changed:**
- Servers can now request additional information from users
- Multi-turn conversations during tool execution
- New `elicit` capability

**Benefits:**
- Handle missing/ambiguous information gracefully
- Interactive tool execution
- Better user experience

**Example Flow:**
```
1. Client: Call tool "book_flight"
2. Server: Missing departure city → Elicit
3. User: Provides "San Francisco"
4. Server: Continues with booking
```

### 3. Resource Links 🔗

**What Changed:**
- New `resource_link` content type
- Tools can point to resources instead of inlining
- Reduces payload size for large files

**Benefits:**
- Better performance
- Avoid token limits
- Lazy loading of content

**Example:**
```typescript
{
  content: [{
    type: "resource",
    resource: {
      uri: "file:///path/to/large/document.pdf",
      mimeType: "application/pdf"
    }
  }]
}
```

### 4. OAuth & Security (RFC 8707) 🔒

**What Changed:**
- MCP servers are now OAuth Resource Servers
- Clients MUST implement Resource Indicators (RFC 8707)
- Protected resource metadata
- Token scoping to specific servers

**Benefits:**
- Prevents token theft
- Prevents phishing attacks
- Proper authorization server discovery

**Security Model:**
```
Client → Authorization Server: Request token for specific MCP server
         (with resource parameter)
Client → MCP Server: Use token (scoped to this server only)
```

### 5. Protocol Version Header 📋

**What Changed:**
- HTTP transport requires `MCP-Protocol-Version` header
- Must specify negotiated version in all requests

**Example:**
```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2025-06-18
Content-Type: application/json
```

### 6. Schema Enhancements 📝

**What Changed:**
- `_meta` field added to more types
- `context` field in `CompletionRequest`
- `title` field for display names (separate from `name`)

**Example:**
```typescript
{
  name: "user_profile",           // Programmatic ID
  title: "User Profile Settings", // Display name
  _meta: {
    lastModified: "2025-06-18T10:00:00Z",
    version: "1.2.0"
  }
}
```

### 7. Removed Features ⚠️

**Breaking Changes:**
- ❌ JSON-RPC batching no longer supported
- Must send individual requests

---

## Upgrade Plan for 2025-06-18

### Phase 1: Non-Breaking Enhancements (Week 1)

#### 1.1 Add Structured Tool Output

**Files to Modify:**
- `src/server/tools/*.ts` - All tool implementations
- `src/server/index.ts` - Tool registration

**Changes:**
```typescript
// Update calculator.ts
export function calculatorTool(args: unknown) {
  // ... existing logic ...

  const resultData = {
    operation,
    a,
    b,
    result,
    expression: `${a} ${symbol} ${b} = ${result}`
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(resultData, null, 2)
    }],
    // NEW: Structured output
    structuredContent: resultData
  };
}
```

**Tool Schema Updates:**
```typescript
{
  name: 'calculator',
  description: '...',
  inputSchema: { ... },
  // NEW: Output schema
  outputSchema: {
    type: 'object',
    properties: {
      operation: { type: 'string' },
      a: { type: 'number' },
      b: { type: 'number' },
      result: { type: 'number' },
      expression: { type: 'string' }
    },
    required: ['result']
  }
}
```

#### 1.2 Add Display Names (title field)

**Files to Modify:**
- `src/server/index.ts` - All tool/resource registrations

**Changes:**
```typescript
// Tools list
{
  name: 'calculator',              // Programmatic
  title: 'Calculator',             // NEW: Display
  description: '...'
}

// Resources list
{
  name: 'Server Configuration',    // Keep as display name
  uri: 'config://server',
  title: 'Server Configuration',   // NEW: Explicit title
  _meta: {                         // NEW: Metadata
    version: '1.0.0'
  }
}
```

#### 1.3 Add Metadata Fields

**Files to Modify:**
- `src/server/index.ts`
- `src/server/resources/config.ts`

**Changes:**
```typescript
// Add _meta to responses
{
  contents: [{
    uri: 'config://server',
    text: '...',
    _meta: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    }
  }]
}
```

### Phase 2: Resource Links Support (Week 1)

#### 2.1 Add Resource Link Content Type

**New File:** `src/server/types/resource-link.ts`

```typescript
export interface ResourceLink {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    _meta?: Record<string, unknown>;
  };
}
```

#### 2.2 Update Tool Results to Support Resource Links

**Example Tool:**
```typescript
// New tool: read_file
export function readFileTool(args: unknown) {
  const { path } = args as { path: string };

  // For large files, return resource link instead of content
  if (fileSizeBytes > 1000000) {
    return {
      content: [{
        type: 'resource',
        resource: {
          uri: `file://${path}`,
          mimeType: getMimeType(path)
        }
      }]
    };
  }

  // For small files, inline the content
  return {
    content: [{
      type: 'text',
      text: readFileSync(path, 'utf-8')
    }]
  };
}
```

### Phase 3: Elicitation Support (Week 2)

#### 3.1 Add Elicitation Types

**New File:** `src/server/types/elicitation.ts`

```typescript
export interface ElicitationRequest {
  type: 'elicit';
  prompt: string;
  schema?: {
    type: string;
    properties?: Record<string, unknown>;
  };
}

export interface ElicitationResponse {
  type: 'elicitation_response';
  data: unknown;
}
```

#### 3.2 Implement Elicitation in Server

**Update:** `src/server/index.ts`

```typescript
// Add elicitation capability
const server = new Server(
  { name: 'mcp-reference-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      elicitation: {}  // NEW
    }
  }
);
```

#### 3.3 Create Interactive Tool Example

**New File:** `src/server/tools/interactive-booking.ts`

```typescript
export async function bookingTool(args: unknown, elicit: ElicitFunction) {
  const { destination } = args as { destination?: string };

  // If destination missing, elicit from user
  if (!destination) {
    const response = await elicit({
      prompt: 'Please specify your destination city',
      schema: {
        type: 'object',
        properties: {
          destination: { type: 'string' }
        }
      }
    });

    // Continue with booking...
  }

  return { /* booking result */ };
}
```

#### 3.4 Update Intelligent Agent for Elicitation

**Update:** `src/agent/intelligent-agent.ts`

- Handle elicitation requests from tools
- Pass to Claude or prompt user directly
- Return elicitation responses

### Phase 4: OAuth & Authorization (Week 3)

#### 4.1 Add Authorization Support

**New File:** `src/server/auth/oauth.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export function setupOAuth(server: Server) {
  // Protected resource metadata
  server.setResourceMetadata({
    authorizationServer: 'https://auth.example.com',
    scopes: ['read', 'write', 'execute']
  });

  // Token validation
  server.setAuthenticationHandler(async (token) => {
    // Validate token
    // Check audience matches this server
    // Verify scopes
  });
}
```

#### 4.2 Update Client for RFC 8707

**Update:** `src/client/index.ts`

```typescript
// When requesting OAuth token, include resource parameter
const tokenResponse = await fetch(authServer + '/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    resource: 'https://mcp-server.example.com',  // RFC 8707
    client_id: clientId
  })
});
```

#### 4.3 Add Security Documentation

**New File:** `SECURITY.md`

- OAuth flow diagrams
- Security best practices
- Token management
- Resource Indicators explanation

### Phase 5: HTTP Transport Updates (Week 3)

#### 5.1 Add MCP-Protocol-Version Header

**New File:** `src/server/transports/http.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';

export function setupHTTPTransport(server: Server) {
  const app = express();

  app.post('/mcp', async (req, res) => {
    // Validate protocol version header
    const protocolVersion = req.headers['mcp-protocol-version'];
    if (protocolVersion !== '2025-06-18') {
      return res.status(400).json({
        error: 'Unsupported protocol version'
      });
    }

    // Handle request
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
```

#### 5.2 Update Client HTTP Transport

**New File:** `src/client/transports/http.ts`

```typescript
export class HTTPClientTransport {
  async send(message: JSONRPCMessage) {
    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18'  // Required
      },
      body: JSON.stringify(message)
    });

    return response.json();
  }
}
```

### Phase 6: Remove Deprecated Features (Week 4)

#### 6.1 Remove JSON-RPC Batching

**Check all files for batch support:**
- Remove any batch request handling
- Update documentation
- Add migration guide

### Phase 7: Testing & Validation (Week 4)

#### 7.1 Update Tests

**Update:** `tests/integration.test.ts`

```typescript
describe('2025-06-18 Features', () => {
  it('should return structured tool output', async () => {
    const result = await client.callTool('calculator', {
      operation: 'add',
      a: 5,
      b: 3
    });

    expect(result.structuredContent).toEqual({
      operation: 'add',
      a: 5,
      b: 3,
      result: 8,
      expression: '5 + 3 = 8'
    });
  });

  it('should support resource links', async () => {
    // Test resource link content
  });

  it('should handle elicitation', async () => {
    // Test elicitation flow
  });
});
```

#### 7.2 Add Compliance Tests

**New File:** `tests/compliance-2025-06-18.test.ts`

- Validate structured output schemas
- Test OAuth flows
- Verify protocol version headers
- Check metadata fields

#### 7.3 Update Documentation

**Files to Update:**
- `README.md` - Update spec version
- `QUICKSTART.md` - Add new features
- Add `MIGRATION-2025-06-18.md` guide

---

## 2025-11-25 Upcoming Changes

### Release Timeline

- **Release Candidate:** November 11, 2025
- **Final Release:** November 25, 2025
- **Validation Window:** 14 days for testing

### Expected Features (Based on Roadmap)

#### 1. Sampling Feature 🎯

**What's Coming:**
- Servers can request LLM completions
- AI-to-AI collaboration
- Recursive agent workflows

**Potential Use Cases:**
```
MCP Server → Request completion from LLM
LLM → Calls other MCP tools
MCP Server → Receives enriched response
```

**Example:**
```typescript
// Server requests completion
const completion = await requestSampling({
  prompt: "Summarize these database results",
  context: queryResults,
  tools: ['text_analyzer', 'keyword_extractor']
});
```

#### 2. Multimodal Support 🎨

**What's Coming:**
- Image context support
- Audio/video handling
- Rich media in tools and resources

**Example:**
```typescript
// Tool returns image
{
  content: [{
    type: 'image',
    data: base64ImageData,
    mimeType: 'image/png',
    _meta: {
      width: 1920,
      height: 1080,
      generated: true
    }
  }]
}

// Resource with video
{
  uri: 'media://training-video',
  mimeType: 'video/mp4',
  content: videoBuffer
}
```

#### 3. Enhanced Agentic Workflows 🤖

**What's Coming:**
- Task decomposition
- Multi-agent collaboration
- Workflow orchestration primitives

**Example:**
```typescript
// Workflow definition
{
  type: 'workflow',
  steps: [
    { agent: 'research', tool: 'web_search' },
    { agent: 'analysis', tool: 'data_analyzer' },
    { agent: 'writer', tool: 'content_generator' }
  ],
  coordination: 'sequential'
}
```

#### 4. Registry & Discovery 📚

**What's Coming:**
- MCP Registry v0.1 API stabilization
- Server discovery mechanisms
- Tool marketplace integration

**Example:**
```typescript
// Discover servers from registry
const servers = await registry.discover({
  category: 'data-processing',
  capabilities: ['tools', 'resources'],
  verified: true
});
```

#### 5. Compliance Test Suites ✅

**What's Coming:**
- Automated validation tools
- Reference implementations
- Certification program

#### 6. Potential Breaking Changes ⚠️

**Watch Out For:**
- Transport changes
- Message format updates
- Capability negotiation changes
- Deprecated features removal

---

## Roadmap for 2025-11-25

### Preparation Phase (September - November 2025)

#### Step 1: Monitor Release Candidate (Nov 11)

**Action Items:**
- Download RC specification
- Review changelog
- Identify breaking changes
- Test with RC SDK versions

#### Step 2: Early Testing (Nov 11-25)

**Action Items:**
- Install RC SDKs: `@modelcontextprotocol/sdk@rc`
- Run compliance tests
- Report bugs to MCP team
- Update code for breaking changes

#### Step 3: Documentation Review

**Action Items:**
- Read migration guides
- Review security updates
- Study new patterns
- Check authentication changes

### Implementation Phase (November 25 - December 2025)

#### Week 1: Sampling Support

**Files to Create:**
- `src/server/sampling/index.ts`
- `src/server/sampling/request-handler.ts`
- `src/agent/sampling-agent.ts`

**Implementation:**
```typescript
// Server-side sampling
server.setSamplingHandler(async (request) => {
  // Request completion from client's LLM
  return {
    completion: '...',
    usage: { ... }
  };
});

// Client provides LLM
client.onSamplingRequest(async (request) => {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: request.prompt }]
  });

  return response;
});
```

#### Week 2: Multimodal Support

**Files to Create:**
- `src/server/tools/image-generator.ts`
- `src/server/tools/audio-processor.ts`
- `src/server/resources/media.ts`

**Implementation:**
```typescript
// Image generation tool
export function generateImageTool(args: unknown) {
  const { prompt } = args as { prompt: string };

  const imageData = await generateImage(prompt);

  return {
    content: [{
      type: 'image',
      data: imageData.base64,
      mimeType: 'image/png',
      _meta: {
        model: 'stable-diffusion-3',
        width: imageData.width,
        height: imageData.height
      }
    }]
  };
}
```

#### Week 3: Agentic Workflows

**Files to Create:**
- `src/agent/workflow-orchestrator.ts`
- `src/agent/multi-agent-coordinator.ts`

**Implementation:**
```typescript
// Workflow orchestration
export class WorkflowOrchestrator {
  async executeWorkflow(definition: WorkflowDef) {
    const results = [];

    for (const step of definition.steps) {
      const agent = this.agents[step.agent];
      const result = await agent.execute(step.tool, step.args);
      results.push(result);

      // Pass results to next step
      if (step.next) {
        step.next.args = { ...step.next.args, previous: result };
      }
    }

    return results;
  }
}
```

#### Week 4: Registry Integration

**Files to Create:**
- `src/client/registry.ts`
- `src/examples/registry-discovery.ts`

**Implementation:**
```typescript
// Registry client
export class RegistryClient {
  async discover(filters: DiscoveryFilters) {
    const response = await fetch('https://registry.modelcontextprotocol.io/v0.1/servers', {
      method: 'POST',
      body: JSON.stringify(filters)
    });

    return response.json();
  }

  async installServer(serverId: string) {
    // Download and configure server
  }
}
```

### Testing & Documentation Phase (January 2026)

#### Week 1: Comprehensive Testing

**Test Coverage:**
- Sampling workflows
- Multimodal content handling
- Multi-agent coordination
- Registry discovery
- Backward compatibility

#### Week 2: Documentation

**Documents to Create/Update:**
- `MIGRATION-2025-11-25.md`
- `SAMPLING.md` - Sampling guide
- `MULTIMODAL.md` - Media handling
- `WORKFLOWS.md` - Agentic workflows
- Update all existing docs

#### Week 3: Examples

**New Examples:**
- `examples/sampling-workflow.ts`
- `examples/image-processing-agent.ts`
- `examples/multi-agent-system.ts`
- `examples/registry-integration.ts`

---

## Implementation Timeline

### 2025-06-18 Upgrade

| Phase | Duration | Completion |
|-------|----------|------------|
| Phase 1: Non-Breaking | 1 week | Week 1 |
| Phase 2: Resource Links | 1 week | Week 1 |
| Phase 3: Elicitation | 1 week | Week 2 |
| Phase 4: OAuth | 1 week | Week 3 |
| Phase 5: HTTP Updates | 1 week | Week 3 |
| Phase 6: Deprecations | 1 week | Week 4 |
| Phase 7: Testing | 1 week | Week 4 |

**Total Time:** 4 weeks

### 2025-11-25 Upgrade

| Phase | Duration | Completion |
|-------|----------|------------|
| Preparation | 2 weeks | Nov 11-25 |
| Implementation | 4 weeks | Dec 2025 |
| Testing & Docs | 3 weeks | Jan 2026 |

**Total Time:** 9 weeks (from RC to production-ready)

---

## Migration Strategy

### Backward Compatibility

During migration, we'll maintain two branches:

1. **`main`** - Current stable (2025-03-26 based)
2. **`spec-2025-06-18`** - New specification
3. **`spec-2025-11-25`** - Future specification (when available)

### Version Tags

```bash
# Current
git tag v1.0.0-spec-2025-03-26

# After 2025-06-18 upgrade
git tag v2.0.0-spec-2025-06-18

# After 2025-11-25 upgrade
git tag v3.0.0-spec-2025-11-25
```

### Dependency Management

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",  // 2025-03-26
    // Will update to:
    "@modelcontextprotocol/sdk": "^2.0.0",  // 2025-06-18
    // Then to:
    "@modelcontextprotocol/sdk": "^3.0.0"   // 2025-11-25
  }
}
```

---

## Success Criteria

### 2025-06-18 Compliance

- ✅ All tools return structured output
- ✅ Elicitation support implemented
- ✅ Resource links functional
- ✅ OAuth/RFC 8707 implemented
- ✅ HTTP headers correct
- ✅ All tests passing
- ✅ Documentation updated

### 2025-11-25 Compliance

- ✅ Sampling feature working
- ✅ Multimodal content supported
- ✅ Agentic workflows functional
- ✅ Registry integration complete
- ✅ All compliance tests passing
- ✅ Migration guide published

---

## Resources

### Official Documentation

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP Roadmap](https://modelcontextprotocol.io/development/roadmap)
- [MCP Changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)

### Community Resources

- [MCP GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Discord](https://discord.gg/mcp) (if available)

### Security

- [RFC 8707: Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/security)

---

## Next Steps

1. **Review this plan** with the team
2. **Prioritize features** based on user needs
3. **Set up development branch** for 2025-06-18
4. **Begin Phase 1** implementation
5. **Monitor MCP announcements** for 2025-11-25 RC

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** Planning Phase
