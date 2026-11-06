// Maintenance only. The resulting media is committed; learners never run this script.
import sharp from "sharp";
import { mkdir, writeFile, readFile } from "node:fs/promises";
await mkdir("public/samples", { recursive: true });
for (const [name, url] of [
  [
    "dog",
    "https://upload.wikimedia.org/wikipedia/commons/2/26/YellowLabradorLooking_new.jpg",
  ],
  [
    "cat",
    "https://upload.wikimedia.org/wikipedia/commons/b/b6/Felis_catus-cat_on_snow.jpg",
  ],
]) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "AtelierDesIA/0.1 (educational local application; labonumerique.ch)",
    },
  });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(900, 700, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toFile(`public/samples/${name}.jpg`);
}
const note = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="900" height="650" fill="#fffef8"/><path d="M65 90h770" stroke="#c6cfb8" stroke-width="3"/><g fill="#283c2e" font-family="Arial, sans-serif"><text x="65" y="175" font-size="54" font-weight="bold">Bonjour l’atelier !</text><text x="65" y="270" font-size="34">Aujourd’hui, on découvre les IA.</text><text x="65" y="340" font-size="34">Une image peut devenir du texte.</text><text x="65" y="410" font-size="34">Essayez, observez, comparez.</text><text x="65" y="550" font-size="24" fill="#617453">LE LABO NUMÉRIQUE</text></g></svg>`;
const ticket = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="850"><rect width="680" height="850" fill="#fffcf2"/><g font-family="monospace" fill="#252c29"><text x="80" y="110" font-size="40" font-weight="bold">LE PETIT CAFÉ</text><text x="80" y="180" font-size="25">Ticket de démonstration</text><path d="M80 220h520M80 540h520" stroke="#5d6359" stroke-dasharray="8 8"/><text x="80" y="310" font-size="30">Café          3.50</text><text x="80" y="380" font-size="30">Croissant     2.20</text><text x="80" y="450" font-size="30">Jus           4.00</text><text x="80" y="630" font-size="34" font-weight="bold">TOTAL         9.70</text><text x="80" y="740" font-size="25">Merci et à bientôt !</text></g></svg>`;
const abstract = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="650"><rect width="800" height="650" fill="#e4dccc"/><circle cx="290" cy="300" r="190" fill="#b3492a"/><path d="M360 80h290v430H360z" fill="#4c7159"/><path d="M140 520 630 180 710 560z" fill="#e9b966"/><circle cx="580" cy="180" r="95" fill="#eaeadd"/></svg>`;
const tiny = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="900" height="650" fill="#e6e4db"/><g font-family="Arial" fill="#7d8078"><text x="105" y="175" font-size="12" transform="rotate(-12 100 175)">Une IA peut aussi se tromper : 8 ou B, 0 ou O ?</text><text x="410" y="470" font-size="9">Texte volontairement minuscule et peu contrasté.</text></g><path d="M0 330 900 310" stroke="#9eaa97" stroke-width="20" opacity=".3"/></svg>`;
for (const [name, source] of Object.entries({ note, ticket, abstract, tiny })) {
  await writeFile(`public/samples/${name}.svg`, source);
  await sharp(Buffer.from(source)).png().toFile(`public/samples/${name}.png`);
}
console.log(
  "Six médias intégrés créés. Consulter docs/MEDIAS.md pour les crédits.",
);
