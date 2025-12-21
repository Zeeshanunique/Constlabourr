import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Save, 
  Users, 
  CheckCircle, 
  Calendar,
  Eye,
  Shield
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

interface AgreementTabProps {
  accessToken: string;
}

interface Agreement {
  id: string;
  contractorId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface Acceptance {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  agreementVersion: number;
  acceptedAt: string;
  signature: string;
}

export function AgreementTab({ accessToken }: AgreementTabProps) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [title, setTitle] = useState('Worker Employment Agreement');
  const [content, setContent] = useState('');
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'acceptances'>('create');
  const [selectedAcceptance, setSelectedAcceptance] = useState<Acceptance | null>(null);

  useEffect(() => {
    fetchAgreement();
    fetchAcceptances();
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
      
      if (data.agreement) {
        setAgreement(data.agreement);
        setTitle(data.agreement.title);
        setContent(data.agreement.content);
      } else {
        // Set default template
        setContent(`EMPLOYMENT AGREEMENT

This agreement is made between the Contractor and the Worker for employment at construction sites.

TERMS AND CONDITIONS:

1. WORKING HOURS
   - Standard shift: 8 hours per day
   - Overtime will be paid at 1.5x the hourly rate
   - Break time: 1 hour (unpaid)

2. PAYMENT TERMS
   - Daily wage will be paid as agreed
   - Payment will be made weekly/monthly as per agreement
   - Overtime will be calculated and paid separately

3. SAFETY REQUIREMENTS
   - Workers must follow all safety protocols
   - Personal Protective Equipment (PPE) must be worn at all times
   - Workers must report any safety hazards immediately

4. ATTENDANCE
   - Workers must check in/out using the mobile app
   - Late arrivals may result in wage deductions
   - Advance notice required for planned absences

5. CONDUCT
   - Professional behavior is expected at all times
   - Workers must follow site rules and regulations
   - Alcohol and drugs are strictly prohibited on site

6. TERMINATION
   - Either party may terminate with 7 days notice
   - Immediate termination for serious misconduct

7. DISPUTE RESOLUTION
   - Any disputes will be resolved through discussion
   - This agreement serves as legal evidence

By signing below, I acknowledge that I have read, understood, and agree to all the terms and conditions mentioned above.`);
      }
    } catch (error) {
      console.error('Error fetching agreement:', error);
    }
  };

  const fetchAcceptances = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/acceptances`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setAcceptances(data.acceptances || []);
    } catch (error) {
      console.error('Error fetching acceptances:', error);
    }
  };

  const handleSaveAgreement = async () => {
    if (!content.trim()) {
      toast.error('Please enter agreement content');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title,
            content,
            version: agreement ? agreement.version + 1 : 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save agreement');
      }

      const data = await response.json();
      setAgreement(data.agreement);
      toast.success('Agreement saved successfully! Workers will need to accept the new version.');
      fetchAgreement();
    } catch (error: any) {
      console.error('Error saving agreement:', error);
      toast.error(error.message || 'Failed to save agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl">Agreement Management</h2>
              <p className="text-sm text-purple-100">
                Create terms for workers to accept
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl text-gray-900">{acceptances.length}</p>
                <p className="text-xs text-gray-600">Acceptances</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl text-gray-900">v{agreement?.version || 1}</p>
                <p className="text-xs text-gray-600">Version</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => setActiveTab('create')}
          variant={activeTab === 'create' ? 'default' : 'outline'}
          className="w-full"
        >
          <FileText className="w-4 h-4 mr-2" />
          Create/Edit
        </Button>
        <Button
          onClick={() => setActiveTab('acceptances')}
          variant={activeTab === 'acceptances' ? 'default' : 'outline'}
          className="w-full"
        >
          <Users className="w-4 h-4 mr-2" />
          Acceptances ({acceptances.length})
        </Button>
      </div>

      {/* Create/Edit Tab */}
      {activeTab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agreement Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Agreement Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter agreement title"
              />
            </div>

            <div>
              <Label htmlFor="content">Agreement Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter agreement terms and conditions..."
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                This agreement will be shown to all workers for acceptance
              </p>
            </div>

            {agreement && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-900">
                  <strong>⚠️ Note:</strong> Updating the agreement will increase the version number.
                  All workers will need to accept the new version.
                </p>
              </div>
            )}

            <Button
              onClick={handleSaveAgreement}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {agreement ? 'Update Agreement' : 'Create Agreement'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Acceptances Tab */}
      {activeTab === 'acceptances' && (
        <div className="space-y-3">
          {acceptances.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">No worker acceptances yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Workers will appear here after accepting the agreement
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Legal Evidence:</strong> All acceptances are stored with timestamps and signatures for dispute resolution.
                </p>
              </div>

              {acceptances.map((acceptance) => (
                <Card key={acceptance.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{acceptance.workerName}</h3>
                        <p className="text-sm text-gray-600">{acceptance.workerPhone}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Accepted
                      </Badge>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Version Accepted:</span>
                        <span className="font-medium text-gray-900">v{acceptance.agreementVersion}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Accepted On:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(acceptance.acceptedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => setSelectedAcceptance(acceptance)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Signature
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Signature Modal */}
      {selectedAcceptance && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAcceptance(null)}
        >
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedAcceptance.workerName}'s Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
                <img 
                  src={selectedAcceptance.signature} 
                  alt="Worker Signature"
                  className="w-full h-32 object-contain"
                />
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Worker:</span>
                  <span className="font-medium">{selectedAcceptance.workerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium">{selectedAcceptance.workerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Accepted:</span>
                  <span className="font-medium">
                    {new Date(selectedAcceptance.acceptedAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Version:</span>
                  <span className="font-medium">v{selectedAcceptance.agreementVersion}</span>
                </div>
              </div>

              <Button 
                onClick={() => setSelectedAcceptance(null)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
