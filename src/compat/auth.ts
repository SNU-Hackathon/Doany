/**
 * Auth Service Compatibility Adapter
 * 
 * Stub for legacy auth calls (not wired to UI yet)
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

export class AuthService {
  static async signIn(email: string, password: string): Promise<any> {
    console.warn('[AuthService.signIn] Use loginPassword from src/api/auth.ts');
    throw new Error('AuthService.signIn - Use src/api/auth.ts instead');
  }

  static async signUp(email: string, password: string, userData: any): Promise<any> {
    console.warn('[AuthService.signUp] Use join from src/api/users.ts');
    throw new Error('AuthService.signUp - Use src/api/users.ts instead');
  }

  static async signOut(): Promise<void> {
    console.warn('[AuthService.signOut] Use clearAuth from src/state/auth.store.ts');
  }
}

export async function sendReset(email: string): Promise<void> {
  console.warn('[sendReset] Password reset not yet implemented in REST API');
  throw new Error('sendReset - Not yet implemented');
}

