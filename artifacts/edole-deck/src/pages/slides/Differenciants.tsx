import shotReports from "@assets/screenshots/12-reports.jpg";
import shotMap from "@assets/screenshots/13-map.jpg";

export default function Differenciants() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0F1115] text-white">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55vw 60vh at 20% 100%, rgba(255,107,0,0.22), transparent 60%)",
        }}
      />

      <div className="relative h-full flex flex-col px-[5vw] py-[6vh]">
        <div className="flex items-start justify-between mb-[3vh]">
          <div>
            <div className="text-[0.9vw] tracking-[0.38em] uppercase font-semibold text-[#FF6B00] mb-[1.8vh]">
              Module 13 · Reporting & terrain
            </div>
            <div className="font-display text-[4.2vw] leading-[1] font-extrabold tracking-[-0.03em]">
              La donnée
            </div>
            <div className="font-display text-[4.2vw] leading-[1] font-extrabold tracking-[-0.03em] text-[#FF6B00]">
              rendue lisible.
            </div>
          </div>
          <div className="max-w-[32vw] pt-[2vh] text-[1.15vw] leading-[1.55] text-white/70">
            Rapports exportables en PDF, cartographie des chantiers, plan de
            charge des équipes. Pour comprendre l'activité en un regard et
            partager avec les parties prenantes.
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-[1.6vw]">
          <div className="flex flex-col">
            <div className="rounded-[0.8vw] overflow-hidden ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex-1">
              <img src={shotReports} crossOrigin="anonymous" alt="Rapports" className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white/[0.04] rounded-[0.6vw] px-[1.5vw] py-[1.8vh] mt-[1.2vh] ring-1 ring-white/10">
              <div className="text-[0.8vw] uppercase tracking-[0.3em] font-bold text-[#FF6B00] mb-[0.6vh]">
                Rapports · Exports
              </div>
              <div className="text-[1.05vw] leading-[1.5] text-white/80">
                Plan de charge, performance projets, consommation matériel —
                exportables en PDF signé.
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="rounded-[0.8vw] overflow-hidden ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex-1">
              <img src={shotMap} crossOrigin="anonymous" alt="Carte territoriale" className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white/[0.04] rounded-[0.6vw] px-[1.5vw] py-[1.8vh] mt-[1.2vh] ring-1 ring-white/10">
              <div className="text-[0.8vw] uppercase tracking-[0.3em] font-bold text-[#FF6B00] mb-[0.6vh]">
                Carte · Mobilité
              </div>
              <div className="text-[1.05vw] leading-[1.5] text-white/80">
                Chantiers géolocalisés, zones d'intervention, logistique
                inter-sites en un coup d'œil.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[0.85vw] text-white/40 mt-[2vh]">
          <div className="font-semibold uppercase tracking-[0.3em]">
            Rapports · Carte · Mobilité · Export PDF
          </div>
          <div className="font-mono tracking-[0.2em]">13 / 15</div>
        </div>
      </div>
    </div>
  );
}
