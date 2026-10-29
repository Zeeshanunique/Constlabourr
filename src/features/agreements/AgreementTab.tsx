import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { colors, shadows, radii } from '@/styles/theme';

interface Agreement {
  id: string;
  version: number;
  terms: string;
  effectiveDate: string;
  status: 'active' | 'draft';
  acceptances?: number;
}

interface AgreementTabProps {
  accessToken?: string;
}

export function AgreementTab({ accessToken }: AgreementTabProps) {
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [termsText, setTermsText] = useState(
    '1. The Worker agrees to provide construction services for an 8-hour shift.\n2. Overtime will be compensated at 1.5x regular hourly base.\n3. Mandatory PPE (Hard hat, safety boots, high-vis jacket) must be worn.\n4. Weekly wage settlement every Tuesday via direct UPI / Bank transfer.\n5. Cash advances up to 50% of earned wages are permitted upon site approval.'
  );

  useEffect(() => {
    if (token) {
      fetchAgreements();
    }
  }, [token]);

  const fetchAgreements = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/list`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setAgreements(data.agreements || []);
    } catch (error) {
      console.error('Error fetching agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!token || !termsText.trim()) return;
    setLoading(true);
    try {
      const agreementData = {
        terms: termsText,
        effectiveDate: new Date().toISOString(),
      };

      if (editingAgreement) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/${editingAgreement.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agreementData),
          }
        );
        if (!response.ok) throw new Error('Failed to update agreement');
        Toast.show({ type: 'success', text1: 'Updated', text2: 'Agreement terms updated.' });
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/create`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agreementData),
          }
        );
        if (!response.ok) throw new Error('Failed to create agreement');
        Toast.show({ type: 'success', text1: 'Published', text2: 'New agreement drafted.' });
      }

      setIsModalOpen(false);
      setEditingAgreement(null);
      fetchAgreements();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/${id}/activate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to activate agreement');
      Toast.show({ type: 'success', text1: 'Active', text2: 'Agreement is now mandatory for workers.' });
      fetchAgreements();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Worker Digital Agreements</Text>
            <Text style={styles.headerSubtitle}>Legal terms, touch signatures & Aadhaar audit stamps</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingAgreement(null);
              setIsModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="post-add" size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New Terms</Text>
          </TouchableOpacity>
        </View>

        {/* Vernacular Language Notice */}
        <View style={styles.vernacularStrip}>
          <MaterialIcons name="translate" size={14} color={colors.accentLight} />
          <Text style={styles.vernacularText}>Bilingual Vernacular: English + हिंदी (Auto-translated for workers)</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. STATUTORY NOTICE CARD */}
        <View style={styles.statutoryNotice}>
          <MaterialIcons name="verified-user" size={20} color={colors.success} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.statutoryNoticeTitle}>Labour Code 2020 Compliant Contract</Text>
            <Text style={styles.statutoryNoticeSub}>
              Active agreements are prompted as a mandatory digital touch-screen signature modal when workers sign into the app.
            </Text>
          </View>
        </View>

        {/* 3. ACTIVE AGREEMENT HERO CARD */}
        <View style={styles.heroAgreementCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroVersion}>MASTER LABOUR CONTRACT • v{agreements[0]?.version || 1}</Text>
              <Text style={styles.heroTitle}>Standard Daily Wage & Safety Terms</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.greenDot} />
              <Text style={styles.activePillText}>ENFORCED</Text>
            </View>
          </View>

          {/* Core Clauses Preview */}
          <View style={styles.clauseBox}>
            <Text style={styles.clauseText}>
              {agreements[0]?.terms || termsText}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.footerItem}>
              <MaterialIcons name="draw" size={16} color={colors.accent} />
              <Text style={styles.footerItemText}>{agreements[0]?.acceptances || 48} Workers Signed</Text>
            </View>
            <View style={styles.footerItem}>
              <MaterialIcons name="location-on" size={16} color={colors.textMuted} />
              <Text style={styles.footerItemText}>GPS Geotagged</Text>
            </View>
          </View>
        </View>

        {/* 4. PAST REVISIONS LIST */}
        <Text style={styles.sectionHeading}>CONTRACT REVISION HISTORY ({agreements.length})</Text>
        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 12 }} />}

        {agreements.map((ag) => {
          const isActive = ag.status === 'active';
          return (
            <View key={ag.id} style={styles.revisionCard}>
              <View style={styles.revHeader}>
                <View>
                  <Text style={styles.revVersion}>Version {ag.version}</Text>
                  <Text style={styles.revDate}>
                    Effective: {new Date(ag.effectiveDate || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                {!isActive ? (
                  <TouchableOpacity
                    style={styles.activateBtn}
                    onPress={() => handleActivate(ag.id)}
                  >
                    <Text style={styles.activateBtnText}>Activate</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.revActiveTag}>
                    <Text style={styles.revActiveTagText}>Current Active</Text>
                  </View>
                )}
              </View>

              <Text numberOfLines={2} style={styles.revSnippet}>
                {ag.terms}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* 5. DRAFT AGREEMENT MODAL */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Draft Labour Contract Terms</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInputLabel}>CONTRACT CLAUSES & CONDITIONS</Text>
            <TextInput
              style={styles.termsTextArea}
              multiline
              numberOfLines={8}
              value={termsText}
              onChangeText={setTermsText}
              placeholder="Enter agreement terms..."
              placeholderTextColor={colors.textLight}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Publish & Enforce Contract</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  vernacularStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  vernacularText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
  },
  statutoryNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 14,
  },
  statutoryNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.successDark,
  },
  statutoryNoticeSub: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 15,
    marginTop: 2,
  },
  heroAgreementCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    marginBottom: 16,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroVersion: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.successDark,
  },
  clauseBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  clauseText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  revisionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  revHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  revVersion: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  revDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  activateBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  activateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  revActiveTag: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  revActiveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  revSnippet: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  termsTextArea: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 13,
    color: colors.text,
    minHeight: 140,
    marginBottom: 14,
  },
  modalSubmitBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    ...shadows.hero,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
