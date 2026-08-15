import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import { AdvancedMediaEditor } from '@/components/media/AdvancedMediaEditor';
import type { AdvancedEditorResult } from '@/components/media/AdvancedMediaEditor.types';
import { buildCaption, copyToClipboard, openTikTokUpload, downloadMedia } from '@/services/tiktokPublish';
import { studioService } from '@/services/studioService';
import { useTikTokConnect } from '@/hooks/useTikTokConnect';
import { CommerceProduct, getCommerceProductById } from '@/services/orchidyProducts';
import { productMatchService } from '@/services/productMatchService';

interface Params {
  productId?: string;
  orchidyCatalogItemId?: string;
  variantKey?: string;
}

function isPubliclyReachable(url: string | undefined): boolean {
  return !!url && /^https:\/\//i.test(url) && !url.startsWith('blob:');
}

function absolutePublicMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return new URL(url, window.location.origin).toString();
  }
  return url;
}

function filenameFor(blob: Blob, type: 'video' | 'image') {
  if (blob.type === 'video/mp4') return `upload-${Date.now()}.mp4`;
  if (blob.type === 'video/webm') return `upload-${Date.now()}.webm`;
  if (blob.type === 'video/quicktime') return `upload-${Date.now()}.mov`;
  if (blob.type === 'image/png') return `upload-${Date.now()}.png`;
  if (blob.type === 'image/webp') return `upload-${Date.now()}.webp`;
  if (blob.type === 'image/jpeg') return `upload-${Date.now()}.jpg`;
  return `upload-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;
}

export const MediaEditorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useRouteParams<Params>();
  const { productId, orchidyCatalogItemId, variantKey } = params;
  const addPost = useStudioStore((s) => s.addPost);
  const tiktok = useTikTokConnect();

  const [product, setProduct] = useState<CommerceProduct | null>(null);
  const [productLoading, setProductLoading] = useState(Boolean(productId));
  const [productError, setProductError] = useState<string | null>(null);
  const [edited, setEdited] = useState<AdvancedEditorResult | null>(null);
  const [caption, setCaption] = useState('');
  const [published, setPublished] = useState(false);
  const [publishedSourceUrl, setPublishedSourceUrl] = useState<string | null>(null);
  const [publishedThumbnailUrl, setPublishedThumbnailUrl] = useState<string | null>(null);
  const [productLinked, setProductLinked] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishingInApp, setPublishingInApp] = useState(false);
  const [tiktokStatus, setTiktokStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;
    if (!productId) {
      setProduct(null);
      setProductLoading(false);
      return () => { active = false; };
    }
    setProductLoading(true);
    setProductError(null);
    void getCommerceProductById(productId)
      .then((resolved) => {
        if (!active) return;
        if (!resolved || resolved.source !== 'orchidy') {
          setProduct(null);
          setProductError('Le produit Orchidy lié à cette vidéo est introuvable ou indisponible.');
          return;
        }
        setProduct(resolved);
        setCaption((current) => current || `Découvre ${resolved.title} 🛍️`);
      })
      .catch(() => {
        if (active) setProductError('Impossible de charger le produit Orchidy.');
      })
      .finally(() => { if (active) setProductLoading(false); });
    return () => { active = false; };
  }, [productId]);

  const canonicalCatalogId = useMemo(() => {
    if (!product) return '';
    return String(orchidyCatalogItemId || product.externalId || product.externalSlug || '').trim();
  }, [orchidyCatalogItemId, product]);

  const handlePublish = async () => {
    if (!edited || publishingInApp) return;
    if (productId && (!product || !canonicalCatalogId)) {
      setPublishError('Le média ne sera pas publié comme vidéo produit sans identifiant catalogue Orchidy valide.');
      return;
    }
    setPublishingInApp(true);
    setPublishError(null);

    try {
      const video = edited.mode === 'timeline'
        ? await studioService.publishComposition(edited.assets, edited.composition, {
            description: caption,
            visibility: 'public',
            allowComment: true,
            allowDuet: true,
            allowStitch: true,
          })
        : await (async () => {
            const sourceResponse = await fetch(edited.sourceUrl);
            if (!sourceResponse.ok) throw new Error(`Impossible de lire le média (${sourceResponse.status})`);
            const blob = await sourceResponse.blob();
            if (!blob.size) throw new Error('Le média exporté est vide.');
            return studioService.publishMedia(blob, {
              filename: filenameFor(blob, edited.type),
              description: caption,
              visibility: 'public',
              allowComment: true,
              allowDuet: true,
              allowStitch: true,
              trimStart: edited.trimStart,
              trimEnd: edited.trimEnd,
              overlayText: edited.overlayText,
              filters: edited.filters,
            });
          })();

      let linked = false;
      if (product && canonicalCatalogId) {
        try {
          await productMatchService.attach({
            videoId: video.id,
            orchidyCatalogItemId: canonicalCatalogId,
            variantKey: variantKey || undefined,
            source: 'manual',
            confidence: 1,
          });
          linked = true;
        } catch (linkError: any) {
          // The video is already real/persisted. Do not lie about commerce linkage.
          setPublishError(
            linkError?.response?.data?.message ||
            linkError?.message ||
            'La vidéo est publiée, mais la liaison au produit Orchidy a échoué.',
          );
        }
      }

      addPost({
        type: 'video',
        sourceUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl ?? edited.thumbnailUrl,
        caption,
        overlayText: edited.overlayText,
        filters: edited.filters,
        trimStart: 0,
        trimEnd: video.duration,
        productId: linked ? product?.id : undefined,
        sellerId: undefined,
      });

      setProductLinked(linked);
      setPublishedSourceUrl(video.videoUrl);
      setPublishedThumbnailUrl(video.thumbnailUrl ?? null);
      setPublished(true);
    } catch (error: any) {
      setPublishError(
        error?.response?.data?.message ||
        error?.message ||
        'La publication a échoué. Le média n’a pas été marqué comme publié.',
      );
    } finally {
      setPublishingInApp(false);
    }
  };

  const handlePublishTikTok = async () => {
    const fullCaption = buildCaption({
      caption,
      hashtags: ['fyp', 'pourtoi', ...(productLinked ? ['shopping'] : [])],
    });
    const copied = await copyToClipboard(fullCaption);
    const downloadableUrl = publishedSourceUrl ?? edited?.sourceUrl;
    if (downloadableUrl) downloadMedia(downloadableUrl, `tiktok-${Date.now()}.${publishedSourceUrl ? 'mp4' : edited?.type === 'video' ? 'webm' : 'jpg'}`);
    openTikTokUpload();
    setTiktokStatus(copied ? '✓ Légende copiée + média téléchargé. Colle la légende et choisis le fichier sur TikTok.' : 'TikTok ouvert. Copie ta légende manuellement et sélectionne le média téléchargé.');
  };

  const handleOfficialPublish = async (draftOnly: boolean) => {
    const sourceUrl = absolutePublicMediaUrl(publishedSourceUrl ?? edited?.sourceUrl);
    if (!sourceUrl) return;
    const fullCaption = buildCaption({ caption, hashtags: ['fyp', 'pourtoi', ...(productLinked ? ['shopping'] : [])] });
    setPublishing(true);
    try {
      const res = await tiktok.publish({ videoUrl: sourceUrl, title: fullCaption.slice(0, 2200), privacyLevel: 'SELF_ONLY', draftOnly });
      setTiktokStatus(res.ok ? (draftOnly ? '✓ Envoyé dans tes brouillons TikTok. Ouvre l’app TikTok pour finaliser.' : '✓ Publié via l’API officielle TikTok (visibilité privée par défaut).') : `❌ ${res.message}`);
    } catch (error: any) {
      setTiktokStatus(`❌ ${error?.response?.data?.message || error?.message || 'Publication TikTok refusée'}`);
    } finally {
      setPublishing(false);
    }
  };

  if (productLoading) {
    return <View style={[styles.container, styles.center, { paddingTop: insets.top }]}><Text style={styles.successSub}>Chargement du produit Orchidy…</Text></View>;
  }

  if (productId && productError) {
    return <View style={[styles.container, styles.center, { paddingTop: insets.top }]}><Text style={styles.successTitle}>Produit indisponible</Text><Text style={styles.successSub}>{productError}</Text><TouchableOpacity style={styles.primaryBtn} onPress={() => nav.reset('shop')}><Text style={styles.primaryBtnText}>Retour au Shop</Text></TouchableOpacity></View>;
  }

  if (published) {
    const durableUrl = absolutePublicMediaUrl(publishedSourceUrl ?? undefined);
    const canOfficialPublish = isPubliclyReachable(durableUrl);
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.successCircle}><Text style={styles.successCheck}>✓</Text></View>
        <Text style={styles.successTitle}>Vidéo publiée</Text>
        <Text style={styles.successSub}>{product ? (productLinked ? 'La vidéo est persistée et reliée au produit Orchidy réel. Prix et stock seront revalidés au checkout.' : 'La vidéo est persistée, mais elle n’est pas présentée comme shoppable car la liaison Orchidy n’a pas été confirmée.') : 'Le média a été traité par FFmpeg, stocké durablement et ajouté à ton profil.'}</Text>
        {publishedThumbnailUrl ? <Text style={styles.persistedHint}>Miniature serveur générée ✓</Text> : null}
        {publishError ? <Text style={styles.publishError}>{publishError}</Text> : null}

        <View style={styles.tiktokCard}>
          <Text style={styles.tiktokCardTitle}>Publication TikTok</Text>
          {!tiktok.configured ? <><Text style={styles.tiktokInfo}>L’intégration TikTok officielle n’est pas configurée sur ce serveur.</Text><TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}><Text style={styles.tiktokBtnText}>Publication manuelle</Text></TouchableOpacity></>
            : !tiktok.connected ? <><Text style={styles.tiktokInfo}>Connecte ton compte TikTok pour vérifier les scopes officiellement accordés.</Text><TouchableOpacity style={styles.tiktokConnectBtn} onPress={tiktok.connect}><Text style={styles.tiktokBtnText}>Connecter TikTok</Text></TouchableOpacity><TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}><Text style={styles.tiktokBtnText}>Ou publication manuelle</Text></TouchableOpacity></>
            : <>
                <Text style={styles.tiktokConnected}>Connecté{tiktok.displayName ? ` : ${tiktok.displayName}` : ''}</Text>
                {(tiktok.capabilities.canPublish || tiktok.capabilities.canUploadDraft) && canOfficialPublish ? <>
                  {tiktok.capabilities.canPublish ? <TouchableOpacity style={[styles.tiktokConnectBtn, publishing && styles.btnDisabled]} disabled={publishing} onPress={() => void handleOfficialPublish(false)}><Text style={styles.tiktokBtnText}>{publishing ? 'Envoi…' : 'Publier via TikTok API'}</Text></TouchableOpacity> : null}
                  {tiktok.capabilities.canUploadDraft ? <TouchableOpacity style={[styles.tiktokBtn, publishing && styles.btnDisabled]} disabled={publishing} onPress={() => void handleOfficialPublish(true)}><Text style={styles.tiktokBtnText}>Envoyer dans mes brouillons</Text></TouchableOpacity> : null}
                </> : <Text style={styles.tiktokInfo}>{!canOfficialPublish ? 'TikTok PULL_FROM_URL exige un domaine ORKY HTTPS public.' : 'Les scopes Content Posting ne sont pas accordés à ce compte/app. Aucune publication automatique n’est simulée.'}</Text>}
                {(!tiktok.capabilities.canPublish && !tiktok.capabilities.canUploadDraft) || !canOfficialPublish ? <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}><Text style={styles.tiktokBtnText}>Publication manuelle</Text></TouchableOpacity> : null}
                <TouchableOpacity onPress={tiktok.disconnect}><Text style={styles.tiktokDisconnect}>Déconnecter</Text></TouchableOpacity>
              </>}
          {(tiktokStatus || tiktok.message) ? <Text style={styles.tiktokStatus}>{tiktokStatus ?? tiktok.message}</Text> : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.reset('profile')}><Text style={styles.primaryBtnText}>Voir mon profil</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.reset('feed.foryou')}><Text style={styles.secondaryBtnText}>Aller au fil</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}><TouchableOpacity onPress={() => nav.back()}><Text style={styles.backIcon}>←</Text></TouchableOpacity><Text style={styles.headerTitle}>{product ? 'Vidéo produit Orchidy' : 'Studio création'}</Text><View style={styles.placeholder} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {product ? <View style={styles.productBanner}><Text style={styles.productBannerText} numberOfLines={1}>🛍️ {product.title}</Text><Text style={styles.productBannerSub}>Cette vidéo sera reliée au catalogue Orchidy après publication réussie.</Text></View> : null}
        <AdvancedMediaEditor productMode={Boolean(product)} onExport={setEdited} />
        {edited ? <View style={styles.publishBlock}><Text style={styles.sectionLabel}>Légende</Text><TextInput style={styles.captionInput} placeholder="Écris une légende…" placeholderTextColor={tokens.colors.text.tertiary} value={caption} onChangeText={setCaption} multiline maxLength={5000} />{publishError ? <Text style={styles.publishError}>{publishError}</Text> : null}<TouchableOpacity style={[styles.publishBtn, publishingInApp && styles.btnDisabled]} onPress={() => void handlePublish()} disabled={publishingInApp}><Text style={styles.publishBtnText}>{publishingInApp ? 'Rendu et envoi…' : product ? 'Publier et relier au produit' : 'Publier'}</Text></TouchableOpacity><Text style={styles.processingHint}>{edited.mode === 'timeline' ? `Le serveur assemblera ${edited.composition.clips.length} clip${edited.composition.clips.length > 1 ? 's' : ''} avec FFmpeg, normalisera le MP4 vertical, générera la miniature puis persistera la vidéo.` : 'Le serveur normalise le média, génère la miniature et persiste la vidéo avant de confirmer la publication.'}</Text></View> : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg }, center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xl, gap: tokens.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderBottomWidth: .5, borderBottomColor: tokens.colors.surface }, backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 }, headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' }, placeholder: { width: 28 }, content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.md },
  productBanner: { backgroundColor: tokens.colors.brand.primary + '1A', borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: 3 }, productBannerText: { color: tokens.colors.brand.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '800' }, productBannerSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize }, publishBlock: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }, sectionLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, captionInput: { backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.sm, color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, padding: tokens.spacing.md, minHeight: 60, textAlignVertical: 'top' }, publishError: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 }, processingHint: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 }, persistedHint: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize }, publishBtn: { height: 50, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand.primary, justifyContent: 'center', alignItems: 'center' }, publishBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: tokens.colors.semantic.success, justifyContent: 'center', alignItems: 'center' }, successCheck: { color: tokens.colors.white, fontSize: 38, fontWeight: '800' }, successTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800', marginTop: tokens.spacing.md, textAlign: 'center' }, successSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center', lineHeight: 20 },
  tiktokCard: { marginTop: tokens.spacing.lg, width: '100%', backgroundColor: tokens.colors.elevated, borderRadius: tokens.radius.md, padding: tokens.spacing.md, gap: tokens.spacing.xs }, tiktokCardTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', marginBottom: tokens.spacing.xs }, tiktokInfo: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 }, tiktokBtn: { marginTop: tokens.spacing.sm, backgroundColor: '#000', borderWidth: 1, borderColor: tokens.colors.brand.secondary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md, alignItems: 'center' }, tiktokBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' }, tiktokConnectBtn: { marginTop: tokens.spacing.sm, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md, alignItems: 'center' }, tiktokConnected: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, tiktokDisconnect: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, textDecorationLine: 'underline', marginTop: tokens.spacing.sm, textAlign: 'center' }, btnDisabled: { opacity: .5 }, tiktokStatus: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize, textAlign: 'center', marginTop: tokens.spacing.sm, lineHeight: 17 }, primaryBtn: { marginTop: tokens.spacing.lg, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md }, primaryBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' }, secondaryBtn: { marginTop: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.sm }, secondaryBtnText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
});