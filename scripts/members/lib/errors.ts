export class Phase2Error extends Error {
  constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "Phase2Error";
  }
}

export function safeErrorCode(error: unknown): string {
  if (error instanceof Phase2Error) return error.code;
  if (error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message)) {
    return error.message.split(":")[0];
  }
  return "UNEXPECTED_ERROR";
}
