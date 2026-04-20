import hero from "@assets/screenshots/01-dashboard.jpg";
import logo from "@assets/image_1776704245067.png";

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0F1115] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1115] via-[#13161c] to-[#0A0B0E]" />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60vw 70vh at 80% 40%, rgba(255,107,0,0.28), transparent 60%)",
        }}
      />

      <div className="absolute right-[-4vw] top-[9vh] w-[64vw] h-[78vh] rounded-[1.2vw] overflow-hidden ring-1 ring-white/15 shadow-[0_40px_100px_rgba(0,0,0,0.65)] rotate-[-2.5deg]">
        <img
          src={hero}
          crossOrigin="anonymous"
          className="w-full h-full object-cover object-left-top"
          alt="Tableau de bord EDOLE"
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #0F1115 0%, rgba(15,17,21,0.92) 38%, rgba(15,17,21,0) 62%)",
        }}
      />

      <div className="relative h-full flex flex-col justify-between px-[6vw] py-[6.5vh]">
        <img src={logo} crossOrigin="anonymous" alt="EDOLE AFRICA" className="h-[5vh] w-auto object-contain self-start" />

        <div className="max-w-[60vw]">
          <div className="text-[0.95vw] tracking-[0.42em] uppercase font-semibold text-[#FF6B00] mb-[3.5vh]">
            Plateforme intégrée · BTP Afrique francophone
          </div>
          <div className="font-display text-[6.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] mb-[1.5vh]">
            Une seule plateforme
          </div>
          <div className="font-display text-[6.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] mb-[1.5vh]">
            pour piloter
          </div>
          <div className="font-display text-[6.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] text-[#FF6B00] mb-[4.5vh]">
            vos chantiers.
          </div>
          <p className="text-[1.45vw] leading-[1.55] text-white/75 max-w-[46vw]">
            Clients, services, projets, finances et matériel — unifiés dans
            un espace de travail pensé pour les entreprises du Bâtiment et
            des Travaux Publics.
          </p>
        </div>

        <div className="flex items-end justify-between text-[1vw] text-white/45">
          <div>Présentation produit — Avril 2026</div>
          <div className="font-mono tracking-[0.2em] text-white/55">01 / 15</div>
        </div>
      </div>
    </div>
  );
}
