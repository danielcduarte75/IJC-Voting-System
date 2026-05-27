import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <>
      <style>{`
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* Decorative background */
        .landing-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .landing-bg-gradient {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
        }

        .landing-bg-gradient-1 {
          top: -200px;
          right: -100px;
          background: var(--primary);
        }

        .landing-bg-gradient-2 {
          bottom: -200px;
          left: -100px;
          background: var(--primary-dark);
        }

        .landing-bg-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(var(--gray-200) 1px, transparent 1px);
          background-size: 32px 32px;
          opacity: 0.4;
        }

        /* Nav */
        .landing-nav {
          position: relative;
          z-index: 10;
          padding: var(--space-lg) 0;
        }

        .landing-nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-logo {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          text-decoration: none;
        }

        .landing-logo-img {
          border-radius: var(--radius-sm);
        }

        .landing-logo-text {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--gray-900);
          letter-spacing: -0.02em;
        }

        .landing-logo-text span {
          color: var(--primary);
        }

        /* Hero */
        .landing-hero {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-3xl) 0;
        }

        .landing-hero-inner {
          text-align: center;
          max-width: 680px;
          margin: 0 auto;
        }

        .landing-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-sm);
          padding: 6px 16px;
          background: var(--primary-light);
          color: var(--primary-dark);
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: var(--space-xl);
          animation: slideDown 600ms ease-out;
        }

        .landing-badge-dot {
          width: 8px;
          height: 8px;
          background: var(--primary);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        .landing-hero h1 {
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: var(--space-lg);
          animation: slideUp 600ms ease-out;
          animation-delay: 100ms;
          animation-fill-mode: both;
        }

        .landing-hero h1 .highlight {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .landing-hero-desc {
          font-size: 1.15rem;
          line-height: 1.7;
          color: var(--gray-600);
          margin-bottom: var(--space-2xl);
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
          animation: slideUp 600ms ease-out;
          animation-delay: 200ms;
          animation-fill-mode: both;
        }

        .landing-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
          animation: slideUp 600ms ease-out;
          animation-delay: 300ms;
          animation-fill-mode: both;
        }

        .landing-actions .btn {
          min-width: 280px;
        }

        .landing-info-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-md);
          padding: var(--space-lg);
          background: var(--white);
          border: 1px solid var(--gray-100);
          border-radius: var(--radius-lg);
          text-align: left;
          max-width: 440px;
          margin: 0 auto;
          box-shadow: var(--shadow-sm);
        }

        .landing-info-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: var(--radius-md);
          font-size: 1.3rem;
          flex-shrink: 0;
        }

        .landing-info-card h4 {
          font-size: 0.95rem;
          margin-bottom: 4px;
        }

        .landing-info-card p {
          font-size: 0.88rem;
          color: var(--gray-500);
          line-height: 1.5;
        }

        /* Features */
        .landing-features {
          position: relative;
          z-index: 10;
          padding: var(--space-2xl) 0 var(--space-4xl);
        }

        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-lg);
          max-width: 900px;
          margin: 0 auto;
        }

        .feature-card {
          text-align: center;
          padding: var(--space-xl) var(--space-lg);
          border-radius: var(--radius-lg);
          background: var(--white);
          border: 1px solid var(--gray-100);
          transition: all var(--transition-base);
        }

        .feature-card:hover {
          border-color: var(--primary-200);
          box-shadow: var(--shadow-md);
          transform: translateY(-4px);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-md);
          background: var(--primary-light);
          border-radius: var(--radius-md);
          font-size: 1.5rem;
        }

        .feature-card h4 {
          font-size: 1rem;
          margin-bottom: var(--space-sm);
        }

        .feature-card p {
          font-size: 0.88rem;
          color: var(--gray-500);
          line-height: 1.5;
        }

        /* Footer */
        .landing-footer {
          position: relative;
          z-index: 10;
          padding: var(--space-lg) 0;
          border-top: 1px solid var(--gray-100);
        }

        .landing-footer p {
          text-align: center;
          font-size: 0.85rem;
          color: var(--gray-400);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .landing-hero h1 {
            font-size: 2.4rem;
          }

          .landing-hero-desc {
            font-size: 1rem;
          }

          .landing-features-grid {
            grid-template-columns: 1fr;
            max-width: 400px;
          }

          .landing-actions .btn {
            min-width: 100%;
          }
        }

        @media (max-width: 480px) {
          .landing-hero h1 {
            font-size: 2rem;
          }
        }
      `}</style>

      <div className="landing">
        {/* Background decoration */}
        <div className="landing-bg">
          <div className="landing-bg-pattern" />
          <div className="landing-bg-gradient landing-bg-gradient-1" />
          <div className="landing-bg-gradient landing-bg-gradient-2" />
        </div>

        {/* Navigation */}
        <nav className="landing-nav">
          <div className="container landing-nav-inner">
            <div className="landing-logo">
              <Image
                src="/logo.png"
                alt="IJC Logo"
                width={80}
                height={80}
                className="landing-logo-img"
                priority
              />
              <span className="landing-logo-text">
                <span>IJC</span> Voting
              </span>
            </div>
            <Link href="/admin/login" className="btn btn-secondary btn-sm">
              Área de Administração
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <main className="landing-hero">
          <div className="container landing-hero-inner">
            <div className="landing-badge">
              <span className="landing-badge-dot" />
              Sistema de Votação Seguro
            </div>

            <h1>
              A sua voz,{" "}
              <span className="highlight">o seu voto.</span>
            </h1>

            <p className="landing-hero-desc">
              Sistema de votação digital da ISCTE Junior Consulting. Seguro,
              transparente e fácil de usar. Vote com confiança em qualquer
              dispositivo.
            </p>

            <div className="landing-actions">
              <div className="landing-info-card">
                <div className="landing-info-icon">🗳️</div>
                <div>
                  <h4>Como posso votar?</h4>
                  <p>
                    Contacte a comissão eleitoral para receber o seu link de
                    votação pessoal. Cada link é único e só pode ser utilizado
                    uma vez.
                  </p>
                </div>
              </div>

              <Link href="/admin/login" className="btn btn-primary btn-lg">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Aceder como Administrador
              </Link>
            </div>
          </div>
        </main>

        {/* Features */}
        <section className="landing-features">
          <div className="container">
            <div className="landing-features-grid stagger-children">
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h4>Seguro</h4>
                <p>
                  Tokens únicos garantem que cada voto é autêntico e que ninguém
                  pode votar duas vezes.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">👁️</div>
                <h4>Transparente</h4>
                <p>
                  Resultados em tempo real e auditoria completa de todo o
                  processo de votação.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h4>Acessível</h4>
                <p>
                  Vote de qualquer dispositivo — computador, tablet ou
                  telemóvel. Simples e intuitivo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="container">
            <p>© {new Date().getFullYear()} ISCTE Junior Consulting. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
