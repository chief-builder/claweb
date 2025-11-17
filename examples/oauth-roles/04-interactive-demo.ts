/**
 * Interactive OAuth 2.0 Authorization Code Flow Demo
 *
 * This demonstrates a complete interactive OAuth 2.0 flow with:
 * 1. User visits demo web app
 * 2. Clicks "Login with OAuth" button
 * 3. Redirected to authorization server consent page
 * 4. User approves or denies access
 * 5. Redirected back to demo app with authorization code
 * 6. Demo app exchanges code for tokens
 * 7. Demo app uses tokens to access protected resources
 */

import express from 'express';
import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { HttpResourceServerTransport } from '../../src/transport/http/resource-server-transport.js';
import { TransportType } from '../../src/transport/base.js';
import { OAuthClient } from '../../src/auth/client/oauth-client.js';
import { protectResource } from '../../src/auth/resource-server/middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Interactive OAuth 2.0 Authorization Code Flow Demo');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Start Authorization Server with interactive consent
  console.log('Step 1: Starting Authorization Server with interactive consent...');
  const authServer = new AuthorizationServer({
    host: 'localhost',
    port: 4000,
    issuer: 'http://localhost:4000',
    cors: true,
    staticFilesPath: path.join(__dirname, 'static'),
    interactiveConsent: true, // Enable interactive consent page
  });

  await authServer.start();
  console.log('✓ Authorization Server running on http://localhost:4000');
  console.log('  Interactive Consent: ENABLED');
  console.log('  Consent Page: http://localhost:4000/static/consent.html\n');

  await sleep(500);

  // Step 2: Start Resource Server
  console.log('Step 2: Starting Resource Server...');
  const resourceServer = new HttpResourceServerTransport('2025-06-18', {
    enabled: true,
    authorizationServer: 'http://localhost:4000',
  });

  await resourceServer.initialize({
    type: TransportType.HTTP,
    host: 'localhost',
    port: 3000,
    cors: true,
  });

  // Add protected endpoint
  const resourceApp = resourceServer.getApp();
  resourceApp.get(
    '/mcp/tools',
    protectResource({
      requiredScopes: ['mcp.tools.read'],
      requiredResource: 'mcp://tools',
    }),
    (req, res) => {
      res.json({
        tools: [
          {
            name: 'calculator',
            description: 'Perform mathematical calculations',
          },
          {
            name: 'weather',
            description: 'Get weather information',
          },
        ],
      });
    }
  );

  console.log('✓ Resource Server running on http://localhost:3000\n');

  await sleep(500);

  // Step 3: Register OAuth Client
  console.log('Step 3: Registering OAuth Client...');
  const registerResponse = await fetch('http://localhost:4000/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Interactive Demo App',
      client_type: 'public', // Public client for PKCE
      redirect_uris: ['http://localhost:8080/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'mcp.tools.read mcp.tools.execute',
    }),
  });

  if (!registerResponse.ok) {
    throw new Error(`Client registration failed: ${registerResponse.statusText}`);
  }

  const clientInfo = await registerResponse.json() as any;
  console.log('✓ OAuth Client registered');
  console.log('  Client ID:', clientInfo.client_id);
  console.log('  Client Type: Public (PKCE required)');
  console.log('  Redirect URI: http://localhost:8080/callback\n');

  // Step 4: Create Demo Web Application
  console.log('Step 4: Starting Demo Web Application...');
  const demoApp = express();

  // Store tokens in memory (in production, use secure session storage)
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  // Create OAuth client
  const client = new OAuthClient({
    clientId: clientInfo.client_id,
    authorizationServer: 'http://localhost:4000',
    redirectUri: 'http://localhost:8080/callback',
    scopes: ['mcp.tools.read'],
    resources: ['mcp://tools'],
  });

  // Home page with login button
  demoApp.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth 2.0 Interactive Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
        }

        h1 {
            color: #2d3748;
            margin-bottom: 10px;
        }

        p {
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .btn {
            display: inline-block;
            padding: 14px 28px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn:hover {
            background: #5568d3;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .info-box {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }

        .info-box p {
            margin: 0;
            font-size: 14px;
        }

        .logged-in {
            background: #c6f6d5;
            border-left-color: #48bb78;
        }

        code {
            background: #edf2f7;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
        }

        .token-preview {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            margin: 10px 0;
        }

        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
        }

        .btn-secondary:hover {
            background: #cbd5e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 OAuth 2.0 Interactive Demo</h1>
        <p>
            This demo shows the complete OAuth 2.0 authorization code flow with PKCE,
            including an interactive consent page where you approve or deny access.
        </p>

        ${accessToken ? `
            <div class="info-box logged-in">
                <p><strong>✓ You are logged in!</strong></p>
                <p>Access token obtained successfully.</p>
            </div>

            <div class="token-preview">Access Token: ${accessToken.substring(0, 80)}...</div>

            <div class="actions">
                <a href="/tools" class="btn">View Protected Tools</a>
                <a href="/logout" class="btn btn-secondary">Logout</a>
            </div>
        ` : `
            <div class="info-box">
                <p><strong>Flow Steps:</strong></p>
                <p>
                    1. Click "Login with OAuth" below<br>
                    2. You'll see an interactive consent page<br>
                    3. Approve or deny the request<br>
                    4. Get redirected back with authorization code<br>
                    5. Code is exchanged for access token<br>
                    6. Access protected resources
                </p>
            </div>

            <a href="/login" class="btn">Login with OAuth</a>
        `}
    </div>
</body>
</html>
    `);
  });

  // Login endpoint - starts OAuth flow
  demoApp.get('/login', async (req, res) => {
    try {
      const authUrl = await client.getAuthorizationUrl();
      console.log('\n📍 User clicked "Login with OAuth"');
      console.log('  Redirecting to:', authUrl);
      console.log('  User will see consent page...\n');
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).send(`Error: ${(error as Error).message}`);
    }
  });

  // OAuth callback endpoint
  demoApp.get('/callback', async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      // Handle errors (user denied access)
      if (error) {
        console.log('\n❌ User denied authorization');
        console.log('  Error:', error);
        console.log('  Description:', error_description);
        return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Authorization Denied</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
        }
        h1 { color: #e53e3e; margin-bottom: 15px; }
        p { color: #4a5568; margin-bottom: 20px; }
        a {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Authorization Denied</h1>
        <p>You chose not to grant access to this application.</p>
        <p><strong>Error:</strong> ${error_description || error}</p>
        <a href="/">Return to Home</a>
    </div>
</body>
</html>
        `);
      }

      if (!code || typeof code !== 'string') {
        return res.status(400).send('Missing authorization code');
      }

      console.log('\n✓ User approved authorization!');
      console.log('  Authorization Code:', code.substring(0, 20) + '...');
      console.log('  Exchanging code for access token...\n');

      // Exchange authorization code for tokens
      const tokens = await client.exchangeAuthorizationCode(code as string);

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token || null;

      console.log('✓ Access token obtained');
      console.log('  Token Type:', tokens.token_type);
      console.log('  Expires In:', tokens.expires_in, 'seconds');
      console.log('  Scopes:', tokens.scope);
      console.log('  Token Preview:', tokens.access_token.substring(0, 60) + '...\n');

      res.redirect('/');
    } catch (error) {
      console.error('\n❌ Token exchange failed:', (error as Error).message);
      res.status(500).send(`Token exchange failed: ${(error as Error).message}`);
    }
  });

  // Protected resource endpoint
  demoApp.get('/tools', async (req, res) => {
    if (!accessToken) {
      return res.redirect('/');
    }

    try {
      console.log('\n📡 Accessing protected resource...');
      console.log('  URL: http://localhost:3000/mcp/tools');
      console.log('  Authorization: Bearer ' + accessToken.substring(0, 40) + '...\n');

      const response = await fetch('http://localhost:3000/mcp/tools', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`${error.error}: ${error.error_description}`);
      }

      const tools = await response.json() as any;

      console.log('✓ Successfully accessed protected resource');
      console.log('  Tools:', tools.tools.map((t: any) => t.name).join(', '));
      console.log('');

      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Protected Tools</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 600px;
        }
        h1 { color: #2d3748; margin-bottom: 20px; }
        .tool {
            background: #f7fafc;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #667eea;
        }
        .tool h3 { color: #2d3748; margin-bottom: 5px; }
        .tool p { color: #4a5568; margin: 0; font-size: 14px; }
        a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛠️ Protected Tools</h1>
        ${tools.tools.map((tool: any) => `
            <div class="tool">
                <h3>${tool.name}</h3>
                <p>${tool.description}</p>
            </div>
        `).join('')}
        <a href="/">← Back to Home</a>
    </div>
</body>
</html>
      `);
    } catch (error) {
      console.error('❌ Failed to access protected resource:', (error as Error).message);
      res.status(500).send(`Failed to access protected resource: ${(error as Error).message}`);
    }
  });

  // Logout endpoint
  demoApp.get('/logout', (req, res) => {
    console.log('\n👋 User logged out');
    accessToken = null;
    refreshToken = null;
    res.redirect('/');
  });

  // Start demo app
  await new Promise<void>((resolve) => {
    demoApp.listen(8080, 'localhost', () => {
      console.log('✓ Demo Web Application running on http://localhost:8080\n');
      resolve();
    });
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ All Servers Running!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('🌐 Open your browser and visit:');
  console.log('   http://localhost:8080');
  console.log('');
  console.log('📋 What to do:');
  console.log('   1. Click "Login with OAuth" button');
  console.log('   2. Review the consent page');
  console.log('   3. Click "Authorize" to grant access');
  console.log('   4. See the authorization code flow in action!');
  console.log('');
  console.log('To stop: Press Ctrl+C');
  console.log('═══════════════════════════════════════════════════════\n');

  // Keep process running
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await resourceServer.close();
    await authServer.stop();
    console.log('✓ All servers stopped\n');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('\n✗ Demo Failed!');
  console.error('Error:', error.message);
  console.error('');
  process.exit(1);
});
