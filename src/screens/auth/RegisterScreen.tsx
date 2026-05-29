import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { useNavigation } from '@/navigation/NavigationContext';

const INTERESTS = [
  'Comedy', 'Dance', 'Music', 'Food', 'Sports', 'Fashion',
  'Beauty', 'Gaming', 'Travel', 'Pets', 'DIY', 'Education',
  'Tech', 'Art', 'Fitness', 'Nature',
];

export const RegisterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [step, setStep] = useState<'info' | 'interests'>('info');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleNext = () => {
    if (step === 'info') {
      setStep('interests');
    } else {
      nav.reset('feed.foryou');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 'interests' ? setStep('info') : nav.replace('auth.login'))}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sign up</Text>
        <View style={styles.placeholder} />
      </View>

      {step === 'info' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Create account</Text>
          <Text style={styles.stepSubtitle}>Enter your details to get started</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 8 characters"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Choose your interests</Text>
          <Text style={styles.stepSubtitle}>
            Select at least 3 topics to personalize your feed
          </Text>

          <View style={styles.interestsGrid}>
            {INTERESTS.map((interest) => (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.interestChip,
                  selectedInterests.includes(interest) && styles.interestChipSelected,
                ]}
                onPress={() => toggleInterest(interest)}
              >
                <Text
                  style={[
                    styles.interestChipText,
                    selectedInterests.includes(interest) && styles.interestChipTextSelected,
                  ]}
                >
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            step === 'interests' && selectedInterests.length < 3 && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={step === 'interests' && selectedInterests.length < 3}
        >
          <Text style={styles.nextButtonText}>
            {step === 'info' ? 'Next' : 'Get Started'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  backButton: {
    color: tokens.colors.white,
    fontSize: 24,
    width: 30,
  },
  headerTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
  },
  placeholder: { width: 30 },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
  },
  stepTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: '700',
    marginTop: tokens.spacing.lg,
  },
  stepSubtitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xl,
  },
  form: {
    gap: tokens.spacing.md,
  },
  inputContainer: {
    gap: tokens.spacing.xs,
  },
  inputLabel: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '500',
  },
  input: {
    backgroundColor: tokens.colors.elevated,
    borderRadius: tokens.radius.sm,
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    paddingHorizontal: tokens.spacing.md,
    height: 48,
  },
  terms: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: 18,
    marginTop: tokens.spacing.lg,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  interestChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  interestChipSelected: {
    backgroundColor: tokens.colors.brand.primary,
    borderColor: tokens.colors.brand.primary,
  },
  interestChipText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
  },
  interestChipTextSelected: {
    color: tokens.colors.white,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  nextButton: {
    backgroundColor: tokens.colors.brand.primary,
    borderRadius: tokens.radius.sm,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '700',
  },
});
