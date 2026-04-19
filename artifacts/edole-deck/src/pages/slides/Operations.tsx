export default function Operations() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 03 — Opérations
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            Le cœur du <span className="text-[#FF6B00]">métier.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            Chaque chantier est un dossier vivant. Chaque tâche, une action assignée, suivie, historisée.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[5vh] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Chantiers
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw]">
            <h3 className="font-display text-[#0F1115] text-[1.6vw] font-bold leading-tight">Dossier vivant du projet</h3>
            <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
              Chaque chantier regroupe l'équipe affectée, le matériel mobilisé, les tâches en cours, les bons de commande, les factures et les documents — plans, contrats, photos, liens Drive externes.
            </p>
            <div className="mt-[2.5vh] grid grid-cols-2 gap-[1vw] text-[1vw]">
              <div className="flex items-center gap-[0.6vw]">
                <span className="font-body text-[#FF6B00] font-bold">→</span>
                <span className="font-body text-[#0F1115]">Statuts : actif, planifié, terminé</span>
              </div>
              <div className="flex items-center gap-[0.6vw]">
                <span className="font-body text-[#FF6B00] font-bold">→</span>
                <span className="font-body text-[#0F1115]">Lien chef de projet RH</span>
              </div>
              <div className="flex items-center gap-[0.6vw]">
                <span className="font-body text-[#FF6B00] font-bold">→</span>
                <span className="font-body text-[#0F1115]">Budget en FCFA suivi</span>
              </div>
              <div className="flex items-center gap-[0.6vw]">
                <span className="font-body text-[#FF6B00] font-bold">→</span>
                <span className="font-body text-[#0F1115]">Documents Drive joints</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2.5vh]">
            Tâches — trois vues, un moteur
          </div>
          <div className="grid grid-cols-3 gap-[1vw] mb-[1.5vh]">
            <div className="bg-white rounded-[0.4vw] border-l-[3px] border-l-[#FF6B00] px-[1vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold">Liste</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.3vh]">Tableau filtrable</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[3px] border-l-[#2563EB] px-[1vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold">Kanban</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.3vh]">Glisser-déposer</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-l-[3px] border-l-[#10B981] px-[1vw] py-[1.4vh]">
              <div className="font-display text-[#0F1115] text-[1.1vw] font-bold">Calendrier</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.3vh]">Vue échéances</div>
            </div>
          </div>
          <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#A855F7] p-[1.8vw]">
            <h4 className="font-display text-[#0F1115] text-[1.3vw] font-bold leading-tight">Sous-tâches et historique</h4>
            <p className="font-body text-[#5C5D67] text-[0.95vw] leading-relaxed mt-[1vh]">
              Décomposition illimitée en sous-tâches. Chaque modification (statut, priorité, assignation, commentaire) horodatée et tracée — preuve d'audit complète.
            </p>
            <div className="mt-[1.5vh] flex items-center gap-[1.5vw] text-[0.95vw]">
              <span className="font-display text-[#A855F7] font-bold">Priorités :</span>
              <span className="text-[#0F1115]">Basse · Moyenne · Haute · Urgente</span>
            </div>
          </div>
          <div className="mt-[2vh] bg-[#0F1115] rounded-[0.4vw] grid grid-cols-3 px-[1.5vw] py-[2vh]">
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">3</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Vues</div>
            </div>
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">∞</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Sous-tâches</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">100%</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Tracé</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
