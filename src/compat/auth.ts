/**
 * Auth Service Compatibility Adapter
 * 
 * Stub for legacy auth calls (not wired to UI yet)
 */

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

