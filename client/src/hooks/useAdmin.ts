import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminUser {
  id: string;
  username: string;
  email: string;
}

export function useAdmin() {
  const { data: admin, isLoading } = useQuery({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  return {
    admin: (admin as any)?.admin as AdminUser | undefined,
    isLoading,
    isAuthenticated: !!(admin as any)?.admin,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
    }
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