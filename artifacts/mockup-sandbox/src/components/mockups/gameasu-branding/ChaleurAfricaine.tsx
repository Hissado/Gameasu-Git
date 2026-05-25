export function ChaleurAfricaine() {
  const stats = [
    { value: "100+", label: "Missions livrées" },
    { value: "7", label: "Pays de présence" },
    { value: "98%", label: "Satisfaction client" },
    { value: "2023", label: "Fondée — New Haven, CT" },
  ];

  const presence = [
    { flag: "🇺🇸", city: "New Haven", role: "HQ" },
    { flag: "🇹🇬", city: "Lomé" },
    { flag: "🇨🇮", city: "Abidjan" },
    { flag: "🇲🇱", city: "Bamako" },
    { flag: "🇫🇷", city: "Paris" },
    { flag: "🇧🇪", city: "Bruxelles" },
    { flag: "🇨🇦", city: "Montréal" },
  ];

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-stone-950 font-black text-sm">G</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Gaméasù</span>
        </div>
        <div className="flex items-center gap-8 text-sm text-stone-400">
          <span className="hover:text-white cursor-pointer transition-colors">Services</span>
          <span className="hover:text-white cursor-pointer transition-colors">À propos</span>
          <span className="hover:text-white cursor-pointer transition-colors">Secteurs</span>
          <span className="hover:text-white cursor-pointer transition-colors">Contact</span>
        </div>
        <button className="px-5 py-2 bg-amber-500 text-stone-950 font-bold text-sm rounded-lg hover:bg-amber-400 transition-colors">
          Consultation
        </button>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* African geometric background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-amber-950/30 to-stone-950" />
          {/* African-inspired geometric pattern overlay */}
          <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="kente" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="none"/>
                <rect x="0" y="0" width="20" height="20" fill="#D97706" opacity="0.8"/>
                <rect x="20" y="20" width="20" height="20" fill="#D97706" opacity="0.8"/>
                <rect x="10" y="10" width="20" height="20" fill="#92400E" opacity="0.5"/>
                <line x1="0" y1="20" x2="40" y2="20" stroke="#F59E0B" strokeWidth="1"/>
                <line x1="20" y1="0" x2="20" y2="40" stroke="#F59E0B" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="400" height="400" fill="url(#kente)"/>
          </svg>
          {/* Warm glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-orange-700/15 rounded-full blur-3xl" />
        </div>

        <div className="relative container mx-auto px-10 py-24">
          <div className="grid grid-cols-2 gap-16 items-center min-h-[520px]">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-8 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Fondée aux États-Unis · Ancrée en Afrique
              </div>

              <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] mb-5">
                La technologie,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  au service de l'Afrique
                </span>{" "}
                et du monde.
              </h1>

              <p className="text-sm font-bold text-amber-400 tracking-[0.2em] uppercase mb-5">
                Innover · Transformer · Sécuriser
              </p>

              <p className="text-stone-400 text-lg leading-relaxed mb-10 max-w-lg">
                Gaméasù accompagne les entreprises, institutions, ONG et organisations 
                d'Afrique et du monde dans leur transformation numérique — avec des standards 
                techniques mondiaux et une profonde compréhension des marchés locaux.
              </p>

              <div className="flex gap-4">
                <button className="px-7 py-3.5 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/30 text-sm">
                  Demander une consultation →
                </button>
                <button className="px-7 py-3.5 border border-stone-700 text-stone-300 font-semibold rounded-xl hover:border-stone-500 hover:text-white transition-all text-sm">
                  Découvrir nos services
                </button>
              </div>
            </div>

            {/* Right — presence card */}
            <div className="space-y-4">
              <div className="bg-stone-900/80 backdrop-blur border border-stone-700 rounded-2xl p-6">
                <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-4">
                  🌍 Présence internationale
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {presence.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-stone-800/60 rounded-lg">
                      <span className="text-lg">{p.flag}</span>
                      <span className="text-sm text-stone-300 font-medium">{p.city}</span>
                      {p.role && (
                        <span className="text-xs text-amber-400 font-bold ml-auto">HQ</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-stone-900/80 backdrop-blur border border-stone-700 rounded-2xl p-5">
                <p className="text-xs text-stone-500 font-bold uppercase tracking-widest mb-3">Focus Afrique de l'Ouest</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 text-base mt-0.5">🤝</div>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    Bureaux à Lomé, Abidjan et Bamako pour mieux servir les entreprises, 
                    institutions et PME d'Afrique de l'Ouest.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-stone-800 bg-stone-900/50">
        <div className="container mx-auto px-10 py-6">
          <div className="grid grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-black text-amber-400 mb-1">{s.value}</div>
                <div className="text-xs text-stone-500 uppercase tracking-widest font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sectors */}
      <section className="py-16 px-10">
        <p className="text-center text-xs text-stone-600 uppercase tracking-[0.25em] font-bold mb-8">
          Secteurs servis — Entreprises · Institutions · PME · ONG · Organisations publiques
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {["Finance & Banque", "Télécommunications", "Éducation", "Santé", "Secteur Public", "ONG & Humanitaire", "Industrie & Commerce", "Énergie & Mines"].map((s, i) => (
            <span key={i} className="px-4 py-2 bg-stone-900 border border-stone-700 text-stone-400 text-xs font-semibold rounded-full hover:border-amber-500/40 hover:text-amber-400 transition-colors cursor-default">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Color palette indicator */}
      <div className="fixed bottom-4 right-4 bg-stone-900 border border-stone-700 rounded-xl p-3 text-xs text-stone-400">
        <div className="font-bold text-white mb-2">Variante A — Chaleur Africaine</div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded bg-amber-500" title="Amber primary" />
          <div className="w-5 h-5 rounded bg-orange-600" title="Orange accent" />
          <div className="w-5 h-5 rounded bg-stone-900 border border-stone-700" title="Dark bg" />
          <div className="w-5 h-5 rounded bg-stone-300" title="Light text" />
        </div>
      </div>
    </div>
  );
}
