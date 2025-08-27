import { useQuery } from "@tanstack/react-query";

interface SiteContent {
  id: string;
  key: string;
  title: string;
  value: string;
  type: string;
  section: string;
  order: string;
  updatedAt: string;
}

export function useSiteContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/content"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const content = (data as any)?.content as SiteContent[] || [];

  const getContentByKey = (key: string): string => {
    const item = content.find(c => c.key === key);
    return item?.value || "";
  };

  const getContentBySection = (section: string): SiteContent[] => {
    return content
      .filter(c => c.section === section)
      .sort((a, b) => parseInt(a.order || "0") - parseInt(b.order || "0"));
  };

  return {
    content,
    isLoading,
    error,
    getContentByKey,
    getContentBySection
  };
}