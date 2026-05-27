'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monitor');
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Monitor state
  const [voteCount, setVoteCount] = useState(0);
  const [usedTokens, setUsedTokens] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [liveFeed, setLiveFeed] = useState([]);
  const [voteAnimating, setVoteAnimating] = useState(false);

  // Tokens state
  const [tokens, setTokens] = useState([]);
  const [generateCount, setGenerateCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);

  // Results state
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const channelRef = useRef(null);

  // ─── Fetch session data ───
  const fetchSession = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('voting_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      console.error('Error fetching session:', error);
      router.push('/admin');
      return;
    }

    setSession(data);
  }, [sessionId, router]);

  // ─── Fetch token data ───
  const fetchTokens = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('voting_tokens')
      .select('*')
      .eq('session_id', sessionId)
      .order('is_used', { ascending: true })
      .order('used_at', { ascending: false, nullsFirst: true });

    if (error) {
      console.error('Error fetching tokens:', error);
      return;
    }

    setTokens(data || []);
    setTotalTokens((data || []).length);
    setUsedTokens((data || []).filter((t) => t.is_used).length);
  }, [sessionId]);

  // ─── Fetch vote count ───
  const fetchVoteCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    setVoteCount(count || 0);
  }, [sessionId]);

  // ─── Fetch results ───
  const fetchResults = useCallback(async () => {
    setLoadingResults(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_vote_results', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('Error fetching results:', error);
      setLoadingResults(false);
      return;
    }

    // Group by category
    const grouped = {};
    (data || []).forEach((row) => {
      if (!grouped[row.category_id]) {
        grouped[row.category_id] = {
          category_id: row.category_id,
          category_name: row.category_name,
          display_order: row.category_display_order ?? row.display_order ?? 0,
          options: [],
          totalVotes: 0,
        };
      }
      grouped[row.category_id].options.push({
        option_id: row.option_id,
        option_name: row.option_name,
        vote_count: row.vote_count || 0,
      });
      grouped[row.category_id].totalVotes += row.vote_count || 0;
    });

    // Sort categories and find winners
    const categoriesList = Object.values(grouped)
      .sort((a, b) => a.display_order - b.display_order)
      .map((cat) => {
        const maxVotes = Math.max(...cat.options.map((o) => o.vote_count));
        return {
          ...cat,
          options: cat.options.map((o) => ({
            ...o,
            isWinner: o.vote_count === maxVotes && maxVotes > 0,
            percentage: cat.totalVotes > 0
              ? Math.round((o.vote_count / cat.totalVotes) * 100)
              : 0,
          })),
        };
      });

    setResults(categoriesList);
    setLoadingResults(false);
  }, [sessionId]);

  // ─── Build initial live feed from used tokens ───
  const buildInitialFeed = useCallback((tokensList) => {
    const usedEntries = tokensList
      .filter((t) => t.is_used && t.used_at)
      .map((t) => ({
        id: t.id,
        time: new Date(t.used_at),
        isNew: false,
      }))
      .sort((a, b) => b.time - a.time);
    setLiveFeed(usedEntries);
  }, []);

  // ─── Initial load ───
  useEffect(() => {
    async function init() {
      await fetchSession();
      await fetchTokens();
      await fetchVoteCount();
      setLoading(false);
    }
    init();
  }, [fetchSession, fetchTokens, fetchVoteCount]);

  // Build feed when tokens load
  useEffect(() => {
    buildInitialFeed(tokens);
  }, [tokens, buildInitialFeed]);

  // ─── Realtime subscription ───
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`admin-live-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voting_tokens',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new;
          if (updated.is_used) {
            // Update tokens list
            setTokens((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
            setUsedTokens((prev) => prev + 1);

            // Refresh vote count
            fetchVoteCount();

            // Add to live feed
            const entry = {
              id: updated.id,
              time: new Date(updated.used_at || new Date()),
              isNew: true,
            };
            setLiveFeed((prev) => [entry, ...prev]);

            // Animate vote counter
            setVoteAnimating(true);
            setTimeout(() => setVoteAnimating(false), 500);

            // Remove "new" highlight after 3s
            setTimeout(() => {
              setLiveFeed((prev) =>
                prev.map((f) => (f.id === entry.id ? { ...f, isNew: false } : f))
              );
            }, 3000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voting_tokens',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // New tokens generated, refresh list
          fetchTokens();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchVoteCount, fetchTokens]);

  // ─── Fetch results when tab switches or session deactivated ───
  useEffect(() => {
    if (activeTab === 'results' && session && !session?.is_active) {
      fetchResults();
    }
  }, [activeTab, session, fetchResults]);

  // ─── Toggle session active/inactive ───
  async function toggleSession() {
    if (session?.is_active) {
      setShowDeactivateModal(true);
      return;
    }

    setToggling(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('voting_sessions')
      .update({ is_active: true })
      .eq('id', sessionId);

    if (!error) {
      setSession((prev) => ({ ...prev, is_active: true }));
    }
    setToggling(false);
  }

  async function confirmDeactivate() {
    setToggling(true);
    setShowDeactivateModal(false);
    const supabase = createClient();
    const { error } = await supabase
      .from('voting_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (!error) {
      setSession((prev) => ({ ...prev, is_active: false }));
    }
    setToggling(false);
  }

  // ─── Generate tokens ───
  async function handleGenerateTokens() {
    if (generateCount < 1 || generateCount > 500) return;
    setGenerating(true);

    const supabase = createClient();
    const { error } = await supabase.rpc('generate_tokens', {
      p_session_id: sessionId,
      p_count: generateCount,
      p_expires_at: null,
    });

    if (error) {
      console.error('Error generating tokens:', error);
      showToast('Erro ao gerar tokens', 'error');
    } else {
      showToast(`${generateCount} tokens gerados com sucesso!`, 'success');
      await fetchTokens();
    }
    setGenerating(false);
  }

  // ─── Copy token link ───
  async function copyTokenLink(token) {
    const url = `${window.location.origin}/vote/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(token);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(token);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  // ─── Toast ───
  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ─── Format helpers ───
  function formatTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }

  function shortToken(token) {
    return token ? token.substring(0, 8).toUpperCase() : '';
  }

  // ─── Sort tokens: unused first, then used by used_at desc ───
  function sortedTokens() {
    return [...tokens].sort((a, b) => {
      if (a.is_used !== b.is_used) return a.is_used ? 1 : -1;
      if (a.is_used && b.is_used) {
        return new Date(b.used_at) - new Date(a.used_at);
      }
      return 0;
    });
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div>
      {/* Header */}
      <div className="session-header">
        <div className="session-header-left">
          <Link href="/admin" className="session-back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="session-title-group">
            <h1>
              {session?.title}
              <span className={`badge ${session?.is_active ? 'badge-success' : 'badge-danger'}`}>
                {session?.is_active ? 'Ativa' : 'Encerrada'}
              </span>
            </h1>
          </div>
        </div>

        <div className="session-header-actions">
          <div className="toggle-wrapper">
            <span className="toggle-label">
              {session?.is_active ? 'Ativa' : 'Inativa'}
            </span>
            <button
              className={`toggle-switch ${session?.is_active ? 'active' : ''}`}
              onClick={toggleSession}
              disabled={toggling}
              aria-label="Toggle session"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Monitor
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Tokens
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={session?.is_active}
          title={session?.is_active ? 'Encerre a votação para ver os resultados' : ''}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Resultados
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'monitor' && (
          <MonitorTab
            voteCount={voteCount}
            usedTokens={usedTokens}
            totalTokens={totalTokens}
            liveFeed={liveFeed}
            voteAnimating={voteAnimating}
            formatTime={formatTime}
            isActive={session?.is_active}
          />
        )}

        {activeTab === 'tokens' && (
          <TokensTab
            tokens={sortedTokens()}
            generateCount={generateCount}
            setGenerateCount={setGenerateCount}
            generating={generating}
            handleGenerateTokens={handleGenerateTokens}
            copyTokenLink={copyTokenLink}
            copiedId={copiedId}
            shortToken={shortToken}
            formatDateTime={formatDateTime}
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab
            session={session}
            results={results}
            loadingResults={loadingResults}
          />
        )}
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="modal-overlay" onClick={() => setShowDeactivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Encerrar Votação?</h2>
            <p className="modal-message">
              Ao encerrar a votação, nenhum novo voto poderá ser registado.
              Os tokens não utilizados serão invalidados. Esta ação pode ser revertida
              ao reativar a sessão.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeactivateModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDeactivate}>
                Encerrar Votação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════
   Monitor Tab Component
   ═══════════════════════════════════ */

