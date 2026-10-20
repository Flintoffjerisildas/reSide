import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Property, UserProfile, PropertyStatus, PropertyRequest } from '../types';
import { TamilRole } from '../types';

// Define simplified types that might be used in components
// You may need to expand these based on usage
interface PropertyInput {
  title: string;
  propertyType: string;
  location: string;
  price: bigint | number;
  transactionType: string;
  description?: string;
  amenities?: string[];
  status: any;
  images: any[];
  geoLocatedImage: any;
  geoLocation: any;
  totalArea?: number;
  bedrooms?: number;
  facing?: string;
}

// User Profile Queries
export function useGetCallerUserProfile() {
  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        // Primary path: authenticated current user from /auth/me
        const primaryRes = await api.get('/auth/me');
        const primaryUser = primaryRes.data;
        if (primaryUser) {
          const profile: UserProfile = {
            id: primaryUser._id || primaryUser.id,
            name: primaryUser.name,
            email: primaryUser.email,
            role: primaryUser.tamilRole as TamilRole,
            approved: primaryUser.approved,
            internalRole: primaryUser.role,
            blocked: primaryUser.blocked,
            walletAddress: 'MERN-Wallet-Placeholder',
            phone: primaryUser.phone,
            address: primaryUser.address,
            aadhar: primaryUser.aadhar,
            gender: primaryUser.gender,
            age: primaryUser.age,
            dateOfBirth: primaryUser.dateOfBirth,
            familyMembers: primaryUser.familyMembers,
            religion: primaryUser.religion,
            occupation: primaryUser.occupation,
            companyName: primaryUser.companyName,
            monthlyIncome: primaryUser.monthlyIncome,
            maritalStatus: primaryUser.maritalStatus,
            idType: primaryUser.idType,
            idNumber: primaryUser.idNumber,
            idProofImage: primaryUser.idProofImage,
            notificationsEnabled: primaryUser.notificationsEnabled,
            profileCompletion: primaryUser.profileCompletion
          };
          return profile;
        }
        return null;
      } catch (error) {
        return null;
      }
    },
    retry: false,
  });

  return {
    ...query,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
  };
}

export function useRegisterUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, email, role, password }: { name: string; email: string; role: TamilRole; password?: string }) => {
      const finalPassword = password || 'defaultPassword123';
      const res = await api.post('/auth/register', { 
        name, 
        email, 
        password: finalPassword, 
        tamilRole: role 
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStatus'] });
    },
  });
}

// Approval Queries
export function useIsCallerApproved() {
  const { data: profile, isLoading } = useGetCallerUserProfile();
  
  return {
    data: profile?.approved ?? false,
    isLoading
  };
}

export function useSaveCallerUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// --- New Hooks for MERN Stack ---

// Properties
export function useAddProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (property: PropertyInput) => {
      // Convert BigInt to string/number for JSON serialization if needed
      // but Axios might handle it or we cast it
      const payload = {
        ...property,
        // Backend expects `propertyFacing`; frontend form uses `facing`
        propertyFacing: (property as any).facing,
        price: Number(property.price) // Convert BigInt to number for MongoDB
      };
      
      const res = await api.post('/properties', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProperties'] });
      queryClient.invalidateQueries({ queryKey: ['myProperties'] });
    }
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PropertyInput> }) => {
      const payload = {
        ...data,
        propertyFacing: (data as any).facing,
        price: data.price ? Number(data.price) : undefined,
        totalArea: data.totalArea ? Number(data.totalArea) : undefined,
        bedrooms: data.bedrooms ? Number(data.bedrooms) : undefined,
      };
      
      const res = await api.put(`/properties/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProperties'] });
      queryClient.invalidateQueries({ queryKey: ['myProperties'] });
    }
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/properties/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProperties'] });
      queryClient.invalidateQueries({ queryKey: ['myProperties'] });
    }
  });
}

export function useGetAllProperties() {
  return useQuery({
    queryKey: ['allProperties'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/properties', { signal });
      // Ensure id property exists for frontend components
      return res.data.map((p: any) => ({
        ...p,
        id: p._id || p.id,
        propertyType: p.propertyType ?? p.propertyCategory ?? p.type,
        facing: p.facing ?? p.propertyFacing
      }));
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
    retry: false
  });
}

export function useGetMyProperties() {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['myProperties'],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get('/properties/my');
      // Ensure id property exists for frontend components
      return res.data.map((p: any) => ({
        ...p,
        id: p._id || p.id,
        propertyType: p.propertyType ?? p.propertyCategory ?? p.type,
        facing: p.facing ?? p.propertyFacing
      }));
    }
  });
}

// Request Hooks

export const useCreateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { propertyId: string; type: 'rent' | 'buy'; message?: string }) => {
      const response = await api.post('/requests', data);
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-requests'] });
    },
  });
};

export const useGetOwnerRequests = () => {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['owner-requests'],
    enabled: !!token,
    queryFn: async () => {
      const response = await api.get<PropertyRequest[]>('/requests/owner');
      return response.data as any;
    },
  });
};

export const useGetTenantRequests = () => {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['tenant-requests'],
    enabled: !!token,
    queryFn: async () => {
      const response = await api.get<PropertyRequest[]>('/requests/tenant');
      return response.data as any;
    },
  });
};

export const useApproveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.put(`/requests/${requestId}/approve`, {});
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-properties'] });
    },
  });
};

export const useRejectRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.put(`/requests/${requestId}/reject`, {});
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
    },
  });
};

// Vacate Request Hooks

export const useCreateVacateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { propertyId: string; reason: string; requestedVacateDate: string }) => {
      const response = await api.post('/vacate-request', data);
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-vacate-requests'] });
    },
  });
};

export const useGetMyVacateRequests = () => {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['my-vacate-requests'],
    enabled: !!token,
    queryFn: async () => {
      const response = await api.get('/vacate-request/my');
      return response.data as any[];
    },
  });
};

export const useCancelVacateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/vacate-request/${id}`);
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-vacate-requests'] });
    },
  });
};

