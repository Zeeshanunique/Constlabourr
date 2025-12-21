import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserCircle, Plus, Phone, MapPin, Edit, Trash2, Search } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ForemenTabProps {
  accessToken: string;
}

interface Foreman {
  id: string;
  name: string;
  phone: string;
  siteId?: string;
  siteName?: string;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
}

export function ForemenTab({ accessToken }: ForemenTabProps) {
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingForeman, setEditingForeman] = useState<Foreman | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    siteId: '',
  });

  useEffect(() => {
    fetchForemen();
    fetchSites();
  }, []);

  const fetchForemen = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch foremen');
      
      const data = await response.json();
      setForemen(data.foremen || []);
    } catch (error) {
      console.error('Error fetching foremen:', error);
      toast.error('Failed to load foremen');
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const url = editingForeman
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen/${editingForeman.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen`;

      const response = await fetch(url, {
        method: editingForeman ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          siteId: formData.siteId && formData.siteId !== 'none' ? formData.siteId : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save foreman');
      }

      toast.success(editingForeman ? 'Foreman updated successfully' : 'Foreman created successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchForemen();
    } catch (error) {
      console.error('Error saving foreman:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save foreman');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (foreman: Foreman) => {
    setEditingForeman(foreman);
    setFormData({
      name: foreman.name,
      phone: foreman.phone,
      email: '',
      password: '',
      siteId: foreman.siteId || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this foreman?')) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/foremen/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete foreman');

      toast.success('Foreman deleted successfully');
      fetchForemen();
    } catch (error) {
      console.error('Error deleting foreman:', error);
      toast.error('Failed to delete foreman');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      siteId: '',
    });
    setEditingForeman(null);
  };

  const filteredForemen = foremen.filter(foreman =>
    foreman.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    foreman.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search foremen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Foreman
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingForeman ? 'Edit Foreman' : 'Add New Foreman'}</DialogTitle>
              <DialogDescription>
                {editingForeman ? 'Update foreman details' : 'Create a new foreman account'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div>
                <Label htmlFor="site">Assign to Site (Optional)</Label>
                <Select value={formData.siteId} onValueChange={(value) => setFormData({ ...formData, siteId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No site assigned</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {loading ? 'Saving...' : editingForeman ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Foremen List */}
      <div className="space-y-3">
        {loading && foremen.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Loading foremen...
            </CardContent>
          </Card>
        ) : filteredForemen.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UserCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">
                {searchTerm ? 'No foremen found matching your search' : 'No foremen added yet'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Foreman
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredForemen.map((foreman) => (
            <Card key={foreman.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <UserCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 truncate">{foreman.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{foreman.phone}</span>
                      </div>
                      {foreman.siteName && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{foreman.siteName}</span>
                        </div>
                      )}
                      {!foreman.siteName && (
                        <div className="text-sm text-gray-400 mt-1">
                          No site assigned
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(foreman)}
                      className="h-9 w-9 p-0"
                    >
                      <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(foreman.id)}
                      className="h-9 w-9 p-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}