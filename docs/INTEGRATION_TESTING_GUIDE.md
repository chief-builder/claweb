# Integration Testing Guide

**Purpose:** Test the Playwright and GitHub MCP servers with real integrations
**Last Updated:** November 20, 2025

---

## Overview

This guide walks through comprehensive integration testing of:
1. **Playwright MCP Server** - Browser automation
2. **GitHub MCP Server** - GitHub API integration with OAuth
3. **OAuth-Aware Agent** - Multi-server coordination
4. **Web Chat UI** - End-to-end user experience

---

## Prerequisites

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Get API Keys

#### Anthropic API Key

1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

```bash
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### GitHub Personal Access Token

**Option A: Classic Token (Simpler)**

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name: "MCP Server Testing"
4. Select scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `user` - Read user profile data
   - ✅ `read:org` - Read org and team membership
5. Click "Generate token"
6. Copy the token (starts with `ghp_`)

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Option B: Fine-grained Token (More Secure)**

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Token name: "MCP Server Testing"
4. Expiration: 90 days (or custom)
5. Repository access: "All repositories" (or select specific ones)
6. Permissions:
   - Repository permissions:
     - ✅ Contents: Read and write
     - ✅ Issues: Read and write
     - ✅ Metadata: Read-only (auto-selected)
     - ✅ Pull requests: Read and write
   - Account permissions:
     - ✅ Starring: Read-only
7. Click "Generate token"
8. Copy the token (starts with `github_pat_`)

```bash
export GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

This downloads the Chromium browser needed for Playwright automation.

---

## Test Plan

### Phase 1: Individual Server Testing

#### Test 1.1: Playwright MCP Server

**Start the server:**

```bash
# Terminal 1
npm run build
npm run mcp:playwright
```

You should see:
```
Playwright MCP Server started
```

**Test with MCP Inspector:**

```bash
# Terminal 2
npx @modelcontextprotocol/inspector node dist/mcp-servers/playwright-server.js
```

**Manual Tests:**

1. **Navigate Tool**
   - Tool: `navigate`
   - Input: `{ "url": "https://example.com" }`
   - Expected: Success with page title

2. **Screenshot Tool**
   - Tool: `screenshot`
   - Input: `{ "name": "example-test", "fullPage": true }`
   - Expected: Screenshot saved to `/tmp/screenshot-example-test.png`

3. **Extract Text Tool**
   - Tool: `extract_text`
   - Input: `{ "selector": "h1" }`
   - Expected: Extracted text from h1 element

4. **List Resources**
   - Should show screenshots taken

**Expected Results:**
- ✅ Server starts without errors
- ✅ All 6 tools are available
- ✅ Screenshots are saved to `/tmp/`
- ✅ Browser can navigate and interact with pages

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| "Browser not initialized" | Run `npx playwright install chromium` |
| "EACCES: permission denied" | Check `/tmp/` write permissions |
| Server crashes on screenshot | Check available disk space |

---

#### Test 1.2: GitHub MCP Server

**Start the server:**

```bash
# Terminal 1
export GITHUB_TOKEN=ghp_your_token_here
npm run build
npm run mcp:github
```

You should see:
```
GitHub MCP Server started
```

**Test with MCP Inspector:**

```bash
# Terminal 2
export GITHUB_TOKEN=ghp_your_token_here
npx @modelcontextprotocol/inspector node dist/mcp-servers/github-server.js
```

**Manual Tests:**

1. **List Repositories**
   - Tool: `list_repositories`
   - Input: `{}` (for authenticated user) or `{ "username": "octocat" }`
   - Expected: List of repositories

2. **Get Repository**
   - Tool: `get_repository`
   - Input: `{ "owner": "chief-builder", "repo": "claweb" }`
   - Expected: Repository details

3. **List Issues**
   - Tool: `list_issues`
   - Input: `{ "owner": "chief-builder", "repo": "claweb", "state": "open" }`
   - Expected: List of open issues

