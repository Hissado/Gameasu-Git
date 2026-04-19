const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0F1115] font-body">
      <img
        src={`${base}hero-construction.png`}
        crossOrigin="anonymous"
        alt="Chantier"
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0F1115] via-[#0F1115]/85 to-[#0F1115]/40" />

      <div className="absolute top-[6vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="w-[3.2vw] h-[3.2vw] rounded-[0.6vw] bg-[#FF6B00] flex items-center justify-center">
          <span className="font-display text-white text-[1.8vw] font-extrabold leading-none">é</span>
        </div>
        <div className="leading-tight">
          <div className="font-display text-white text-[1.4vw] font-extrabold tracking-wide">EDOLE</div>
          <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase">Africa</div>
        </div>
      </div>

      <div className="absolute top-[20vh] left-[5vw] max-w-[55vw]">
        <div className="font-body text-[#FF6B00] text-[0.95vw] tracking-[0.3em] uppercase font-semibold">
          Plateforme Chantier — 2026
        </div>
        <div className="w-[6vw] h-[2px] bg-[#FF6B00] mt-[1.2vh]" />

        <h1 className="font-display text-white text-[6.2vw] font-extrabold leading-[0.95] tracking-tight mt-[3vh]">
          Plateforme
        </h1>
        <h1 className="font-display text-[#FF6B00] text-[6.2vw] font-extrabold leading-[0.95] tracking-tight">
          Chantier.
        </h1>

        <p className="font-body text-[#C9C9D1] text-[1.5vw] leading-relaxed mt-[3vh] max-w-[42vw] font-normal">
          Le système d'exploitation des entreprises de BTP en Afrique francophone — chantiers, matériel, équipes et finances dans une seule plateforme.
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-[#0A0B0E] border-t border-[#2A2C33]">
        <div className="grid grid-cols-5 px-[5vw] py-[3.2vh]">
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[2.2vw] font-extrabold leading-none">8</div>
            <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase mt-[0.8vh]">Univers</div>
          </div>
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[2.2vw] font-extrabold leading-none">60+</div>
            <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase mt-[0.8vh]">Modules</div>
          </div>
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[2.2vw] font-extrabold leading-none">FR</div>
            <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase mt-[0.8vh]">100% Français</div>
          </div>
          <div className="text-center border-r border-[#2A2C33]">
            <div className="font-display text-[#FF6B00] text-[2.2vw] font-extrabold leading-none">FCFA</div>
            <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase mt-[0.8vh]">Devise native</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[#FF6B00] text-[2.2vw] font-extrabold leading-none">OHADA</div>
            <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase mt-[0.8vh]">Comptabilité</div>
          </div>
        </div>
      </div>
    </div>
  );
}
