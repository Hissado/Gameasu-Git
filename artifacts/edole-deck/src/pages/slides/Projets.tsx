export default function Projets() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 02 — Projets / Chantiers
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            L'espace central <span className="text-[#FF6B00]">de pilotage.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Chaque chantier est un dossier vivant : équipe, matériel, budget, documents, tâches — tout converge ici.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-[1.15fr_1fr] gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Liste des chantiers — vue d'ensemble
          </div>

          <div className="bg-white rounded-[0.5vw] shadow-[0_2px_12px_rgba(15,17,21,0.06)] overflow-hidden">
            <div className="px-[1.5vw] py-[1.4vh] bg-[#FAFAFB] border-b border-[#E8E8EC] flex items-center justify-between">
              <div className="font-display text-[#0F1115] text-[1vw] font-bold">4 chantiers actifs</div>
              <div className="font-body text-[#FF6B00] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">+ Nouveau</div>
            </div>

            <div className="px-[1.5vw] py-[1.6vh] border-b border-[#F0F0F3]">
              <div className="flex items-center gap-[0.6vw]">
                <div className="w-[0.55vw] h-[0.55vw] rounded-full bg-[#D4A53A]" />
                <div className="font-display text-[#0F1115] text-[1.05vw] font-bold">Tour Horizon — Douala</div>
                <div className="ml-auto font-body text-[#5C5D67] text-[0.75vw]">SOGELEC Cameroun</div>
              </div>
              <div className="mt-[0.8vh] h-[0.4vw] bg-[#F0F0F3] rounded-full overflow-hidden">
                <div className="h-full bg-[#D4A53A] rounded-full" style={{ width: "20%" }} />
              </div>
              <div className="font-body text-[#5C5D67] text-[0.7vw] mt-[0.5vh]">1 / 5 tâches terminées · Budget 1 250 M FCFA</div>
            </div>

            <div className="px-[1.5vw] py-[1.6vh] border-b border-[#F0F0F3]">
              <div className="flex items-center gap-[0.6vw]">
                <div className="w-[0.55vw] h-[0.55vw] rounded-full bg-[#2563EB]" />
                <div className="font-display text-[#0F1115] text-[1.05vw] font-bold">Pont de Mfoundi — Yaoundé</div>
                <div className="ml-auto font-body text-[#5C5D67] text-[0.75vw]">MINTP</div>
              </div>
              <div className="mt-[0.8vh] h-[0.4vw] bg-[#F0F0F3] rounded-full overflow-hidden">
                <div className="h-full bg-[#2563EB] rounded-full" style={{ width: "65%" }} />
              </div>
              <div className="font-body text-[#5C5D67] text-[0.7vw] mt-[0.5vh]">13 / 20 tâches terminées · Budget 4 800 M FCFA</div>
            </div>

            <div className="px-[1.5vw] py-[1.6vh] border-b border-[#F0F0F3]">
              <div className="flex items-center gap-[0.6vw]">
                <div className="w-[0.55vw] h-[0.55vw] rounded-full bg-[#10B981]" />
                <div className="font-display text-[#0F1115] text-[1.05vw] font-bold">Centre médical — Libreville</div>
                <div className="ml-auto font-body text-[#5C5D67] text-[0.75vw]">BTP Gabon SARL</div>
              </div>
              <div className="mt-[0.8vh] h-[0.4vw] bg-[#F0F0F3] rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: "85%" }} />
              </div>
              <div className="font-body text-[#5C5D67] text-[0.7vw] mt-[0.5vh]">17 / 20 tâches terminées · Budget 2 100 M FCFA</div>
            </div>

            <div className="px-[1.5vw] py-[1.6vh]">
              <div className="flex items-center gap-[0.6vw]">
                <div className="w-[0.55vw] h-[0.55vw] rounded-full bg-[#A855F7]" />
                <div className="font-display text-[#0F1115] text-[1.05vw] font-bold">Mine Kolwezi — Phase 2</div>
                <div className="ml-auto font-body text-[#5C5D67] text-[0.75vw]">MinesCorp RDC</div>
              </div>
              <div className="mt-[0.8vh] h-[0.4vw] bg-[#F0F0F3] rounded-full overflow-hidden">
                <div className="h-full bg-[#A855F7] rounded-full" style={{ width: "40%" }} />
              </div>
              <div className="font-body text-[#5C5D67] text-[0.7vw] mt-[0.5vh]">8 / 20 tâches terminées · Budget 6 500 M FCFA</div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Tout converge sur un chantier
          </div>

          <div className="grid grid-cols-2 gap-[1vw]">
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#FF6B00] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Équipe</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Chef de projet RH + collaborateurs affectés</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#2563EB] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Matériel</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Équipements mobilisés, locations en cours</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#10B981] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Tâches</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Liste · Kanban · Calendrier</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#D4A53A] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Budget</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Suivi en FCFA, écarts vs prévisionnel</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#A855F7] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Documents</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Plans, contrats, photos, liens Drive</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#DC2626] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Alertes</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Maintenance, retards, factures impayées</div>
            </div>
          </div>

          <div className="mt-[2vh] bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.6vh]">
            <div className="font-display text-[#0F1115] text-[1.05vw] font-bold leading-tight">Position dans la navigation</div>
            <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.5vh] leading-relaxed">
              Sidebar gauche → groupe <span className="font-semibold text-[#0F1115]">Opérations</span> → entrée <span className="text-[#FF6B00] font-semibold">Chantiers</span>. Accessible aussi depuis chaque KPI du dashboard.
            </div>
          </div>

          <div className="mt-[2vh] bg-[#0F1115] rounded-[0.4vw] grid grid-cols-3 px-[1.5vw] py-[2vh]">
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">1</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Dossier vivant</div>
            </div>
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">6</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Briques liées</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">FCFA</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Budget natif</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
