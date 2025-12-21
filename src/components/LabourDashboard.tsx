import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Building2, LogOut, Calendar, DollarSign, TrendingUp, IndianRupee, Home, History } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { WorkerAgreementModal } from './WorkerAgreementModal';

interface LabourDashboardProps {
  accessToken: string;
}

export function LabourDashboard({ accessToken }: LabourDashboardProps) {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('home');
  const [stats, setStats] = useState({
    totalDays: 0,
    presentDays: 0,
    totalEarnings: 0,
    pendingAdvances: 0,
  });
  const [needsAgreementAcceptance, setNeedsAgreementAcceptance] = useState(false);
  const [checkingAgreement, setCheckingAgreement] = useState(true);

  useEffect(() => {
    checkAgreementStatus();
  }, []);

  const checkAgreementStatus = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/agreement/status`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      
      // Show modal if worker needs to accept agreement
      if (data.currentAgreement && data.needsAcceptance) {
        setNeedsAgreementAcceptance(true);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
    } finally {
      setCheckingAgreement(false);
    }
  };

  const handleAgreementAccepted = () => {
    setNeedsAgreementAcceptance(false);
  };

  if (!context) return null;

  // Show loading while checking agreement status
  if (checkingAgreement) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show agreement modal if needed
  if (needsAgreementAcceptance) {
    return <WorkerAgreementModal accessToken={accessToken} onAccepted={handleAgreementAccepted} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-6 pb-8 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-white">ConstLabour</h1>
              <p className="text-sm text-green-100">{context.user?.name}</p>
              <p className="text-xs text-green-200">Worker</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={context.logout}
            className="text-white hover:bg-white/20"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {activeTab === 'home' && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl text-white">{stats.presentDays}</div>
              <div className="text-xs text-green-100 mt-1">Days Present</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl text-white flex items-center">
                <IndianRupee className="w-5 h-5 mr-1" />
                {stats.totalEarnings}
              </div>
              <div className="text-xs text-green-100 mt-1">Earnings</div>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          {activeTab === 'home' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>This Month</CardTitle>
                  <CardDescription>Your work summary</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Present Days</p>
                        <p className="text-2xl text-gray-900">{stats.presentDays}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Earnings</p>
                        <p className="text-2xl text-gray-900 flex items-center">
                          <IndianRupee className="w-5 h-5 mr-1" />
                          {stats.totalEarnings}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pending Advances</p>
                        <p className="text-2xl text-gray-900 flex items-center">
                          <IndianRupee className="w-5 h-5 mr-1" />
                          {stats.pendingAdvances}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attendance Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle
                          className="text-gray-200"
                          strokeWidth="8"
                          stroke="currentColor"
                          fill="transparent"
                          r="40"
                          cx="50"
                          cy="50"
                        />
                        <circle
                          className="text-green-600"
                          strokeWidth="8"
                          strokeDasharray={40 * 2 * Math.PI}
                          strokeDashoffset={40 * 2 * Math.PI * 0.25}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="40"
                          cx="50"
                          cy="50"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl text-gray-900">0%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-4">This month</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Attendance</CardTitle>
                  <CardDescription>Your attendance records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No attendance records found</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>Your payment records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No payment records found</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-2 h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'home' ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'history' ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-xs">History</span>
          </button>
        </div>
      </div>
    </div>
  );
}