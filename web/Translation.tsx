import { Languages, Clock, TriangleAlert } from 'lucide-react';
import type { Story } from './types';
export function TranslationBadge({ story }: { story: Pick<Story, 'translation_status'> }) {
  const status = story.translation_status;
  if (!status || status === 'original') return null;
  const translated = status === 'translated',
    failed = status === 'failed',
    Icon = translated ? Languages : failed ? TriangleAlert : Clock;
  return (
    <span
      className={'translation-badge ' + (translated ? 'ready' : failed ? 'failed' : 'pending')}
      title={
        translated
          ? 'Tradução automática com adaptação para português europeu. O texto original está disponível no detalhe.'
          : failed
            ? 'Não foi possível traduzir este texto. É apresentado o original.'
            : 'O original é apresentado enquanto a tradução local é processada.'
      }
    >
      <Icon size={11} />
      {translated ? 'PT-PT automático' : failed ? 'Tradução indisponível' : 'A traduzir para PT-PT'}
    </span>
  );
}
export function OriginalText({ story }: { story: Story }) {
  if (story.translation_status !== 'translated') return null;
  return (
    <details className="original-copy">
      <summary>Ver texto original</summary>
      <h3>{story.original_title}</h3>
      <p>{story.original_summary}</p>
    </details>
  );
}
