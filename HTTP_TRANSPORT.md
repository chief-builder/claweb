# HTTP Transport for MCP

## Overview

ClaWeb now supports **HTTP transport with Server-Sent Events (SSE) streaming**, making it fully compliant with the MCP 2025-06-18 specification. This adds production-ready HTTP endpoints alongside the existing stdio transport.

## MCP 2025-06-18 Compliance

✅ **Implemented Features:**

- **Streamable HTTP Transport**: Full HTTP/SSE support for real-time streaming
- **MCP-Protocol-Version Header**: All responses include the protocol version header
- **Server-Sent Events**: Real-time message streaming to connected clients
- **Protocol Discovery**: Automatic endpoint discovery and version negotiation
- **CORS Support**: Configurable CORS for web-based clients
- **Connection Management**: Automatic reconnection and keep-alive
- **Error Recovery**: Graceful error handling and client reconnection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP HTTP Transport                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                      ┌──────────────┐    │
│  │   HTTP       │  ←─── SSE ────→      │  HTTP        │    │
│  │   Client     │                      │  Server      │    │
│  │              │  ←─── POST ────→     │              │    │
│  └──────────────┘                      └──────────────┘    │
│         │                                      │            │
│         │                                      │            │
│    ┌────▼─────┐                          ┌────▼─────┐      │
│    │ Message  │                          │ Message  │      │
│    │ Handler  │                          │ Handler  │      │
│    └──────────┘                          └──────────┘      │
│                                                              │
│  Features:                                                  │
│  • MCP-Protocol-Version: 2025-06-18                        │
│  • Real-time streaming via SSE                             │
│  • Automatic reconnection                                   │
│  • Protocol version negotiation                            │
│  • Heartbeat/keep-alive                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Running the HTTP Server

```bash
# Development mode (with auto-reload)
npm run dev:server:http

# Production mode (after build)
npm run build
npm run server:http

# Custom host and port
npm run dev:server:http -- --host=0.0.0.0 --port=8080
```

The server will start and display:

```
=============================================================
MCP HTTP Server Started Successfully
=============================================================
Server URL: http://localhost:3000
Protocol Version: 2025-06-18
Transport: HTTP with SSE streaming

Available Endpoints:
  - Health Check: http://localhost:3000/health
  - Protocol Info: http://localhost:3000/protocol
  - SSE Stream: http://localhost:3000/sse
  - Messages: http://localhost:3000/message
=============================================================
```

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Purpose:** Check server status and active connections

**Request:**
```bash
curl -H "MCP-Protocol-Version: 2025-06-18" \
  http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "protocolVersion": "2025-06-18",
  "transport": "http",
  "activeStreams": 0
}
```

**Headers:**
- `MCP-Protocol-Version: 2025-06-18`
- `Content-Type: application/json`

---

### 2. Protocol Discovery

**Endpoint:** `GET /protocol`

**Purpose:** Discover server capabilities and available endpoints

**Request:**
```bash
curl -H "MCP-Protocol-Version: 2025-06-18" \
  http://localhost:3000/protocol
```

**Response:**
```json
{
  "protocol": "MCP",
  "version": "2025-06-18",
  "transports": ["http", "sse"],
  "endpoints": {
    "sse": "/sse",
    "message": "/message",
    "health": "/health"
  }
}
```

---

### 3. SSE Stream (Server-Sent Events)

**Endpoint:** `GET /sse`

**Purpose:** Establish streaming connection for receiving server messages

**Headers Required:**
- `MCP-Protocol-Version: 2025-06-18`

**Connection Flow:**
```javascript
const eventSource = new EventSource('/sse');

// Protocol version announcement
eventSource.addEventListener('protocol', (event) => {
  const data = JSON.parse(event.data);
  console.log('Protocol version:', data.version);
});

// Connection acknowledgment
eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected with ID:', data.clientId);
});

// MCP messages
eventSource.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  // Handle MCP message
});

// Heartbeat (keep-alive)
eventSource.addEventListener('ping', (event) => {
  const data = JSON.parse(event.data);
  console.log('Heartbeat:', data.timestamp);
});

// Errors
eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', event);
});
```

**SSE Event Types:**
- `protocol` - Protocol version announcement
- `connected` - Connection established
- `message` - MCP protocol message
- `ping` - Heartbeat/keep-alive
- `error` - Error notification
- `close` - Stream closing

