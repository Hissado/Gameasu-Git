export default function Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[6vh] pb-[5vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Le problème — La solution
        </div>
        <div className="flex items-end justify-between mt-[2vh]">
          <h2 className="font-display text-white text-[3.6vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Du chaos opérationnel <span className="text-[#FF6B00]">à la maîtrise.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.1vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Six points de douleur quotidiens, six réponses concrètes intégrées à la même plateforme.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3.5vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Avant EDOLE
          </div>
          <div className="space-y-[1.2vh]">
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Données éparpillées</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Excel, WhatsApp, papier — la vérité n'existe nulle part</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Matériel perdu ou loué deux fois</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Aucune visibilité sur le parc en temps réel</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Factures émises en retard</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Recouvrement opaque, trésorerie tendue</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Comptabilité reconstituée en fin d'exercice</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Bilan dans la douleur, conformité OHADA fragile</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Aucune visibilité commerciale</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Le pipeline existe dans la tête du commercial</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#9CA3AF] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Communication client dispersée</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Mails, SMS, appels — rien n'est consolidé</div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Avec EDOLE
          </div>
          <div className="space-y-[1.2vh]">
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Source unique de vérité</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Une plateforme, accessible en mobilité depuis n'importe où</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Inventaire QR temps réel</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Disponibilité instantanée, alertes anti-conflits</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Devis → facture → encaissement</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Pipeline automatisé, zéro double saisie</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Bilan OHADA en un clic</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Écritures continues, balance toujours à jour</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">KPI consolidés et alertes intelligentes</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Le dirigeant sait, en cinq secondes</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] px-[1.4vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold leading-tight">Messagerie et campagnes intégrées</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.3vh]">Toute la relation client dans le même espace</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
