# Audio Recap

Monorepo `pnpm` avec, pour l'instant, un CLI `TypeScript` pour:

- accélérer un audio de meeting en `x2` avec `ffmpeg`,
- le découper si nécessaire sous la limite d'upload OpenAI,
- transcrire avec `gpt-4o-transcribe-diarize`,
- générer un `transcript.md`,
- générer un `summary.md` avec `gpt-5.4` et `reasoning: { effort: "high" }`.

## Prérequis

- Node.js `20+`
- `pnpm`
- `ffmpeg`
- `ffprobe`
- `OPENAI_API_KEY` dans `.env`

Le SDK utilisé est le SDK officiel Node.js: [openai-node](https://github.com/openai/openai-node).

## Structure

- `libs/audio-recap`: package CLI actuel.
- `app`: dossier réservé à la future application web.

Les commandes ci-dessous s'exécutent depuis la racine du monorepo et proxy vers `libs/audio-recap`.

## Installation

```bash
pnpm install
```

## Utilisation

```bash
pnpm process:meeting \
  --audio "./Jean-Christophe - Rue Saint-Honoré.m4a" \
  --notes "./meeting-notes.md" \
  --out-dir "./out"
```

Sans notes:

```bash
pnpm process:meeting \
  --audio "./Rue Saint-Honoré.m4a" \
  --out-dir "./out"
```

Avec formats de CR personnalisés:

```bash
pnpm process:meeting \
  --audio "./client-call.m4a" \
  --summary-formats '{"formats":[{"key":"client","matchDescription":"Client-facing follow-up with validations, objections, commitments, or delivery expectations.","template":"# [Meeting title]\n## Client recap\n## Decisions and validations\n## Commitments\n## Risks and watchouts\n## Next contact"},{"key":"upsell-accounting-client","matchDescription":"Commercial follow-up focused on upsell opportunities with an accounting client.","template":"# [Meeting title]\n## Commercial context\n## Upsell signals\n## Objections\n## Proposal strategy\n## Next actions"}]}' \
  --out-dir "./out"
```

Options:

- `--audio`: chemin vers le fichier audio source.
- `--notes`: chemin facultatif vers les notes du meeting.
- `--out-dir`: dossier de sortie pour `transcript.md` et `summary.md`.
- `--language`: indice facultatif de langue pour la transcription et le résumé.
- `--summary-formats`: chaîne JSON facultative pour remplacer un format intégré ou ajouter des types de réunion custom.
- `--keep-temp`: conserve les artefacts intermédiaires `ffmpeg`.

Quand `--notes` est omis, le résumé est généré uniquement à partir du transcript diarizé. Le résultat reste utile, mais peut être moins bien structuré ou moins contextualisé qu'avec de vraies notes de réunion.

Formats intégrés:

- `project`
- `client`
- `codir`
- `brainstorming`
- `general`

Le moteur compare les notes et le transcript au catalogue disponible, choisit le meilleur match, puis retombe sur `general` si aucun type spécialisé n'est suffisamment convaincant.

## Pipeline

### 1. Prétraitement audio

L'audio est accéléré en `x2` puis ré-encodé en mono compressé avant upload pour réduire les coûts de transcription.

Documentation utile:

- [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)

### 2. Découpage sous la limite OpenAI

Le script applique une marge de sécurité sous la limite d'upload de `25 MB`. Il découpe aussi l'audio si sa durée prétraitée dépasse une durée cible plus conservatrice afin d'éviter des appels de transcription trop longs. Quand un découpage est nécessaire, les morceaux sont générés avec un overlap fixe de `1s` entre chaque morceau.

Important:

- les morceaux doivent rester sous la limite documentée par OpenAI,
- les morceaux doivent aussi rester sous la durée maximale acceptée par `gpt-4o-transcribe-diarize`,
- le script vise en pratique des chunks plus courts que ce maximum pour améliorer la fiabilité et le temps de retour,
- les frontières de chunks se recouvrent volontairement de `1s`,
- la fusion du transcript supprime les doublons induits par cette zone de recouvrement.

Documentation utile:

- [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text)

### 3. Transcription diarizée

La transcription utilise `gpt-4o-transcribe-diarize` avec `response_format: "diarized_json"` et `chunking_strategy: "auto"`. Quand plusieurs chunks sont présents, ils sont envoyés en parallèle puis réassemblés dans l'ordre chronologique.

Contraintes documentées prises en compte:

- `gpt-4o-transcribe-diarize` supporte la diarisation par segments,
- `prompt`, `logprobs` et `timestamp_granularities[]` ne sont pas utilisés sur ce modèle,
- les timestamps correspondent à l'audio prétraité envoyé à l'API, pas à l'audio original.

Documentation utile:

- [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [gpt-4o-transcribe-diarize](https://developers.openai.com/api/docs/models/gpt-4o-transcribe-diarize)

### 4. Transcript markdown

Le fichier `transcript.md` est un rendu fidèle des segments diarizés fusionnés, avec timestamps lisibles et libellés de speaker fournis par l'API.

Note:

- si l'audio a été chunké, les timestamps restent alignés sur la timeline de l'audio accéléré prétraité,
- le script ne re-scale pas les horodatages vers la timeline du fichier original.

### 5. Résumé markdown

Le résumé est généré avec la Responses API et `gpt-5.4` en `reasoning: { effort: "high" }`.

Le prompt:

- analyse d'abord les notes quand elles sont disponibles pour proposer la meilleure structure,
- bascule sur le transcript seul si aucune note n'est fournie,
- recoupe cette structure avec le transcript,
- reste fidèle au matériau fourni,
- évite d'inventer décisions, actions ou risques non supportés.

Le transcript est sérialisé en blocs stables et horodatés pour rester citation-ready, même si la première version du résumé n'affiche pas de citations visibles.

Documentation utile:

- [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)
- [Reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices)
- [Prompt guidance for GPT-5.4](https://developers.openai.com/api/docs/guides/prompt-guidance)
- [Prompting](https://developers.openai.com/api/docs/guides/prompting)
- [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [Citation Formatting](https://developers.openai.com/api/docs/guides/citation-formatting)

## Sorties

Le script écrit:

- `transcript.md`
- `summary.md`

dans le dossier fourni via `--out-dir`.

## Vérification locale

Pour vérifier la configuration TypeScript:

```bash
pnpm typecheck
```
