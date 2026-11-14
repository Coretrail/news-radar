import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Command,
  ExternalLink,
  Globe,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Monitor,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Moon,
  TrendingUp,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
  Cpu,
  BrainCircuit,
  FlaskConical,
  ChartNoAxesCombined,
  Flag,
  Rss,
  PanelLeftClose,
} from 'lucide-react';
import { TranslationBadge, OriginalText } from './Translation';
import { Modal } from './Modal';
import { Admin } from './Admin';
import { StoryCard, Status } from './StoryCard';
import { api, clock, fullDate, relative, runtimeConfig } from './types';
import type { Story, Category } from './types';
const icons: Record<string, any> = {
  portugal: Flag,
  local: MapPin,
  mundo: Globe,
  tecnologia: Cpu,
  ia: BrainCircuit,
  ciberseguranca: ShieldCheck,
  ciencia: FlaskConical,
  economia: ChartNoAxesCombined,
};
export default function App() {
  const [runtime, setRuntime] = useState({ ...runtimeConfig });
  useEffect(() => {
    api<typeof runtimeConfig>('/config')
      .then((value) => {
        Object.assign(runtimeConfig, value);
        setRuntime({ ...runtimeConfig });
      })
      .catch(() => {});
  }, []);
  const [page, setPage] = useState(location.pathname === '/admin' ? 'admin' : 'feed'),
    [view, setView] = useState('all'),
    [category, setCategory] = useState(''),
    [categories, setCategories] = useState<Category[]>([]),
    [sources, setSources] = useState<any[]>([]),
    [overview, setOverview] = useState<any>(null),
    [items, setItems] = useState<Story[]>([]),
    [total, setTotal] = useState(0),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [priority, setPriority] = useState(''),
    [source, setSource] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [advanced, setAdvanced] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [pending, setPending] = useState<Set<string>>(new Set()),
    [freshIds, setFreshIds] = useState<Set<string>>(new Set()),
    [detail, setDetail] = useState<Story | null>(null),
    [theme, setTheme] = useState(localStorage.getItem('nr-theme') || 'dark'),
    [collapsed, setCollapsed] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [notice, setNotice] = useState(''),
    [now, setNow] = useState(new Date()),
    [sourcePanel, setSourcePanel] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    requestId = useRef(0),
    currentIds = useRef(new Set<string>()),
    detailId = useRef<string | null>(null),
    liveInitialized = useRef(false),
    firstConnection = useRef(true),
    cursor = useRef('0');
  detailId.current = detail?.id || null;
  const refreshOverview = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([api('/overview'), api('/sources')]);
      setOverview(o);
      setSources(s);
    } catch {
      /* connection banner handles outages */
    }
  }, []);
  const refreshCategories = useCallback(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    refreshCategories();
    void refreshOverview();
    const t = setInterval(() => {
      void refreshOverview();
      setNow(new Date());
    }, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nr-theme', theme);
  }, [theme]);
  useEffect(() => {
    const online = () => setOffline(false),
      off = () => {
        setOffline(true);
        setConnected(false);
      };
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    const pop = () => setPage(location.pathname === '/admin' ? 'admin' : 'feed');
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', off);
      window.removeEventListener('popstate', pop);
    };
  }, []);
  const params = useCallback(
    (offset = 0) => {
      const p = new URLSearchParams({ limit: '30', offset: String(offset), view });
      for (const [k, v] of Object.entries({ q: search, category, priority, source, from, to }))
        if (v) p.set(k, v);
      return p;
    },
    [search, category, priority, source, from, to, view],
  );
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const load = useCallback(
    async (append = false) => {
      const seq = ++requestId.current;
      setLoading(true);
      setError('');
      try {
        const data = await api<{ items: Story[]; total: number; cursor: string }>(
          '/stories?' + params(append ? items.length : 0),
        );
        if (seq !== requestId.current) return;
        setItems((old) =>
          append
            ? [...old, ...data.items.filter((s) => !old.some((o) => o.id === s.id))]
            : data.items,
        );
        setTotal(data.total);
        if (append) {
          for (const s of data.items) currentIds.current.add(s.id);
        } else {
          currentIds.current = new Set(data.items.map((s) => s.id));
          cursor.current = data.cursor;
          setFreshIds(new Set(data.items.filter((s) => pending.has(s.id)).map((s) => s.id)));
          setPending(new Set());
        }
        liveInitialized.current = true;
      } catch (e: any) {
        if (seq === requestId.current) setError(e.message);
      } finally {
        if (seq === requestId.current) setLoading(false);
      }
    },
    [params, items.length, pending],
  );
  useEffect(() => {
    if (!freshIds.size) return;
    const timer = setTimeout(() => setFreshIds(new Set()), 2000);
    return () => clearTimeout(timer);
  }, [freshIds]);
  useEffect(() => {
    if (page === 'feed') void load();
  }, [params, page]);
  useEffect(() => {
    const es = new EventSource('/api/events');
    let translationTimer: ReturnType<typeof setTimeout> | undefined;
    const translatedIds = new Set<string>();
    let lastTranslationOverview = 0;
    const updateTranslations = async (ids: string[]) => {
      const uniqueIds = [...new Set(ids)];
      for (let offset = 0; offset < uniqueIds.length; offset += 100) {
        try {
          const updates = await api<Partial<Story>[]>(
            '/translations?ids=' + uniqueIds.slice(offset, offset + 100).join(','),
          );
          const byId = new Map(updates.map((s) => [s.id, s]));
          setItems((old) => old.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s)));
          setDetail((old) => (old && byId.has(old.id) ? { ...old, ...byId.get(old.id) } : old));
        } catch {}
      }
    };
    es.addEventListener('translation', (event) => {
      const n = JSON.parse((event as MessageEvent).data);
      if (currentIds.current.has(n.id) || detailId.current === n.id) translatedIds.add(n.id);
      if (!translationTimer)
        translationTimer = setTimeout(() => {
          void updateTranslations([...translatedIds]);
          translatedIds.clear();
          if (Date.now() - lastTranslationOverview > 1500) {
            lastTranslationOverview = Date.now();
            void refreshOverview();
          }
          translationTimer = undefined;
        }, 250);
    });
    let throttle: ReturnType<typeof setTimeout> | undefined;
    const recover = async () => {
      if (cursor.current === '0') return;
      const p = paramsRef.current();
      p.set('since', cursor.current);
      p.set('limit', '100');
      try {
        const r = await api<{ items: Story[]; cursor: string }>('/stories?' + p);
        cursor.current = r.cursor;
        setPending(
          (old) =>
            new Set([
              ...old,
              ...r.items.filter((s) => !currentIds.current.has(s.id)).map((s) => s.id),
            ]),
        );
      } catch {}
    };
    es.addEventListener('connected', () => {
      setConnected(true);
      setOffline(false);
      if (!firstConnection.current && liveInitialized.current) {
        void recover();
        void updateTranslations([
          ...currentIds.current,
          ...(detailId.current ? [detailId.current] : []),
        ]);
      }
      firstConnection.current = false;
      void refreshOverview();
    });
    es.addEventListener('news', () => {
      if (!throttle)
        throttle = setTimeout(() => {
          void recover();
          void refreshOverview();
          throttle = undefined;
        }, 150);
    });
    es.onerror = () => setConnected(false);
    return () => {
      clearTimeout(throttle);
      clearTimeout(translationTimer);
      es.close();
    };
  }, []);
  useEffect(() => {
    if (detail && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!detail) dialog.current?.close();
  }, [detail]);
  function navigate(next: string, v = 'all', cat = '') {
    setPage(next);
    setView(v);
    setCategory(cat);
    setMobileMenu(false);
    history.pushState(null, '', next === 'admin' ? '/admin' : '/');
  }
  async function state(s: Story, b: any) {
    try {
      await api('/stories/' + s.id + '/state', { method: 'PATCH', body: JSON.stringify(b) });
      const update = (x: Story) =>
        x.id === s.id
          ? {
              ...x,
              favorite: b.favorite ?? x.favorite,
              read_at:
                b.read === undefined ? x.read_at : b.read ? new Date().toISOString() : undefined,
            }
          : x;
      setItems((old) => old.map(update));
      if (detail?.id === s.id) setDetail(update(detail));
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  async function open(s: Story) {
    setDetail(s);
    void state(s, { read: true });
    try {
      const full = await api<Story>('/stories/' + s.id);
      setDetail({ ...full, read_at: new Date().toISOString() });
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  const title =
    page === 'admin'
      ? 'Administração'
      : view === 'favorites'
        ? 'Favoritos'
        : view === 'history'
          ? 'Histórico de leitura'
          : priority === 'urgent'
            ? 'Alertas urgentes'
            : category
              ? categories.find((c) => c.id === category)?.name
              : 'Feed em direto';
  const heartbeat = overview?.collector?.find((c: any) => c.key === 'heartbeat');
  const collectorHealthy =
    heartbeat &&
    Date.now() - new Date(heartbeat.updated_at).getTime() < 120000 &&
    heartbeat.value.status === 'running';
  const feedHeader = (
    <div className="section-heading">
      <div>
        <div className="eyebrow">
          <span className="tiny-dot" /> CENTRAL DE MONITORIZAÇÃO
        </div>
        <h1>
          {title}
          <span className="live-chip">LIVE</span>
        </h1>
        <p>O que acontece, quando acontece.</p>
      </div>
      <button
        className="secondary refresh"
        aria-label="Atualizar feed"
        onClick={() => {
          void load();
          void refreshOverview();
        }}
      >
        <RefreshCw size={15} />
        Atualizar
      </button>
    </div>
  );
  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={'sidebar ' + (mobileMenu ? 'mobile-open' : '')}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('feed');
          }}
        >
          <img src="/radar.svg" alt="" />
          <span>
            Notícias <strong>Radar</strong>
            <small>INFORMAÇÃO EM MOVIMENTO</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Fechar menu"
          onClick={() => setMobileMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="tiny-dot green" />
          <span>Workspace privado</span>
          <span className="keycap">LAN</span>
        </div>
        <nav aria-label="Navegação principal">
          <span className="nav-label">MONITORIZAÇÃO</span>
          <button
            aria-label="Feed em direto"
            className={
              page === 'feed' && view === 'all' && !category ? 'nav-item active' : 'nav-item'
            }
            onClick={() => {
              navigate('feed');
              setPriority('');
            }}
          >
            <LayoutDashboard size={18} />
            <span>Feed em direto</span>
            <span className="nav-count">{overview?.stats.today || '—'}</span>
          </button>
          <button
            aria-label="Alertas urgentes"
            className={'nav-item ' + (priority === 'urgent' ? 'active' : '')}
            onClick={() => {
              navigate('feed');
              setPriority('urgent');
            }}
          >
            <Bell size={18} />
            <span>Alertas urgentes</span>
            {!!overview?.alerts.length && (
              <span className="alert-count">{overview.alerts.length}</span>
            )}
          </button>
          <span className="nav-label category-label">CATEGORIAS</span>
          {categories.map((c) => {
            const Icon = c.id === runtime.localCategoryId ? MapPin : icons[c.id] || Rss;
            return (
              <button
                key={c.id}
                className={'nav-item ' + (category === c.id ? 'active' : '')}
                onClick={() => {
                  navigate('feed', 'all', c.id);
                  setPriority('');
                }}
                title={c.name}
              >
                <Icon size={18} />
                <span>
                  {c.id === runtime.localCategoryId
                    ? runtime.localRegionName
                    : c.id === 'ia'
                      ? 'Inteligência artificial'
                      : c.name}
                </span>
                {c.id === runtime.localCategoryId && <span className="local-dot" />}
              </button>
            );
          })}
          <span className="nav-label">A MINHA CENTRAL</span>
          <button
            aria-label="Favoritos"
            className={'nav-item ' + (view === 'favorites' ? 'active' : '')}
            onClick={() => {
              navigate('feed', 'favorites');
              setPriority('');
            }}
          >
            <Bookmark size={18} />
            <span>Favoritos</span>
          </button>
          <button
            aria-label="Histórico"
            className={'nav-item ' + (view === 'history' ? 'active' : '')}
            onClick={() => {
              navigate('feed', 'history');
              setPriority('');
            }}
          >
            <History size={18} />
            <span>Histórico</span>
          </button>
          <button
            aria-label="Administração"
            className={'nav-item ' + (page === 'admin' ? 'active' : '')}
            onClick={() => navigate('admin')}
          >
            <Settings size={18} />
            <span>Administração</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="source-health" onClick={() => setSourcePanel(true)}>
            <span className={'tiny-dot ' + (collectorHealthy ? 'green' : 'amber')} />
            <span>
              Estado das fontes
              <strong>
                {overview?.sources.operational || 0} / {overview?.sources.active || 0} operacionais
              </strong>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="sidebar-footer">
            <span>
              NOTÍCIAS RADAR <b>v1.0</b>
            </span>
            <button
              title="Recolher menu"
              aria-label="Recolher menu"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir menu"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <Radio size={18} className="cyan" />
            <span>Radar de acontecimentos</span>
            <span className="topbar-divider" />
            <span className="date-label">
              {new Intl.DateTimeFormat('pt-PT', {
                day: '2-digit',
                month: 'long',
                timeZone: runtime.timeZone,
              }).format(now)}
            </span>
          </div>
          <div className="topbar-right">
            <span className={'connection ' + (connected ? 'online' : '')} role="status">
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>
                {offline ? 'Sem rede' : connected ? 'Ligação em direto' : 'A reconectar…'}
              </span>
            </span>
            <span className="clock">
              {clock(now.toISOString())}
              <small>{runtime.timeZone}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Definições"
              onClick={() => navigate('admin')}
            >
              <Settings size={18} />
            </button>
            <div className="profile-badge" title="Central privada">
              NR
            </div>
          </div>
        </header>
        {offline && (
          <div className="offline-banner" role="alert">
            <WifiOff size={16} />
            Sem ligação. As notícias abaixo são a última consulta e podem estar desatualizadas.
          </div>
        )}
        {page !== 'admin' && overview?.alerts.length > 0 && (
          <button className="mobile-urgent-strip" onClick={() => void open(overview.alerts[0])}>
            <TriangleAlert size={18} />
            <span>
              <strong>
                URGENTE ·{' '}
                {overview.alerts[0].status === 'official'
                  ? 'Fonte oficial'
                  : 'Ver estado de confirmação'}
              </strong>
              <span>{overview.alerts[0].title}</span>
              <TranslationBadge story={overview.alerts[0]} />
            </span>
            <ChevronRight size={16} />
          </button>
        )}
        <div className={'content-grid ' + (page === 'admin' ? 'admin-grid' : '')}>
          <main>
            {page === 'admin' ? (
              <Admin
                categories={categories}
                onChange={() => {
                  refreshCategories();
                  void refreshOverview();
                }}
              />
            ) : (
              <>
                {feedHeader}
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="Pesquisar notícias"
                    role="searchbox"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Pesquisar notícias, fontes, temas ou autores…"
                  />
                  {q ? (
                    <button aria-label="Limpar pesquisa" onClick={() => setQ('')}>
                      <X size={16} />
                    </button>
                  ) : (
                    <span className="search-hint">
                      <Command size={12} /> pesquisa global
                    </span>
                  )}
                </div>
                <div className="quick-filters">
                  <div className="filter-pills">
                    {[
                      ['', 'Todas'],
                      ['urgent', 'Urgentes'],
                      ['priority', 'Prioritárias'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={priority === v ? 'active' : ''}
                        onClick={() => setPriority(v)}
                      >
                        {v === 'urgent' && <span className="tiny-dot red" />}
                        {l}
                      </button>
                    ))}
                    <button
                      className={category === runtime.localCategoryId ? 'active' : ''}
                      onClick={() =>
                        setCategory(
                          category === runtime.localCategoryId ? '' : runtime.localCategoryId,
                        )
                      }
                    >
                      <MapPin size={12} />
                      Na região
                    </button>
                  </div>
                  <button
                    className={'filter-button ' + (advanced ? 'active' : '')}
                    onClick={() => setAdvanced(!advanced)}
                    aria-expanded={advanced}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Filtros</span>
                  </button>
                </div>
                {advanced && (
                  <div className="advanced-filters panel">
                    <label>
                      Fonte
                      <select value={source} onChange={(e) => setSource(e.target.value)}>
                        <option value="">Todas as fontes</option>
                        {sources.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Desde
                      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label>
                      Até
                      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                        setSource('');
                        setCategory('');
                        setPriority('');
                        setQ('');
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
                <div className="metrics">
                  <div>
                    <div className="metric-icon cyan">
                      <Activity size={17} />
                    </div>
                    <span>
                      Recolhidas em 24h
                      <strong>{Number(overview?.stats.today || 0).toLocaleString('pt-PT')}</strong>
                    </span>
                  </div>
                  <div>
                    <div className="metric-icon green-text">
                      <Radio size={17} />
                    </div>
                    <span>
                      Fontes operacionais
                      <strong>
                        {overview?.sources.operational || 0}
                        <small> / {overview?.sources.active || 0}</small>
                      </strong>
                    </span>
                  </div>
                  <div>
                    <div className="metric-icon amber-text">
                      <Bell size={17} />
                    </div>
                    <span>
                      Alertas urgentes
                      <strong>
                        {overview?.alerts.length || 0}
                        <small> nas últimas 24h</small>
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="feed-toolbar">
                  <div>
                    <span className="tiny-dot green" />
                    <h2>
                      {view === 'favorites'
                        ? 'Publicações guardadas'
                        : view === 'history'
                          ? 'Consultadas recentemente'
                          : 'Últimas publicações'}
                    </h2>
                    <span className="result-count">{total}</span>
                  </div>
                  <span>
                    <Clock size={12} />
                    Deteção mais recente
                  </span>
                </div>
                {overview?.quiet && (
                  <div className="quiet-note">
                    <Moon size={12} />
                    Período silencioso · urgentes sempre visíveis · sem som
                  </div>
                )}
                <div className="updates-slot">
                  {pending.size > 0 && (
                    <button
                      className={'new-posts ' + (!overview?.quiet ? 'new-highlight' : '')}
                      onClick={() => void load()}
                    >
                      <ArrowDown size={15} />
                      {pending.size} novas publicações<span>Inserir no feed</span>
                    </button>
                  )}
                </div>
                {error && (
                  <div className="error" role="alert">
                    {error}
                    <button className="secondary" onClick={() => void load()}>
                      Tentar novamente
                    </button>
                  </div>
                )}
                <div className="feed-list" aria-busy={loading}>
                  {loading && !items.length ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="skeleton">
                        <i />
                        <span />
                        <span />
                      </div>
                    ))
                  ) : !items.length && !error ? (
                    <div className="empty">
                      <Search size={27} />
                      <h3>Sem publicações para estes filtros.</h3>
                      <p>Experimente outro tema ou remova os filtros.</p>
                    </div>
                  ) : (
                    items.map((s) => (
                      <StoryCard
                        key={s.id}
                        story={s}
                        onOpen={open}
                        onState={state}
                        fresh={freshIds.has(s.id)}
                      />
                    ))
                  )}
                </div>
                {items.length < total && (
                  <button
                    className="load-more secondary"
                    disabled={loading}
                    onClick={() => void load(true)}
                  >
                    {loading ? <RefreshCw size={15} /> : <ChevronDown size={15} />}{' '}
                    {loading ? 'A carregar…' : 'Carregar mais publicações'}
                  </button>
                )}
                <footer className="feed-bottom">
                  <ShieldCheck size={12} />
                  <span>Fontes preservadas. Popularidade não equivale a confirmação.</span>
                  <span>{runtime.timeZone}</span>
                </footer>
              </>
            )}
          </main>
          {page !== 'admin' && (
            <aside className="right-column" aria-label="Painel de monitorização">
              <section className="panel urgent-panel">
                <div className="panel-heading">
                  <h2>
                    <TriangleAlert size={16} />
                    Alertas urgentes
                  </h2>
                  <span className="panel-count">{overview?.alerts.length || 0}</span>
                </div>
                <p className="panel-subtitle">Máxima rapidez. Confirmação identificada.</p>
                {overview?.alerts.length ? (
                  overview.alerts.slice(0, 4).map((s: Story) => (
                    <div className="urgent-item" key={s.id}>
                      <div className="urgent-meta">
                        <span>
                          <span className="tiny-dot red" />
                          URGENTE
                        </span>
                        <time>{clock(s.published_at)}</time>
                      </div>
                      <button onClick={() => void open(s)}>{s.title}</button>
                      <div className="urgent-source">
                        {s.source_name}
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Abrir alerta original"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <Status value={s.status} />
                      <TranslationBadge story={s} />
                    </div>
                  ))
                ) : (
                  <div className="calm-state">
                    <ShieldCheck size={24} />
                    <strong>Sem alertas urgentes recentes</strong>
                    <span>O Radar continua a acompanhar as fontes.</span>
                  </div>
                )}
                <button
                  className="panel-link"
                  onClick={() => {
                    navigate('feed');
                    setPriority('urgent');
                  }}
                >
                  Consultar alertas
                  <ArrowUpRight size={14} />
                </button>
              </section>
              <section className="panel trends-panel">
                <div className="panel-heading">
                  <h2>
                    <TrendingUp size={16} />
                    No radar
                  </h2>
                  <span className="subtle">24H</span>
                </div>
                {overview?.trends.length ? (
                  overview.trends.map((t: any, i: number) => (
                    <button
                      className="trend-row"
                      key={t.topic + t.category}
                      onClick={() => {
                        navigate('feed');
                        setQ(t.topic);
                      }}
                    >
                      <span className="trend-number">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        <strong>{t.topic}</strong>
                        <small>
                          {t.count} publicações · {t.sources} fontes
                        </small>
                      </span>
                      <span className="trend-growth">
                        {t.previous > 0 && t.recent > t.previous ? (
                          <>
                            <TrendingUp size={14} />
                            {t.recent}
                          </>
                        ) : (
                          <Activity size={17} />
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="panel-subtitle">
                    A reunir atividade suficiente para identificar temas.
                  </p>
                )}
                <p className="trend-disclaimer">Volume de publicações, sem inferir confirmação.</p>
              </section>
              <section className="panel local-panel">
                <div className="panel-heading">
                  <h2>
                    <MapPin size={16} />
                    {runtime.localRegionName}
                  </h2>
                  <span className="local-chip">REGIÃO</span>
                </div>
                <p className="panel-subtitle">Destaques da região configurada</p>
                {overview?.local.map((s: Story) => (
                  <button className="local-item" key={s.id} onClick={() => void open(s)}>
                    <strong>{s.title}</strong>
                    <TranslationBadge story={s} />
                    <span>
                      {s.source_name}
                      <time>{relative(s.detected_at)}</time>
                    </span>
                  </button>
                ))}
                <button
                  className="panel-link"
                  onClick={() => {
                    navigate('feed', 'all', runtime.localCategoryId);
                    setPriority('');
                  }}
                >
                  Explorar a região
                  <ArrowUpRight size={14} />
                </button>
              </section>
              <section className="panel collector-panel">
                <div className="panel-heading">
                  <h2>
                    <Activity size={16} />
                    Estado da recolha
                  </h2>
                  <span className={'tiny-dot ' + (collectorHealthy ? 'green' : 'amber')} />
                </div>
                <div className="collector-row">
                  <span>Collector</span>
                  <strong className={collectorHealthy ? 'green-text' : 'amber-text'}>
                    {collectorHealthy ? 'Operacional' : 'A verificar'}
                  </strong>
                </div>
                <div className="collector-row">
                  <span>Canal em direto</span>
                  <strong>{connected ? 'SSE ligado' : 'A reconectar'}</strong>
                </div>
                <div className="collector-row">
                  <span>Última publicação</span>
                  <strong>
                    {overview?.stats.last_update ? clock(overview.stats.last_update) : '—'}
                  </strong>
                </div>
                <div className="collector-row">
                  <span>Retenção</span>
                  <strong>Até 30 dias</strong>
                </div>
                <button className="panel-link" onClick={() => setSourcePanel(true)}>
                  Diagnóstico das fontes
                  <ArrowUpRight size={14} />
                </button>
              </section>
              <div className="right-footer">
                <img src="/radar.svg" width="18" alt="" />
                Notícias Radar<span>Privado. Sempre atento.</span>
              </div>
            </aside>
          )}
        </div>
      </div>
      <nav className="mobile-bottom" aria-label="Navegação móvel">
        <button
          onClick={() => {
            navigate('feed');
            setPriority('');
          }}
          className={page === 'feed' && view === 'all' && priority !== 'urgent' ? 'active' : ''}
        >
          <Radio size={19} />
          <span>Direto</span>
        </button>
        <button
          onClick={() => {
            navigate('feed');
            setPriority('urgent');
          }}
          className={priority === 'urgent' ? 'active' : ''}
        >
          <Bell size={19} />
          <span>Alertas</span>
        </button>
        <button
          onClick={() => {
            navigate('feed', 'favorites');
            setPriority('');
          }}
          className={view === 'favorites' ? 'active' : ''}
        >
          <Bookmark size={19} />
          <span>Favoritos</span>
        </button>
        <button onClick={() => setMobileMenu(true)}>
          <Menu size={19} />
          <span>Menu</span>
        </button>
      </nav>
      <dialog
        ref={dialog}
        className="detail-dialog panel"
        onCancel={() => setDetail(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <div>
            <div className="detail-heading">
              <span className="eyebrow">
                {detail.source_name} · {detail.category_name}
              </span>
              <button
                className="icon-button"
                aria-label="Fechar detalhe"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </div>
            <Status value={detail.status} />
            <h2>{detail.title}</h2>
            <p className="detail-summary">{detail.summary}</p>
            <TranslationBadge story={detail} />
            <OriginalText story={detail} />
            <dl>
              <dt>Publicação original</dt>
              <dd>{fullDate(detail.published_at)}</dd>
              <dt>Detetada pelo Radar</dt>
              <dd>{fullDate(detail.detected_at)}</dd>
              {detail.author && (
                <>
                  <dt>Autor</dt>
                  <dd>{detail.author}</dd>
                </>
              )}
              <dt>Fuso horário</dt>
              <dd>{runtime.timeZone}</dd>
            </dl>
            {detail.related && detail.related.length > 1 && (
              <div className="related">
                <h3>Publicações relacionadas</h3>
                <p>
                  O agrupamento pode incluir republicações e não estabelece confirmação
                  independente.
                </p>
                {detail.related.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                    {s.source_name} · {fullDate(s.published_at)}
                    <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            )}
            <div className="detail-actions">
              <a className="primary" href={detail.url} target="_blank" rel="noopener noreferrer">
                Abrir fonte original
                <ExternalLink size={16} />
              </a>
              <button
                className="secondary"
                onClick={() => void state(detail, { favorite: !detail.favorite })}
              >
                <Bookmark size={16} />
                {detail.favorite ? 'Guardada' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </dialog>
      {sourcePanel && (
        <Modal label="Estado das fontes" onClose={() => setSourcePanel(false)}>
          <section className="panel source-modal">
            <div className="detail-heading">
              <h2>Estado das fontes</h2>
              <button
                className="icon-button"
                aria-label="Fechar fontes"
                onClick={() => setSourcePanel(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="subtle">
              Diagnóstico real. As falhas não interrompem as restantes fontes.
            </p>
            {sources.map((s) => (
              <div className="source-modal-row" key={s.id}>
                <span
                  className={
                    'tiny-dot ' +
                    (['ok', 'live'].includes(s.status) ? 'green' : s.enabled ? 'amber' : '')
                  }
                />
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {s.error ||
                      `${s.item_count} publicações · ${s.last_success ? fullDate(s.last_success) : 'A aguardar sincronização'}`}
                  </small>
                </div>
                <span>
                  {!s.enabled
                    ? 'Desativada'
                    : s.status === 'live'
                      ? 'Em direto'
                      : s.status === 'ok'
                        ? 'Operacional'
                        : s.status === 'pending'
                          ? 'A verificar'
                          : 'Falha'}
                </span>
              </div>
            ))}
          </section>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="alert">
          {notice}
          <button aria-label="Fechar mensagem" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
