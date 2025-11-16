/**
 * Calculator Tool
 * Performs basic arithmetic operations
 *
 * MCP 2025-06-18: Returns structured output with schema validation
 */

interface CalculatorArgs {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

interface CalculatorOutput {
  operation: string;
  a: number;
  b: number;
  result: number;
  expression: string;
  timestamp: string;
}

export function calculatorTool(args: unknown) {
  const { operation, a, b } = args as CalculatorArgs;

  let result: number;

  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        throw new Error('Division by zero is not allowed');
      }
      result = a / b;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  // Structured output (2025-06-18)
  const structuredOutput: CalculatorOutput = {
    operation,
    a,
    b,
    result,
    expression: `${a} ${getOperatorSymbol(operation)} ${b} = ${result}`,
    timestamp: new Date().toISOString(),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredOutput, null, 2),
      },
    ],
    // MCP 2025-06-18: Structured content for type-safe parsing
    structuredContent: structuredOutput,
  };
}

function getOperatorSymbol(operation: string): string {
  switch (operation) {
    case 'add':
      return '+';
    case 'subtract':
      return '-';
    case 'multiply':
      return '×';
    case 'divide':
      return '÷';
    default:
      return '?';
  }
}
