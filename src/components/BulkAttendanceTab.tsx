import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Users, CheckCircle2, XCircle, Search, Calendar, Save, Trash2 } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface BulkAttendanceTabProps {
  accessToken: string;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  siteId: string;
  siteName?: string;
}

interface Site {
  id: string;
  name: string;
}

interface AttendanceEntry {
  workerId: string;
  status: 'present' | 'absent' | 'half-day';
  checkIn?: string;
  checkOut?: string;
}

export function BulkAttendanceTab({ accessToken }: BulkAttendanceTabProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendance, setAttendance] = useState<Map<string, AttendanceEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWorkers();
    fetchSites();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch workers');
      
      const data = await response.json();
      setWorkers(data.workers || []);
      
      // Initialize all as absent by default
      const initialAttendance = new Map();
      (data.workers || []).forEach((worker: Worker) => {
        initialAttendance.set(worker.id, {
          workerId: worker.id,
          status: 'absent',
        });
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error('Failed to load workers');
    }
  };

  const fetchSites = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch sites');
      
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const updateAttendance = (workerId: string, status: 'present' | 'absent' | 'half-day') => {
    const newAttendance = new Map(attendance);
    const currentEntry = newAttendance.get(workerId) || { workerId, status: 'absent' };
    
    newAttendance.set(workerId, {
      ...currentEntry,
      status,
      checkIn: status === 'present' || status === 'half-day' ? '09:00' : undefined,
      checkOut: status === 'present' ? '18:00' : status === 'half-day' ? '13:00' : undefined,
    });
    
    setAttendance(newAttendance);
  };

  const markAllPresent = () => {
    const newAttendance = new Map(attendance);
    filteredWorkers.forEach(worker => {
      newAttendance.set(worker.id, {
        workerId: worker.id,
        status: 'present',
        checkIn: '09:00',
        checkOut: '18:00',
      });
    });
    setAttendance(newAttendance);
    toast.success(`Marked ${filteredWorkers.length} workers as present`);
  };

  const markAllAbsent = () => {
    const newAttendance = new Map(attendance);
    filteredWorkers.forEach(worker => {
      newAttendance.set(worker.id, {
        workerId: worker.id,
        status: 'absent',
      });
    });
    setAttendance(newAttendance);
    toast.success(`Marked ${filteredWorkers.length} workers as absent`);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const attendanceRecords = Array.from(attendance.values()).map(entry => ({
        workerId: entry.workerId,
        date: selectedDate,
        status: entry.status,
        checkIn: entry.checkIn,
        checkOut: entry.checkOut,
      }));

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/attendance/bulk`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            records: attendanceRecords,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save attendance');

      const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
      const halfDayCount = attendanceRecords.filter(r => r.status === 'half-day').length;
      const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;

      toast.success(
        `Attendance saved! Present: ${presentCount}, Half-day: ${halfDayCount}, Absent: ${absentCount}`
      );
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
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
      toast.success(`${result.message}\\n\\nGo to Home tab to see updated stats!`, { duration: 6000 });
    } catch (error: any) {
      console.error('Error clearing attendance:', error);
      toast.error(error.message || 'Failed to clear attendance records');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.phone.includes(searchTerm);
    const matchesSite = selectedSite === 'all' || worker.siteId === selectedSite;
    return matchesSearch && matchesSite;
  });

  const presentCount = Array.from(attendance.values()).filter(a => a.status === 'present').length;
  const halfDayCount = Array.from(attendance.values()).filter(a => a.status === 'half-day').length;
  const absentCount = Array.from(attendance.values()).filter(a => a.status === 'absent').length;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl text-green-600">{presentCount}</div>
            <div className="text-xs text-gray-600">Present</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl text-orange-600">{halfDayCount}</div>
            <div className="text-xs text-gray-600">Half-day</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl text-red-600">{absentCount}</div>
            <div className="text-xs text-gray-600">Absent</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
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

          <div>
            <Label htmlFor="site">Filter by Site</Label>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="search">Search Workers</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              onClick={markAllPresent}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
              All Present
            </Button>
            <Button
              onClick={markAllAbsent}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <XCircle className="w-4 h-4 mr-2 text-red-600" />
              All Absent
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workers List */}
      <div className="space-y-2">
        {filteredWorkers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No workers found</p>
            </CardContent>
          </Card>
        ) : (
          filteredWorkers.map((worker) => {
            const entry = attendance.get(worker.id);
            const status = entry?.status || 'absent';
            
            return (
              <Card key={worker.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 truncate">{worker.name}</p>
                      <p className="text-xs text-gray-600">{worker.siteName || 'No site'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => updateAttendance(worker.id, 'present')}
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          status === 'present'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => updateAttendance(worker.id, 'half-day')}
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          status === 'half-day'
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Half
                      </button>
                      <button
                        onClick={() => updateAttendance(worker.id, 'absent')}
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          status === 'absent'
                            ? 'bg-red-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Save Button */}
      {filteredWorkers.length > 0 && (
        <div className="sticky bottom-20 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Saving...' : `Save Attendance (${filteredWorkers.length} workers)`}
          </Button>
        </div>
      )}

      {/* Clear All Attendance Button */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
        <Button
          onClick={handleClearAllAttendance}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700"
          size="lg"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          {loading ? 'Clearing...' : 'Clear All Attendance'}
        </Button>
      </div>
    </div>
  );
}