export const useGetVacateRequestsForProperty = (propertyId: string | null) => {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['vacate-requests-property', propertyId],
    enabled: !!token && !!propertyId,
    queryFn: async () => {
      const response = await api.get(`/vacate-request/property/${propertyId}`);
      return response.data as any[];
    },
  });
};

export const useApproveVacateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/vacate-request/${id}/approve`, {});
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacate-requests-property'] });
      queryClient.invalidateQueries({ queryKey: ['myProperties'] });
      queryClient.invalidateQueries({ queryKey: ['agreements-owner'] });
    },
  });
};

export const useRejectVacateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/vacate-request/${id}/reject`, {});
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacate-requests-property'] });
    },
  });
};

export const useCompleteVacateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/vacate-request/${id}/complete`, {});
      return response.data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacate-requests-property'] });
      queryClient.invalidateQueries({ queryKey: ['myProperties'] });
      queryClient.invalidateQueries({ queryKey: ['agreements-owner'] });
      queryClient.invalidateQueries({ queryKey: ['agreements-tenant'] });
    },
  });
};

// Rent History Queries
export function useGetOwnerRentHistory() {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['ownerRentHistory'],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get('/payments/owner/rent-history');
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGetTenantRentHistory() {
  const token = localStorage.getItem('token');
  return useQuery({
    queryKey: ['tenantRentHistory'],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get('/payments/tenant/rent-history');
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useOwnerRentReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['ownerRentReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/rent', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useOwnerOccupancyReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['ownerOccupancyReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/occupancy', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 60
  });
}

export function useOwnerMaintenanceReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['ownerMaintenanceReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/maintenance', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useTenantPaymentHistoryReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['tenantPaymentHistoryReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/tenant/payment-history', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useTenantExpenseSummaryReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['tenantExpenseSummaryReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/tenant/expense-summary', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 60
  });
}

export function useTenantMaintenanceReport(
  params: { from?: string; to?: string; propertyId?: string; ai?: boolean | string; locale?: string } | undefined,
  enabled: boolean = true
) {
  const key = params ? JSON.stringify(params) : '';
  return useQuery({
    queryKey: ['tenantMaintenanceReport', key],
    queryFn: async () => {
      const res = await api.get('/reports/tenant/maintenance', { params });
      return res.data as any;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['adminOverview'],
    queryFn: async () => {
      const res = await api.get('/users/admin/overview');
      return res.data;
    },
    staleTime: 1000 * 30
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => {
      const res = await api.get('/users/admin/analytics');
      return res.data;
    },
    staleTime: 1000 * 60
  });
}

export function useAdminNotifications() {
  return useQuery({
    queryKey: ['adminNotifications'],
    queryFn: async () => {
      const res = await api.get('/users/admin/notifications');
      return res.data;
    },
    staleTime: 1000 * 15
  });
}

export function useAdminRevenueReport(months?: number, enabled: boolean = true) {
  const normalized = Number.isFinite(Number(months)) ? Number(months) : 12;
  return useQuery({
    queryKey: ['adminRevenueReport', normalized],
    queryFn: async () => {
      const res = await api.get('/users/admin/revenue-report', { params: { months: normalized } });
      return res.data;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useAdminPaymentStatusReport(months?: number, enabled: boolean = true) {
  const normalized = Number.isFinite(Number(months)) ? Number(months) : 1;
  return useQuery({
    queryKey: ['adminPaymentStatusReport', normalized],
    queryFn: async () => {
      const res = await api.get('/users/admin/payment-status-report', { params: { months: normalized } });
      return res.data;
    },
    enabled,
    staleTime: 1000 * 30
  });
}

export function useAdminPropertyPerformanceReport(months?: number, enabled: boolean = true) {
  const normalized = Number.isFinite(Number(months)) ? Number(months) : 12;
  return useQuery({
    queryKey: ['adminPropertyPerformanceReport', normalized],
    queryFn: async () => {
      const res = await api.get('/users/admin/property-performance-report', { params: { months: normalized } });
      return res.data;
    },
    enabled,
    staleTime: 1000 * 60
  });
}

export function useAdminOccupancyReport(enabled: boolean = true) {
  return useQuery({
    queryKey: ['adminOccupancyReport'],
    queryFn: async () => {
      const res = await api.get('/users/admin/occupancy-report');
      return res.data;
    },
    enabled,
    staleTime: 1000 * 60
  });
}

export function useAdminMaintenanceReport(months?: number, enabled: boolean = true) {
  const normalized = Number.isFinite(Number(months)) ? Number(months) : 12;
  return useQuery({
    queryKey: ['adminMaintenanceReport', normalized],
    queryFn: async () => {
      const res = await api.get('/users/admin/maintenance-report', { params: { months: normalized } });
      return res.data;
    },
    enabled,
    staleTime: 1000 * 60
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data as any[];
    }
  });
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; phone?: string; tamilRole: string; password?: string }) => {
      const res = await api.post('/users/admin/create-user', data);
      return res.data as { user: any; tempPassword: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['adminNotifications'] });
    }
  });
}

export function useAdminSendAnnouncement() {
  return useMutation({
    mutationFn: async (data: { title: string; message: string }) => {
      const res = await api.post('/users/admin/announcement', data);
      return res.data as { ok: boolean };
    }
  });
}

export function useAdminApproveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/users/${id}/approve`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['adminNotifications'] });
    }
  });
}

