import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/modal';
import { WebView } from 'react-native-webview';
import { projectId } from '@/utils/supabase/info';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

interface WorkerAgreementModalProps {
  accessToken: string;
  onAccepted: () => void;
}

export function WorkerAgreementModal({ accessToken, onAccepted }: WorkerAgreementModalProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreement, setAgreement] = useState<any>(null);
  const webViewRef = useRef<WebView>(null);

  React.useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      if (data.currentAgreement) {
        setAgreement(data.currentAgreement);
      }
    } catch (error) {
      console.error('Error fetching agreement:', error);
    }
  };

  const handleSignature = (signatureData: string) => {
    setSignature(signatureData);
  };

  const handleClear = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
    setSignature(null);
  };

  const handleAccept = async () => {
    if (!signature) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide your signature',
      });
      return;
    }

    if (!agreement) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No agreement found',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agreementId: agreement.id,
            agreementVersion: agreement.version,
            signature: signature,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept agreement');
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Agreement accepted successfully',
      });

      onAccepted();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to accept agreement',
      });
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
        body {
          margin: 0;
          padding: 10px;
          background: white;
        }
        #signature-pad {
          border: 2px solid #e5e7eb;
          border-radius: 8px;
        }
        canvas {
          width: 100%;
          height: 200px;
        }
        .buttons {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }
        button {
          flex: 1;
          padding: 10px;
          border: 1px solid #2563eb;
          border-radius: 4px;
          background: #2563eb;
          color: white;
          font-size: 14px;
        }
        button.clear {
          background: white;
          color: #2563eb;
        }
      </style>
    </head>
    <body>
      <canvas id="signature-pad"></canvas>
      <div class="buttons">
        <button class="clear" onclick="clearSignature()">Clear</button>
        <button onclick="confirmSignature()">Confirm</button>
      </div>
      <script>
        const canvas = document.getElementById('signature-pad');
        const signaturePad = new SignaturePad(canvas);
        
        function clearSignature() {
          signaturePad.clear();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
        }
        
        function confirmSignature() {
          if (signaturePad.isEmpty()) {
            alert('Please provide your signature');
            return;
          }
          const dataURL = signaturePad.toDataURL('image/png');
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataURL }));
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
    <Modal isOpen={true} onClose={onAccepted} size="full">
      <ModalBackdrop />
      <ModalContent className="max-h-[90%]">
        <ModalHeader>
          <Text size="lg" bold>Worker Agreement</Text>
          <ModalCloseButton onPress={onAccepted}>
            <Text>✕</Text>
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <ScrollView>
            <VStack space="lg">
              {agreement && (
                <>
                  <Box>
                    <Text size="md" bold className="mb-2">
                      Agreement Terms
                    </Text>
                    <Box className="bg-gray-50 p-4 rounded-md">
                      <Text size="sm" className="text-gray-700">
                        {agreement.terms || 'Please read and accept the agreement terms.'}
                      </Text>
                    </Box>
                  </Box>

                  <Box>
                    <Text size="md" bold className="mb-2">
                      Version: {agreement.version}
                    </Text>
                    <Text size="xs" className="text-gray-500">
                      Effective Date: {new Date(agreement.effectiveDate || Date.now()).toLocaleDateString()}
                    </Text>
                  </Box>
                </>
              )}

              <Box>
                <Text size="md" bold className="mb-2">
                  Signature
                </Text>
                <Box className="border-2 border-gray-200 rounded-md overflow-hidden" style={{ height: 250 }}>
                  <WebView
                    ref={webViewRef}
                    source={{ html: signatureHTML }}
                    style={{ backgroundColor: 'transparent' }}
                    onMessage={(event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'signature') {
                          handleSignature(data.data);
                        } else if (data.type === 'cleared') {
                          setSignature(null);
                        }
                      } catch (e) {
                        console.error('Error parsing message:', e);
                      }
                    }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                  />
                </Box>
              </Box>

              <HStack space="sm" className="justify-end">
                <Button variant="outline" action="secondary" onPress={handleClear}>
                  <ButtonText>Clear Signature</ButtonText>
                </Button>
                <Button
                  onPress={handleAccept}
                  isDisabled={loading || !signature}
                >
                  {loading ? (
                    <ButtonText>Processing...</ButtonText>
                  ) : (
                    <ButtonText>Accept Agreement</ButtonText>
                  )}
                </Button>
              </HStack>
            </VStack>
          </ScrollView>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
