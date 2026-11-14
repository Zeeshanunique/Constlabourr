import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../../styles/theme';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  variant?: 'dark' | 'light';
  subtitle?: string;
}

export function BrandLogo({
  size = 40,
  showText = true,
  variant = 'dark',
  subtitle = 'FIELD OPERATIONS OS',
}: BrandLogoProps) {
  const isDark = variant === 'dark';
  const textColor = isDark ? colors.text : colors.textInverted;
  const subtextColor = isDark ? colors.accent : colors.accentLight;

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { width: size, height: size }]}>
        <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 32 32" fill="none">
          {/* Construction Trusses & Base */}
          <Path
            d="M4 27H28M8 27L16 19M24 27L16 19"
            stroke="#EA580C"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <Path
            d="M12 27V7M16 19V7"
            stroke="#94A3B8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Safety Helmet / Crane Beam Geometry */}
          <Path
            d="M6 7H26L22 12H10L6 7Z"
            fill="#EA580C"
          />
          <Path
            d="M13 14C13 11.5 15 9.5 17.5 9.5C20 9.5 22 11.5 22 14V16H13V14Z"
            fill="#0F172A"
          />
          <Rect
            x="11"
            y="15"
            width="13"
            height="2"
            rx="1"
            fill="#FFFFFF"
          />
        </Svg>
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: textColor }]}>ConstLabour</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subtextColor }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  textContainer: {
    marginLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  proBadge: {
    marginLeft: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
});
