import {
  Bookmark,
  BookmarkCheck,
  Check,
  ExternalLink,
  Clock,
  ShieldCheck,
  TriangleAlert,
  Layers,
  Radio,
  CheckCheck,
} from 'lucide-react';
import { TranslationBadge } from './Translation';
import type { Story } from './types';
import { clock, fullDate, relative, statusLabels } from './types';
export function Status({ value }: { value: string }) {
  const Icon = value === 'official' || value === 'confirmed' ? ShieldCheck : TriangleAlert;
  return (
    <span className={`status status-${value}`}>
      <Icon size={11} />
      {statusLabels[value] || value}
    </span>
  );
}
export function StoryCard({
  story: s,
  onOpen,
  onState,
  fresh = false,
}: {
  fresh?: boolean;
  story: Story;
  onOpen: (s: Story) => void;
  onState: (s: Story, b: any) => void;
}) {
  return (
    <article
      className={`story ${s.priority === 'urgent' ? 'urgent-story' : ''} ${s.read_at ? 'is-read' : ''} ${fresh ? 'fresh-story' : ''}`}
      data-testid="story-card"
    >
      <div className={'source-avatar ' + s.source_kind}>
        {s.source_kind === 'bluesky' ? (
          <Radio size={19} />
        ) : (
          s.source_name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="story-body">
        <div className="story-top">
          <span className="source-name">{s.source_name}</span>
          {s.author && (
            <span className="story-author" title={s.author}>
              · {s.author}
            </span>
          )}
          <span className="dot-separator">·</span>
          <span className="category-tag">{s.category_name || s.category}</span>
          <time title={'Detetada: ' + fullDate(s.detected_at)}>{relative(s.detected_at)}</time>
        </div>
        <button className="story-title" onClick={() => onOpen(s)}>
          <h3>{s.title}</h3>
        </button>
        <p className="story-summary">{s.summary}</p>
        <div className="story-footer">
          <Status value={s.status} />
          <TranslationBadge story={s} />
          {s.priority !== 'info' && (
            <span className={'priority ' + s.priority}>
              {s.priority === 'urgent' ? (
                <TriangleAlert size={11} />
              ) : (
                <span className="priority-dot" />
              )}
              {s.priority === 'urgent' ? 'Urgente' : 'Prioritária'}
            </span>
          )}
          <span className="story-time" title={fullDate(s.published_at)}>
            <Clock size={11} />
            {clock(s.published_at)}
          </span>
          <span className="detected-time" title="Hora de deteção">
            ↳ {clock(s.detected_at)}
          </span>
          {Number(s.cluster_count) > 1 && (
            <span
              className="cluster"
              title="Publicações agrupadas; não representa confirmação independente"
            >
              <Layers size={12} />
              {s.cluster_count}
            </span>
          )}
          <div className="story-actions">
            <button
              className={s.favorite ? 'selected' : ''}
              aria-label={s.favorite ? 'Remover favorito' : 'Guardar favorito'}
              title={s.favorite ? 'Remover favorito' : 'Guardar favorito'}
              onClick={() => onState(s, { favorite: !s.favorite })}
            >
              {s.favorite ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
            <button
              aria-label={s.read_at ? 'Marcar como não lida' : 'Marcar como lida'}
              title={s.read_at ? 'Marcar como não lida' : 'Marcar como lida'}
              onClick={() => onState(s, { read: !s.read_at })}
            >
              {s.read_at ? <CheckCheck size={16} /> : <Check size={16} />}
            </button>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir original"
              title="Abrir original"
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
