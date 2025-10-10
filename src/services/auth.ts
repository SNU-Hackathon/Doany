/**
 * Auth Service - Stub
 * 
 * Auth is handled by useAuth hook
 */

export class AuthError extends Error {
  code: string;
  friendlyMessage: string;
  suggestedAction?: string;

  constructor(message: string, code: string = 'AUTH_ERROR', friendlyMessage?: string, suggestedAction?: string) {
    super(message);
    this.code = code;
    this.friendlyMessage = friendlyMessage || message;
    this.suggestedAction = suggestedAction;
    this.name = 'AuthError';
  }
}

export async function sendReset(email: string): Promise<void> {
  console.warn('[sendReset] Not implemented yet');
  throw new Error('sendReset not implemented');
}

