# ORKY Studio Timeline

## Objectif

Faire évoluer le Studio ORKY d'un éditeur mono-média (trim + filtres + texte) vers un montage vertical multi-clips sans remplacer le pipeline média autoritaire du backend.

Le navigateur prépare un **manifeste de composition** et conserve les sources locales. Le serveur reste responsable du rendu final, de la normalisation, de la miniature, du stockage et de la création de l'entité `Video`.

## Pourquoi le package OmniClip n'est pas importé directement

OmniClip a servi de référence pour la timeline et l'approche composants. Son package public actuel expose cependant un graphe d'import qui remonte vers son `main`, lequel initialise PostHog et manipule `window`/`document` au chargement. L'injecter tel quel dans le bundle Next.js ORKY couplerait l'application à des effets de bord globaux et à son propre runtime FFmpeg/WASM.

ORKY possède déjà un pipeline FFmpeg natif, une authentification, un stockage MinIO/S3 privé et un modèle canonique de publication. Le choix retenu est donc : **reprendre les primitives utiles de l'expérience timeline sans embarquer le runtime complet d'OmniClip**.

Aucune source OmniClip n'est copiée dans ORKY.

## Parcours web

```text
Studio création
  -> AdvancedMediaEditor.web
      -> Timeline avancée
          -> 1..8 sources
          -> 1..20 clips
          -> ordre / split
          -> trim par clip
          -> durée image
          -> filtres
          -> texte par clip
          -> coupe franche / fondu
      -> ou Mode rapide / caméra (éditeur historique)
  -> Continuer
  -> légende
  -> POST /v1/videos/compose
  -> rendu FFmpeg serveur
  -> MP4 H.264/AAC vertical 1080x1920
  -> miniature
  -> MinIO/S3
  -> transaction Prisma Video
  -> VideoProductMatch si produit Orchidy
```

## Contrat de composition

Le frontend envoie d'abord les champs texte multipart, puis les fichiers sources. Les fichiers sont nommés `source_0`, `source_1`, etc. Un fichier peut être référencé par plusieurs clips, ce qui permet de scinder une vidéo sans la téléverser deux fois.

```json
{
  "version": 1,
  "clips": [
    {
      "id": "clip-1",
      "sourceField": "source_0",
      "kind": "video",
      "trimStart": 1.2,
      "trimEnd": 4.8,
      "imageDuration": 0,
      "overlayText": "Découvre le produit",
      "filters": {
        "brightness": 100,
        "contrast": 100,
        "saturate": 115,
        "sepia": 0,
        "grayscale": 0
      },
      "transition": "fade"
    }
  ]
}
```

## Garde-fous serveur

- authentification obligatoire ;
- publication `public` uniquement tant que les médias privés signés ne sont pas activés ;
- 8 sources maximum ;
- 20 clips maximum ;
- 100 Mo maximum par source ;
- 400 Mo maximum cumulés ;
- 10 minutes maximum pour le montage final ;
- MIME vidéo/image allowlist ;
- `ffprobe` vérifie les sources et le rendu ;
- les vidéos sans audio et les images reçoivent une piste silencieuse pour garantir un format concaténable homogène ;
- rendu H.264/AAC 1080x1920, 30 fps ;
- suppression des objets S3 si la transaction Prisma échoue ;
- les fichiers multipart temporaires sont utilisés uniquement pendant la requête.

## Compatibilité

Le mode historique reste disponible dans `Mode rapide / caméra`. Le fallback natif ne prétend pas offrir la timeline tant que le rendu multi-source n'est pas branché dans le client mobile.

## Suite logique

Une version suivante pourra ajouter une vraie piste musique/audio, sous-titres segmentés et commandes d'agent IA traduites en opérations de timeline. Ces fonctions doivent s'appuyer sur le manifeste de composition plutôt que manipuler directement le MP4 final.
