import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { useStudioStore } from '@/store/studioStore';
import { useSessionStore } from '@/store/sessionStore';
import { getProductById } from '@/services/demoShop';
import { WebMediaEditor, EditorResult } from '@/components/media/WebMediaEditor';
import { buildCaption, copyToClipboard, openTikTokUpload, downloadMedia } from '@/services/tiktokPublish';
import { studioService } from '@/services/studioService';
import { useTikTokConnect } from '@/hooks/useTikTokConnect';

interface Params {
  productId?: string;
  sellerId?: string;
}

/** TikTok PULL_FROM_URL requires a publicly reachable HTTPS URL. */
function isPubliclyReachable(url: string | undefined): boolean {
  return !!url && /^https:\/\//i.test(url) && !url.startsWith('blob:');
}

function filenameFor(blob: Blob, type: EditorResult['type']) {
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
  const { productId, sellerId } = useRouteParams<Params>();
  const product = productId ? getProductById(productId) : undefined;

  const addPost = useStudioStore((s) => s.addPost);
  const sessionSellerId = useSessionStore((s) => s.sellerId);
  const tiktok = useTikTokConnect();

  const [edited, setEdited] = useState<EditorResult | null>(null);
  const [caption, setCaption] = useState(product ? `Découvre ${product.title} 🛍️` : '');
  const [published, setPublished] = useState(false);
  const [publishedSourceUrl, setPublishedSourceUrl] = useState<string | null>(null);
  const [publishedThumbnailUrl, setPublishedThumbnailUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishingInApp, setPublishingInApp] = useState(false);
  const [tiktokStatus, setTiktokStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!edited || publishingInApp) return;
    setPublishingInApp(true);
    setPublishError(null);

    try {
      // blob:/data: sources are browser-local. Fetching the object URL gives us
      // the actual bytes so the backend can persist and process them.
      const sourceResponse = await fetch(edited.sourceUrl);
      if (!sourceResponse.ok) throw new Error(`Impossible de lire le média (${sourceResponse.status})`);
      const blob = await sourceResponse.blob();
      if (!blob.size) throw new Error('Le média exporté est vide.');

      const video = await studioService.publishMedia(blob, {
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

      // Keep the Studio store synchronized with the durable backend resource.
      addPost({
        type: 'video',
        sourceUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl ?? edited.thumbnailUrl,
        caption,
        overlayText: edited.overlayText,
        filters: edited.filters,
        trimStart: 0,
        trimEnd: video.duration,
        productId,
        sellerId: productId ? (sellerId ?? sessionSellerId) : undefined,
      });

      setPublishedSourceUrl(video.videoUrl);
      setPublishedThumbnailUrl(video.thumbnailUrl ?? null);
      setPublished(true);
    } catch (error: any) {
      setPublishError(
        error?.response?.data?.message ||
        error?.message ||
        'La publication a échoué. Le média n’a pas été marqué comme publié.'
      );
    } finally {
      setPublishingInApp(false);
    }
  };

  const handlePublishTikTok = async () => {
    const fullCaption = buildCaption({
      caption,
      hashtags: ['fyp', 'pourtoi', ...(product ? ['tiktokshop', 'tiktokmademebuyit'] : [])],
    });
    const copied = await copyToClipboard(fullCaption);
    const downloadableUrl = publishedSourceUrl ?? edited?.sourceUrl;
    if (downloadableUrl) {
      downloadMedia(downloadableUrl, `tiktok-${Date.now()}.${publishedSourceUrl ? 'mp4' : edited?.type === 'video' ? 'webm' : 'jpg'}`);
    }
    openTikTokUpload();
    setTiktokStatus(
      copied
        ? '✓ Légende copiée + média téléchargé. Colle la légende et choisis le fichier sur TikTok.'
        : 'TikTok ouvert. Copie ta légende manuellement et sélectionne le média téléchargé.'
    );
  };

  const handleOfficialPublish = async (draftOnly: boolean) => {
    const sourceUrl = publishedSourceUrl ?? edited?.sourceUrl;
    if (!sourceUrl) return;
    const fullCaption = buildCaption({
      caption,
      hashtags: ['fyp', 'pourtoi', ...(product ? ['tiktokshop'] : [])],
    });
    setPublishing(true);
    try {
      const res = await tiktok.publish({
        videoUrl: sourceUrl,
        title: fullCaption.slice(0, 2200),
        privacyLevel: 'SELF_ONLY',
        draftOnly,
      });
      if (res.ok) {
        setTiktokStatus(
          draftOnly
            ? '✓ Envoyé dans tes brouillons TikTok. Ouvre l\'app TikTok pour finaliser.'
            : '✓ Publié sur ton profil TikTok (visibilité privée par défaut).'
        );
      } else {
        setTiktokStatus(`❌ ${res.message}`);
      }
    } finally {
      setPublishing(false);
    }
  };

  if (published) {
    const durableUrl = publishedSourceUrl ?? undefined;
    const canOfficialPublish = isPubliclyReachable(durableUrl);
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.successCircle}><Text style={styles.successCheck}>✓</Text></View>
        <Text style={styles.successTitle}>Vidéo publiée</Text>
        <Text style={styles.successSub}>
          {productId
            ? 'Le média a été traité et enregistré. La liaison produit reste gérée par le Studio.'
            : 'Le média a été traité par FFmpeg, stocké durablement et ajouté à ton profil.'}
        </Text>
        {publishedThumbnailUrl ? <Text style={styles.persistedHint}>Miniature serveur générée ✓</Text> : null}

        <View style={styles.tiktokCard}>
          <Text style={styles.tiktokCardTitle}>Publier sur le vrai TikTok</Text>

          {!tiktok.configured ? (
            <>
              <Text style={styles.tiktokInfo}>
                Publication automatique non configurée sur ce serveur. Utilise la publication
                manuelle ci-dessous.
              </Text>
              <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                <Text style={styles.tiktokBtnText}>Publication manuelle</Text>
              </TouchableOpacity>
            </>
          ) : !tiktok.connected ? (
            <>
              <Text style={styles.tiktokInfo}>Connecte ton compte TikTok pour utiliser l’API officielle.</Text>
              <TouchableOpacity style={styles.tiktokConnectBtn} onPress={tiktok.connect}>
                <Text style={styles.tiktokBtnText}>Connecter mon compte TikTok</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                <Text style={styles.tiktokBtnText}>Ou publication manuelle</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.tiktokConnected}>
                Connecté{tiktok.displayName ? ` : ${tiktok.displayName}` : ''}
              </Text>

              {tiktok.capabilities.canPublish || tiktok.capabilities.canUploadDraft ? (
                canOfficialPublish ? (
                  <>
                    {tiktok.capabilities.canPublish && (
                      <TouchableOpacity
                        style={[styles.tiktokConnectBtn, publishing && styles.btnDisabled]}
                        disabled={publishing}
                        onPress={() => void handleOfficialPublish(false)}
                      >
                        <Text style={styles.tiktokBtnText}>{publishing ? 'Envoi…' : 'Publier sur mon profil'}</Text>
                      </TouchableOpacity>
                    )}
                    {tiktok.capabilities.canUploadDraft && (
                      <TouchableOpacity
                        style={[styles.tiktokBtn, publishing && styles.btnDisabled]}
                        disabled={publishing}
                        onPress={() => void handleOfficialPublish(true)}
                      >
                        <Text style={styles.tiktokBtnText}>Envoyer dans mes brouillons</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={styles.tiktokInfo}>
                    Le média est bien stocké, mais TikTok exige une URL HTTPS publique pour PULL_FROM_URL.
                    Configure CDN_URL avec ton domaine HTTPS pour activer la publication directe.
                  </Text>
                )
              ) : (
                <Text style={styles.tiktokInfo}>
                  Cette app TikTok n’a pas encore les scopes video.publish / video.upload. La publication
                  manuelle reste disponible sans prétendre publier automatiquement.
                </Text>
              )}

              {(!tiktok.capabilities.canPublish && !tiktok.capabilities.canUploadDraft) || !canOfficialPublish ? (
                <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                  <Text style={styles.tiktokBtnText}>Publication manuelle</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={tiktok.disconnect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.tiktokDisconnect}>Déconnecter</Text>
              </TouchableOpacity>
            </>
          )}

          {(tiktokStatus || tiktok.message) && (
            <Text style={styles.tiktokStatus}>{tiktokStatus ?? tiktok.message}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.reset(productId ? 'shop.dashboard' : 'profile')}>
          <Text style={styles.primaryBtnText}>{productId ? 'Voir ma boutique' : 'Voir mon profil'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.reset('feed.foryou')}>
          <Text style={styles.secondaryBtnText}>Aller au fil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{product ? 'Vidéo produit' : 'Studio création'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {product && (
          <View style={styles.productBanner}>
            <Text style={styles.productBannerText} numberOfLines={1}>🛍️ {product.title}</Text>
          </View>
        )}

        <WebMediaEditor productMode={!!product} onExport={setEdited} />

        {edited && (
          <View style={styles.publishBlock}>
            <Text style={styles.sectionLabel}>Légende</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Écris une légende…"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={5000}
            />
            {publishError && <Text style={styles.publishError}>{publishError}</Text>}
            <TouchableOpacity
              style={[styles.publishBtn, publishingInApp && styles.btnDisabled]}
              onPress={() => void handlePublish()}
              disabled={publishingInApp}
            >
              <Text style={styles.publishBtnText}>
                {publishingInApp ? 'Traitement et envoi…' : product ? 'Publier la vidéo produit' : 'Publier'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.processingHint}>
              La publication applique le découpage et les filtres côté serveur, génère une miniature puis stocke le MP4.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xl, gap: tokens.spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.colors.surface,
  },
  backIcon: { color: tokens.colors.white, fontSize: 24, width: 28 },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.title.fontSize, fontWeight: '700' },
  placeholder: { width: 28 },
  content: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl, gap: tokens.spacing.md },
  productBanner: {
    backgroundColor: tokens.colors.brand.primary + '1A',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  productBannerText: { color: tokens.colors.brand.primary, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  publishBlock: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  sectionLabel: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  captionInput: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    padding: tokens.spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  publishError: { color: tokens.colors.semantic.error, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  processingHint: { color: tokens.colors.text.tertiary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  persistedHint: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize },
  publishBtn: {
    height: 50,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: tokens.colors.semantic.success, justifyContent: 'center', alignItems: 'center' },
  successCheck: { color: tokens.colors.white, fontSize: 38, fontWeight: '800' },
  successTitle: { color: tokens.colors.white, fontSize: tokens.typography.headline.fontSize, fontWeight: '800', marginTop: tokens.spacing.md },
  successSub: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, textAlign: 'center' },
  tiktokBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: tokens.colors.brand.secondary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  tiktokBtnText: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800' },
  tiktokCard: {
    marginTop: tokens.spacing.lg,
    width: '100%',
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  tiktokCardTitle: { color: tokens.colors.white, fontSize: tokens.typography.subhead.fontSize, fontWeight: '800', marginBottom: tokens.spacing.xs },
  tiktokInfo: { color: tokens.colors.text.secondary, fontSize: tokens.typography.caption.fontSize, lineHeight: 17 },
  tiktokConnectBtn: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  tiktokConnected: { color: tokens.colors.semantic.success, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  tiktokDisconnect: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    textDecorationLine: 'underline',
    marginTop: tokens.spacing.sm,
    textAlign: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  tiktokStatus: { color: tokens.colors.semantic.success, fontSize: tokens.typography.caption.fontSize, textAlign: 'center', marginTop: tokens.spacing.sm, lineHeight: 17 },
  primaryBtn: { marginTop: tokens.spacing.lg, backgroundColor: tokens.colors.brand.primary, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md },
  primaryBtnText: { color: tokens.colors.white, fontSize: tokens.typography.body.fontSize, fontWeight: '700' },
  secondaryBtn: { marginTop: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.sm },
  secondaryBtnText: { color: tokens.colors.text.secondary, fontSize: tokens.typography.body.fontSize, fontWeight: '600' },
});
