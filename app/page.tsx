export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Hi, back to top">
          hi<span>.</span>
        </a>
        <div className="nav-meta" aria-label="Page details">
          <span>One small page</span>
          <span className="nav-dot" aria-hidden="true" />
          <span>A big first step</span>
        </div>
        <a className="nav-link" href="#about">
          Meet the page <span aria-hidden="true">↘</span>
        </a>
      </nav>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true">✦</span> Broadcasting from the internet
          </p>
          <h1 id="hero-title">
            Hello,
            <span>world.</span>
          </h1>
          <p className="intro">
            A tiny phrase with infinite possibility. This is where ideas wake
            up, find their voice, and say hello.
          </p>
          <a className="cta" href="#about">
            Start here <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="signal" aria-hidden="true">
          <div className="signal-orbit signal-orbit-one" />
          <div className="signal-orbit signal-orbit-two" />
          <div className="signal-core">
            <span>H</span>
            <span>I</span>
          </div>
          <p className="signal-label signal-label-top">Sending a signal</p>
          <p className="signal-label signal-label-bottom">Loud &amp; clear</p>
        </div>
      </section>

      <section className="ticker" aria-label="A friendly message">
        <div>
          <span>Hello stranger</span><i>✦</i>
          <span>Hello friend</span><i>✦</i>
          <span>Hello future</span><i>✦</i>
          <span>Hello stranger</span><i>✦</i>
          <span>Hello friend</span><i>✦</i>
          <span>Hello future</span><i>✦</i>
        </div>
      </section>

      <section className="about" id="about" aria-labelledby="about-title">
        <div className="section-number">01 / 01</div>
        <div className="about-copy">
          <p className="eyebrow dark">The whole story</p>
          <h2 id="about-title">Every great thing starts with an introduction.</h2>
        </div>
        <div className="about-notes">
          <p>
            No grand pitch. No complicated roadmap. Just a bright blue dot on
            the web, saying hello and making room for whatever comes next.
          </p>
          <div className="mini-grid">
            <div>
              <span className="mini-value">01</span>
              <span className="mini-label">Page</span>
            </div>
            <div>
              <span className="mini-value">02</span>
              <span className="mini-label">Words</span>
            </div>
            <div>
              <span className="mini-value">∞</span>
              <span className="mini-label">Possibilities</span>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <p>Made to say one thing well.</p>
        <a href="#top">Back to hello ↑</a>
        <p>© 2026</p>
      </footer>
    </main>
  );
}
