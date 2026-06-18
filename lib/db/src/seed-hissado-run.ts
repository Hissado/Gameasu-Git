import { seedHissado } from "./seed-hissado";

seedHissado()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Erreur fatale seed-hissado :", e);
    process.exit(1);
  });
