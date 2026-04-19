export default function Mobilite() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Mobilité et sécurité
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Pensée pour le terrain, <span className="text-[#FF6B00]">protégée par les rôles.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Le chef de chantier l'utilise depuis son téléphone. Le dirigeant pilote depuis son bureau. Chacun voit ce qu'il doit voir.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Mobilité réelle
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] mb-[1.5vh]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Interface 100% responsive</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Drawer sidebar sur mobile, hamburger, cibles tactiles 44px, tableaux scrollables. Le terrain ne ralentit pas la direction.
            </p>
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[2vw] mb-[1.5vh]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Scan QR depuis le smartphone</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Un magasinier scanne l'étiquette d'un engin et accède immédiatement à sa fiche, son historique, sa disponibilité.
            </p>
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[2vw]">
            <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Photos terrain centralisées</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Téléversement direct depuis le téléphone — état des lieux, suivi de chantier, justificatif d'incident.
            </p>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Sécurité et rôles différenciés
          </div>
          <div className="bg-[#0F1115] rounded-[0.4vw] p-[2vw]">
            <div className="space-y-[1vh]">
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.4vh] border-l-[3px] border-l-[#FF6B00] flex items-center justify-between">
                <div>
                  <div className="font-display text-white text-[1.1vw] font-bold">Super admin</div>
                  <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.2vh]">Configuration plateforme</div>
                </div>
                <span className="font-body text-[#FF6B00] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">01</span>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.4vh] border-l-[3px] border-l-[#FF6B00] flex items-center justify-between">
                <div>
                  <div className="font-display text-white text-[1.1vw] font-bold">Admin</div>
                  <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.2vh]">Accès complet métier</div>
                </div>
                <span className="font-body text-[#FF6B00] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">02</span>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.4vh] border-l-[3px] border-l-[#2563EB] flex items-center justify-between">
                <div>
                  <div className="font-display text-white text-[1.1vw] font-bold">Manager</div>
                  <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.2vh]">Création et modification opérationnelle</div>
                </div>
                <span className="font-body text-[#2563EB] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">03</span>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.4vh] border-l-[3px] border-l-[#10B981] flex items-center justify-between">
                <div>
                  <div className="font-display text-white text-[1.1vw] font-bold">Collaborateur</div>
                  <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.2vh]">Ses tâches et son périmètre uniquement</div>
                </div>
                <span className="font-body text-[#10B981] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">04</span>
              </div>
              <div className="bg-[#1A1C22] rounded-[0.3vw] px-[1.4vw] py-[1.4vh] border-l-[3px] border-l-[#A855F7] flex items-center justify-between">
                <div>
                  <div className="font-display text-white text-[1.1vw] font-bold">Client</div>
                  <div className="font-body text-[#94939E] text-[0.85vw] mt-[0.2vh]">Vue restreinte sur ses chantiers</div>
                </div>
                <span className="font-body text-[#A855F7] text-[0.75vw] tracking-[0.2em] uppercase font-semibold">05</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
