export const runtimeConfig = {
  timeZone: 'Europe/Lisbon',
  localCategoryId: 'local',
  localRegionName: 'Notícias locais',
};
export type Story = {
  id: string;
  original_title?: string;
  original_summary?: string;
  translation_status?: 'pending' | 'processing' | 'translated' | 'original' | 'failed';
  translation_locale?: string;
  source_language?: string;
  title: string;
  summary: string;
  url: string;
  author?: string;
  source_name: string;
  source_kind: string;
  category: string;
  category_name?: string;
  status: string;
  priority: string;
  published_at: string;
  detected_at: string;
  favorite?: boolean;
  read_at?: string;
  cluster_count?: string;
  tags?: string[];
  related?: Story[];
};
export type Category = { id: string; name: string; position: number };
export const statusLabels: Record<string, string> = {
  official: 'Fonte oficial',
  confirmed: 'Confirmada',
  unconfirmed: 'Por confirmar',
  rumor: 'Rumor / alegação',
  corrected: 'Corrigida',
};
export const priorityLabels: Record<string, string> = {
  urgent: 'Urgente',
  priority: 'Prioritária',
  info: 'Informativa',
};
export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Resposta inválida do servidor');
  }
  if (!response.ok) throw Error(data.error || 'Falha no pedido');
  return data;
}
export const clock = (v: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone: runtimeConfig.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(v));
export const fullDate = (v: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone: runtimeConfig.timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(v));
export function relative(v: string) {
  const delta = Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 1000));
  return delta < 60
    ? `${delta}s`
    : delta < 3600
      ? `${Math.floor(delta / 60)} min`
      : delta < 86400
        ? `${Math.floor(delta / 3600)} h`
        : `${Math.floor(delta / 86400)} d`;
}
