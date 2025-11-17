/**
 * OAuth Test Suite Runner
 *
 * Runs all OAuth tests and provides a unified summary dashboard
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

interface TestResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
  passedTests?: number;
  totalTests?: number;
}

const TESTS = [
  {
    name: 'Complete Flow Test',
    command: 'npm',
    args: ['run', 'example:oauth:test-flow'],
    type: 'example'
  },
  {
    name: 'Interactive Flow Test',
    command: 'npm',
    args: ['run', 'example:oauth:test-interactive'],
    type: 'example'
  },
  {
    name: 'Edge Cases Test',
    command: 'npm',
    args: ['run', 'example:oauth:edge-cases'],
    type: 'example'
  },
  {
    name: 'Token Revocation Test',
    command: 'npm',
    args: ['run', 'example:oauth:test-revocation'],
    type: 'example'
  }
];

function runTest(test: typeof TESTS[0]): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let output = '';
    let error = '';

    const proc = spawn(test.command, test.args, {
      stdio: 'pipe',
      shell: true
    });

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
      error += data.toString();
    });

    proc.on('close', (code) => {
      const duration = performance.now() - startTime;

      // Extract test counts from output
      let passedTests: number | undefined;
      let totalTests: number | undefined;

      if (test.type === 'example') {
        // Look for pattern like "Passed: 5/5"
        const passedMatch = output.match(/Passed:\s*(\d+)\/(\d+)/);
        if (passedMatch) {
          passedTests = parseInt(passedMatch[1]);
          totalTests = parseInt(passedMatch[2]);
        }

        // Also check for failure count
        const failedMatch = output.match(/Failed:\s*(\d+)\/(\d+)/);
        if (failedMatch) {
          const failed = parseInt(failedMatch[1]);
          totalTests = parseInt(failedMatch[2]);
          passedTests = totalTests - failed;
        }
      }

      resolve({
        name: test.name,
        command: `${test.command} ${test.args.join(' ')}`,
        passed: code === 0,
        duration,
        output,
        error: code !== 0 ? error : undefined,
        passedTests,
        totalTests
      });
    });
  });
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           OAuth 2.1 Test Suite - Summary Dashboard           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const startTime = performance.now();
  const results: TestResult[] = [];

  // Run tests sequentially to avoid port conflicts
  for (const test of TESTS) {
    console.log(`\n▶ Running: ${test.name}...`);
    console.log(`  Command: ${test.command} ${test.args.join(' ')}`);
    console.log('  ─────────────────────────────────────────────────────────────');

    const result = await runTest(test);
    results.push(result);

    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = (result.duration / 1000).toFixed(2);

    if (result.passedTests !== undefined && result.totalTests !== undefined) {
      console.log(`  ${status} (${result.passedTests}/${result.totalTests} tests) - ${duration}s\n`);
    } else {
      console.log(`  ${status} - ${duration}s\n`);
    }
  }

  const totalDuration = performance.now() - startTime;

  // Print summary dashboard
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                       Test Results Summary                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  // Individual test results
  console.log('Test Suite Results:');
  console.log('───────────────────────────────────────────────────────────────\n');

  let totalPassedTests = 0;
  let totalTestCount = 0;

  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);

    let testInfo = '';
    if (result.passedTests !== undefined && result.totalTests !== undefined) {
      testInfo = ` (${result.passedTests}/${result.totalTests})`;
      totalPassedTests += result.passedTests;
      totalTestCount += result.totalTests;
    }

    console.log(`${index + 1}. ${status} ${result.name}${testInfo} - ${duration}s`);
  });

  console.log('\n───────────────────────────────────────────────────────────────\n');

  // Overall statistics
  console.log('Overall Statistics:');
  console.log(`  Test Suites:     ${passed}/${total} passed`);
  if (totalTestCount > 0) {
    console.log(`  Individual Tests: ${totalPassedTests}/${totalTestCount} passed`);
  }
  console.log(`  Total Duration:  ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Success Rate:    ${((passed / total) * 100).toFixed(1)}%`);

  console.log('\n───────────────────────────────────────────────────────────────\n');

  // Performance breakdown
  console.log('Performance Breakdown:');
  results.forEach((result) => {
    const duration = (result.duration / 1000).toFixed(2);
    const percentage = ((result.duration / totalDuration) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor((result.duration / totalDuration) * 30));
    console.log(`  ${result.name.padEnd(25)} ${duration}s ${bar} ${percentage}%`);
  });

  console.log('\n───────────────────────────────────────────────────────────────\n');

  // Failure details
  if (failed > 0) {
    console.log('❌ Failed Tests Details:\n');
    results
      .filter(r => !r.passed)
      .forEach((result) => {
        console.log(`▼ ${result.name}`);
        console.log(`  Command: ${result.command}`);
        if (result.error) {
          const errorLines = result.error.split('\n').slice(0, 10);
          console.log('  Error Output:');
          errorLines.forEach(line => console.log(`    ${line}`));
        }
        console.log('');
      });
    console.log('───────────────────────────────────────────────────────────────\n');
  }

  // Final status
  if (failed === 0) {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                   ✅  ALL TESTS PASSED!  ✅                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  ⚠️   SOME TESTS FAILED   ⚠️                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
