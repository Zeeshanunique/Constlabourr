import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { FileText, PenTool, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

interface WorkerAgreementModalProps {
  accessToken: string;
  onAccepted: () => void;
}

interface Agreement {
  id: string;
  title: string;
  content: string;
  version: number;
}

export function WorkerAgreementModal({ accessToken, onAccepted }: WorkerAgreementModalProps) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [hasRead, setHasRead] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setAgreement(data.agreement);
    } catch (error) {
      console.error('Error fetching agreement:', error);
      toast.error('Failed to load agreement');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setIsAtBottom(bottom);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const handleAccept = async () => {
    if (!hasRead) {
      toast.error('Please read the entire agreement first');
      return;
    }

    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }

    if (!agreement) {
      toast.error('Agreement not loaded');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            agreementId: agreement.id,
            agreementVersion: agreement.version,
            signature,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to accept agreement');
      }

      toast.success('Agreement accepted successfully!');
      onAccepted();
    } catch (error: any) {
      console.error('Error accepting agreement:', error);
      toast.error(error.message || 'Failed to accept agreement');
    } finally {
      setLoading(false);
    }
  };

  if (!agreement) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading agreement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <CardTitle>{agreement.title}</CardTitle>
              <p className="text-sm text-purple-100">Version {agreement.version}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Important Notice */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-900 mb-1">Important Notice</h4>
                <p className="text-sm text-orange-800">
                  Please read this agreement carefully. By signing below, you agree to all terms and conditions.
                  This document will be stored for legal purposes.
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Content */}
          <div>
            <Label className="mb-2 block">Agreement Terms</Label>
            <div 
              className="border-2 border-gray-300 rounded-lg p-4 h-64 overflow-y-auto bg-gray-50"
              onScroll={handleScroll}
            >
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                {agreement.content}
              </pre>
            </div>
            {!isAtBottom && (
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Please scroll down to read the complete agreement
              </p>
            )}
          </div>

          {/* Read Confirmation */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Checkbox
              id="read-confirm"
              checked={hasRead}
              onCheckedChange={(checked) => setHasRead(checked as boolean)}
              disabled={!isAtBottom}
            />
            <label htmlFor="read-confirm" className="text-sm text-gray-700 flex-1 cursor-pointer">
              I have read and understood all the terms and conditions mentioned above.
              {!isAtBottom && <span className="text-orange-600"> (Scroll to the end first)</span>}
            </label>
          </div>

          {/* Signature Pad */}
          <div>
            <Label className="mb-2 block">Your Signature</Label>
            <div className="border-2 border-gray-300 rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: 'none' }}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                onClick={clearSignature}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Clear
              </Button>
              <p className="text-xs text-gray-500 flex items-center">
                <PenTool className="w-3 h-3 mr-1" />
                Sign above using your finger or mouse
              </p>
            </div>
          </div>

          {/* Accept Button */}
          <Button
            onClick={handleAccept}
            disabled={!hasRead || !signature || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                I Accept & Sign
              </>
            )}
          </Button>

          <p className="text-xs text-center text-gray-500">
            Your signature and acceptance will be recorded with timestamp for legal purposes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-sm font-medium text-gray-700 ${className || ''}`} {...props}>
      {children}
    </label>
  );
}