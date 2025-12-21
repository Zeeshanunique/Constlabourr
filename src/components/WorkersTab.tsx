import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Search, Edit2, UserCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface Worker {
  id: string;
  name: string;
  phone: string;
  skillLevel: string;
  dailyWage: number;
  messCharge?: number;
  status: string;
  siteId?: string;
}

interface Site {
  id: string;
  name: string;
}

interface WorkersTabProps {
  accessToken: string;
}

export function WorkersTab({ accessToken }: WorkersTabProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    aadhaar: '',
    skillLevel: 'unskilled',
    dailyWage: '',
    messCharge: '',
    siteId: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });

  useEffect(() => {
    fetchWorkers();
    fetchSites();
  }, []);

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
      toast.error('Failed to fetch workers');
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
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const workerData: any = {
        name: formData.name,
        phone: formData.phone,
        aadhaar: formData.aadhaar,
        skillLevel: formData.skillLevel,
        dailyWage: parseFloat(formData.dailyWage),
        messCharge: formData.messCharge ? parseFloat(formData.messCharge) : 0,
        siteId: formData.siteId && formData.siteId !== 'none' ? formData.siteId : null,
        bankDetails: {
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
        },
      };

      // Include email and password for new workers
      if (!editingWorker) {
        workerData.email = formData.email;
        workerData.password = formData.password;
      }

      // Include password if provided for editing
      if (editingWorker && formData.password) {
        workerData.password = formData.password;
      }

      const url = editingWorker
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${editingWorker.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers`;

      const response = await fetch(url, {
        method: editingWorker ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(workerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save worker');
      }

      toast.success(editingWorker ? 'Worker updated successfully' : 'Worker created successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchWorkers();
    } catch (error: any) {
      console.error('Error saving worker:', error);
      toast.error(error.message || 'Failed to save worker');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      aadhaar: '',
      skillLevel: 'unskilled',
      dailyWage: '',
      messCharge: '',
      siteId: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    });
    setEditingWorker(null);
  };

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name,
      email: '',
      password: '',
      phone: worker.phone,
      aadhaar: '',
      skillLevel: worker.skillLevel,
      dailyWage: worker.dailyWage.toString(),
      messCharge: worker.messCharge ? worker.messCharge.toString() : '',
      siteId: worker.siteId || '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!workerToDelete) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/workers/${workerToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete worker');

      toast.success('Worker deleted successfully');
      setDeleteDialogOpen(false);
      setWorkerToDelete(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast.error('Failed to delete worker');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Worker"
        description="Are you sure you want to delete this worker? All associated attendance and payroll records will remain but will show as archived."
        itemName={workerToDelete?.name}
        isLoading={loading}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Workers</CardTitle>
              <CardDescription>Manage your labour workforce</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Worker
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingWorker ? 'Edit Worker' : 'Add New Worker'}</DialogTitle>
                  <DialogDescription>
                    Enter worker details to {editingWorker ? 'update' : 'create'} their profile
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="worker@example.com"
                        required={!editingWorker}
                        disabled={!!editingWorker}
                      />
                      {editingWorker && (
                        <p className="text-xs text-gray-500">Email cannot be changed after creation</p>
                      )}
                    </div>
                    {!editingWorker && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Minimum 6 characters"
                          required
                          minLength={6}
                        />
                      </div>
                    )}
                    {editingWorker && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="password">New Password (optional)</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Leave blank to keep current password"
                          minLength={6}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="aadhaar">Aadhaar Number</Label>
                      <Input
                        id="aadhaar"
                        value={formData.aadhaar}
                        onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                        placeholder="XXXX XXXX XXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skillLevel">Skill Level *</Label>
                      <Select
                        value={formData.skillLevel}
                        onValueChange={(value) => setFormData({ ...formData, skillLevel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unskilled">Unskilled</SelectItem>
                          <SelectItem value="semi-skilled">Semi-Skilled</SelectItem>
                          <SelectItem value="skilled">Skilled</SelectItem>
                          <SelectItem value="highly-skilled">Highly Skilled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dailyWage">Daily Wage (₹) *</Label>
                      <Input
                        id="dailyWage"
                        type="number"
                        value={formData.dailyWage}
                        onChange={(e) => setFormData({ ...formData, dailyWage: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="messCharge">Daily Mess Charge (₹)</Label>
                      <Input
                        id="messCharge"
                        type="number"
                        value={formData.messCharge}
                        onChange={(e) => setFormData({ ...formData, messCharge: e.target.value })}
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500">Deducted from payroll when present</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siteId">Assign to Site</Label>
                      <Select
                        value={formData.siteId}
                        onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No site</SelectItem>
                          {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="mb-4 text-gray-900">Bank Details (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input
                          id="accountNumber"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="ifscCode">IFSC Code</Label>
                        <Input
                          id="ifscCode"
                          value={formData.ifscCode}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                        />
                      </div>
                    </div>
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
                      {loading ? 'Saving...' : editingWorker ? 'Update Worker' : 'Create Worker'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredWorkers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No workers found</p>
              <p className="text-sm">Add your first worker to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkers.map(worker => (
                <Card key={worker.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{worker.name}</CardTitle>
                        <CardDescription className="text-sm">{worker.phone}</CardDescription>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(worker)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setWorkerToDelete(worker);
                            setDeleteDialogOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Skill Level:</span>
                      <Badge variant="secondary" className="capitalize">
                        {worker.skillLevel.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Daily Wage:</span>
                      <span>₹{worker.dailyWage}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant={worker.status === 'active' ? 'default' : 'secondary'}>
                        {worker.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}