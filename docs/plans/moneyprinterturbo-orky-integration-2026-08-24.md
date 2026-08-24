# ORKY × MoneyPrinterTurbo — plan d’intégration

Date : 2026-08-24  
Statut : plan uniquement — aucune implémentation runtime dans cette branche  
Décision : **GO, priorité 1**, sous forme d’exécuteur vidéo interne et non d’un second Studio.

## 1. Conclusion produit

MoneyPrinterTurbo (MPT) peut apporter une vraie valeur à ORKY parce qu’ORKY possède déjà les éléments que MPT ne possède pas : identité créateur, feed, publication native, Studio, stockage canonique, analytics, commerce shoppable, abonnement Stripe et relation avec Orchidy. MPT apporte surtout le chaînon « idée/produit/script → vidéo verticale finie ».

La mauvaise intégration serait d’embarquer le WebUI MPT ou de créer un deuxième éditeur. La bonne intégration est :

```text
ORKY Studio
  -> production brief canonique
  -> Video Generation Gateway
      -> executor=mpt_fast
      -> executor=openmontage_agentic (déjà prévu)
      -> autres providers futurs
  -> render candidat
  -> validation / édition ORKY
  -> pipeline média ORKY autoritaire
  -> Video + S3/MinIO + feed + produit Orchidy éventuel
```

MPT doit donc être invisible pour l’utilisateur final. ORKY vend le résultat et le workflow, pas le nom du moteur.

## 2. Pourquoi cela peut rapporter de l’argent

Le job-to-be-done est monétisable : « créer rapidement une vidéo publiable sans savoir monter ». Il est encore plus fort pour une vidéo liée à un produit : « transformer une fiche produit réelle en short shoppable ».

La valeur économique d’ORKY ne doit pas être « une IA qui fait des vidéos », commodité déjà très concurrentielle. Le différentiel est :

- génération directement dans le Studio ;
- réédition avant publication ;
- publication dans le feed ORKY ;
- produit shoppable relié à Orchidy ;
- réutilisation des vérités prix/stock/variantes sans hallucination ;
- analytics après publication ;
- possibilité de créer plusieurs variantes d’un même concept.

Hypothèse de monétisation à tester :

- Free : aperçu/brief/script, éventuellement un essai limité ;
- PRO : quota mensuel de rendus ou crédits créateur ;
- top-up : packs de rendus/crédits ;
- pas de BUSINESS tant que le plan BUSINESS ORKY n’est pas réellement commercialisable.

Ne pas fixer le prix avant le benchmark de coût. Cible de lancement : marge brute variable >= 70 % après LLM, TTS, médias génératifs éventuels, rendu, stockage, egress et retries.

## 3. Capacités MPT utiles à ORKY

À réutiliser derrière un adaptateur :

- script depuis sujet ou script imposé ;
- mots-clés et appariement script ↔ médias ;
- sources Pexels / Pixabay / Coverr ;
- médias locaux fournis par ORKY ;
- format 9:16 ;
- TTS multi-provider ;
- BGM ;
- sous-titres configurables ;
- batch de variantes ;
- transitions et durée de clips ;
- génération vidéo par provider externe en option ;
- file de tâches mémoire/Redis ;
- API + suivi de tâche ;
- génération de metadata sociale.

À ne pas adopter comme autorité :

- stockage final MPT ;
- publication cross-platform MPT comme vérité ORKY ;
- gestion utilisateur MPT ;
- UI MPT ;
- configuration utilisateur des API keys MPT ;
- état de tâche MPT comme état métier final ;
- média récupéré sans provenance/licence enregistrée côté ORKY.

## 4. Chevauchement avec OpenMontage : ne pas dupliquer

ORKY possède déjà un contrat OpenMontage. Il faut conserver cette architecture et introduire MPT comme exécuteur complémentaire.

Positionnement proposé :

| Mode | Usage | Force |
| --- | --- | --- |
| `mpt_fast` | faceless short, produit, explainer, liste, narration | rapide, prévisible, stock/TTS/captions |
| `openmontage_agentic` | production complexe, itérative, multi-étapes | agentique, approvals, composition avancée |
| `orky_manual` | montage utilisateur | contrôle maximal |

