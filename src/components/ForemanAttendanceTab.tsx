import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Calendar,
  IndianRupee,
  Coffee,
  Undo,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

interface Worker {
  id: string;
  name: string;
  phone: string;
  dailyWage: number;
  siteId: string;
}

interface Site {
  id: string;
  name: string;
  shiftStartTime: string;
  shiftEndTime: string;
  breakDuration: number; // in hours
}

interface TodayAttendance {
  id?: string;
  workerId: string;
  workerName: string;
  dailyWage: number;
  checkIn: string | null;
  checkOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status: 'checked-in' | 'on-break' | 'checked-out' | 'pending';
  hoursWorked?: number;
  overtimeHours?: number;
  payment?: number;
}

interface ForemanAttendanceTabProps {
  accessToken: string;
  onRefreshDashboard?: () => void;
}

export function ForemanAttendanceTab({ accessToken, onRefreshDashboard }: ForemanAttendanceTabProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Map<string, TodayAttendance>>(new Map());
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activeView, setActiveView] = useState<'check-in' | 'check-out'>('check-in');

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchSites();
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchTodayAttendance();
    }
  }, [selectedSite, selectedDate]);

  const fetchSites = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      const sitesList = data.sites || [];
      setSites(sitesList);
      if (sitesList.length > 0 && !selectedSite) {
        setSelectedSite(sitesList[0].id);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?siteId=${selectedSite}&date=${selectedDate}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      
      const attendanceMap = new Map<string, TodayAttendance>();
      const siteWorkers = workers.filter(w => w.siteId === selectedSite);
      
      siteWorkers.forEach(worker => {
        const record = data.attendance?.find((a: any) => a.workerId === worker.id);
        
        if (record) {
          attendanceMap.set(worker.id, {
            id: record.id,
            workerId: worker.id,
            workerName: worker.name,
            dailyWage: worker.dailyWage,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            breakStart: record.breakStart,
            breakEnd: record.breakEnd,
            status: record.checkOut ? 'checked-out' : (record.checkIn ? 'checked-in' : 'pending'),
            hoursWorked: record.netWorkHours,
            overtimeHours: record.overtimeHours,
            payment: record.totalPayment,
          });
        } else {
          attendanceMap.set(worker.id, {
            workerId: worker.id,
            workerName: worker.name,
            dailyWage: worker.dailyWage,
            checkIn: null,
            checkOut: null,
            breakStart: null,
            breakEnd: null,
            status: 'pending',
          });
        }
      });
      
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const getCurrentTimeForAPI = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5); // HH:MM format
  };

  const handleCheckIn = async (workerId: string) => {
    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            checkIn: currentTime,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} checked in at ${currentTime}`);
      await fetchTodayAttendance();
      
      // Keep on check-in tab for batch processing
      setActiveView('check-in');
    } catch (error: any) {
      console.error('Error checking in:', error);
      toast.error(error.message || 'Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (workerId: string) => {
    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      const record = attendance.get(workerId);
      
      if (!record?.checkIn) {
        toast.error('Worker must check in first');
        return;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            checkIn: record.checkIn,
            checkOut: currentTime,
            // Auto-apply 1 hour break (13:00-14:00)
            breakStart: '13:00',
            breakEnd: '14:00',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out');
      }
      
      const result = await response.json();
      const worker = workers.find(w => w.id === workerId);
      toast.success(
        `${worker?.name} checked out at ${currentTime}\nPayment: ₹${result.attendance.totalPayment.toFixed(2)}\nHours: ${result.attendance.netWorkHours.toFixed(1)}h${result.attendance.overtimeHours > 0 ? ` (OT: ${result.attendance.overtimeHours.toFixed(1)}h)` : ''}`,
        { duration: 5000 }
      );
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error checking out:', error);
      toast.error(error.message || 'Failed to check out');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAbsent = async (workerId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            status: 'absent',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark absent');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} marked as absent`);
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error marking absent:', error);
      toast.error(error.message || 'Failed to mark absent');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async (workerId: string) => {
    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      const record = attendance.get(workerId);
      
      if (!record?.checkIn) {
        toast.error('Worker must check in first');
        return;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            checkIn: record.checkIn,
            breakStart: currentTime,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start break');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} started break at ${currentTime}`);
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error starting break:', error);
      toast.error(error.message || 'Failed to start break');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async (workerId: string) => {
    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      const record = attendance.get(workerId);
      
      if (!record?.breakStart) {
        toast.error('No active break found');
        return;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            checkIn: record.checkIn,
            breakStart: record.breakStart,
            breakEnd: currentTime,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to end break');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} ended break at ${currentTime}`);
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error ending break:', error);
      toast.error(error.message || 'Failed to end break');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertCheckIn = async (workerId: string) => {
    if (!confirm('Are you sure you want to revert check-in? This will clear all attendance data for this worker today.')) {
      return;
    }
    
    try {
      setLoading(true);
      const record = attendance.get(workerId);
      
      if (!record?.id) {
        toast.error('No attendance record found');
        return;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${record.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revert check-in');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} check-in reverted`);
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error reverting check-in:', error);
      toast.error(error.message || 'Failed to revert check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertCheckOut = async (workerId: string) => {
    try {
      setLoading(true);
      const record = attendance.get(workerId);
      if (!record || !record.id) {
        toast.error('No attendance record found to revert');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/${record.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            checkOut: null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revert check-out');
      }

      toast.success('Check-out reverted successfully');
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error reverting check-out:', error);
      toast.error(error.message || 'Failed to revert check-out');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertBreak = async (workerId: string) => {
    if (!confirm('Are you sure you want to clear break times?')) {
      return;
    }
    
    try {
      setLoading(true);
      const record = attendance.get(workerId);
      
      if (!record?.checkIn) {
        toast.error('No attendance record found');
        return;
      }
      
      // Re-submit attendance without break times
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId,
            siteId: selectedSite,
            date: selectedDate,
            checkIn: record.checkIn,
            // No break times - this clears them
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revert break');
      }
      
      const worker = workers.find(w => w.id === workerId);
      toast.success(`${worker?.name} break times cleared`);
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error reverting break:', error);
      toast.error(error.message || 'Failed to revert break');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllAttendance = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL attendance records from the database! This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/clear/all`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear attendance records');
      }

      const result = await response.json();
      toast.success(`${result.message}\n\nGo to Home tab to see updated stats!`, { duration: 6000 });
      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error clearing attendance:', error);
      toast.error(error.message || 'Failed to clear attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreakAll = async () => {
    if (!selectedSite) {
      toast.error('Please select a site first');
      return;
    }

    // Get all workers who are checked in and not on break
    const workersToBreak = checkedIn.filter(worker => {
      const record = attendance.get(worker.id);
      return record && !record.breakStart;
    });

    if (workersToBreak.length === 0) {
      toast.error('No workers available to start break');
      return;
    }

    if (!confirm(`Start break for all ${workersToBreak.length} working ${workersToBreak.length === 1 ? 'worker' : 'workers'}?`)) {
      return;
    }

    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      let successCount = 0;
      let failCount = 0;

      // Process all workers in parallel
      await Promise.all(
        workersToBreak.map(async (worker) => {
          try {
            const record = attendance.get(worker.id);
            if (!record || !record.checkIn) return;

            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  workerId: worker.id,
                  siteId: selectedSite,
                  date: selectedDate,
                  checkIn: record.checkIn,
                  breakStart: currentTime,
                }),
              }
            );

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`Error starting break for ${worker.name}:`, error);
            failCount++;
          }
        })
      );

      if (successCount > 0) {
        toast.success(`☕ Break started for ${successCount} ${successCount === 1 ? 'worker' : 'workers'} at ${currentTime}${failCount > 0 ? ` (${failCount} failed)` : ''}`, { duration: 4000 });
      }
      
      if (failCount > 0 && successCount === 0) {
        toast.error(`Failed to start break for ${failCount} ${failCount === 1 ? 'worker' : 'workers'}`);
      }

      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error starting break for all:', error);
      toast.error('Failed to start break');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreakAll = async () => {
    if (!selectedSite) {
      toast.error('Please select a site first');
      return;
    }

    // Get all workers who are on break (have breakStart but no breakEnd)
    const workersOnBreak = checkedIn.filter(worker => {
      const record = attendance.get(worker.id);
      return record && record.breakStart && !record.breakEnd;
    });

    if (workersOnBreak.length === 0) {
      toast.error('No workers currently on break');
      return;
    }

    if (!confirm(`End break for all ${workersOnBreak.length} ${workersOnBreak.length === 1 ? 'worker' : 'workers'} on break?`)) {
      return;
    }

    try {
      setLoading(true);
      const currentTime = getCurrentTimeForAPI();
      let successCount = 0;
      let failCount = 0;

      // Process all workers in parallel
      await Promise.all(
        workersOnBreak.map(async (worker) => {
          try {
            const record = attendance.get(worker.id);
            if (!record || !record.checkIn || !record.breakStart) return;

            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  workerId: worker.id,
                  siteId: selectedSite,
                  date: selectedDate,
                  checkIn: record.checkIn,
                  breakStart: record.breakStart,
                  breakEnd: currentTime,
                }),
              }
            );

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`Error ending break for ${worker.name}:`, error);
            failCount++;
          }
        })
      );

      if (successCount > 0) {
        toast.success(`✅ Break ended for ${successCount} ${successCount === 1 ? 'worker' : 'workers'} at ${currentTime}${failCount > 0 ? ` (${failCount} failed)` : ''}`, { duration: 4000 });
      }
      
      if (failCount > 0 && successCount === 0) {
        toast.error(`Failed to end break for ${failCount} ${failCount === 1 ? 'worker' : 'workers'}`);
      }

      fetchTodayAttendance();
    } catch (error: any) {
      console.error('Error ending break for all:', error);
      toast.error('Failed to end break');
    } finally {
      setLoading(false);
    }
  };

  const siteWorkers = workers.filter(w => w.siteId === selectedSite);
  const pendingCheckIn = siteWorkers.filter(w => {
    const record = attendance.get(w.id);
    return !record?.checkIn;
  });
  const checkedIn = siteWorkers.filter(w => {
    const record = attendance.get(w.id);
    return record?.checkIn && !record?.checkOut;
  });
  const checkedOut = siteWorkers.filter(w => {
    const record = attendance.get(w.id);
    return record?.checkOut;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Site and Date Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="site">Site</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Time Display */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Current Time</p>
                <p className="text-2xl font-mono">{currentTime}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">Today</p>
              <p className="text-lg">
                {new Date(selectedDate).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'short' 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl text-gray-900">{pendingCheckIn.length}</p>
            <p className="text-xs text-gray-600">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl text-gray-900">{checkedIn.length}</p>
            <p className="text-xs text-gray-600">Working</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl text-gray-900">{checkedOut.length}</p>
            <p className="text-xs text-gray-600">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Views */}
      <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="check-in" className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Check-In ({pendingCheckIn.length})
          </TabsTrigger>
          <TabsTrigger value="check-out" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Check-Out ({checkedIn.length})
          </TabsTrigger>
        </TabsList>

        {/* CHECK-IN VIEW (Morning) */}
        <TabsContent value="check-in" className="space-y-2 mt-4">
          {!selectedSite ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Please select a site</p>
              </CardContent>
            </Card>
          ) : pendingCheckIn.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-gray-900">All workers checked in!</p>
                <p className="text-sm text-gray-600 mt-1">
                  Switch to Check-Out tab to mark departures
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-900">
                  <strong>Morning Check-In:</strong> Tap each worker as they arrive at the site
                </p>
              </div>
              {pendingCheckIn.map(worker => {
                const record = attendance.get(worker.id);
                return (
                  <Card key={worker.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{worker.name}</h3>
                          <p className="text-sm text-gray-600">{worker.phone}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center">
                            <IndianRupee className="w-3 h-3 mr-1" />
                            ₹{worker.dailyWage}/day
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCheckIn(worker.id)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <LogIn className="w-4 h-4 mr-2" />
                            Check In
                          </Button>
                          <Button
                            onClick={() => handleMarkAbsent(worker.id)}
                            disabled={loading}
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* CHECK-OUT VIEW (Evening) */}
        <TabsContent value="check-out" className="space-y-2 mt-4">
          {!selectedSite ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Please select a site</p>
              </CardContent>
            </Card>
          ) : checkedIn.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                <p className="text-gray-900">No workers to check out</p>
                <p className="text-sm text-gray-600 mt-1">
                  {pendingCheckIn.length > 0 
                    ? 'Check in workers first from the Check-In tab'
                    : 'All workers have completed for today'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-orange-900">
                  <strong>Evening Check-Out:</strong> Tap each worker as they leave. Payment will be auto-calculated.
                </p>
              </div>

              {/* Bulk Break Button */}
              {checkedIn.some(w => {
                const record = attendance.get(w.id);
                return record && !record.breakStart;
              }) && (
                <Button
                  onClick={handleStartBreakAll}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg mb-3"
                  size="lg"
                >
                  <Coffee className="w-5 h-5 mr-2" />
                  Start Break for All Workers ({checkedIn.filter(w => {
                    const record = attendance.get(w.id);
                    return record && !record.breakStart;
                  }).length})
                </Button>
              )}

              {/* End Break for All Button */}
              {checkedIn.some(w => {
                const record = attendance.get(w.id);
                return record && record.breakStart && !record.breakEnd;
              }) && (
                <Button
                  onClick={handleEndBreakAll}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg mb-3"
                  size="lg"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  End Break for All Workers ({checkedIn.filter(w => {
                    const record = attendance.get(w.id);
                    return record && record.breakStart && !record.breakEnd;
                  }).length})
                </Button>
              )}

              {checkedIn.map(worker => {
                const record = attendance.get(worker.id);
                const onBreak = record?.breakStart && !record?.breakEnd;
                
                return (
                  <Card key={worker.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{worker.name}</h3>
                          <p className="text-sm text-gray-600">{worker.phone}</p>
                        </div>
                        {onBreak ? (
                          <Badge className="bg-orange-100 text-orange-700">
                            <Coffee className="w-3 h-3 mr-1" />
                            On Break
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Working
                          </Badge>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">Checked In</p>
                            <p className="font-medium text-gray-900">{record?.checkIn}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Daily Wage</p>
                            <p className="font-medium text-gray-900 flex items-center">
                              <IndianRupee className="w-3 h-3 mr-1" />
                              {worker.dailyWage}
                            </p>
                          </div>
                          {record?.breakStart && (
                            <>
                              <div>
                                <p className="text-gray-600">Break Start</p>
                                <p className="font-medium text-gray-900">{record.breakStart}</p>
                              </div>
                              {record?.breakEnd && (
                                <div>
                                  <p className="text-gray-600">Break End</p>
                                  <p className="font-medium text-gray-900">{record.breakEnd}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {onBreak ? (
                            <>
                              <Button
                                onClick={() => handleEndBreak(worker.id)}
                                disabled={loading}
                                className="w-full bg-orange-600 hover:bg-orange-700"
                              >
                                <Coffee className="w-4 h-4 mr-2" />
                                End Break
                              </Button>
                              <Button
                                onClick={() => handleCheckOut(worker.id)}
                                disabled={loading}
                                variant="outline"
                                className="w-full"
                              >
                                <LogOut className="w-4 h-4 mr-2" />
                                Check Out
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleStartBreak(worker.id)}
                                disabled={loading}
                                variant="outline"
                                className="w-full"
                              >
                                <Coffee className="w-4 h-4 mr-2" />
                                Start Break
                              </Button>
                              <Button
                                onClick={() => handleCheckOut(worker.id)}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                <LogOut className="w-4 h-4 mr-2" />
                                Check Out
                              </Button>
                            </>
                          )}
                        </div>
                        
                        {/* Revert Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {(record?.breakStart || record?.breakEnd) && (
                            <Button
                              onClick={() => handleRevertBreak(worker.id)}
                              disabled={loading}
                              variant="ghost"
                              size="sm"
                              className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <Undo className="w-3 h-3 mr-1" />
                              Clear Break
                            </Button>
                          )}
                          <Button
                            onClick={() => handleRevertCheckIn(worker.id)}
                            disabled={loading}
                            variant="ghost"
                            size="sm"
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete Entry
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Completed Today */}
      {checkedOut.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Completed Today ({checkedOut.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checkedOut.map(worker => {
              const record = attendance.get(worker.id);
              return (
                <div key={worker.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{worker.name}</p>
                      <p className="text-xs text-gray-600">
                        {record?.checkIn} → {record?.checkOut}
                        {record?.hoursWorked && ` (${record.hoursWorked.toFixed(1)}h)`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600 flex items-center">
                        <IndianRupee className="w-4 h-4" />
                        {record?.payment?.toFixed(2)}
                      </p>
                      {record?.overtimeHours && record.overtimeHours > 0 && (
                        <p className="text-xs text-orange-600">
                          +OT {record.overtimeHours.toFixed(1)}h
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRevertCheckOut(worker.id)}
                    disabled={loading}
                    variant="ghost"
                    size="sm"
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Undo className="w-3 h-3 mr-1" />
                    Revert Check-Out
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Clear All Attendance Button (Testing) */}
      <div className="flex justify-center pt-4">
        <Button 
          variant="destructive" 
          onClick={handleClearAllAttendance}
          disabled={loading}
          size="lg"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Attendance (Testing)
        </Button>
      </div>
    </div>
  );
}