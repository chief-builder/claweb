# MCP Specification Versions - Quick Reference

Quick reference guide for MCP specification versions and key differences.

## Version Timeline

```
2025-03-26  →  2025-06-18  →  2025-11-25 (upcoming)
 (current)      (latest)        (future)
```

---

## Version 2025-03-26 (Current Implementation)

**Release Date:** March 26, 2025

**Key Features:**
- ✅ JSON-RPC 2.0 messaging
- ✅ Stdio & HTTP transports
- ✅ Tools (functions AI can call)
- ✅ Resources (data providers)
- ✅ Prompts (templates)
- ✅ Basic capability negotiation
- ✅ JSON-RPC batching

**Our Implementation Status:**
- ✅ MCP Server with tools & resources
- ✅ MCP Client with discovery
- ✅ Simple rule-based agent
- ✅ Intelligent agent with Claude Haiku
- ✅ Full stdio transport

---

## Version 2025-06-18 (Latest Stable)

**Release Date:** June 18, 2025

### 🆕 New Features

#### 1. Structured Tool Output ⭐
```typescript
// Before: Only text
{ content: [{ type: "text", text: JSON.stringify(result) }] }

// Now: Structured + text
{
  content: [{ type: "text", text: "..." }],
  structuredContent: { result: 42, unit: "integer" },
  outputSchema: { type: "object", properties: {...} }
}
```

#### 2. Elicitation 🔄
```typescript
// Server can ask user for more info during tool execution
await elicit({
  prompt: "What city?",
  schema: { type: "string" }
});
```

#### 3. Resource Links 🔗
```typescript
// Point to resources instead of inlining
{
  type: "resource",
  resource: {
    uri: "file:///large-file.pdf",
    mimeType: "application/pdf"
  }
}
```

#### 4. OAuth Security (RFC 8707) 🔒
- Resource Indicators prevent token theft
- MCP servers = OAuth Resource Servers
- Clients MUST specify target server in token requests

#### 5. Protocol Version Header 📋
```http
MCP-Protocol-Version: 2025-06-18
```

#### 6. Enhanced Metadata 📝
- `_meta` field on more types
- `title` for display names
- `context` in CompletionRequest

### ❌ Removed Features
- JSON-RPC batching (breaking change)

### 🔧 Migration Effort
**Estimated Time:** 4 weeks
**Breaking Changes:** Minimal (mainly batching removal)
**Backward Compatibility:** High (most features are additions)

---

## Version 2025-11-25 (Upcoming)

**Release Date:** November 25, 2025
**RC Available:** November 11, 2025

### 🚀 Expected Features

#### 1. Sampling 🎯
```typescript
// Servers can request LLM completions
const completion = await requestSampling({
  prompt: "Analyze this data",
  tools: ['analyzer', 'summarizer']
});
```
**Use Cases:**
- AI-to-AI collaboration
- Recursive agent workflows
- Server-side intelligence

#### 2. Multimodal Support 🎨
```typescript
// Images, audio, video
{
  type: "image",
  data: base64Data,
  mimeType: "image/png",
  _meta: { width: 1920, height: 1080 }
}
```
**Use Cases:**
- Image generation tools
- Audio processing
- Video analysis
- Rich media resources

#### 3. Agentic Workflows 🤖
```typescript
// Task decomposition & coordination
{
  type: "workflow",
  steps: [
    { agent: "research", tool: "search" },
    { agent: "analyze", tool: "processor" },
    { agent: "write", tool: "generator" }
  ]
}
```
**Use Cases:**
- Multi-agent systems
- Complex task orchestration
- Collaborative AI

#### 4. Registry & Discovery 📚
```typescript
// Discover servers from registry
const servers = await registry.discover({
  category: "data",
  verified: true
});
```
**Use Cases:**
- Tool marketplace
- Server discovery
- Automated integration

#### 5. Compliance Testing ✅
- Automated validation
- Reference implementations
- Certification program

### 🔧 Migration Effort
**Estimated Time:** 9 weeks (from RC)
**Breaking Changes:** TBD (check RC changelog)
**New Capabilities:** Major additions

---

## Feature Comparison Matrix

