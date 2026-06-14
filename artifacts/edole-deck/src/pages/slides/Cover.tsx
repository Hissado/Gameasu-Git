import logo from "@assets/edole-logo-transparent.png";

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-white text-[#0F1115] flex flex-col">

      {/* Top bar — orange brand stripe */}
      <div className="h-[1.1vh] w-full bg-[#F37021]" />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — dark sidebar */}
        <div className="w-[38vw] bg-[#0F1115] flex flex-col justify-between px-[4vw] py-[6vh]">
          {/* Logo */}
          <img
            src={logo}
            crossOrigin="anonymous"
            alt="EDOLE"
            className="h-[7vh] w-auto object-contain self-start"
          />

          {/* Confidential / report label */}
          <div>
            <p className="text-[0.9vw] uppercase tracking-[0.3em] text-white/40 font-semibold mb-[1.5vh]">
              Document confidentiel
            </p>
            <div className="w-10 h-[3px] bg-[#F37021] mb-[4vh]" />
            <p className="text-[1.05vw] text-white/60 leading-[1.7]">
              Rapport préparé par<br />
              <span className="text-white font-semibold">EDOLE Africa</span>
            </p>
            <p className="text-[1vw] text-white/45 mt-[2vh] leading-[1.6]">
              Plateforme de pilotage<br />
              d'entreprise — Afrique de l'Ouest
            </p>
          </div>

          {/* Bottom — slide number */}
          <p className="font-mono text-[0.85vw] text-white/30 tracking-[0.2em]">01 / 14</p>
        </div>

        {/* Right panel — white content */}
        <div className="flex-1 flex flex-col justify-between px-[5.5vw] py-[7vh]">

          {/* Top right — company name */}
          <div className="text-right">
            <p className="text-[1vw] uppercase tracking-[0.3em] text-[#F37021] font-bold mb-[0.6vh]">
              Organisation
            </p>
            <p className="text-[2.4vw] font-extrabold tracking-tight text-[#0F1115]">
              EDOLE Africa
            </p>
          </div>

          {/* Center — main title block */}
          <div>
            <div className="w-14 h-[4px] bg-[#F37021] mb-[3.5vh]" />
            <p className="text-[1.1vw] uppercase tracking-[0.35em] text-[#0F1115]/50 font-semibold mb-[2.5vh]">
              Exercice fiscal 2025
            </p>
            <h1
              className="font-extrabold tracking-[-0.03em] text-[#0F1115] leading-[0.9] mb-[3vh]"
              style={{ fontSize: "clamp(2.8rem, 6.5vw, 7rem)" }}
            >
              Rapport<br />
              <span className="text-[#F37021]">de Gestion</span>
            </h1>
            <p className="text-[1.35vw] text-[#0F1115]/55 font-medium tracking-wide">
              Décembre 2025
            </p>
          </div>

          {/* Bottom — tagline */}
          <div className="flex items-end justify-between">
            <p className="text-[0.9vw] text-[#0F1115]/40 uppercase tracking-[0.25em]">
              Rapport de performance · Usage interne
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F37021]" />
              <p className="text-[0.85vw] text-[#0F1115]/40 font-mono">2025–2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-[0.5vh] w-full bg-[#0F1115]/10" />
    </div>
  );
}
