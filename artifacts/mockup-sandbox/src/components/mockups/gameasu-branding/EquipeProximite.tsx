export function EquipeProximite() {
  const testimonials = [
    {
      quote: "Gaméasù a transformé notre infrastructure IT en moins de 6 mois. Leur équipe sur place à Lomé a fait toute la différence.",
      name: "Kofi Mensah",
      title: "DSI, Banque Panafricaine",
      country: "🇹🇬 Togo"
    },
    {
      quote: "Des experts certifiés, une vraie compréhension de nos enjeux africains. Gaméasù est bien plus qu'un prestataire, c'est un partenaire.",
      name: "Aïssatou Diallo",
      title: "DG, Réseau Éducatif Sahel",
      country: "🇲🇱 Mali"
    },
    {
      quote: "La migration cloud gérée par Gaméasù nous a permis de sécuriser nos données et de réduire nos coûts de 35%.",
      name: "Jean-Pierre Kouassi",
      title: "CTO, Groupe de Distribution",
      country: "🇨🇮 Côte d'Ivoire"
    }
  ];

  const values = [
    { icon: "🤝", label: "Proximité culturelle", desc: "Des équipes qui comprennent vos marchés, vos langues et vos réalités locales." },
    { icon: "🌍", label: "Présence terrain", desc: "Bureaux à Lomé, Abidjan et Bamako — des experts disponibles sur place." },
    { icon: "🏆", label: "Certifiés & expérimentés", desc: "Ingénieurs certifiés Microsoft, AWS et Google Cloud au service de vos projets." },
    { icon: "⚡", label: "Réactivité garantie", desc: "SLA contractuels, réponse P1 en moins de 30 minutes, 24h/24 et 7j/7." },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">G</span>
          </div>
          <span className="font-bold text-slate-900 text-xl tracking-tight">Gaméasù</span>
        </div>
        <div className="flex items-center gap-7 text-sm text-slate-600">
          <span className="hover:text-blue-600 cursor-pointer transition-colors font-medium">Services</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors font-medium">Afrique</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors font-medium">Carrières</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors font-medium">Contact</span>
        </div>
        <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-blue-200">
          Parler à un expert
        </button>
      </nav>

      {/* Hero — split layout with photo area */}
      <section className="grid grid-cols-2 min-h-[480px]">
        {/* Left — text */}
        <div className="flex flex-col justify-center px-14 py-16 bg-gradient-to-br from-slate-50 to-blue-50/30">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold mb-7 w-fit uppercase tracking-wide">
            🌍 USA · Afrique de l'Ouest · Europe
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-slate-900 leading-[1.1] mb-4">
            Des experts<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
              à vos côtés,
            </span>
            <br />partout où vous êtes.
          </h1>

          <p className="text-base font-bold text-blue-600 tracking-widest uppercase mb-4">
            Innover · Transformer · Sécuriser
          </p>

          <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-md">
            Gaméasù déploie des solutions technologiques modernes pour les 
            entreprises, institutions et organisations en Afrique et dans le monde — 
            avec une présence locale, des standards mondiaux et une équipe humaine.
          </p>

          <div className="flex gap-3">
            <button className="px-7 py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-blue-200">
              Demander une consultation
            </button>
            <button className="px-7 py-3.5 border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm hover:border-blue-300 hover:text-blue-600 transition-colors">
              Nos réalisations →
            </button>
          </div>
        </div>

        {/* Right — diverse team visual */}
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-teal-700 overflow-hidden">
          {/* Abstract people representation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-4 p-8 opacity-90">
              {[
                { bg: "bg-amber-400", emoji: "👩🏾‍💼", name: "Lomé", country: "🇹🇬" },
                { bg: "bg-blue-300", emoji: "👨🏽‍💻", name: "New Haven", country: "🇺🇸" },
                { bg: "bg-teal-400", emoji: "👩🏿‍🔬", name: "Abidjan", country: "🇨🇮" },
                { bg: "bg-orange-400", emoji: "👨🏾‍🏫", name: "Bamako", country: "🇲🇱" },
                { bg: "bg-white", emoji: "👩🏻‍💼", name: "Paris", country: "🇫🇷" },
                { bg: "bg-purple-300", emoji: "👨🏻‍💻", name: "Montréal", country: "🇨🇦" },
              ].map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 ${p.bg} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>
                    {p.emoji}
                  </div>
                  <div className="text-center">
                    <div className="text-white/90 text-xs font-semibold">{p.name}</div>
                    <div className="text-base">{p.country}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Overlay gradient at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-blue-700/80 to-transparent" />
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">
              Équipe multiculturelle · 7 pays · 3 continents
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-14 bg-white border-y border-slate-100">
        <div className="container mx-auto px-10">
          <div className="grid grid-cols-4 gap-5">
            {values.map((v, i) => (
              <div key={i} className="p-5 bg-slate-50 border border-slate-200 rounded-xl hover:border-teal-300 hover:bg-teal-50/30 transition-all">
                <div className="text-2xl mb-3">{v.icon}</div>
                <h3 className="font-bold text-slate-900 text-sm mb-2">{v.label}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-10">
          <p className="text-center text-xs text-teal-600 uppercase tracking-widest font-bold mb-3">Ce que disent nos clients</p>
          <h2 className="text-center text-2xl font-black text-slate-900 mb-10">Ils nous font confiance en Afrique et dans le monde</h2>
          <div className="grid grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-4">💬</div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="border-t border-slate-100 pt-4">
                  <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.title}</div>
                  <div className="text-xs font-semibold text-teal-600 mt-1">{t.country}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Color palette indicator */}
      <div className="fixed bottom-4 right-4 bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-xs text-slate-500">
        <div className="font-bold text-slate-800 mb-2">Variante C — Équipe & Proximité</div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded bg-blue-600" title="Blue primary" />
          <div className="w-5 h-5 rounded bg-teal-500" title="Teal accent" />
          <div className="w-5 h-5 rounded bg-amber-400" title="Amber warmth" />
          <div className="w-5 h-5 rounded bg-slate-50 border border-slate-200" title="Light bg" />
        </div>
      </div>
    </div>
  );
}
