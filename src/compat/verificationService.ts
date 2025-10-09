/**
 * Verification Service Compatibility Adapter
 * 
 * Stub for legacy verification calls
 */

export class VerificationService {
  static async getVerifications(query: any): Promise<any[]> {
    console.warn('[VerificationService.getVerifications] Not yet implemented in REST API');
    return [];
  }

  static async createVerification(data: any): Promise<string> {
    console.warn('[VerificationService.createVerification] Use postProof from src/api/goals.ts');
    throw new Error('VerificationService.createVerification - Use REST API');
  }

  static async updateVerification(verificationId: string, updates: any): Promise<void> {
    console.warn('[VerificationService.updateVerification] Not yet implemented in REST API');
  }

  static async deleteVerification(verificationId: string): Promise<void> {
    console.warn('[VerificationService.deleteVerification] Use deleteProof from src/api/goals.ts');
  }

  static async getRecentGoalVerifications(userId: number | string, goalId: string): Promise<number> {
    console.warn('[VerificationService.getRecentGoalVerifications] Not yet implemented');
    return 0;
  }

  static async calculateGoalSuccessRate(userId: number | string, goalId: string): Promise<number> {
    console.warn('[VerificationService.calculateGoalSuccessRate] Not yet implemented');
    return 0;
  }
}

