/**
 * Echo Tool
 * Simply echoes back the provided message
 */

interface EchoArgs {
  message: string;
}

export function echoTool(args: unknown) {
  const { message } = args as EchoArgs;

  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  };
}