function MonitorTab({ voteCount, usedTokens, totalTokens, liveFeed, voteAnimating, formatTime, isActive }) {
  return (
    <div>
      <div className="monitor-stats">
        <div className="monitor-stat-card highlight">
          <div className={`monitor-stat-value ${voteAnimating ? 'animate' : ''}`}>
            {voteCount}
          </div>
          <div className="monitor-stat-label">Votos Registados</div>
        </div>
        <div className="monitor-stat-card">
          <div className="monitor-stat-value">{usedTokens}</div>
          <div className="monitor-stat-label">Tokens Utilizados</div>
        </div>
        <div className="monitor-stat-card">
          <div className="monitor-stat-value">{totalTokens}</div>
          <div className="monitor-stat-label">Tokens Totais</div>
        </div>
        <div className="monitor-stat-card">
          <div className="monitor-stat-value">
            {totalTokens > 0 ? Math.round((usedTokens / totalTokens) * 100) : 0}%
          </div>
          <div className="monitor-stat-label">Taxa de Participação</div>
        </div>
      </div>

      <div className="live-feed">
        <div className="live-feed-header">
          {isActive && <span className="live-dot" />}
          Atividade em Tempo Real
        </div>
        <div className="live-feed-list">
          {liveFeed.length === 0 ? (
            <div className="live-feed-empty">
              <p>Nenhum voto registado ainda.</p>
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--gray-300)' }}>
                Os votos aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            liveFeed.map((entry, idx) => (
              <div
                key={`${entry.id}-${idx}`}
                className={`live-feed-item ${entry.isNew ? 'new' : ''}`}
              >
                <span className="live-feed-icon">🗳️</span>
                <span>Token utilizado às</span>
                <span className="live-feed-time">{formatTime(entry.time)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════
   Tokens Tab Component
   ═══════════════════════════════════ */

function TokensTab({
  tokens,
  generateCount,
  setGenerateCount,
  generating,
  handleGenerateTokens,
  copyTokenLink,
  copiedId,
  shortToken,
  formatDateTime,
}) {
  return (
    <div>
      {/* Generate Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-section-title" style={{ marginBottom: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Gerar Tokens
        </div>
        <div className="tokens-generate">
          <div className="form-group">
            <label className="label">Quantidade</label>
            <input
              type="number"
              className="input"
              value={generateCount}
              onChange={(e) => setGenerateCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              min={1}
              max={500}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerateTokens}
            disabled={generating}
          >
            {generating ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                A gerar...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                Gerar Tokens
              </>
            )}
          </button>
        </div>
      </div>

      {/* Token Table */}
      {tokens.length === 0 ? (
        <div className="card token-table-empty">
          <p>Nenhum token gerado ainda.</p>
          <p style={{ fontSize: 12, marginTop: 4, color: 'var(--gray-300)' }}>
            Gere tokens para que os participantes possam votar.
          </p>
        </div>
      ) : (
        <div className="token-table-wrapper">
          <table className="token-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Link</th>
                <th>Estado</th>
                <th>Usado às</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>
                    <span className="token-code">{shortToken(token.token)}</span>
                  </td>
                  <td>
                    <button
                      className={`token-copy-btn ${copiedId === token.token ? 'copied' : ''}`}
                      onClick={() => copyTokenLink(token.token)}
                    >
                      {copiedId === token.token ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Copiado!
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copiar Link
                        </>
                      )}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${token.is_used ? 'badge-danger' : 'badge-success'}`}>
                      {token.is_used ? 'Usado' : 'Disponível'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {token.is_used ? formatDateTime(token.used_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════
   Results Tab Component
   ═══════════════════════════════════ */

function ResultsTab({ session, results, loadingResults }) {
  if (session?.is_active) {
    return (
      <div className="card results-locked">
        <div className="results-locked-icon">🔒</div>
        <h3>Votação em curso</h3>
        <p>Encerre a votação para ver os resultados.</p>
      </div>
    );
  }

  if (loadingResults) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="card results-locked">
        <div className="results-locked-icon">📊</div>
        <h3>Sem resultados</h3>
        <p>Nenhum voto foi registado nesta sessão.</p>
      </div>
    );
  }

  return (
    <div>
      {results.map((category) => (
        <div key={category.category_id} className="results-card">
          <div className="results-category-header">
            <h3 className="results-category-name">{category.category_name}</h3>
            <span className="results-total-votes">
              {category.totalVotes} voto{category.totalVotes !== 1 ? 's' : ''}
            </span>
          </div>

          {category.options.map((option) => {
            const isBlank = option.option_name.toLowerCase().includes('branco');
            let barClass = 'normal';
            if (option.isWinner) barClass = 'winner';
            if (isBlank) barClass = 'blank';

            return (
              <div key={option.option_id} className="result-bar-container">
                <div className="result-bar-header">
                  <span className="result-bar-name">
                    {option.isWinner && <span className="result-bar-winner">👑</span>}
                    {option.option_name}
                  </span>
                  <span className="result-bar-values">
                    <strong>{option.vote_count}</strong> ({option.percentage}%)
                  </span>
                </div>
                <div className="result-bar-track">
                  <div
                    className={`result-bar-fill ${barClass}`}
                    style={{ width: `${Math.max(option.percentage, option.vote_count > 0 ? 3 : 0)}%` }}
                  >
                    {option.percentage >= 10 ? `${option.percentage}%` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
