import shot from "@assets/screenshots/02-clients.jpg";

export default function Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#F4F5F8] text-[#0F1115] flex">
      <div className="w-[38%] h-full px-[4vw] py-[7vh] flex flex-col justify-between bg-white relative">
        <div>
          <div className="text-[0.9vw] tracking-[0.38em] uppercase font-semibold text-[#FF6B00] mb-[2.5vh]">
            Module 04 · Clients
          </div>
          <div className="font-display text-[4vw] leading-[1.02] font-extrabold tracking-[-0.03em] mb-[2vh]">
            Le client,
          </div>
          <div className="font-display text-[4vw] leading-[1.02] font-extrabold tracking-[-0.03em] text-[#FF6B00] mb-[3vh]">
            entité racine.
          </div>
          <p className="text-[1.25vw] leading-[1.6] text-[#0F1115]/70">
            Chaque client dispose d'un espace de travail dédié : engagements,
            projets, tâches, fichiers et conversations regroupés derrière un
            contrôle d'accès unifié.
          </p>
        </div>

        <div className="space-y-[2.2vh]">
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#0F1115]/40 mb-[0.8vh]">
              Objectif
            </div>
            <div className="text-[1.1vw] leading-[1.5]">
              Disposer d'un dossier client 360° unifié, partagé entre toutes
              les fonctions de l'entreprise.
            </div>
          </div>
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#0F1115]/40 mb-[0.8vh]">
              Valeur utilisateur
            </div>
            <div className="text-[1.1vw] leading-[1.5]">
              Contacts, coordonnées, portefeuille projets, encours financier
              et historique d'interactions accessibles instantanément.
            </div>
          </div>
          <div>
            <div className="text-[0.8vw] tracking-[0.3em] uppercase font-bold text-[#0F1115]/40 mb-[0.8vh]">
              Connecté à
            </div>
            <div className="text-[1.05vw] leading-[1.5] text-[#0F1115]/80">
              <span className="text-[#FF6B00] font-semibold">Services</span> ·{" "}
              <span className="text-[#FF6B00] font-semibold">Projets</span> ·{" "}
              <span className="text-[#FF6B00] font-semibold">Factures</span> ·{" "}
              <span className="text-[#FF6B00] font-semibold">Messagerie</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[0.85vw] text-[#0F1115]/40">
          <div className="font-semibold uppercase tracking-[0.3em]">ACL client-first</div>
          <div className="font-mono tracking-[0.2em]">04 / 15</div>
        </div>
      </div>

      <div className="flex-1 h-full bg-[#E8EAEF] flex items-center justify-center px-[2vw] relative">
        <div className="relative w-[96%] rounded-[0.8vw] overflow-hidden ring-1 ring-black/10 shadow-[0_30px_70px_rgba(15,17,21,0.18)]">
          <img src={shot} crossOrigin="anonymous" alt="Espace clients" className="w-full h-auto block" />
        </div>
      </div>
    </div>
  );
}
