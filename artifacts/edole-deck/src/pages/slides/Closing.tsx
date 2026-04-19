export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0F1115] font-body flex flex-col">
      <div className="absolute top-[6vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="w-[3.2vw] h-[3.2vw] rounded-[0.6vw] bg-[#FF6B00] flex items-center justify-center">
          <span className="font-display text-white text-[1.8vw] font-extrabold leading-none">é</span>
        </div>
        <div className="leading-tight">
          <div className="font-display text-white text-[1.4vw] font-extrabold tracking-wide">EDOLE</div>
          <div className="font-body text-[#94939E] text-[0.75vw] tracking-[0.25em] uppercase">Africa</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-[5vw]">
        <div className="font-body text-[#FF6B00] text-[1vw] tracking-[0.4em] uppercase font-semibold">
          La plateforme EDOLE
        </div>
        <div className="w-[5vw] h-[2px] bg-[#FF6B00] mt-[1.5vh]" />

        <h1 className="font-display text-white text-[6vw] font-extrabold leading-[0.95] tracking-tight mt-[4vh] text-center">
          Une plateforme.
        </h1>
        <h1 className="font-display text-[#FF6B00] text-[6vw] font-extrabold leading-[0.95] tracking-tight text-center">
          Chaque chantier.
        </h1>

        <p className="font-body text-[#C9C9D1] text-[1.4vw] leading-relaxed mt-[4vh] max-w-[55vw] text-center font-normal">
          Conçue pour les entreprises BTP qui exigent précision, mobilité et conformité OHADA dans chaque projet.
        </p>
      </div>

      <div className="bg-[#0A0B0E] border-t border-[#2A2C33] px-[5vw] py-[3.2vh] grid grid-cols-6 gap-[1vw]">
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Pilotage</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 1</div>
        </div>
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Opérations</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 2</div>
        </div>
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Matériel</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 3</div>
        </div>
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Commercial</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 4</div>
        </div>
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Marketing & RH</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 5 — 6</div>
        </div>
        <div>
          <div className="font-display text-white text-[1.05vw] font-bold">Comptabilité</div>
          <div className="font-body text-[#94939E] text-[0.7vw] tracking-[0.2em] uppercase mt-[0.5vh]">Module 7 — 8</div>
        </div>
      </div>
    </div>
  );
}
