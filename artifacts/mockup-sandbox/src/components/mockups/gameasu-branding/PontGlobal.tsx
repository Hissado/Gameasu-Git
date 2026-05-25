export function PontGlobal() {
  const services = [
    { icon: "🛡️", label: "Cybersécurité" },
    { icon: "☁️", label: "Cloud & Infrastructure" },
    { icon: "🤖", label: "IA & Automatisation" },
    { icon: "🏢", label: "Modern Workplace" },
    { icon: "🔄", label: "Transformation Digitale" },
    { icon: "🛠️", label: "Services Managés" },
  ];

  const bridges = [
    { from: "🇺🇸 New Haven", to: "🇹🇬 Lomé", label: "Standards mondiaux → Afrique de l'Ouest" },
    { from: "🇫🇷 Paris", to: "🇨🇮 Abidjan", label: "Europe → Diaspora africaine" },
    { from: "🇨🇦 Montréal", to: "🇲🇱 Bamako", label: "Amérique du Nord → Mali" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 flex items-center justify-between px-10 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">G</span>
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">Gaméasù</span>
          <span className="text-blue-500 font-bold text-xs ml-1 uppercase tracking-widest">Global</span>
        </div>
        <div className="flex items-center gap-7 text-sm text-slate-600">
          <span className="hover:text-blue-600 cursor-pointer transition-colors">Services</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors">Présence Afrique</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors">À propos</span>
        </div>
        <button className="px-5 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
          Consultation →
        </button>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 overflow-hidden">
        {/* World connection lines SVG */}
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 1200 500" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
            {/* Simplified world outline dots */}
            {/* Connection arcs */}
            <path d="M 200 200 Q 600 100 900 280" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4,4"/>
            <path d="M 200 200 Q 450 320 700 350" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4,4"/>
            <path d="M 280 150 Q 550 80 850 200" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3,5"/>
            <path d="M 400 120 Q 650 200 900 180" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3,5"/>
            {/* City dots */}
            <circle cx="200" cy="200" r="6" fill="white" opacity="0.9"/>
            <circle cx="280" cy="150" r="4" fill="white" opacity="0.7"/>
            <circle cx="700" cy="350" r="6" fill="#FCD34D" opacity="0.9"/>
            <circle cx="800" cy="320" r="4" fill="#FCD34D" opacity="0.7"/>
            <circle cx="900" cy="280" r="4" fill="#FCD34D" opacity="0.7"/>
            <circle cx="850" cy="200" r="5" fill="white" opacity="0.8"/>
            <circle cx="900" cy="180" r="4" fill="white" opacity="0.7"/>
            {/* Labels */}
            <text x="170" y="192" fill="white" fontSize="9" opacity="0.8" fontWeight="bold">NEW HAVEN</text>
            <text x="255" y="142" fill="white" fontSize="8" opacity="0.6">MONTRÉAL</text>
            <text x="665" y="342" fill="#FCD34D" fontSize="9" opacity="0.9" fontWeight="bold">LOMÉ</text>
            <text x="770" y="312" fill="#FCD34D" fontSize="8" opacity="0.7">ABIDJAN</text>
            <text x="875" y="272" fill="#FCD34D" fontSize="8" opacity="0.7">BAMAKO</text>
            <text x="820" y="192" fill="white" fontSize="8" opacity="0.6">PARIS</text>
            <text x="870" y="172" fill="white" fontSize="8" opacity="0.6">BRUXELLES</text>
          </svg>
        </div>

        <div className="relative container mx-auto px-10 py-24 text-center">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold mb-8 uppercase tracking-widest">
            <span className="text-base">🌍</span>
            USA · Europe · Afrique de l'Ouest — 7 pays
          </div>

          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] mb-4 max-w-4xl mx-auto">
            Le pont entre les standards technologiques mondiaux et{" "}
            <span className="text-yellow-300">l'Afrique qui se transforme.</span>
          </h1>

          <p className="text-sm font-bold text-blue-200 tracking-[0.2em] uppercase mb-6">
            Innover · Transformer · Sécuriser
          </p>

          <p className="text-blue-100 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Fondée aux États-Unis en 2023, Gaméasù déploie des solutions technologiques 
            de classe mondiale auprès des entreprises, institutions et organisations 
            d'Afrique, d'Europe et d'Amérique du Nord.
          </p>

          <div className="flex justify-center gap-4">
            <button className="px-8 py-4 bg-yellow-400 text-slate-900 font-bold rounded-xl hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 text-sm">
              Demander une consultation
            </button>
            <button className="px-8 py-4 bg-white/10 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm">
              Voir notre présence Afrique
            </button>
          </div>
        </div>
      </section>

      {/* Bridge cards */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="container mx-auto px-10">
          <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-bold mb-6">
            Connexions actives — Notre pont entre continents
          </p>
          <div className="grid grid-cols-3 gap-4">
            {bridges.map((b, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>{b.from}</span>
                  <span className="text-blue-500">⟶</span>
                  <span>{b.to}</span>
                </div>
                <p className="text-xs text-slate-500">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-10">
          <p className="text-center text-xs text-blue-600 uppercase tracking-widest font-bold mb-3">Nos expertises</p>
          <h2 className="text-center text-3xl font-black text-slate-900 mb-10">Solutions de bout en bout</h2>
          <div className="grid grid-cols-3 gap-3">
            {services.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-default">
                <span className="text-2xl">{s.icon}</span>
                <span className="font-semibold text-slate-800 text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Africa focus band */}
      <section className="bg-gradient-to-r from-yellow-400 to-amber-500 py-10 px-10">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <p className="font-black text-slate-900 text-xl mb-1">🌍 Priorité Afrique</p>
            <p className="text-slate-800 text-sm">Bureaux locaux · Équipes sur le terrain · Compréhension des marchés</p>
          </div>
          <button className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-sm">
            Notre présence en Afrique →
          </button>
        </div>
      </section>

      {/* Color palette indicator */}
      <div className="fixed bottom-4 right-4 bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-xs text-slate-500">
        <div className="font-bold text-slate-800 mb-2">Variante B — Pont Global</div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded bg-blue-700" title="Blue primary" />
          <div className="w-5 h-5 rounded bg-yellow-400" title="Yellow accent CTA" />
          <div className="w-5 h-5 rounded bg-slate-50 border border-slate-200" title="Light bg" />
          <div className="w-5 h-5 rounded bg-slate-900" title="Dark text" />
        </div>
      </div>
    </div>
  );
}