**Response Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`
- `MCP-Protocol-Version: 2025-06-18`

---

### 4. Send Message

**Endpoint:** `POST /message`

**Purpose:** Send MCP messages to the server

**Headers Required:**
- `MCP-Protocol-Version: 2025-06-18`
- `Content-Type: application/json`

**Request Example:**
```bash
curl -X POST http://localhost:3000/message \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

**Error Response (Missing Header):**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": 400,
    "message": "Missing MCP-Protocol-Version header"
  }
}
```

**Error Response (Incompatible Version):**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": 400,
    "message": "Incompatible protocol version: 1999-01-01 (expected 2025-06-18)"
  }
}
```

---

## Client Usage

### HTTP Client Example

```typescript
import { HttpClientTransport } from './src/transport/http/client.js';
import { TransportType } from './src/transport/base.js';

// Create client
const client = new HttpClientTransport();

// Connect to server
await client.initialize({
  type: TransportType.HTTP,
  host: 'localhost',
  port: 3000,
  reconnect: true,
  maxReconnectAttempts: 5
});

// Listen for messages
client.on('message', (message) => {
  console.log('Received:', message);
});

// Send a message
await client.send({
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
});

// Close connection
await client.close();
```

### Fetch API Example

```javascript
// Send MCP message
async function callTool(toolName, args) {
  const response = await fetch('http://localhost:3000/message', {
    method: 'POST',
    headers: {
      'MCP-Protocol-Version': '2025-06-18',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now()
    })
  });

  return await response.json();
}

// Example: Call calculator tool
const result = await callTool('calculator', {
  operation: 'add',
  a: 10,
  b: 5
});

console.log(result);
```

---

## Protocol Features

### 1. MCP-Protocol-Version Header

**Purpose:** Ensure client-server compatibility

All requests MUST include the header:
```
MCP-Protocol-Version: 2025-06-18
```

All responses include the same header to confirm compatibility.

**Version Validation:**
- Exact match required (currently)
- Future: Semantic versioning support
- Mismatch returns 400 error

### 2. Server-Sent Events (SSE)

**Benefits:**
- Real-time server-to-client communication
- Automatic reconnection
- No polling required
- Standard HTTP protocol

**Heartbeat Mechanism:**
- Default: Every 30 seconds
- Configurable interval
- Keeps connection alive
- Detects disconnections

### 3. CORS Support

**Default Configuration:**
```typescript
{
  origin: '*',
  credentials: true,
  exposedHeaders: ['MCP-Protocol-Version']
}
```

**Production Configuration:**
```typescript
// Configure in transport initialization
await transport.initialize({
  type: TransportType.HTTP,
  host: 'localhost',
  port: 3000,
  cors: true  // Enable CORS
});
```

### 4. Error Recovery

**Reconnection Strategy:**
- Exponential backoff (1s, 2s, 4s, 8s, 16s)
- Configurable max attempts
- Automatic state restoration
- Connection status events

**Error Codes:**
- `400` - Bad Request (invalid message, missing headers)
- `404` - Not Found (invalid endpoint)
- `500` - Server Error (internal error)
- `503` - Service Unavailable (server not ready)

---

## Configuration

### Server Configuration

```typescript
import { HttpServerTransport } from './src/transport/http/server.js';
import { TransportType } from './src/transport/base.js';

const transport = new HttpServerTransport();

await transport.initialize({
  type: TransportType.HTTP,
  host: 'localhost',      // Bind address
  port: 3000,             // Port number
  cors: true,             // Enable CORS
  keepAlive: true,        // Enable keep-alive
  timeout: 30000          // Request timeout (ms)
});
```

### Client Configuration

```typescript
import { HttpClientTransport } from './src/transport/http/client.js';

const client = new HttpClientTransport();

await client.initialize({
  type: TransportType.HTTP,
  host: 'localhost',
  port: 3000,
  reconnect: true,              // Auto-reconnect
  maxReconnectAttempts: 5,      // Max retry attempts
  timeout: 5000                  // Connection timeout
});
```

---

## Testing

### Run HTTP Transport Tests

```bash
# Run HTTP-specific tests
npm run test:http

# Run all tests (stdio + HTTP)
npm test
```

### Manual Testing

#### 1. Test Health Endpoint
```bash
curl -H "MCP-Protocol-Version: 2025-06-18" \
  http://localhost:3000/health | jq
```

