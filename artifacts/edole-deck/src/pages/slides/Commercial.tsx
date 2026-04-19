export default function Commercial() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Module 3 — 5
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Commercial <span className="text-[#FF6B00]">et marketing</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Du devis au paiement — une chaîne unique, sans double saisie, jusqu'à la campagne d'acquisition.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Cycle de vente
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.6vh] mb-[1.2vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Clients et services</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Annuaire unifié, catalogue de prestations BTP</div>
          </div>

          <div className="flex items-center justify-center my-[0.5vh]">
            <span className="font-body text-[#FF6B00] text-[1.4vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.6vh] mb-[1.2vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Pipeline et devis</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Opportunités, propositions chiffrées en FCFA</div>
          </div>

          <div className="flex items-center justify-center my-[0.5vh]">
            <span className="font-body text-[#FF6B00] text-[1.4vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.5vw] py-[1.6vh] mb-[1.2vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Bons de commande et factures</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Génération auto à l'approbation du devis</div>
          </div>

          <div className="flex items-center justify-center my-[0.5vh]">
            <span className="font-body text-[#FF6B00] text-[1.4vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] px-[1.5vw] py-[1.6vh]">
            <div className="font-display text-[#0F1115] text-[1.2vw] font-bold leading-tight">Encaissements</div>
            <div className="font-body text-[#5C5D67] text-[0.95vw] mt-[0.3vh]">Virement, espèces, mobile money — soldés en un clic</div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Acquisition et fidélisation
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] p-[2vw] mb-[2vh]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Campagnes email et SMS</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Segmentation des destinataires, édition du message, simulation d'envoi avec rapport de délivrabilité.
            </p>
            <div className="mt-[2vh] grid grid-cols-2 gap-[1vw]">
              <div className="bg-[#F4F5F8] rounded-[0.3vw] px-[1vw] py-[1.2vh]">
                <div className="font-display text-[#A855F7] text-[1.4vw] font-extrabold leading-none">Email</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Modèles personnalisables</div>
              </div>
              <div className="bg-[#F4F5F8] rounded-[0.3vw] px-[1vw] py-[1.2vh]">
                <div className="font-display text-[#A855F7] text-[1.4vw] font-extrabold leading-none">SMS</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Diffusion massive ciblée</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[2vw]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Base prospects</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Qualification, score, statut. Conversion en fiche client en un clic — le pipeline ne se vide jamais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