4. **Get File Contents**
   - Tool: `get_file_contents`
   - Input: `{ "owner": "chief-builder", "repo": "claweb", "path": "README.md" }`
   - Expected: File contents

5. **Search Code**
   - Tool: `search_code`
   - Input: `{ "query": "OAuth in:file language:ts repo:chief-builder/claweb" }`
   - Expected: Search results

6. **Read Resource**
   - Resource URI: `github://user`
   - Expected: Authenticated user profile

**Expected Results:**
- ✅ Server starts without errors
- ✅ All 7 tools are available
- ✅ GitHub API calls succeed
- ✅ Structured output matches schemas
- ✅ Rate limit headers are respected

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| "GitHub access token not found" | Set `GITHUB_TOKEN` environment variable |
| "Bad credentials" | Regenerate token, check it's copied correctly |
| "Rate limit exceeded" | Wait for rate limit reset, or use different token |
| "Not Found" | Check repository name and permissions |

**Verify Token Scopes:**

```bash
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
```

Should show:
- `rate.limit`: 5000 (authenticated)
- `rate.remaining`: How many requests left

---

### Phase 2: OAuth-Aware Agent Testing

**Test the agent with multiple servers:**

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx

npm run build
npm run agent:oauth
```

**Expected Behavior:**

1. Agent initializes
2. Connects to GitHub MCP server
3. Discovers tools
4. Processes example queries:
   - "List my GitHub repositories"
   - "Get the details of the chief-builder/claweb repository"
   - "What issues are open in the chief-builder/claweb repository?"

**Expected Output:**

```
🧠 OAuth-Aware Intelligent MCP Agent with Claude

