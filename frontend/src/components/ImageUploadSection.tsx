import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLanguage } from '../contexts/LanguageContext';
import { ExternalBlob } from '../types';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface ImageUploadSectionProps {
  images: (ExternalBlob | string)[];
  onImagesChange: (images: (ExternalBlob | string)[]) => void;
  compactSplit?: boolean;
}

export default function ImageUploadSection({ images, onImagesChange, compactSplit = false }: ImageUploadSectionProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [previewUrls, setPreviewUrls] = useState<{ [key: string]: string }>({});

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 20 - images.length;
    if (files.length > remainingSlots) {
      const errorMsg = t(
        'You can only upload more images. Maximum 20 images allowed.',
        'நீங்கள் மேலும் படங்களை மட்டுமே பதிவேற்ற முடியும். அதிகபட்சம் 20 படங்கள் அனுமதிக்கப்படுகின்றன.'
      );
      toast.error(errorMsg.replace('more images', `${remainingSlots} more image(s)`).replace('மேலும் படங்களை', `${remainingSlots} மேலும் படங்களை`));
      return;
    }

    const newImages: ExternalBlob[] = [];
    const newPreviewUrls: { [key: string]: string } = { ...previewUrls };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        const errorMsg = t(
          'File is not an image',
          'கோப்பு ஒரு படம் அல்ல'
        );
        toast.error(`${file.name}: ${errorMsg}`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        const errorMsg = t(
          'File is too large. Maximum size is 10MB.',
          'கோப்பு மிகவும் பெரியது. அதிகபட்ச அளவு 10MB.'
        );
        toast.error(`${file.name}: ${errorMsg}`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const imageId = `${Date.now()}-${i}-${Math.random()}`; // Unique ID
        const blob: ExternalBlob = {
          blob: new Blob([uint8Array], { type: file.type }),
          name: file.name,
          contentType: file.type
        };
        // Mock progress for UI feedback if needed, but removing DFX specific hook
        setUploadProgress((prev) => ({ ...prev, [imageId]: 100 }));

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        newPreviewUrls[imageId] = previewUrl;
        
        // We need a way to link the blob to its preview URL or ID.
        // For now, relying on index is fragile if mixed with strings.
        // But since we append new images, it might be okay if we manage state carefully.
        // A better way is to attach the ID to the blob object, but ExternalBlob is defined elsewhere.
        // Let's attach it as a property for local tracking if possible, or just rely on the fact that
        // we are pushing to `newImages`.
        
        // Wait, the original code used `Object.keys(previewUrls)[index]` which is terrible.
        // We should store the preview URL in a map keyed by something stable.
        // But we don't have stable IDs for blobs.
        
        // Let's modify the preview logic in render.
        // For new blobs, we can use a WeakMap or just stick the preview URL on the blob object (as `any`).
        (blob as any).previewUrl = previewUrl;

        newImages.push(blob);
      } catch (error) {
        console.error('Error processing image:', error);
        const errorMsg = t(
          'Failed to process',
          'செயலாக்க முடியவில்லை'
        );
        toast.error(`${file.name}: ${errorMsg}`);
      }
    }

    if (newImages.length > 0) {
      // setPreviewUrls(newPreviewUrls); // No longer needed with property attachment
      onImagesChange([...images, ...newImages]);
      const successMsg = t(
        'images added successfully',
        'படங்கள் வெற்றிகரமாக சேர்க்கப்பட்டன'
      );
      toast.success(`${newImages.length} ${successMsg}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const imageToRemove = images[index];
    if (typeof imageToRemove !== 'string' && (imageToRemove as any).previewUrl) {
      URL.revokeObjectURL((imageToRemove as any).previewUrl);
    }
    
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  if (compactSplit) {
    return (
      <div className="w-full h-full flex flex-col min-h-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="grid grid-cols-12 gap-4 items-stretch h-full min-h-0 flex-1">
          {/* Left Column (col-span-12 md:col-span-8) — Image Gallery Area */}
          <div className="col-span-12 md:col-span-8 h-full flex flex-col min-h-0">
            {images.length > 0 ? (
              <div className="h-full w-full rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 auto-rows-[120px]">
                  {images.map((img, index) => {
                    let previewUrl = '';
                    if (typeof img === 'string') {
                      previewUrl = img;
                    } else {
                      previewUrl = (img as any).previewUrl;
                    }

                    return (
                      <div
                        key={index}
                        className="h-full rounded-xl overflow-hidden relative group border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 shadow-2xs"
                      >
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={`Property image ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          </div>
                        )}

                        {/* Cover / Primary badge on first image */}
                        {index === 0 && (
                          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                            {t('Cover', 'முகப்பு')}
                          </span>
                        )}

                        {/* Hover delete (x) button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-xs"
                          title={t('Delete image', 'படத்தை நீக்கு')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-full w-full border-2 border-dashed border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-900/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('No images uploaded yet', 'இன்னும் படங்கள் பதிவேற்றப்படவில்லை')}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('Click here or use the button on the right to upload', 'படங்களை பதிவேற்ற இங்கே கிளிக் செய்யவும்')}
                </p>
              </div>
            )}
          </div>

          {/* Right Column (col-span-12 md:col-span-4) — Guidelines & Upload Controls on the RIGHT */}
          <div className="col-span-12 md:col-span-4 h-full flex flex-col min-h-0">
            <div className="h-full flex flex-col justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-700/70">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('Property Images', 'சொத்து படங்கள்')} ({images.length}/20)
                  </h4>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                    {20 - images.length} {t('left', 'மீதம்')}
                  </span>
                </div>

                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li>{t('Upload up to 20 images of your property', 'உங்கள் சொத்தின் 20 படங்கள் வரை பதிவேற்றவும்')}</li>
                  <li>{t('Supported formats: JPEG, PNG, WebP', 'ஆதரிக்கப்படும் வடிவங்கள்: JPEG, PNG, WebP')}</li>
                  <li>{t('Maximum file size: 10MB per image', 'அதிகபட்ச கோப்பு அளவு: ஒரு படத்திற்கு 10MB')}</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 20}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('Upload Images', 'படங்களை பதிவேற்றவும்')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>
          {t('Property Images', 'சொத்து படங்கள்')} ({images.length}/20)
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= 20}
        >
          <Upload className="w-4 h-4 mr-2" />
          {t('Upload Images', 'படங்களை பதிவேற்றவும்')}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {t(
            '• Upload up to 20 images of your property',
            '• உங்கள் சொத்தின் 20 படங்கள் வரை பதிவேற்றவும்'
          )}
        </p>
        <p>
          {t(
            '• Supported formats: JPEG, PNG, WebP',
            '• ஆதரிக்கப்படும் வடிவங்கள்: JPEG, PNG, WebP'
          )}
        </p>
        <p>
          {t(
            '• Maximum file size: 10MB per image',
            '• அதிகபட்ச கோப்பு அளவு: ஒரு படத்திற்கு 10MB'
          )}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img, index) => {
            let previewUrl = '';
            if (typeof img === 'string') {
              previewUrl = img;
            } else {
              previewUrl = (img as any).previewUrl;
            }

            return (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg border bg-muted overflow-hidden">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`Property ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {images.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'No images uploaded yet. Click the button above to add images.',
              'இன்னும் படங்கள் பதிவேற்றப்படவில்லை. படங்களைச் சேர்க்க மேலே உள்ள பொத்தானைக் கிளிக் செய்யவும்.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
