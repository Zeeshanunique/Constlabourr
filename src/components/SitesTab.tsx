import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Plus, MapPin, Calendar, Building2, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface Site {
  id: string;
  name: string;
  address: string;
  startDate: string;
  endDate?: string;
  status: string;
  foremanId?: string;
}

interface SitesTabProps {
  accessToken: string;
}

export function SitesTab({ accessToken }: SitesTabProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'active',
  });

  useEffect(() => {
    fetchSites();
  }, []);

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
      toast.error('Failed to fetch sites');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingSite
        ? `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites/${editingSite.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites`;

      const response = await fetch(url, {
        method: editingSite ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          status: formData.status,
        }),
      });

      if (!response.ok) throw new Error(`Failed to ${editingSite ? 'update' : 'create'} site`);

      toast.success(`Site ${editingSite ? 'updated' : 'created'} successfully`);
      setIsDialogOpen(false);
      resetForm();
      fetchSites();
    } catch (error) {
      console.error('Error saving site:', error);
      toast.error(`Failed to ${editingSite ? 'update' : 'create'} site`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      address: site.address,
      startDate: site.startDate,
      endDate: site.endDate || '',
      status: site.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (site: Site) => {
    setSiteToDelete(site);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      status: 'active',
    });
    setEditingSite(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Sites</CardTitle>
              <CardDescription>Manage your construction sites</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Site
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSite ? 'Edit Site' : 'Add New Site'}</DialogTitle>
                  <DialogDescription>
                    {editingSite ? 'Update site details' : 'Create a new construction site'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Site Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Sunrise Apartments"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Full site address"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      />
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
                      {loading ? 'Saving...' : editingSite ? 'Update Site' : 'Create Site'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No sites found</p>
              <p className="text-sm">Add your first site to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map(site => (
                <Card key={site.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{site.name}</CardTitle>
                        <CardDescription className="text-sm mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{site.address}</span>
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant={site.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                          {site.status}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(site)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="w-3 h-3 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(site)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Started: {formatDate(site.startDate)}</span>
                    </div>
                    {site.endDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Ends: {formatDate(site.endDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}</div>
          )}
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (!siteToDelete) return;
          try {
            setLoading(true);
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-689d7d60/sites/${siteToDelete.id}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (!response.ok) throw new Error('Failed to delete site');

            toast.success('Site deleted successfully');
            setDeleteDialogOpen(false);
            setSiteToDelete(null);
            fetchSites();
          } catch (error) {
            console.error('Error deleting site:', error);
            toast.error('Failed to delete site');
          } finally {
            setLoading(false);
          }
        }}
        title="Delete Site"
        description="Are you sure you want to delete this site? All attendance and payroll records associated with this site will remain but will show as archived."
        itemName={siteToDelete?.name}
        isLoading={loading}
      />
    </div>
  );
}