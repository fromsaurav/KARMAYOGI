'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  FileText,
  Star,
  Search,
  Plus,
  Trash2,
  Edit,
  Play,
  Filter,
  Tag,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

interface Template {
  id: string;
  name: string;
  description?: string;
  jobType: string;
  priority: string;
  config: any;
  tags: string[];
  isPublic: boolean;
  usageCount: number;
  isFavorite: boolean;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const TemplateGallery = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobType, setSelectedJobType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'mine'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, selectedJobType, viewMode, templates]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getTemplates();
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Filter by view mode
    if (viewMode === 'favorites') {
      filtered = filtered.filter(t => t.isFavorite);
    } else if (viewMode === 'mine') {
      filtered = filtered.filter(t => t.user.id === user?.userId);
    }

    // Filter by job type
    if (selectedJobType !== 'all') {
      filtered = filtered.filter(t => t.jobType === selectedJobType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleToggleFavorite = async (templateId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await apiClient.removeTemplateFromFavorites(templateId);
      } else {
        await apiClient.addTemplateToFavorites(templateId);
      }
      // Update local state
      setTemplates(prev => prev.map(t =>
        t.id === templateId ? { ...t, isFavorite: !isFavorite } : t
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    try {
      const response = await apiClient.createJobFromTemplate(templateId);
      alert(`Job created successfully: ${response.data.id}`);
      // Update usage count
      setTemplates(prev => prev.map(t =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t
      ));
    } catch (error) {
      console.error('Failed to use template:', error);
      alert('Failed to create job from template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await apiClient.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const jobTypes = ['all', 'FILE_PROCESSING', 'DATA_ANALYTICS', 'EMAIL_TASK', 'API_INTEGRATION', 'CUSTOM_SCRIPT'];

  const priorityColors = {
    HIGH: 'text-red-400 bg-red-500/20',
    MEDIUM: 'text-yellow-400 bg-yellow-500/20',
    LOW: 'text-green-400 bg-green-500/20'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Template Gallery</h2>
          <p className="text-slate-400">Browse and use reusable job templates</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-yellow-500 hover:bg-yellow-600">
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Job Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={selectedJobType}
              onChange={(e) => setSelectedJobType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-yellow-500 appearance-none"
            >
              {jobTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              onClick={() => setViewMode('all')}
              className="flex-1"
            >
              All
            </Button>
            <Button
              variant={viewMode === 'favorites' ? 'default' : 'outline'}
              onClick={() => setViewMode('favorites')}
              className="flex-1"
            >
              <Star className="mr-1 h-4 w-4" />
              Favorites
            </Button>
            <Button
              variant={viewMode === 'mine' ? 'default' : 'outline'}
              onClick={() => setViewMode('mine')}
              className="flex-1"
            >
              Mine
            </Button>
          </div>
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-yellow-500" />
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-1">
                      {template.description || 'No description'}
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(template.id, template.isFavorite)}
                    className={`p-1 rounded transition-colors ${
                      template.isFavorite
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-slate-500 hover:text-yellow-500'
                    }`}
                  >
                    <Star className={`h-5 w-5 ${template.isFavorite ? 'fill-yellow-500' : ''}`} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {template.jobType.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded border ${priorityColors[template.priority as keyof typeof priorityColors]}`}>
                    {template.priority}
                  </span>
                  {template.isPublic && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                      Public
                    </span>
                  )}
                </div>

                {/* Tags */}
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    <span>{template.usageCount} uses</span>
                  </div>
                  <span className="text-xs">by {template.user.fullName}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-700">
                  <Button
                    onClick={() => handleUseTemplate(template.id)}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                  >
                    <Play className="mr-1 h-4 w-4" />
                    Use
                  </Button>

                  {template.user.id === user?.userId && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {/* TODO: Edit modal */}}
                        className="border-slate-600 hover:border-slate-500"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
          <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No templates found</p>
          <p className="text-slate-500 text-sm mt-2">
            {viewMode === 'favorites'
              ? 'You haven\'t favorited any templates yet'
              : viewMode === 'mine'
              ? 'You haven\'t created any templates yet'
              : 'Try adjusting your filters or create a new template'}
          </p>
        </div>
      )}
    </div>
  );
};
