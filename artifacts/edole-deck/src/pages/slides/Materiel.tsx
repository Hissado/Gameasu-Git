export default function Materiel() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 04 — Matériel
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Le patrimoine <span className="text-[#FF6B00]">de l'entreprise.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Chaque engin tracé. Chaque sortie inspectée. Chaque retour comparé en photo.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-4 gap-[1.5vw]">
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[1.6vw] flex flex-col">
          <div className="w-[2.5vw] h-[2.5vw] rounded-[0.4vw] bg-[#FFF1E5] flex items-center justify-center">
            <div className="grid grid-cols-2 gap-[0.2vw]">
              <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
              <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
              <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
              <div className="w-[0.55vw] h-[0.55vw] bg-[#FF6B00] rounded-[1px]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.3vw] font-bold mt-[2vh] leading-tight">Inventaire</h3>
          <p className="font-body text-[#5C5D67] text-[0.9vw] leading-relaxed mt-[1vh] flex-1">
            Catalogue complet du parc avec photos, statut, localisation et valeur d'achat.
          </p>
          <div className="font-body text-[#FF6B00] text-[0.75vw] tracking-[0.2em] uppercase font-semibold mt-[1.5vh]">
            Filtres multiples
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[1.6vw] flex flex-col">
          <div className="w-[2.5vw] h-[2.5vw] rounded-[0.4vw] bg-[#E8F0FE] flex items-center justify-center">
            <div className="grid grid-cols-3 gap-[0.1vw]">
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-white border border-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
              <div className="w-[0.35vw] h-[0.35vw] bg-[#2563EB]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.3vw] font-bold mt-[2vh] leading-tight">Étiquettes QR</h3>
          <p className="font-body text-[#5C5D67] text-[0.9vw] leading-relaxed mt-[1vh] flex-1">
            QR codes imprimables. Un scan ouvre la fiche matériel sur le smartphone du chef de chantier.
          </p>
          <div className="font-body text-[#2563EB] text-[0.75vw] tracking-[0.2em] uppercase font-semibold mt-[1.5vh]">
            1 QR par engin
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[1.6vw] flex flex-col">
          <div className="w-[2.5vw] h-[2.5vw] rounded-[0.4vw] bg-[#E6F7F1] flex items-center justify-center">
            <div className="w-[1.6vw] h-[1vw] bg-[#10B981] rounded-[2px] relative">
              <div className="absolute -bottom-[0.2vw] left-[0.2vw] w-[0.3vw] h-[0.3vw] bg-[#10B981] rounded-full" />
              <div className="absolute -bottom-[0.2vw] right-[0.2vw] w-[0.3vw] h-[0.3vw] bg-[#10B981] rounded-full" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.3vw] font-bold mt-[2vh] leading-tight">Locations</h3>
          <p className="font-body text-[#5C5D67] text-[0.9vw] leading-relaxed mt-[1vh] flex-1">
            Bons de location avec détection automatique des conflits sur la période et caution gérée.
          </p>
          <div className="font-body text-[#10B981] text-[0.75vw] tracking-[0.2em] uppercase font-semibold mt-[1.5vh]">
            0 conflit possible
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] p-[1.6vw] flex flex-col">
          <div className="w-[2.5vw] h-[2.5vw] rounded-[0.4vw] bg-[#F3E8FF] flex items-center justify-center">
            <div className="grid grid-cols-2 gap-[0.2vw]">
              <div className="w-[0.7vw] h-[0.7vw] border-[1.5px] border-[#A855F7] rounded-[2px]" />
              <div className="w-[0.7vw] h-[0.7vw] border-[1.5px] border-[#A855F7] rounded-[2px]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.3vw] font-bold mt-[2vh] leading-tight">Inspections</h3>
          <p className="font-body text-[#5C5D67] text-[0.9vw] leading-relaxed mt-[1vh] flex-1">
            Photos avant et après côte à côte. Bouton ouvrir un litige avec retenue sur caution.
          </p>
          <div className="font-body text-[#A855F7] text-[0.75vw] tracking-[0.2em] uppercase font-semibold mt-[1.5vh]">
            Preuve juridique
          </div>
        </div>
      </div>

      <div className="px-[5vw] pb-[4vh]">
        <div className="bg-[#0F1115] rounded-[0.4vw] grid grid-cols-3 px-[2vw] py-[2.5vh]">
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[1.8vw] font-extrabold leading-none">Logistique</div>
            <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.6vh]">Mouvements entre chantiers et atelier — tracés</div>
          </div>
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[1.8vw] font-extrabold leading-none">Maintenance</div>
            <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.6vh]">Statuts dispo · loué · maintenance · hors-service</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[#FF6B00] text-[1.8vw] font-extrabold leading-none">Carte</div>
            <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.6vh]">Visualisation géographique du parc et chantiers</div>
          </div>
        </div>
      </div>
    </div>
  );
}
