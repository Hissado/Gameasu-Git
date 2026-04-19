export default function Marketing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 06 — Marketing
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Acquérir <span className="text-[#FF6B00]">et fidéliser.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Campagnes ciblées, base prospects qualifiée, conversion en un clic vers la fiche client.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Campagnes Email et SMS
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] p-[2vw] mb-[2vh]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Éditeur intégré</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Segmentation des destinataires, édition du message, simulation d'envoi avec rapport de délivrabilité. Idéal pour annoncer une nouvelle agence ou relancer un prospect dormant.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-[1vw]">
            <div className="bg-white rounded-[0.4vw] border-l-[3px] border-l-[#FF6B00] p-[1.4vw]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">Email</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.8vh]">Modèles personnalisables, segmentation par catégorie</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[3px] border-l-[#2563EB] p-[1.4vw]">
              <div className="font-display text-[#2563EB] text-[1.6vw] font-extrabold leading-none">SMS</div>
              <div className="font-body text-[#5C5D67] text-[0.9vw] mt-[0.8vh]">Diffusion massive, rapport de délivrabilité</div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Base prospects
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[2vw] mb-[2vh]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Qualification et conversion</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Source d'acquisition, score, statut et historique d'interaction. Conversion en un clic vers une fiche client — le pipeline ne se vide jamais.
            </p>
          </div>

          <div className="bg-[#0F1115] rounded-[0.4vw] p-[2vw]">
            <div className="font-body text-[#FF6B00] text-[0.75vw] tracking-[0.3em] uppercase font-semibold mb-[1.5vh]">
              Cycle de qualification
            </div>
            <div className="grid grid-cols-4 gap-[0.8vw]">
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[0.8vw] py-[1.2vh] text-center">
                <div className="font-display text-white text-[0.95vw] font-bold">Nouveau</div>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[0.8vw] py-[1.2vh] text-center">
                <div className="font-display text-white text-[0.95vw] font-bold">Contacté</div>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[0.8vw] py-[1.2vh] text-center">
                <div className="font-display text-white text-[0.95vw] font-bold">Qualifié</div>
              </div>
              <div className="bg-[#FF6B00] rounded-[0.3vw] px-[0.8vw] py-[1.2vh] text-center">
                <div className="font-display text-white text-[0.95vw] font-bold">Converti</div>
              </div>
            </div>
            <p className="font-body text-[#94939E] text-[0.85vw] leading-relaxed mt-[2vh]">
              Chaque étape déclenche les bonnes actions et alimente automatiquement les statistiques d'acquisition consolidées dans le tableau de bord.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
