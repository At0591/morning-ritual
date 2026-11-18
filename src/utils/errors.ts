// A readable message from anything a catch block can receive.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const message = (e as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(e);
}