| Feature | 2025-03-26 | 2025-06-18 | 2025-11-25 |
|---------|------------|------------|------------|
| **Core Protocol** |
| JSON-RPC 2.0 | ✅ | ✅ | ✅ |
| Stdio Transport | ✅ | ✅ | ✅ |
| HTTP Transport | ✅ | ✅ | ✅ |
| Capability Negotiation | ✅ | ✅ | ✅ |
| JSON-RPC Batching | ✅ | ❌ | ❌ |
| **Server Features** |
| Tools | ✅ | ✅ | ✅ |
| Resources | ✅ | ✅ | ✅ |
| Prompts | ✅ | ✅ | ✅ |
| Structured Output | ❌ | ✅ | ✅ |
| Output Schema | ❌ | ✅ | ✅ |
| Elicitation | ❌ | ✅ | ✅ |
| Resource Links | ❌ | ✅ | ✅ |
| Sampling | ❌ | ❌ | ✅ |
| **Content Types** |
| Text | ✅ | ✅ | ✅ |
| Images | ❌ | Limited | ✅ |
| Audio | ❌ | ❌ | ✅ |
| Video | ❌ | ❌ | ✅ |
| **Security** |
| Basic Auth | ✅ | ✅ | ✅ |
| OAuth 2.0 | Basic | ✅ | ✅ |
| RFC 8707 | ❌ | ✅ | ✅ |
| Resource Indicators | ❌ | ✅ | ✅ |
| **Metadata** |
| _meta field | Limited | ✅ | ✅ |
| title field | ❌ | ✅ | ✅ |
| context field | ❌ | ✅ | ✅ |
| **Advanced** |
| Multi-agent | ❌ | ❌ | ✅ |
| Workflows | ❌ | ❌ | ✅ |
| Registry | ❌ | ❌ | ✅ |

---

## SDK Version Mapping

```json
{
  "2025-03-26": "@modelcontextprotocol/sdk@^1.0.4",
  "2025-06-18": "@modelcontextprotocol/sdk@^2.0.0",
  "2025-11-25": "@modelcontextprotocol/sdk@^3.0.0"
}
```

---

## Breaking Changes Summary

### 2025-03-26 → 2025-06-18

**Breaking:**
- ❌ JSON-RPC batching removed
- ⚠️ HTTP requires `MCP-Protocol-Version` header

**Non-Breaking:**
- ✅ Structured output (additive)
- ✅ Elicitation (additive)
- ✅ Resource links (additive)
- ✅ Metadata fields (additive)

**Impact:** 🟡 Low - Moderate

### 2025-06-18 → 2025-11-25

**Breaking:** TBD (check RC on Nov 11)

**Expected:**
- ✅ Sampling (likely additive)
- ✅ Multimodal (likely additive)
- ✅ Workflows (likely additive)

**Impact:** 🟢 Low (mostly additions expected)

---

## Upgrade Priority

### High Priority (Do First)
1. ✅ Structured output - Better type safety
2. ✅ OAuth/RFC 8707 - Security critical
3. ✅ Protocol version header - Required for HTTP

### Medium Priority (Important)
4. 🟡 Elicitation - Better UX
5. 🟡 Resource links - Performance
6. 🟡 Metadata fields - Better display

### Low Priority (Nice to Have)
7. 🔵 Title fields - Display names
8. 🔵 Context field - Enhanced completions

---

## Testing Checklist

### 2025-06-18 Compliance

- [ ] All tools return `structuredContent`
- [ ] Output schemas defined and validated
- [ ] Elicitation handler implemented
- [ ] Resource links working
- [ ] OAuth with RFC 8707 implemented
- [ ] `MCP-Protocol-Version` header sent
- [ ] `_meta` fields added
- [ ] `title` fields added
- [ ] No JSON-RPC batching used
- [ ] All integration tests passing

### 2025-11-25 Compliance (Future)

- [ ] Sampling handler implemented
- [ ] Image content supported
- [ ] Audio content supported
- [ ] Video content supported
- [ ] Workflow orchestration working
- [ ] Registry integration complete
- [ ] Multi-agent coordination tested
- [ ] Compliance tests passing

---

## Quick Migration Commands

### Upgrade to 2025-06-18

```bash
# Create upgrade branch
git checkout -b upgrade/2025-06-18

# Update SDK
npm install @modelcontextprotocol/sdk@^2.0.0

# Run upgrade script (when created)
npm run upgrade:2025-06-18

# Test
npm test

# Build
npm run build
```

### Upgrade to 2025-11-25

```bash
# Wait for RC
# Nov 11, 2025

# Test with RC
npm install @modelcontextprotocol/sdk@rc

# After Nov 25, 2025
npm install @modelcontextprotocol/sdk@^3.0.0

# Run upgrade script
npm run upgrade:2025-11-25
```

---

## Resources

- [Full Upgrade Plan](./MCP_UPGRADE_PLAN.md)
- [Official Changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)
- [MCP Roadmap](https://modelcontextprotocol.io/development/roadmap)
- [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707)

---

**Last Updated:** 2025-11-15
**Quick Ref Version:** 1.0