🔌 Connecting to MCP server: github
   🔐 OAuth authentication required
   📋 Scopes: repo, user
   📦 Using token from environment variable
   ✅ OAuth authentication successful
   🔍 Discovering tools from github...
      Found 7 tools:
      - list_repositories: List repositories...
      - get_repository: Get detailed information...
      - list_issues: List issues for a repository
      - create_issue: Create a new issue...
      - list_pull_requests: List pull requests...
      - get_file_contents: Get the contents of a file...
      - search_code: Search for code across GitHub...
   📦 Discovering resources from github...
      Found 1 resources:
      - github_user (github://user)

✅ Agent initialized with 1 server(s)

💭 Processing: "List my GitHub repositories"

🤖 Claude response (iteration 1):
   Stop reason: tool_use
   🔧 Tool use: github__list_repositories
      Input: {}

⚙️  Executing tool: github__list_repositories...
   ✅ Result: {"success":true,"repositories":[...],"count":5}

🤖 Claude response (iteration 2):
   Stop reason: end_turn
   Text: Here are your GitHub repositories: ...

📝 Final response:
[Repository list with details]
```

**Verify:**
- ✅ OAuth token is used from environment
- ✅ Tools are discovered correctly
- ✅ Claude selects appropriate tools
- ✅ Structured responses are returned
- ✅ Multiple queries work in sequence

**Test Failure Scenarios:**

1. **Missing ANTHROPIC_API_KEY**
   ```bash
   unset ANTHROPIC_API_KEY
   npm run agent:oauth
   ```
   Expected: Clear error message

2. **Missing GITHUB_TOKEN**
   ```bash
   unset GITHUB_TOKEN
   npm run agent:oauth
   ```
   Expected: Error about missing credentials

3. **Invalid Token**
   ```bash
   export GITHUB_TOKEN=invalid_token
   npm run agent:oauth
   ```
   Expected: Authentication error

---

### Phase 3: Web Chat Integration Testing

**Start the web chat server:**

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx

npm run build
npm run web-chat
```

You should see:

```
🌐 Web Chat Server started on http://localhost:3001

📋 Available endpoints:
   POST   /api/sessions        - Create new chat session
   GET    /api/sessions        - List active sessions
   ...

🔑 Required environment variables:
   ANTHROPIC_API_KEY - Claude API key
   GITHUB_TOKEN      - GitHub personal access token
```

#### Test 3.1: API Endpoints

**Test with curl:**

```bash
# 1. Health check
curl http://localhost:3001/api/health

# Expected:
# {
#   "status": "ok",
#   "timestamp": "2025-11-20T...",
#   "sessions": 0
# }

# 2. Create session
SESSION_ID=$(curl -X POST http://localhost:3001/api/sessions | jq -r '.sessionId')
echo $SESSION_ID

# Expected:
# {
#   "sessionId": "session_1234567890_abc123",
#   "created": "2025-11-20T..."
# }

# 3. Send message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"List my GitHub repositories\"
  }" | jq .

# Expected:
# {
#   "response": "Here are your repositories: ...",
#   "timestamp": "2025-11-20T..."
# }

# 4. List sessions
curl http://localhost:3001/api/sessions | jq .

# Expected:
# {
#   "sessions": [
#     { "sessionId": "session_...", "active": true }
#   ],
#   "count": 1
# }

# 5. Reset conversation
curl -X POST http://localhost:3001/api/sessions/$SESSION_ID/reset | jq .

# Expected:
# {
#   "success": true,
#   "message": "Conversation reset"
# }

# 6. Delete session
curl -X DELETE http://localhost:3001/api/sessions/$SESSION_ID | jq .

# Expected:
# {
#   "success": true,
#   "message": "Session deleted"
# }
```

#### Test 3.2: Web UI Testing

**Open in browser:**

http://localhost:3001

**Manual UI Tests:**

1. **Initial Load**
   - ✅ Page loads without errors
   - ✅ Status shows "Connecting..."
   - ✅ Status changes to "Connected"
   - ✅ Session ID is displayed
   - ✅ Welcome message appears
   - ✅ Suggested queries are shown

2. **Send Query via Suggestions**
   - Click "📚 List my repositories"
   - ✅ Query appears in input field
   - ✅ Query is sent (input cleared)
   - ✅ User message appears (right-aligned, purple)
   - ✅ Loading indicator appears ("Thinking...")
   - ✅ Assistant response appears (left-aligned, white)
   - ✅ Response contains repository list

3. **Send Custom Query**
   - Type: "Show me open issues in chief-builder/claweb"
   - Press Enter or click Send
   - ✅ Query is processed
   - ✅ Response shows issue list

4. **Test Multiple Queries**
   - Send 3-5 different queries
   - ✅ Conversation history is maintained
   - ✅ Claude uses context from previous messages
   - ✅ No duplicate messages

5. **Reset Conversation**
   - Click "🔄 Reset" button
   - ✅ Chat is cleared
   - ✅ New message: "Conversation has been reset"

6. **Clear Chat**
   - Click "🗑️ Clear" button
   - ✅ All messages are cleared

7. **Error Handling**
   - Stop the server (Ctrl+C)
   - Try to send a message
   - ✅ Error message appears in UI
   - Restart the server
   - Refresh page
   - ✅ Can send messages again

**Browser Console Tests:**

Open Developer Tools (F12) and check:
- ✅ No JavaScript errors
- ✅ Network requests succeed (200 status)
- ✅ No CORS errors

**Test Different Browsers:**
- ✅ Chrome
- ✅ Firefox
- ✅ Safari
- ✅ Edge

**Mobile Responsive:**
- ✅ Resize window to mobile size
- ✅ UI adapts correctly
- ✅ All buttons are accessible

---

### Phase 4: End-to-End Workflow Testing

#### Workflow 1: Repository Analysis

**User Story:** "As a developer, I want to analyze a repository's activity"

**Steps:**
1. "List repositories for chief-builder"
2. "Get details about chief-builder/claweb"
3. "Show me open issues in chief-builder/claweb"
4. "Show me recent pull requests in chief-builder/claweb"

**Verify:**
- ✅ Each query returns relevant data
- ✅ Claude maintains context
- ✅ Structured data is formatted well
- ✅ No rate limit errors

#### Workflow 2: Code Search

**User Story:** "As a developer, I want to find OAuth implementation"

**Steps:**
1. "Search for OAuth implementation in chief-builder/claweb"
2. "Get the contents of src/auth/oauth/pkce.ts from chief-builder/claweb"
3. "Explain how PKCE works based on this code"

**Verify:**
- ✅ Search returns relevant results
- ✅ File contents are retrieved correctly
- ✅ Claude can explain the code

#### Workflow 3: Issue Management

**User Story:** "As a developer, I want to track issues"

**Steps:**
1. "List open issues in chief-builder/claweb"
2. "Show me closed issues"
3. "Create a test issue: 'Test issue from MCP' in a test repository"

**Verify:**
- ✅ Issues are listed correctly
- ✅ Issue creation works (if you have a test repo)
- ✅ Proper error if insufficient permissions

#### Workflow 4: Browser Automation

**User Story:** "As a QA engineer, I want to test a website"

**Note:** This requires adding Playwright to the web chat configuration.

**Steps:**
1. "Navigate to https://example.com"
2. "Take a screenshot named 'example-homepage'"
3. "Extract the text from the h1 element"

**Verify:**
- ✅ Navigation succeeds
- ✅ Screenshot is captured
- ✅ Text extraction works

---

## Performance Testing

### Response Time Benchmarks

**Expected Response Times:**

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Session creation | < 2s | Includes server initialization |
| List repositories | < 3s | Depends on GitHub API |
| Get repository | < 2s | Cached by GitHub |
| Search code | < 5s | Complex queries take longer |
| Create issue | < 3s | Write operation |
| Playwright navigation | < 5s | Depends on website |
| Playwright screenshot | < 2s | After navigation |
| Claude query processing | 2-10s | Depends on complexity |

**Load Testing:**

```bash
# Install Apache Bench
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install apache-bench

# Simple load test (10 requests, 2 concurrent)
ab -n 10 -c 2 -H "Content-Type: application/json" \
  -p test-message.json \
  http://localhost:3001/api/chat
```

**test-message.json:**
```json
{
  "sessionId": "test-session-123",
  "message": "List my repositories"
}
```

**Expected Results:**
- ✅ No failed requests
- ✅ Average response time < 5s
- ✅ No memory leaks

---

## Security Testing

### Test OAuth Token Handling

1. **Token Validation**
   ```bash
   # Test with invalid token
   export GITHUB_TOKEN=invalid
   npm run web-chat

   # Try to send message
   # Expected: Proper error message
   ```

2. **Token Exposure**
   - Check browser Network tab
   - ✅ Token should NOT appear in requests
   - ✅ Token should NOT appear in responses
   - ✅ Token should NOT appear in logs

3. **Token Refresh**
   - Use expired token
   - ✅ Server should detect and fail gracefully
   - ✅ User should see clear error message

### Test Input Validation

1. **XSS Protection**
   ```bash
   # Try to inject script
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test",
       "message": "<script>alert(\"XSS\")</script>"
     }'
   ```
   - ✅ Script should be escaped in response
   - ✅ No script execution in browser

2. **SQL Injection** (if using database)
   ```bash
   # Try SQL injection
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test",
       "message": "'; DROP TABLE users; --"
     }'
   ```
   - ✅ Should be safely escaped

---

## Test Results Template

Use this template to document your test results:

```markdown
# Integration Test Results

**Date:** YYYY-MM-DD
**Tester:** Your Name
**Environment:** Development / Production
**Build:** Git commit SHA

## Environment

- Node.js version: `node --version`
- npm version: `npm --version`
- OS: macOS / Linux / Windows
- ANTHROPIC_API_KEY: ✅ Set
- GITHUB_TOKEN: ✅ Set

## Test Results

### Phase 1: Individual Servers

#### Playwright MCP Server
- ✅ Server starts
- ✅ Navigate tool works
- ✅ Screenshot tool works
- ✅ Extract text works
- ✅ Click tool works
- ✅ Fill tool works
- ✅ Evaluate tool works
- ❌ [Issue description if any]

#### GitHub MCP Server
- ✅ Server starts
- ✅ List repositories works
- ✅ Get repository works
- ✅ List issues works
- ✅ Create issue works
- ✅ List pull requests works
- ✅ Get file contents works
- ✅ Search code works
- ❌ [Issue description if any]

### Phase 2: OAuth Agent
- ✅ Multi-server initialization
- ✅ OAuth token handling
- ✅ Tool discovery
- ✅ Query processing
- ❌ [Issue description if any]

### Phase 3: Web Chat
- ✅ API endpoints work
- ✅ Session management
- ✅ Web UI loads
- ✅ Send/receive messages
- ✅ Conversation history
- ✅ Reset/clear functions
- ❌ [Issue description if any]

### Phase 4: E2E Workflows
- ✅ Repository analysis workflow
- ✅ Code search workflow
- ✅ Issue management workflow
- ❌ [Issue description if any]

## Performance

| Metric | Result | Expected | Pass/Fail |
|--------|--------|----------|-----------|
| Session creation | 1.2s | < 2s | ✅ |
| List repositories | 2.5s | < 3s | ✅ |
| Claude query | 4.8s | < 10s | ✅ |

## Issues Found

1. **Issue Title**
   - Severity: Critical / High / Medium / Low
   - Description: What happened
   - Steps to reproduce: 1, 2, 3...
   - Expected: What should happen
   - Actual: What actually happened
   - Screenshot: [if applicable]

## Notes

[Any additional observations, recommendations, or comments]

## Sign-off

- [ ] All critical tests passed
- [ ] All high-priority issues fixed
- [ ] Documentation updated
- [ ] Ready for deployment

**Tested by:** Your Name
**Date:** YYYY-MM-DD
```

---

## Common Issues & Solutions

### Issue: "ANTHROPIC_API_KEY environment variable not set"

**Solution:**
```bash
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Verify
echo $ANTHROPIC_API_KEY
```

### Issue: "GitHub access token not found"

**Solution:**
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Verify
echo $GITHUB_TOKEN

# Test token
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

### Issue: "Failed to create session"

**Possible Causes:**
1. Server not running
2. Environment variables not set
3. Port already in use

**Solution:**
```bash
# Check if server is running
ps aux | grep web-chat

# Check port
lsof -i :3001

# Kill existing process if needed
kill $(lsof -t -i:3001)

# Restart with proper env vars
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx
npm run web-chat
```

### Issue: "Rate limit exceeded"

**Solution:**
```bash
# Check rate limit status
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# Wait until reset time, or use different token
```

### Issue: "Browser not initialized" (Playwright)

**Solution:**
```bash
# Install Playwright browsers
npx playwright install chromium

# Or all browsers
npx playwright install
```

### Issue: CORS errors in browser

**Solution:**
The server already has CORS enabled. If you still see errors:

1. Check if API URL is correct (`http://localhost:3001`)
2. Make sure server is running
3. Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. Check browser console for exact error

### Issue: "Cannot find module" errors

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

## Continuous Integration Setup

### GitHub Actions Example

Create `.github/workflows/integration-tests.yml`:

```yaml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  integration:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Build
        run: npm run build

      - name: Run Integration Tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Add your test commands here
          npm run test:integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## Next Steps

After successful integration testing:

1. ✅ **Document findings** - Note any issues or improvements
2. ✅ **Update configuration** - Optimize based on test results
3. ✅ **Implement governance** - Follow MCP_GOVERNANCE_ARCHITECTURE.md
4. ✅ **Add monitoring** - Set up health checks and alerting
5. ✅ **Production deployment** - Deploy to staging/production

---

## Support

If you encounter issues not covered in this guide:

1. Check server logs for error details
2. Check browser console (F12) for frontend errors
3. Verify all environment variables are set correctly
4. Review the documentation in `docs/` folder
5. Create an issue in the repository with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
   - Logs

---

**Happy Testing! 🚀**
