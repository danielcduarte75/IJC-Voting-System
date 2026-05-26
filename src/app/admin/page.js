'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

export default function AdminDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const supabase = createClient();

    // Fetch all sessions
    const { data: sessionsData, error } = await supabase
      .from('voting_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      setLoading(false);
      return;
    }

    // For each session, fetch vote count and token stats
    const enriched = await Promise.all(
      (sessionsData || []).map(async (session) => {
        // Count votes
        const { count: voteCount } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        // Count tokens
        const { count: totalTokens } = await supabase
          .from('voting_tokens')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        const { count: usedTokens } = await supabase
          .from('voting_tokens')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('is_used', true);

        return {
          ...session,
          voteCount: voteCount || 0,
          totalTokens: totalTokens || 0,
          usedTokens: usedTokens || 0,
        };
      })
    );

    setSessions(enriched);
    setLoading(false);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Gerir todas as sessões de votação</p>
        </div>
        <Link href="/admin/sessions/new" className="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Votação
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card dashboard-empty">
          <div className="dashboard-empty-icon">🗳️</div>
          <h3>Nenhuma votação criada ainda</h3>
          <p>Crie a sua primeira sessão de votação para começar.</p>
          <Link href="/admin/sessions/new" className="btn btn-primary">
            Criar Votação
          </Link>
        </div>
      ) : (
        <div className="dashboard-grid">
          {sessions.map((session, idx) => (
            <div
              key={session.id}
              className={`card card-interactive session-card ${session.is_active ? 'active' : ''}`}
              onClick={() => router.push(`/admin/sessions/${session.id}`)}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="session-card-header">
                <h3 className="session-card-title">{session.title}</h3>
                <span className={`badge ${session.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {session.is_active ? (
                    <>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      Ativa
                    </>
                  ) : 'Encerrada'}
                </span>
              </div>

              <div className="session-card-stats">
                <div className="session-stat">
                  <span className="session-stat-label">Votos</span>
                  <span className="session-stat-value">{session.voteCount}</span>
                </div>
                <div className="session-stat">
                  <span className="session-stat-label">Tokens</span>
                  <span className="session-stat-value">
                    {session.usedTokens}/{session.totalTokens}
                  </span>
                </div>
              </div>

              <div className="session-card-date">
                Criada em {formatDate(session.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
