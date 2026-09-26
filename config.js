// ═══════════════════════════════════════════════════════
// Configuração de conexão — Facility · Gestão de OS
//
// Estas chaves são públicas por natureza — elas rodam no
// navegador. O que protege os dados são as regras de acesso
// (RLS) gravadas no próprio banco, não o sigilo delas.
//
// Nunca coloque aqui a chave "service_role" nem a senha do
// banco: essas dão acesso irrestrito e não devem sair do
// painel do Supabase.
// ═══════════════════════════════════════════════════════

export const SUPABASE_URL = 'https://ibmehaaixscivsndnppn.supabase.co';
export const SUPABASE_CHAVE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlibWVoYWFpeHNjaXZzbmRucHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDY2NzUsImV4cCI6MjEwNjAyMjY3NX0.MAj72K9PgUb512UunaPpcffImq97HbE-0ZlInlTfTyw';

export const APP = {
  nome: 'Facility',
  descricao: 'Gestão de OS',
  fabricante: 'Facility',
};
