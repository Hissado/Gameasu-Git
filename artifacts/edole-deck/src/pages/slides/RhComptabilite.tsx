export default function RhComptabilite() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Module 4 — 5
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            RH et <span className="text-[#FF6B00]">Comptabilité OHADA</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            L'organisation, les contrats, et un référentiel comptable conforme — tout dans le même espace.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Ressources humaines
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.6vh] mb-[1.4vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Collaborateurs</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Fiche complète, photo, contrat, charge de travail</div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] px-[1.5vw] py-[1.6vh] mb-[1.4vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Départements et postes</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Structure organisationnelle complète</div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] px-[1.5vw] py-[1.6vh] mb-[1.4vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Affectations chantier</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Qui travaille où, anti-doublon</div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] px-[1.5vw] py-[1.6vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Contrats et documents</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">CDI, CDD, mission — alerte 30 jours avant fin</div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Comptabilité OHADA
          </div>

          <div className="bg-[#0F1115] rounded-[0.4vw] p-[2vw]">
            <div className="font-body text-[#FF6B00] text-[0.8vw] tracking-[0.25em] uppercase font-semibold">
              États financiers générés
            </div>
            <div className="mt-[2vh] grid grid-cols-2 gap-[1vw]">
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1vw] py-[1.4vh]">
                <div className="font-display text-white text-[1.2vw] font-bold">Bilan</div>
                <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Actif / Passif</div>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1vw] py-[1.4vh]">
                <div className="font-display text-white text-[1.2vw] font-bold">Résultat</div>
                <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Charges / Produits</div>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1vw] py-[1.4vh]">
                <div className="font-display text-white text-[1.2vw] font-bold">Balance</div>
                <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Générale et auxiliaire</div>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1vw] py-[1.4vh]">
                <div className="font-display text-white text-[1.2vw] font-bold">Grand livre</div>
                <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Mouvements détaillés</div>
              </div>
            </div>
            <div className="mt-[2vh] pt-[2vh] border-t border-[#2A2C33] grid grid-cols-3 gap-[1vw]">
              <div>
                <div className="font-display text-[#FF6B00] text-[1.5vw] font-extrabold leading-none">11</div>
                <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Vues compta</div>
              </div>
              <div>
                <div className="font-display text-[#FF6B00] text-[1.5vw] font-extrabold leading-none">FCFA</div>
                <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Devise</div>
              </div>
              <div>
                <div className="font-display text-[#FF6B00] text-[1.5vw] font-extrabold leading-none">1 clic</div>
                <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Export PDF</div>
              </div>
            </div>
          </div>

          <div className="mt-[2vh] bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] px-[1.5vw] py-[1.6vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Banques et immobilisations</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Rapprochement bancaire assisté, dotations auto</div>
          </div>
        </div>
      </div>
    </div>
  );
}
