export function log(message: string, data?: any) {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
}