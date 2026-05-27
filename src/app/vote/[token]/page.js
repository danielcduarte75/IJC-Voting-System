'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'

/* ─── Constants ─── */
const STATE = {
  LOADING: 'loading',
  ERROR: 'error',
  VOTING: 'voting',
  CONFIRMING: 'confirming',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
}

/* ─── Main Voting Page ─── */
export default function VotePage({ params }) {
  const { token } = use(params)
  const [state, setState] = useState(STATE.LOADING)
  const [errorInfo, setErrorInfo] = useState({ message: '', code: '' })
  const [session, setSession] = useState(null)
  const [categories, setCategories] = useState([])
  const [selections, setSelections] = useState({})
  const [currentStep, setCurrentStep] = useState(0)
  const [votedCategoryIds, setVotedCategoryIds] = useState([])

  /* ─── Validate token on mount ─── */
  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch('/api/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (!data.valid) {
          setErrorInfo({ message: data.error, code: data.code || '' })
          setState(STATE.ERROR)
          return
        }

        setSession(data.session)
        setCategories(data.categories || [])
        setVotedCategoryIds(data.votedCategoryIds || [])
        setState(STATE.VOTING)
      } catch {
        setErrorInfo({
          message: 'Não foi possível conectar ao servidor. Tente novamente.',
          code: 'NETWORK_ERROR',
        })
        setState(STATE.ERROR)
      }
    }

    validateToken()
  }, [token])

  /* ─── Selection handler ─── */
  const handleSelect = useCallback((categoryId, optionId) => {
    setSelections(prev => ({ ...prev, [categoryId]: optionId }))
  }, [])

  /* ─── Check if all categories have a selection ─── */
  const votableCategories = categories.filter(c => !votedCategoryIds.includes(c.id))
  const allSelected = votableCategories.length > 0 && votableCategories.every(c => selections[c.id])

  /* ─── Navigation ─── */
  const goNext = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, votableCategories.length - 1))
  }, [votableCategories.length])

  const goPrev = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  /* ─── Submit ─── */
  const handleConfirm = useCallback(() => {
    setState(STATE.CONFIRMING)
  }, [])

  const handleCancelConfirm = useCallback(() => {
    setState(STATE.VOTING)
  }, [])

  const handleSubmit = useCallback(async () => {
    setState(STATE.SUBMITTING)

    try {
      const p_votes = votableCategories.map(cat => ({
        category_id: cat.id,
        option_id: selections[cat.id],
      }))

      const supabase = createClient()
      const { error } = await supabase.rpc('cast_vote', {
        p_token: token,
        p_votes: p_votes,
      })

      if (error) {
        let errorMessage = 'Erro ao submeter o voto. Tente novamente.'
        if (error.message?.includes('already been used')) {
          errorMessage = 'Este token já foi utilizado para votar.'
        } else if (error.message?.includes('not active')) {
          errorMessage = 'Esta sessão de votação já não está ativa.'
        } else if (error.message?.includes('expired')) {
          errorMessage = 'Este token expirou.'
        } else if (error.message) {
          errorMessage = error.message
        }
        setErrorInfo({ message: errorMessage, code: 'SUBMIT_ERROR' })
        setState(STATE.ERROR)
        return
      }

      setState(STATE.SUCCESS)
    } catch {
      setErrorInfo({
        message: 'Erro de rede ao submeter o voto. Verifique a sua ligação e tente novamente.',
        code: 'NETWORK_ERROR',
      })
      setState(STATE.ERROR)
    }
  }, [token, selections, votableCategories])

  /* ─── Render states ─── */
  return (
    <>
      <PageStyles />
      <div className="vote-page">
        {/* Header */}
        <header className="vote-header glass">
          <div className="container vote-header-inner">
            <div className="vote-header-logo">
              <Image
                src="/logo-ijc.png"
                alt="IJC"
                width={64}
                height={64}
                className="vote-logo-img"
              />
              <span className="vote-logo-text">IJC Voting</span>
            </div>
            {session && (
              <div className="vote-header-session">
                <span className="badge badge-primary badge-dot">{session.title}</span>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="vote-main">
          {state === STATE.LOADING && <LoadingState />}
          {state === STATE.ERROR && <ErrorState info={errorInfo} />}
          {state === STATE.VOTING && (
            <VotingState
              categories={votableCategories}
              allCategories={categories}
              votedCategoryIds={votedCategoryIds}
              selections={selections}
              currentStep={currentStep}
              onSelect={handleSelect}
              onNext={goNext}
              onPrev={goPrev}
              onConfirm={handleConfirm}
              allSelected={allSelected}
              session={session}
            />
          )}
          {state === STATE.CONFIRMING && (
            <ConfirmModal
              categories={votableCategories}
              selections={selections}
              onCancel={handleCancelConfirm}
              onConfirm={handleSubmit}
            />
          )}
          {state === STATE.SUBMITTING && <SubmittingState />}
          {state === STATE.SUCCESS && <SuccessState />}
        </main>
      </div>
    </>
  )
}

/* ─── Loading State ─── */
function LoadingState() {
  return (
    <div className="vote-state-container">
      <div className="spinner spinner-lg" />
      <p className="vote-state-text">A validar o seu token de votação...</p>
    </div>
  )
}

/* ─── Error State ─── */
function ErrorState({ info }) {
  const icons = {
    TOKEN_USED: '🔒',
    TOKEN_EXPIRED: '⏰',
    SESSION_INACTIVE: '🚫',
    NETWORK_ERROR: '📡',
    SUBMIT_ERROR: '⚠️',
  }

  const icon = icons[info.code] || '❌'

  return (
    <div className="vote-state-container animate-fade-in">
      <div className="vote-error-icon">{icon}</div>
      <h2>Não foi possível votar</h2>
      <p className="vote-state-text">{info.message}</p>
      {info.code === 'NETWORK_ERROR' && (
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}

/* ─── Voting State ─── */
function VotingState({
  categories,
  allCategories,
  votedCategoryIds,
  selections,
  currentStep,
  onSelect,
  onNext,
  onPrev,
  onConfirm,
  allSelected,
  session,
}) {
  const totalSteps = categories.length
  const currentCategory = categories[currentStep]
  const isLastStep = currentStep === totalSteps - 1
  const currentSelection = selections[currentCategory?.id]

  if (!currentCategory) {
    // All categories already voted
    return (
      <div className="vote-state-container animate-fade-in">
        <div className="vote-error-icon">✅</div>
        <h2>Já votou em todas as categorias</h2>
        <p className="vote-state-text">O seu voto já foi registado. Obrigado!</p>
      </div>
    )
  }

  return (
    <div className="vote-content animate-fade-in">
      <div className="container container-md">
        {/* Session info */}
        {session?.description && (
          <p className="vote-session-desc">{session.description}</p>
        )}

        {/* Step indicator */}
        {totalSteps > 1 && (
          <div className="step-indicator" style={{ marginBottom: 'var(--space-xl)' }}>
            {categories.map((cat, idx) => (
              <div className="step" key={cat.id}>
                <div
                  className={`step-circle ${
                    idx < currentStep ? 'completed' : idx === currentStep ? 'active' : ''
                  }`}
                >
                  {idx < currentStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < totalSteps - 1 && (
                  <div className={`step-line ${idx < currentStep ? 'completed' : ''}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Category header */}
        <div className="vote-category-header">
          {totalSteps > 1 && (
            <span className="vote-category-step">
              Categoria {currentStep + 1} de {totalSteps}
            </span>
          )}
          <h2>{currentCategory.name}</h2>
          {currentCategory.description && (
            <p>{currentCategory.description}</p>
          )}
        </div>

        {/* Options */}
        <div className="vote-options stagger-children">
          {currentCategory.voting_options.map(option => (
            <button
              key={option.id}
              className={`vote-option-card ${
                currentSelection === option.id ? 'vote-option-selected' : ''
              }`}
              onClick={() => onSelect(currentCategory.id, option.id)}
              type="button"
            >
              <div className="vote-option-radio">
                {currentSelection === option.id && (
                  <div className="vote-option-radio-dot" />
                )}
              </div>
              <div className="vote-option-content">
                <h4>{option.name}</h4>
                {option.description && <p>{option.description}</p>}
              </div>
              {currentSelection === option.id && (
                <div className="vote-option-check">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="vote-nav">
          {currentStep > 0 && (
            <button className="btn btn-secondary" onClick={onPrev} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Anterior
            </button>
          )}

          <div className="vote-nav-spacer" />

          {!isLastStep && (
            <button
              className="btn btn-primary"
              onClick={onNext}
              disabled={!currentSelection}
              type="button"
            >
              Próxima
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {isLastStep && (
            <button
              className="btn btn-primary btn-lg"
              onClick={onConfirm}
              disabled={!allSelected}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Confirmar Voto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Confirm Modal ─── */
function ConfirmModal({ categories, selections, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirmar Voto</h3>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--gray-600)' }}>
            Por favor reveja as suas escolhas antes de submeter. Esta ação é
            irreversível.
          </p>

          <div className="confirm-summary">
            {categories.map(cat => {
              const selectedOption = cat.voting_options.find(
                o => o.id === selections[cat.id]
              )
              return (
                <div key={cat.id} className="confirm-item">
                  <span className="confirm-category">{cat.name}</span>
                  <span className="confirm-choice">
                    {selectedOption?.name || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} type="button">
            Voltar
          </button>
          <button className="btn btn-primary" onClick={onConfirm} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Submeter Voto
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Submitting State ─── */
function SubmittingState() {
  return (
    <div className="vote-state-container">
      <div className="spinner spinner-lg" />
      <p className="vote-state-text">A submeter o seu voto...</p>
    </div>
  )
}

/* ─── Success State ─── */
function SuccessState() {
  return (
    <div className="vote-state-container animate-fade-in">
      {/* Confetti */}
      <div className="confetti-container" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              '--x': `${Math.random() * 100}vw`,
              '--delay': `${Math.random() * 1.5}s`,
              '--color': ['#397f8e', '#38a169', '#dd6b20', '#e53e3e', '#3182ce', '#2c6370'][i % 6],
              '--rotation': `${Math.random() * 720}deg`,
              '--duration': `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Checkmark */}
      <div className="success-checkmark">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="30"
            fill="none"
            stroke="var(--success)"
            strokeWidth="3"
            className="success-circle"
          />
          <polyline
            points="20,34 28,42 44,24"
            fill="none"
            stroke="var(--success)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="success-check"
          />
        </svg>
      </div>

      <h2>Obrigado pelo seu voto!</h2>
      <p className="vote-state-text">
        O seu voto foi registado com sucesso. Pode fechar esta página.
      </p>

      <div className="success-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Voto seguro e confidencial
      </div>
    </div>
  )
}

/* ─── Page Styles ─── */
function PageStyles() {
  return (
    <style>{`
      .vote-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(ellipse at top right, rgba(57, 127, 142, 0.06) 0%, transparent 60%),
          radial-gradient(ellipse at bottom left, rgba(44, 99, 112, 0.04) 0%, transparent 60%),
          var(--gray-50);
      }

      /* Header */
      .vote-header {
        position: sticky;
        top: 0;
        z-index: var(--z-sticky);
        border-bottom: 1px solid var(--gray-100);
      }

      .vote-header-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 60px;
      }

      .vote-header-logo {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .vote-logo-img {
        border-radius: 6px;
      }

      .vote-logo-text {
        font-family: var(--font-heading);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--gray-900);
      }

      /* Main */
      .vote-main {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      /* State containers */
      .vote-state-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        padding: var(--space-xl);
        text-align: center;
        gap: var(--space-md);
      }

      .vote-state-container h2 {
        font-size: 1.6rem;
        color: var(--gray-900);
      }

      .vote-state-text {
        font-size: 1rem;
        color: var(--gray-500);
        max-width: 400px;
        line-height: 1.6;
      }

      .vote-error-icon {
        font-size: 3rem;
        margin-bottom: var(--space-sm);
      }

      /* Session description */
      .vote-session-desc {
        text-align: center;
        color: var(--gray-500);
        margin-bottom: var(--space-lg);
        font-size: 0.95rem;
      }

      /* Voting content */
      .vote-content {
        padding: var(--space-xl) 0 var(--space-3xl);
      }

      .vote-category-header {
        text-align: center;
        margin-bottom: var(--space-xl);
      }

      .vote-category-step {
        display: inline-block;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: var(--space-sm);
      }

      .vote-category-header h2 {
        font-size: 1.6rem;
        margin-bottom: var(--space-sm);
      }

      .vote-category-header p {
        font-size: 0.95rem;
        color: var(--gray-500);
        max-width: 500px;
        margin: 0 auto;
      }

      /* Options */
      .vote-options {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        max-width: 600px;
        margin: 0 auto var(--space-xl);
      }

      .vote-option-card {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-lg) var(--space-xl);
        background: var(--white);
        border: 2px solid var(--gray-100);
        border-radius: var(--radius-lg);
        cursor: pointer;
        text-align: left;
        transition:
          border-color var(--transition-fast),
          box-shadow var(--transition-fast),
          background-color var(--transition-fast),
          transform var(--transition-fast);
        font-family: inherit;
        font-size: inherit;
        width: 100%;
      }

      .vote-option-card:hover {
        border-color: var(--primary-300);
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }

      .vote-option-selected {
        border-color: var(--primary) !important;
        background: var(--primary-50) !important;
        box-shadow: var(--shadow-primary) !important;
      }

      .vote-option-radio {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid var(--gray-300);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: border-color var(--transition-fast);
      }

      .vote-option-selected .vote-option-radio {
        border-color: var(--primary);
      }

      .vote-option-radio-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--primary);
        animation: scaleIn var(--transition-spring) forwards;
      }

      .vote-option-content {
        flex: 1;
        min-width: 0;
      }

      .vote-option-content h4 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--gray-900);
        margin-bottom: 2px;
      }

      .vote-option-content p {
        font-size: 0.88rem;
        color: var(--gray-500);
        line-height: 1.5;
      }

      .vote-option-check {
        color: var(--primary);
        flex-shrink: 0;
        animation: scaleIn var(--transition-spring) forwards;
      }

      /* Navigation */
      .vote-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-md);
        max-width: 600px;
        margin: 0 auto;
      }

      .vote-nav-spacer {
        flex: 1;
      }

      /* Confirm summary */
      .confirm-summary {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .confirm-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md);
        background: var(--gray-50);
        border-radius: var(--radius-md);
        gap: var(--space-md);
      }

      .confirm-category {
        font-size: 0.88rem;
        color: var(--gray-600);
        font-weight: 500;
      }

      .confirm-choice {
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--gray-900);
        text-align: right;
      }

      /* Success */
      .success-checkmark {
        margin-bottom: var(--space-md);
      }

      .success-circle {
        stroke-dasharray: 190;
        stroke-dashoffset: 190;
        animation: checkmarkCircle 600ms ease-out 200ms forwards;
      }

      .success-check {
        stroke-dasharray: 50;
        stroke-dashoffset: 50;
        animation: checkmarkDraw 400ms ease-out 700ms forwards;
      }

      @keyframes checkmarkCircle {
        to { stroke-dashoffset: 0; }
      }

      @keyframes checkmarkDraw {
        to { stroke-dashoffset: 0; }
      }

      .success-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        margin-top: var(--space-md);
        padding: 8px 16px;
        background: var(--success-light);
        color: var(--success-dark);
        border-radius: var(--radius-full);
        font-size: 0.85rem;
        font-weight: 600;
      }

      /* Confetti */
      .confetti-container {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 50;
        overflow: hidden;
      }

      .confetti-piece {
        position: absolute;
        top: -10px;
        left: var(--x);
        width: 10px;
        height: 10px;
        background: var(--color);
        border-radius: 2px;
        animation: confettiFall var(--duration) ease-out var(--delay) forwards;
        opacity: 0;
      }

      .confetti-piece:nth-child(even) {
        width: 6px;
        height: 14px;
        border-radius: 3px;
      }

      .confetti-piece:nth-child(3n) {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      @keyframes confettiFall {
        0% {
          opacity: 1;
          transform: translateY(0) rotate(0deg);
        }
        100% {
          opacity: 0;
          transform: translateY(100vh) rotate(var(--rotation));
        }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .vote-content {
          padding: var(--space-lg) 0 var(--space-2xl);
        }

        .vote-option-card {
          padding: var(--space-md) var(--space-lg);
        }

        .vote-nav {
          flex-wrap: wrap;
        }

        .vote-nav .btn-lg {
          width: 100%;
          order: -1;
        }
      }

      @media (max-width: 480px) {
        .vote-header-session {
          display: none;
        }

        .vote-state-container h2 {
          font-size: 1.3rem;
        }
      }
    `}</style>
  )
}
