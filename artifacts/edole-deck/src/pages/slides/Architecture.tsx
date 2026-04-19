export default function Architecture() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0F1115] font-body flex flex-col">
      <div className="px-[5vw] pt-[6vh] pb-[3vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Architecture produit
        </div>
        <div className="flex items-end justify-between mt-[2vh]">
          <h2 className="font-display text-white text-[3.6vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Huit univers, <span className="text-[#FF6B00]">un seul espace.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Une barre latérale unique. Chaque univers conçu pour une mission précise et connecté aux autres.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[3vh] grid grid-cols-4 gap-[1.4vw]">
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#FF6B00] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#FF6B00] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">01</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Pilotage</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Tableau de bord · Rapports · Carte · Alertes · Documents
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#2563EB] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#2563EB] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">02</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Communication</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Messagerie interne · Journal d'appels et historique
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#10B981] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#10B981] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">03</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Opérations</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Chantiers · Tâches en vues Liste, Kanban, Calendrier
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#A855F7] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#A855F7] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">04</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Matériel</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Inventaire · QR · Locations · Inspections · Logistique
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#FF6B00] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#FF6B00] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">05</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Commercial</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Clients · Services · Pipeline · Bons · Devis · Factures · Encaissements
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#2563EB] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#2563EB] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">06</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Marketing</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Campagnes Email et SMS · Base prospects · Conversion
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#10B981] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#10B981] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">07</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Ressources humaines</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Collaborateurs · Départements · Postes · Affectations · Contrats
          </div>
        </div>
        <div className="bg-[#1A1C22] rounded-[0.4vw] border-t-[3px] border-t-[#A855F7] p-[1.6vw] flex flex-col">
          <div className="font-body text-[#A855F7] text-[0.7vw] tracking-[0.25em] uppercase font-semibold">08</div>
          <div className="font-display text-white text-[1.4vw] font-extrabold mt-[1vh] leading-tight">Comptabilité OHADA</div>
          <div className="font-body text-[#94939E] text-[0.85vw] mt-[1.2vh] leading-relaxed flex-1">
            Plan · Écritures · Grand livre · Balance · Bilan · Résultat · Banques
          </div>
        </div>
      </div>

      <div className="bg-[#0A0B0E] border-t border-[#2A2C33] px-[5vw] py-[2.6vh] grid grid-cols-4 gap-[2vw]">
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">8</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.6vh]">Univers</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">60+</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.6vh]">Modules</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">5</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.6vh]">Rôles utilisateur</div>
        </div>
        <div className="text-center">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">1</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.25em] uppercase mt-[0.6vh]">Espace de travail</div>
        </div>
      </div>
    </div>
  );
}
