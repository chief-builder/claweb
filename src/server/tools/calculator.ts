/**
 * Calculator Tool
 * Performs basic arithmetic operations
 */

interface CalculatorArgs {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
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

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation,
          a,
          b,
          result,
          expression: `${a} ${getOperatorSymbol(operation)} ${b} = ${result}`,
        }, null, 2),
      },
    ],
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
