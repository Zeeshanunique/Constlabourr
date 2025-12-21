import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../App";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Building2,
  Users,
  Calendar,
  DollarSign,
  LogOut,
  Home,
  UserCircle,
  CheckSquare,
  BarChart3,
  TrendingUp,
  Clock,
  MapPin,
  Briefcase,
  ChevronRight,
  Plus,
  FileText,
  Shield,
} from "lucide-react";
import { WorkersTab } from "./WorkersTab";
import { ForemenTab } from "./ForemenTab";
import { SitesTab } from "./SitesTab";
import { ForemanAttendanceTab } from "./ForemanAttendanceTab";
import { BulkAttendanceTab } from "./BulkAttendanceTab";
import { PayrollTab } from "./PayrollTab";
import { ReportsTab } from "./ReportsTab";
import { AgreementTab } from "./AgreementTab";
import { projectId } from "../utils/supabase/info";

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

export function ModernContractorDashboard({
  accessToken,
}: ContractorDashboardProps) {
  const context = useContext(AppContext);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    fetchStats();
  }, []);

  // Refresh stats when returning to home tab
  useEffect(() => {
    if (activeTab === "home") {
      fetchStats();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/dashboard/stats`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok)
        throw new Error("Failed to fetch stats");

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  if (!context) return null;

  const renderHome = () => (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-xs mb-1">
                  Total Workers
                </p>
                <p className="text-white text-3xl">
                  {stats?.totalWorkers || 0}
                </p>
                <p className="text-blue-100 text-xs mt-1">
                  {stats?.activeWorkers || 0} active
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-100 text-xs mb-1">
                  Active Sites
                </p>
                <p className="text-white text-3xl">
                  {stats?.activeSites || 0}
                </p>
                <p className="text-purple-100 text-xs mt-1">
                  of {stats?.totalSites || 0} total
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100 text-xs mb-1">
                  Present Today
                </p>
                <p className="text-white text-3xl">
                  {stats?.presentToday || 0}
                </p>
                <p className="text-green-100 text-xs mt-1">
                  attendance marked
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 text-xs mb-1">
                  Absent Today
                </p>
                <p className="text-white text-3xl">
                  {stats?.absentToday || 0}
                </p>
                <p className="text-orange-100 text-xs mt-1">
                  workers absent
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-gray-900 px-1 mb-3">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("bulk-attendance")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <CheckSquare className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-gray-900">
                      Mark Attendance
                    </p>
                    <p className="text-xs text-gray-500">
                      Bulk mark for all workers
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("workers")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-gray-900">
                      Manage Workers
                    </p>
                    <p className="text-xs text-gray-500">
                      Add, edit, or remove workers
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("payroll")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-gray-900">
                      Process Payroll
                    </p>
                    <p className="text-xs text-gray-500">
                      Calculate and pay wages
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("reports")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-gray-900">
                      View Reports
                    </p>
                    <p className="text-xs text-gray-500">
                      Analytics and insights
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("agreement")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-gray-900">
                      Worker Agreement
                    </p>
                    <p className="text-xs text-gray-500">
                      Manage terms & signatures
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Modern Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white px-4 pt-6 pb-8 shadow-xl relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[rgba(0,0,0,0)]">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-32 -translate-y-32"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-48 translate-y-48"></div>
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-white text-lg">
                  ConstLabour
                </h1>
                <p className="text-sm text-blue-100">
                  {context.user?.name}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={context.logout}
              className="text-white hover:bg-white/10 rounded-xl"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          {activeTab === "home" && (
            <div className="space-y-2">
              <p className="text-blue-100 text-sm">
                Dashboard Overview
              </p>
              <h2 className="text-white text-2xl">
                Welcome back!
              </h2>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          {activeTab === "home" && renderHome()}
          {activeTab === "workers" && (
            <WorkersTab accessToken={accessToken} />
          )}
          {activeTab === "foremen" && (
            <ForemenTab accessToken={accessToken} />
          )}
          {activeTab === "sites" && (
            <SitesTab accessToken={accessToken} />
          )}
          {activeTab === "attendance" && (
            <ForemanAttendanceTab accessToken={accessToken} />
          )}
          {activeTab === "bulk-attendance" && (
            <BulkAttendanceTab accessToken={accessToken} />
          )}
          {activeTab === "payroll" && (
            <PayrollTab accessToken={accessToken} />
          )}
          {activeTab === "reports" && (
            <ReportsTab accessToken={accessToken} />
          )}
          {activeTab === "agreement" && (
            <AgreementTab accessToken={accessToken} />
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl safe-area-inset-bottom z-50">
        <div className="grid grid-cols-6 gap-1 p-2 pb-safe">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "home"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Home
              className={`w-5 h-5 ${activeTab === "home" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Home</span>
          </button>

          <button
            onClick={() => setActiveTab("workers")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "workers"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users
              className={`w-5 h-5 ${activeTab === "workers" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Workers</span>
          </button>

          <button
            onClick={() => setActiveTab("foremen")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "foremen"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <UserCircle
              className={`w-5 h-5 ${activeTab === "foremen" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Foremen</span>
          </button>

          <button
            onClick={() => setActiveTab("sites")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "sites"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Briefcase
              className={`w-5 h-5 ${activeTab === "sites" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Sites</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "attendance"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Calendar
              className={`w-5 h-5 ${activeTab === "attendance" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Attend</span>
          </button>

          <button
            onClick={() => setActiveTab("payroll")}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
              activeTab === "payroll"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <DollarSign
              className={`w-5 h-5 ${activeTab === "payroll" ? "scale-110" : ""}`}
            />
            <span className="text-xs">Payroll</span>
          </button>
        </div>
      </div>
    </div>
  );
}