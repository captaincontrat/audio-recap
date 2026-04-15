# Meeting Recap Web App Brief

## Source Request

Dans le dossier `app`, créer une application web permettant à un utilisateur
d'obtenir un compte rendu de réunion en fournissant un fichier audio ou vidéo
et, optionnellement, des notes.

L'utilisateur peut se connecter avec:

- email + password
- son compte Google

## Functional Requirements To Preserve

### Core workflow

- L'application web doit vivre dans `app/`.
- L'utilisateur peut importer un fichier audio ou vidéo.
- L'utilisateur peut ajouter des notes facultatives au moment du traitement.
- Le système génère un transcript.
- Le système génère un compte rendu de réunion.
- Le nom du transcript est généré automatiquement par IA selon le sujet de la
  réunion.

### Data retention and privacy

- Les fichiers audio/vidéo ne doivent pas etre conserves apres generation du
  transcript.
- Seuls les transcripts et les donnees necessaires a leur consultation doivent
  etre conserves a long terme.
- L'utilisateur doit pouvoir retrouver facilement ses transcripts.

### Authentication

- Authentification par email + password.
- Authentification via Google.

### Transcript management

- Voir la liste de ses transcripts.
- Modifier un transcript.
- Exporter un transcript.
- Renommer un transcript.
- Supprimer un transcript.
- Ajouter des tags.
- Marquer comme important.
- Activer un partage public par URL.
- Trier la liste par ces differents criteres.

### Public sharing

- L'URL publique de partage doit contenir un double UUID.
- L'URL doit etre difficile a deviner.

### Export formats

- Formats a supporter:
  - `docx`
  - `pdf`
  - `txt`
  - `md`
- Le backend envoie toujours du markdown au frontend.
- Le frontend convertit le markdown dans le format d'export demande.

### SaaS expectations

- L'utilisateur peut faire les actions supplementaires classiques d'une solution
  web SaaS de ce type.

## Product Surface Implied By The Request

- Une experience de creation de compte et de connexion.
- Une experience d'upload et de suivi de traitement.
- Une bibliotheque personnelle de transcripts.
- Une page detail de transcript.
- Des actions de gestion et d'export.
- Des liens publics de partage.
- Des fonctions de tri et d'organisation.

## Constraints And Non-Negotiables

- Ne rien oublier de la liste ci-dessus dans les specs OpenSpec.
- Commencer le travail OpenSpec par une exploration.
- Couvrir le besoin complet avant de s'arreter.
- Decider soi-meme les details non specifies.

## Decisions To Carry Into Specs

- Considerer qu'un transcript est la ressource principale conservee et geree
  par l'application.
- Considerer que le compte rendu de reunion est derive du transcript et fait
  partie de la fiche transcript si cela simplifie le produit.
- Considerer que l'application doit definir les operations SaaS classiques
  attendues autour du compte, des imports, des erreurs et de la gestion des
  contenus, meme si elles ne sont pas detaillees mot pour mot dans la demande.

## Spec Coverage Checklist

- [ ] Upload audio/video
- [ ] Notes optionnelles
- [ ] Auth email/password
- [ ] Auth Google
- [ ] Non-retention des fichiers source
- [ ] Conservation des transcripts
- [ ] Nommage automatique par IA
- [ ] Liste des transcripts
- [ ] Edition transcript
- [ ] Export `docx`
- [ ] Export `pdf`
- [ ] Export `txt`
- [ ] Export `md`
- [ ] Conversion markdown cote frontend
- [ ] Renommage
- [ ] Suppression
- [ ] Tags
- [ ] Important / favoris
- [ ] Partage public par double UUID
- [ ] Tri par differents criteres
- [ ] Fonctions SaaS classiques additionnelles
