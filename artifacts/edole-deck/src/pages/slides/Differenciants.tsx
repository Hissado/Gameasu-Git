export default function Differenciants() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Pourquoi EDOLE
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Six raisons <span className="text-[#FF6B00]">de choisir EDOLE.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Pas un outil générique adapté. Un outil pensé pour le BTP en Afrique francophone.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-3 gap-[1.8vw]">
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">01</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Conçu pour le BTP africain</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            Pas un outil généraliste adapté — un outil pensé pour ce métier dans cette région, avec ses contraintes propres.
          </p>
        </div>
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">02</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Tout-en-un véritable</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            Du chantier à la comptabilité OHADA, sans connecteurs fragiles entre cinq logiciels différents.
          </p>
        </div>
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">03</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Mobilité réelle</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            Les équipes terrain l'utilisent depuis leur téléphone — pas seulement la direction depuis son bureau.
          </p>
        </div>
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">04</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Alertes intelligentes</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            L'application travaille pour vous en arrière-plan — locations, factures, contrats, maintenance.
          </p>
        </div>
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">05</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Performance et fluidité</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            Interface premium, navigation instantanée, expérience utilisateur soignée — niveau Notion ou Linear.
          </p>
        </div>
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="font-display text-[#FF6B00] text-[3vw] font-extrabold leading-none">06</div>
          <h3 className="font-display text-[#0F1115] text-[1.4vw] font-bold mt-[1.5vh] leading-tight">Français et FCFA partout</h3>
          <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1.2vh] flex-1">
            Aucune friction linguistique ou monétaire. La plateforme parle votre langue, dans votre devise.
          </p>
        </div>
      </div>
    </div>
  );
}
