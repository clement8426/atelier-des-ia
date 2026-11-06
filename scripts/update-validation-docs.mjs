// Maintenance snapshot for this prototype; preserves evidence of intermediate package tests.
import { readFile, writeFile, copyFile } from "node:fs/promises";
let readme = await readFile("README.md", "utf8");
readme = readme
  .replaceAll("release/Atelier-des-IA-", "release/0.1.0/Atelier-des-IA-")
  .replaceAll("release/win-unpacked/", "release/0.1.0/win-unpacked/");
readme = readme
  .replace(
    "Pour essayer la copie locale sans installation, ouvrez",
    "La copie locale non installée est dans",
  )
  .replace(
    "et conservez tout son dossier à côté de lui.",
    "; ce dossier doit rester complet.",
  );
readme = readme.replace(
  "La version empaquetée a démarré et fait fonctionner les trois modèles hors ligne sur le poste de développement. Aucune page de téléchargement publique n’est encore publiée. Ce prototype n’est pas signé : la distribution publique à des débutants nécessite encore les signatures et essais d’installation sur postes propres.",
  "Les trois ateliers fonctionnent avec le runtime Electron de développement. Sur ce poste, la dernière version empaquetée est bloquée au lancement par la politique Windows Device Guard : une signature valide ou une autorisation informatique adaptée est nécessaire. Aucune protection du poste n’a été modifiée. Aucune page de téléchargement publique n’est publiée ; la signature, les licences restantes et l’installation sur postes propres doivent être validées avant diffusion aux apprenants.",
);
await writeFile("README.md", readme);
let validation = await readFile("docs/VALIDATION.md", "utf8");
validation = validation.replace(
  /^\| Application Windows empaquetée.*$/m,
  "| Application Windows empaquetée | Versions intermédiaires testées avec trois références hors ligne ; dernier paquet refusé par Device Guard, validation finale bloquée |",
);
validation = validation.replace(
  "La version empaquetée a préparé ses trois ateliers dans le dossier de données de cette machine. Ses mesures sont dans [evidence/package-smoke.json](evidence/package-smoke.json). Cette préparation permet d’essayer la copie locale ; elle ne qualifie aucun autre ordinateur.",
  "Une version intermédiaire a exécuté les trois ateliers empaquetés. La dernière tentative a été refusée explicitement par Device Guard ; elle ne doit pas être déclarée validée. [État du paquet final](evidence/package-smoke.json) et [mesures intermédiaires conservées](evidence/package-smoke-intermediaire.json). Il faut signer le programme ou obtenir son autorisation informatique, puis refaire cet essai. Aucune modification des protections Windows n’a été effectuée.",
);
await writeFile("docs/VALIDATION.md", validation);
const previous = JSON.parse(
  await readFile("docs/evidence/package-smoke.json", "utf8"),
);
if (previous.measurements)
  await copyFile(
    "docs/evidence/package-smoke.json",
    "docs/evidence/package-smoke-intermediaire.json",
  );
await writeFile(
  "docs/evidence/package-smoke.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      status: "blocked-by-device-guard",
      artifact: "release/0.1.0/Atelier-des-IA-0.1.0-Windows.exe",
      reason:
        "Windows refuse le lancement de l’exécutable empaqueté : stratégie Device Guard de votre organisation.",
      sourceIntegrationTests: "passed",
      finalPackagedRuntimeValidated: false,
      installerTested: false,
      cleanWindowsMachineTested: false,
      previousSuccessfulIntermediate: "package-smoke-intermediaire.json",
    },
    null,
    2,
  ) + "\n",
);
