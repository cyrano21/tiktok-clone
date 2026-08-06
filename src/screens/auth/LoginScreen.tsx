import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';
import { authService } from '@/services/authService';
import { useBranding } from '@/store/brandingStore';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (): Promise<boolean> => {
    if (!email.trim() || !password) return false;
    setIsLoading(true);
    setError(null);
    try {
      await authService.login(email.trim(), password);
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Identifiants incorrects');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Log in</Text>
          <Text style={[styles.brandName, { color: branding.primaryColor }]}>{branding.name}</Text>
          <Text style={styles.subtitle}>
            Manage your account, check notifications, comment on videos, and more.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email or username"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={tokens.colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: branding.primaryColor }, (!email || !password) && styles.loginButtonDisabled]}
            onPress={async () => { if (await handleLogin()) nav.reset('feed.foryou'); }}
            disabled={!email || !password || isLoading}
          >
            <Text style={styles.loginButtonText}>{isLoading ? 'Logging in...' : 'Log in'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => nav.replace('auth.register')}>
          <Text style={styles.footerLink}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
    justifyContent: 'center',
  },
  headerSection: {
    marginBottom: tokens.spacing.xl,
  },
  title: {
    color: tokens.colors.white,
    fontSize: tokens.typography.display.fontSize,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  form: {
    gap: tokens.spacing.md,
  },
  inputContainer: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  input: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    height: 48,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  loginButton: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  brandName: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.semantic.error,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  loginButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: tokens.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: tokens.colors.surface,
  },
  dividerText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    marginHorizontal: tokens.spacing.md,
  },
  socialButtons: {
    gap: tokens.spacing.sm,
  },
  socialButton: {
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  socialButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: tokens.colors.surface,
  },
  footerText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  footerLink: {
    color: tokens.colors.brand.primary,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
});