Le sélecteur doit être orienté résultat (« Rapide », « Production avancée », « Manuel »), pas orienté fournisseur.

## 5. Architecture cible

### 5.1 Video Generation Gateway

Créer une frontière serveur ORKY :

```text
backend/src/video-generation/
  contracts.ts
  service.ts
  providers/
    mpt.provider.ts
    openmontage.provider.ts
  policy.ts
  cost.ts
  provenance.ts
```

Contrat minimal :

```ts
type VideoGenerationRequest = {
  actorId: string;
  source: 'topic' | 'product' | 'reference' | 'script';
  topic?: string;
  script?: string;
  productRef?: { catalogItemId: string; variantKey?: string };
  language: string;
  durationSeconds: number;
  aspectRatio: '9:16';
  brandPresetId?: string;
  variantCount: number;
};
```

Le provider MPT traduit ce contrat vers les champs MPT (`video_subject`, `video_script`, `video_terms`, `video_source`, `video_materials`, `voice_name`, `bgm_*`, `subtitle_*`, etc.). Aucun composant React ne connaît ce contrat MPT.

### 5.2 MPT comme sidecar privé

Déployer MPT comme service privé Docker/Coolify :

```text
ORKY API -> réseau privé -> MPT API
```

Règles :

- API MPT jamais exposée publiquement ;
- API key MPT obligatoire ;
- URL et secret seulement côté serveur ;
- Redis activé en production ;
- limites de concurrence explicites ;
- version MPT épinglée à un tag/SHA testé, jamais `main` flottant ;
- volume temporaire borné + nettoyage ;
- timeout et circuit breaker côté ORKY.

### 5.3 Retour dans le pipeline ORKY

Un MP4 MPT n’est qu’un **candidat**. À la fin :

1. télécharger/streamer le render depuis le réseau privé ;
2. `ffprobe` ORKY ;
3. vérifier durée, dimensions, codecs, taille ;
4. normaliser si nécessaire ;
5. produire la miniature ;
6. stocker dans MinIO/S3 ORKY ;
7. créer une entité `GeneratedVideoDraft` ou état draft équivalent ;
8. permettre édition dans la timeline ;
9. publier seulement via le rail `Video` existant.

## 6. Produit shoppable

Flux prioritaire :

```text
Produit Orchidy réel
 -> Créer une vidéo
 -> ORKY récupère seulement les faits autoritatifs nécessaires
 -> génération du script
 -> contrôle anti-invention
 -> MPT assemble images produit + B-roll + TTS + captions
 -> brouillon ORKY
 -> revue créateur
 -> publication
 -> VideoProductMatch
```

Le prompt de génération doit interdire : prix inventé, stock inventé, faux avis, faux résultat produit, fausse promotion. Juste avant publication, ORKY revalide toujours les données commerce via le mécanisme existant.

## 7. Provenance et droits

Persistances minimales par génération :

- executor + version ;
- modèle LLM/TTS/video utilisé ;
- sources média ;
- URL/provider/licence/provenance quand disponible ;
- product IDs ;
- script final ;
- coût fournisseur estimé/réel ;
- décisions de modération ;
- hash du render.

Ne jamais considérer « trouvé par Pexels/Pixabay/Coverr » comme une dispense d’audit des conditions. Le produit doit pouvoir expliquer d’où vient chaque asset.

## 8. Billing et contrôle des coûts

### Phase initiale

Créer un `VideoGenerationQuote` avant de lancer MPT :

- durée ;
- nombre de variantes ;
- mode stock vs vidéo générative ;
- TTS choisi ;
- coût interne estimé ;
- crédits ORKY demandés.

Puis :

```text
quote -> reserve -> enqueue -> provider -> validate output -> commit
                                  \-> erreur avant sortie -> refund
```

Ne jamais débiter après coup sans réservation : deux rendus concurrents pourraient dépasser le budget utilisateur.

## 9. UX prioritaire

