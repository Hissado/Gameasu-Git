export default function Commercial() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 05 — Commercial
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Du prospect <span className="text-[#FF6B00]">au paiement.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Une chaîne unique, sans double saisie — du devis chiffré jusqu'à l'écriture comptable.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Pipeline en six étapes
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.2vh] mb-[0.8vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Clients · Services</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">Annuaire et catalogue de prestations BTP</div>
              </div>
              <span className="font-body text-[#9CA3AF] text-[1vw] font-bold">01</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-[0.2vh]">
            <span className="font-body text-[#FF6B00] text-[1.1vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.2vh] mb-[0.8vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Pipeline CRM</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">Identification → Qualification → Négociation</div>
              </div>
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">02</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-[0.2vh]">
            <span className="font-body text-[#FF6B00] text-[1.1vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.2vh] mb-[0.8vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Devis (proforma)</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">Multi-lignes, mentions légales, caution, validité</div>
              </div>
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">03</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-[0.2vh]">
            <span className="font-body text-[#FF6B00] text-[1.1vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.2vh] mb-[0.8vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Bon de commande</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">PDF signé client joint au dossier</div>
              </div>
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">04</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-[0.2vh]">
            <span className="font-body text-[#FF6B00] text-[1.1vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.2vh] mb-[0.8vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Facture émise</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">Numérotation auto, écriture comptable instantanée</div>
              </div>
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">05</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-[0.2vh]">
            <span className="font-body text-[#FF6B00] text-[1.1vw] font-bold leading-none">↓</span>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] px-[1.4vw] py-[1.2vh]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Encaissement</div>
                <div className="font-body text-[#5C5D67] text-[0.85vw]">Virement, espèces, chèque, mobile money</div>
              </div>
              <span className="font-body text-[#10B981] text-[1vw] font-bold">06</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Automatisations clés
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[1.8vw] mb-[1.5vh]">
            <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold leading-tight">Devis approuvé → facture créée</h3>
            <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1vh]">
              Dès la validation du devis, la facture correspondante est générée — référence, lignes, client, montant — avec lien comptable. Zéro double saisie.
            </p>
          </div>

          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[1.8vw] mb-[1.5vh]">
            <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold leading-tight">Encaissement → comptabilité</h3>
            <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1vh]">
              Chaque paiement met à jour atomiquement le solde de la facture et passe l'écriture trésorerie OHADA. Recouvrement et compta toujours alignés.
            </p>
          </div>

          <div className="bg-[#0F1115] rounded-[0.4vw] flex-1 p-[1.8vw] flex flex-col justify-center">
            <div className="font-body text-[#FF6B00] text-[0.7vw] tracking-[0.3em] uppercase font-semibold">
              Suivi en temps réel
            </div>
            <div className="grid grid-cols-3 gap-[1vw] mt-[1.5vh]">
              <div>
                <div className="font-display text-white text-[1.1vw] font-bold">Émis</div>
                <div className="font-body text-[#94939E] text-[0.8vw] mt-[0.3vh]">Total facturé</div>
              </div>
              <div>
                <div className="font-display text-white text-[1.1vw] font-bold">Encaissé</div>
                <div className="font-body text-[#94939E] text-[0.8vw] mt-[0.3vh]">Total réglé</div>
              </div>
              <div>
                <div className="font-display text-white text-[1.1vw] font-bold">Restant</div>
                <div className="font-body text-[#94939E] text-[0.8vw] mt-[0.3vh]">Créances ouvertes</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