#### 2. Test Protocol Discovery
```bash
curl -H "MCP-Protocol-Version: 2025-06-18" \
  http://localhost:3000/protocol | jq
```

#### 3. Test Tool Call
```bash
curl -X POST http://localhost:3000/message \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calculator",
      "arguments": {
        "operation": "add",
        "a": 10,
        "b": 5
      }
    },
    "id": 1
  }' | jq
```

#### 4. Test SSE Stream
```bash
curl -N -H "MCP-Protocol-Version: 2025-06-18" \
  http://localhost:3000/sse
```

You should see SSE events:
```
event: protocol
data: {"version":"2025-06-18"}

event: connected
data: {"clientId":"client-0","protocolVersion":"2025-06-18","timestamp":"..."}

event: ping
data: {"timestamp":1234567890}
```

---

## Comparison: stdio vs HTTP Transport

| Feature | stdio | HTTP |
|---------|-------|------|
| **Protocol Version Header** | ❌ No | ✅ Yes (MCP-Protocol-Version) |
| **Streaming** | ✅ Yes (stdin/stdout) | ✅ Yes (SSE) |
| **Multiple Clients** | ❌ No (1:1) | ✅ Yes (broadcast) |
| **Web Browser Support** | ❌ No | ✅ Yes |
| **Network Transport** | ❌ Local only | ✅ Network capable |
| **Reconnection** | ❌ Manual | ✅ Automatic |
| **Health Checks** | ❌ No | ✅ Yes (/health) |
| **Discovery** | ❌ No | ✅ Yes (/protocol) |
| **CORS Support** | N/A | ✅ Yes |
| **Production Ready** | ⚠️ Limited | ✅ Yes |

---

## Production Deployment

### Using systemd

Create `/etc/systemd/system/claweb-http.service`:

```ini
[Unit]
Description=ClaWeb MCP HTTP Server
After=network.target

[Service]
Type=simple
User=claweb
WorkingDirectory=/opt/claweb
ExecStart=/usr/bin/node /opt/claweb/dist/server/http-server.js --host=0.0.0.0 --port=3000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Start the service:
```bash
sudo systemctl enable claweb-http
sudo systemctl start claweb-http
sudo systemctl status claweb-http
```

### Using Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server/http-server.js", "--host=0.0.0.0", "--port=3000"]
```

Build and run:
```bash
docker build -t claweb-http .
docker run -p 3000:3000 claweb-http
```

### Behind Nginx

```nginx
upstream claweb {
    server localhost:3000;
}

server {
    listen 80;
    server_name mcp.example.com;

    location / {
        proxy_pass http://claweb;
        proxy_http_version 1.1;

        # SSE support
        proxy_set_header Connection '';
        proxy_set_header Cache-Control 'no-cache';
        proxy_buffering off;
        chunked_transfer_encoding off;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Timeouts for SSE
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

---

## Troubleshooting

### Connection Refused

**Problem:** `ECONNREFUSED` when connecting to server

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/health

# Check port binding
netstat -tuln | grep 3000

# Check firewall
sudo ufw status
```

### Protocol Version Mismatch

**Problem:** 400 error with "Incompatible protocol version"

**Solution:** Ensure client sends correct header:
```javascript
headers: {
  'MCP-Protocol-Version': '2025-06-18'
}
```

### SSE Connection Drops

**Problem:** SSE stream disconnects frequently

**Solution:**
1. Check heartbeat interval (default 30s)
2. Configure nginx properly (disable buffering)
3. Enable auto-reconnection on client
4. Check network stability

### CORS Errors

**Problem:** Browser blocks requests due to CORS

**Solution:**
```typescript
// Enable CORS in server initialization
await transport.initialize({
  type: TransportType.HTTP,
  host: 'localhost',
  port: 3000,
  cors: true  // ✅ Enable CORS
});
```

---

## Next Steps

With HTTP transport implemented, you can now:

1. **Build Web UIs** - Create browser-based MCP clients
2. **Deploy to Production** - Use HTTP for networked deployments
3. **Multi-Client Support** - Connect multiple clients simultaneously
4. **Implement Elicitation** - Add interactive tool execution (Iteration 1.3)
5. **Add OAuth/RFC 8707** - Implement enhanced security (Iteration 1.2)

## References

- [MCP Specification 2025-06-18](https://spec.modelcontextprotocol.io/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Express.js Documentation](https://expressjs.com/)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
