import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Building2, LogOut, Users, Calendar, Home } from 'lucide-react';
import { AttendanceTab } from './AttendanceTab';

interface ForemanDashboardProps {
  accessToken: string;
}

export function ForemanDashboard({ accessToken }: ForemanDashboardProps) {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('home');

  if (!context) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-6 pb-8 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-white">ConstLabour</h1>
              <p className="text-sm text-purple-100">{context.user?.name}</p>
              <p className="text-xs text-purple-200">Foreman</p>
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
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          {activeTab === 'home' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Site Overview</CardTitle>
                  <CardDescription>Your assigned construction site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Site Workers</p>
                        <p className="text-2xl text-gray-900">--</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Present Today</p>
                        <p className="text-2xl text-gray-900">--</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-gray-900">Mark Attendance</p>
                      <p className="text-sm text-gray-600">Record worker attendance</p>
                    </div>
                  </button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'attendance' && <AttendanceTab accessToken={accessToken} />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-2 h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'home' ? 'text-purple-600' : 'text-gray-400'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'attendance' ? 'text-purple-600' : 'text-gray-400'
            }`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs">Attendance</span>
          </button>
        </div>
      </div>
    </div>
  );
}
