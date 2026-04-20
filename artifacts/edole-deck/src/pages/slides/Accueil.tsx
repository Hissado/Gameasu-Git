export default function Accueil() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F4F5F8] font-body flex flex-col">
      <div className="bg-[#0F1115] px-[5vw] pt-[5vh] pb-[4vh]">
        <div className="font-body text-[#FF6B00] text-[0.85vw] tracking-[0.3em] uppercase font-semibold">
          Univers 01 — Accueil personnalisé
        </div>
        <div className="flex items-end justify-between mt-[1.5vh]">
          <h2 className="font-display text-white text-[3.4vw] font-extrabold leading-[1.05] tracking-tight max-w-[55vw]">
            « Bonjour, <span className="text-[#FF6B00]">Issa.</span> »
          </h2>
          <p className="font-body text-[#94939E] text-[1.05vw] leading-relaxed max-w-[28vw] text-right pb-[1vh]">
            L'utilisateur ouvre l'app et l'app le reconnaît. Salutation, date, priorités du jour — tout est déjà là.
          </p>
        </div>
        <div className="w-full h-[2px] bg-[#FF6B00] mt-[3vh]" />
      </div>

      <div className="flex-1 px-[5vw] py-[4vh] grid grid-cols-[1.1fr_1fr] gap-[3vw]">
        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Maquette à l'ouverture
          </div>

          <div className="bg-gradient-to-br from-[#0F1115] via-[#1A1D24] to-[#0F1115] rounded-[0.5vw] px-[2vw] py-[2.4vh] mb-[1.5vh] border border-[#2A2C33]">
            <div className="font-body text-[#FF6B00] text-[0.65vw] tracking-[0.25em] uppercase font-semibold">
              Lundi 20 avril 2026
            </div>
            <div className="font-display text-white text-[2.2vw] font-extrabold leading-tight mt-[0.6vh]">
              Bonjour, Issa.
            </div>
            <div className="font-body text-[#94939E] text-[0.9vw] mt-[0.6vh]">
              Voici l'activité de votre entreprise aujourd'hui — chantiers en cours, encaissements, alertes prioritaires.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[1vw]">
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#FF6B00] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.8vw] font-extrabold leading-none">4</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.6vh]">Chantiers actifs</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#10B981] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.8vw] font-extrabold leading-none">7</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.6vh]">Tâches terminées</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#D4A53A] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.8vw] font-extrabold leading-none">7</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.6vh]">En cours</div>
            </div>
            <div className="bg-white rounded-[0.4vw] border-t-[3px] border-t-[#DC2626] px-[1.2vw] py-[1.6vh]">
              <div className="font-display text-[#0F1115] text-[1.8vw] font-extrabold leading-none">1</div>
              <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.6vh]">En retard</div>
            </div>
          </div>

          <div className="mt-[2vh] bg-white rounded-[0.4vw] border-l-[4px] border-l-[#2563EB] px-[1.5vw] py-[1.8vh]">
            <div className="font-display text-[#0F1115] text-[1.1vw] font-bold">Évolution des encaissements</div>
            <div className="font-body text-[#5C5D67] text-[0.85vw] mt-[0.4vh]">Courbe consolidée FCFA sur l'année</div>
            <div className="mt-[1.2vh] h-[6vh] flex items-end gap-[0.4vw]">
              <div className="flex-1 bg-[#FF6B00]/20 rounded-t-[2px]" style={{ height: "30%" }} />
              <div className="flex-1 bg-[#FF6B00]/30 rounded-t-[2px]" style={{ height: "55%" }} />
              <div className="flex-1 bg-[#FF6B00]/40 rounded-t-[2px]" style={{ height: "45%" }} />
              <div className="flex-1 bg-[#FF6B00]/55 rounded-t-[2px]" style={{ height: "70%" }} />
              <div className="flex-1 bg-[#FF6B00]/70 rounded-t-[2px]" style={{ height: "85%" }} />
              <div className="flex-1 bg-[#FF6B00] rounded-t-[2px]" style={{ height: "100%" }} />
            </div>
          </div>
        </div>

        <div>
          <div className="font-body text-[#5C5D67] text-[0.85vw] tracking-[0.25em] uppercase font-semibold mb-[2vh]">
            Pourquoi cet accueil
          </div>

          <div className="space-y-[1.8vh]">
            <div className="bg-white rounded-[0.4vw] px-[1.5vw] py-[1.8vh] border-l-[4px] border-l-[#FF6B00]">
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold leading-tight">Reconnaissance immédiate</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.6vh] leading-relaxed">
                Salutation contextuelle (matin, midi, soir) avec le prénom du collaborateur connecté. L'outil s'adresse à une personne, pas à un poste.
              </div>
            </div>

            <div className="bg-white rounded-[0.4vw] px-[1.5vw] py-[1.8vh] border-l-[4px] border-l-[#2563EB]">
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold leading-tight">Orientation en un coup d'œil</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.6vh] leading-relaxed">
                Quatre indicateurs clés (actifs, terminés, en cours, en retard) — l'utilisateur sait quoi faire avant de cliquer où que ce soit.
              </div>
            </div>

            <div className="bg-white rounded-[0.4vw] px-[1.5vw] py-[1.8vh] border-l-[4px] border-l-[#10B981]">
              <div className="font-display text-[#0F1115] text-[1.3vw] font-bold leading-tight">Personnalisation par rôle</div>
              <div className="font-body text-[#5C5D67] text-[1vw] mt-[0.6vh] leading-relaxed">
                Le contenu affiché s'adapte au rôle (Direction, Manager, Commercial, Technicien) et à la matrice de permissions.
              </div>
            </div>
          </div>

          <div className="mt-[2.5vh] bg-[#0F1115] rounded-[0.4vw] grid grid-cols-3 px-[1.5vw] py-[2vh]">
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">1ère</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Vue après login</div>
            </div>
            <div className="text-center border-r border-[#2A2C33]">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">5s</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Pour décider</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[#FF6B00] text-[1.6vw] font-extrabold leading-none">5</div>
              <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Rôles distincts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
