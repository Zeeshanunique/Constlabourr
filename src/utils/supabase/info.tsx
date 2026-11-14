/* Supabase project configuration */

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const extractedId = envUrl ? envUrl.replace(/^https?:\/\//, '').split('.')[0] : null;

export const projectId = extractedId || "jkwrupxrjbrmuufxetlh";
export const publicAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3J1cHhyamJybXV1ZnhldGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTc1NDMsImV4cCI6MjA5MzE5MzU0M30.iRwt4RHTIkUfK7C_a-yOtByCqJtI9vEH2VsC-LTB4x8";
