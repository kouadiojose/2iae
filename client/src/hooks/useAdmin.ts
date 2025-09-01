import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminUser {
  id: string;
  username: string;
  email: string;
}

export function useAdmin() {
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["/api/admin/me"],
    retry: (failureCount, error) => {
      // Retry on network errors, but not on 401 (unauthorized)
      const isNetworkError = !error.message?.includes('401');
      return isNetworkError && failureCount < 2;
    },
    staleTime: 30000, // Consider data fresh for 30s
    refetchOnWindowFocus: false, // Don't refetch on focus to prevent constant checks
  });

  return {
    admin: (admin as any)?.admin as AdminUser | undefined,
    isLoading,
    isAuthenticated: !!(admin as any)?.admin,
    error
  };
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/admin/login", {
        username,
        password
      });
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        // Immediately set the admin data in cache to trigger re-renders
        queryClient.setQueryData(["/api/admin/me"], {
          success: true,
          admin: data.admin
        });
        
        // Then invalidate and refetch to ensure consistency
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
        await queryClient.refetchQueries({ queryKey: ["/api/admin/me"] });
      }
    },
    retry: 1,
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/logout", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
    }
  });
}