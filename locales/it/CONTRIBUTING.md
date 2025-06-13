[English](../../CONTRIBUTING.md) • [Català](../ca/CONTRIBUTING.md) • [Deutsch](../de/CONTRIBUTING.md) • [Español](../es/CONTRIBUTING.md) • [Français](../fr/CONTRIBUTING.md) • [हिंदी](../hi/CONTRIBUTING.md) • <b>Italiano</b> • [Nederlands](../nl/CONTRIBUTING.md) • [Русский](../ru/CONTRIBUTING.md)

[日本語](../ja/CONTRIBUTING.md) • [한국어](../ko/CONTRIBUTING.md) • [Polski](../pl/CONTRIBUTING.md) • [Português (BR)](../pt-BR/CONTRIBUTING.md) • [Türkçe](../tr/CONTRIBUTING.md) • [Tiếng Việt](../vi/CONTRIBUTING.md) • [简体中文](../zh-CN/CONTRIBUTING.md) • [繁體中文](../zh-TW/CONTRIBUTING.md)

# Contribuire a Roo Code

Roo Code è un progetto guidato dalla community e apprezziamo molto ogni contributo. Per semplificare la collaborazione, operiamo secondo un approccio [Issue-First](#approccio-issue-first), il che significa che tutte le [Pull Request (PR)](#inviare-una-pull-request) devono prima essere collegate a una Issue GitHub. Ti preghiamo di leggere attentamente questa guida.

## Indice

- [Prima di contribuire](#prima-di-contribuire)
- [Trovare e pianificare il tuo contributo](#trovare-e-pianificare-il-tuo-contributo)
    - [Richieste di funzionalità vs. Proposte dettagliate di funzionalità](#richieste-di-funzionalità-vs-proposte-dettagliate-di-funzionalità)
- [Processo di sviluppo e invio](#processo-di-sviluppo-e-invio)
- [Legale](#legale)

## Prima di contribuire

### 1. Codice di condotta

Tutti i collaboratori devono rispettare il nostro [Codice di condotta](./CODE_OF_CONDUCT.md).

### 2. Roadmap del progetto

La nostra roadmap guida la direzione del progetto. Allinea i tuoi contributi con questi obiettivi chiave:

### Affidabilità prima di tutto

- Garantire che l'editing delle differenze e l'esecuzione dei comandi siano costantemente affidabili
- Ridurre i punti di attrito che scoraggiano l'uso regolare
- Garantire un funzionamento fluido in tutte le lingue e su tutte le piattaforme
- Ampliare il supporto robusto per una vasta gamma di provider e modelli di IA

### Esperienza utente migliorata

- Semplificare l'interfaccia utente per maggiore chiarezza e intuitività
- Migliorare continuamente il flusso di lavoro per soddisfare le elevate aspettative degli sviluppatori

### Leadership nelle prestazioni degli agenti

- Stabilire parametri di valutazione completi (evals) per misurare la produttività nel mondo reale
- Rendere facile per tutti eseguire e interpretare queste valutazioni
- Fornire miglioramenti che dimostrino chiari aumenti nei punteggi di valutazione

Menziona l'allineamento con queste aree nelle tue PR.

### 3. Unisciti alla community Roo Code

- **Principale:** Unisciti al nostro [Discord](https://discord.gg/roocode) e invia un DM a **Hannes Rudolph (`hrudolph`)**.
- **Alternativa:** I collaboratori esperti possono partecipare direttamente tramite [GitHub Projects](https://github.com/orgs/RooCodeInc/projects/1).

## Trovare e pianificare il tuo contributo

### Tipi di contributi

- **Correzione bug:** Risolvere problemi nel codice.
- **Nuove funzionalità:** Aggiungere nuove funzionalità.
- **Documentazione:** Migliorare guide e chiarezza.

### Approccio Issue-First

Tutti i contributi devono iniziare con una Issue GitHub.

- **Verificare le issue esistenti:** Cerca su [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues).
- **Creare una issue:** Usa i template appropriati:
    - **Bug:** Template "Bug Report".
    - **Funzionalità:** Template "Detailed Feature Proposal". Approvazione richiesta prima di iniziare. (Vedi [Richieste di funzionalità vs. Proposte dettagliate di funzionalità](#richieste-di-funzionalità-vs-proposte-dettagliate-di-funzionalità) sotto)
- **Reclamare issue:** Commenta e attendi l'assegnazione ufficiale.

**Le PR senza issue approvate potrebbero essere chiuse.**

### Decidere su cosa lavorare

- Controlla il [Progetto GitHub](https://github.com/orgs/RooCodeInc/projects/1) per "Good First Issues" non assegnate.
- Per la documentazione, visita [Roo Code Docs](https://github.com/RooCodeInc/Roo-Code-Docs).

### Segnalare bug

- Controlla prima i report esistenti.
- Crea nuovi report di bug usando il [template "Bug Report"](https://github.com/RooCodeInc/Roo-Code/issues/new/choose).
- **Problemi di sicurezza:** Segnala privatamente tramite [security advisories](https://github.com/RooCodeInc/Roo-Code/security/advisories/new).

### Richieste di funzionalità vs. Proposte dettagliate di funzionalità

Comprendere la differenza tra questi due tipi di invio è cruciale per scegliere l'approccio giusto:

#### Richiesta di funzionalità (GitHub Discussions)

**Scopo**: Condividere idee o suggerimenti generali senza pianificazione dettagliata.

**Come inviare**:

- Naviga su [GitHub Discussions - Feature Requests](https://github.com/RooCodeInc/Roo-Code/discussions/categories/feature-requests)
- O clicca sul link "Feature Request" quando premi il pulsante "New Issue" nella sezione issue

**Usa questo quando**:

- La tua idea non è ancora completamente sviluppata
- Vuoi input o feedback dalla community
- Stai proponendo idee senza piani di implementarle personalmente

#### Proposta dettagliata di funzionalità (GitHub Issues)

**Scopo**: Funzionalità chiaramente delineate destinate all'implementazione immediata dopo l'approvazione.

**Come inviare**:

- Naviga su [GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues)
- Clicca su "New Issue" e seleziona il template "Detailed Feature Proposal"

**Usa questo quando**:

- La tua funzionalità è completamente pianificata e pronta per l'approvazione
- Tu o qualcun altro intende implementare la funzionalità presto
- È necessaria l'approvazione formale prima di iniziare lo sviluppo

**Nota**: Le Proposte dettagliate di funzionalità devono essere approvate e assegnate da un maintainer prima di iniziare l'implementazione, come menzionato nella sezione [Approccio Issue-First](#approccio-issue-first) sopra.

![Selezione del template Issue](placeholder-for-issue-template-selection-image)

**Importante**: Scegliere il template sbagliato potrebbe portare al reindirizzamento o alla chiusura del tuo invio. Non usare i Report di Bug per idee di funzionalità.

## Processo di sviluppo e invio

### Configurazione dello sviluppo

1. **Fork & Clona:**

```
git clone https://github.com/TUO_USERNAME/Roo-Code.git
```

2. **Installa le dipendenze:**

```
npm run install:all
```

3. **Debug:** Apri con VS Code (`F5`).

### Linee guida per scrivere codice

- Una PR focalizzata per funzionalità o correzione.
- Segui le best practice di ESLint e TypeScript.
- Scrivi commit chiari e descrittivi che fanno riferimento alle issue (es. `Fixes #123`).
- Fornisci test approfonditi (`npm test`).
- Fai rebase sul branch `main` più recente prima dell'invio.

### Inviare una Pull Request

- Inizia come **PR in bozza** se cerchi feedback anticipato.
- Descrivi chiaramente le tue modifiche seguendo il Template di Pull Request.
- Fornisci screenshot/video per modifiche UI.
- Indica se sono necessari aggiornamenti alla documentazione.

### Politica di Pull Request

- Deve fare riferimento a issue pre-approvate e assegnate.
- Le PR che non rispettano la politica potrebbero essere chiuse.
- Le PR dovrebbero superare i test CI, allinearsi con la roadmap e avere documentazione chiara.

### Processo di revisione

- **Triage quotidiano:** Controlli rapidi da parte dei maintainer.
- **Revisione settimanale approfondita:** Valutazione completa.
- **Itera rapidamente** in base al feedback.

## Legale

Inviando una pull request, accetti che i tuoi contributi siano concessi in licenza sotto la Licenza Apache 2.0, in linea con la licenza di Roo Code.
