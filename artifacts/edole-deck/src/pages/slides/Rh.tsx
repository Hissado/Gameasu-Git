export default function Rh() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 07 — Ressources humaines
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            L'organisation, <span className="text-[#FF6B00]">structurée.</span>
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            De la fiche collaborateur au contrat, en passant par l'affectation chantier et la charge de travail.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-3 gap-[1.8vw]">
        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#FF6B00] p-[2vw] flex flex-col">
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Collaborateurs</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            Fiche complète avec photo, coordonnées, poste, département, contrat actif et historique d'affectations.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#FF6B00] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Charge de travail</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#FF6B00] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Tâches actives</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#FF6B00] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Projets en cours</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] p-[2vw] flex flex-col">
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Départements et postes</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            Création des entités organisationnelles et postes types — direction, exploitation, atelier, commercial, comptabilité.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#2563EB] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Organigramme</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#2563EB] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Affectations chantier</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#2563EB] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Anti-double affectation</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[0.4vw] border-l-[4px] border-l-[#10B981] p-[2vw] flex flex-col">
          <h3 className="font-display text-[#0F1115] text-[1.5vw] font-bold leading-tight">Contrats et documents</h3>
          <p className="font-body text-[#5C5D67] text-[1vw] leading-relaxed mt-[1.2vh]">
            CDI, CDD, mission, stage. Suivi des dates, salaires et bibliothèque RH classée par collaborateur.
          </p>
          <div className="mt-auto pt-[2.5vh] space-y-[1vh]">
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#10B981] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Alerte 30 jours avant fin</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#10B981] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Documents joints</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <span className="font-body text-[#10B981] font-bold text-[1vw]">→</span>
              <span className="font-body text-[#0F1115] text-[1vw]">Conformité juridique</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0F1115] px-[5vw] py-[2.6vh] grid grid-cols-4 gap-[2vw]">
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">Tableau RH</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Effectifs · répartition</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">Affectations</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Qui travaille où</div>
        </div>
        <div className="text-center border-r border-[#2A2C33]">
          <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">Utilisateurs</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Comptes et accès</div>
        </div>
        <div className="text-center">
          <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">5 rôles</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.6vh]">Permissions différenciées</div>
        </div>
      </div>
    </div>
  );
}
