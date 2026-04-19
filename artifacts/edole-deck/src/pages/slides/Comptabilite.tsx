export default function Comptabilite() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0F1115] font-body flex flex-col">
      <div className="px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 08 — Comptabilité OHADA
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Votre bilan, <span className="text-[#FF6B00]">prêt en un clic.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Référentiel SYSCOHADA pré-chargé. Écritures continues. États financiers générés à la demande.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[3vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#FF6B00] text-[0.8vw] tracking-[0.3em] uppercase font-semibold mb-[2vh]">
            États financiers générés
          </div>
          <div className="grid grid-cols-2 gap-[1vw]">
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[2vh] border-l-[3px] border-l-[#FF6B00]">
              <div className="font-display text-white text-[1.4vw] font-bold">Bilan</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.5vh]">Actif et passif consolidés</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[2vh] border-l-[3px] border-l-[#FF6B00]">
              <div className="font-display text-white text-[1.4vw] font-bold">Compte de résultat</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.5vh]">Produits, charges, résultat net</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[2vh] border-l-[3px] border-l-[#FF6B00]">
              <div className="font-display text-white text-[1.4vw] font-bold">Balance</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.5vh]">Générale et auxiliaire</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[2vh] border-l-[3px] border-l-[#FF6B00]">
              <div className="font-display text-white text-[1.4vw] font-bold">Grand livre</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.5vh]">Mouvements détaillés par compte</div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#FF6B00] text-[0.8vw] tracking-[0.3em] uppercase font-semibold mb-[2vh]">
            Outils auxiliaires
          </div>
          <div className="space-y-[1.2vh]">
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.6vh] border-l-[3px] border-l-[#2563EB]">
              <div className="font-display text-white text-[1.15vw] font-bold leading-tight">Plan comptable SYSCOHADA</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Pré-chargé, modifiable, recherche par numéro</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.6vh] border-l-[3px] border-l-[#2563EB]">
              <div className="font-display text-white text-[1.15vw] font-bold leading-tight">Écritures comptables</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Saisie débit/crédit, contrôle d'équilibre</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.6vh] border-l-[3px] border-l-[#10B981]">
              <div className="font-display text-white text-[1.15vw] font-bold leading-tight">Comptes clients et fournisseurs</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Balance âgée, factures en attente, relances</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.6vh] border-l-[3px] border-l-[#10B981]">
              <div className="font-display text-white text-[1.15vw] font-bold leading-tight">Banques et caisses</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Rapprochement bancaire assisté</div>
            </div>
            <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.6vh] border-l-[3px] border-l-[#A855F7]">
              <div className="font-display text-white text-[1.15vw] font-bold leading-tight">Immobilisations</div>
              <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.3vh]">Registre + dotations aux amortissements</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0A0B0E] border-t border-[#2A2C33] px-[5vw] py-[2.8vh] grid grid-cols-4 gap-[2vw]">
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">SYSCOHADA</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Référentiel natif</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">FCFA</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Devise par défaut</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">Auto</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Postings depuis ventes</div>
        </div>
        <div className="text-center">
          <div className="font-display text-[#FF6B00] text-[2vw] font-extrabold leading-none">PDF</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Export commissaire</div>
        </div>
      </div>
    </div>
  );
}
