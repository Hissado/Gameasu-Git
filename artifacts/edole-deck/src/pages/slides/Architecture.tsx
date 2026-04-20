export default function Architecture() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#F4F5F8] text-[#0F1115]">
      <div className="absolute top-0 left-0 right-0 h-[42vh] bg-[#0F1115]" />

      <div className="relative px-[5vw] pt-[6vh] pb-[4vh]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[0.9vw] tracking-[0.42em] uppercase font-semibold text-[#FF6B00] mb-[1.8vh]">
              02 · Architecture
            </div>
            <div className="font-display text-[4.8vw] leading-[1] font-extrabold tracking-[-0.03em] text-white">
              14 modules.
            </div>
            <div className="font-display text-[4.8vw] leading-[1] font-extrabold tracking-[-0.03em] text-white/70">
              Quatre univers.
            </div>
          </div>
          <div className="max-w-[32vw] text-[1.15vw] leading-[1.6] text-white/70 pt-[2vh]">
            EDOLE s'organise autour du <span className="text-[#FF6B00] font-semibold">Client</span>,
            entité racine de la plateforme. Chaque module communique
            nativement avec les autres — sans silos ni ressaisies manuelles.
          </div>
        </div>
      </div>

      <div className="relative px-[5vw] pb-[5vh] grid grid-cols-4 gap-[1.4vw] mt-[1vh]">
        <div className="bg-white rounded-[0.8vw] p-[2vh] shadow-[0_10px_30px_rgba(15,17,21,0.08)] ring-1 ring-black/5">
          <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#FF6B00] mb-[1.2vh]">
            Espace de travail
          </div>
          <div className="font-display text-[1.4vw] font-bold leading-[1.2] mb-[1.5vh]">
            L'opérationnel
          </div>
          <div className="space-y-[0.8vh] text-[0.95vw] text-[#0F1115]/75">
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Tableau de bord
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Clients
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Services & engagements
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Projets & chantiers
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Tâches
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Messagerie
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.8vw] p-[2vh] shadow-[0_10px_30px_rgba(15,17,21,0.08)] ring-1 ring-black/5">
          <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#FF6B00] mb-[1.2vh]">
            Pilotage
          </div>
          <div className="font-display text-[1.4vw] font-bold leading-[1.2] mb-[1.5vh]">
            La performance
          </div>
          <div className="space-y-[0.8vh] text-[0.95vw] text-[#0F1115]/75">
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              FP&amp;A exécutif
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Rapports
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Carte territoriale
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Alertes
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.8vw] p-[2vh] shadow-[0_10px_30px_rgba(15,17,21,0.08)] ring-1 ring-black/5">
          <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#FF6B00] mb-[1.2vh]">
            Finance & RH
          </div>
          <div className="font-display text-[1.4vw] font-bold leading-[1.2] mb-[1.5vh]">
            La solidité
          </div>
          <div className="space-y-[0.8vh] text-[0.95vw] text-[#0F1115]/75">
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Comptabilité OHADA
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Factures & paiements
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Ressources humaines
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              CRM commercial
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.8vw] p-[2vh] shadow-[0_10px_30px_rgba(15,17,21,0.08)] ring-1 ring-black/5">
          <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#FF6B00] mb-[1.2vh]">
            Terrain & matériel
          </div>
          <div className="font-display text-[1.4vw] font-bold leading-[1.2] mb-[1.5vh]">
            L'exécution
          </div>
          <div className="space-y-[0.8vh] text-[0.95vw] text-[#0F1115]/75">
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Inventaire & étiquettes QR
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Locations
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Inspections
            </div>
            <div className="flex gap-[0.6vw] items-center">
              <span className="w-[0.4vw] h-[0.4vw] bg-[#FF6B00] rounded-full" />
              Logistique
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[3vh] left-[5vw] right-[5vw] flex items-center justify-between text-[0.9vw] text-[#0F1115]/50">
        <div className="font-semibold uppercase tracking-[0.3em]">
          Architecture client-first · Du compte client à la consolidation financière
        </div>
        <div className="font-mono tracking-[0.2em]">02 / 15</div>
      </div>
    </div>
  );
}
