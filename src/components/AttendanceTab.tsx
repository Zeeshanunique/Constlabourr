import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, MinusCircle, Timer, Coins, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

interface Worker {
  id: string;
  name: string;
  phone: string;
  dailyWage: number;
}

interface Site {
  id: string;
  name: string;
}

interface Attendance {
  id: string;
  workerId: string;
  siteId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workHours: number;
  overtime: number;
  notes: string;
}

interface AttendanceTabProps {
  accessToken: string;
}

export function AttendanceTab({ accessToken }: AttendanceTabProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSite, setSelectedSite] = useState('');

  const [formData, setFormData] = useState({
    workerId: '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkIn: '',
    checkOut: '',
    breakStart: '',
    breakEnd: '',
    notes: '',
  });
  
  const [markingMode, setMarkingMode] = useState<'quick' | 'detailed'>('quick');
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [siteBreakTime, setSiteBreakTime] = useState({
    breakStart: '13:00',
    breakEnd: '14:00',
  });

  useEffect(() => {
    fetchWorkers();
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchAttendance();
    }
  }, [selectedDate, selectedSite]);

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

  const fetchAttendance = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance?siteId=${selectedSite}&date=${selectedDate}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workerId: formData.workerId,
            siteId: formData.siteId,
            date: formData.date,
            status: markingMode === 'quick' ? formData.status : undefined,
            checkIn: markingMode === 'detailed' ? formData.checkIn : null,
            checkOut: markingMode === 'detailed' ? formData.checkOut : null,
            breakStart: markingMode === 'detailed' ? formData.breakStart : null,
            breakEnd: markingMode === 'detailed' ? formData.breakEnd : null,
            notes: formData.notes,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark attendance');
      }

      const result = await response.json();
      toast.success(`Attendance marked successfully! Payment: ₹${result.attendance.totalPayment.toFixed(2)}`);
      setIsDialogOpen(false);
      resetForm();
      fetchAttendance();
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  // Calculate live preview
  const calculatePreview = () => {
    const worker = workers.find(w => w.id === formData.workerId);
    if (!worker) return null;

    // Assuming worker has dailyWage property
    const dailyWage = worker.dailyWage || 500;

    if (markingMode === 'quick') {
      if (formData.status === 'present') {
        return {
          hours: 8,
          overtime: 0,
          payment: dailyWage,
          status: 'Full Day (8 hours)'
        };
      } else if (formData.status === 'half-day') {
        return {
          hours: 4,
          overtime: 0,
          payment: dailyWage * 0.5,
          status: 'Half Day (4 hours)'
        };
      } else {
        return {
          hours: 0,
          overtime: 0,
          payment: 0,
          status: 'Absent'
        };
      }
    } else {
      // Detailed mode calculations
      if (!formData.checkIn || !formData.checkOut) return null;
      
      const checkIn = new Date(`2000-01-01T${formData.checkIn}`);
      const checkOut = new Date(`2000-01-01T${formData.checkOut}`);
      let totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      
      let breakHours = 0;
      if (formData.breakStart && formData.breakEnd) {
        const breakStart = new Date(`2000-01-01T${formData.breakStart}`);
        const breakEnd = new Date(`2000-01-01T${formData.breakEnd}`);
        breakHours = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
      }
      
      const netHours = Math.max(0, totalHours - breakHours);
      const regularHours = Math.min(8, netHours);
      const overtime = Math.max(0, netHours - 8);
      
      const hourlyRate = dailyWage / 8;
      const overtimeRate = hourlyRate * 1.5;
      const payment = (regularHours * hourlyRate) + (overtime * overtimeRate);
      
      let status = 'Absent';
      if (netHours >= 8) status = 'Full Day';
      else if (netHours >= 4) status = 'Half Day';
      else if (netHours > 0) status = 'Partial';
      
      return {
        hours: regularHours,
        overtime,
        payment,
        status,
        totalHours,
        netHours,
        breakHours
      };
    }
  };

  const preview = calculatePreview();

  const handleApplySiteBreak = async () => {
    if (!selectedSite || !selectedDate) {
      toast.error('Please select a site and date');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/apply-break`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            siteId: selectedSite,
            date: selectedDate,
            breakStart: siteBreakTime.breakStart,
            breakEnd: siteBreakTime.breakEnd,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply break hours');
      }

      const result = await response.json();
      toast.success(result.message || 'Break hours applied successfully');
      setBreakDialogOpen(false);
      fetchAttendance();
    } catch (error: any) {
      console.error('Error applying break hours:', error);
      toast.error(error.message || 'Failed to apply break hours');
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
      toast.success(result.message || 'All attendance records cleared');
      fetchAttendance();
    } catch (error: any) {
      console.error('Error clearing attendance:', error);
      toast.error(error.message || 'Failed to clear attendance records');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      workerId: '',
      siteId: selectedSite,
      date: selectedDate,
      status: 'present',
      checkIn: '',
      checkOut: '',
      breakStart: '',
      breakEnd: '',
      notes: '',
    });
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker?.name || 'Unknown';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'half-day':
        return <MinusCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-700">Present</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-700">Absent</Badge>;
      case 'half-day':
        return <Badge className="bg-yellow-100 text-yellow-700">Half Day</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Attendance</CardTitle>
              <CardDescription>Mark and track worker attendance</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Mark Attendance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark Attendance</DialogTitle>
                  <DialogDescription>
                    Record worker attendance for the day
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="worker">Worker *</Label>
                    <Select
                      value={formData.workerId}
                      onValueChange={(value) => setFormData({ ...formData, workerId: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {workers.map(worker => (
                          <SelectItem key={worker.id} value={worker.id}>
                            {worker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="site">Site *</Label>
                    <Select
                      value={formData.siteId}
                      onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                      required
                    >
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

                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="half-day">Half Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkIn">Check In</Label>
                      <Input
                        id="checkIn"
                        type="time"
                        value={formData.checkIn}
                        onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkOut">Check Out</Label>
                      <Input
                        id="checkOut"
                        type="time"
                        value={formData.checkOut}
                        onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="breakStart">Break Start</Label>
                      <Input
                        id="breakStart"
                        type="time"
                        value={formData.breakStart}
                        onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="breakEnd">Break End</Label>
                      <Input
                        id="breakEnd"
                        type="time"
                        value={formData.breakEnd}
                        onChange={(e) => setFormData({ ...formData, breakEnd: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : 'Mark Attendance'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterDate">Date</Label>
              <Input
                id="filterDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterSite">Site</Label>
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
          </div>

          {selectedSite && attendance.length > 0 && (
            <div className="flex justify-end">
              <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Timer className="w-4 h-4 mr-2" />
                    Apply Break to All
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Apply Break Hours to Site</DialogTitle>
                    <DialogDescription>
                      Set break hours for all workers on this site for {selectedDate}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        This will update break times for all {attendance.length} attendance record(s) and recalculate payments automatically.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="siteBreakStart">Break Start</Label>
                        <Input
                          id="siteBreakStart"
                          type="time"
                          value={siteBreakTime.breakStart}
                          onChange={(e) => setSiteBreakTime({...siteBreakTime, breakStart: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siteBreakEnd">Break End</Label>
                        <Input
                          id="siteBreakEnd"
                          type="time"
                          value={siteBreakTime.breakEnd}
                          onChange={(e) => setSiteBreakTime({ ...siteBreakTime, breakEnd: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBreakDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleApplySiteBreak} disabled={loading}>
                        {loading ? 'Applying...' : 'Apply Break Hours'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {!selectedSite ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a site to view attendance</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No attendance records found</p>
              <p className="text-sm">Mark attendance to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.map(record => (
                <Card key={record.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(record.status)}
                        <div>
                          <p>{getWorkerName(record.workerId)}</p>
                          {record.checkIn && record.checkOut && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {record.checkIn} - {record.checkOut}
                              {record.workHours > 0 && ` (${record.workHours.toFixed(1)}h)`}
                              {record.overtime > 0 && ` +${record.overtime.toFixed(1)}h OT`}
                            </p>
                          )}
                          {record.notes && (
                            <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Clear All Attendance Button (for testing) */}
          <div className="flex justify-center pt-6 border-t">
            <Button 
              variant="destructive" 
              onClick={handleClearAllAttendance}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Attendance (Testing)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}