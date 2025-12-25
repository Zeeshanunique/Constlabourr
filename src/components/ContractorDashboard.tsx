import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Building2, Users, Calendar, DollarSign, LogOut, Home, UserCircle, CheckSquare, BarChart3 } from 'lucide-react';
import { WorkersTab } from './WorkersTab';
import { ForemenTab } from './ForemenTab';
import { SitesTab } from './SitesTab';
import { ForemanAttendanceTab } from './ForemanAttendanceTab';
import { BulkAttendanceTab } from './BulkAttendanceTab';
import { PayrollTab } from './PayrollTab';
import { ReportsTab } from './ReportsTab';
import { projectId } from '../utils/supabase/info';

interface ContractorDashboardProps {
  accessToken: string;
}

interface Stats {
  totalWorkers: number;
  activeWorkers: number;
  totalSites: number;
  activeSites: number;
  presentToday: number;
  absentToday: number;
}

export function ContractorDashboard({ accessToken }: ContractorDashboardProps) {
  const context = useContext(AppContext);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/dashboard/stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (!context) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-6 pb-8 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-white">ConstLabour</h1>
              <p className="text-sm text-blue-100">{context.user?.name}</p>
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
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl text-white">{stats?.totalWorkers || 0}</div>
              <div className="text-xs text-blue-100 mt-1">Workers</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl text-white">{stats?.totalSites || 0}</div>
              <div className="text-xs text-blue-100 mt-1">Sites</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl text-white">{stats?.presentToday || 0}</div>
              <div className="text-xs text-blue-100 mt-1">Present</div>
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
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your operations</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab('workers')}
                    className="flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
                      <Users className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-900">Workers</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('foremen')}
                    className="flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                      <UserCircle className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-900">Foremen</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('sites')}
                    className="flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-900">Sites</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-900">Attendance</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('payroll')}
                    className="flex flex-col items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-600 flex items-center justify-center">
                      <DollarSign className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-900">Payroll</span>
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Today's Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Present Today</p>
                        <p className="text-xl text-gray-900">{stats?.presentToday || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Absent Today</p>
                        <p className="text-xl text-gray-900">{stats?.absentToday || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Active Sites</p>
                        <p className="text-xl text-gray-900">{stats?.activeSites || 0}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'workers' && <WorkersTab accessToken={accessToken} />}
          {activeTab === 'foremen' && <ForemenTab accessToken={accessToken} />}
          {activeTab === 'sites' && <SitesTab accessToken={accessToken} />}
          {activeTab === 'attendance' && <ForemanAttendanceTab accessToken={accessToken} />}
          {activeTab === 'bulkattendance' && <BulkAttendanceTab accessToken={accessToken} />}
          {activeTab === 'payroll' && <PayrollTab accessToken={accessToken} />}
          {activeTab === 'reports' && <ReportsTab accessToken={accessToken} />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-5 h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'workers' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs">Workers</span>
          </button>
          <button
            onClick={() => setActiveTab('sites')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'sites' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Building2 className="w-6 h-6" />
            <span className="text-xs">Sites</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'attendance' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs">Attendance</span>
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'payroll' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-xs">Payroll</span>
          </button>
        </div>
      </div>
    </div>
  );
}