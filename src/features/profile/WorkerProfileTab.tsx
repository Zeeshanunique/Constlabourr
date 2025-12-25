import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AppContext } from '@/context/AppContext';

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
  contractorName?: string;
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

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'skilled': return '#16a34a';
      case 'semi-skilled': return '#f59e0b';
      case 'unskilled': return '#9ca3af';
      default: return '#9ca3af';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#16a34a' : '#dc2626';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSubtitle}>Your personal information</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="person" size={48} color="#ffffff" />
          </View>
          <Text style={styles.profileName}>{profile?.name || context?.user?.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: getSkillLevelColor(profile?.skillLevel || 'unskilled') }]}>
              <Text style={styles.badgeText}>{profile?.skillLevel || 'N/A'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getStatusColor(profile?.status || 'inactive') }]}>
              <Text style={styles.badgeText}>{profile?.status || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person-outline" size={24} color="#16a34a" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{profile?.phone || 'N/A'}</Text>
            </View>
            {profile?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Work Information */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="work-outline" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Work Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Daily Wage</Text>
              <Text style={styles.infoValue}>₹{profile?.dailyWage || 0}</Text>
            </View>
            {profile?.messCharge !== undefined && profile.messCharge > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mess Charge</Text>
                <Text style={styles.infoValue}>₹{profile.messCharge}</Text>
              </View>
            )}
            {profile?.siteName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Site</Text>
                <Text style={styles.infoValue}>{profile.siteName}</Text>
              </View>
            )}
            {profile?.contractorName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contractor</Text>
                <Text style={styles.infoValue}>{profile.contractorName}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Bank Details */}
        {profile?.bankDetails && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="account-balance" size={24} color="#a855f7" />
              <Text style={styles.sectionTitle}>Bank Details</Text>
            </View>
            <View style={styles.infoGrid}>
              {profile.bankDetails.accountNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Number</Text>
                  <Text style={styles.infoValue}>{profile.bankDetails.accountNumber}</Text>
                </View>
              )}
              {profile.bankDetails.ifscCode && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>IFSC Code</Text>
                  <Text style={styles.infoValue}>{profile.bankDetails.ifscCode}</Text>
                </View>
              )}
              {profile.bankDetails.bankName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bank Name</Text>
                  <Text style={styles.infoValue}>{profile.bankDetails.bankName}</Text>
                </View>
              )}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
});

