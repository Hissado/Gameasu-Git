export default function Overview() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[6vh] pb-[5vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Vue d'ensemble
        </div>
        <div className="flex items-end justify-between mt-[2vh]">
          <h2 className="font-display text-white text-[3.6vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Une plateforme, <span className="text-[#FF6B00]">chaque chantier.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.1vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            EDOLE consolide votre exploitation BTP dans un seul espace de travail bilingue, mobile et conforme OHADA.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3.5vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-3 gap-[1.8vw]">
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2.5vw] flex flex-col">
          <div className="w-[3vw] h-[3vw] rounded-[0.4vw] bg-[#FFF1E5] flex items-center justify-center">
            <div className="grid grid-cols-2 gap-[0.25vw]">
              <div className="w-[0.7vw] h-[0.7vw] bg-[#FF6B00] rounded-[2px]" />
              <div className="w-[0.7vw] h-[0.7vw] bg-[#FF6B00] rounded-[2px]" />
              <div className="w-[0.7vw] h-[0.7vw] bg-[#FF6B00] rounded-[2px]" />
              <div className="w-[0.7vw] h-[0.7vw] bg-[#FF6B00] rounded-[2px]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.7vw] font-bold mt-[2.5vh]">Espace Direction</h3>
          <p className="font-body text-[#5C5D67] text-[1.05vw] leading-relaxed mt-[1.2vh]">
            Outils complets pour les équipes de pilotage — KPI, rapports financiers, alertes intelligentes et reporting.
          </p>
          <div className="mt-auto pt-[3vh] space-y-[1.2vh]">
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#FF6B00]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Tableau de bord temps réel</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#FF6B00]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Alertes priorisées 24/7</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#FF6B00]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Rapports PDF exportables</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[2.5vw] flex flex-col">
          <div className="w-[3vw] h-[3vw] rounded-[0.4vw] bg-[#E8F0FE] flex items-center justify-center">
            <div className="w-[1.5vw] h-[1.2vw] border-[2px] border-[#2563EB] rounded-[2px] relative">
              <div className="absolute -top-[0.4vw] left-1/2 -translate-x-1/2 w-[0.7vw] h-[0.5vw] bg-[#2563EB] rounded-t-[2px]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.7vw] font-bold mt-[2.5vh]">Espace Terrain</h3>
          <p className="font-body text-[#5C5D67] text-[1.05vw] leading-relaxed mt-[1.2vh]">
            Conçu pour la mobilité — chefs de chantier, magasiniers et collaborateurs travaillent depuis leur smartphone.
          </p>
          <div className="mt-auto pt-[3vh] space-y-[1.2vh]">
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#2563EB]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">QR codes équipement</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#2563EB]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">États des lieux photo</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#2563EB]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Interface 100% responsive</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[2.5vw] flex flex-col">
          <div className="w-[3vw] h-[3vw] rounded-[0.4vw] bg-[#E6F7F1] flex items-center justify-center">
            <div className="w-[1.6vw] h-[1.6vw] rounded-full border-[2px] border-[#10B981] relative">
              <div className="absolute inset-[0.3vw] border-t-[2px] border-[#10B981]" />
              <div className="absolute inset-[0.3vw] border-l-[2px] border-[#10B981]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.7vw] font-bold mt-[2.5vh]">Conformité OHADA</h3>
          <p className="font-body text-[#5C5D67] text-[1.05vw] leading-relaxed mt-[1.2vh]">
            Comptabilité native conforme au référentiel OHADA — bilan, résultat et balance générés automatiquement.
          </p>
          <div className="mt-auto pt-[3vh] space-y-[1.2vh]">
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#10B981]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Plan comptable pré-chargé</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#10B981]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Bilan en un clic</span>
            </div>
            <div className="flex items-center gap-[0.8vw]">
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-[#10B981]" />
              <span className="font-body text-[#0F1115] text-[1.05vw]">Rapprochement bancaire</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0F1115] px-[5vw] py-[2.8vh] grid grid-cols-5 gap-[2vw]">
        <div>
          <div className="font-display text-[#FF6B00] text-[1.1vw] font-bold">React 19</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.5vh]">Frontend</div>
        </div>
        <div>
          <div className="font-display text-[#FF6B00] text-[1.1vw] font-bold">Express 5</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.5vh]">Backend</div>
        </div>
        <div>
          <div className="font-display text-[#FF6B00] text-[1.1vw] font-bold">PostgreSQL</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.5vh]">Base de données</div>
        </div>
        <div>
          <div className="font-display text-[#FF6B00] text-[1.1vw] font-bold">TypeScript</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.5vh]">Langage</div>
        </div>
        <div>
          <div className="font-display text-[#FF6B00] text-[1.1vw] font-bold">Mobile-Ready</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.5vh]">PWA</div>
        </div>
      </div>
    </div>
  );
}
