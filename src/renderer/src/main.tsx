import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Cpu,
  Download,
  Eye,
  FolderInput,
  HardDrive,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  Play,
  ScanText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type {
  Diagnostic,
  ModelState,
  Progress,
  Reply,
  RunResult,
  View,
  WorkshopId,
} from "../../shared/types";
import { bytesLabel, referenceText, workshops } from "../../shared/catalog";
import "./style.css";

function unwrap<T>(reply: Reply<T>) {
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}
const seconds = (ms: number) =>
  ms < 1000
    ? `${Math.round(ms)} ms`
    : `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;
const glyphs = { classification: Eye, ocr: ScanText, speech: AudioLines };
const frenchLabels: Record<string, string> = {
  "Labrador retriever": "Labrador",
  "golden retriever": "Golden retriever",
  "tabby, tabby cat": "Chat tigré",
  "tiger cat": "Chat tigré",
  "Egyptian cat": "Chat égyptien",
  "Persian cat": "Chat persan",
  "Siamese cat, Siamese": "Chat siamois",
  "Chesapeake Bay retriever": "Retriever de la baie de Chesapeake",
  "tennis ball": "Balle de tennis",
  "ping-pong ball": "Balle de ping-pong",
  "soccer ball": "Ballon de football",
  "web site, website, internet site, site": "Site web",
  envelope: "Enveloppe",
  "jigsaw puzzle": "Puzzle",
  "comic book": "Bande dessinée",
  "doormat, welcome mat": "Paillasson",
  "quilt, comforter, comfort, puff": "Couette",
  velvet: "Velours",
  "shower curtain": "Rideau de douche",
  "paper towel": "Essuie-tout",
  "bath towel": "Serviette de bain",
  "window screen": "Moustiquaire",
  "window shade": "Store",
  "screen, CRT screen": "Écran",
};
function Status({ model }: { model?: ModelState }) {
  const ready = model?.installed && model.measurement?.passed;
  return (
    <span className={`status ${ready ? "ready" : ""}`}>
      {ready ? <Check size={12} /> : <span className="status-dot" />}
      {ready
        ? "Testé sur ce poste"
        : model?.installed
          ? "À tester"
          : "À préparer"}
    </span>
  );
}
function Wave({ large = false }: { large?: boolean }) {
  return (
    <div className={`wave ${large ? "wave-large" : ""}`} aria-hidden="true">
      {[
        12, 24, 37, 19, 51, 68, 40, 80, 57, 95, 65, 38, 77, 51, 98, 68, 43, 85,
        60, 34, 53, 25, 42, 17, 28,
      ].map((height, i) => (
        <i key={i} style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}
function Artwork({ id }: { id: WorkshopId }) {
  if (id === "classification")
    return (
      <div className="art art-photo">
        <img src="/samples/dog.jpg" alt="Un labrador dans l’herbe" />
        <span className="photo-label">
          <span /> Une image, plusieurs hypothèses
        </span>
        <span className="viewfinder" aria-hidden="true" />
      </div>
    );
  if (id === "ocr")
    return (
      <div className="art art-reading">
        <div className="paper">
          <span className="paper-label">PETIT MOT DU JOUR</span>
          <strong>
            Bonjour
            <br />
            l’atelier !
          </strong>
          <div className="paper-lines" />
          <span className="scan-corner tl" />
          <span className="scan-corner br" />
        </div>
        <span className="read-label">
          <ScanText size={14} /> Pixels → texte
        </span>
      </div>
    );
  return (
    <div className="art art-audio">
      <div className="sound-orbit">
        <Volume2 size={31} strokeWidth={1.4} />
      </div>
      <Wave />
      <span className="sound-label">« Bonjour, et bienvenue. »</span>
    </div>
  );
}
function App() {
  const [view, setView] = useState<View>("explore");
  const [selected, setSelected] = useState<WorkshopId | null>(null);
  const [models, setModels] = useState<ModelState[]>([]);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sample, setSample] = useState("dog");
  const [text, setText] = useState(referenceText);
  const [results, setResults] = useState<
    Partial<Record<WorkshopId, RunResult>>
  >({});
  const [selection, setSelection] = useState<WorkshopId[]>([
    "classification",
    "ocr",
    "speech",
  ]);
  const [confirmRemove, setConfirmRemove] = useState<WorkshopId | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const cancelled = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const refresh = async () => {
    setModels(unwrap(await window.atelier.status()));
    setDiagnostic(unwrap(await window.atelier.diagnostic()));
  };
  useEffect(() => {
    if (!window.atelier) {
      setError(
        "Ouvrez cette application avec son raccourci Atelier des IA. Le navigateur seul ne peut pas lancer les calculs locaux.",
      );
      return;
    }
    refresh().catch((error) => setError(error.message));
    return window.atelier.onProgress(setProgress);
  }, []);
  useEffect(() => {
    const bytes = selected && results[selected]?.output.audio;
    if (!bytes) {
      setAudio(null);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "audio/wav" }),
    );
    setAudio(url);
    return () => URL.revokeObjectURL(url);
  }, [selected, results]);
  function navigate(next: View) {
    setView(next);
    setSelected(null);
    setConfirmRemove(null);
    setError(null);
    setNotice(null);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function openWorkshop(id: WorkshopId) {
    if (busy) return;
    setSelected(id);
    setView("explore");
    setSample(id === "classification" ? "dog" : "note");
    setResults((previous) => ({ ...previous, [id]: undefined }));
    setError(null);
    setNotice(null);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function chooseSample(value: string) {
    setSample(value);
    if (selected)
      setResults((previous) => ({ ...previous, [selected]: undefined }));
  }
  function changeText(value: string) {
    setText(value);
    setResults((previous) => ({ ...previous, speech: undefined }));
  }
  async function action<T>(fn: () => Promise<T>, success?: string) {
    if (busy) return;
    setBusy(true);
    cancelled.current = false;
    setError(null);
    setNotice(null);
    setProgress({ phase: "verify", message: "Un petit instant…" });
    try {
      await fn();
      if (success && !cancelled.current) setNotice(success);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Une difficulté est survenue. Réessayez.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
      try {
        await refresh();
      } catch {
        setError(
          "Impossible d’actualiser les informations. Fermez puis rouvrez l’application.",
        );
      }
    }
  }
  const prepare = (id: WorkshopId) =>
    action(async () => {
      unwrap(await window.atelier.prepare(id));
    }, "L’atelier est prêt. À vous de jouer !");
  const run = (id: WorkshopId) =>
    action(async () => {
      const result = unwrap(await window.atelier.run({ id, sample, text }));
      setResults((previous) => ({ ...previous, [id]: result }));
    });
  const readyCount = models.filter(
    (model) => model.installed && model.measurement?.passed,
  ).length;
  const current = workshops.find((item) => item.id === selected);
  const model = models.find((item) => item.id === selected);
  const result = selected ? results[selected] : undefined;
  const selectedBytes = models
    .filter((model) => selection.includes(model.id) && !model.installed)
    .reduce((sum, model) => sum + model.bytes, 0);
  const totalStored = models.reduce((sum, model) => sum + model.storedBytes, 0);
  const nav = [
    { id: "explore", label: "Explorer les IA", icon: Layers3 },
    { id: "prepare", label: "Préparer ma séance", icon: Download },
    { id: "computer", label: "Mon ordinateur", icon: Monitor },
  ] as const;

  return (
    <div className="app-shell">
      <a href="#content" className="skip-link">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("explore")}
          aria-label="Atelier des IA, accueil"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            atelier
            <span className="brand-second">
              des IA<span className="brand-period">.</span>
            </span>
          </span>
        </button>
        <div className="sidebar-caption">LE LABO NUMÉRIQUE</div>
        <nav aria-label="Navigation principale">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
              title={label}
            >
              <Icon size={19} />
              {label}
              {view === id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-stars" aria-hidden="true">
            ✳
          </span>
          <p>
            Moins de mystère.
            <br />
            <strong>Plus d’expériences.</strong>
          </p>
          <span>Apprendre en essayant.</span>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${view === "help" ? "active" : ""}`}
            onClick={() => navigate("help")}
            aria-current={view === "help" ? "page" : undefined}
          >
            <CircleHelp size={19} />
            Un coup de main ?
          </button>
          <div className="local-indicator">
            <span /> Calculs sur votre appareil
            <LockKeyhole size={12} />
          </div>
          <span className="app-version">
            VERSION DÉCOUVERTE · {diagnostic?.appVersion ?? "0.1.0"}
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>Votre terrain d’expérimentation</span>
          <div>
            <span className="no-account">
              <ShieldCheck size={14} /> Sans compte, sans envoi de vos contenus
            </span>
            <span className="avatar" aria-hidden="true">
              LN
            </span>
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          {error && (
            <div className="feedback error" role="alert">
              <CircleHelp size={20} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                aria-label="Fermer le message d’erreur"
              >
                <X size={18} />
              </button>
            </div>
          )}
          {notice && (
            <div className="feedback success" role="status">
              <CheckCircle2 size={19} />
              <span>{notice}</span>
              <button
                onClick={() => setNotice(null)}
                aria-label="Fermer la confirmation"
              >
                <X size={18} />
              </button>
            </div>
          )}
          {busy && (
            <div className="task-banner" role="status">
              <LoaderCircle className="spin" size={20} />
              <div>
                <strong>{progress?.message}</strong>
                {progress?.total ? (
                  <>
                    <progress
                      value={progress.loaded ?? 0}
                      max={progress.total}
                    />
                    <small>
                      {bytesLabel(progress.loaded ?? 0)} sur{" "}
                      {bytesLabel(progress.total)}
                    </small>
                  </>
                ) : (
                  <span>Vous pouvez arrêter à tout moment.</span>
                )}
              </div>
              <button
                className="button secondary small"
                onClick={() => {
                  cancelled.current = true;
                  window.atelier.cancel();
                }}
              >
                Annuler
              </button>
            </div>
          )}

          {view === "explore" && !selected && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> COMPRENDRE EN FAISANT
                  </p>
                  <h1 ref={heading} tabIndex={-1}>
                    Ouvrez la boîte noire.
                  </h1>
                  <p className="page-intro">
                    Une IA ne fait pas tout. Découvrez ce que chacune sait
                    faire.
                  </p>
                </div>
                <span className="session-tag">
                  <BookOpen size={15} /> Parcours découverte
                </span>
              </div>
              <div className="section-title">
                <h2>Trois façons de découvrir l’IA</h2>
                <span>{readyCount} sur 3 ateliers préparés</span>
              </div>
              <div className="workshop-grid">
                {workshops.map((item) => {
                  const state = models.find((model) => model.id === item.id),
                    Icon = glyphs[item.id];
                  return (
                    <article
                      className={`workshop-card ${item.color}`}
                      key={item.id}
                    >
                      <div className="card-topline">
                        <span className="card-number">{item.number}</span>
                        <span className="family">
                          <Icon size={13} />
                          {item.family}
                        </span>
                      </div>
                      <Artwork id={item.id} />
                      <div className="card-body">
                        <h3>{item.title}</h3>
                        <p>{item.subtitle}</p>
                        <div className="io">
                          <span>{item.input}</span>
                          <ArrowRight size={13} />
                          <span>{item.output}</span>
                        </div>
                        <div className="card-bottom">
                          <Status model={state} />
                          <button
                            className="round-button"
                            disabled={busy}
                            onClick={() => openWorkshop(item.id)}
                            aria-label={`Essayer : ${item.title}`}
                          >
                            <ArrowRight size={21} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <section className="local-note">
                <span className="local-note-icon">
                  <Cpu size={25} strokeWidth={1.5} />
                </span>
                <div>
                  <h2>Votre ordinateur devient le labo.</h2>
                  <p>
                    Les modèles se téléchargent une fois. Ensuite, vos
                    expériences fonctionnent aussi sans Internet.
                  </p>
                </div>
                <button onClick={() => navigate("computer")}>
                  Voir mon ordinateur
                  <ArrowRight size={17} />
                </button>
              </section>
              <div className="bottom-line">
                <span>
                  <Sparkles size={15} /> Pas besoin de savoir coder. Juste
                  d’être curieux.
                </span>
                <span>
                  Commencez par l’atelier 01 <ArrowRight size={14} />
                </span>
              </div>
            </>
          )}

          {view === "explore" && current && (
            <>
              <button
                className="back-link"
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
              >
                <ArrowLeft size={16} />
                Tous les ateliers
              </button>
              <div className="page-heading compact">
                <div>
                  <p className={`eyebrow ${current.color}`}>
                    EXPÉRIENCE {current.number} / 03 · {current.family}
                  </p>
                  <h1 ref={heading} tabIndex={-1}>
                    {current.title}
                  </h1>
                  <p className="page-intro">{current.subtitle}</p>
                </div>
                <Status model={model} />
              </div>
              <div className={`experiment ${current.color}`}>
                <section
                  className="experiment-input"
                  aria-labelledby="input-heading"
                >
                  <div className="experiment-label">
                    <span>1</span>
                    <h2 id="input-heading">
                      {selected === "speech"
                        ? "Écrivez une phrase"
                        : "Choisissez un exemple"}
                    </h2>
                  </div>
                  {selected === "speech" ? (
                    <>
                      <div className="speech-editor">
                        <div className="speech-editor-icon">
                          <AudioLines size={28} />
                        </div>
                        <label htmlFor="speech-text">
                          Votre texte en français
                        </label>
                        <textarea
                          id="speech-text"
                          maxLength={200}
                          disabled={busy}
                          value={text}
                          onChange={(event) => changeText(event.target.value)}
                          rows={5}
                        />
                        <span className="character-count">
                          {text.length} / 200
                        </span>
                      </div>
                      <div className="text-presets">
                        <button
                          disabled={busy}
                          onClick={() => changeText(referenceText)}
                        >
                          Bienvenue
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            changeText(
                              "Le chat chasse les chaussettes sèches de l’archiduchesse.",
                            )
                          }
                        >
                          Un défi de prononciation
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className={`sample-preview ${selected === "ocr" ? "document-preview" : ""}`}
                      >
                        <img
                          src={`/samples/${current.samples.find((item) => item.id === sample)?.image}`}
                          alt={
                            current.samples.find((item) => item.id === sample)
                              ?.label
                          }
                        />
                      </div>
                      <div className="sample-options">
                        {current.samples.map((item) => (
                          <button
                            key={item.id}
                            className={sample === item.id ? "chosen" : ""}
                            aria-pressed={sample === item.id}
                            disabled={busy}
                            onClick={() => chooseSample(item.id)}
                          >
                            <img src={`/samples/${item.image}`} alt="" />
                            <span>{item.label}</span>
                            {sample === item.id && <CheckCircle2 size={15} />}
                          </button>
                        ))}
                      </div>
                      <p className="sample-note">
                        {current.samples.find((item) => item.id === sample)
                          ?.note ?? "Exemple intégré · aucune image à envoyer"}
                      </p>
                    </>
                  )}
                </section>
                <section
                  className="experiment-output"
                  aria-labelledby="output-heading"
                >
                  <div className="experiment-label">
                    <span>2</span>
                    <h2 id="output-heading">Observez le résultat</h2>
                  </div>
                  <div
                    className={`result-area ${result ? "has-result" : ""}`}
                    aria-live="polite"
                  >
                    {!result ? (
                      <div className="result-placeholder">
                        {React.createElement(glyphs[current.id], {
                          size: 39,
                          strokeWidth: 1.3,
                        })}
                        <h3>
                          {selected === "speech"
                            ? "Une phrase prend vie."
                            : selected === "ocr"
                              ? "Des mots vont apparaître."
                              : "Que va-t-elle reconnaître ?"}
                        </h3>
                        <p>Le résultat apparaîtra ici après le calcul.</p>
                        <span>Calcul local · aucun résultat préenregistré</span>
                      </div>
                    ) : (
                      <>
                        <div className="result-caption">
                          <span className="live-dot" />
                          Résultat calculé sur votre ordinateur
                        </div>
                        {result.output.predictions && (
                          <div className="predictions">
                            {result.output.predictions.map((prediction, i) => (
                              <div
                                className={`prediction ${i === 0 ? "first" : ""}`}
                                key={prediction.index}
                              >
                                <div>
                                  <span title={prediction.label}>
                                    {frenchLabels[prediction.label] ??
                                      prediction.label.split(",")[0]}
                                  </span>
                                  <strong>
                                    {(prediction.score * 100).toLocaleString(
                                      "fr-FR",
                                      { maximumFractionDigits: 1 },
                                    )}{" "}
                                    %
                                  </strong>
                                </div>
                                <div className="score-track">
                                  <span
                                    style={{
                                      width: `${Math.max(0.5, prediction.score * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                            <p className="result-footnote">
                              Scores relatifs aux 1 000 catégories apprises. Les
                              noms non traduits restent ceux du modèle.
                            </p>
                          </div>
                        )}
                        {result.output.text !== undefined && (
                          <>
                            <textarea
                              className="ocr-text"
                              aria-label="Texte extrait, sélectionnable et copiable"
                              readOnly
                              value={
                                result.output.text ||
                                "Aucun texte reconnu sur cet exemple."
                              }
                            />
                            <span className="result-footnote">
                              {result.output.lines} lignes reconnues.
                              Comparez-les à l’original.
                            </span>
                          </>
                        )}
                        {audio && (
                          <div className="audio-result">
                            <Wave large />
                            <audio
                              aria-label="Voix synthétique générée"
                              controls
                              src={audio}
                            />
                            <a
                              className="text-link"
                              href={audio}
                              download="ma-voix-synthetique.wav"
                            >
                              <ArrowDownToLine size={15} />
                              Enregistrer l’audio
                            </a>
                          </div>
                        )}
                        <div className="measurement">
                          <CheckCircle2 size={14} />
                          Calcul : {seconds(result.measurement.inferenceMs)}
                          <span>
                            Préparation : {seconds(result.measurement.loadMs)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {!model?.installed || !model.measurement?.passed ? (
                    <div className="launch-area">
                      <p>
                        Une première préparation est nécessaire.
                        <br />
                        <strong>{bytesLabel(model?.bytes ?? 0)}</strong> à
                        télécharger, puis un test sur ce poste.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy || !model}
                        onClick={() => prepare(current.id)}
                      >
                        <Download size={17} />
                        {model?.installed
                          ? "Tester cet atelier"
                          : "Télécharger et tester"}
                      </button>
                    </div>
                  ) : (
                    <div className="launch-area">
                      <p>
                        <ShieldCheck size={14} /> Tout est prêt. Internet n’est
                        plus nécessaire.
                      </p>
                      <button
                        className="button primary"
                        disabled={
                          busy || (selected === "speech" && !text.trim())
                        }
                        onClick={() => run(current.id)}
                      >
                        <Play size={17} />
                        {current.verb}
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <div className="lesson">
                <span className={`lesson-icon ${current.color}`}>
                  <BookOpen size={22} />
                </span>
                <div>
                  <h2>Ce qui vient de se passer</h2>
                  <p>{current.lesson}</p>
                  <details>
                    <summary>
                      Et sa limite ?<ChevronDown size={14} />
                    </summary>
                    <p>{current.limit}</p>
                  </details>
                </div>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    openWorkshop(
                      workshops[
                        (workshops.findIndex((item) => item.id === selected) +
                          1) %
                          workshops.length
                      ].id,
                    )
                  }
                >
                  Atelier suivant
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}

          {view === "prepare" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">AVANT LE COURS</p>
                  <h1 ref={heading} tabIndex={-1}>
                    Prêt, même sans Wi-Fi.
                  </h1>
                  <p className="page-intro">
                    Préparez vos ateliers maintenant. Profitez-en tranquillement
                    ensuite.
                  </p>
                </div>
                <span className="session-tag">
                  <HardDrive size={15} />
                  {bytesLabel(totalStored)} utilisés
                </span>
              </div>
              <section className="preparation">
                <div className="section-title">
                  <h2>Les ateliers à emporter</h2>
                  <span>Modèles téléchargés uniquement à votre demande</span>
                </div>
                <div className="preparation-list">
                  {workshops.map((item) => {
                    const state = models.find((model) => model.id === item.id),
                      Icon = glyphs[item.id];
                    return (
                      <div className="preparation-row" key={item.id}>
                        <label className="selection-label">
                          <input
                            type="checkbox"
                            checked={selection.includes(item.id)}
                            onChange={() =>
                              setSelection((previous) =>
                                previous.includes(item.id)
                                  ? previous.filter((id) => id !== item.id)
                                  : [...previous, item.id],
                              )
                            }
                          />
                          <span className={`workshop-icon ${item.color}`}>
                            <Icon size={23} />
                          </span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {state?.name} · {bytesLabel(state?.bytes ?? 0)}
                            </small>
                          </span>
                        </label>
                        <Status model={state} />
                        {state && state.storedBytes > 0 && (
                          <button
                            className="icon-button"
                            disabled={busy}
                            aria-label={`Supprimer les ressources : ${item.title}`}
                            onClick={() => setConfirmRemove(item.id)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="prepare-footer">
                  <span>
                    {bytesLabel(selectedBytes)} à télécharger
                    <br />
                    <small>
                      Les ressources déjà présentes seront vérifiées.
                    </small>
                  </span>
                  <button
                    className="button primary"
                    disabled={busy || !selection.length || models.length !== 3}
                    onClick={() =>
                      action(async () => {
                        for (const id of selection) {
                          if (cancelled.current) break;
                          unwrap(await window.atelier.prepare(id));
                          setModels(unwrap(await window.atelier.status()));
                        }
                      }, "Votre sélection est préparée et testée sur ce poste.")
                    }
                  >
                    <Download size={18} />
                    Préparer ma sélection
                  </button>
                </div>
              </section>
              {confirmRemove && (
                <div className="delete-confirm" role="alert">
                  <span>
                    Supprimer les modèles et le test de «{" "}
                    {workshops.find((item) => item.id === confirmRemove)?.title}{" "}
                    » ? Vous pourrez les télécharger à nouveau.
                  </span>
                  <button
                    className="button secondary small"
                    onClick={() => setConfirmRemove(null)}
                  >
                    Conserver
                  </button>
                  <button
                    className="button danger small"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        unwrap(await window.atelier.remove(confirmRemove));
                        setResults((previous) => ({
                          ...previous,
                          [confirmRemove]: undefined,
                        }));
                        setConfirmRemove(null);
                      }, "Les ressources de cet atelier ont été supprimées.")
                    }
                  >
                    Supprimer
                  </button>
                </div>
              )}
              <div className="offline-pack">
                <span className="pack-icon">
                  <FolderInput size={27} />
                </span>
                <div>
                  <h2>Un pack pour toute la classe</h2>
                  <p>
                    Copiez les modèles sur une clé USB. Chaque personne pourra
                    les importer, puis les tester sur son ordinateur.
                  </p>
                  <div className="pack-actions">
                    <button
                      className="button secondary"
                      disabled={
                        busy || !models.some((model) => model.installed)
                      }
                      onClick={() =>
                        action(async () => {
                          const path = unwrap(
                            await window.atelier.exportPack(),
                          );
                          if (path) setNotice(`Pack créé : ${path}`);
                        })
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Créer un pack
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          const count = unwrap(
                            await window.atelier.importPack(),
                          );
                          if (count !== null)
                            setNotice(
                              `${count} atelier(s) importé(s). Lancez la préparation pour les tester sur ce poste.`,
                            );
                        })
                      }
                    >
                      <FolderInput size={16} />
                      Importer un pack
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === "computer" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ON FAIT CONNAISSANCE</p>
                  <h1 ref={heading} tabIndex={-1}>
                    Votre ordinateur, simplement.
                  </h1>
                  <p className="page-intro">
                    Un premier repère. Chaque atelier sera aussi testé en
                    situation réelle.
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    action(
                      refresh,
                      "Les informations de votre ordinateur sont à jour.",
                    )
                  }
                >
                  <Settings2 size={16} />
                  Actualiser
                </button>
              </div>
              {diagnostic ? (
                <>
                  <div className="computer-summary">
                    <div className="computer-illustration">
                      <Monitor size={74} strokeWidth={1} />
                      <span>
                        <span /> Calcul local
                      </span>
                    </div>
                    <div>
                      <p className="eyebrow">VOTRE ÉQUIPEMENT</p>
                      <h2>
                        {diagnostic.platform === "win32"
                          ? "Windows"
                          : diagnostic.platform === "darwin"
                            ? "macOS"
                            : "Linux"}{" "}
                        ·{" "}
                        {diagnostic.arch === "x64"
                          ? "64 bits"
                          : diagnostic.arch}
                      </h2>
                      <p>{diagnostic.cpu}</p>
                      <div className="computer-values">
                        <div>
                          <strong>
                            {Math.round(diagnostic.totalMb / 1024)} Go
                          </strong>
                          <span>de mémoire totale</span>
                        </div>
                        <div>
                          <strong>
                            {(diagnostic.availableMb / 1024).toLocaleString(
                              "fr-FR",
                              { maximumFractionDigits: 1 },
                            )}{" "}
                            Go
                          </strong>
                          <span>disponibles maintenant</span>
                        </div>
                        <div>
                          <strong>
                            {Math.round(diagnostic.freeDiskMb / 1024)} Go
                          </strong>
                          <span>libres sur le disque</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="info-note">
                    <CircleHelp size={20} />
                    <p>
                      8 Go de mémoire est notre cible de test. La place
                      disponible, le processeur et les autres applications
                      ouvertes comptent aussi. Un atelier testé aujourd’hui peut
                      manquer de mémoire demain.
                    </p>
                  </div>
                </>
              ) : (
                <p role="status">Lecture de votre configuration…</p>
              )}
              <section className="diagnostics">
                <div className="section-title">
                  <h2>Les essais sur ce poste</h2>
                  <span>{readyCount} atelier(s) testé(s) avec succès</span>
                </div>
                {workshops.map((item) => {
                  const state = models.find((model) => model.id === item.id),
                    measurement = state?.measurement;
                  return (
                    <div className="diagnostic-row" key={item.id}>
                      <div>
                        <h3>{item.title}</h3>
                        <p>
                          {measurement
                            ? `Dernier test : ${new Date(measurement.at).toLocaleDateString("fr-FR")} · total ${seconds(measurement.totalMs)} · pic de l’app ${measurement.peakAppMb} Mo`
                            : "Aucun test enregistré pour cette version."}
                        </p>
                      </div>
                      <Status model={state} />
                      <button
                        className="button secondary small"
                        disabled={busy || !state}
                        onClick={() => prepare(item.id)}
                      >
                        {state?.installed ? "Retester" : "Préparer"}
                      </button>
                    </div>
                  );
                })}
              </section>
              <details className="technical-details">
                <summary>
                  Informations pour la personne qui vous accompagne
                  <ChevronDown size={15} />
                </summary>
                <p>
                  {diagnostic?.runtime} · Application {diagnostic?.appVersion} ·
                  Moteur CPU WebAssembly · 1 thread de calcul. Les pics mémoire
                  concernent l’application et ses processus, pas l’ensemble du
                  système.
                </p>
                <p>
                  Les tests du modèle vocal vérifient la génération d’un signal
                  audio ; l’intelligibilité doit aussi être vérifiée à l’écoute.
                </p>
              </details>
            </>
          )}

          {view === "help" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">C’EST SIMPLE, PROMIS</p>
                  <h1 ref={heading} tabIndex={-1}>
                    Un petit coup de main.
                  </h1>
                  <p className="page-intro">
                    L’essentiel pour commencer, sans vocabulaire technique.
                  </p>
                </div>
                <CircleHelp className="help-glyph" size={56} strokeWidth={1} />
              </div>
              <div className="help-layout">
                <section className="quickstart">
                  <h2>Votre première expérience</h2>
                  {[
                    "Choisissez un atelier dans « Explorer les IA ».",
                    "Cliquez sur « Télécharger et tester ». Cela ne se fait qu’une fois par modèle et par version.",
                    "Choisissez un exemple puis lancez le calcul.",
                    "Observez le résultat et ouvrez « Et sa limite ? ».",
                  ].map((step, index) => (
                    <div className="help-step" key={step}>
                      <span>{index + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))}
                  <button
                    className="button primary"
                    onClick={() => navigate("explore")}
                  >
                    C’est parti
                    <ArrowRight size={17} />
                  </button>
                </section>
                <section className="faq">
                  <h2>Vos questions</h2>
                  {[
                    [
                      "Mes images sont-elles envoyées quelque part ?",
                      "Non. Les calculs se font sur votre ordinateur. Internet sert à télécharger les modèles à votre demande. Cette version utilise uniquement les exemples intégrés ; aucun compte ni aucune clé API ne sont nécessaires.",
                    ],
                    [
                      "Comment faire sans connexion ?",
                      "Dans « Préparer ma séance », téléchargez et testez les ateliers avant le cours. Vous pouvez aussi importer le pack de votre formateur depuis une clé USB, puis lancer le test local.",
                    ],
                    [
                      "Le calcul est lent ou ne démarre pas.",
                      "Fermez les applications dont vous n’avez pas besoin et réessayez. Le bouton Annuler arrête le calcul. Si un atelier échoue, les autres restent accessibles. Dans « Mon ordinateur », vous pouvez relancer le test.",
                    ],
                    [
                      "Comment récupérer de la place ?",
                      "Dans « Préparer ma séance », utilisez la corbeille à côté de l’atelier. Cela supprime son modèle et son test. Vos fichiers audio enregistrés et vos packs exportés sont conservés.",
                    ],
                    [
                      "Où sont les autres types d’IA ?",
                      "La vision, la lecture et la voix forment le premier parcours. Détection d’objets, transcription, gestes et autres ateliers sont prévus ensuite. La génération d’image reste expérimentale ; la vidéo sera illustrée par des exemples préparés.",
                    ],
                    [
                      "Est-ce déjà validé sur tous les ordinateurs ?",
                      "Non. Cette version est un prototype à tester avant une séance. Les configurations de 8 et 16 Go et les versions Mac et Linux doivent être qualifiées sur des machines réelles.",
                    ],
                  ].map(([question, answer]) => (
                    <details key={question}>
                      <summary>
                        {question}
                        <ChevronDown size={15} />
                      </summary>
                      <p>{answer}</p>
                    </details>
                  ))}
                </section>
              </div>
              <details className="technical-details">
                <summary>
                  Crédits et modèles utilisés
                  <ChevronDown size={15} />
                </summary>
                <p>
                  Vision : MobileNetV3 Small, export ONNX Community, poids timm.
                  Lecture : PaddlePaddle PP-OCRv6 Tiny, détection et
                  reconnaissance. Voix : Siwis française pour Piper, phonémiseur
                  eSpeak NG via piper-wasm. Les bibliothèques et leurs notices
                  sont conservées avec l’application.
                </p>
                <p>
                  Chat : Von.grzanka, « Felis catus-cat on snow », Wikimedia
                  Commons. Chien : Elf, retouches Djmirko / FT2, «
                  YellowLabradorLooking new », Wikimedia Commons. Images
                  redimensionnées, CC BY-SA 3.0. Documents et image abstraite :
                  Le Labo Numérique, CC BY 4.0. Sources détaillées et licences
                  dans le README et les notices de l’application.
                </p>
                <p>
                  CC BY-SA 3.0 : https://creativecommons.org/licenses/by-sa/3.0/
                  · CC BY 4.0 : https://creativecommons.org/licenses/by/4.0/
                </p>
              </details>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Une expérience du Labo Numérique</span>
          <span>Comprendre. Essayer. Prendre du recul.</span>
        </footer>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