export function useAdminBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const res = await api.put(`/users/${id}/${blocked ? 'block' : 'unblock'}`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['adminNotifications'] });
    }
  });
}

export function useAdminAssignUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await api.put(`/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });
}

export function useAdminAssignUserTamilRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tamilRole }: { id: string; tamilRole: string }) => {
      const res = await api.put(`/users/${id}/tamilRole`, { tamilRole });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });
}

export function useAdminProperties(filters?: { status?: string; occupancyStatus?: string }) {
  return useQuery({
    queryKey: ['adminProperties', filters],
    queryFn: async () => {
      const res = await api.get('/properties/admin', { params: filters || {} });
      return (res.data || []).map((p: any) => ({
        ...p,
        id: p._id || p.id,
        facing: p.facing ?? p.propertyFacing
      }));
    }
  });
}

export function useAdminCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/properties/admin', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProperties'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    }
  });
}

export function useAdminUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/properties/admin/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProperties'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    }
  });
}

export function useAdminDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/properties/admin/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProperties'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    }
  });
}

export function useAdminMaintenance(status?: string) {
  return useQuery({
    queryKey: ['adminMaintenance', status],
    queryFn: async () => {
      const res = await api.get('/requests/admin/maintenance', { params: status ? { status } : {} });
      return res.data as any[];
    }
  });
}

export function useAdminUpdateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, assignedTo }: { id: string; status?: string; assignedTo?: string }) => {
      const res = await api.put(`/requests/admin/maintenance/${id}`, { status, assignedTo });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMaintenance'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['adminNotifications'] });
    }
  });
}

export function useAdminPayments(status?: string) {
  return useQuery({
    queryKey: ['adminPayments', status],
    queryFn: async () => {
      const res = await api.get('/payments/admin/payments', { params: status ? { status } : {} });
      return res.data as any[];
    }
  });
}

export function useAdminOverduePayments() {
  return useQuery({
    queryKey: ['adminOverduePayments'],
    queryFn: async () => {
      const res = await api.get('/payments/admin/overdue');
      return res.data as any[];
    }
  });
}
