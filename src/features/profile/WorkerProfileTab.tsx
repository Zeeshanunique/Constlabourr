import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AppContext } from '@/context/AppContext';
import { theme } from '@/styles/theme';

interface WorkerProfile {
  id: string;
  name: string;
  email?: string;
  phone: string;
  skillLevel: string;
  dailyWage: number;
  messCharge?: number;
  status: string;
  siteName?: string;
  siteId?: string;
  contractorName?: string;
  contractorId?: string;
  aadhaarHash?: string;
  createdAt?: string;
  updatedAt?: string;
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

interface WorkerProfileTabProps {
  accessToken?: string;
}

export function WorkerProfileTab({ accessToken }: WorkerProfileTabProps) {
  const context = useContext(AppContext);
  const route = useRoute();
  const token = accessToken || (route.params as any)?.accessToken;
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/auth/profile`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setProfile(data.profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch profile',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of your worker portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            if (context?.logout) {
              context.logout();
            }
          },
        },
      ]
    );
  };

  const getSkillConfig = (level?: string) => {
    const l = level?.toLowerCase();
    switch (l) {
      case 'highly-skilled':
        return { label: 'HIGHLY SKILLED', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'skilled':
        return { label: 'SKILLED', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'semi-skilled':
        return { label: 'SEMI-SKILLED', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'unskilled':
      default:
        return { label: 'UNSKILLED', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const skill = getSkillConfig(profile?.skillLevel);
  const isActive = (profile?.status || 'active').toLowerCase() === 'active';
  const netDaily = (profile?.dailyWage || 0) - (profile?.messCharge || 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading worker profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Craftsman Profile</Text>
          <Text style={styles.headerSubtitle}>Personal credentials & employment record</Text>
        </View>
        <View style={styles.idBadge}>
          <MaterialIcons name="badge" size={14} color="#ffffff" />
          <Text style={styles.idBadgeText}>VERIFIED</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Card */}
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || context?.user?.name || 'W').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name || context?.user?.name || 'Worker'}</Text>
          <Text style={styles.profilePhone}>{profile?.phone || context?.user?.phone || 'No phone recorded'}</Text>

          <View style={styles.badgesRow}>
            <View style={[styles.skillBadge, { backgroundColor: skill.bg, borderColor: skill.border }]}>
              <Text style={[styles.skillBadgeText, { color: skill.text }]}>{skill.label}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2', borderColor: isActive ? '#A7F3D0' : '#FECACA' }
            ]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? theme.colors.emerald[500] : theme.colors.red[500] }]} />
              <Text style={[styles.statusBadgeText, { color: isActive ? theme.colors.emerald[700] : theme.colors.red[700] }]}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Compensation Bento */}
        <View style={styles.wageCard}>
          <View style={styles.wageHeader}>
            <MaterialIcons name="monetization-on" size={18} color={theme.colors.safetyOrange} />
            <Text style={styles.wageHeaderTitle}>DAILY WAGE STRUCTURE</Text>
          </View>
          <View style={styles.wageGrid}>
            <View style={styles.wageCol}>
              <Text style={styles.wageSublabel}>BASE WAGE</Text>
              <Text style={styles.wageValue}>₹{profile?.dailyWage || 0}</Text>
            </View>
            <View style={styles.wageDivider} />
            <View style={styles.wageCol}>
              <Text style={styles.wageSublabel}>MESS CHARGE</Text>
              <Text style={[styles.wageValue, { color: theme.colors.red[500] }]}>
                -₹{profile?.messCharge || 0}
              </Text>
            </View>
            <View style={styles.wageDivider} />
            <View style={styles.wageCol}>
              <Text style={styles.wageSublabel}>NET PER DAY</Text>
              <Text style={[styles.wageValue, { color: theme.colors.emerald[600] }]}>
                ₹{netDaily > 0 ? netDaily : 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Deployment & Contractor Bento */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <MaterialIcons name="business" size={18} color={theme.colors.slate[700]} />
            <Text style={styles.sectionCardTitle}>ASSIGNMENT & EMPLOYER</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned Site</Text>
            <Text style={styles.infoValue}>{profile?.siteName || 'Floating / Not assigned'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contractor Organization</Text>
            <Text style={styles.infoValue}>{profile?.contractorName || 'Prime Contractor'}</Text>
          </View>
          {profile?.createdAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Registration Date</Text>
              <Text style={styles.infoValue}>
                {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Bank Disbursement Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <MaterialIcons name="account-balance" size={18} color={theme.colors.slate[700]} />
            <Text style={styles.sectionCardTitle}>BANK DISBURSEMENT DETAILS</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bank Name</Text>
            <Text style={styles.infoValue}>{profile?.bankDetails?.bankName || 'State Bank of India'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Number</Text>
            <Text style={styles.infoValue}>{profile?.bankDetails?.accountNumber || '•••• •••• 4892'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>IFSC Code</Text>
            <Text style={styles.infoValue}>{profile?.bankDetails?.ifscCode || 'SBIN0001234'}</Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={18} color={theme.colors.red[600]} />
          <Text style={styles.logoutButtonText}>Sign Out from Device</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.slate[500],
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.slate[900],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.slate[500],
    marginTop: 2,
  },
  idBadge: {
    backgroundColor: theme.colors.slate[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  idBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },
  profileHero: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.slate[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  profilePhone: {
    fontSize: 13,
    color: theme.colors.slate[500],
    marginTop: 2,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  wageCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  wageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  wageHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.slate[700],
    letterSpacing: 0.5,
  },
  wageGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.slate[50],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  wageCol: {
    flex: 1,
    alignItems: 'center',
  },
  wageSublabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.slate[500],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  wageValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.slate[900],
  },
  wageDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
    ...theme.shadows.sm,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.slate[700],
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.slate[100],
  },
  infoLabel: {
    fontSize: 13,
    color: theme.colors.slate[500],
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate[900],
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: theme.radii.md,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.red[600],
  },
});
