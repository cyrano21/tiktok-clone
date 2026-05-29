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
import { useTikTokConnect } from '@/hooks/useTikTokConnect';

interface Params {
  productId?: string;
  sellerId?: string;
}

/** A blob:/data: URL can't be pulled by TikTok's servers (PULL_FROM_URL needs a public URL). */
function isPubliclyReachable(url: string | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url) && !url.startsWith('blob:');
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
  const [tiktokStatus, setTiktokStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = () => {
    if (!edited) return;
    addPost({
      type: edited.type,
      sourceUrl: edited.sourceUrl,
      thumbnailUrl: edited.thumbnailUrl,
      caption,
      overlayText: edited.overlayText,
      filters: edited.filters,
      trimStart: edited.trimStart,
      trimEnd: edited.trimEnd,
      productId: productId,
      sellerId: productId ? (sellerId ?? sessionSellerId) : undefined,
    });
    setPublished(true);
  };

  const handlePublishTikTok = async () => {
    const fullCaption = buildCaption({
      caption,
      hashtags: ['fyp', 'pourtoi', ...(product ? ['tiktokshop', 'tiktokmademebuyit'] : [])],
    });
    const copied = await copyToClipboard(fullCaption);
    if (edited?.sourceUrl) {
      downloadMedia(edited.sourceUrl, `tiktok-${Date.now()}.${edited.type === 'video' ? 'webm' : 'jpg'}`);
    }
    openTikTokUpload();
    setTiktokStatus(
      copied
        ? '✓ Légende copiée + média téléchargé. Colle la légende et choisis le fichier sur TikTok.'
        : 'TikTok ouvert. Copie ta légende manuellement et sélectionne le média téléchargé.'
    );
  };

  // Official Content Posting API publish (requires a public video URL).
  const handleOfficialPublish = async (draftOnly: boolean) => {
    if (!edited) return;
    const fullCaption = buildCaption({
      caption,
      hashtags: ['fyp', 'pourtoi', ...(product ? ['tiktokshop'] : [])],
    });
    setPublishing(true);
    try {
      const res = await tiktok.publish({
        videoUrl: edited.sourceUrl,
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
    const canOfficialPublish = isPubliclyReachable(edited?.sourceUrl);
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.successCircle}><Text style={styles.successCheck}>✓</Text></View>
        <Text style={styles.successTitle}>Vidéo publiée !</Text>
        <Text style={styles.successSub}>
          {productId ? 'Elle est liée à ton produit et visible dans ta boutique.' : 'Retrouve-la sur ton profil.'}
        </Text>

        {/* --- Official TikTok integration --- */}
        <View style={styles.tiktokCard}>
          <Text style={styles.tiktokCardTitle}>Publier sur le vrai TikTok</Text>

          {!tiktok.configured ? (
            <>
              <Text style={styles.tiktokInfo}>
                Publication automatique non configurée sur ce serveur. Utilise la publication
                manuelle ci-dessous (légende copiée + média téléchargé + page upload TikTok ouverte).
              </Text>
              <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                <Text style={styles.tiktokBtnText}>🎵 Publication manuelle</Text>
              </TouchableOpacity>
            </>
          ) : !tiktok.connected ? (
            <>
              <Text style={styles.tiktokInfo}>
                Connecte ton compte TikTok pour publier directement via l'API officielle.
              </Text>
              <TouchableOpacity style={styles.tiktokConnectBtn} onPress={tiktok.connect}>
                <Text style={styles.tiktokBtnText}>Connecter mon compte TikTok</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                <Text style={styles.tiktokBtnText}>🎵 Ou publication manuelle</Text>
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
                        onPress={() => handleOfficialPublish(false)}
                      >
                        <Text style={styles.tiktokBtnText}>{publishing ? 'Envoi…' : 'Publier sur mon profil'}</Text>
                      </TouchableOpacity>
                    )}
                    {tiktok.capabilities.canUploadDraft && (
                      <TouchableOpacity
                        style={[styles.tiktokBtn, publishing && styles.btnDisabled]}
                        disabled={publishing}
                        onPress={() => handleOfficialPublish(true)}
                      >
                        <Text style={styles.tiktokBtnText}>Envoyer dans mes brouillons</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={styles.tiktokInfo}>
                    La publication directe nécessite une vidéo hébergée sur une URL publique
                    (https). Ce média est local, utilise la publication manuelle.
                  </Text>
                )
              ) : (
                <Text style={styles.tiktokInfo}>
                  Cette app TikTok est approuvée pour le profil et la liste de vidéos (Login Kit),
                  pas encore pour la publication automatique. Ajoute le produit « Content Posting API »
                  (scopes video.publish / video.upload) puis reconnecte-toi. En attendant, utilise la
                  publication manuelle.
                </Text>
              )}

              {/* Manual flow always available as a fallback. */}
              {(!tiktok.capabilities.canPublish && !tiktok.capabilities.canUploadDraft) || !canOfficialPublish ? (
                <TouchableOpacity style={styles.tiktokBtn} onPress={handlePublishTikTok}>
                  <Text style={styles.tiktokBtnText}>🎵 Publication manuelle</Text>
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

        {/* Real editor (web) */}
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
            />
            <TouchableOpacity style={styles.publishBtn} onPress={handlePublish}>
              <Text style={styles.publishBtnText}>{product ? 'Publier la vidéo produit' : 'Publier'}</Text>
            </TouchableOpacity>
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
  tiktokCardTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '800',
    marginBottom: tokens.spacing.xs,
  },
  tiktokInfo: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: 17,
  },
  tiktokConnectBtn: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  tiktokConnected: {
    color: tokens.colors.semantic.success,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
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
