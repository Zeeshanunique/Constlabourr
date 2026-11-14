import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, DimensionValue, ViewStyle } from 'react-native';
import { colors, radii } from '../../styles/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = radii.md,
  style,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * High-fidelity Skeleton for Contractor / Foreman / Labour Dashboards
 */
export function DashboardSkeleton() {
  return (
    <View style={styles.dashboardSkeletonContainer}>
      {/* KPI Bento Grid Skeleton */}
      <View style={styles.skeletonBentoRow}>
        <View style={styles.skeletonBentoCard}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="60%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="80%" height={24} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.skeletonBentoCard}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="60%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="80%" height={24} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Hero Strip Skeleton */}
      <View style={styles.skeletonHeroCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width="40%" height={16} />
          <Skeleton width={60} height={22} borderRadius={12} />
        </View>
        <Skeleton width="70%" height={28} style={{ marginTop: 12 }} />
        <Skeleton width="90%" height={14} style={{ marginTop: 8 }} />
      </View>

      {/* Action Buttons Skeleton */}
      <View style={styles.skeletonActionRow}>
        <Skeleton width="48%" height={48} borderRadius={radii.lg} />
        <Skeleton width="48%" height={48} borderRadius={radii.lg} />
      </View>

      {/* Secondary Cards Skeleton */}
      <View style={styles.skeletonListCard}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <View style={styles.skeletonListCard}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for Worker / Site / Foremen Lists
 */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <View style={styles.listSkeletonContainer}>
      {items.map((key) => (
        <View key={key} style={styles.skeletonListItemCard}>
          <View style={styles.skeletonItemTop}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width="65%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={60} height={20} borderRadius={10} />
          </View>
          <View style={styles.skeletonItemBottom}>
            <Skeleton width="30%" height={14} />
            <Skeleton width="25%" height={14} />
            <Skeleton width="35%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: '#334155', // Slate-700 matching ConstLabour theme
  },
  dashboardSkeletonContainer: {
    padding: 16,
    gap: 14,
  },
  skeletonBentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonBentoCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  skeletonHeroCard: {
    backgroundColor: '#1E293B',
    borderRadius: radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  skeletonActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listSkeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  skeletonListItemCard: {
    backgroundColor: '#1E293B',
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  skeletonItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
});