Dans Studio, ajouter « Créer avec IA » avec 4 entrées seulement :

1. Sujet / objectif ;
2. durée ;
3. style ;
4. produit Orchidy facultatif.

Options avancées repliées : voix, musique, nombre de variantes, médias personnels, source de médias.

Après génération :

- preview ;
- remplacer un plan ;
- modifier script/caption ;
- ouvrir dans la timeline ;
- régénérer une variante ;
- publier.

Éviter une page de paramètres MPT reproduisant son WebUI.

## 10. Plan d’exécution

### Lot 0 — benchmark/feasibility

- figer un SHA MPT de test ;
- lancer Docker local avec API key + Redis ;
- produire 20 vidéos tests : 10 sujets, 5 produits, 5 scripts imposés ;
- mesurer durée, taux d’échec, RAM/CPU/GPU, taille sortie, coût LLM/TTS/provider ;
- vérifier français, sous-titres, clips, provenance ;
- décider le preset `mpt_fast_v1`.

**Gate :** aucune intégration produit si le taux de réussite contrôlée est < 90 % sur le corpus ou si les coûts ne permettent pas la marge cible.

### Lot 1 — gateway + provider MPT

- contrats internes ;
- client HTTP MPT ;
- auth service-to-service ;
- mapping request/response ;
- polling des tâches ;
- timeout/cancel ;
- tests contractuels avec faux serveur MPT.

### Lot 2 — job authority ORKY

- table/job ORKY propre ;
- idempotency key ;
- quote/réservation ;
- mapping job ORKY ↔ task MPT côté serveur uniquement ;
- retries bornés ;
- métriques et logs structurés.

### Lot 3 — ingestion media

- récupérer le résultat ;
- validation ffprobe ;
- normalisation ;
- stockage ORKY ;
- provenance ;
- draft ;
- nettoyage des fichiers MPT.

### Lot 4 — Studio

- écran « Créer avec IA » ;
- progression réelle ;
- previews ;
- variante ;
- handoff vers timeline ;
- erreurs actionnables.

### Lot 5 — shoppable

- entrée depuis produit Orchidy ;
- facts snapshot serveur ;
- anti-hallucination ;
- `VideoProductMatch` après publication ;
- E2E checkout inchangé.

### Lot 6 — billing et lancement limité

- quota/credits ;
- top-up si retenu ;
- cohort flag ;
- analytics produit ;
- 10–30 créateurs pilotes ;
- aucun changement du plan BUSINESS avant sa readiness existante.

## 11. Tests et gates

Unitaires : mapping MPT, quotes, idempotence, product facts, provenance, états jobs.

Intégration : faux MPT puis vrai MPT local ; queue pleine ; timeout ; résultat invalide ; API key invalide ; média manquant ; retry.

E2E : sujet → draft → timeline → publish ; produit → draft → publish → produit visible ; insuffisance crédits ; abandon ; échec provider avec refund.

Sécurité : SSRF, path traversal, URL output non approuvée, task ID enumeration, secret leakage, taille output, MIME spoofing.

Gates existants ORKY à conserver : typecheck, Jest, build, Playwright, backend typecheck/tests/build, parcours média/commerce.

## 12. KPI de décision après pilote

Mesurer :

- % de générations aboutissant à une publication ;
- temps médian idée → draft ;
- coût réel/render ;
- régénérations/render accepté ;
- rétention créateurs générateurs vs non-générateurs ;
- conversion Free → PRO attribuable au Studio IA ;
- CTR/ajout panier des vidéos shoppables générées ;
- taux de suppression/rejet.

**Kill criterion :** si la génération augmente la consommation mais n’augmente ni publication, ni rétention, ni conversion, elle n’est pas une feature premium : réduire ou retirer.

## 13. Ordre de priorité

1. faceless short depuis sujet ;
2. short depuis produit Orchidy ;
3. variantes batch ;
4. presets de marque ;
5. génération vidéo coûteuse (Seedance/WaveSpeed) seulement après preuves ;
6. cross-post MPT : non prioritaire, ORKY garde son propre rail de publication.
