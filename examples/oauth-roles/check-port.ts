/**
 * Check if port 4000 is already in use
 */

import net from 'net';

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Port is in use
      } else {
        resolve(true); // Other error, assume available
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true); // Port is available
    });

    server.listen(port, 'localhost');
  });
}

async function main() {
  console.log('\n=== Port Availability Check ===\n');

  const port = 4000;
  const isAvailable = await checkPort(port);

  if (isAvailable) {
    console.log(`✓ Port ${port} is available`);
    console.log('  No conflicting process detected');
  } else {
    console.log(`✗ Port ${port} is ALREADY IN USE!`);
    console.log('  Another process is listening on this port');
    console.log('  This explains why the debug logs aren\'t appearing');
    console.log('');
    console.log('To find and kill the process:');
    console.log(`  lsof -ti:${port} | xargs kill -9`);
    console.log('');
    console.log('Or use a different port in the test.');
  }

  console.log('');
}

main();
