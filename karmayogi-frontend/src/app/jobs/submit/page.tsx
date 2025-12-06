'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { JobType } from '@/types';
import { JOB_TYPE_LABELS, JOB_TYPE_DESCRIPTIONS } from '@/constants';
import { useJobStore } from '@/stores/jobStore';
import {
  FileText,
  BarChart3,
  Mail,
  Plug,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

const jobSchema = z.object({
  type: z.nativeEnum(JobType),
  data: z.string().min(1, 'Job data is required'),
  priority: z.number().min(1).max(10),
});

type JobForm = z.infer<typeof jobSchema>;

interface JobTypeCardProps {
  type: JobType;
  isSelected: boolean;
  onSelect: (type: JobType) => void;
}

const jobTypeIcons = {
  [JobType.FILE_PROCESSING]: FileText,
  [JobType.DATA_ANALYTICS]: BarChart3,
  [JobType.EMAIL_TASK]: Mail,
  [JobType.API_INTEGRATION]: Plug,
  [JobType.CUSTOM_SCRIPT]: Code,
};

const jobTypeColors = {
  [JobType.FILE_PROCESSING]: 'from-blue-500 to-blue-600',
  [JobType.DATA_ANALYTICS]: 'from-purple-500 to-purple-600',
  [JobType.EMAIL_TASK]: 'from-green-500 to-green-600',
  [JobType.API_INTEGRATION]: 'from-orange-500 to-orange-600',
  [JobType.CUSTOM_SCRIPT]: 'from-pink-500 to-pink-600',
};

function JobTypeCard({ type, isSelected, onSelect }: JobTypeCardProps) {
  const Icon = jobTypeIcons[type];
  const colorGradient = jobTypeColors[type];

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-yellow-500 bg-slate-700 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
          : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
      }`}
      onClick={() => onSelect(type)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorGradient}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base text-slate-100 mb-1">
              {JOB_TYPE_LABELS[type]}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {JOB_TYPE_DESCRIPTIONS[type]}
            </CardDescription>
          </div>
          {isSelected && (
            <CheckCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

const jobTemplates = {
  [JobType.FILE_PROCESSING]: JSON.stringify({
    action: "compress",
    inputFile: "example.jpg",
    quality: 85,
    format: "webp"
  }, null, 2),

  [JobType.DATA_ANALYTICS]: JSON.stringify({
    csvFile: "data.csv",
    analysis: "correlation",
    columns: ["price", "sales", "revenue"]
  }, null, 2),

  [JobType.EMAIL_TASK]: JSON.stringify({
    recipients: ["user1@example.com", "user2@example.com"],
    subject: "Newsletter Update",
    template: "newsletter_template",
    variables: {
      name: "{{name}}",
      company: "{{company}}"
    }
  }, null, 2),

  [JobType.API_INTEGRATION]: JSON.stringify({
    endpoint: "https://api.example.com/data",
    method: "POST",
    headers: {
      "Authorization": "Bearer TOKEN",
      "Content-Type": "application/json"
    },
    payload: {
      key: "value"
    }
  }, null, 2),

  [JobType.CUSTOM_SCRIPT]: JSON.stringify({
    code: `
// Your JavaScript code here
function processData(input) {
  console.log('Processing:', input);
  return input.toUpperCase();
}

// Return result
return processData(data);
    `.trim()
  }, null, 2)
};

export default function JobSubmitPage() {
  const router = useRouter();
  const { submitJob, isLoading } = useJobStore();
  const [selectedType, setSelectedType] = useState<JobType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      priority: 5,
    },
  });

  const watchedData = watch('data');
  const watchedPriority = watch('priority');

  const handleTypeSelect = (type: JobType) => {
    setSelectedType(type);
    setValue('type', type);
    setValue('data', jobTemplates[type]);
  };

  const onSubmit = async (data: JobForm) => {
    try {
      setError(null);
      setSuccess(null);

      let parsedData;
      try {
        parsedData = JSON.parse(data.data);
      } catch {
        parsedData = { raw: data.data };
      }

      const job = await submitJob({
        type: data.type,
        data: parsedData,
        priority: data.priority,
      });

      setSuccess(`Job submitted successfully! ID: ${job.id}`);

      setTimeout(() => {
        router.push('/jobs');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit job');
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-400';
    if (priority >= 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High Priority';
    if (priority >= 5) return 'Medium Priority';
    return 'Low Priority';
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">Submit New Job</h1>
            <p className="text-slate-400 mt-1">
              Choose a job type and configure the execution parameters
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Job Type Selection */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-slate-100 text-xl">1. Select Job Type</CardTitle>
              <CardDescription className="text-slate-400">
                Choose the type of job you want to execute
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.values(JobType).map((type) => (
                  <JobTypeCard
                    key={type}
                    type={type}
                    isSelected={selectedType === type}
                    onSelect={handleTypeSelect}
                  />
                ))}
              </div>
              {errors.type && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-red-400">Please select a job type</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Configuration */}
          {selectedType && (
            <>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="border-b border-slate-700">
                  <CardTitle className="text-slate-100 text-xl">2. Configure Job Settings</CardTitle>
                  <CardDescription className="text-slate-400">
                    Set priority and customize parameters for your {JOB_TYPE_LABELS[selectedType]} job
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Priority Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="priority" className="text-slate-300 text-base font-semibold">
                        Job Priority
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getPriorityColor(watchedPriority || 5)}`}>
                          {watchedPriority || 5}
                        </span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          (watchedPriority || 5) >= 8 ? 'bg-red-500/20 text-red-400' :
                          (watchedPriority || 5) >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {getPriorityLabel(watchedPriority || 5)}
                        </span>
                      </div>
                    </div>
                    <Input
                      id="priority"
                      type="range"
                      min="1"
                      max="10"
                      {...register('priority', { valueAsNumber: true })}
                      className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>1 (Lowest)</span>
                      <span>5 (Medium)</span>
                      <span>10 (Highest)</span>
                    </div>
                    {errors.priority && (
                      <p className="text-sm text-red-400">{errors.priority.message}</p>
                    )}
                    <p className="text-sm text-slate-400 bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                      💡 Higher priority jobs are processed first. Use priority 8-10 for urgent tasks.
                    </p>
                  </div>

                  {/* Job Data Textarea */}
                  <div className="space-y-3">
                    <Label htmlFor="data" className="text-slate-300 text-base font-semibold">
                      Job Configuration (JSON)
                    </Label>
                    <div className="relative">
                      <textarea
                        id="data"
                        rows={14}
                        {...register('data')}
                        className={`w-full px-4 py-3 bg-slate-900 border-2 rounded-lg font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all ${
                          errors.data ? 'border-red-500' : 'border-slate-600 hover:border-slate-500'
                        }`}
                        placeholder="Enter job configuration in JSON format..."
                      />
                      <div className="absolute top-3 right-3 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                        JSON
                      </div>
                    </div>
                    {errors.data && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <p className="text-sm text-red-400">{errors.data.message}</p>
                      </div>
                    )}
                    <p className="text-sm text-slate-400 bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                      📝 Modify the template above according to your needs. Ensure valid JSON format.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Section */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-400">
                      <p className="font-medium text-slate-300 mb-1">Ready to submit?</p>
                      <p>Your job will be queued and processed by available workers.</p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading || !selectedType}
                        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold px-6"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Submit Job
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </form>

        {/* Success Message */}
        {success && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-green-400 font-medium">Success!</p>
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-medium">Error</p>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
