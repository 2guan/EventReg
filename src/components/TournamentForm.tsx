import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Save, AlertCircle, FileText, Plus, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// 活动状态类型
type TournamentStatus = 'pre-registration' | 'registration' | 'finished-pending' | 'finished-completed' | 'cancelled';

// 活动表单数据接口
export interface TournamentFormData {
  id?: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  duration?: string;
  maxPlayers: number;
  description: string;
  descriptionImages?: string[]; // 新增：描述图片
  rules: string[];
  organizer?: string;
  contactInfo?: string;
  status: TournamentStatus;
  isPopular?: boolean;
  maxWaitlist?: number;
  maxFieldPlayers?: number;
  totalCost?: number;
  costNote?: string;
  image?: string;
  proxyLimit?: number;
  visibility?: 'public' | 'user_hidden' | 'fully_hidden';
}

// 表单验证模式
const tournamentFormSchema = z.object({
  name: z.string().min(2, '活动名称至少2个字符').max(50, '活动名称最多50个字符'),
  startDateTime: z.string().min(1, '请选择开始时间'),
  endDateTime: z.string().min(1, '请选择结束时间'),
  location: z.string().min(2, '请输入活动地点'),
  maxPlayers: z.number().min(2, '最少需要2人').max(200, '最多200人'),
  description: z.string().min(5, '活动描述至少5个字符'),
  rules: z.array(z.string()).optional(),
  organizer: z.string().optional(),
  contactInfo: z.string().optional(),
  maxWaitlist: z.number().optional(),
  maxFieldPlayers: z.number().optional(),
  totalCost: z.number().optional(),
  image: z.string().optional(),
  proxyLimit: z.number().min(0, '代报名限制不能小于0').max(50, '最多代报50人'),
  visibility: z.enum(['public', 'user_hidden', 'fully_hidden']).optional()
});

interface TournamentFormProps {
  initialData?: TournamentFormData;
  onSubmit: (data: TournamentFormData) => void;
  onCancel: () => void;
}

interface BannerItem {
  id: number;
  isCustom: boolean;
  filename: string;
  url: string;
  exists: boolean;
}

