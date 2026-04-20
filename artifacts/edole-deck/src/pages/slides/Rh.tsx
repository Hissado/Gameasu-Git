import shot from "@assets/screenshots/09-hr.jpg";

export default function Rh() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0F1115] text-white flex">
      <div className="w-[38%] h-full px-[4vw] py-[7vh] flex flex-col justify-between relative">
        <div>
          <div className="text-[0.9vw] tracking-[0.38em] uppercase font-semibold text-[#FF6B00] mb-[2.5vh]">
            Module 11 · Ressources humaines
          </div>
          <div className="font-display text-[4vw] leading-[1.02] font-extrabold tracking-[-0.03em] mb-[2vh]">
            L'équipe,
          </div>
          <div className="font-display text-[4vw] leading-[1.02] font-extrabold tracking-[-0.03em] text-[#FF6B00] mb-[3vh]">
            structurée.
          </div>
          <p className="text-[1.25vw] leading-[1.6] text-white/70">
            Collaborateurs, départements, rôles, contrats, affectations
            projets. Un référentiel RH qui alimente directement les droits
            d'accès et le plan de charge.
          </p>
        </div>

        <div className="space-y-[2.2vh]">
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-white/40 mb-[0.8vh]">
              Objectif
            </div>
            <div className="text-[1.1vw] leading-[1.5] text-white/90">
              Structurer les ressources humaines et sécuriser l'attribution
              des accès aux données sensibles.
            </div>
          </div>
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-white/40 mb-[0.8vh]">
              Valeur utilisateur
            </div>
            <div className="text-[1.1vw] leading-[1.5] text-white/90">
              Organigramme dynamique, contrats numérisés, permissions
              granulaires (RBAC) et plan de charge par collaborateur.
            </div>
          </div>
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-white/40 mb-[0.8vh]">
              Connecté à
            </div>
            <div className="text-[1.05vw] leading-[1.5] text-white/80">
              <span className="text-[#FF6B00]">Projets</span> ·{" "}
              <span className="text-[#FF6B00]">Tâches</span> ·{" "}
              <span className="text-[#FF6B00]">Sécurité</span> ·{" "}
              <span className="text-[#FF6B00]">Rapports</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[0.85vw] text-white/40">
          <div className="font-semibold uppercase tracking-[0.3em]">Organigramme · Contrats numérisés · Permissions granulaires</div>
          <div className="font-mono tracking-[0.2em]">11 / 15</div>
        </div>
      </div>

      <div className="flex-1 h-full bg-[#15181f] flex items-center justify-center px-[2vw] relative">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 50vw 50vh at 60% 50%, rgba(255,107,0,0.12), transparent 60%)",
          }}
        />
        <div className="relative w-[96%] rounded-[0.8vw] overflow-hidden ring-1 ring-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
          <img src={shot} crossOrigin="anonymous" alt="Ressources humaines" className="w-full h-auto block" />
        </div>
      </div>
    </div>
  );
}
