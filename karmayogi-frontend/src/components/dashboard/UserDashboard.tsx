'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Layout, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TemplateGallery } from '@/components/TemplateGallery';

type ViewTab = 'kanban' | 'templates' | 'scheduler';

export function UserDashboard() {
  const [activeTab, setActiveTab] = useState<ViewTab>('kanban');

  const tabs = [
    { id: 'kanban' as ViewTab, label: 'Kanban Board', icon: Layout },
    { id: 'templates' as ViewTab, label: 'Templates', icon: FileText },
    { id: 'scheduler' as ViewTab, label: 'Scheduler', icon: Calendar },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
            <p className="text-slate-400">Manage your tasks and workflows</p>
          </div>
          <Link href="/jobs/submit">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-medium">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-yellow-500 text-slate-900 font-medium'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'templates' && (
          <div className="h-full overflow-auto">
            <TemplateGallery />
          </div>
        )}
        {activeTab === 'scheduler' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Calendar className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Job Scheduler</p>
              <p className="text-slate-500 text-sm mt-2">Coming soon - Schedule jobs for future execution</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