const TournamentForm: React.FC<TournamentFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = React.useState<TournamentFormData>({
    id: '',
    name: '',
    startDateTime: '',
    endDateTime: '',
    location: '',
    duration: '',
    maxPlayers: 20,
    description: '',
    descriptionImages: [],
    rules: [''],
    organizer: '',
    contactInfo: '',
    status: 'pre-registration',
    isPopular: false,
    maxWaitlist: 5,
    maxFieldPlayers: 10,
    totalCost: 0,
    costNote: '',
    image: '/sportsreg/banner/defaultbanner-01.jpg',
    proxyLimit: 2,
    visibility: 'public'
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showBannerSelector, setShowBannerSelector] = React.useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);
  const [recentActivities, setRecentActivities] = React.useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化表单数据
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        descriptionImages: initialData.descriptionImages || []
      });
    }
  }, [initialData]);

  // 加载 banners
  useEffect(() => {
    if (showBannerSelector && banners.length === 0) {
      api.get('/banners').then(data => {
        setBanners(data);
      }).catch(err => {
        console.error('Failed to load banners', err);
      });
    }
  }, [showBannerSelector]);

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...formData.rules];
    newRules[index] = value;
    setFormData(prev => ({ ...prev, rules: newRules }));
    if (errors.rules) setErrors(prev => ({ ...prev, rules: '' }));
  };

  const addRule = () => setFormData(prev => ({ ...prev, rules: [...prev.rules, ''] }));
  const removeRule = (index: number) => {
    if (formData.rules.length <= 1) return;
    setFormData(prev => ({ ...prev, rules: formData.rules.filter((_, i) => i !== index) }));
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));

          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.9;
          const compress = () => {
            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('Canvas to Blob failed'));
              if (blob.size > 1024 * 1024 && quality > 0.1) {
                quality -= 0.1;
                compress();
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              }
            }, 'image/jpeg', quality);
          };
          compress();
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const token = localStorage.getItem('token');
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedFile = await compressImage(file);
        
        const fd = new FormData();
        fd.append('image', compressedFile);

        const res = await fetch('/sportsreg/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });

        if (!res.ok) throw new Error('上传失败');
        const data = await res.json();
        uploadedUrls.push(data.url);
      }

      setFormData(prev => ({
        ...prev,
        descriptionImages: [...(prev.descriptionImages || []), ...uploadedUrls]
      }));
      toast.success('图片上传成功');
    } catch (err: any) {
      toast.error(err.message || '图片上传失败');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descriptionImages: (prev.descriptionImages || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validationData = {
        ...formData,
        maxPlayers: Number(formData.maxPlayers),
        maxWaitlist: Number(formData.maxWaitlist),
        maxFieldPlayers: Number(formData.maxFieldPlayers),
        totalCost: Number(formData.totalCost),
        proxyLimit: Number(formData.proxyLimit)
      };

      const nonEmptyRules = formData.rules.filter(rule => rule.trim() !== '');

      if (formData.status === 'pre-registration') {
        if (!formData.maxPlayers) throw new Error('预报名状态下，最大参与人数为必输项');
      } else if (formData.status === 'registration') {
        if (!formData.maxFieldPlayers) throw new Error('正式报名状态下，最大上场人数为必输项');
        if (formData.maxWaitlist === undefined || formData.maxWaitlist === null) throw new Error('正式报名状态下，最大候补人数为必输项');
      } else if (formData.status === 'finished-pending') {
        if (formData.totalCost === undefined || formData.totalCost === null) throw new Error('待结算状态下，本次参加总费用为必输项');
      }

      if (formData.maxPlayers && formData.maxFieldPlayers && formData.maxWaitlist !== undefined) {
        const maxPlayers = Number(formData.maxPlayers) || 0;
        const maxFieldPlayers = Number(formData.maxFieldPlayers) || 0;
        const maxWaitlist = Number(formData.maxWaitlist) || 0;
        if (maxFieldPlayers + maxWaitlist > maxPlayers) {
          throw new Error(`最大上场人数(${maxFieldPlayers}) + 最大候补人数(${maxWaitlist}) 不能超过最大参与人数(${maxPlayers})`);
        }
      }

      tournamentFormSchema.parse(validationData);

      setIsSubmitting(true);
      await new Promise(resolve => setTimeout(resolve, 800));

      onSubmit({
        ...formData,
        maxPlayers: Number(formData.maxPlayers),
        maxWaitlist: Number(formData.maxWaitlist),
        maxFieldPlayers: Number(formData.maxFieldPlayers),
        totalCost: Number(formData.totalCost),
        rules: nonEmptyRules,
        visibility: formData.visibility || 'public'
      });

      setIsSubmitting(false);

    } catch (error) {
      setIsSubmitting(false);
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) newErrors[err.path[0]] = err.message;
        });
        setErrors(newErrors);
      } else if (error instanceof Error) {
        setErrors({ form: error.message });
      } else {
        toast.error('提交失败，请重试');
      }
    }
  };

  const fetchRecentActivities = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/sportsreg/api/matches');
      const data = await response.json();
      setRecentActivities(data.slice(0, 10));
    } catch (error) {
      toast.error('获取活动列表失败');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const applyTemplate = (template: any) => {
    let config: any = {};
    try { config = JSON.parse(template.config_json || '{}'); } catch (e) {}

    setFormData(prev => ({
      ...prev,
      location: template.location || prev.location,
      maxPlayers: template.max_players || prev.maxPlayers,
      maxFieldPlayers: config.maxFieldPlayers || prev.maxFieldPlayers,
      maxWaitlist: config.maxWaitlist || prev.maxWaitlist,
      description: template.description || prev.description,
      descriptionImages: config.descriptionImages || prev.descriptionImages,
      rules: config.rules || prev.rules,
      organizer: config.organizer || prev.organizer,
      contactInfo: config.contactInfo || prev.contactInfo
    }));

    setShowTemplateSelector(false);
    toast.success('已应用模版');
  };

  const handleOpenTemplateSelector = () => {
    setShowTemplateSelector(true);
    fetchRecentActivities();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.form && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-300 p-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* 活动封面选择 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">选择活动封面 <span className="text-red-500">*</span></label>
          <button
            type="button"
            onClick={handleOpenTemplateSelector}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-red-500 dark:hover:border-red-500 rounded-lg transition-colors"
          >
            <FileText className="h-4 w-4" />
            选取模版
          </button>
        </div>

        <div
          onClick={() => setShowBannerSelector(true)}
          className="relative w-full h-32 md:h-40 rounded-xl overflow-hidden cursor-pointer group border-2 border-gray-200 dark:border-gray-700 hover:border-red-500 transition-all"
        >
          <img
            src={formData.image || '/sportsreg/banner/defaultbanner-01.jpg'}
            alt="Selected Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="bg-white/90 text-gray-800 px-4 py-2 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
              更换封面
            </div>
          </div>
        </div>

        {/* Banner Selection Modal */}
        {showBannerSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowBannerSelector(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">选择活动封面</h3>
                <button
                  onClick={() => setShowBannerSelector(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {banners.length === 0 ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                  {banners.map((banner, i) => {
                    const isSelected = formData.image === banner.url || formData.image === banner.url.replace('/sportsreg', '');
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, image: banner.url }));
                          setShowBannerSelector(false);
                        }}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-[16/6] ${isSelected ? 'border-red-500 ring-2 ring-red-200' : 'border-transparent hover:border-gray-300'}`}
                      >
                        <img src={banner.url} alt="Banner" className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <div className="bg-red-500 rounded-full p-0.5">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* 模版选择器... 与原来一致 */}
      {showTemplateSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateSelector(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">选择活动模版</h3>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-red-500" />
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">暂无可用的活动模版</div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => applyTemplate(activity)}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-red-500 dark:hover:border-red-500 cursor-pointer transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">{activity.title}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">📍 {activity.location} · 👥 {activity.max_players}人</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(activity.time).toLocaleDateString('zh-CN')}</p>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">点击应用</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* 活动名称 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">活动名称 <span className="text-red-500">*</span></label>
        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange}
          className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`}
          placeholder="请输入活动名称" />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* 活动状态 */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-1">活动状态</label>
        <select id="status" name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors">
          <option value="pre-registration">预报名</option>
          <option value="registration">正式报名</option>
          <option value="finished-pending">待结算</option>
          <option value="finished-completed">已结束</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* 活动公开状态 */}
      <div>
        <label htmlFor="visibility" className="block text-sm font-medium mb-1">活动公开状态</label>
        <select id="visibility" name="visibility" value={formData.visibility || 'public'} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors">
          <option value="public">公开</option>
          <option value="user_hidden">用户隐藏</option>
          <option value="fully_hidden">完全隐藏</option>
        </select>
      </div>

      {/* 日期和时间 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDateTime" className="block text-sm font-medium mb-1">活动开始时间 <span className="text-red-500">*</span></label>
          <input type="datetime-local" id="startDateTime" name="startDateTime" value={formData.startDateTime} onChange={handleChange}
            className={`w-full px-4 py-3 rounded-xl border ${errors.startDateTime ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} />
          {errors.startDateTime && <p className="mt-1 text-xs text-red-500">{errors.startDateTime}</p>}
        </div>
        <div>
          <label htmlFor="endDateTime" className="block text-sm font-medium mb-1">活动结束时间 <span className="text-red-500">*</span></label>
          <input type="datetime-local" id="endDateTime" name="endDateTime" value={formData.endDateTime} onChange={handleChange}
            className={`w-full px-4 py-3 rounded-xl border ${errors.endDateTime ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} />
          {errors.endDateTime && <p className="mt-1 text-xs text-red-500">{errors.endDateTime}</p>}
        </div>
      </div>

      {/* 时长 */}
      <div>
        <label className="block text-sm font-medium mb-1">活动时长 (自动计算)</label>
        <div className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500">
          {(() => {
            if (!formData.startDateTime || !formData.endDateTime) return '请先选择开始和结束时间';
            const start = new Date(formData.startDateTime);
            const end = new Date(formData.endDateTime);
            let diff = (end.getTime() - start.getTime()) / 60000;
            if (diff < 0) return '结束时间必须晚于开始时间';
            const hours = Math.floor(diff / 60);
            const mins = Math.floor(diff % 60);
            return `${hours}小时${mins}分钟`;
          })()}
        </div>
      </div>

      {/* 地点 */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">活动地点 <span className="text-red-500">*</span></label>
        <input type="text" id="location" name="location" value={formData.location} onChange={handleChange}
          className={`w-full px-4 py-3 rounded-xl border ${errors.location ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`}
          placeholder="请输入活动地点" />
        {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
      </div>

      {/* 人数限制 */}
      <div>
        <label htmlFor="maxPlayers" className="block text-sm font-medium mb-1">最大参与人数 <span className="text-red-500">*</span></label>
        <div className="relative z-0">
          <input type="number" id="maxPlayers" name="maxPlayers" value={formData.maxPlayers} onChange={handleChange} min="2" max="200"
            className={`w-full px-4 py-3 rounded-xl border ${errors.maxPlayers ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`}
            placeholder="请输入最大参与人数" />
          <Users className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        {errors.maxPlayers && <p className="mt-1 text-xs text-red-500">{errors.maxPlayers}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="maxFieldPlayers" className="block text-sm font-medium mb-1">最大上场人数 {formData.status === 'registration' && <span className="text-red-500">*</span>}</label>
          <input type="number" id="maxFieldPlayers" name="maxFieldPlayers" value={formData.maxFieldPlayers} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors" />
        </div>
        <div>
          <label htmlFor="maxWaitlist" className="block text-sm font-medium mb-1">最大候补人数 {formData.status === 'registration' && <span className="text-red-500">*</span>}</label>
          <input type="number" id="maxWaitlist" name="maxWaitlist" value={formData.maxWaitlist} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors" />
        </div>
        <div>
          <label htmlFor="proxyLimit" className="block text-sm font-medium mb-1">代报名限制</label>
          <input type="number" id="proxyLimit" name="proxyLimit" value={formData.proxyLimit} onChange={handleChange} min="0" className={`w-full px-4 py-3 rounded-xl border ${errors.proxyLimit ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} />
          <p className="mt-1 text-[10px] text-gray-500">每人最多代报人数(0为禁代报)</p>
          {errors.proxyLimit && <p className="mt-1 text-xs text-red-500">{errors.proxyLimit}</p>}
        </div>
      </div>

      {(formData.status === 'finished-pending' || formData.status === 'finished-completed') && (
        <>
          <div>
            <label htmlFor="totalCost" className="block text-sm font-medium mb-1">本次参加总费用 {formData.status === 'finished-pending' && <span className="text-red-500">*</span>}</label>
            <div className="relative z-0">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">¥</span>
              <input type="number" id="totalCost" name="totalCost" value={formData.totalCost} onChange={handleChange} className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors" />
            </div>
          </div>
          <div>
            <label htmlFor="costNote" className="block text-sm font-medium mb-1">费用说明 (选填)</label>
            <textarea id="costNote" name="costNote" value={formData.costNote || ''} onChange={handleChange} maxLength={100} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 transition-colors resize-none" placeholder="可输入费用相关说明" />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{(formData.costNote || '').length}/100</div>
          </div>
        </>
      )}

      {/* 活动描述 */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">活动描述 <span className="text-red-500">*</span></label>
        <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors resize-none`} placeholder="请详细描述活动情况，包括活动项目、赛制等" />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
      </div>

      {/* 描述图片上传 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">补充图片 (选填)</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加图片
          </button>
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
        {(formData.descriptionImages && formData.descriptionImages.length > 0) && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
            {formData.descriptionImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
                <img src={img} className="w-full h-full object-cover" alt="Description" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 活动规则 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">活动规则</label>
          <button type="button" onClick={addRule} className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400">添加规则</button>
        </div>
        <div className="space-y-2">
          {formData.rules.map((rule, index) => (
            <div key={index} className="flex space-x-2">
              <div className="flex-1">
                <input type="text" value={rule} onChange={(e) => handleRuleChange(index, e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${errors.rules ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} placeholder={`规则 ${index + 1}`} />
              </div>
              <button type="button" onClick={() => removeRule(index)} disabled={formData.rules.length <= 1} className={`p-3 rounded-xl ${formData.rules.length <= 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-red-100 dark:bg-red-900 text-red-500 hover:bg-red-200 dark:hover:bg-red-800 transition-colors'}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        {errors.rules && <p className="mt-1 text-xs text-red-500">{errors.rules}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="organizer" className="block text-sm font-medium mb-1">组织者</label>
          <input type="text" id="organizer" name="organizer" value={formData.organizer} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.organizer ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} placeholder="请输入组织者名称 (选填)" />
        </div>
        <div>
          <label htmlFor="contactInfo" className="block text-sm font-medium mb-1">联系方式</label>
          <input type="text" id="contactInfo" name="contactInfo" value={formData.contactInfo} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.contactInfo ? 'border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900' : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'} bg-white dark:bg-gray-800 focus:outline-none transition-colors`} placeholder="请输入联系方式 (选填)" />
        </div>
      </div>

      <div className="flex space-x-4 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">取消</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center">
          {isSubmitting ? <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存</>}
        </button>
      </div>
    </form>
  );
};

export default TournamentForm;