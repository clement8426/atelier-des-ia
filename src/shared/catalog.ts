import type { WorkshopId } from "./types";
export const workshops: {
  id: WorkshopId;
  number: string;
  title: string;
  subtitle: string;
  family: string;
  verb: string;
  input: string;
  output: string;
  lesson: string;
  limit: string;
  color: string;
  samples: { id: string; label: string; image?: string; note?: string }[];
}[] = [
  {
    id: "classification",
    number: "01",
    title: "Que voit l’IA ?",
    subtitle: "Une photo. Mille catégories possibles.",
    family: "VISION",
    verb: "Analyser l’image",
    input: "Une image",
    output: "Des catégories",
    color: "orange",
    lesson:
      "Ce modèle compare une image à des catégories apprises. Il classe la photo entière : il ne localise pas les objets.",
    limit:
      "Ses scores comparent ses catégories ; ils ne garantissent pas que sa réponse soit vraie. Essayez aussi l’image abstraite.",
    samples: [
      { id: "dog", label: "Un chien", image: "dog.jpg" },
      { id: "cat", label: "Un chat", image: "cat.jpg" },
      {
        id: "abstract",
        label: "Le piège",
        image: "abstract.png",
        note: "Une image sans catégorie évidente.",
      },
    ],
  },
  {
    id: "ocr",
    number: "02",
    title: "Lire dans une image",
    subtitle: "Des pixels qui deviennent des mots.",
    family: "LECTURE",
    verb: "Extraire le texte",
    input: "Une image de texte",
    output: "Du texte copiable",
    color: "blue",
    lesson:
      "Deux modèles travaillent à la suite : le premier repère les zones de texte, le second lit leurs caractères. Aucun modèle de conversation n’est nécessaire.",
    limit:
      "Une petite faute peut changer un montant ou un nom. Comparez toujours avec l’original, surtout sur une image difficile.",
    samples: [
      { id: "note", label: "Une note", image: "note.png" },
      { id: "ticket", label: "Un ticket", image: "ticket.png" },
      {
        id: "tiny",
        label: "Texte minuscule",
        image: "tiny.png",
        note: "Un exemple volontairement difficile.",
      },
    ],
  },
  {
    id: "speech",
    number: "03",
    title: "Donner de la voix",
    subtitle: "Écrivez une phrase. Écoutez-la.",
    family: "AUDIO",
    verb: "Créer la voix",
    input: "Un texte en français",
    output: "Un fichier audio",
    color: "green",
    lesson:
      "Le texte est transformé en sons, puis un modèle génère la voix. Il lit votre phrase : il ne formule pas une réponse.",
    limit:
      "La voix peut mal prononcer les noms propres ou les nombres. Elle est synthétique et ne comprend pas nécessairement le sens de la phrase.",
    samples: [],
  },
];
export const referenceText =
  "Bonjour ! Bienvenue dans l’atelier des intelligences artificielles.";
export const sampleFiles: Record<string, string> = {
  dog: "dog.jpg",
  cat: "cat.jpg",
  abstract: "abstract.png",
  note: "note.png",
  ticket: "ticket.png",
  tiny: "tiny.png",
};
export const referenceInput = (id: WorkshopId) => ({
  id,
  sample: id === "classification" ? "dog" : "note",
  text: referenceText,
  reference: true,
});
export function isWorkshop(value: unknown): value is WorkshopId {
  return value === "classification" || value === "ocr" || value === "speech";
}
export function bytesLabel(bytes: number) {
  return `${(bytes / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
