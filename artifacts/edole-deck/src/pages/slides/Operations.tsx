export default function Operations() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Module 2 — 5
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Opérations <span className="text-[#FF6B00]">et matériel</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Du planning de chantier à l'inventaire QR — chaque engin, chaque tâche, chaque inspection tracée.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-3 gap-[1.8vw]">
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <div className="w-[2.8vw] h-[2.8vw] rounded-[0.4vw] bg-[#FFF1E5] flex items-center justify-center">
            <div className="w-[1.4vw] h-[1.1vw] bg-[#FF6B00] rounded-[2px] relative">
              <div className="absolute -top-[0.3vw] left-[0.15vw] w-[0.5vw] h-[0.4vw] bg-[#FF6B00] rounded-t-[2px]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold mt-[2.5vh] leading-tight">Chantiers et tâches</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            Dossier vivant de chaque projet — équipe, matériel, factures, documents et liens Drive centralisés.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Vues Liste, Kanban, Calendrier</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Sous-tâches et historique</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#FF6B00] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Charge collaborateur visible</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[2vw] flex flex-col">
          <div className="w-[2.8vw] h-[2.8vw] rounded-[0.4vw] bg-[#E8F0FE] flex items-center justify-center">
            <div className="grid grid-cols-3 gap-[0.15vw]">
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-white border border-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
              <div className="w-[0.4vw] h-[0.4vw] bg-[#2563EB]" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold mt-[2.5vh] leading-tight">Inventaire et QR</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            Catalogue parc complet avec photos, statut, localisation. Chaque engin reçoit un QR code physique.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#2563EB] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Photos et fiches détaillées</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#2563EB] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Étiquettes QR imprimables</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#2563EB] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Maintenance suivie</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[2vw] flex flex-col">
          <div className="w-[2.8vw] h-[2.8vw] rounded-[0.4vw] bg-[#E6F7F1] flex items-center justify-center">
            <div className="w-[1.6vw] h-[1vw] bg-[#10B981] rounded-[2px] relative">
              <div className="absolute -bottom-[0.2vw] left-[0.2vw] w-[0.3vw] h-[0.3vw] bg-[#10B981] rounded-full" />
              <div className="absolute -bottom-[0.2vw] right-[0.2vw] w-[0.3vw] h-[0.3vw] bg-[#10B981] rounded-full" />
            </div>
          </div>
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold mt-[2.5vh] leading-tight">Locations et inspections</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            Bons de location avec détection des conflits, état des lieux photo avant/après, ouverture de litige.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#10B981] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Disponibilité temps réel</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#10B981] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Photos avant / après</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body text-[#10B981] text-[1vw] font-bold">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Caution et durée</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0F1115] px-[5vw] py-[2.6vh] grid grid-cols-4 gap-[2vw]">
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">1</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">QR par engin</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">3</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Vues tâches</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">∞</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Photos par inspection</div>
        </div>
        <div className="text-center">
          <div className="font-display text-[#FF6B00] text-[1.7vw] font-extrabold leading-none">0</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Conflit possible</div>
        </div>
      </div>
    </div>
  );
}
