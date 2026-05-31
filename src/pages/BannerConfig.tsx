import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Sun,
    Moon,
    Upload,
    Image,
    Check,
    Loader2,
    Trash2,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';

interface BannerItem {
    id: number;
    isCustom: boolean;
    filename: string;
    url: string;
    exists: boolean;
}

export default function BannerConfig() {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [banners, setBanners] = useState<BannerItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<number | string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // 加载 banner 列表
    useEffect(() => {
        const loadBanners = async () => {
            try {
                const data = await api.get('/banners');
                setBanners(data);
            } catch (err) {
                toast.error('加载 Banner 列表失败');
            } finally {
                setIsLoading(false);
            }
        };
        loadBanners();
    }, [refreshKey]);

    // 压缩图片
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

                    // 最大尺寸限制
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1080;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // 压缩到接近 1MB
                    let quality = 0.9;
                    const compress = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) return reject(new Error('Canvas to Blob failed'));
                            if (blob.size > 1024 * 1024 && quality > 0.1) {
                                quality -= 0.1;
                                compress();
                            } else {
                                resolve(new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now(),
                                }));
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

    // 处理文件上传
    const handleUpload = async (bannerId: number | 'custom', file: File) => {
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('只支持 JPEG、PNG、GIF、WebP 格式的图片');
            return;
        }

        setUploadingId(bannerId);

        try {
            toast.info('正在处理并压缩图片...');
            const compressedFile = await compressImage(file);
            
            const formData = new FormData();
            formData.append('banner', compressedFile);

            const token = localStorage.getItem('token');
            const endpoint = bannerId === 'custom' 
                ? '/sportsreg/api/banners/custom' 
                : `/sportsreg/api/banners/${bannerId}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '上传失败');
            }

            toast.success(bannerId === 'custom' ? '自定义 Banner 上传成功' : `Banner ${bannerId} 替换成功`);
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            toast.error(err.message || '上传失败');
        } finally {
            setUploadingId(null);
        }
    };

    const handleDeleteCustom = async (filename: string) => {
        if (!confirm('确定要删除这个自定义封面吗？')) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/sportsreg/api/banners/custom/${filename}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('删除失败');
            
            toast.success('删除成功');
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            toast.error(err.message || '删除失败');
        }
    };

    // 触发文件选择
    const triggerFileInput = (bannerId: number | 'custom') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                handleUpload(bannerId, file);
            }
        };
        input.click();
    };

    const defaultBanners = banners.filter(b => !b.isCustom);
    const customBanners = banners.filter(b => b.isCustom);

    return (
        <AuthGuard requiredRole="admin">
            <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                {/* 顶部导航 */}
                <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <h1 className="text-lg font-bold">活动图片配置</h1>

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        </button>
                    </div>
                </header>

                <main className="flex-1 container mx-auto px-4 py-6 space-y-8">
                    {/* 说明信息 */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-xl p-4 flex items-start"
                    >
                        <Image className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Banner 图片配置说明</p>
                            <p className="text-sm mt-1">
                                点击任意图片上的「替换」按钮，上传新图片替换当前 Banner。您可以新增不限数量的自定义 Banner。
                                建议使用宽高比 16:3 的图片（如 1920×360 像素），图片在上传时会自动压缩至 1MB 内。
                            </p>
                        </div>
                    </motion.div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                            <p className="mt-4 text-gray-500">加载中...</p>
                        </div>
                    ) : (
                        <>
                            {/* 自定义 Banner */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold">自定义封面</h2>
                                    <button
                                        onClick={() => triggerFileInput('custom')}
                                        disabled={uploadingId === 'custom'}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        {uploadingId === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        上传新封面
                                    </button>
                                </div>
                                
                                {customBanners.length === 0 ? (
                                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                        <p className="text-gray-500 dark:text-gray-400">暂无自定义封面，点击上方按钮上传</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {customBanners.map((banner) => (
                                            <motion.div
                                                key={`${banner.id}-${refreshKey}`}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 group"
                                            >
                                                <div className="relative aspect-[16/6] overflow-hidden bg-gray-100 dark:bg-gray-700">
                                                    <img
                                                        src={`${banner.url}?t=${refreshKey}`}
                                                        alt="Custom Banner"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="p-3 flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate w-32">
                                                        {banner.filename}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteCustom(banner.filename)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* 默认 Banner */}
                            <section>
                                <h2 className="text-lg font-bold mb-4">系统默认封面</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {defaultBanners.map((banner) => (
                                        <motion.div
                                            key={`${banner.id}-${refreshKey}`}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 group"
                                        >
                                            <div className="relative aspect-[16/6] overflow-hidden bg-gray-100 dark:bg-gray-700">
                                                <img
                                                    src={`${banner.url}?t=${refreshKey}`}
                                                    alt={`Banner ${banner.id}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                {uploadingId === banner.id && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                    Banner {String(banner.id).padStart(2, '0')}
                                                </span>
                                                <button
                                                    onClick={() => triggerFileInput(banner.id)}
                                                    disabled={uploadingId !== null}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                                        ${uploadingId !== null
                                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                                            : 'bg-red-500 text-white hover:bg-red-600'
                                                        }`}
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    <span>替换</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </main>
                <div className="h-6"></div>
            </div>
        </AuthGuard>
    );
}
