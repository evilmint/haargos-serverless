export function maskError(error: string, isInDevStage: boolean): string {
  return isInDevStage ? error : 'An internal server error occurred';
}
