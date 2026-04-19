export default function Pilotage() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Module 1 — 5
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Pilotage <span className="text-[#FF6B00]">et alertes</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            La direction sait, en cinq secondes, ce qui se passe — et ce qui exige une décision aujourd'hui.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Outils de pilotage
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.8vh] flex items-center gap-[1.2vw] mb-[1.5vh]">
            <div className="w-[2.4vw] h-[2.4vw] rounded-[0.3vw] bg-[#FFF1E5] flex items-center justify-center">
              <div className="grid grid-cols-2 gap-[0.2vw]">
                <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
                <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
                <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
                <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.25vw] font-bold leading-tight">Tableau de bord</div>
              <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">KPI consolidés temps réel</div>
            </div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] px-[1.5vw] py-[1.8vh] flex items-center gap-[1.2vw] mb-[1.5vh]">
            <div className="w-[2.4vw] h-[2.4vw] rounded-[0.3vw] bg-[#E8F0FE] flex items-center justify-center">
              <div className="flex items-end gap-[0.2vw]">
                <div className="w-[0.3vw] h-[0.7vw] bg-[#2563EB] rounded-[1px]" />
                <div className="w-[0.3vw] h-[1.1vw] bg-[#2563EB] rounded-[1px]" />
                <div className="w-[0.3vw] h-[0.9vw] bg-[#2563EB] rounded-[1px]" />
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.25vw] font-bold leading-tight">Rapports</div>
              <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Stock quotidien, charge équipe, exports PDF</div>
            </div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] px-[1.5vw] py-[1.8vh] flex items-center gap-[1.2vw] mb-[1.5vh]">
            <div className="w-[2.4vw] h-[2.4vw] rounded-[0.3vw] bg-[#E6F7F1] flex items-center justify-center">
              <div className="w-[1.4vw] h-[1.4vw] rounded-full border-[2px] border-[#10B981] relative">
                <div className="absolute top-[-0.15vw] left-1/2 -translate-x-1/2 w-[0.3vw] h-[0.3vw] bg-[#10B981] rounded-full" />
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.25vw] font-bold leading-tight">Carte interactive</div>
              <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Géolocalisation chantiers et matériel</div>
            </div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] px-[1.5vw] py-[1.8vh] flex items-center gap-[1.2vw]">
            <div className="w-[2.4vw] h-[2.4vw] rounded-[0.3vw] bg-[#F3E8FF] flex items-center justify-center">
              <div className="w-[1vw] h-[1.2vw] bg-[#A855F7] rounded-t-full relative">
                <div className="absolute -bottom-[0.2vw] left-1/2 -translate-x-1/2 w-[0.4vw] h-[0.4vw] bg-[#A855F7] rounded-full" />
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.25vw] font-bold leading-tight">Alertes automatiques</div>
              <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Locations, factures, contrats, maintenance</div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Ce que vous gagnez
          </div>

          <div className="space-y-[2vh]">
            <div>
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold">Décision en 5 secondes</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.5vh] leading-relaxed">
                Chiffre d'affaires, créances, parc mobilisé : le dirigeant ouvre l'app et sait.
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold">Plus aucune échéance ratée</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.5vh] leading-relaxed">
                L'app scanne en arrière-plan toutes les 6h et remonte chaque alerte critique.
              </div>
            </div>
            <div>
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold">Reporting institutionnel</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.5vh] leading-relaxed">
                PDF prêts à présenter au comité de direction ou au commissaire aux comptes.
              </div>
            </div>
          </div>

          <div className="mt-[4vh] bg-[#0F1115] rounded-[0.4vw] grid grid-cols-3 px-[1.5vw] py-[2.2vh]">
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">6h</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Cycle alertes</div>
            </div>
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">4</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Types d'alerte</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">PDF</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Export rapport</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
