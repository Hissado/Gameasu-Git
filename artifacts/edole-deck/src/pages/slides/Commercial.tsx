import shotCrm from "@assets/screenshots/10-crm.jpg";
import shotInv from "@assets/screenshots/11-invoices.jpg";

export default function Commercial() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#F4F5F8] text-[#0F1115]">
      <div className="absolute inset-0 bg-gradient-to-b from-white to-[#F4F5F8]" />

      <div className="relative h-full flex flex-col px-[5vw] py-[6vh]">
        <div className="flex items-start justify-between mb-[3vh]">
          <div>
            <div className="text-[0.9vw] tracking-[0.38em] uppercase font-semibold text-[#FF6B00] mb-[1.8vh]">
              Module 12 · Commercial
            </div>
            <div className="font-display text-[4.2vw] leading-[1] font-extrabold tracking-[-0.03em]">
              Du prospect
            </div>
            <div className="font-display text-[4.2vw] leading-[1] font-extrabold tracking-[-0.03em] text-[#FF6B00]">
              à l'encaissement.
            </div>
          </div>
          <div className="max-w-[32vw] pt-[2vh] text-[1.15vw] leading-[1.55] text-[#0F1115]/70">
            Un seul cycle : opportunité dans le CRM → devis → bon de commande
            → facture → paiement. Chaque étape génère automatiquement la
            suivante.
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-[1.6vw]">
          <div className="flex flex-col">
            <div className="rounded-[0.8vw] overflow-hidden ring-1 ring-black/10 shadow-[0_20px_50px_rgba(15,17,21,0.15)] flex-1">
              <img src={shotCrm} crossOrigin="anonymous" alt="CRM commercial" className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white rounded-[0.6vw] px-[1.5vw] py-[1.8vh] mt-[1.2vh] ring-1 ring-black/5">
              <div className="text-[0.8vw] uppercase tracking-[0.3em] font-bold text-[#FF6B00] mb-[0.6vh]">
                CRM · Pipeline
              </div>
              <div className="text-[1.05vw] leading-[1.5] text-[#0F1115]/80">
                Opportunités qualifiées, probabilités, montants estimés,
                historique d'interactions.
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="rounded-[0.8vw] overflow-hidden ring-1 ring-black/10 shadow-[0_20px_50px_rgba(15,17,21,0.15)] flex-1">
              <img src={shotInv} crossOrigin="anonymous" alt="Facturation" className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white rounded-[0.6vw] px-[1.5vw] py-[1.8vh] mt-[1.2vh] ring-1 ring-black/5">
              <div className="text-[0.8vw] uppercase tracking-[0.3em] font-bold text-[#FF6B00] mb-[0.6vh]">
                Factures · Encaissements
              </div>
              <div className="text-[1.05vw] leading-[1.5] text-[#0F1115]/80">
                Émission en FCFA, relances automatiques, rapprochement
                bancaire, suivi créances en temps réel.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[0.85vw] text-[#0F1115]/45 mt-[2vh]">
          <div className="font-semibold uppercase tracking-[0.3em]">
            Cycle commercial intégré · Du prospect au paiement encaissé
          </div>
          <div className="font-mono tracking-[0.2em]">12 / 15</div>
        </div>
      </div>
    </div>
  );
}
