import { runtimeConfig } from './types';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
  Save,
  LogOut,
  Shield,
  Server,
  Radio,
  Tags,
  Users,
  TriangleAlert,
  SlidersHorizontal,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { api, fullDate, statusLabels, priorityLabels } from './types';
import { TranslationBadge } from './Translation';
import { Modal } from './Modal';
const sections = [
  ['sources', 'Fontes', Radio],
  ['accounts', 'Contas', Users],
  ['categories', 'Categorias', Tags],
  ['rules', 'Palavras-chave', SlidersHorizontal],
  ['alerts', 'Alertas', TriangleAlert],
  ['system', 'Sistema', Server],
] as const;
const labels: Record<string, string> = {
  name: 'Nome',
  kind: 'Conector',
  url: 'URL HTTPS público',
  category: 'Categoria',
  enabled: 'Ativa',
  official: 'Fonte oficial',
  interval_seconds: 'Intervalo (segundos)',
  priority: 'Prioridade',
  handle: 'Identificador Bluesky',
  terms: 'Termos da conta (separados por vírgula)',
  term: 'Palavra-chave',
  group_name: 'Grupo',
  exclude: 'Excluir publicações correspondentes',
  position: 'Ordem',
  keywords: 'Palavras-chave da categoria',
};
export function Admin({ categories, onChange }: { categories: any[]; onChange: () => void }) {
  const [auth, setAuth] = useState<any>(null),
    [section, setSection] = useState('sources'),
    [loaded, setLoaded] = useState<{ section: string; data: any } | null>(null),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<any>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [prefs, setPrefs] = useState<any>(null),
    [token, setToken] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get('setup') || '',
    );
  const activeSection = useRef(section);
  const requestVersion = useRef(0);
  activeSection.current = section;
  const data = loaded?.section === section ? loaded.data : section === 'system' ? {} : [];
  const load = async (background = false) => {
    const requestedSection = section;
    const version = ++requestVersion.current;
    const isCurrent = () =>
      version === requestVersion.current && activeSection.current === requestedSection;
    if (!background) setLoading(true);
    setError('');
    try {
      const [rows, settings] = await Promise.all([
        api('/admin/' + section),
        api('/admin/settings'),
      ]);
      if (!isCurrent()) return;
      setLoaded({ section: requestedSection, data: rows });
      setPrefs(settings.alerts);
    } catch (e: any) {
      if (isCurrent()) setError(e.message);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };
  useEffect(() => {
    api('/auth/status')
      .then(setAuth)
      .catch((e) => setError(e.message));
    if (token) history.replaceState(null, '', '/admin');
    const readSetupLink = () => {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('setup');
      if (incoming) {
        setToken(incoming);
        history.replaceState(null, '', '/admin');
      }
    };
    window.addEventListener('hashchange', readSetupLink);
    return () => window.removeEventListener('hashchange', readSetupLink);
  }, []);
  useEffect(() => {
    if (auth?.authenticated) void load();
    return () => {
      requestVersion.current++;
    };
  }, [auth, section]);
  useEffect(() => {
    if (!auth?.authenticated || section !== 'system') return;
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [auth, section]);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (!auth.initialized) {
        await api('/auth/setup', { method: 'POST', body: JSON.stringify({ ...fields, token }) });
      }
      await api('/auth/login', { method: 'POST', body: JSON.stringify(fields) });
      setAuth({ initialized: true, authenticated: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const b: any = { ...editing };
      delete b.id;
      for (const k of ['keywords', 'terms'])
        if (typeof b[k] === 'string')
          b[k] = b[k]
            .split(',')
            .map((v: string) => v.trim())
            .filter(Boolean);
      await api(`/admin/${section}` + (editing.id ? '/' + editing.id : ''), {
        method: editing.id ? 'PATCH' : 'POST',
        body: JSON.stringify(b),
      });
      setEditing(null);
      setNotice('Alterações guardadas.');
      await load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function change(row: any, b: any) {
    try {
      await api(`/admin/${section}/${row.id}`, { method: 'PATCH', body: JSON.stringify(b) });
      await load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  }
  function formFor(row: any) {
    const keys =
      section === 'sources'
        ? ['name', 'kind', 'url', 'category', 'enabled', 'official', 'interval_seconds', 'priority']
        : section === 'accounts'
          ? ['handle', 'category', 'enabled', 'priority', 'terms', 'official']
          : section === 'categories'
            ? ['name', 'position', 'enabled', 'keywords', 'priority']
            : ['term', 'group_name', 'category', 'priority', 'exclude', 'enabled'];
    return Object.fromEntries(
      ['id', ...keys].filter((k) => row[k] !== undefined).map((k) => [k, row[k]]),
    );
  }
  function add() {
    setEditing(
      section === 'sources'
        ? {
            name: '',
            kind: 'rss',
            url: '',
            category: 'portugal',
            enabled: true,
            official: false,
            interval_seconds: 120,
            priority: 'info',
          }
        : section === 'accounts'
          ? {
              handle: '',
              category: 'mundo',
              enabled: true,
              priority: 'priority',
              terms: [],
              official: false,
            }
          : {
              term: '',
              group_name: 'Geral',
              category: null,
              priority: 'info',
              exclude: false,
              enabled: true,
            },
    );
  }
  if (!auth) return <div className="empty panel">A verificar sessão…</div>;
  if (!auth.authenticated)
    return (
      <section className="login panel">
        <Shield className="cyan" size={32} />
        <span className="eyebrow">ÁREA RESERVADA</span>
        <h2>Acesso administrativo</h2>
        <p>Gerir fontes, regras e operação do Notícias Radar.</p>
        {!auth.initialized && !token ? (
          <>
            <div className="info-box">
              Defina as credenciais iniciais no terminal deste servidor. O comando gera um link de
              utilização única, válido por 15 minutos.
            </div>
            <code>npm run admin:setup</code>
          </>
        ) : (
          <form onSubmit={login}>
            <label>
              Utilizador
              <input name="username" autoComplete="username" required minLength={3} />
            </label>
            <label>
              {auth.initialized ? 'Palavra-passe' : 'Definir palavra-passe (mínimo 12 caracteres)'}
              <input
                name="password"
                type="password"
                autoComplete={auth.initialized ? 'current-password' : 'new-password'}
                minLength={12}
                maxLength={200}
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'A verificar…' : auth.initialized ? 'Entrar' : 'Criar administrador e entrar'}
            </button>
          </form>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
      </section>
    );
  return (
    <div className="admin">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONTROLO DO RADAR</span>
          <h2>Administração</h2>
          <p>Fontes, critérios e saúde do sistema.</p>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            setAuth({ initialized: true, authenticated: false });
          }}
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
      <div className="admin-tabs">
        {sections.map(([id, name, Icon]) => (
          <button
            key={id}
            className={section === id ? 'active' : ''}
            onClick={() => {
              if (id === section) return;
              setLoading(true);
              setSection(id);
              setEditing(null);
              setNotice('');
            }}
          >
            <Icon size={15} />
            {name}
          </button>
        ))}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="empty panel" role="status">
          A carregar secção…
        </div>
      ) : loaded?.section !== section ? (
        <div className="empty panel">
          <p>Não foi possível carregar esta secção.</p>
          <button className="secondary" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      ) : section === 'system' ? (
        <>
          <div className="metric-grid">
            {[
              [
                'Base de dados',
                data.database ? `${(Number(data.database.size) / 1048576).toFixed(1)} MB` : '—',
              ],
              ['Publicações', data.database?.stories || '—'],
              ['RAM API', data.memory ? `${Math.round(data.memory.api / 1048576)} MB` : '—'],
              ['Disco livre', data.disk ? `${(data.disk.free / 1073741824).toFixed(1)} GB` : '—'],
              ['CPU disponíveis', data.cores || '—'],
              ['Carga · 1 minuto', data.load ? Number(data.load[0]).toFixed(2) : '—'],
              [
                'RAM total',
                data.memory ? `${(data.memory.total / 1073741824).toFixed(1)} GB` : '—',
              ],
              ['RAM livre', data.memory ? `${(data.memory.free / 1073741824).toFixed(1)} GB` : '—'],
            ].map(([k, v]) => (
              <div className="panel metric" key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <section className="panel settings-form translation-settings">
            <h3>Tradução automática · Português europeu</h3>
            <p>
              Processamento local dos títulos e resumos. O original é preservado e a recolha
              continua imediata.
            </p>
            <div className="translation-counts">
              {[
                ['translated', 'Traduzidas'],
                ['original', 'Originais em português'],
                ['pending', 'Em espera'],
                ['failed', 'Com falha'],
              ].map(([key, label]) => (
                <span key={key}>
                  {label}
                  <strong>{data.translation?.[key] ?? '—'}</strong>
                </span>
              ))}
            </div>
            <label className="translation-toggle">
              <input
                type="checkbox"
                checked={data.translation?.enabled !== false}
                onChange={async (event) => {
                  try {
                    await api('/admin/translation', {
                      method: 'PUT',
                      body: JSON.stringify({ enabled: event.target.checked }),
                    });
                    await load();
                    setNotice('Preferência de tradução guardada.');
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              />
              Tradução automática ativa
            </label>
            {data.translation?.failed > 0 && (
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await api('/admin/translation/retry', { method: 'POST' });
                    await load();
                    setNotice('Traduções com falha colocadas novamente em espera.');
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                <RefreshCw size={14} />
                Repetir traduções com falha
              </button>
            )}
          </section>
          <div className="panel admin-list">
            <h3>Estado dos serviços</h3>
            <p>API operacional · PostgreSQL ligado · host {data.hostname}</p>
            {data.collector?.map((s: any) => (
              <div className="admin-row" key={s.key}>
                <strong>{s.key}</strong>
                <span>{JSON.stringify(s.value)}</span>
                <time>{fullDate(s.updated_at)}</time>
              </div>
            ))}
            <h3>Erros recentes</h3>
            {!data.errors?.length && <p>Sem erros registados nas fontes.</p>}
            {data.errors?.map((e: any) => (
              <p key={e.name}>
                <strong>{e.name}</strong> · {e.error}
              </p>
            ))}
            <h3>Atividade administrativa</h3>
            {data.audit?.map((a: any, i: number) => (
              <p key={i}>
                {fullDate(a.created_at)} · {a.action}
              </p>
            ))}
          </div>
        </>
      ) : section === 'alerts' ? (
        <>
          <form
            className="panel settings-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/admin/settings', { method: 'PUT', body: JSON.stringify(prefs) });
                setNotice('Preferências guardadas.');
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <h3>Máxima rapidez · {runtimeConfig.timeZone}</h3>
            <p>
              Urgentes sempre visíveis. Sem push e sem som. Informação por confirmar pode originar
              um alerta.
            </p>
            <div className="form-grid">
              {[
                ['quiet_start', 'Início do período silencioso'],
                ['quiet_end', 'Fim do período silencioso'],
                ['retention_days', 'Retenção (1–30 dias)'],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    type="number"
                    min={k === 'retention_days' ? 1 : 0}
                    max={k === 'retention_days' ? 30 : 23}
                    value={prefs?.[k] ?? 0}
                    onChange={(e) => setPrefs({ ...prefs, [k]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <button className="primary">
              <Save size={15} />
              Guardar preferências
            </button>
          </form>
          <div className="panel admin-list">
            <h3>Histórico de alertas</h3>
            {data.map?.((a: any) => (
              <div className="alert-admin" key={a.id}>
                <span className={'priority ' + a.level}>{priorityLabels[a.level]}</span>
                <TranslationBadge story={a} />
                <a href={a.url} target="_blank" rel="noreferrer">
                  {a.title}
                  <ExternalLink size={12} />
                </a>
                <span>
                  {a.source_name} · {statusLabels[a.status]} · {fullDate(a.created_at)}
                </span>
                <select
                  aria-label="Estado editorial"
                  value={a.status}
                  onChange={async (e) => {
                    await api('/admin/stories/' + a.story_id, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: e.target.value, priority: a.level }),
                    });
                    await load();
                    onChange();
                  }}
                >
                  {Object.entries(statusLabels).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="admin-toolbar">
            <span>
              {data.length || 0} {section === 'sources' ? 'fontes configuradas' : 'registos'}
            </span>
            <button
              className="secondary"
              onClick={() => void load()}
              aria-label="Atualizar administração"
            >
              <RefreshCw size={14} />
            </button>
            {section !== 'categories' && (
              <button className="primary" onClick={add}>
                <Plus size={15} />
                Adicionar
              </button>
            )}
          </div>
          <div className="panel admin-list">
            {data.map?.((row: any, i: number) => (
              <div className="admin-row" key={row.id}>
                <div className="admin-row-main">
                  <strong>{row.name || row.handle || row.term}</strong>
                  <span>
                    {section === 'sources'
                      ? `${row.kind.toUpperCase()} · ${row.item_count} publicações · ${row.status}`
                      : section === 'categories'
                        ? `${row.position + 1}. ${row.keywords.join(', ') || 'Sem filtro obrigatório'}`
                        : row.group_name || row.did || 'DID resolvido automaticamente'}
                  </span>
                  {row.error && <small className="warning">{row.error}</small>}
                  {row.last_success && (
                    <small>Última sincronização: {fullDate(row.last_success)}</small>
                  )}
                </div>
                <div className="admin-row-actions">
                  {section === 'categories' && (
                    <>
                      <button
                        aria-label="Subir categoria"
                        disabled={i === 0}
                        onClick={async () => {
                          await change(row, { position: data[i - 1].position });
                          await api('/admin/categories/' + data[i - 1].id, {
                            method: 'PATCH',
                            body: JSON.stringify({ position: row.position }),
                          });
                          await load();
                          onChange();
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        aria-label="Descer categoria"
                        disabled={i === data.length - 1}
                        onClick={async () => {
                          await change(row, { position: data[i + 1].position });
                          await api('/admin/categories/' + data[i + 1].id, {
                            method: 'PATCH',
                            body: JSON.stringify({ position: row.position }),
                          });
                          await load();
                          onChange();
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </>
                  )}
                  {section === 'sources' && (
                    <button
                      title="Testar ligação"
                      aria-label={'Testar ' + row.name}
                      onClick={async () => {
                        try {
                          await api('/admin/sources/' + row.id + '/test', { method: 'POST' });
                          setNotice(
                            'Teste agendado; atualizar diagnóstico dentro de alguns segundos.',
                          );
                          await load();
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}
                  <button
                    className={'toggle ' + (row.enabled ? 'on' : '')}
                    aria-label={row.enabled ? 'Desativar' : 'Ativar'}
                    aria-pressed={row.enabled}
                    onClick={() => change(row, { enabled: !row.enabled })}
                  >
                    <span />
                  </button>
                  <button className="secondary" onClick={() => setEditing(formFor(row))}>
                    Editar
                  </button>
                  {['accounts', 'rules'].includes(section) && (
                    <button
                      title="Eliminar"
                      aria-label="Eliminar"
                      onClick={async () => {
                        await api(`/admin/${section}/${row.id}`, { method: 'DELETE' });
                        await load();
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && (
        <Modal label="Editar registo" onClose={() => setEditing(null)}>
          <form className="panel editor" onSubmit={save}>
            <h3>{editing.id ? 'Editar registo' : 'Novo registo'}</h3>
            <div className="form-grid">
              {Object.entries(editing)
                .filter(([k]) => k !== 'id')
                .map(([k, v]) => (
                  <label key={k} className={typeof v === 'boolean' ? 'checkbox-label' : ''}>
                    {labels[k] || k}
                    {typeof v === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) => setEditing({ ...editing, [k]: e.target.checked })}
                      />
                    ) : k === 'priority' || k === 'category' || k === 'kind' ? (
                      <select
                        value={String(v ?? '')}
                        onChange={(e) => setEditing({ ...editing, [k]: e.target.value || null })}
                      >
                        {k === 'category' ? (
                          <>
                            <option value="">Sem associação</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </>
                        ) : (
                          Object.entries(
                            k === 'priority'
                              ? priorityLabels
                              : {
                                  rss: 'RSS / Atom',
                                  hn: 'Hacker News',
                                  bluesky: 'Bluesky',
                                  reddit: 'Reddit',
                                  facebook: 'Facebook',
                                  x: 'X',
                                },
                          ).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <input
                        required={['name', 'term', 'handle'].includes(k)}
                        type={['position', 'interval_seconds'].includes(k) ? 'number' : 'text'}
                        value={Array.isArray(v) ? v.join(', ') : String(v ?? '')}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            [k]: ['position', 'interval_seconds'].includes(k)
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
            <div className="editor-actions">
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                <Save size={15} />
                {busy ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
