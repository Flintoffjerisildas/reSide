import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  User,
  Check,
  Upload,
  Bell,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileSettingsViewProps {
  userProfile: any;
  refetchUserProfile?: () => Promise<any> | void;
}

export default function ProfileSettingsView({
  userProfile,
  refetchUserProfile,
}: ProfileSettingsViewProps) {
  const { t } = useLanguage();

  const [activeSubTab, setActiveSubTab] = useState<'personal' | 'security'>('personal');

  // Profile Form Data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    occupation: '',
    companyName: '',
    monthlyIncome: '',
    maritalStatus: '',
    familyMembers: '',
    idType: '',
    idNumber: '',
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [idProofImage, setIdProofImage] = useState<string | null>(null);
  const [idProofName, setIdProofName] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Security Form Data
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);

  // Sync state from userProfile prop
  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        dateOfBirth: userProfile.dateOfBirth
          ? new Date(userProfile.dateOfBirth).toISOString().split('T')[0]
          : '',
        gender: userProfile.gender || '',
        occupation: userProfile.occupation || '',
        companyName: userProfile.companyName || '',
        monthlyIncome:
          userProfile.monthlyIncome !== undefined && userProfile.monthlyIncome !== null
            ? String(userProfile.monthlyIncome)
            : '',
        maritalStatus: userProfile.maritalStatus || '',
        familyMembers:
          userProfile.familyMembers !== undefined && userProfile.familyMembers !== null
            ? String(userProfile.familyMembers)
            : '',
        idType: userProfile.idType || '',
        idNumber: userProfile.idNumber || userProfile.aadhar || '',
      });

      setNotificationsEnabled(userProfile.notificationsEnabled ?? true);

      // Load avatar from localStorage or userProfile
      const storedAvatar =
        userProfile._id || userProfile.email
          ? localStorage.getItem('user_avatar_' + (userProfile._id || userProfile.email))
          : null;
      setProfilePreview(storedAvatar || userProfile.avatar || null);

      if (userProfile.idProofImage) {
        setIdProofImage(userProfile.idProofImage);
        setIdProofName(t('Uploaded ID Proof', 'பதிவேற்றிய ஆவணம்'));
      }
    }
  }, [userProfile, t]);

  // Completion calculation
  const completionFields = [
    { key: 'name', label: t('Full Name', 'முழு பெயர்'), value: formData.name },
    { key: 'phone', label: t('Phone Number', 'தொலைபேசி எண்'), value: formData.phone },
    { key: 'address', label: t('Address', 'முகவரி'), value: formData.address },
    { key: 'dateOfBirth', label: t('Date of Birth', 'பிறந்த தேதி'), value: formData.dateOfBirth },
    { key: 'gender', label: t('Gender', 'பாலினம்'), value: formData.gender },
    { key: 'occupation', label: t('Occupation', 'தொழில்'), value: formData.occupation },
    { key: 'companyName', label: t('Company Name', 'நிறுவனத்தின் பெயர்'), value: formData.companyName },
    { key: 'monthlyIncome', label: t('Monthly Income', 'மாத வருமானம்'), value: formData.monthlyIncome },
    { key: 'maritalStatus', label: t('Marital Status', 'திருமண நிலை'), value: formData.maritalStatus },
    { key: 'familyMembers', label: t('Family Members', 'குடும்ப உறுப்பினர்கள்'), value: formData.familyMembers },
    { key: 'idType', label: t('ID Type', 'அடையாள வகை'), value: formData.idType },
    { key: 'idNumber', label: t('ID Number', 'அடையாள எண்'), value: formData.idNumber },
  ];

  const totalFields = completionFields.length;
  const filledFields = completionFields.filter(
    (f) => f.value !== undefined && f.value !== null && String(f.value).trim() !== ''
  ).length;
  const percent = Math.round((filledFields / totalFields) * 100);
  const missingFields = completionFields.filter(
    (f) => !(f.value !== undefined && f.value !== null && String(f.value).trim() !== '')
  );

  // SVG Gauge calculations
  const gaugeSize = 88;
  const gaugeStroke = 7;
  const gaugeRadius = (gaugeSize - gaugeStroke) / 2;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - percent / 100);
  const gaugeColor = percent < 40 ? '#ef4444' : percent < 80 ? '#f59e0b' : '#10b981';

  const handleMissingFieldClick = (key: string) => {
    setActiveSubTab('personal');
    setTimeout(() => {
      const el = document.getElementById(key);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
        }, 2000);
      }
    }, 60);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfilePreview(result);
        if (userProfile?._id || userProfile?.email) {
          try {
            localStorage.setItem('user_avatar_' + (userProfile._id || userProfile.email), result);
          } catch {
            // storage quota full
          }
        }
        toast.success(t('Profile avatar updated', 'சுயவிவரப் படம் மாற்றப்பட்டது'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdProofName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdProofImage(reader.result as string);
        toast.success(t('ID proof attached', 'அடையாள ஆவணம் இணைக்கப்பட்டது'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetForm = () => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        dateOfBirth: userProfile.dateOfBirth
          ? new Date(userProfile.dateOfBirth).toISOString().split('T')[0]
          : '',
        gender: userProfile.gender || '',
        occupation: userProfile.occupation || '',
        companyName: userProfile.companyName || '',
        monthlyIncome:
          userProfile.monthlyIncome !== undefined && userProfile.monthlyIncome !== null
            ? String(userProfile.monthlyIncome)
            : '',
        maritalStatus: userProfile.maritalStatus || '',
        familyMembers:
          userProfile.familyMembers !== undefined && userProfile.familyMembers !== null
            ? String(userProfile.familyMembers)
            : '',
        idType: userProfile.idType || '',
        idNumber: userProfile.idNumber || userProfile.aadhar || '',
      });
      setNotificationsEnabled(userProfile.notificationsEnabled ?? true);
      toast.info(t('Form reset to saved details', 'படிவம் மீட்டமைக்கப்பட்டது'));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        aadhar: formData.idNumber,
        address: formData.address,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender,
        occupation: formData.occupation,
        companyName: formData.companyName,
        monthlyIncome: formData.monthlyIncome ? parseInt(formData.monthlyIncome) : undefined,
        maritalStatus: formData.maritalStatus,
        familyMembers: formData.familyMembers ? parseInt(formData.familyMembers) : undefined,
        idType: formData.idType,
        idNumber: formData.idNumber,
        idProofImage: idProofImage || undefined,
        notificationsEnabled: notificationsEnabled,
      };

      await api.put('/users/profile', updateData);
      if (refetchUserProfile) {
        await refetchUserProfile();
      }
      toast.success(t('Profile updated successfully', 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது'));
    } catch (err: any) {
      console.error('Profile update error:', err);
      toast.error(
        err?.response?.data?.msg || t('Failed to update profile', 'சுயவிவரத்தைப் புதுப்பிக்க முடியவில்லை')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(
        t('Please fill all password fields', 'அனைத்து கடவுச்சொல் புலங்களையும் நிரப்பவும்')
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(
        t('New password and confirm password do not match', 'புதிய கடவுச்சொல் மற்றும் உறுதிப்படுத்தல் கடவுச்சொல் பொருந்தவில்லை')
      );
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('Password updated successfully', 'கடவுச்சொல் வெற்றிகரமாக புதுப்பிக்கப்பட்டது'));
    } catch (err: any) {
      console.error('Change password error:', err);
      toast.error(
        err?.response?.data?.msg || t('Failed to update password', 'கடவுச்சொல்லை புதுப்பிக்க முடியவில்லை')
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleDisplay =
    userProfile?.registrationPurpose ||
    (userProfile?.role === 'admin' ? 'Admin' : 'Owner / Tenant');

  return (
    <div className="w-full">
      {/* 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* ========================================================= */}
        {/* LEFT COLUMN (lg:col-span-4): Profile Identity & Completion */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md border border-slate-200/70 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          {/* Top Identity Section */}
          <div className="flex flex-col items-center text-center">
            {/* Centered Avatar Circle with Camera Overlay */}
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-white/20 shadow-xs flex items-center justify-center transition-all group-hover:border-blue-500">
                {profilePreview ? (
                  <img src={profilePreview} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-9 h-9 text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <button
                type="button"
                aria-label="Upload Avatar"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-transform group-hover:scale-110 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>

            {/* Name, Email & Role Badge */}
            <h3 className="mt-3 font-bold text-base text-slate-900 dark:text-white tracking-tight">
              {userProfile?.name || 'naveen'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {userProfile?.email || 'naveen@gmail.com'}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>{roleDisplay}</span>
            </div>
          </div>

          {/* Middle Profile Completion Ring */}
          <div className="my-5 py-3 border-y border-slate-100 dark:border-slate-800/80 flex flex-col items-center">
            <div className="flex items-center gap-4 w-full">
              {/* Circular Gauge */}
              <div className="relative shrink-0" style={{ width: gaugeSize, height: gaugeSize }}>
                <svg width={gaugeSize} height={gaugeSize} className="transform -rotate-90">
                  <circle
                    cx={gaugeSize / 2}
                    cy={gaugeSize / 2}
                    r={gaugeRadius}
                    stroke="currentColor"
                    strokeWidth={gaugeStroke}
                    fill="none"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx={gaugeSize / 2}
                    cy={gaugeSize / 2}
                    r={gaugeRadius}
                    stroke={gaugeColor}
                    strokeWidth={gaugeStroke}
                    fill="none"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeDashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                    {percent}%
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium mt-0.5">
                    {t('Complete', 'நிறைவு')}
                  </span>
                </div>
              </div>

              {/* Progress Summary / Status */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {percent === 100
                    ? t('Profile 100% Complete', 'சுயவிவரம் முழுமை பெற்றது')
                    : t('Profile Completion', 'சுயவிவர முன்னேற்றம்')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {percent === 100
                    ? t('All required personal & KYC details verified.', 'அனைத்து விவரங்களும் நிரப்பப்பட்டுள்ளன.')
                    : t(
                        `${missingFields.length} field${missingFields.length > 1 ? 's' : ''} remaining to complete verification.`,
                        `${missingFields.length} புலங்கள் பூர்த்தி செய்யப்பட வேண்டும்.`
                      )}
                </p>
              </div>
            </div>

            {/* Missing Fields Interactive Wrap-Grid */}
            {missingFields.length > 0 ? (
              <div className="w-full mt-3 pt-2.5 border-t border-slate-100/80 dark:border-slate-800/60">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <span>{t('Missing Fields', 'இல்லாத புலங்கள்')}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    {missingFields.length} {t('left', 'மீதம்')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-1">
                  {missingFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => handleMissingFieldClick(field.key)}
                      title={`Click to focus ${field.label}`}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                    >
                      + {field.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full mt-3 pt-2 border-t border-slate-100/80 dark:border-slate-800/60 text-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 px-3 py-1 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  {t('Profile is fully verified', 'சுயவிவரம் முழுமையாக பூர்த்தி செய்யப்பட்டது')}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Notification Preference */}
          <div className="p-2.5 sm:p-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate leading-none">
                  {t('Notification Preference', 'அறிவிப்புகள்')}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                  {t('Receive important updates and alerts', 'முக்கிய புதுப்பிப்புகள் மற்றும் எச்சரிக்கைகள்')}
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => setNotificationsEnabled((prev) => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (lg:col-span-8): Multi-Row Profile & Security */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 bg-white/95 dark:bg-[#070e1b]/70 dark:backdrop-blur-md border border-slate-200/70 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          {/* Card Header with Sub-Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {t('Profile Settings', 'சுயவிவர அமைப்புகள்')}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('Manage your personal, KYC verification, and account security details', 'உங்கள் தனிப்பட்ட, KYC மற்றும் பாதுகாப்பு விவரங்களை நிர்வகிக்கவும்')}
              </p>
            </div>

            {/* Compact Segmented Pill Toggle */}
            <div className="inline-flex p-1 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveSubTab('personal')}
                className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  activeSubTab === 'personal'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {t('Personal & KYC', 'தனிப்பட்ட & KYC')}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('security')}
                className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  activeSubTab === 'security'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {t('Security & Password', 'பாதுகாப்பு & கடவுச்சொல்')}
              </button>
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 py-3.5">
            {activeSubTab === 'personal' ? (
              <form id="profileForm" onSubmit={handleUpdateProfile} className="space-y-3.5">
                {/* Row 1: Full Name | Email | Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="name" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Full Name', 'முழு பெயர்')}
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder={t('Enter full name', 'முழு பெயரை உள்ளிடவும்')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Email Address', 'மின்னஞ்சல் முகவரி')}
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={userProfile?.email || 'naveen@gmail.com'}
                        disabled
                        className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-100/70 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 px-3 pr-8 cursor-not-allowed"
                      />
                      <Lock className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Phone Number', 'தொலைபேசி எண்')}
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder={t('+91 98765 43210', '+91 98765 43210')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Row 2: Permanent Address (col-span-6) | Date of Birth (col-span-3) | Gender (col-span-3) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label htmlFor="address" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Permanent Address', 'நிரந்தர முகவரி')}
                    </label>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder={t('Enter street, city, postal code', 'முகவரியை உள்ளிடவும்')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="dateOfBirth" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Date of Birth', 'பிறந்த தேதி')}
                    </label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="gender" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Gender', 'பாலினம்')}
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="">{t('Select Gender', 'பாலினம் தேர்வு')}</option>
                      <option value="Male">{t('Male', 'ஆண்')}</option>
                      <option value="Female">{t('Female', 'பெண்')}</option>
                      <option value="Other">{t('Other', 'மற்றவை')}</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Occupation | Company Name | Monthly Income | Marital Status / Family Members */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label htmlFor="occupation" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Occupation', 'தொழில்')}
                    </label>
                    <input
                      id="occupation"
                      name="occupation"
                      type="text"
                      value={formData.occupation}
                      onChange={handleInputChange}
                      placeholder={t('e.g., Engineer / Business', 'எ.கா., பொறியாளர்')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="companyName" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Company Name', 'நிறுவன பெயர்')}
                    </label>
                    <input
                      id="companyName"
                      name="companyName"
                      type="text"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder={t('e.g., Tech Corp', 'எ.கா., டெக் கார்ப்')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="monthlyIncome" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Monthly Income', 'மாத வருமானம்')}
                    </label>
                    <input
                      id="monthlyIncome"
                      name="monthlyIncome"
                      type="number"
                      min="0"
                      value={formData.monthlyIncome}
                      onChange={handleInputChange}
                      placeholder={t('₹ 75000', '₹ 75000')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="maritalStatus" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Marital Status', 'திருமண நிலை')}
                    </label>
                    <select
                      id="maritalStatus"
                      name="maritalStatus"
                      value={formData.maritalStatus}
                      onChange={handleInputChange}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="">{t('Status', 'நிலை')}</option>
                      <option value="Single">{t('Single', 'திருமணமாகாதவர்')}</option>
                      <option value="Married">{t('Married', 'திருமணமானவர்')}</option>
                      <option value="Divorced">{t('Divorced', 'விவாகரத்து')}</option>
                      <option value="Widowed">{t('Widowed', 'விதவை')}</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="familyMembers" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Family Members', 'உறுப்பினர்கள்')}
                    </label>
                    <input
                      id="familyMembers"
                      name="familyMembers"
                      type="number"
                      min="1"
                      value={formData.familyMembers}
                      onChange={handleInputChange}
                      placeholder={t('e.g., 4', 'எ.கா., 4')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Row 4: KYC Verification (ID Type select | ID Number input | Upload ID Proof compact styled pill) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="idType" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('ID Proof Type', 'அடையாள வகை')}
                    </label>
                    <select
                      id="idType"
                      name="idType"
                      value={formData.idType}
                      onChange={handleInputChange}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="">{t('Select ID Document', 'ஆவண வகை தேர்வு')}</option>
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="PAN">PAN Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="idNumber" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('ID Document Number', 'அடையாள எண்')}
                    </label>
                    <input
                      id="idNumber"
                      name="idNumber"
                      type="text"
                      value={formData.idNumber}
                      onChange={handleInputChange}
                      placeholder={t('XXXX XXXX XXXX', 'XXXX XXXX XXXX')}
                      className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Upload ID Proof', 'ஆவணம் பதிவேற்றம்')}
                    </label>
                    <button
                      type="button"
                      onClick={() => idProofInputRef.current?.click()}
                      className="h-9 w-full rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer px-3 truncate"
                    >
                      {idProofName || idProofImage ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">{idProofName || t('ID Proof Attached', 'இணைக்கப்பட்டது')}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{t('Upload Document (PNG/PDF)', 'ஆவணத்தை பதிவேற்றவும்')}</span>
                        </>
                      )}
                    </button>
                    <input
                      type="file"
                      ref={idProofInputRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleIdProofFileChange}
                    />
                  </div>
                </div>
              </form>
            ) : (
              /* Tab 2: Security & Password */
              <form id="passwordForm" onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="currentPassword" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Current Password', 'தற்போதைய கடவுச்சொல்')}
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('New Password', 'புதிய கடவுச்சொல்')}
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('Confirm New Password', 'புதிய கடவுச்சொல்லை உறுதிசெய்')}
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-9 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-blue-100/80 dark:border-blue-950/40 bg-blue-50/40 dark:bg-blue-950/20 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                  <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    {t(
                      'Ensure your password is at least 6 characters long and includes a mix of letters, numbers, and symbols for high account security.',
                      'வலுவான கணக்கு பாதுகாப்பிற்கு குறைந்தபட்சம் 6 எழுத்துக்கள் மற்றும் எண்களைப் பயன்படுத்தவும்.'
                    )}
                  </span>
                </div>
              </form>
            )}
          </div>

          {/* Sticky / Bottom Card Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('Data is encrypted and stored securely', 'அனைத்து தரவுகளும் பாதுகாப்பாக வைக்கப்பட்டுள்ளன')}</span>
            </span>

            {activeSubTab === 'personal' ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="rounded-full px-4 py-2 text-xs font-semibold border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('Cancel', 'ரத்து')}
                </button>
                <button
                  type="submit"
                  form="profileForm"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-xs font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? t('Saving...', 'சேமிக்கிறது...') : t('Save Changes', 'மாற்றங்களைச் சேமிக்கவும்')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="rounded-full px-4 py-2 text-xs font-semibold border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('Clear', 'அழி')}
                </button>
                <button
                  type="submit"
                  form="passwordForm"
                  disabled={isUpdatingPassword}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-xs font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingPassword ? t('Updating...', 'புதுப்பிக்கிறது...') : t('Update Password', 'கடவுச்சொல்லை புதுப்பிக்கவும்')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
