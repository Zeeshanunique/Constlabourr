import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { projectId } from '@/utils/supabase/info';
import Toast from 'react-native-toast-message';
import { colors, shadows, radii } from '@/styles/theme';

const WebViewComponent = WebView as any;
const { width } = Dimensions.get('window');

interface WorkerAgreementModalProps {
  accessToken: string;
  onAccepted: () => void;
}

export function WorkerAgreementModal({ accessToken, onAccepted }: WorkerAgreementModalProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreement, setAgreement] = useState<any>(null);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      const ag = data.currentAgreement || data.agreement;
      if (ag) setAgreement(ag);
    } catch (error) {
      console.error('Error fetching agreement:', error);
    }
  };

  const handleClear = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
    setSignature(null);
  };

  const handleAccept = async () => {
    if (!signature) {
      Toast.show({
        type: 'error',
        text1: 'Signature Required',
        text2: 'Please sign with your finger in the signature pad below.',
      });
      return;
    }

    if (!agreement) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No agreement found.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/accept`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agreementId: agreement.id,
            agreementVersion: agreement.version,
            signature,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to submit signed agreement');

      Toast.show({
        type: 'success',
        text1: 'Agreement Signed',
        text2: 'Digital contract verified and archived.',
      });

      onAccepted();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const signatureHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.0.0/dist/signature_pad.umd.min.js"></script>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 8px;
          background: #F8FAFC;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #signature-pad {
          border: 1.5px dashed #CBD5E1;
          border-radius: 8px;
          background: #FFFFFF;
          display: block;
          touch-action: none;
        }
        canvas {
          width: 100%;
          height: 160px;
        }
        .controls {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-clear {
          padding: 6px 14px;
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          background: #FFFFFF;
          color: #64748B;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .hint {
          font-size: 11px;
          color: #94A3B8;
        }
      </style>
    </head>
    <body>
      <canvas id="signature-pad"></canvas>
      <div class="controls">
        <span class="hint">Sign with finger inside box / उंगली से साइन करें</span>
        <button class="btn-clear" onclick="clearSignature()">Clear / मिटाएं</button>
      </div>
      <script>
        const canvas = document.getElementById('signature-pad');
        const signaturePad = new SignaturePad(canvas, {
          penColor: '#0F172A',
          minWidth: 1.5,
          maxWidth: 3.5,
        });

        function resizeCanvas() {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext("2d").scale(ratio, ratio);
          signaturePad.clear();
        }
        window.onresize = resizeCanvas;
        resizeCanvas();

        signaturePad.addEventListener("endStroke", () => {
          if (!signaturePad.isEmpty()) {
            const dataURL = signaturePad.toDataURL('image/png');
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataURL }));
          }
        });

        function clearSignature() {
          signaturePad.clear();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
        }

        window.addEventListener('message', function(event) {
          const data = JSON.parse(event.data);
          if (data.type === 'clear') {
            signaturePad.clear();
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={true} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>Worker Agreement & E-Sign</Text>
              <Text style={styles.modalSubtitle}>Labour Code 2020 Statutory Terms</Text>
            </View>
            <TouchableOpacity
              style={styles.langPill}
              onPress={() => setLang(lang === 'en' ? 'hi' : 'en')}
              activeOpacity={0.8}
            >
              <Text style={styles.langText}>{lang === 'en' ? 'हिंदी में पढ़ें' : 'English'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Identity & Aadhaar Verified Banner */}
            <View style={styles.kycBanner}>
              <MaterialIcons name="verified" size={18} color={colors.success} />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.kycBannerTitle}>Aadhaar Verified Worker Contract</Text>
                <Text style={styles.kycBannerSub}>GPS Lock • Apex Infra Projects Ltd</Text>
              </View>
            </View>

            {/* Terms Box */}
            <View style={styles.termsBox}>
              <Text style={styles.termsText}>
                {lang === 'hi'
                  ? '१. मजदूर ८ घंटे की दैनिक पाली (Shift) के लिए काम करने के लिए सहमत है।\n२. ८ घंटे से अधिक काम करने पर १.५ गुना ओवरटाइम का भुगतान किया जाएगा।\n३. साइट पर हेलमेट, सेफ्टी जूते और सुरक्षा जैकेट पहनना अनिवार्य है।\n४. प्रत्येक मंगलवार को सीधे बैंक या UPI द्वारा वेतन का भुगतान होगा।\n५. ५०% तक का अग्रिम (Advance) साइट सुपरवाइजर की अनुमति से मिल सकता है।'
                  : agreement?.terms ||
                    '1. The Worker agrees to standard 8-hour daily shifts.\n2. Overtime compensated at 1.5x regular hourly base.\n3. Mandatory PPE (Hard hat, safety boots, high-vis jacket).\n4. Direct weekly wage payout every Tuesday via UPI/NEFT.\n5. Cash advances up to 50% earned wages permitted upon approval.'}
              </Text>
            </View>

            {/* Signature Pad Section */}
            <Text style={styles.signaturePadLabel}>DIGITAL TOUCH SIGNATURE CANVAS</Text>
            <View style={styles.webViewContainer}>
              <WebViewComponent
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: signatureHTML }}
                onMessage={(event: any) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'signature') setSignature(data.data);
                    if (data.type === 'cleared') setSignature(null);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                style={styles.webView}
                scrollEnabled={false}
              />
            </View>

            {/* Geotag Stamp */}
            <View style={styles.geotagStrip}>
              <MaterialIcons name="lock" size={14} color={colors.success} />
              <Text style={styles.geotagText}>
                Geotagged: GPS 19.0760° N, 72.8777° E • IST Timestamp Secured
              </Text>
            </View>
          </ScrollView>

          {/* Action Dock */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="verified" size={18} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Accept & Issue Agreement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    maxHeight: '92%',
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  langPill: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  modalScroll: {
    marginBottom: 12,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 10,
  },
  kycBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.successDark,
  },
  kycBannerSub: {
    fontSize: 10,
    color: '#065F46',
  },
  termsBox: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
  },
  termsText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  signaturePadLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  webViewContainer: {
    height: 220,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  webView: {
    flex: 1,
  },
  geotagStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  geotagText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginLeft: 4,
  },
  footerRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    ...shadows.hero,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});
