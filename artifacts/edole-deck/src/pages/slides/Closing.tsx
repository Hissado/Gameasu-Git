import logo from "@assets/edole-logo-transparent.png";

export default function Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0F1115] text-white">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70vw 80vh at 50% 60%, rgba(255,107,0,0.25), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #FF6B00 0 1px, transparent 1px 40px)",
        }}
      />

      <div className="relative h-full flex flex-col justify-between px-[6vw] py-[7vh]">
        <img src={logo} crossOrigin="anonymous" alt="édolé — Le numérique au service du BTP" className="h-[10vh] w-auto object-contain self-start" />

        <div className="max-w-[72vw]">
          <div className="font-display text-[7.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] mb-[1vh]">
            Une plateforme.
          </div>
          <div className="font-display text-[7.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] mb-[1vh]">
            Chaque métier.
          </div>
          <div className="font-display text-[7.2vw] leading-[0.95] font-extrabold tracking-[-0.035em] text-[#FF6B00]">
            Chaque chantier.
          </div>
        </div>

        <div className="flex items-center justify-end text-[0.85vw] text-white/40">
          <div className="font-mono tracking-[0.2em]">15 / 15</div>
        </div>
      </div>
    </div>
  );
}
